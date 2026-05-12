export default async function handler(req: any, res: any) {
  const { default: app } = await import('../apps/server/src/app.js');
  return app(req, res);
}
