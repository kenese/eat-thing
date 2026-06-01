import {matchIngredients} from './food-matcher.js';
import {generateGeminiJson} from './gemini.js';
import {normalizeRecipeAmount} from './recipe-quantities.js';
import type {ImportedIngredient} from '@eat/shared';
import {Readability} from '@mozilla/readability';
import {JSDOM} from 'jsdom';

interface SchemaRecipeIngredient {
    name: string;
    qty: string;
    unit: string;
    section?: string;
}

interface RawExtracted {
    name: string;
    servings: number;
    instructions: string | null;
    ingredients: SchemaRecipeIngredient[];
}

// ─── Schema.org parser ───────────────────────────────────────────────────────

function parseSchemaOrg(html: string): RawExtracted | null {
    const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRe.exec(html)) !== null) {
        try {
            const raw = JSON.parse(match[1]);
            const nodes: unknown[] = Array.isArray(raw) ? raw : raw['@graph'] ? raw['@graph'] : [raw];
            for (const node of nodes) {
                if (
                    node &&
                    typeof node === 'object' &&
                    (node as Record<string, unknown>)['@type'] === 'Recipe'
                ) {
                    return extractSchemaNode(node as Record<string, unknown>);
                }
            }
        } catch {
            continue;
        }
    }
    return null;
}

function extractSchemaNode(node: Record<string, unknown>): RawExtracted | null {
    const name = typeof node['name'] === 'string' ? node['name'].trim() : null;
    if (!name) return null;

    const yieldRaw = node['recipeYield'];
    let servings = 4;
    if (Array.isArray(yieldRaw) && typeof yieldRaw[0] === 'string') {
        servings = parseInt(yieldRaw[0]) || 4;
    } else if (typeof yieldRaw === 'string') {
        servings = parseInt(yieldRaw) || 4;
    } else if (typeof yieldRaw === 'number') {
        servings = yieldRaw;
    }

    const rawInstructions = node['recipeInstructions'];
    let instructions: string | null = null;
    if (typeof rawInstructions === 'string') {
        instructions = rawInstructions.trim() || null;
    } else if (Array.isArray(rawInstructions)) {
        const parts: string[] = [];
        for (const item of rawInstructions) {
            if (typeof item === 'string') {
                parts.push(item);
            } else if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                if (obj['@type'] === 'HowToSection') {
                    const sectionName = typeof obj['name'] === 'string' ? obj['name'].trim() : null;
                    if (sectionName) parts.push(`## ${sectionName}`);
                    const steps = Array.isArray(obj['itemListElement']) ? obj['itemListElement'] : [];
                    for (const step of steps) {
                        if (typeof step === 'string') {
                            parts.push(step);
                        } else if (step && typeof step === 'object') {
                            const text = (step as Record<string, unknown>)['text'];
                            if (typeof text === 'string' && text.trim()) parts.push(text.trim());
                        }
                    }
                } else {
                    const text = obj['text'];
                    if (typeof text === 'string' && text.trim()) parts.push(text.trim());
                }
            }
        }
        instructions = parts.filter(Boolean).join('\n\n') || null;
    }

    const rawIngredients = node['recipeIngredient'];
    const ingredientStrings: string[] = Array.isArray(rawIngredients)
        ? rawIngredients.filter((s): s is string => typeof s === 'string')
        : [];

    const ingredients = ingredientStrings.map(s => parseIngredientString(s));

    return {name, servings, instructions, ingredients};
}

const INGREDIENT_UNITS = ['g', 'gram', 'grams', 'gr', 'ml', 'milliliter', 'milliliters', 'kg', 'kilogram', 'kilograms', 'l', 'liter', 'liters', 'litre', 'litres', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces', 'lb', 'pound', 'pounds'];

// Very basic ingredient string parser — qty unit name
function parseIngredientString(raw: string): SchemaRecipeIngredient {
    const cleaned = raw.trim().replace(/¼/g, '1/4').replace(/½/g, '1/2').replace(/¾/g, '3/4');
    const parts = cleaned.split(/\s+/);
    let qty = '1';
    let unit = '';
    let nameStart = 0;

    const numMatch = cleaned.match(/^(\d+(?:\s+\d+\/\d+|[./]\d+)?)/);
    if (numMatch) {
        qty = numMatch[1];
        nameStart = qty.includes(' ') ? 2 : 1;

        // Handle unit fused directly to the number with no space (e.g. "1kg", "500ml", "1.5l")
        const fusedUnit = (parts[0] ?? '').slice(qty.split(' ')[0].length).toLowerCase();
        if (INGREDIENT_UNITS.includes(fusedUnit)) {
            unit = fusedUnit;
        }
    }

    if (!unit) {
        const unitStr = (parts[nameStart] ?? '').toLowerCase();
        if (INGREDIENT_UNITS.includes(unitStr)) {
            unit = parts[nameStart] ?? '';
            nameStart++;
        }
    }

    const name = parts.slice(nameStart).join(' ') || raw;
    return {name, qty, unit};
}

// ─── HTML cleaner ────────────────────────────────────────────────────────────

function cleanHtmlWithReadability(html: string): string {
    const doc = new JSDOM(html);
    const reader = new Readability(doc.window.document);
    const article = reader.parse();
    return article?.textContent?.replace(/\s{3,}/g, '\n\n').slice(0, 12000) ?? '';
}

// ─── Gemini text extractor ───────────────────────────────────────────────────

interface GeminiSection {
    name: string | null;
    ingredients: SchemaRecipeIngredient[];
    instructions: string | null;
}

interface GeminiResponse {
    name: string;
    servings: number;
    sections: GeminiSection[];
}

async function extractWithGemini(cleanText: string): Promise<RawExtracted | null> {
    const prompt = `Extract the recipe from this webpage text. Return ONLY valid JSON with this exact shape:
{"name":"string","servings":4,"sections":[{"name":"string or null","ingredients":[{"name":"string","qty":"string","unit":"string"}],"instructions":"string or null"}]}

Rules:
- Preserve all original quantities and units exactly as written. Do not convert measurements.
- Do not paraphrase ingredients or instructions — keep the original wording.
- A recipe with no named sections should return a single section with name: null.
- Multiple components (e.g. "For the sauce", "For the pasta") should be separate sections.

Webpage text:
${cleanText}`;

    try {
        const gemini = await generateGeminiJson<GeminiResponse>(prompt, {maxOutputTokens: 8192});
        if (!gemini?.name || !Array.isArray(gemini.sections)) return null;

        const ingredients: SchemaRecipeIngredient[] = [];
        const instructionParts: string[] = [];

        for (const sec of gemini.sections) {
            const sectionName = sec.name?.trim() || null;
            for (const ing of sec.ingredients ?? []) {
                ingredients.push({...ing, ...(sectionName ? {section: sectionName} : {})});
            }
            if (sec.instructions?.trim()) {
                if (sectionName) instructionParts.push(`## ${sectionName}`);
                instructionParts.push(sec.instructions.trim());
            }
        }

        return {
            name: gemini.name,
            servings: gemini.servings ?? 4,
            instructions: instructionParts.join('\n\n') || null,
            ingredients,
        };
    } catch (e) {
        throw e;
    }
}

// ─── Metric annotation ───────────────────────────────────────────────────────

function formatMetricQty(qty: number): string {
    const rounded = Math.round(qty * 10) / 10;
    return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

function annotateMetric(
    ingredients: SchemaRecipeIngredient[],
): Array<SchemaRecipeIngredient & { metric: string | null }> {
    return ingredients.map(ing => {
        const canonical = normalizeRecipeAmount(ing.qty, ing.unit);
        const metric = canonical ? `${formatMetricQty(canonical.qty)} ${canonical.unit}` : null;
        return {...ing, metric};
    });
}

// ─── Hero image resolver ─────────────────────────────────────────────────────

function resolveHeroImage(html: string, baseUrl: string): string | null {
    const ogMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]) return resolveUrl(ogMatch[1], baseUrl);

    const twitterMatch =
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twitterMatch?.[1]) return resolveUrl(twitterMatch[1], baseUrl);

    const imgMatch = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i);
    if (imgMatch?.[1] && !imgMatch[1].startsWith('data:')) {
        return resolveUrl(imgMatch[1], baseUrl);
    }

    return null;
}

function resolveUrl(src: string, baseUrl: string): string {
    try {
        return new URL(src, baseUrl).href;
    } catch {
        return src;
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ExtractedRecipe {
    name: string;
    servings: number;
    sourceUrl: string;
    heroImageUrl: string | null;
    instructions: string | null;
    ingredients: ImportedIngredient[];
}

async function extractFromUrl(url: string): Promise<ExtractedRecipe> {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    try {
        const schemaRaw = parseSchemaOrg(html);
        const raw = schemaRaw ?? await extractWithGemini(cleanHtmlWithReadability(html));
        if (!raw) {
            console.error('Could not extract recipe from this URL', raw, html);
            throw new Error('Could not extract recipe from this URL' + JSON.stringify(raw) + JSON.stringify(html));
        }

        if (schemaRaw) {
            console.log('recipe from url - via scema', schemaRaw);
        } else {
            console.log('recipe from url - via llm', raw);
        }
        const annotated = annotateMetric(raw.ingredients);
        const heroImageUrl = resolveHeroImage(html, url);

        const matched = await matchIngredients(annotated.map(i => i.name));

        const ingredients: ImportedIngredient[] = annotated.map((ing, idx) => {
            const m = matched[idx];
            return {
                rawText: ing.name,
                canonicalFoodId: m.canonicalFoodId,
                foodName: m.foodName,
                canonicalDefaultUnit: m.canonicalDefaultUnit,
                qty: ing.qty,
                unit: ing.unit,
                section: ing.section ?? null,
                metric: ing.metric,
                optional: false,
                confidence: m.confidence,
            };
        });

        return {
            name: raw.name,
            servings: raw.servings,
            sourceUrl: url,
            heroImageUrl,
            instructions: raw.instructions,
            ingredients,
        };
    } catch (e) {
        console.log('Extract from Url ingestion failed:', e);
        throw e;
    }
}

// Exported for testing only
export {parseSchemaOrg, annotateMetric, resolveHeroImage, extractFromUrl};
