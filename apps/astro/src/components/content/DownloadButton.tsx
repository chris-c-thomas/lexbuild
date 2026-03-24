import { useState, useRef, useEffect } from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadButtonProps {
  content: string;
  filename: string;
}

/** Downloads the raw Markdown content as a .md file. */
export function DownloadButton({ content, filename }: DownloadButtonProps) {
  const [downloaded, setDownloaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function handleDownload() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    if (timerRef.current) clearTimeout(timerRef.current);
    setDownloaded(true);
    timerRef.current = setTimeout(() => setDownloaded(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      {downloaded ? (
        <>
          <Check className="size-3.5" />
          <span role="status">Downloaded</span>
        </>
      ) : (
        <>
          <Download className="size-3.5" />
          Download
        </>
      )}
    </Button>
  );
}
