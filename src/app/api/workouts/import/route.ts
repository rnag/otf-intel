import { NextResponse } from "next/server";
import { z } from "zod";

const ImportWorkoutSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  postedAt: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const input = ImportWorkoutSchema.parse(json);

  // TODO: parse + save to Supabase
  return NextResponse.json({
    workout: {
      source: "manual",
      title: input.title,
      body: input.body,
      sourceUrl: input.sourceUrl,
      postedAt: input.postedAt ?? new Date().toISOString(),
    },
  });
}
