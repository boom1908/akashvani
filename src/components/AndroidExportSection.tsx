import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Smartphone } from 'lucide-react';

export function AndroidExportSection() {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [workflowCode, setWorkflowCode] = useState<string | null>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);

  const handleToggleWorkflow = async () => {
    const next = !showWorkflow;
    setShowWorkflow(next);
    if (next && workflowCode === null) {
      setLoadingWorkflow(true);
      try {
        const res = await fetch('/api/workflow-preview');
        if (res.ok) {
          setWorkflowCode(await res.text());
        } else {
          setWorkflowCode('Unable to load workflow file.');
        }
      } catch {
        setWorkflowCode('Unable to load workflow file.');
      } finally {
        setLoadingWorkflow(false);
      }
    }
  };

  return (
    <section
      id="android-build"
      aria-label="Native Android APK and GitHub Releases"
      className="bg-white border border-[#E2E5EB] rounded-3xl p-6 sm:p-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-[#5A6070]">
            <Smartphone className="w-4 h-4 text-[#C8232C]" aria-hidden="true" />
            <span>Native Android APK · Zero PC Needed</span>
          </div>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111318] [text-wrap:balance]">
            Build your Android APK in GitHub Releases
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#525866] leading-relaxed">
            This project already includes the complete native Kotlin Android app (with background
            lock-screen playback, official Akashvani headers, live rewind seeking, and remote
            station sync) plus the GitHub Actions workflow that zips the APK and uploads it
            directly to GitHub Releases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <a
            href="/api/download-android-bundle"
            download="akashvani-android-github-kit.zip"
            className="inline-flex items-center gap-2 px-5 py-3 min-h-[46px] text-sm font-semibold text-white bg-[#C8232C] hover:bg-[#B11D25] rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download Android + GitHub Kit (.zip)</span>
          </a>

          <button
            type="button"
            onClick={handleToggleWorkflow}
            aria-expanded={showWorkflow}
            className="inline-flex items-center gap-2 px-4 py-3 min-h-[46px] text-sm font-semibold text-[#111318] bg-[#F6F7F9] hover:bg-[#ECEEF3] border border-[#E2E5EB] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{showWorkflow ? 'Hide Workflow' : 'View GitHub Workflow'}</span>
            {showWorkflow ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* 3 Simple Phone-Only Steps */}
      <div className="mt-7 pt-6 border-t border-[#E2E5EB] grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <p className="font-mono text-xs font-semibold text-[#C8232C]">01. Push to GitHub</p>
          <p className="mt-1.5 text-sm font-semibold text-[#111318]">
            Export straight from AI Studio or upload the ZIP
          </p>
          <p className="mt-1 text-sm text-[#5A6070] leading-relaxed">
            Use the GitHub button right here in AI Studio (or upload the downloaded kit from your
            phone browser) into any GitHub repo.
          </p>
        </div>

        <div>
          <p className="font-mono text-xs font-semibold text-[#C8232C]">02. Cloud Auto-Build</p>
          <p className="mt-1.5 text-sm font-semibold text-[#111318]">
            GitHub compiles, signs &amp; zips the APK
          </p>
          <p className="mt-1 text-sm text-[#5A6070] leading-relaxed">
            GitHub Actions runs automatically on push (or tap Actions &rarr; Run workflow on your
            phone) and packs the signed APK inside a ZIP archive.
          </p>
        </div>

        <div>
          <p className="font-mono text-xs font-semibold text-[#C8232C]">03. Install from Releases</p>
          <p className="mt-1.5 text-sm font-semibold text-[#111318]">
            Download Akashvani-v1.0.X-android-apk.zip
          </p>
            <p className="mt-1 text-sm text-[#5A6070] leading-relaxed">
              Open the Releases section of your repo on your phone, download the ZIP, extract it in
              your Files app, and tap the APK. Every future build updates in place without
              uninstalling.
            </p>
          </div>
        </div>

      {showWorkflow && (
        <div className="mt-6 rounded-2xl bg-[#15181F] text-[#E6E9F0] p-4 sm:p-5 overflow-x-auto">
          <div className="flex items-center justify-between text-xs font-mono text-[#9CA3AF] mb-3">
            <span>.github/workflows/build-android-apk.yml</span>
            <span>Uploads zipped APK directly to GitHub Releases</span>
          </div>
          <pre className="text-xs font-mono leading-relaxed whitespace-pre">
            {loadingWorkflow ? 'Loading workflow...' : workflowCode}
          </pre>
        </div>
      )}
    </section>
  );
}
