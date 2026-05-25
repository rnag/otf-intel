export type WorkoutTabType =
    | "overview"
    | "tread"
    | "floor"
    | "rower"
    | "commentary";

export type WorkoutBlock = {
    title: string;
    content: string;
};

export type WorkoutTab = {
    type: WorkoutTabType;
    label: string;
    blocks: WorkoutBlock[];
};

export type ParsedWorkout = {
    title: string;
    dateLabel: string;
    tabs: WorkoutTab[];
};

function cleanSpoilerGarbage(text: string) {
    return text
        .replace(/&gt;!/g, "")
        .replace(/>!/g, "")
        .replace(/!&lt;/g, "")
        .replace(/!</g, "")
        .replace(/\\\s*$/gm, "")
        .trim();
}

function detectBlockType(title: string): WorkoutTabType {
    const lower = title.toLowerCase();

    if (/^(tread|treadmill)\s+block\b/.test(lower)) return "tread";
    if (/^floor\s+block\b/.test(lower)) return "floor";
    if (/^(rower|row)\s+block\b/.test(lower)) return "rower";

    return "commentary";
}

function removeDuplicateHeader(content: string, title: string) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return content
        .replace(new RegExp(`^\\*\\*${escaped}\\*\\*\\s*`, "i"), "")
        .replace(new RegExp(`^#+\\s*${escaped}\\s*`, "i"), "")
        .trim();
}

function splitBlockContentAndCommentary(content: string) {
    const parts = content.split(/\n{2,}/);

    const blockParts: string[] = [];
    const commentaryParts: string[] = [];

    let inCommentary = false;

    for (const part of parts) {
        const trimmed = part.trim();

        const looksLikeWorkoutContent =
            trimmed.startsWith("*") ||
            trimmed.startsWith("-") ||
            trimmed.startsWith("~") ||
            /^\d+/.test(trimmed) ||
            /^work\s*&\s*rest/i.test(trimmed) ||
            /^repeat/i.test(trimmed) ||
            /^finisher/i.test(trimmed);

        const looksLikeCommentary =
            trimmed.length > 80 &&
            !looksLikeWorkoutContent &&
            !/^\*\*.*\*\*$/.test(trimmed);

        if (looksLikeCommentary) inCommentary = true;

        if (inCommentary) commentaryParts.push(trimmed);
        else blockParts.push(trimmed);
    }

    return {
        blockContent: blockParts.join("\n\n").trim(),
        commentaryContent: commentaryParts.join("\n\n").trim(),
    };
}

function parseSimpleSections(body: string): WorkoutTab[] {
    const tabs: Record<WorkoutTabType, WorkoutTab> = {
        overview: { type: "overview", label: "Overview", blocks: [] },
        tread: { type: "tread", label: "Tread", blocks: [] },
        floor: { type: "floor", label: "Floor", blocks: [] },
        rower: { type: "rower", label: "Rower", blocks: [] },
        commentary: { type: "commentary", label: "Commentary", blocks: [] },
    };

    const sectionRegex =
        /(?:^|\n)\s*(?:\*\*)?(Tread|Treadmill|Rower|Row|Floor)(?:\*\*)?\s*[:-]\s*/gi;

    const matches = [...body.matchAll(sectionRegex)];

    if (matches.length === 0) {
        return [];
    }

    const firstIndex = matches[0].index ?? 0;

    const overview = body.slice(0, firstIndex).trim();
    if (overview) {
        tabs.overview.blocks.push({
            title: "Overview",
            content: overview,
        });
    }

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const start = match.index ?? 0;
        const contentStart = start + match[0].length;
        const end = matches[i + 1]?.index ?? body.length;

        const label = match[1].toLowerCase();
        const content = body.slice(contentStart, end).trim();

        const type: WorkoutTabType = label.includes("tread")
            ? "tread"
            : label.includes("row")
              ? "rower"
              : label.includes("floor")
                ? "floor"
                : "commentary";

        tabs[type].blocks.push({
            title:
                type === "tread"
                    ? "Tread"
                    : type === "rower"
                      ? "Rower"
                      : type === "floor"
                        ? "Floor"
                        : "Notes",
            content,
        });
    }

    return Object.values(tabs).filter((tab) => tab.blocks.length > 0);
}

export function parseWorkoutMarkdown(
    postTitle: string,
    commentBody: string,
): ParsedWorkout {
    const dateMatch = postTitle.match(/for\s+(.+)$/i);
    const dateLabel = dateMatch?.[1]?.trim() ?? "";

    const headerMatch = commentBody.match(/^#\s+(.+)$/m);
    const workoutName = headerMatch?.[1]?.trim() ?? "Workout Intel";

    const title = dateLabel ? `${workoutName} for ${dateLabel}` : workoutName;

    const body = cleanSpoilerGarbage(
        commentBody
            .replace(/^#\s+.+\n+/m, "")
            // .replace(/^[A-Za-z0-9_ -]*commentary:\s*/gim, "")
            .trim(),
    );

    const commentaryMatch = body.match(
        /(?:^|\n)(?:[A-Za-z0-9_ -]*\s*)?commentary:\s*([\s\S]*)$/i,
    );

    const commentaryText = commentaryMatch?.[1]
        ? cleanSpoilerGarbage(commentaryMatch[1])
        : "";

    const bodyWithoutCommentary = commentaryMatch
        ? body.slice(0, commentaryMatch.index).trim()
        : body;

    const sectionRegex =
        /\*\*((?:Tread|Treadmill|Floor|Rower|Row)\s+Block\s+\d+\s+-\s+.*?)\*\*/gi;

    const matches = [...bodyWithoutCommentary.matchAll(sectionRegex)];

    const tabs: Record<WorkoutTabType, WorkoutTab> = {
        overview: { type: "overview", label: "Overview", blocks: [] },
        tread: { type: "tread", label: "Tread", blocks: [] },
        floor: { type: "floor", label: "Floor", blocks: [] },
        rower: { type: "rower", label: "Rower", blocks: [] },
        commentary: { type: "commentary", label: "Commentary", blocks: [] },
    };

    const firstBlockIndex = matches[0]?.index ?? -1;

    if (firstBlockIndex > 0) {
        tabs.overview.blocks.push({
            title: "Overview",
            content: body.slice(0, firstBlockIndex).trim(),
        });
    }

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const start = match.index ?? 0;
        const end = matches[i + 1]?.index ?? bodyWithoutCommentary.length;

        const blockTitle = match[1].trim();
        const rawContent = bodyWithoutCommentary.slice(start, end).trim();

        const type = detectBlockType(blockTitle);
        const contentWithoutHeader = removeDuplicateHeader(
            rawContent,
            blockTitle,
        );

        const { blockContent, commentaryContent } =
            splitBlockContentAndCommentary(contentWithoutHeader);

        tabs[type].blocks.push({
            title: blockTitle,
            content: blockContent,
        });

        if (commentaryContent) {
            tabs.commentary.blocks.push({
                title: "",
                content: cleanSpoilerGarbage(commentaryContent),
            });
        }
    }

    const lastBlockEnd =
        matches.length > 0
            ? (matches[matches.length - 1].index ?? 0) +
              matches[matches.length - 1][0].length
            : -1;

    const trailingText =
        matches.length > 0
            ? body.slice(
                  matches[matches.length - 1].index! +
                      body
                          .slice(matches[matches.length - 1].index!)
                          .indexOf(matches[matches.length - 1][0]),
              )
            : body;

    if (commentaryMatch?.[1]) {
        tabs.commentary.blocks.push({
            title: "",
            content: cleanSpoilerGarbage(commentaryMatch[1]),
        });
    }

    // Better commentary fallback: anything after the last parsed section's content that
    // does not look like a block belongs in commentary.
    // const commentaryCandidates = body
    //     .split(/\n{2,}/)
    //     .map((part) => part.trim())
    //     .filter(Boolean)
    //     .filter((part) => !sectionRegex.test(part))
    //     .filter((part) => detectBlockType(part) === "commentary")
    //     .filter(
    //         (part) =>
    //             !tabs.overview.blocks.some((b) => b.content.includes(part)),
    //     );

    // for (const part of commentaryCandidates) {
    //     if (part.length > 80) {
    //         tabs.commentary.blocks.push({
    //             title: "",
    //             content: cleanSpoilerGarbage(part),
    //         });
    //     }
    // }

    let finalTabs = Object.values(tabs).filter((tab) => tab.blocks.length > 0);

    if (finalTabs.length === 0) {
        finalTabs = parseSimpleSections(body);
    }

    return {
        title,
        dateLabel,
        tabs: finalTabs,
    };
}
