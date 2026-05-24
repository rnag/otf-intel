"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WorkoutTab } from "@/lib/workout-parser";

type Props = {
  tabs: WorkoutTab[];
};

export function WorkoutTabs({ tabs }: Props) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.type ?? "overview");

  const currentTab = tabs.find((tab) => tab.type === activeTab) ?? tabs[0];

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.type}
            onClick={() => setActiveTab(tab.type)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab.type === activeTab
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {currentTab.blocks.map((block, index) => (
          <article
            key={index}
            className={`rounded-2xl border shadow-sm ${
              block.title ? "p-5" : "p-3"
            }`}
          >
            {block.title && (
              <h2 className="mb-3 text-xl font-semibold">{block.title}</h2>
            )}

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {block.content}
              </ReactMarkdown>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
