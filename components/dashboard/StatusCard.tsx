import Link from "next/link";

interface StatusCardProps {
  status: string;
  badgeBg: string;
  badgeText: string;
  title: string;
  count: number;
  buttonLabel: string;
  buttonHref: string;
}

export default function StatusCard({
  status,
  badgeBg,
  badgeText,
  title,
  count,
  buttonLabel,
  buttonHref,
}: StatusCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border flex flex-col p-4 gap-2"
      style={{
        borderColor: "#E2E8F0",
        boxShadow:
          "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 16px 0 rgb(26 43 74 / 0.05)",
      }}
    >
      {/* Status badge */}
      <span
        className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: badgeBg, color: badgeText }}
      >
        {status}
      </span>

      {/* Count */}
      <span
        className="text-3xl font-bold tabular-nums leading-none"
        style={{ color: "#1A2B4A" }}
      >
        {count}
      </span>

      {/* Title */}
      <h3
        className="text-sm font-semibold flex-1"
        style={{ color: "#1A2B4A" }}
      >
        {title}
      </h3>

      {/* Action button */}
      <Link
        href={buttonHref}
        className="inline-flex items-center justify-center text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
        style={{
          borderColor: "#E2E8F0",
          color: "#1A2B4A",
        }}
      >
        {buttonLabel}
      </Link>
    </div>
  );
}
