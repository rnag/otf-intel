"use client";

import { useEffect, useMemo, useState } from "react";
import { parseWorkoutMarkdown } from "@/lib/workout-parser";
import { WorkoutTabs } from "@/components/workout-tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type WorkoutPost = {
  id: string;
  title: string;
  selftext: string;
  url: string; // comment URL
  post_url?: string; // post URL
  author: string;
  created_utc: number;
  workout_type?: string;
  flair?: string;
};

type Props = {
  workouts: WorkoutPost[];
};

function getDateLabel(title: string) {
  return title.match(/for\s+(.+)$/i)?.[1]?.trim() ?? "Unknown date";
}

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
  const groupedByDate = useMemo(() => {
    const map = new Map<string, WorkoutPost[]>();

    for (const workout of workouts) {
      const dateLabel = getDateLabel(workout.title);
      const existing = map.get(dateLabel) ?? [];
      existing.push(workout);
      map.set(dateLabel, existing);
    }

    return Array.from(map.entries()).map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }));
  }, [workouts]);

  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  const selectedDateGroup = groupedByDate[selectedDateIndex];

  const selected =
    selectedDateGroup?.items.find((item) => item.id === selectedWorkoutId) ??
    selectedDateGroup?.items[0];

  function goPrevious() {
    setSelectedDateIndex((current) =>
      Math.min(current + 1, groupedByDate.length - 1),
    );
  }

  function goNext() {
    setSelectedDateIndex((current) => Math.max(current - 1, 0));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrevious();
      if (e.key === "ArrowRight") goNext();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [groupedByDate.length]);

  if (!selected || !selectedDateGroup) {
    return <p>No workout post found yet.</p>;
  }

  const parsed = parseWorkoutMarkdown(
    selected.title,
    selected.selftext,
    selected.workout_type,
  );

  const redditPostUrl = selected.post_url ?? selected.url;



  return (
    <div className="mx-auto w-full max-w-3xl min-w-0">
        <div className="mt-6 flex items-center justify-center gap-4">
        <button
            onClick={goPrevious}
            disabled={selectedDateIndex >= groupedByDate.length - 1}
            className="shrink-0 rounded-full border px-3 py-2 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-900"
        >
            ←
        </button>


        <div className="flex w-50 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-5 py-2 font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white sm:w-55">
        <span className="truncate">{selectedDateGroup.dateLabel}</span>

        <a
            href={redditPostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-zinc-400 transition hover:text-orange-500"
            aria-label="Open Reddit post"
        >
            ↗
        </a>
        </div>

        <button
            onClick={goNext}
            disabled={selectedDateIndex <= 0}
            className="shrink-0 rounded-full border px-3 py-2 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-900"
        >
            →
        </button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {selectedDateGroup.items.map((workout) => {
            const type = workout.workout_type ?? "Workout";
            const isSelected = workout.id === selected?.id;

            return (
            <button
                key={workout.id}
                onClick={() => setSelectedWorkoutId(workout.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                isSelected
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
            >
                {type}
            </button>
            );
        })}
        </div>

        <section className="mt-6 min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="break-words text-3xl font-bold">
            {parsed.title}
        </h1>

        <WorkoutQuickSummary
            markdown={selected.selftext}
            workoutType={selected.workout_type}
        />

        <p className="mt-4 text-xs text-gray-400">
            Source:{" "}
            <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-2 hover:underline"
            >
                u/{selected.author} ↗
            </a>
        </p>
        </section>

        {parsed.tabs.length > 0 ? (
        <WorkoutTabs tabs={parsed.tabs} />
        ) : (
        <section className="mt-6 min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-xl font-semibold">Raw workout text</h2>

            <div className="prose prose-sm mt-4 max-w-none overflow-hidden break-words dark:prose-invert prose-pre:overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selected.selftext}
            </ReactMarkdown>
            </div>
        </section>
        )}
    </div>
   );
}