"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WorkoutTab } from "@/lib/workout-parser";

type Props = {
  tabs: WorkoutTab[];
};

function stripMarkdown(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/, "")
    .trim();
}

export function WorkoutTabs({ tabs }: Props) {
  if (!tabs.length) {
    return null;
  }
  
  const [activeTab, setActiveTab] = useState(tabs[0]?.type ?? "overview");

  const currentTab = tabs.find((tab) => tab.type === activeTab) ?? tabs[0];
  if (!currentTab) {
    return null;
  }

  return (
    <section className="mt-6 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex gap-2 overflow-x-auto border-b pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.type}
            onClick={() => setActiveTab(tab.type)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
              tab.type === activeTab
                ? "bg-white text-zinc-900 ring-1 ring-zinc-300 shadow-sm dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid min-w-0 gap-4">
        {currentTab.blocks.map((block, index) => {
          const cleanedContent = stripMarkdown(block.content);

          const isRecoveryBlock =
            block.title === "WR" ||
            block.title === "Transition" ||
            /^\s*(?:\d+:\d+|\d+\s*sec|\d+\s*min)\b.*\b(?:WR|recovery|transition)\b/i.test(
              cleanedContent,
            );

          if (isRecoveryBlock) {
            return (
              <div key={index} className="flex justify-center">
                <div className="flex max-w-full items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  <span className="text-emerald-600 dark:text-emerald-300">↓</span>
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                    {block.title === "Transition" ? "Move" : "WR"}
                  </span>
                  <span className="min-w-0 break-words">{stripMarkdown(block.content)}</span>
                  <span className="text-emerald-600 dark:text-emerald-300">↓</span>
                </div>
              </div>
            );
          }

          return (
            <article
              key={index}
              className={`min-w-0 overflow-hidden rounded-2xl border shadow-sm ${
                block.title ? "p-5" : "p-3"
              }`}
            >
              {block.title && (
                <h2 className="mb-3 text-xl font-semibold">{block.title}</h2>
              )}

              <div className="prose prose-sm max-w-none min-w-0 overflow-hidden break-words dark:prose-invert prose-pre:overflow-x-auto prose-code:break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {block.content}
                </ReactMarkdown>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
