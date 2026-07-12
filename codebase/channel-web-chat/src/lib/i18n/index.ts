// 위젯 로컬 i18n 공개 API. spec/7-channel-web-chat/1-widget-app §4.
export { WIDGET_STRINGS, type Locale, type TranslationKey } from "./catalog";
export { resolveLocale, currentNavigatorLang } from "./resolve-locale";
export {
  I18nProvider,
  useTranslation,
  makeTranslate,
  type TranslateFn,
  type TranslateParams,
} from "./context";
