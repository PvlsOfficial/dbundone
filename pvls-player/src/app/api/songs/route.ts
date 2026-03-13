import { NextRequest, NextResponse } from "next/server";

function encodeShareUrl(shareUrl: string): string {
  const base64 = Buffer.from(shareUrl).toString("base64url");
  return "u!" + base64;
}

const AUDIO_EXTENSIONS = new Set([
  "mp3", "flac", "wav", "aac", "ogg", "m4a", "opus", "wma",
]);

function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext);
}

const GRAPH_SELECT =
  "id,name,size,file,audio,createdDateTime,lastModifiedDateTime,@microsoft.graph.downloadUrl";

export async function GET(req: NextRequest) {
  const shareUrl = req.nextUrl.searchParams.get("shareUrl");
  const accessToken = req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!shareUrl) {
    return NextResponse.json({ error: "shareUrl is required" }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json(
      { error: "Microsoft access token required. Please connect your account in Settings." },
      { status: 401 }
    );
  }

  try {
    const shareToken = encodeShareUrl(shareUrl);
    const allFiles: unknown[] = [];

    const fetchPage = async (url: string): Promise<void> => {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Graph API returned ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = await res.json();
      allFiles.push(...(data.value ?? []));

      if (data["@odata.nextLink"]) {
        await fetchPage(data["@odata.nextLink"]);
      }
    };

    await fetchPage(
      `https://graph.microsoft.com/v1.0/shares/${shareToken}/driveItem/children` +
        `?$select=${GRAPH_SELECT}&$top=200`
    );

    const audioFiles = (allFiles as Array<Record<string, unknown>>).filter(
      (f) => f.file && isAudioFile(String(f.name ?? ""))
    );

    return NextResponse.json({ files: audioFiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Graph] Failed to fetch files:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
