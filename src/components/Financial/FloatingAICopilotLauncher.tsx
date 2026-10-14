import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { FinancialEngineService } from '../../services/financialEngineService';

interface FloatingAICopilotLauncherProps {
  onOpenCopilot: () => void;
}

export const FloatingAICopilotLauncher: React.FC<FloatingAICopilotLauncherProps> = ({
  onOpenCopilot,
}) => {
  const { journalEntries, latestScanReport } = useCharity();
  const [isHovered, setIsHovered] = useState(false);

  // Quick check for issue count to show status badge
  const balanceCheck = React.useMemo(() => {
    return FinancialEngineService.getInstance().validateBalance(journalEntries);
  }, [journalEntries]);

  const issueCount =
    (latestScanReport?.totalIssues ?? 0) +
    (balanceCheck.isBalanced ? 0 : balanceCheck.imbalancedEntries.length);

  return (
    <div
      id="floating-ai-copilot-container"
      className="fixed bottom-6 right-6 z-40 flex items-center select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip / Prompt bubble on hover */}
      <div
        className={`mr-3 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700/80 transition-all duration-200 pointer-events-none whitespace-nowrap flex items-center gap-2 ${
          isHovered
            ? 'opacity-100 translate-x-0 scale-100'
            : 'opacity-0 translate-x-2 scale-95 hidden sm:flex'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span>Ask to Anfa Fathima</span>
        {issueCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {issueCount} issues
          </span>
        )}
      </div>

      {/* Circular Floating AI Bot Button with subtle pulse animation */}
      <button
        type="button"
        id="floating-noor-copilot-btn"
        onClick={onOpenCopilot}
        aria-label="Ask to Anfa Fathima"
        title="Ask to Anfa Fathima (Alt+N)"
        className="relative group w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl hover:shadow-2xl shadow-emerald-950/60 hover:scale-105 active:scale-95 flex items-center justify-center border-2 border-emerald-400 transition-all duration-200 cursor-pointer"
      >
        {/* Glow pulse ring */}
        <span className="absolute -inset-1 rounded-full bg-emerald-500 opacity-40 blur-xs group-hover:opacity-75 transition-opacity animate-pulse" />

        {/* Hijabi Avatar Image */}
        <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center p-0.5">
          <img
            src="/src/assets/images/anfa_fathima_avatar_1791803516715.jpg"
            alt="Anfa Fathima"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-300"
          />
        </div>

        {/* Sparkle badge on corner */}
        <Sparkles className="w-3.5 h-3.5 text-emerald-300 absolute -top-0.5 -right-0.5 drop-shadow-md animate-bounce" />

        {/* Indicator badge if issues exist */}
        {issueCount > 0 && (
          <span
            id="floating-ai-copilot-badge"
            className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-sm z-10"
          >
            {issueCount > 9 ? '9+' : issueCount}
          </span>
        )}
      </button>
    </div>
  );
};
