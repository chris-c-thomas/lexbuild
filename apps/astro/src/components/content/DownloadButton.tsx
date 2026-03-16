import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadButtonProps {
  content: string;
  filename: string;
}

/** Downloads the raw Markdown content as a .md file. */
export function DownloadButton({ content, filename }: DownloadButtonProps) {
  function handleDownload() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="size-3.5" />
      Download
    </Button>
  );
}
