import { getSupabaseServer } from "@/lib/supabase";
import { Star, ExternalLink } from "lucide-react";
import { WorkoutSelector } from "@/components/workout-selector";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

// type RedditPost = {
//   id: string;
//   title: string;
//   selftext: string;
//   url: string;
//   author: string;
//   created_utc: number;
// };

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

async function getRecentWorkouts() {
  const supabase = getSupabaseServer();

  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const { data, error } = await supabase
    .from("workout_comments")
    .select(`
      comment_id,
      author,
      body,
      score,
      url,
      workout_type,
      created_utc,
      reddit_posts (
        post_id,
        title,
        url,
        flair,
        created_utc
      )
    `)
    .gte("created_utc", sevenDaysAgo)
    .order("created_utc", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const redditPost = Array.isArray(row.reddit_posts)
      ? row.reddit_posts[0]
      : row.reddit_posts;

    return {
      id: row.comment_id,
      title: redditPost?.title ?? "Workout Intel",
      selftext: row.body,
      url: row.url,
      post_url: redditPost?.url,
      author: row.author,
      created_utc: row.created_utc,
      workout_type: row.workout_type,
      flair: redditPost?.flair,
    };
  });
}

export default async function Home() {
  const workouts = await getRecentWorkouts();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-orange-500">OTF Intel</p>

        <a
          href="https://github.com/rnag/otf-intel"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <span className="text-sm">GitHub</span>
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
        </a>
      </div>

      <WorkoutSelector workouts={workouts} /> 
    </main>
  );
}