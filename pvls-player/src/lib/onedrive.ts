import type { Song } from "@/types";
import { isAudioFile, getAudioFormat, generateId } from "./utils";

// Graph API response shape for a drive item
interface GraphDriveItem {
  id: string;
  name: string;
  size: number;
  "@microsoft.graph.downloadUrl"?: string;
  file?: { mimeType: string };
  audio?: {
    duration?: number;
    title?: string;
    album?: string;
    artist?: string;
  };
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export function oneDriveFilesToSongs(files: GraphDriveItem[]): Song[] {
  return files
    .filter((f) => f.file && isAudioFile(f.name))
    .map((f) => ({
      id: f.id,
      name: f.audio?.title || stripExtension(f.name),
      originalName: f.name,
      url: f["@microsoft.graph.downloadUrl"] ?? "",
      downloadUrl: f["@microsoft.graph.downloadUrl"] ?? "",
      size: f.size,
      duration: f.audio?.duration ? f.audio.duration / 1000 : undefined,
      format: getAudioFormat(f.name),
      addedAt: f.createdDateTime,
    }));
}

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

export { generateId };
