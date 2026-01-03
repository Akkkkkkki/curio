import React from "react";
import { Paintbrush } from "lucide-react";
import { AppTheme } from "../types";
import { useTheme } from "../theme";
import { useTranslation, translations } from "../i18n";

const optionMeta: Record<
  AppTheme,
  { labelKey: keyof (typeof translations)["en"]; swatch: string[] }
> = {
  gallery: { labelKey: "themeGallery", swatch: ["bg-white", "bg-stone-100"] },
  vault: { labelKey: "themeVault", swatch: ["bg-stone-900", "bg-stone-700"] },
  atelier: {
    labelKey: "themeAtelier",
    swatch: ["bg-[#f5f1e7]", "bg-[#e7dfd0]"],
  },
};

type ThemePickerProps = {
  layout?: "inline" | "stacked";
};

export const ThemePicker: React.FC<ThemePickerProps> = ({
  layout = "inline",
}) => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const isStacked = layout === "stacked";
  const inlineSurface =
    theme === "vault"
      ? "bg-stone-900/70 border-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
      : theme === "atelier"
        ? "bg-[#f8f6f1]/90 border-[#e6e1d5] text-stone-800"
        : "bg-white/80 border-stone-200 text-stone-700";
  const inactiveText =
    theme === "vault"
      ? "text-white/70 hover:text-white"
      : "text-stone-500 hover:text-stone-800";
  const activeSurface =
    theme === "vault"
      ? "bg-white/10 text-white border border-white/20"
      : "bg-white shadow-sm ring-1 ring-amber-200 text-stone-900";
  const stackedSurface =
    theme === "vault"
      ? "border-white/10 bg-white/5 text-white"
      : "border-stone-200 bg-white text-stone-600";

  if (isStacked) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {(Object.keys(optionMeta) as AppTheme[]).map((opt) => (
          <button
            key={opt}
            onClick={() => setTheme(opt)}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-all text-sm font-semibold ${
              theme === opt
                ? "border-amber-200 bg-amber-50 text-stone-900 shadow-sm"
                : stackedSurface
            }`}
            aria-label={t(optionMeta[opt].labelKey as any)}
            title={t(optionMeta[opt].labelKey as any)}
          >
            <span className="flex items-center gap-2">
              <Paintbrush size={14} className="text-stone-300" />
              <span>{t(optionMeta[opt].labelKey as any)}</span>
            </span>
            <span className="flex -space-x-1">
              {optionMeta[opt].swatch.map((cls, idx) => (
                <span
                  key={idx}
                  className={`w-3 h-3 rounded-full border border-black/5 ${cls}`}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`hidden sm:flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${theme === "vault" ? "text-white/60" : "text-stone-400"}`}
      >
        <Paintbrush size={14} />
        <span>{t("themeSelection")}</span>
      </div>
      <div
        className={`flex items-center gap-1 rounded-full px-1 h-10 border ${inlineSurface}`}
      >
        {(Object.keys(optionMeta) as AppTheme[]).map((opt) => (
          <button
            key={opt}
            onClick={() => setTheme(opt)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all text-[11px] font-semibold ${
              theme === opt ? activeSurface : inactiveText
            }`}
            aria-label={t(optionMeta[opt].labelKey as any)}
            title={t(optionMeta[opt].labelKey as any)}
          >
            <span className="flex -space-x-1">
              {optionMeta[opt].swatch.map((cls, idx) => (
                <span
                  key={idx}
                  className={`w-3 h-3 rounded-full border border-black/5 ${cls}`}
                />
              ))}
            </span>
            <span className="hidden md:inline">
              {t(optionMeta[opt].labelKey as any)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
