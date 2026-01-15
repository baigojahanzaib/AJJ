import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import * as fs from "fs";

const CONVEX_URL = "https://precious-chicken-968.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
    const data = JSON.parse(fs.readFileSync("moq_updates.json", "utf-8"));
    console.log(`Loaded ${data.length} updates.`);

    const BATCH_SIZE = 50;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} (${batch.length} items)...`);
        try {
            const results = await client.mutation(api.products.batchUpdateMOQ, { updates: batch });
            const successes = results.filter(r => r.success).length;
            const failures = results.filter(r => !r.success).length;
            console.log(`  Success: ${successes}, Fastures: ${failures}`);
            if (failures > 0) {
                console.log("  Sample failure:", results.find(r => !r.success));
            }
        } catch (e) {
            console.error("Batch failed:", e);
        }
    }
    console.log("Done.");
}

main();
