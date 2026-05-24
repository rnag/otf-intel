import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseWorkoutMarkdown } from "@/lib/workout-parser";
import { WorkoutTabs } from "@/components/workout-tabs";

// import Link from "next/link";

// export default function Home() {
//   return (
//     <main className="mx-auto max-w-3xl p-6">
//       <h1 className="text-3xl font-bold">Orange Intel</h1>

//       <p className="mt-2 text-gray-600">
//         Paste messy workout text, parse it into a clean format, and summarize it.
//       </p>

//       <Link
//         href="/import"
//         className="mt-6 inline-block rounded bg-black px-4 py-2 text-white"
//       >
//         Import Workout
//       </Link>
//     </main>
//   );
// }

type RedditPost = {
  id: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  created_utc: number;
};

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

// async function getLatestPost(): Promise<RedditPost | null> {
//   const baseUrl = process.env.VERCEL_URL
//     ? `https://${process.env.VERCEL_URL}`
//     : "http://localhost:3000";

//   const res = await fetch(`${baseUrl}/api/reddit/latest`, {
//     cache: "no-store",
//   });

//   if (!res.ok) return null;

//   const data = await res.json();
//   return data.post;
// }

async function getLatestPost(): Promise<RedditPost | null> {
  let res = await fetch("https://www.reddit.com/r/orangetheory.json", {
    headers: {
      "User-Agent": "otf-intel:v0.1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  let json = await res.json();

  const posts = json.data.children.map((c: any) => c.data);
  // TODO: 'Tomorrow's Daily Workout' too
  const pinnedPosts = posts.filter((p: any) => p.stickied && p.link_flair_text.toLowerCase() === "daily workout");

  if (pinnedPosts.length === 0) return null;

  // console.log(JSON.stringify(pinnedPosts));

  const p = pinnedPosts[0];

  const postTitle = p.title;
  const postId = p.id;
  
  res = await fetch(`https://www.reddit.com/comments/${postId}/.json`, {
    headers: {
      "User-Agent": "otf-intel:v0.1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  json = await res.json();


  const commentChildren = json[1]?.data?.children ?? [];

  const comments = flattenComments(commentChildren);

    // console.log(JSON.stringify(comments));

  const workoutComments = comments
    .filter(isWorkoutIntelComment)
    .filter((comment) => comment.score >= 5 || comment.author.toLowerCase().startsWith('dc'))
    .sort((a, b) => b.score - a.score);


  const bestWorkoutComment = workoutComments[0] ?? null;

  if (!bestWorkoutComment) return null;

  return {
    id: bestWorkoutComment.id,
    title: postTitle,
    selftext: bestWorkoutComment.body,
    url: `https://www.reddit.com${bestWorkoutComment.permalink}`,
    author: bestWorkoutComment.author,
    created_utc: bestWorkoutComment.created_utc,
  };
}

export default async function Home() {
  const post = await getLatestPost();

  const workout = post
    ? parseWorkoutMarkdown(post.title, post.selftext)
    : null;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold">
        {workout?.title ?? "OTF Intel"}
      </h1>

      <p className="mt-2 text-gray-600">
        Daily Orangetheory workout summaries from Reddit.
      </p>

      {!post || !workout ? (
        <section className="mt-8 rounded-2xl border p-5 shadow-sm">
          <p>No workout post found yet.</p>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Source: u/{post.author}
            </p>

            <a
              className="mt-2 inline-block underline"
              href={post.url}
              target="_blank"
              rel="noreferrer"
            >
              Open Reddit comment
            </a>
          </section>

          <WorkoutTabs tabs={workout.tabs} />
        </>
      )}
    </main>
  );
}