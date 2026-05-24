import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

type RedditComment = {
    id: string;
    author: string;
    body: string;
    score: number;
    ups?: number;
    permalink: string;
    created_utc: number;
    depth: number;
};

function flattenComments(children: any[]): RedditComment[] {
    const comments: RedditComment[] = [];

    for (const child of children) {
        if (child.kind !== "t1") continue;

        const data = child.data;

        comments.push({
            id: data.id,
            author: data.author,
            body: data.body ?? "",
            score: data.score ?? data.ups ?? 0,
            ups: data.ups,
            permalink: data.permalink,
            created_utc: data.created_utc,
            depth: data.depth ?? 0,
        });

        if (data.replies?.data?.children) {
            comments.push(...flattenComments(data.replies.data.children));
        }
    }

    return comments;
}

function isWorkoutIntelComment(comment: RedditComment) {
    const text = comment.body.toLowerCase();

    return (
        text.includes("2g") &&
        (text.includes("tread") || text.includes("treadmill")) &&
        text.includes("floor")
    );
}

export async function GET(request: Request) {
    const supabase = getSupabaseServer();
    const auth = request.headers.get("authorization");

    if (auth !== `Bearer ${process.env.INGEST_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Move your current Reddit fetch + flattenComments + filter logic here.
    // Then upsert into reddit_posts and workout_comments.

    let res = await fetch("https://www.reddit.com/r/orangetheory.json", {
        headers: {
            "User-Agent": "otf-intel:v0.1.0",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: "Failed to fetch subreddit" },
            { status: 502 },
        );
    }

    let json = await res.json();

    const posts = json.data.children.map((c: any) => c.data);
    // TODO: 'Tomorrow's Daily Workout' too
    const pinnedPosts = posts.filter(
        (p: any) =>
            p.stickied && p.link_flair_text?.toLowerCase() === "daily workout",
    );
    if (pinnedPosts.length === 0) return null;

    const p = pinnedPosts[0];

    const postTitle = p.title;
    const postId = p.id;
    const postUrl = p.url;

    res = await fetch(`https://www.reddit.com/comments/${postId}/.json`, {
        headers: {
            "User-Agent": "otf-intel:v0.1.0",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: "Failed to fetch post" },
            { status: 502 },
        );
    }

    json = await res.json();

    const commentChildren = json[1]?.data?.children ?? [];

    const comments = flattenComments(commentChildren);

    const workoutComments = comments
        .filter(isWorkoutIntelComment)
        .filter(
            (comment) =>
                comment.score >= 5 ||
                comment.author.toLowerCase().startsWith("dc"),
        )
        .sort((a, b) => b.score - a.score);

    const comment = workoutComments[0] ?? null;

    if (!comment) return null;

    // return {
    //     id: bestWorkoutComment.id,
    //     title: postTitle,
    //     selftext: bestWorkoutComment.body,
    //     url: `https://www.reddit.com${bestWorkoutComment.permalink}`,
    //     author: bestWorkoutComment.author,
    //     created_utc: bestWorkoutComment.created_utc,
    // };

    await supabase.from("reddit_posts").upsert({
        post_id: postId,
        title: postTitle,
        url: postUrl,
        created_utc: p.created_utc,
    });

    await supabase.from("workout_comments").upsert({
        comment_id: comment.id,
        post_id: postId,
        author: comment.author,
        body: comment.body,
        score: comment.score,
        url: `https://www.reddit.com${comment.permalink}`,
        workout_type: "2G",
        created_utc: comment.created_utc,
    });

    return NextResponse.json({ ok: true });
}
