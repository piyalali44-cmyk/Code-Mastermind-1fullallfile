import { useState, useRef } from "react";
import { supabase, SUPABASE_URL } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";

const BUCKET = "content-assets";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
  shape?: "square" | "circle" | "banner";
  placeholder?: string;
}

export default function ImageUpload({
  value,
  onChange,
  label = "Image",
  folder = "general",
  shape = "square",
  placeholder = "Upload image or paste URL",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const shapeClass =
    shape === "circle"
      ? "rounded-full aspect-square"
      : shape === "banner"
      ? "rounded-lg aspect-[3/1]"
      : "rounded-lg aspect-square";

  async function uploadFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert("Invalid file type. Use PNG, JPG, WebP, GIF, or SVG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File too large. Maximum 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Upload failed: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        onChange(urlData.publicUrl);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="flex gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        <div className="relative group">
          <div className={`overflow-hidden border border-border bg-secondary ${shapeClass} w-full max-w-[200px]`}>
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          className={`flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer h-28 ${shapeClass} max-w-[200px] ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-secondary/40 hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-[11px] text-muted-foreground text-center px-2">
                Drop image or click to upload
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
