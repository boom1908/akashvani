import { Download } from 'lucide-react';

interface HeaderProps {
  onNavigate: (sectionId: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#F6F7F9]/92 backdrop-blur-md border-b border-[#E2E5EB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#tuner"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('tuner');
          }}
          className="font-display text-xl font-bold tracking-tight text-[#111318] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C8232C] rounded-sm"
        >
          Akashvani
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#525866]"
        >
          <a
            href="#tuner"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('tuner');
            }}
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Tuner
          </a>
          <a
            href="#stations"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('stations');
            }}
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Stations
          </a>
          <a
            href="#sleep-timer"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('sleep-timer');
            }}
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Sleep Timer
          </a>
          <a
            href="#android-build"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('android-build');
            }}
            className="hover:text-[#111318] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Android APK
          </a>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <a
            href="/api/download-android-bundle"
            download="akashvani-android-github-kit.zip"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-white bg-[#111318] hover:bg-[#232732] rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8232C]"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Download APK Kit</span>
          </a>
        </div>
      </div>
    </header>
  );
}
