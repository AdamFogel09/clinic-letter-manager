"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusCard from "@/components/dashboard/StatusCard";
import { getLetters } from "@/lib/letterStore";

export default function DashboardPage() {
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmailConnected(d.connected))
      .catch(() => setGmailConnected(false));
  }, []);

  const [counts, setCounts] = useState({
    draft: 0,
    readyForReview: 0,
    waitingForAnat: 0,
    reviewed: 0,
    readyForPatient: 0,
    total: 0,
  });

  useEffect(() => {
    const letters = getLetters();
    setCounts({
      draft:            letters.filter((l) => l.status === "Draft").length,
      readyForReview:   letters.filter((l) => l.status === "Ready for Review").length,
      waitingForAnat:   letters.filter((l) => l.status === "Waiting for Anat").length,
      reviewed:         letters.filter((l) => l.status === "Reviewed").length,
      readyForPatient:  letters.filter((l) => l.status === "Ready for Patient").length,
      total:            letters.length,
    });
  }, []);

  const cards = [
    {
      status: "Draft",
      badgeBg: "#EBF3FB",
      badgeText: "#4A90D9",
      title: "To Complete",
      count: counts.draft,
      buttonLabel: "Continue",
      buttonHref: "/workspace/letter-editor",
    },
    {
      status: "Ready for Review",
      badgeBg: "#FEF3C7",
      badgeText: "#D97706",
      title: "Ready for Anat",
      count: counts.readyForReview,
      buttonLabel: "Send",
      buttonHref: "/workspace/review",
    },
    {
      status: "Waiting for Anat",
      badgeBg: "#EDE9FE",
      badgeText: "#7C3AED",
      title: "Waiting for Anat",
      count: counts.waitingForAnat,
      buttonLabel: "View",
      buttonHref: "/workspace/review",
    },
    {
      status: "Reviewed",
      badgeBg: "#FFE4E6",
      badgeText: "#BE123C",
      title: "Needs Approval",
      count: counts.reviewed,
      buttonLabel: "Approve",
      buttonHref: "/workspace/review",
    },
    {
      status: "Ready for Patient",
      badgeBg: "#CCFBF1",
      badgeText: "#0D9488",
      title: "Ready for Patient",
      count: counts.readyForPatient,
      buttonLabel: "Export",
      buttonHref: "/workspace/review",
    },
    {
      status: "All",
      badgeBg: "#F1F5F9",
      badgeText: "#475569",
      title: "All Letters",
      count: counts.total,
      buttonLabel: "View All",
      buttonHref: "/workspace/review",
    },
  ];

  return (
    <div className="flex-1 pb-10">

      {/* ── Mobile header (stacked) ── */}
      <div className="lg:hidden px-4 pt-6 pb-4">
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold" style={{ color: "#1A2B4A" }}>
            Welcome back, Dr. Sumit
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
            Clinic letter workspace
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <Link
            href="/workspace/new-patient"
            className="flex justify-center items-center text-sm font-semibold px-4 py-3.5 rounded-xl transition-all duration-150 active:scale-95"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}
          >
            New Patient
          </Link>
          <Link
            href="/workspace/new-letter"
            className="flex justify-center items-center text-sm font-semibold px-4 py-3.5 rounded-xl transition-all duration-150 active:scale-95"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}
          >
            New Letter
          </Link>
          <Link
            href="/workspace/anat-review"
            className="flex justify-center items-center text-sm font-semibold px-4 py-3.5 rounded-xl transition-all duration-150 active:scale-95"
            style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}
          >
            Anat&apos;s Workspace
          </Link>
        </div>
      </div>

      {/* ── Desktop header (3-col grid) ── */}
      <div className="hidden lg:grid grid-cols-3 items-start px-8 pt-8 pb-4">
        <div />
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: "#1A2B4A" }}>
            Welcome back, Dr. Sumit
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
            Clinic letter workspace
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
          <Link
            href="/workspace/new-patient"
            className="inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}
          >
            New Patient
          </Link>
          <Link
            href="/workspace/new-letter"
            className="inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}
          >
            New Letter
          </Link>
          <Link
            href="/workspace/anat-review"
            className="inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}
          >
            Anat&apos;s Workspace
          </Link>
        </div>
      </div>

      {/* Gmail connection status */}
      <div className="px-4 sm:px-8 mb-3">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl flex-wrap"
          style={{
            border: `1px solid ${gmailConnected ? "#D1FAE5" : "#E2E8F0"}`,
            backgroundColor: gmailConnected ? "#F0FDF4" : "#FAFBFC",
          }}
        >
          <svg
            viewBox="0 0 20 20" fill="none" stroke={gmailConnected ? "#16A34A" : "#94A3B8"}
            strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 flex-shrink-0"
          >
            <rect x="2" y="4" width="16" height="12" rx="2"/>
            <path d="M2 6l8 5 8-5"/>
          </svg>
          {gmailConnected === null ? (
            <p className="text-xs" style={{ color: "#CBD5E1" }}>Checking Gmail…</p>
          ) : gmailConnected ? (
            <>
              <p className="text-xs font-semibold" style={{ color: "#16A34A" }}>
                Gmail connected — PDF sending is active
              </p>
              <a
                href="/api/gmail/oauth/start"
                className="ml-auto text-xs flex-shrink-0"
                style={{ color: "#94A3B8" }}
              >
                Reconnect
              </a>
            </>
          ) : (
            <>
              <p className="text-xs" style={{ color: "#64748B" }}>
                Gmail not connected — PDF emails cannot be sent
              </p>
              <a
                href="/api/gmail/oauth/start"
                className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
                style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}
              >
                Connect Gmail
              </a>
            </>
          )}
        </div>
      </div>

      {/* Patient History Search placeholder */}
      <div className="px-4 sm:px-8 mb-5">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ border: "1px dashed #CBD5E1" }}
        >
          <svg
            viewBox="0 0 20 20" fill="none" stroke="#CBD5E1"
            strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
            className="w-3.5 h-3.5 flex-shrink-0"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M17 17l-3.5-3.5" />
          </svg>
          <p className="text-xs" style={{ color: "#CBD5E1" }}>
            Patient History Search — coming later
          </p>
          <span
            className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex-shrink-0"
            style={{ color: "#CBD5E1", border: "1px solid #E2E8F0" }}
          >
            Soon
          </span>
        </div>
      </div>

      {/* Status cards */}
      <div className="px-4 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((card) => (
            <StatusCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}
