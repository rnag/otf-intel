"use client";

import { useState } from "react";
import { parseWorkoutMarkdown } from "@/lib/workout-parser";
import { WorkoutTabs } from "@/components/workout-tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type WorkoutPost = {
  id: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  created_utc: number;
  workout_type?: string;
  flair?: string;
};

type Props = {
  workouts: WorkoutPost[];
};

function WorkoutQuickSummary({
  markdown,
  workoutType,
}: {
  markdown: string;
  workoutType?: string;
}) {
  const text = markdown.toLowerCase();

  const benchmarkPatterns = [
    /\bbenchmark\b/,
    /\bsignature workout\b/,
    /\binferno\b/,
    /\bcatch me if you can\b/,
    /\bcmiyc\b/,
    /\b12\s*minute\s+run\s+for\s+distance\b/,
    /\b12\s*minute\s+rfd\b/,
    /(?<![\d.])\b1[\s-]*mile\b/,
    /\bquarter\s*mile\b/,
    /\b0.25\s*mile\s+benchmark\b/,
    /\b2000m\s+row\b/,
    /\b500m\s+row\b/,
    /\b200\s*meter\s+row\b/,
    /\b200m\s+row\b/,
    /\bdri\s*tri\b/,
    /\beverest\b/,
    /\borange infinity\b/,
  ];

  const hasBenchmark = benchmarkPatterns.some((pattern) => pattern.test(text));

  const treadType = text.includes("incline")
    ? "Incline / strength-focused tread"
    : text.includes("all out") || text.includes("ao")
      ? "Power / all-out tread"
      : text.includes("endurance")
        ? "Endurance tread"
        : "Mixed tread";

  const floorType = /squat|lunge|deadlift|step-up|bridge/.test(text)
    ? "Lower-body leaning floor"
    : /press|curl|row|push-up|chest/.test(text)
      ? "Upper-body leaning floor"
      : "Mixed floor";

  const normalizedType = workoutType?.toLowerCase();
  const isTreadOnly = normalizedType === "tread 50";
  const isStrengthOnly = normalizedType === "strength 50";

  return (
    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
    {hasBenchmark && (
    <div className="rounded-xl bg-orange-100 p-3 text-gray-900 dark:bg-orange-950 dark:text-orange-100">
        <p className="font-semibold">Benchmark</p>
        <p>Benchmark / signature workout detected</p>
    </div>
    )}

    {!isStrengthOnly && (
    <div className="rounded-xl bg-gray-100 p-3 text-gray-900 dark:bg-zinc-900 dark:text-zinc-100">
        <p className="font-semibold">Tread</p>
        <p>{treadType}</p>
    </div>
    )}

    {!isTreadOnly && (
    <div className="rounded-xl bg-gray-100 p-3 text-gray-900 dark:bg-zinc-900 dark:text-zinc-100">
        <p className="font-semibold">Floor</p>
        <p>{floorType}</p>
    </div>
    )}

    </div>
  );
}

export function WorkoutSelector({ workouts }: Props) {
  const [selectedId, setSelectedId] = useState(workouts[0]?.id);

  const selected = workouts.find((w) => w.id === selectedId) ?? workouts[0];

  if (!selected) {
    return <p>No workout post found yet.</p>;
  }

  const parsed = parseWorkoutMarkdown(selected.title, selected.selftext, selected.workout_type);

  return (
    <>
      <select
        className="
        mt-6
        w-full
        rounded-xl
        border
        border-zinc-300
        bg-white
        p-3
        text-sm
        text-zinc-900
        dark:border-zinc-700
        dark:bg-zinc-900
        dark:text-zinc-100
    "
        value={selected.id}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        {workouts.map((workout) => (
          <option key={workout.id} value={workout.id}>
            {workout.workout_type ?? "Workout"} · {workout.title}
          </option>
        ))}
      </select>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-3xl font-bold">{parsed.title}</h1>

        <WorkoutQuickSummary
        markdown={selected.selftext}
        workoutType={selected.workout_type}
        />

        <p className="mt-4 text-xs text-gray-400">
          Source: u/{selected.author}
        </p>
      </section>

        {parsed.tabs.length > 0 ? (
        <WorkoutTabs tabs={parsed.tabs} />
        ) : (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-xl font-semibold">Raw workout text</h2>
            <div className="prose prose-sm mt-4 max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selected.selftext}
            </ReactMarkdown>
            </div>
        </section>
        )}

    </>
  );
}