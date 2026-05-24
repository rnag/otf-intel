import { getSupabaseServer } from "./supabase";

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

function isTargetWorkoutPost(p: any) {
    const flair = p.link_flair_text?.toLowerCase();

    return (
        p.stickied &&
        (flair === "daily workout" || flair === "tomorrow's daily workout")
    );
}

function inferWorkoutType(body: string) {
    const text = body.toLowerCase();

    if (text.includes("tread 50") || text.includes("t50")) return "Tread 50";
    if (text.includes("strength 50") || text.includes("s50"))
        return "Strength 50";
    if (text.includes("3g")) return "3G";
    if (text.includes("2g")) return "2G";

    return "Unknown";
}

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

    const hasWorkoutType =
        text.includes("2g") ||
        text.includes("3g") ||
        text.includes("tread 50") ||
        text.includes("t50") ||
        text.includes("strength 50") ||
        text.includes("s50");

    const hasWorkoutContent =
        text.includes("tread") ||
        text.includes("treadmill") ||
        text.includes("floor") ||
        text.includes("rower") ||
        text.includes("rowing");

    return hasWorkoutType && hasWorkoutContent;
}

async function fetchJson(url: string) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "otf-intel:v0.1.0 by u/otf-intel",
            Accept: "application/json",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const body = await res.text();

        throw new Error(
            `Reddit fetch failed: ${res.status} ${res.statusText}\n${body.slice(
                0,
                300,
            )}`,
        );
    }

    return res.json();
}

export async function ingestRedditWorkouts() {
    const supabase = getSupabaseServer();

    const subredditJson = await fetchJson(
        "https://old.reddit.com/r/orangetheory.json",
    );

    const posts = subredditJson.data.children.map((c: any) => c.data);
    const pinnedPosts = posts.filter(isTargetWorkoutPost);

    let savedComments = 0;

    for (const p of pinnedPosts) {
        const postId = p.id;
        const postTitle = p.title;
        const postUrl = p.url;

        const threadJson = await fetchJson(
            `https://old.reddit.com/comments/${postId}/.json`,
        );

        const commentChildren = threadJson[1]?.data?.children ?? [];
        const comments = flattenComments(commentChildren);

        const workoutComments = comments
            .filter(isWorkoutIntelComment)
            .filter(
                (comment) =>
                    comment.score >= 5 ||
                    comment.author.toLowerCase().startsWith("dc"),
            )
            .sort((a, b) => b.score - a.score);

        const { error: postError } = await supabase
            .from("reddit_posts")
            .upsert({
                post_id: postId,
                title: postTitle,
                url: postUrl,
                flair: p.link_flair_text,
                created_utc: p.created_utc,
                updated_at: new Date().toISOString(),
            });

        if (postError) {
            throw new Error(postError.message);
        }

        for (const comment of workoutComments) {
            const { error: commentError } = await supabase
                .from("workout_comments")
                .upsert({
                    comment_id: comment.id,
                    post_id: postId,
                    author: comment.author,
                    body: comment.body,
                    score: comment.score,
                    url: `https://www.reddit.com${comment.permalink}`,
                    workout_type: inferWorkoutType(comment.body),
                    created_utc: comment.created_utc,
                    updated_at: new Date().toISOString(),
                });

            if (commentError) {
                throw new Error(commentError.message);
            }

            savedComments++;
        }
    }

    return {
        ok: true,
        posts: pinnedPosts.length,
        comments: savedComments,
    };
}
