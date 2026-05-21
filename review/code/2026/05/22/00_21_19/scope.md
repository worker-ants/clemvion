# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: `codebase/backend/src/modules/llm/llm.service.spec.ts`

- **[INFO]** 변경 전체가 plan §2 에 명시된 항목과 1:1 대응
  - 위치: diff 전체 (+110줄, `describe('Retry-After header behavior')` 블록)
  - 상세: plan/in-progress/llm-retry-after.md §2 마지막 bullet(`withRetry 통합 테스트`)의 세 시나리오 — `Retry-After=2 → 2000ms`, `Retry-After 없음 → 1000ms exponential`, `Retry-After=100 → 60_000ms capped` — 와 diff 의 세 `it()` 케이스가 정확히 매칭된다.
  - 제안: 없음. 범위 이탈 없음.

- **[INFO]** 추가 import 없음, 기존 테스트 수정 없음
  - 위치: 파일 상단 import, 기존 `describe('withRetry')` 내부 첫 번째 `it()`
  - 상세: 기존 테스트 코드에 대한 편집이 전혀 없으며, 새 `describe` 블록을 기존 `describe('withRetry')` 닫힘 직전에 삽입하는 최소 변경 방식이다.
  - 제안: 없음.

---

### 파일 2: `codebase/frontend/src/components/layout/sidebar.tsx`

- **[WARNING]** 브랜치 명시 범위(backend LlmService 통합 테스트)와 무관한 프론트엔드 파일 수정
  - 위치: `sidebar.tsx` 전체 diff
  - 상세: 브랜치 stated scope 는 "LlmService.withRetry — Retry-After integration tests" 이며 plan §"변경 범위" 에 `sidebar.tsx` 는 포함되어 있지 않다. 그러나 호출자 메모에 "§ISSUE FIX 정책에 따라 lint 단계 차단 에러를 선행 수정"했다고 명시되어 있으며, diff 내용 자체도 `react-hooks/set-state-in-effect` lint 위반 한 건 해소를 위해 `useEffect` 내 `setNotifFilter("all")` 호출을 `closeNotif` / `toggleNotif` 콜백으로 이동시킨 것이다. 변경은 기능적으로 동일하며 lint 위반 수정이 명확히 특정되어 있다.
  - 정책 적합성: §ISSUE FIX 정책(pre-existing 에러가 TEST WORKFLOW lint 단계를 차단)에 해당하는 경우 허용 가능한 side-fix 로 볼 수 있다. 단, 원칙적으로 계획 문서(plan)에 해당 수정이 기재되어 있지 않아 추적 가능성이 낮다.
  - 제안: plan/in-progress/llm-retry-after.md 또는 commit message 에 "§ISSUE FIX: sidebar.tsx react-hooks/set-state-in-effect lint 수정" 1줄 추가로 추적 가능성 확보. 코드 자체는 롤백 불필요.

- **[INFO]** `useCallback` import 추가 — 사용처와 직결
  - 위치: import 블록 (`useCallback` 추가)
  - 상세: 추가된 `closeNotif`, `toggleNotif` 모두 `useCallback`으로 감싸져 있어 import 추가가 정당하다. 불필요한 import 아님.
  - 제안: 없음.

- **[INFO]** 주석 문구 수정
  - 위치: `// popover 닫힐 때 필터를...` → `// popover 닫힘 → 다음 진입 시...`
  - 상세: 구현 방식이 `useEffect` → 이벤트 핸들러 직접 호출로 바뀌었으므로 주석 갱신은 필수적이다. 불필요한 주석 변경이 아님.
  - 제안: 없음.

- **[INFO]** 포맷팅 변경 없음
  - 상세: import 재배치(단일 행 → 멀티라인)는 `useCallback` 추가에 따른 자연스러운 포맷 정렬이며, 나머지 코드에 공백·줄바꿈 등 의미 없는 포맷 변경은 없다.

---

## 요약

백엔드 테스트 파일(`llm.service.spec.ts`)은 plan §2 에 명시된 통합 테스트 3건을 정확히 추가하는 최소 변경으로 범위 내에 완전히 해당한다. 프론트엔드 파일(`sidebar.tsx`)은 plan 명시 범위 밖이나, `react-hooks/set-state-in-effect` lint 오류가 TEST WORKFLOW 진행을 차단했기 때문에 §ISSUE FIX 정책 근거 하에 수정되었고, 변경 내용 자체는 기능 동치이며 범위가 명확히 한정되어 있다. 코드 품질 관점에서는 문제가 없으나 plan 문서에 해당 수정이 기재되지 않아 추적 가능성 확보가 권장된다.

## 위험도

LOW
