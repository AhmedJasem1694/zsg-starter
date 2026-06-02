/**
 * Shared layout for all Zane resource document pages.
 * Provides the same sticky nav/footer as the landing and resources pages,
 * plus consistent breadcrumb, header, and reading-width container.
 */

import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { ZaneLogo } from "./ZaneLogo";

interface ResourcePageLayoutProps {
  category: string;
  title: string;
  readTime: string;
  children: React.ReactNode;
}

export default function ResourcePageLayout({
  category,
  title,
  readTime,
  children,
}: ResourcePageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">

      {/* ── Nav — identical to Resources and Landing ── */}
      <header
        className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md"
        style={{ background: "rgba(11,17,24,0.97)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={true} />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-xs">
            <Link to="/" className="text-white/50 hover:text-white transition-colors duration-300">Home</Link>
            <Link to="/resources" className="text-white hover:text-white transition-colors duration-300">Resources</Link>
            <Link to="/case-study" className="text-white/50 hover:text-white transition-colors duration-300">Case study</Link>
            <Link to="/security" className="text-white/50 hover:text-white transition-colors duration-300">Security</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-1.5 text-sm text-white/50 hover:text-white transition-colors duration-300">Sign in</Link>
            <Link
              to="/register"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow shadow-primary/20"
            >
              Get started <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main reading area ── */}
      <main className="max-w-3xl mx-auto px-6 py-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#475569] mb-10">
          <Link to="/resources" className="hover:text-[#0F172A] transition-colors flex items-center gap-1.5">
            <ArrowLeft size={13} />
            Resources
          </Link>
          <span className="text-[#94A3B8]">/</span>
          <span className="text-[#0F172A] truncate">{title}</span>
        </div>

        {/* Document header */}
        <div className="mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary bg-primary/8 border border-primary/20 rounded-full px-3 py-1 mb-4">
            {category}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight mb-4">
            {title}
          </h1>
          <div className="flex items-center gap-1.5 text-sm text-[#475569]">
            <Clock size={13} />
            <span>{readTime}</span>
          </div>
        </div>

        {/* Document body — uses @tailwindcss/typography prose */}
        <div className="prose prose-slate max-w-none
          prose-headings:font-bold prose-headings:text-[#0F172A] prose-headings:tracking-tight
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-[#334155] prose-p:leading-relaxed prose-p:text-[15px]
          prose-li:text-[#334155] prose-li:text-[15px]
          prose-strong:text-[#0F172A] prose-strong:font-semibold
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-l-primary prose-blockquote:text-[#475569] prose-blockquote:not-italic
          prose-code:text-primary prose-code:bg-primary/8 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
          prose-hr:border-[#E2E8F0]">
          {children}
        </div>

        {/* Back link */}
        <div className="mt-16 pt-8 border-t border-[#E2E8F0]">
          <Link
            to="/resources"
            className="inline-flex items-center gap-2 text-sm text-[#475569] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Resources
          </Link>
        </div>
      </main>

      {/* ── Footer — identical to Resources and Landing ── */}
      <footer className="border-t border-black/6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={false} />
          </Link>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link to="/case-study" className="hover:text-gray-600 transition-colors">Case study</Link>
            <Link to="/security" className="hover:text-gray-600 transition-colors">Security</Link>
            <Link to="/resources" className="hover:text-gray-600 transition-colors">Resources</Link>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
