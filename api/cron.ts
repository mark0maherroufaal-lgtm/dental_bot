export default async function handler(req: any, res: any) {
    console.log("Cron executed");
    res.status(200).json({ status: "ok" });
}