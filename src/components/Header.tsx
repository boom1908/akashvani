import { Download } from 'lucide-react';
import { AkashvaniLogo } from './AkashvaniLogo';

interface HeaderProps {
  onNavigate: (sectionId: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#22252B]/92 backdrop-blur-md border-b border-[#363C47]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Monochromatic Brand Mark + Wordmark */}
        <a
          href="#tuner"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('tuner');
          }}
          className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-[#F3F5F8] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3F5F8] rounded-md"
        >
          <AkashvaniLogo className="w-8 h-8 shrink-0" />
          <span>Akashvani</span>
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#A9B0BC]"
        >
          <a
            href="#tuner"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('tuner');
            }}
            className="hover:text-[#F3F5F8] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Tuner
          </a>
          <a
            href="#stations"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('stations');
            }}
            className="hover:text-[#F3F5F8] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Stations
          </a>
          <a
            href="#sleep-timer"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('sleep-timer');
            }}
            className="hover:text-[#F3F5F8] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Sleep Timer
          </a>
          <a
            href="#android-build"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('android-build');
            }}
            className="hover:text-[#F3F5F8] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Android APK
          </a>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <a
            href="/api/download-android-bundle"
            download="akashvani-android-github-kit.zip"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-[#181B20] bg-[#F3F5F8] hover:bg-[#DFE3EA] rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3F5F8]"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Download APK Kit</span>
          </a>
        </div>
      </div>
    </header>
  );
}
