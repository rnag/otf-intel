import { getSupabaseServer } from "@/lib/supabase";
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
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("workout_comments")
    .select(`
      comment_id,
      author,
      body,
      score,
      url,
      created_utc,
      reddit_posts (
        title
      )
    `)
    .order("created_utc", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const redditPost = Array.isArray(data.reddit_posts)
    ? data.reddit_posts[0]
    : data.reddit_posts;

  return {
    id: data.comment_id,
    title: redditPost?.title ?? "Workout Intel",
    selftext: data.body,
    url: data.url,
    author: data.author,
    created_utc: data.created_utc,
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