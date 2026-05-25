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
        .replace(
            new RegExp(`^\\s*(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*\\n?`, "i"),
            "",
        )
        .trim();
}

function cleanBlockContentStart(content: string) {
    return content
        .replace(/^\s*,\s*/, "")
        .replace(/^\s*[-–:]\s*/, "")
        .trim();
}

function isRecoveryText(text: string) {
    return /\b(?:\d+:\d+|\d+\s*sec|\d+\s*min)\s+(?:WR|recovery)\b/i.test(text);
}

function isTransitionText(text: string) {
    return /\b(?:\d+:\d+|\d+\s*sec|\d+\s*min)\b.*\btransition\b/i.test(text);
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

function extractWorkoutName(commentBody: string, fallback = "Workout Intel") {
    const h1Match = commentBody.match(/^#\s+(.+)$/m);
    if (h1Match?.[1]) return h1Match[1].trim();

    const boldTypeMatch = commentBody.match(
        /^\s*\*\*\s*(2G|3G|Tread\s*50|Strength\s*50)\s*\*\*/im,
    );
    if (boldTypeMatch?.[1]) return boldTypeMatch[1].trim();

    const plainTypeMatch = commentBody.match(
        /^\s*(2G|3G|Tread\s*50|Strength\s*50)\b/im,
    );
    if (plainTypeMatch?.[1]) return plainTypeMatch[1].trim();

    return fallback;
}

function stripLeadingWorkoutHeader(body: string) {
    return body
        .replace(/^#\s+.+\n+/m, "")
        .replace(
            /^\s*\*\*\s*(2G|3G|Tread\s*50|Strength\s*50)\s*\*\*\s*\n+/im,
            "",
        )
        .replace(/^\s*(2G|3G|Tread\s*50|Strength\s*50)\s*[-:]?\s*\n+/im, "")
        .trim();
}

function cleanDanglingMarkdown(text: string) {
    return (
        text
            // Remove lines that are only "**"
            .replace(/^\s*\*\*\s*$/gm, "")
            // Remove only truly dangling opening ** at start of line
            .replace(/^\s*\*\*\s+(?!(?:OR|Finisher)\b)/gim, "")
            .trim()
    );
}

function normalizeLinesAsBullets(text: string) {
    const lines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

    const hasMarkdownFormatting = /\*\*.+\*\*/.test(text);
    const alreadyHasBullets = lines.some((line) => /^[-*]\s+/.test(line));

    if (alreadyHasBullets || hasMarkdownFormatting) return text;

    let previousEndedWithColon = false;

    return lines
        .map((line) => {
            const isHeading =
                /^3 blocks, all the same/i.test(line) ||
                /^as many rounds/i.test(line) ||
                /^repeat/i.test(line);

            if (/^finisher/i.test(line)) {
                previousEndedWithColon = false;
                return `**${line}**`;
            }

            if (isHeading) {
                previousEndedWithColon = line.endsWith(":");
                return line;
            }

            const prefix = previousEndedWithColon ? "  - " : "- ";
            previousEndedWithColon = line.endsWith(":");

            return `${prefix}${line}`;
        })
        .join("\n");
}

function splitIntoBlocks(
    content: string,
    defaultTitle: string,
): WorkoutBlock[] {
    const cleaned = cleanDanglingMarkdown(content);

    const blockRegex = /(?:^|\n)\s*(Block\s+\d+\s*(?:[-–:][^\n]*)?)/gi;
    const matches = [...cleaned.matchAll(blockRegex)];

    if (matches.length === 0) {
        return [
            {
                title: defaultTitle,
                content: normalizeLinesAsBullets(cleaned),
            },
        ];
    }

    const blocks: WorkoutBlock[] = [];

    const intro = cleaned.slice(0, matches[0].index).trim();
    if (intro) {
        blocks.push({
            title: defaultTitle,
            content: normalizeLinesAsBullets(intro),
        });
    }

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const start = match.index ?? 0;
        const contentStart = start + match[0].length;
        const end = matches[i + 1]?.index ?? cleaned.length;

        blocks.push({
            title: match[1].trim(),
            content: normalizeLinesAsBullets(
                cleanBlockContentStart(cleaned.slice(contentStart, end).trim()),
            ),
        });
    }

    return blocks;
}

function parseSimpleSections(body: string): WorkoutTab[] {
    const tabs: Record<WorkoutTabType, WorkoutTab> = {
        overview: { type: "overview", label: "Overview", blocks: [] },
        tread: { type: "tread", label: "Tread", blocks: [] },
        floor: { type: "floor", label: "Floor", blocks: [] },
        rower: { type: "rower", label: "Rower", blocks: [] },
        commentary: { type: "commentary", label: "Commentary", blocks: [] },
    };

    const stationRegex =
        /(?:^|\n)\s*(?:\*\*)?\s*(Tread|Treadmill|Rower|Row|Floor)\s*(?:\*\*)?\s*:\s*/gi;

    const matches = [...body.matchAll(stationRegex)];

    if (matches.length === 0) {
        return [];
    }

    const firstIndex = matches[0].index ?? 0;

    const overview = cleanDanglingMarkdown(body.slice(0, firstIndex).trim());

    if (overview) {
        tabs.overview.blocks.push({
            title: "Overview",
            content: overview,
        });
    }

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        const headerStart = match.index ?? 0;
        const contentStart = headerStart + match[0].length;
        const contentEnd = matches[i + 1]?.index ?? body.length;

        const stationName = match[1].toLowerCase();
        const content = cleanDanglingMarkdown(
            body.slice(contentStart, contentEnd).trim(),
        );

        const type: WorkoutTabType = stationName.includes("tread")
            ? "tread"
            : stationName.includes("row")
              ? "rower"
              : stationName.includes("floor")
                ? "floor"
                : "commentary";

        const title =
            type === "tread"
                ? "Tread"
                : type === "rower"
                  ? "Rower"
                  : type === "floor"
                    ? "Floor"
                    : "Notes";

        tabs[type].blocks.push(...splitIntoBlocks(content, title));
    }

    return Object.values(tabs).filter((tab) => tab.blocks.length > 0);
}

export function parseWorkoutMarkdown(
    postTitle: string,
    commentBody: string,
    workoutType?: string,
): ParsedWorkout {
    const dateMatch = postTitle.match(/for\s+(.+)$/i);
    const dateLabel = dateMatch?.[1]?.trim() ?? "";

    // **3G**\n\n\n**Tread:**\n\n3 blocks, all the same:
    const workoutName = extractWorkoutName(commentBody);

    const title = workoutName
        .replace(/\bintel\b/i, "")
        .replace(/\bfor\s+.+$/i, "")
        .trim();

    const body = cleanSpoilerGarbage(
        cleanDanglingMarkdown(stripLeadingWorkoutHeader(commentBody)),
    );

    const normalizedType = workoutType?.toLowerCase();

    // if (normalizedType === "tread 50") {
    //     return {
    //         title: "Tread 50",
    //         dateLabel,
    //         tabs: [
    //             {
    //                 type: "tread",
    //                 label: "Tread",
    //                 blocks: [
    //                     {
    //                         title: "Tread 50",
    //                         content: body,
    //                     },
    //                 ],
    //             },
    //         ],
    //     };
    // }

    // if (normalizedType === "strength 50") {
    //     return {
    //         title: "Strength 50",
    //         dateLabel,
    //         tabs: [
    //             {
    //                 type: "floor",
    //                 label: "Floor",
    //                 blocks: [
    //                     {
    //                         title: "Strength 50",
    //                         content: body,
    //                     },
    //                 ],
    //             },
    //         ],
    //     };
    // }

    const commentaryMatch = body.match(
        /(?:^|\n)(?:[A-Za-z0-9_ -]*\s*)?commentary:\s*([\s\S]*)$/i,
    );

    const bodyWithoutCommentary = commentaryMatch
        ? body.slice(0, commentaryMatch.index).trim()
        : body;

    const defaultTab: Pick<WorkoutTab, "type" | "label"> | null =
        normalizedType === "tread 50"
            ? { type: "tread", label: "Tread" }
            : normalizedType === "strength 50"
              ? { type: "floor", label: "Floor" }
              : null;

    const sectionRegex = defaultTab
        ? /(?:^|\n)\s*(?:\*\*)?((?:(?:Tread|Treadmill|Floor|Rower|Row)\s+)?Block(?:\s+\d+)?\s*(?:[-–:]\s*[^\n*]+)?)(?:\*\*)?/gi
        : /(?:^|\n)\s*(?:\*\*)?((?:Tread|Treadmill|Floor|Rower|Row)\s+Block(?:\s+\d+)?\s*(?:[-–:]\s*[^\n*]+)?)(?:\*\*)?/gi;

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
            content: bodyWithoutCommentary.slice(0, firstBlockIndex).trim(),
        });
    }

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const start = match.index ?? 0;
        const end = matches[i + 1]?.index ?? bodyWithoutCommentary.length;

        const blockTitle = match[1].trim();
        const rawContent = bodyWithoutCommentary.slice(start, end).trim();

        const type = defaultTab ? defaultTab.type : detectBlockType(blockTitle);
        const contentWithoutHeader = removeDuplicateHeader(
            rawContent,
            blockTitle,
        );

        const cleanedContent = cleanBlockContentStart(contentWithoutHeader);

        const recoveryMatch = cleanedContent.match(
            /(?:\n{2,})(.*\b(?:\d+:\d+|\d+\s*sec|\d+\s*min)\b.*\b(?:WR|recovery|transition)\b.*)$/i,
        );

        const mainContent = recoveryMatch
            ? cleanedContent.slice(0, recoveryMatch.index).trim()
            : cleanedContent;

        const recoveryContent = recoveryMatch?.[1]?.trim();

        tabs[type].blocks.push({
            title: blockTitle,
            content: mainContent,
        });

        if (recoveryContent) {
            if (isRecoveryText(recoveryContent)) {
                tabs[type].blocks.push({
                    title: "WR",
                    content: recoveryContent,
                });
            } else if (isTransitionText(recoveryContent)) {
                tabs[type].blocks.push({
                    title: "Transition",
                    content: recoveryContent,
                });
            }
        }
    }

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

    const hasWorkoutStationTabs = finalTabs.some((tab) =>
        ["tread", "floor", "rower"].includes(tab.type),
    );

    if (!hasWorkoutStationTabs) {
        const simpleTabs = parseSimpleSections(body);

        if (simpleTabs.length > 0) {
            finalTabs = simpleTabs;
        }
    }

    if (finalTabs.length > 0 && defaultTab) {
        const blocks = finalTabs.flatMap((tab) => tab.blocks);

        return {
            title: workoutType!,
            dateLabel,
            tabs: [
                {
                    type: defaultTab.type,
                    label: defaultTab.label,
                    blocks: blocks.map((block) => ({
                        ...block,
                        title: block.title.replace(
                            /^Block/i,
                            `${defaultTab.label} Block`,
                        ),
                    })),
                },
            ],
        };
    }

    return {
        title,
        dateLabel,
        tabs: finalTabs,
    };
}
