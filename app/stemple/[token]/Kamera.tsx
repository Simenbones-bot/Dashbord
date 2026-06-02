"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Et bilde tatt med kameraet: blob-en lastes opp, url-en vises som miniatyr.
export type TattBilde = { id: string; url: string; blob: Blob };

// Vi skalerer ned og komprimerer i nettleseren. Da blir filene sma nok til at
// hele innstemplingen (med flere bilder) holder seg under serverens grense pa
// 1 MB, og opplastingen gar raskt pa mobilnett.
const MAKS_KANT = 1024; // lengste side i piksler
const KVALITET = 0.5; // JPEG-kvalitet (0–1)

// Tegner gjeldende videobilde til et lerret og lager en komprimert JPEG.
async function lagBilde(video: HTMLVideoElement): Promise<Blob | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const skala = Math.min(1, MAKS_KANT / Math.max(vw, vh));
  const w = Math.round(vw * skala);
  const h = Math.round(vh * skala);
  const lerret = document.createElement("canvas");
  lerret.width = w;
  lerret.height = h;
  const ctx = lerret.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve) =>
    lerret.toBlob((b) => resolve(b), "image/jpeg", KVALITET),
  );
}

export default function Kamera({
  bilder,
  onEndret,
  maksAntall = 4,
}: {
  bilder: TattBilde[];
  onEndret: (bilder: TattBilde[]) => void;
  maksAntall?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [aktiv, setAktiv] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [jobber, setJobber] = useState(false);

  // Skrur av kameraet og frigjor maskinvaren igjen.
  const stopp = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAktiv(false);
  }, []);

  // Rydd opp nar komponenten forsvinner (f.eks. nar dialogen lukkes).
  useEffect(() => () => stopp(), [stopp]);

  async function start() {
    setFeil(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setFeil("Kameraet stottes ikke i denne nettleseren.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, // bakkamera helst
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setAktiv(true);
    } catch {
      setFeil(
        "Fikk ikke tilgang til kameraet. Gi nettsiden kameratilgang i nettleseren og prov igjen.",
      );
    }
  }

  async function taBilde() {
    if (!videoRef.current || jobber || bilder.length >= maksAntall) return;
    setJobber(true);
    const blob = await lagBilde(videoRef.current);
    setJobber(false);
    if (!blob) {
      setFeil("Klarte ikke a ta bildet. Prov igjen.");
      return;
    }
    onEndret([
      ...bilder,
      { id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob },
    ]);
  }

  function fjern(id: string) {
    const b = bilder.find((x) => x.id === id);
    if (b) URL.revokeObjectURL(b.url);
    onEndret(bilder.filter((x) => x.id !== id));
  }

  const fullt = bilder.length >= maksAntall;

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">
        Bilsjekk – ta bilde ({bilder.length}/{maksAntall})
      </span>

      {/* Live forhandsvisning. Holdes montert sa kamerastrommen kan kobles pa. */}
      <div
        className="overflow-hidden rounded-[10px]"
        style={{
          border: "1.5px solid var(--border-input)",
          display: aktiv ? "block" : "none",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="block w-full"
          style={{ maxHeight: 320, objectFit: "cover", backgroundColor: "#000" }}
        />
      </div>

      {!aktiv ? (
        <button
          type="button"
          onClick={start}
          className="h-11 w-full rounded-[10px] text-[15px] font-semibold"
          style={{
            border: "1.5px solid var(--bring-green)",
            color: "var(--bring-green)",
          }}
        >
          Start kamera
        </button>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={taBilde}
            disabled={jobber || fullt}
            className="h-11 flex-1 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--bring-green)" }}
          >
            {fullt ? "Maks antall bilder" : jobber ? "Tar bilde …" : "Ta bilde"}
          </button>
          <button
            type="button"
            onClick={stopp}
            className="h-11 rounded-[10px] px-4 text-[15px] font-medium"
            style={{ border: "1.5px solid var(--border-input)" }}
          >
            Skru av
          </button>
        </div>
      )}

      {feil && (
        <p className="mt-2 text-[13px]" style={{ color: "#7A1410" }}>
          {feil}
        </p>
      )}

      {bilder.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {bilder.map((b) => (
            <div key={b.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.url}
                alt="Bilsjekk"
                className="h-16 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => fjern(b.id)}
                aria-label="Fjern bilde"
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[14px] font-bold text-white shadow"
                style={{ backgroundColor: "#7A1410" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
