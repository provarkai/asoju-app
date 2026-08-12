import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  FileCheck2,
  FileText,
  FolderLock,
  Loader2,
  Plus,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VAULT_CATEGORY_LABEL } from "@/lib/asoju";

const CATEGORIES = ["TITLE_DEED", "CAC_CERT", "POWER_OF_ATTORNEY", "IDENTITY", "OTHER"] as const;

export function VaultView() {
  const data = useQuery(api.commercial.getVault);
  const addDocument = useMutation(api.commercial.addVaultDocument);
  const addAsset = useMutation(api.commercial.addVerifiedAsset);

  const [showDoc, setShowDoc] = useState(false);
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState<(typeof CATEGORIES)[number]>("OTHER");
  const [docNotes, setDocNotes] = useState("");
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
      await addDocument({
        name: docName.trim(),
        category: docCategory,
        notes: docNotes.trim() || undefined,
      });
      toast.success("Document added to your vault");
      setDocName("");
      setDocNotes("");
      setShowDoc(false);
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
            Nothing here yet — add your first document (demo: metadata only,
            no real upload).
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
                {busy === "doc" ? <Loader2 className="size-4 animate-spin" /> : null}
                Save to vault
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
