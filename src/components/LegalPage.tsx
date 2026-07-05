import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ScrollText, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useTheme, mutedTextClasses, panelSurfaceClasses, typographyClasses } from '../theme';

type LegalDoc = 'privacy' | 'terms';

interface Section {
  titleKey: string;
  bodyKey: string;
}

const PRIVACY_SECTIONS: Section[] = [
  { titleKey: 'legalPrivacyDataTitle', bodyKey: 'legalPrivacyDataBody' },
  { titleKey: 'legalPrivacyAiTitle', bodyKey: 'legalPrivacyAiBody' },
  { titleKey: 'legalPrivacyAnalyticsTitle', bodyKey: 'legalPrivacyAnalyticsBody' },
  { titleKey: 'legalPrivacyDeleteTitle', bodyKey: 'legalPrivacyDeleteBody' },
];

const TERMS_SECTIONS: Section[] = [
  { titleKey: 'legalTermsYourContentTitle', bodyKey: 'legalTermsYourContentBody' },
  { titleKey: 'legalTermsAcceptableTitle', bodyKey: 'legalTermsAcceptableBody' },
  { titleKey: 'legalTermsAvailabilityTitle', bodyKey: 'legalTermsAvailabilityBody' },
];

// Bump these whenever the corresponding copy above/below is materially changed
// so returning users can see the policy is a different revision.
const LEGAL_LAST_UPDATED: Record<LegalDoc, string> = {
  privacy: '2026-07-03',
  terms: '2026-07-03',
};

const isLegalDoc = (value: string | undefined): value is LegalDoc =>
  value === 'privacy' || value === 'terms';

export const LegalPage: React.FC = () => {
  const { doc } = useParams<{ doc: string }>();
  const { t, language } = useTranslation();
  const { theme } = useTheme();

  const resolvedDoc: LegalDoc = isLegalDoc(doc) ? doc : 'privacy';
  const isPrivacy = resolvedDoc === 'privacy';

  const titleKey = isPrivacy ? 'privacyPolicy' : 'termsOfService';
  const introKey = isPrivacy ? 'legalPrivacyIntro' : 'legalTermsIntro';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const Icon = isPrivacy ? ShieldCheck : ScrollText;

  const surfaceClass = panelSurfaceClasses[theme];
  const mutedClass = mutedTextClasses[theme];
  const badgeClass =
    theme === 'vault'
      ? 'bg-white/5 text-stone-300 border-white/10'
      : theme === 'atelier'
        ? 'bg-[#EDE4D3] text-[#6B5344] border-[#D4C9B8]'
        : 'bg-stone-100 text-stone-600 border-stone-200';
  const dividerBorder =
    theme === 'vault'
      ? 'border-white/10'
      : theme === 'atelier'
        ? 'border-[#D4C9B8]'
        : 'border-stone-100';
  const linkClass =
    theme === 'vault'
      ? 'text-[#D4A574] hover:text-[#E0B585]'
      : theme === 'atelier'
        ? 'text-[#A86F3C] hover:text-[#8B5A2B]'
        : 'text-amber-700 hover:text-amber-800';

  return (
    <div className="px-4 py-12 sm:py-16" data-testid={`legal-page-${resolvedDoc}`}>
      <div
        className={`max-w-2xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl border ${surfaceClass}`}
      >
        <div className="mb-8 flex flex-col gap-4">
          <Link
            to="/"
            className={`inline-flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-[0.16em] ${mutedClass} hover:opacity-100 opacity-80 transition-opacity`}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t('legalBackToCurio')}
          </Link>
          <div className="flex items-center gap-3">
            <Icon size={20} aria-hidden="true" className={mutedClass} />
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full border ${badgeClass}`}
            >
              {t('legalDraftBadge')}
            </span>
          </div>
          <h1 className={typographyClasses.titleLarge}>{t(titleKey)}</h1>
          {(() => {
            const iso = LEGAL_LAST_UPDATED[resolvedDoc];
            const parsed = new Date(`${iso}T00:00:00Z`);
            const locale = language === 'zh' ? 'zh-CN' : 'en-US';
            const formatted = Number.isNaN(parsed.getTime())
              ? iso
              : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'long',
                  timeZone: 'UTC',
                }).format(parsed);
            return (
              <p className={`${typographyClasses.labelMuted} ${mutedClass}`}>
                {t('legalLastUpdatedLabel')}{' '}
                <time dateTime={iso} data-testid="legal-last-updated">
                  {formatted}
                </time>
              </p>
            );
          })()}
          <p className={`${typographyClasses.body} ${mutedClass}`}>{t(introKey)}</p>
        </div>

        <div className={`border-t ${dividerBorder} pt-8 space-y-8`}>
          {sections.map(({ titleKey: sTitle, bodyKey: sBody }) => (
            <section key={sTitle} className="space-y-2">
              <h2 className={`${typographyClasses.title} font-serif`}>{t(sTitle)}</h2>
              <p className={`${typographyClasses.body} ${mutedClass}`}>{t(sBody)}</p>
            </section>
          ))}

          <section className="space-y-2">
            <h2 className={`${typographyClasses.title} font-serif`}>{t('legalContactTitle')}</h2>
            <p className={`${typographyClasses.body} ${mutedClass}`}>{t('legalContactBody')}</p>
          </section>

          <div className={`pt-6 border-t ${dividerBorder} flex items-center gap-4 text-sm`}>
            <Link
              to={isPrivacy ? '/legal/terms' : '/legal/privacy'}
              className={`font-semibold transition-colors ${linkClass}`}
            >
              {isPrivacy ? t('termsOfService') : t('privacyPolicy')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
