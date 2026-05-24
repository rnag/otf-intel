import { ingestRedditWorkouts } from "../src/lib/reddit-ingest";

async function main() {
    const result = await ingestRedditWorkouts();
    console.log(result);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
