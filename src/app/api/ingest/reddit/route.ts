import { NextResponse } from "next/server";
import { ingestRedditWorkouts } from "@/lib/reddit-ingest";

export async function GET(request: Request) {
    const auth = request.headers.get("authorization");

    if (auth !== `Bearer ${process.env.INGEST_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await ingestRedditWorkouts();

        return NextResponse.json(result);
    } catch (err) {
        console.error(err);

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
