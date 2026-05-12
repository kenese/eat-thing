import json
import re

def parse_recipes(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Strip line numbers and trailing newlines
    content_lines = []
    for line in lines:
        match = re.match(r'^\d+: (.*)', line)
        if match:
            content_lines.append(match.group(1))
        else:
            # Fallback if no line number (shouldn't happen with view_file output but good for safety)
            content_lines.append(line.strip())

    results = []
    current_result = None
    
    # regex for result header: --- Result N (X% match) ---
    header_pattern = re.compile(r'^--- Result (\d+) \(.*\) ---$')
    
    for line in content_lines:
        line = line.strip()
        header_match = header_pattern.match(line)
        
        if header_match:
            if current_result:
                results.append(current_result)
            current_result = {
                "id": header_match.group(1),
                "captured": "",
                "type": "",
                "topics": [],
                "people": [],
                "content": []
            }
            continue
            
        if current_result is not None:
            if line.startswith("Captured:"):
                current_result["captured"] = line.replace("Captured:", "").strip()
            elif line.startswith("Type:"):
                current_result["type"] = line.replace("Type:", "").strip()
            elif line.startswith("Topics:"):
                current_result["topics"] = [t.strip() for t in line.replace("Topics:", "").split(",")]
            elif line.startswith("People:"):
                current_result["people"] = [p.strip() for p in line.replace("People:", "").split(",")]
            else:
                if line or (current_result["content"] and current_result["content"][-1]):
                    current_result["content"].append(line)

    if current_result:
        results.append(current_result)

    # Further process content to separate name, ingredients, method
    processed_recipes = []
    for res in results:
        content_text = "\n".join(res["content"]).strip()
        
        # Try to extract a name (usually the first line)
        lines = [l for l in res["content"] if l.strip()]
        name = "Unknown Recipe"
        if lines:
            # Clean up the name line
            name_line = lines[0]
            name_line = re.sub(r'^Recipe from the user\'s Evernote archive — ', '', name_line)
            name_line = re.sub(r'\.$', '', name_line)
            name = name_line
            
        recipe = {
            "name": name,
            "type": res["type"],
            "topics": res["topics"],
            "people": res["people"],
            "captured": res["captured"],
            "full_text": content_text
        }
        processed_recipes.append(recipe)
        
    return processed_recipes

if __name__ == "__main__":
    input_file = "/Users/keneselautusi/.gemini/antigravity/brain/c454e267-fe4f-4cc4-a2de-c56815591ef4/.system_generated/steps/5/output.txt"
    output_file = "/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/openbrain_recipes.json"
    
    recipes = parse_recipes(input_file)
    with open(output_file, 'w') as f:
        json.dump(recipes, f, indent=2)
    
    print(f"Successfully saved {len(recipes)} recipes to {output_file}")
