import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Download,
  FileCheck2,
  FileText,
  FolderLock,
  Loader2,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VAULT_CATEGORY_LABEL } from "@/lib/asoju";
import type { Id } from "@/convex/_generated/dataModel";

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORIES = ["TITLE_DEED", "CAC_CERT", "POWER_OF_ATTORNEY", "IDENTITY", "OTHER"] as const;

export function VaultView() {
  const data = useQuery(api.commercial.getVault);
  const addDocument = useMutation(api.commercial.addVaultDocument);
  const addAsset = useMutation(api.commercial.addVerifiedAsset);
  const deleteDocument = useMutation(api.commercial.deleteVaultDocument);
  const generateUploadUrl = useAction(api.commercial.generateVaultUploadUrl);

  const [showDoc, setShowDoc] = useState(false);
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState<(typeof CATEGORIES)[number]>("OTHER");
  const [docNotes, setDocNotes] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [showAsset, setShowAsset] = useState(false);
  const [assetType, setAssetType] = useState<(typeof CATEGORIES)[number]>("POWER_OF_ATTORNEY");
  const [assetName, setAssetName] = useState("");

  const documents = data?.documents ?? [];
  const assets = data?.assets ?? [];

  const submitDocument = async () => {
    if (!docName.trim()) {
      toast.error("Give the document a name");
      return;
    }
    setBusy("doc");
    try {
      let storageId: Id<"_storage"> | undefined;
      let fileName: string | undefined;
      let fileSize: number | undefined;
      if (docFile) {
        // Upload the real file to Convex storage, then store its id.
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": docFile.type || "application/octet-stream" },
          body: docFile,
        });
        if (!res.ok) throw new Error("Upload failed — please try again");
        storageId = (await res.json()).storageId as Id<"_storage">;
        fileName = docFile.name;
        fileSize = docFile.size;
      }
      await addDocument({
        name: docName.trim(),
        category: docCategory,
        notes: docNotes.trim() || undefined,
        storageId,
        fileName,
        fileSize,
      });
      toast.success(docFile ? "Document uploaded to your vault" : "Document added to your vault");
      setDocName("");
      setDocNotes("");
      setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowDoc(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const removeDocument = async (id: Parameters<typeof deleteDocument>[0]["documentId"]) => {
    if (!window.confirm("Delete this document from your vault?")) return;
    setBusy("del");
    try {
      await deleteDocument({ documentId: id });
      toast.success("Document deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const submitAsset = async () => {
    if (!assetName.trim()) {
      toast.error("Give the asset a name");
      return;
    }
    setBusy("asset");
    try {
      await addAsset({ type: assetType, name: assetName.trim() });
      toast.success("Submitted for staff verification");
      setAssetName("");
      setShowAsset(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-clay">
            <FolderLock className="size-4" />
            My Nigeria vault
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-forest">
            Your documents, one secure locker
          </h1>
          <p className="mt-1.5 text-sm text-forest/60">
            Title deeds, CAC certificates, IDs — stored independently of any
            case, so they're ready whenever you need them.
          </p>
        </div>
        <Button className="bg-forest text-ivory hover:bg-forest-deep" onClick={() => setShowDoc(true)}>
          <Plus className="size-4" />
          Add document
        </Button>
      </div>

      {/* Documents */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-forest">Documents</h2>
        {documents.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-forest/20 bg-white/60 px-5 py-8 text-sm text-forest/50">
            <FileText className="size-5" />
            Nothing here yet — add your first document (PDF, photos, scans) and
            it's stored securely with a download link.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {documents.map((d) => (
              <div key={d._id} className="rounded-2xl border border-forest/10 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-forest/8 text-forest">
                      <FileText className="size-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-forest">{d.name}</p>
                      <p className="text-[11px] text-forest/45">
                        {VAULT_CATEGORY_LABEL[d.category] ?? d.category} ·{" "}
                        {new Date(d.createdAt).toLocaleDateString("en-GB")}
                        {d.fileName ? ` · ${d.fileName}` : ""}
                        {formatSize(d.fileSize) ? ` · ${formatSize(d.fileSize)}` : ""}
                      </p>
                    </div>
                  </div>
                  {d.isVerified ? (
                    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="size-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge className="border-amber-200 bg-amber-100 text-amber-700">Unverified</Badge>
                  )}
                </div>
                {d.notes && <p className="mt-2 text-xs text-forest/55">{d.notes}</p>}
                <div className="mt-3 flex items-center gap-2 border-t border-forest/8 pt-3">
                  <a
                    href={d.downloadUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      d.downloadUrl
                        ? "border-forest/20 text-forest hover:border-forest/50 hover:bg-forest/5"
                        : "pointer-events-none border-forest/10 text-forest/35",
                    )}
                    aria-disabled={!d.downloadUrl}
                    title={d.downloadUrl ? "Open / download file" : "No file uploaded"}
                  >
                    <Download className="size-3.5" />
                    {d.downloadUrl ? "Download" : "No file"}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeDocument(d._id)}
                    disabled={busy === "del"}
                    className="flex items-center gap-1.5 rounded-lg border border-forest/10 px-3 py-1.5 text-xs font-semibold text-forest/55 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Verified assets / PoA */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
              <Scale className="size-4.5 text-clay" />
              Power of attorney &amp; verified assets
            </h2>
            <p className="mt-1 text-xs text-forest/55">
              Verified once by our staff, then auto-linked to future cases that
              require legal execution (PRD §4.2).
            </p>
          </div>
          <Button variant="outline" className="border-forest/20 text-forest" onClick={() => setShowAsset(true)}>
            <Plus className="size-4" />
            Add PoA / asset
          </Button>
        </div>
        {assets.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-forest/20 bg-white/60 px-5 py-8 text-sm text-forest/50">
            <Scale className="size-5" />
            No verified assets yet — upload a PoA and our team verifies it once.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {assets.map((a) => (
              <div key={a._id} className="rounded-2xl border border-forest/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-clay/10 text-clay">
                      <FileCheck2 className="size-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-forest">{a.name}</p>
                      <p className="text-[11px] text-forest/45">
                        {VAULT_CATEGORY_LABEL[a.type] ?? a.type}
                      </p>
                    </div>
                  </div>
                  {a.verified ? (
                    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="size-3" /> Staff-verified
                    </Badge>
                  ) : (
                    <Badge className="border-amber-200 bg-amber-100 text-amber-700">Pending review</Badge>
                  )}
                </div>
                {a.notes && <p className="mt-2 text-xs text-forest/55">{a.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add document modal */}
      {showDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDoc(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-forest">Add a vault document</h3>
            <div className="mt-4 space-y-3">
              <input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g. Deed of assignment — Ibeju-Lekki"
                className="w-full rounded-xl border border-forest/15 bg-ivory/50 px-4 py-2.5 text-sm outline-none focus:border-forest/40"
              />
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm transition-colors",
                  docFile
                    ? "border-forest/40 bg-forest/5 text-forest"
                    : "border-forest/20 text-forest/60 hover:border-forest/40 hover:bg-ivory/60",
                )}
              >
                <UploadCloud className="size-5 shrink-0" />
                <span className="flex-1">
                  {docFile ? (
                    <>
                      <span className="block font-semibold">{docFile.name}</span>
                      <span className="block text-[11px] text-forest/50">
                        {formatSize(docFile.size)} — tap to choose another
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block font-medium">Upload a file (optional)</span>
                      <span className="block text-[11px] text-forest/50">
                        PDF, photo or scan — stored securely, downloadable anytime
                      </span>
                    </>
                  )}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDocCategory(c)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      docCategory === c
                        ? "border-forest bg-forest text-ivory"
                        : "border-forest/15 text-forest/60 hover:border-forest/35",
                    )}
                  >
                    {VAULT_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
              <textarea
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                rows={2}
                placeholder="Notes (optional)"
                className="w-full resize-none rounded-xl border border-forest/15 bg-ivory/50 px-4 py-2.5 text-sm outline-none focus:border-forest/40"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowDoc(false)}>
                Cancel
              </Button>
              <Button className="bg-forest text-ivory hover:bg-forest-deep" disabled={busy === "doc"} onClick={submitDocument}>
                {busy === "doc" ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                {docFile ? "Upload & save" : "Save to vault"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add asset modal */}
      {showAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAsset(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-forest">Add a verified asset</h3>
            <div className="mt-4 space-y-3">
              <input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. Power of attorney — Mrs. Adaeze Okonkwo"
                className="w-full rounded-xl border border-forest/15 bg-ivory/50 px-4 py-2.5 text-sm outline-none focus:border-forest/40"
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAssetType(c)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      assetType === c
                        ? "border-clay bg-clay text-ivory"
                        : "border-forest/15 text-forest/60 hover:border-forest/35",
                    )}
                  >
                    {VAULT_CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAsset(false)}>
                Cancel
              </Button>
              <Button className="bg-clay text-ivory hover:bg-clay/90" disabled={busy === "asset"} onClick={submitAsset}>
                {busy === "asset" ? <Loader2 className="size-4 animate-spin" /> : null}
                Submit for verification
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
