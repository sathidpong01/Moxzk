"use client";

import { UploadZone } from "@/components/core/UploadZone";
import { WorkBench } from "@/components/core/WorkBench";
import { ControlPanel } from "@/components/core/ControlPanel";
import { useAppStore } from "@/stores/useAppStore";

export default function Home() {
  const { file } = useAppStore();

  return (
    <main className="min-h-screen bg-base-200 flex flex-col font-sans">
      {/* Header */}
      <header className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Manga Translator AI
          </a>
        </div>
        <div className="flex-none">
          <ul className="menu menu-horizontal px-1">
            <li>
              <a>History</a>
            </li>
            <li>
              <a>Settings</a>
            </li>
          </ul>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative">
        {!file ? (
          <div className="flex items-center justify-center h-[calc(100vh-64px)]">
            <UploadZone />
          </div>
        ) : (
          <WorkBench />
        )}
      </div>

      {/* Float Controls */}
      <ControlPanel />
    </main>
  );
}
