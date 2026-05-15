### 발견사항

- **[INFO]** `editor-loader.tsx`가 공개 API 대신 내부 모듈을 직접 임포트
  - 위치: `editor-loader.tsx` L1 — `import { translate } from "@/lib/i18n/core"`
  - 상세: README 아키텍처 문서에 따르면 `core.ts`는 내부 구현이며 공개 API는 `index.ts`. 다른 모든 파일은 `@/lib/i18n`을 사용하는데 이 파일만 예외로 `core`를 직접 참조.
  - 제안: `import { translate } from "@/lib/i18n"` 으로 통일하거나, `core`에서 직접 임포트하는 의도를 명시적으로 re-export에 반영

- **[INFO]** `reset-password-form.tsx`가 i18n 타입(`TFunction`)을 함수 시그니처에 노출
  - 위치: `reset-password-form.tsx` — `getPasswordStrength(password, t: TFunction)`
  - 상세: 순수 유틸 함수가 i18n 시스템에 직접 의존하는 구조. 향후 i18n 라이브러리 교체 시 함수 시그니처도 변경 필요.
  - 제안: `label` 문자열을 직접 받는 방식(`strengthLabels: {weak, fair, ...}`)으로 분리하면 결합도 낮아짐. 현재 규모에서는 허용 가능.

- **[INFO]** `dashboard/page.tsx`에서 `formatDuration` 이 `@/lib/utils/date`로 이전
  - 위치: `dashboard/page.tsx` L26
  - 상세: 기존 로컬 정의를 제거하고 공유 유틸로 이동한 좋은 변경. 해당 함수가 실제로 `date.ts`에 존재하는지 빌드로 검증 필요.
  - 제안: 별도 조치 불필요 — 테스트/빌드 통과 시 확인됨.

- **[INFO]** `useLocaleStore.getState().locale` 패턴이 비동기 콜백 내에서 반복 사용
  - 위치: `verify-email-content.tsx`, `accept-invitation-content.tsx`, `editor-loader.tsx`
  - 상세: 비동기 함수 내에서 스토어의 현재 상태를 스냅샷으로 가져오는 올바른 패턴. 비동기 실행 중 locale이 변경될 경우 메시지가 이전 locale로 표시될 수 있으나 허용 가능한 트레이드오프.
  - 제안: 일관된 패턴이므로 현 상태 유지.

---

### 요약

이번 변경은 신규 외부 패키지를 추가하지 않고 내부 i18n 모듈(`@/lib/i18n`, `@/lib/stores/locale-store`)을 전 컴포넌트에 전파하는 작업이다. 의존성 관점에서 실질적인 위험 요소는 없으며, `formatDuration` 공유 유틸 이전과 Zod 스키마의 `useMemo` 패턴은 긍정적인 변경이다. `editor-loader.tsx`의 `@/lib/i18n/core` 직접 임포트는 내부 모듈 경계 일관성 측면에서 작은 개선 여지가 있으나 기능 동작에는 영향 없다. 전반적으로 의존성 위험도는 낮다.

### 위험도

**LOW**