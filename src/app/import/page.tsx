"use client";

import { useState } from "react";

export default function ImportPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function submitWorkout() {
    const res = await fetch("/api/workouts/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        sourceUrl: sourceUrl || undefined,
      }),
    });

    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">Import Workout</h1>

      <input
        className="mt-6 w-full rounded border p-3"
        placeholder="Workout title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        className="mt-4 w-full rounded border p-3"
        placeholder="Source URL optional"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
      />

      <textarea
        className="mt-4 min-h-[400px] w-full rounded border p-3"
        placeholder="Paste Reddit workout text here"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <button
        className="mt-4 rounded bg-black px-4 py-2 text-white"
        onClick={submitWorkout}
      >
        Import
      </button>

      {result && (
        <pre className="mt-6 overflow-auto rounded bg-gray-100 p-4 text-sm">
          {result}
        </pre>
      )}
    </main>
  );
}
