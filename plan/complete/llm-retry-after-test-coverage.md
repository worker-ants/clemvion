---
worktree: TBD
started: 2026-05-22
owner: developer
parent: llm-retry-after (closeout PR)
---

# llm-retry-after 후속 — 테스트 커버리지 확장

## 배경

`llm-retry-after` closeout PR 의 ai-review (review/code/2026/05/22/00_21_19) 에서 발견된 테스트 커버리지 갭. SUMMARY 의 5건 (W2 ~ W5, W8) 을 후속 plan 으로 분리. 모두 functional 위험은 없으나 회귀 방지·문서 일관성 강화 목적.

## 변경 범위

### 1) `codebase/backend/src/modules/llm/llm.service.spec.ts`

- [ ] **W2 — cap 경계값**: 현재 `Retry-After: '100'` (>60s) → 60_000 케이스만 있음. 추가:
  - `Retry-After: '59'` → setTimeout 59_000ms (cap 미적용)
  - `Retry-After: '60'` → setTimeout 60_000ms (정확히 경계)
- [ ] **W3 — `'rate limit'` 문자열 분기**: `withRetry` 는 `.message.includes('429') || .message.toLowerCase().includes('rate limit')` 로 판정. `'Rate Limit Exceeded'` (429 없는) 메시지 에러로도 retry 가 동작하는지 검증.
- [ ] **W4 — 종단 경로**:
  - max-retry 소진: 3회 연속 rate-limit 에러 → 최종 throw 확인 (`callCount === 4`, `await expect(...).rejects.toThrow(...)`).
  - non-429 에러 즉시 throw: `Error('500 internal')` 1회 throw → retry 없이 즉시 reject, `setTimeout` 미호출.
- [ ] **W8 — 픽스처 추출**: `describe('Retry-After header behavior')` 의 `config`, `params`, success-response 객체 리터럴을 describe 상단 상수로 추출.

### 2) `codebase/frontend/src/components/layout/sidebar.test.tsx` (혹은 신규)

- [ ] **W5 — handleClickOutside 경로**: popover 를 연 상태에서 `fireEvent.mouseDown(document.body)` 트리거 → popover 닫힘 + 다음 진입 시 필터가 `"all"` 로 리셋된 것 확인. 기존 `closeNotif()` 가 외부 클릭 경로에서도 호출되는지 회귀 가드.

## 결정 사항

- **별도 plan 분리 사유**: closeout PR 의 1차 목표는 plan 의 미완 체크박스 (3건 통합 테스트) 충족. 추가 5건 테스트는 scope creep 우려로 별도 분리.
- **W8 우선순위 낮음**: 픽스처 중복은 가독성 이슈일 뿐 회귀 위험 없음. W2~W5 와 함께 묶어 1 PR.
- **W8 의 잠재적 위험**: 공통 상수화 시 `beforeEach` 에서 fresh object 를 만들지 않으면 테스트 간 mutation 오염 가능. `Object.freeze` 또는 factory function 권장.

## 후속 (별도 PR — 본 plan 범위 외)

없음. 본 plan 으로 ai-review 00_21_19 의 deferred 5건 모두 처리.
