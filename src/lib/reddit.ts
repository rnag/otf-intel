import { z } from "zod";

const RedditPostSchema = z.object({
  data: z.object({
    children: z.array(
      z.object({
        data: z.object({
          id: z.string(),
          title: z.string(),
          selftext: z.string().optional().default(""),
          url: z.string(),
          created_utc: z.number(),
          author: z.string(),
        }),
      }),
    ),
  }),
});

async function getRedditAccessToken() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT;

  if (!clientId || !clientSecret || !userAgent) {
    throw new Error("Missing Reddit environment variables.");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Reddit auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

export async function getLatestOrangeTheoryPost() {
  const token = await getRedditAccessToken();
  const userAgent = process.env.REDDIT_USER_AGENT!;

  const response = await fetch(
    "https://oauth.reddit.com/r/orangetheory/search?restrict_sr=1&sort=new&limit=10&q=Daily%20Workout",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Reddit fetch failed: ${response.status}`);
  }

  const json = RedditPostSchema.parse(await response.json());

  return json.data.children.map((child) => child.data)[0] ?? null;
}
