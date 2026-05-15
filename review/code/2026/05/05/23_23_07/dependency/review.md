### 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 순수 내부 유틸 추출
  - 위치: `frontend/src/lib/utils/cron-to-visual.ts` (전체)
  - 상세: 신규 파일 `cron-to-visual.ts`는 `import` 문이 단 하나도 없는 순수 TypeScript 모듈입니다. 외부 패키지를 추가하지 않고 기존 코드 내 로직을 분리한 것이므로 번들 크기·라이선스·취약점 관점에서 위험 없음.
  - 제안: 현재 구조 유지.

- **[INFO]** `Frequency` 타입의 단일 소유권 이동
  - 위치: `page.tsx` 제거된 라인 (`type Frequency = "every-minute" | ...`), `cron-to-visual.ts` L21
  - 상세: 이전에 `page.tsx` 파일 스코프에 있던 `Frequency` 타입이 `cron-to-visual.ts`로 옮겨지고 `page.tsx`는 re-import 합니다. 타입 정의의 단일 진실 원천(single source of truth)이 명확해졌고, 내부 의존성 방향(util → page가 아닌 page → util)도 올바릅니다.
  - 제안: 현재 구조 유지.

- **[INFO]** `useCallback` / `useEffect` React import 제거
  - 위치: `page.tsx` L1 diff
  - 상세: `VisualCronEditor`를 controlled component로 전환함에 따라 이전에 내부 state 관리에 쓰이던 `useCallback`·`useEffect`가 제거되었습니다. React API 사용면을 줄인 것이므로 tree-shaking 측면에서도 긍정적입니다.
  - 제안: 현재 구조 유지.

- **[INFO]** `parseCronToVisualOrNull` 렌더 경로 이중 호출
  - 위치: `page.tsx` `VisualCronEditor` props 전달부 (`cronCannotRepresent` 계산)
  - 상세: `cronTab === "visual"` 상태에서 렌더마다 `parseCronToVisualOrNull(formCron)` 이 한 번 더 호출됩니다(`cronCannotRepresent` prop 계산). `parseCronToVisualOrNull`는 외부 I/O 없는 순수 정규식 분기 함수로, 실행 비용이 무시할 수준이므로 실제 문제는 없습니다. 그러나 결과를 `useMemo`로 캐싱하면 명시적으로 의도를 드러낼 수 있습니다.
  - 제안: 필요하다면 `const cronCannotRepresent = useMemo(() => formCron.trim() !== "" && parseCronToVisualOrNull(formCron) === null, [formCron])` 형태로 선언적 캐싱. 현재 규모에서는 필수 아님.

- **[INFO]** 플랜 문서와 실제 파일명 불일치
  - 위치: `plan/in-progress/schedule-cron-visual-bidirectional.md` L35 (`cron-to-visual.spec.ts`)
  - 상세: 플랜 문서는 `cron-to-visual.spec.ts`를 언급하지만 실제 생성된 파일명은 `cron-to-visual.test.ts`입니다. 의존성 문제는 아니나 문서 정합성 미스매치입니다.
  - 제안: 플랜 문서의 파일명을 `cron-to-visual.test.ts`로 정정.

---

### 요약

이번 변경은 외부 패키지를 단 하나도 추가하지 않았습니다. `cron-to-visual.ts`는 import 없는 순수 유틸 모듈이며, `Frequency`·`VisualState` 타입을 페이지 파일에서 유틸 레이어로 이전함으로써 내부 의존성 방향(page → util)을 올바르게 정립했습니다. 기존에 사용하던 `cronstrue`·`cron-parser`·`@tanstack/react-query` 등 외부 라이브러리는 변경 없이 유지됩니다. 번들 크기·라이선스·취약점·버전 충돌 어느 측면에서도 새로운 위험 요소가 없습니다.

### 위험도

**NONE**