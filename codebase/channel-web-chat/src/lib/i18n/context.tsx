"use client";
// 위젯 로컬 i18n context. SoT: spec/7-channel-web-chat/1-widget-app §4.
// I18nProvider 로 해석된 locale 을 위젯 전역에 고정(boot 1회) → useTranslation() 으로 소비.
// 메인 앱 frontend dict 시스템과 분리된 위젯 전용 경량 경로다.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { WIDGET_STRINGS, type Locale, type TranslationKey } from "./catalog";

export type TranslateParams = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, params?: TranslateParams) => string;

// 기본값 ko — Provider 밖(예: 컴포넌트 단독 렌더 테스트)에서도 한국어로 안전 폴백.
const LocaleContext = createContext<Locale>("ko");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** locale 에 바인딩된 번역 함수 생성(React 밖에서도 사용 가능 — 예: 내부 에러 문구). */
export function makeTranslate(locale: Locale): TranslateFn {
  const dict = WIDGET_STRINGS[locale];
  return (key, params) => {
    // en 결손 시 ko 로, 그것도 없으면 키 자체로 폴백(런타임 안전 — parity 테스트가 결손을 선차단).
    const template: string = dict[key] ?? WIDGET_STRINGS.ko[key] ?? key;
    if (!params) return template;
    // 보간 문법은 제품 전반과 통일: {{name}} 이중 중괄호.
    return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
      name in params ? String(params[name]) : `{{${name}}}`,
    );
  };
}

/** 현재 locale 에 바인딩된 t 함수. 컴포넌트에서 `const t = useTranslation()`. */
export function useTranslation(): TranslateFn {
  const locale = useContext(LocaleContext);
  return useMemo(() => makeTranslate(locale), [locale]);
}
