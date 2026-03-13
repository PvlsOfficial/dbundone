import { NextRequest, NextResponse } from "next/server";

function encodeShareUrl(url: string): string {
  return "u!" + Buffer.from(url).toString("base64url");
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const token = req.nextUrl.searchParams.get("t");

  if (!id || !token) {
    return NextResponse.json({ error: "Missing id or token" }, { status: 400 });
  }

  const shareUrl =
    process.env.NEXT_PUBLIC_ONEDRIVE_URL ??
    "https://1drv.ms/f/c/45580e208b0ea98c/IgAY2gnzH_YTTa0IE9Qf8_oFASk-BwTZ3imYD0I2c5VKNxk?e=7mvqdH";

  // Re-use the same shares/children listing that the songs API uses — this endpoint
  // reliably returns @microsoft.graph.downloadUrl for file items.
  const shareToken = encodeShareUrl(shareUrl);
  let downloadUrl: string | undefined;
  let nextLink: string | undefined =
    `https://graph.microsoft.com/v1.0/shares/${shareToken}/driveItem/children` +
    `?$select=id,%40microsoft.graph.downloadUrl&$top=200`;

  while (nextLink) {
    const res: Response = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[Stream] Share list error:", res.status, body.slice(0, 200));
      return NextResponse.json({ error: `Graph API ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const match = (data.value ?? []).find((f: { id: string }) => f.id === id);
    if (match?.["@microsoft.graph.downloadUrl"]) {
      downloadUrl = match["@microsoft.graph.downloadUrl"] as string;
      break;
    }
    nextLink = data["@odata.nextLink"];
  }

  if (!downloadUrl) {
    console.error("[Stream] Item not found in share listing:", id);
    return NextResponse.json({ error: "Item not found or no download URL" }, { status: 404 });
  }

  return NextResponse.redirect(downloadUrl, 302);
}
