import { NextResponse } from "next/server";
import { getLatestOrangeTheoryPost } from "@/lib/reddit";

export async function GET() {
  try {
    const post = await getLatestOrangeTheoryPost();

    if (!post) {
      return NextResponse.json({ error: "No post found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch Reddit post" },
      { status: 500 },
    );
  }
}
