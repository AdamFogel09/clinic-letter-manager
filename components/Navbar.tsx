"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Home", href: "#" },
  { label: "About", href: "#about" },
  { label: "Security", href: "#security" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm"
      style={{ borderBottom: "1px solid #E2E8F0" }}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" aria-label="Home">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: "#1A2B4A" }}
            >
              C
            </span>
            <span
              className="text-base font-semibold tracking-tight"
              style={{ color: "#1A2B4A" }}
            >
              Dr. [Name] Clinic
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium transition-colors duration-150"
                style={{ color: "#64748B" }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color = "#1A2B4A")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color = "#64748B")
                }
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="btn-primary"
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.8125rem" }}
            >
              Login
            </Link>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span
                className="block w-5 h-0.5 transition-all duration-200"
                style={{
                  backgroundColor: "#1A2B4A",
                  transform: menuOpen
                    ? "rotate(45deg) translate(4px, 4px)"
                    : "none",
                }}
              />
              <span
                className="block w-5 h-0.5 transition-all duration-200"
                style={{
                  backgroundColor: "#1A2B4A",
                  opacity: menuOpen ? 0 : 1,
                }}
              />
              <span
                className="block w-5 h-0.5 transition-all duration-200"
                style={{
                  backgroundColor: "#1A2B4A",
                  transform: menuOpen
                    ? "rotate(-45deg) translate(4px, -4px)"
                    : "none",
                }}
              />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            className="md:hidden border-t py-4 flex flex-col gap-4"
            style={{ borderColor: "#E2E8F0" }}
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium"
                style={{ color: "#64748B" }}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
