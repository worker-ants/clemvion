### 발견사항

- **[WARNING]** 주의 배너의 단수/복수 처리 손실
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` — attention banner
  - 상세: 원래 코드는 ``integration${attentionCount > 1 ? "s" : ""}``로 단수/복수를 구분했으나, 변환 후 `attentionPrefix`/`attentionSuffix` 키 분리로 이 로직이 제거됨. 영어 번역에서 1개일 때 "1 integration need attention", 2개일 때 "2 integration need attention"이 될 수 있음
  - 제안: 단수/복수 분기를 유지하거나 번역 키에 count를 파라미터로 전달하는 단일 키(`integrations.attentionBanner`)로 통합 처리

- **[WARNING]** `TFunction` 타입 미문서화 — 아키텍처 누락 가능성
  - 위치: `reset-password-form.tsx:22`, `integration-selector.tsx:1` — `import { ..., type TFunction } from "@/lib/i18n"`
  - 상세: README의 i18n 아키텍처 문서는 `useT`, `useLocale`, `translate`, `TranslationKey`는 명시했으나 `TFunction`은 언급 없음. `index.ts` 미export 시 컴파일 에러 발생
  - 제안: `src/lib/i18n/index.ts` 또는 `core.ts`에서 `TFunction` 타입이 export되는지 확인 후 README에 추가

- **[WARNING]** 테스트에서 locale 상태 복원 누락
  - 위치: 각 `__tests__/*.test.tsx`의 `beforeEach`
  - 상세: `useLocaleStore.setState({ locale: "en" })`을 설정하나 `afterEach`에서 `ko`로 복원하지 않음. 동일 파일 내 이후 테스트는 `beforeEach`로 보호되나, vitest가 모듈을 공유하는 경우 다른 describe 블록에 영향을 줄 수 있음
  - 제안: README 권장 패턴에 `afterEach(() => useLocaleStore.setState({ locale: "ko" }))` 추가 또는 각 test file에 적용

- **[INFO]** async 함수 내 locale 스냅샷 캡처
  - 위치: `verify-email-content.tsx:34`, `accept-invitation-content.tsx:37`, `editor-loader.tsx:25`
  - 상세: `useLocaleStore.getState().locale`을 async 함수 시작 시 캡처하므로 비동기 실행 중 locale이 변경되면 toast 메시지는 이전 locale로 표시됨. 드문 케이스이나 의도된 동작인지 명확하지 않음
  - 제안: 허용 가능한 트레이드오프라면 주석으로 명시

- **[INFO]** `missingSuffix` 번역 키에 형식 의존성 내재
  - 위치: `integration-selector.tsx` — `` `${value.slice(0, 8)}${t("nodeConfigs.integrationSelector.missingSuffix")}` ``
  - 상세: 번역 키가 `… (missing)` 형식을 포함해야 한다는 암묵적 계약이 코드에 숨어 있음. 번역 담당자가 이를 인지하지 못하면 앞 ID 슬라이스와의 결합이 깨짐
  - 제안: 키 값에 기대 형식을 주석으로 명시하거나 `t("...", { id: value.slice(0, 8) })`처럼 파라미터 보간으로 변경

- **[INFO]** 테스트 `"1.0s"` → `"1s"` 수정은 기존 버그 수정
  - 위치: `execution-list-page.test.tsx:108`
  - 상세: 기존 `formatDuration` 구현(1000ms → `"1s"`)과 맞지 않는 잘못된 assertion이 수정됨. 회귀가 아니라 교정

---

### 요약

이번 i18n 적용 변경은 전반적으로 아키텍처 문서에 부합하며, `useT()`/`translate()`의 용도 구분, Zod 스키마 내부화를 통한 locale-aware 유효성 검증, 테스트에서의 locale 명시 설정 등 구현 품질이 양호합니다. 다만 영어 복수형 처리가 필요한 attention 배너에서 단수/복수 분기 로직이 제거된 점과 `TFunction` 타입이 아키텍처 문서에 누락된 점은 확인이 필요하며, 나머지는 허용 가능한 수준의 개선 사항입니다.

### 위험도
**LOW**