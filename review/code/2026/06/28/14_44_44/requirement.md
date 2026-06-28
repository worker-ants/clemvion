# 요구사항(Requirement) 리뷰 결과

## 대상 파일

1. `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` — fake timers 추가 (flaky 수정)
2. `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` — `openAddDialog` + viewer RBAC 쿼리 교정 (flaky 수정)
3. `review/code/2026/06/28/13_47_12/` 하위 파일 7건 — 이전 리뷰 세션 산출물
4. `review/code/2026/06/28/14_34_54/` 하위 파일 — 직전 리뷰 세션 산출물

---

## 발견사항

### 1. **[WARNING]** `needsAttention` 에 `autoRefresh` 가드 미구현 — spec §2.4·§11.4 위반 상태 잔존 + TODO 명시

- 위치: `/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L148–161
- 상세: `status-badge.tsx` L149–157 에 다음 TODO 주석이 명시적으로 존재한다:
  ```
  // TODO(autoRefresh 가드): spec/2-navigation/4-integration.md §2.4·§11.4
  // (PR #139) 가 attention 술어에서 `autoRefresh=true` 통합을 제외하도록
  // 정의했으나, 본 가드의 frontend 반영과 backend `EXPIRING_SOON_INTERVAL`
  // 쿼리 변경은 같은 PR 에서 동기되어야 한다. 후속 PR 에서 처리.
  ```
  실제로 L158: `if (integration.status === "connected") return isExpiringSoon(integration.tokenExpiresAt);` 는 `autoRefresh=true` 통합도 `expiresSoon=true` 시 `needsAttention=true` 를 반환한다.

  spec §2.4 명시 내용 ("자동 갱신 통합(`autoRefresh=true`, §9.1)은 만료 임박(7d 이내) 분기에서 제외"):
  > **포함 조건**: `(status='connected' AND token_expires_at IS NOT NULL AND ... AND NOT integration.autoRefresh)`. **자동 갱신 통합(`autoRefresh=true`, §9.1)** 은 만료 임박(7d 이내) 분기에서 제외

  이번 변경(`status-badge.test.tsx` fake timers 추가)은 `computeAttentionBreakdown` 테스트 케이스를 실행하므로 이 결함의 테스트 커버리지와 관련이 있다. `computeAttentionBreakdown` describe 블록에 `autoRefresh=true + expiresSoon=true` 조합을 attention 에서 제외하는 케이스가 없다.

- 판단: 이는 기존 코드의 명시적 TODO 로, 이번 변경(flaky 수정)이 원인이 아니다. TODO 는 별도 plan(`integration-token-ui-autorefresh.md` 참조 — 현재 in-progress 목록에 미확인)으로 의도적 deferral 이 명시돼 있다. 본 flaky 수정 PR 에서 이 기존 TODO 를 해소할 의무는 없으나, **spec §2.4·§11.4 위반이 기존 코드에 잔존하며 이번 PR 이 이를 건드리지 않는다**는 사실을 경고 수준으로 기록한다.
- 제안: 별도 PR(`integration-token-ui-autorefresh.md` 후속)에서 `needsAttention` 에 `!integration.autoRefresh &&` 가드 추가 + `computeAttentionBreakdown` 테스트에 `autoRefresh=true + expiresSoon` 조합 케이스 추가. **본 flaky 수정 PR 에서는 해소 불필요** — 기존 TODO 로 의도적 deferral.

---

### 2. **[WARNING]** `subLabel` 포맷이 spec §4.1 본문과 불일치

- 위치: `/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L89–92, `status-badge.test.tsx` L221
- 상세: spec §4.1 헤더 메타 라인 명세:
  > 작은 보조 라벨 `Auto-renews · next in <duration>` 을 회색 톤(muted)으로 노출 (예: `Auto-renews · next in 1h 24m`)

  구현 (`status-badge.tsx` L90–92):
  ```ts
  // 라벨로 "Auto-renews · in <duration>" 안내.
  const subLabel =
      integration.autoRefresh && integration.tokenExpiresAt
        ? `Auto-renews · in ${humanizeUntil(integration.tokenExpiresAt)}`
  ```
  구현은 `"Auto-renews · in <duration>"` 이며 spec 의 `"next in"` 이 누락됐다.

  테스트(`status-badge.test.tsx` L221): `expect(view.subLabel).toMatch(/Auto-renews/i)` — `"next in"` 포함 여부를 단언하지 않아 불일치를 감지하지 못한다.

- 판단: 이 차이가 의도적 단순화인지 실수인지 명확하지 않다. spec §4.1 예시(`Auto-renews · next in 1h 24m`)는 구체적인 형식으로 명시된 요구사항 행위 명세다. `"next in"` 누락은 spec 과 코드 간 line-level 불일치에 해당한다.
  - **코드가 틀릴 가능성**: 구현 시 `"next in"` 이 실수로 누락됐고 spec 이 권위일 경우 → 코드 fix.
  - **SPEC-DRIFT 가능성**: 의도적 단순화이며 spec 이 낡았을 경우 → spec 반영.
  - 의도 불명확하므로 WARNING (SPEC-DRIFT 아님, 인간 판단 필요).
- 제안:
  - 코드 fix 선택: `status-badge.tsx` 의 subLabel 을 `\`Auto-renews · next in ${humanizeUntil(...)}\`` 로 수정 + 테스트 단언을 `toMatch(/Auto-renews · next in/i)` 로 강화.
  - spec 반영 선택: `spec/2-navigation/4-integration.md §4.1` 헤더 메타 라인 예시를 `Auto-renews · in <duration>` 으로 수정 (project-planner 위임).

---

### 3. **[INFO]** `status-badge.test.tsx` fake timers 추가 — 기능 완전성 확인

- 위치: `status-badge.test.tsx` L47–54 (변경 전체)
- 상세: `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-06-28T00:00:00Z"))` 추가는 `Date.now()` 이중 읽기 사이의 수 ms 간격으로 인한 flaky 원인을 정확히 제거한다. `beforeEach`/`afterEach` 쌍으로 각 테스트 후 실시간 복원(`vi.useRealTimers()`)까지 구현되어 다른 테스트 파일 오염 방지도 충족. 의도와 구현이 일치한다.
- 제안: 없음.

---

### 4. **[INFO]** `humanizeUntil` 단위 변환 로직 — spec §4.1 `<duration>` 정의 일치

- 위치: `status-badge.tsx` `humanizeUntil` 함수, `status-badge.test.tsx` L269–308
- 상세: spec §4.1 `<duration>` 은 `token_expires_at - NOW()` 의 사람 친화 표기라 정의. 테스트 케이스:
  - `< 60s` → `"less than a minute"` 
  - `< 1h` → `"45m"` 형식
  - `= 60m` → `"1h"`, `= 84m` → `"1h 24m"` (hours + minutes)
  - `≥ 24h` → `"1d"`, `"3d"` 형식
  
  Fake timers 고정으로 이 경계 단언들이 결정적으로 통과하게 됐다. 단위 변환 로직 자체는 spec 정의와 부합한다.
- 제안: 없음.

---

### 5. **[INFO]** `schedules-page.test.tsx` — `findAllByRole[0]` 수정 기능 완전성

- 위치: `schedules-page.test.tsx` `openAddDialog()` 함수 (diff L65–78)
- 상세: `findByRole` (단수) → `findAllByRole + [0]` 수정은 빈 목록(`EMPTY_RESPONSE`)에서 헤더 버튼과 EmptyState 버튼이 동시에 DOM 에 존재할 때 단수 쿼리가 다중 매칭 throw 를 내는 flaky 원인을 정확히 제거한다. 헤더 버튼이 EmptyState 버튼보다 JSX 상단에 위치하므로 `[0]` 이 헤더 버튼임은 보장된다. 두 버튼 모두 동일한 `setShowDialog(true)` 콜백을 가지므로 어느 쪽을 클릭해도 테스트 의도(다이얼로그 오픈)가 충족된다.
- 제안: 없음.

---

### 6. **[INFO]** `schedules-page.test.tsx` viewer RBAC — `queryByTitle` → `queryByRole` 교정

- 위치: `schedules-page.test.tsx` diff L389–369
- 상세: spec §2.1 (스케줄 목록, `spec/2-navigation/3-schedule.md`) 은 "토글·수정·삭제는 editor 이상 권한(RoleGate)에서만 노출" 을 규정한다. 기존 `queryByTitle(/^edit$/i)` 는 `title` attribute 없이 `aria-label` 만 사용하는 버튼을 탐지하지 못해 항상 `null` 반환 → false-negative 상태였다. 변경 후 `queryByRole("button", { name: /^edit$/i })` 로 실제 `aria-label` 기반 검증이 가능해졌다. 이는 spec §2.1 RBAC 요구사항의 실효적 검증 복원이다.
- 제안: 없음.

---

### 7. **[INFO]** spec fidelity — 스케줄 §2.1 "Run now" 권한 규정 침묵 영역

- 위치: `schedules-page.test.tsx` viewer RBAC 테스트 `expect(screen.getByRole("button", { name: /run now/i }))`
- 상세: 테스트는 viewer 역할에서 "Run now" 버튼이 표시됨을 단언한다. spec §2.1(`spec/2-navigation/3-schedule.md`) 은 "토글·수정·삭제는 editor 이상 권한(RoleGate)에서만 노출" 이라 명시하나, "즉시 실행(Run now)" 의 viewer 접근 가능 여부는 본문에서 침묵한다. 코드 + 테스트는 viewer 도 "Run now" 가능으로 구현. spec 본문 침묵 영역 — 회색지대.
- 제안: spec §2.1 표에 "즉시 실행(Run) — 권한 무관(viewer 포함)" 명시 권고 (project-planner 위임). spec 갱신은 `spec/2-navigation/3-schedule.md §2.1`.

---

### 8. **[INFO]** 리뷰 산출물 파일 — 요구사항 분석 대상 외

- 위치: `review/code/2026/06/28/13_47_12/` + `review/code/2026/06/28/14_34_54/` 하위 파일
- 상세: 이전 리뷰 세션 산출물로 요구사항 관점 분석 대상이 아니다. 동작에 영향 없음.

---

## 요약

이번 변경은 두 테스트 파일의 flaky 수정이 핵심이다. `status-badge.test.tsx` 의 fake timers 추가는 `Date.now()` 이중 읽기 간격 문제를 정확히 제거하며, `schedules-page.test.tsx` 의 `findAllByRole[0]` 전환과 `queryByTitle` → `queryByRole` 교정은 각각 비결정적 DOM 매칭과 false-negative RBAC 검증을 제거한다. spec fidelity 관점에서 두 가지 불일치가 존재한다: (1) `needsAttention` 의 `autoRefresh` 가드 미구현 — `status-badge.tsx` 에 명시된 `TODO` 로 기존 코드의 의도적 deferral 이며 spec §2.4·§11.4 위반 상태가 잔존한다. (2) `subLabel` 포맷이 spec §4.1 의 `"Auto-renews · next in <duration>"` 과 `"next"` 단어 하나 불일치한다. 두 발견 모두 이번 flaky 수정 변경 자체의 결함이 아닌 기존 코드 상태이나, (1)은 spec 위반이고 (2)는 spec-코드 불일치로 WARNING 수준으로 기록한다.

## 위험도

LOW
