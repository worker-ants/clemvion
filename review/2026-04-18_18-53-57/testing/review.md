### 발견사항

---

**[CRITICAL]** i18n 핵심 로직(translate 함수)에 대한 테스트 없음
- 위치: `src/lib/i18n/core.ts`
- 상세: `translate(locale, key, params)` 함수는 "missing key → DEFAULT_LOCALE 폴백 → key 자체 반환"이라는 중요한 폴백 체인을 담당하지만, 해당 로직에 대한 단위 테스트가 전혀 보이지 않음. 파라미터 보간(`{{ param }}`) 기능도 미검증 상태
- 제안: `translate()`에 대한 전용 단위 테스트 작성 — 정상 번역, missing key 폴백, 다국어 폴백, 파라미터 보간 케이스 포함

---

**[WARNING]** locale store 동작 미검증
- 위치: `src/lib/stores/locale-store.ts`
- 상세: localStorage 퍼시스트, `<html lang>` 속성 갱신, 초기값 결정 로직(user.locale → localStorage → `ko`)이 테스트되지 않음
- 제안: zustand store 단위 테스트로 초기화 경로, localStorage 연동, lang 속성 갱신 검증

---

**[WARNING]** `getStatusLabel` 함수 테스트 없음
- 위치: `src/lib/utils/execution-status.ts`, `src/app/(main)/workflows/[id]/executions/page.tsx:271`
- 상세: 기존 정적 `STATUS_LABEL` 객체를 `getStatusLabel()` 함수로 교체했으나, 해당 함수가 내부에서 i18n을 어떻게 처리하는지(hook vs translate) 테스트로 검증되지 않음. 특히 모든 `ExecutionStatus` 값에 대해 올바른 label을 반환하는지 미확인
- 제안: `getStatusLabel`에 대한 테스트 추가, 로케일별 출력값 검증

---

**[WARNING]** `formatDuration` 출력 변경의 암묵적 처리
- 위치: `execution-list-page.test.tsx:104` (`"1.0s"` → `"1s"`)
- 상세: dashboard에서 inline 구현되던 `formatDuration`이 `@/lib/utils/date`의 공유 구현으로 교체되며 포맷이 바뀌었으나, 이 변화가 `formatDuration` 자체의 테스트 없이 기존 테스트를 조용히 수정하는 방식으로만 반영됨
- 제안: `formatDuration`에 대한 독립 단위 테스트 작성, 경계값(ms, 초, 분) 포함

---

**[WARNING]** `LocaleSync`, `DocHeader`, `DocBodyNotice` 신규 컴포넌트 테스트 없음
- 위치: `src/lib/i18n/locale-sync.tsx`, `src/components/docs/doc-header.tsx`, `src/components/docs/doc-body-notice.tsx`
- 상세: `LocaleSync`는 user.locale을 store에 동기화하는 핵심 컴포넌트이며, `DocHeader`는 로케일에 따라 `title_en`/`title`을 분기하는 역할을 함. 두 컴포넌트 모두 테스트 없음
- 제안: `LocaleSync` — user.locale 변경 시 store 갱신 검증. `DocHeader` — 로케일별 title 렌더링 검증

---

**[WARNING]** 통합(integrations) 페이지의 pluralization 로직 누락 가능성
- 위치: `integrations/page.tsx:171-175`
- 상세: 원본 코드는 `attentionCount > 1 ? "s" : ""`로 복수형 처리를 했으나, 변경 후에는 `t("integrations.attentionPrefix")` + `t("integrations.attentionSuffix")`로 단순 분리됨. 영어에서 복수형 처리가 번역 키에 어떻게 반영되는지 테스트 없음
- 제안: attentionCount가 1일 때와 복수일 때의 렌더링 스냅샷 테스트 추가

---

**[INFO]** `beforeEach`에서 로케일 명시 설정 패턴은 올바르게 적용됨
- 위치: 수정된 6개 테스트 파일 전체
- 상세: `useLocaleStore.setState({ locale: "en" })` 패턴이 README에 문서화된 방식대로 일관되게 적용됨. `afterEach`에서 원상복구는 없으나, 모든 테스트가 `beforeEach`로 상태를 명시적으로 설정하므로 격리에 문제 없음

---

**[INFO]** `useMemo`로 감싼 Zod 스키마 — 테스트에서 로케일 선행 설정 필요
- 위치: `forgot-password-form.tsx`, `login-form.tsx`, `reset-password-form.tsx`
- 상세: Zod validation 메시지가 이제 `t()`를 통해 로케일에 따라 달라짐. 폼 validation 에러 메시지를 어설션하는 테스트가 있다면 로케일을 먼저 설정해야 함. 현재 해당 폼들에 대한 테스트가 없음
- 제안: 주요 validation 케이스(빈 이메일, 잘못된 형식 등)에 대한 테스트를 로케일 설정과 함께 작성

---

### 요약

이번 변경은 전체 프론트엔드에 i18n을 체계적으로 도입한 대규모 작업으로, 기존 테스트에 로케일 상태 초기화(`useLocaleStore.setState({ locale: "en" })`)를 추가하는 방식으로 회귀를 방지하는 접근은 적절하다. 그러나 i18n 시스템의 핵심인 `translate()` 함수의 폴백 체인과 파라미터 보간 로직에 대한 단위 테스트가 전무하며, locale store의 사이드이펙트(localStorage, `html lang`)와 `LocaleSync`·`DocHeader` 등 신규 컴포넌트도 미검증 상태다. 기존 테스트를 업데이트하는 것에 그치지 않고 새로 도입된 i18n 인프라 레이어 자체에 대한 테스트가 반드시 추가되어야 한다.

### 위험도

**MEDIUM** — 핵심 i18n 인프라 미검증. 프로덕션에서 번역 키 누락 또는 폴백 미작동 시 디버깅이 어려움