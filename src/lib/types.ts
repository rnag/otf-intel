export type WorkoutSource = "manual" | "reddit-api" | "devvit" | "import";

export type RawWorkoutInput = {
    source: WorkoutSource;
    sourceUrl?: string;
    title: string;
    body: string;
    postedAt?: string;
};
