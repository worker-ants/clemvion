## 발견사항

### 파일 1: status-badge.test.tsx — 시계 고정(fake timers) 추가

- **[INFO]** 기능 완전성: `vi.useFakeTimers()` + `vi.setSystemTime(...)` 추가는 flaky 근본 원인(두 `Date.now()` 호출 사이의 수 ms 간격)을 정확하게 제거한다. `beforeEach`/`afterEach` 쌍으로 각 테스트 후 실시간 복원까지 구현되어 있다.
  - 위치: `/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L48–54
  - 상세: 고정 시각(`2026-06-28T00:00:00Z`)이 경계 케이스 단언(`minutesFromNow(60) → "1h"` 등)을 결정적으로 만든다. `afterEach(() => vi.useRealTimers())` 로 다른 테스트 파일 오염 방지도 충족.
  - 제안: 해당 없음. 의도와 구현 일치.

- **[WARNING]** `needsAttention`의 `autoRefresh` 가드 미반영 — 테스트가 검증하지 못하는 기존 구현 결함:
  - 위치: `status-badge.tsx` L148–161 (`needsAttention` 함수)
  - 상세: 구현 내부에 `TODO(autoRefresh 가드)` 주석이 명시적으로 존재한다. `needsAttention`은 현재 `autoRefresh=true`인 통합도 `isExpiringSoon` 분기에서 `true`를 반환한다 — spec §2.4 "자동 갱신 통합(`autoRefresh=true`, §9.1)은 만료 임박(7d 이내) 분기에서 제외"와 불일치. 이번 변경(fake timer 추가)은 `computeAttentionBreakdown` 테스트를 포함하는데, 테스트 내 `computeAttentionBreakdown` describe 블록에 `autoRefresh=true` + `expiresSoon=true` 조합이 `attention`에서 제외되는지 검증하는 케이스가 없다.
  - 결과: `computeStatus` 의 `autoRefresh` 분기는 올바르게 구현·테스트됐지만, `needsAttention`/`computeAttentionBreakdown` 의 동일한 정책 반영은 코드 수준에서도 TODO 상태 + 테스트도 없음. spec §2.4·§11.4 위반이 기존 코드에 잔존하며 이번 PR이 이를 해소하지 않는다.
  - 제안: `needsAttention` 내 `autoRefresh=true` 제외 가드를 구현하고(`if (integration.status === "connected") return !integration.autoRefresh && isExpiringSoon(integration.tokenExpiresAt)`), `computeAttentionBreakdown` 테스트에 `autoRefresh=true` + expiresSoon 조합이 0으로 집계되는 케이스를 추가한다. (TODO 주석에서 이미 인지된 후속 PR 대상 — 이번 PR의 추가 범위 결정은 인간 판단 필요)

- **[INFO]** spec fidelity — `computeStatus` autoRefresh 분기: spec §4.1 "상태 배지의 메인 라벨이 `Connected`인 경우에 한해 그 옆에 작은 보조 라벨 `Auto-renews · next in <duration>`을 노출" 에서 `subLabel` 형식이 `"Auto-renews · in <duration>"` 으로 구현됐다. spec은 `"Auto-renews · next in <duration>"` (next in 포함)이다.
  - 위치: `status-badge.tsx` L92, `status-badge.test.tsx` L221 (`expect(view.subLabel).toMatch(/Auto-renews/i)`)
  - 상세: 테스트는 `/Auto-renews/i` 정규식으로만 검증해 `"next in"` 포함 여부를 단언하지 않는다. spec §4.1 예시: `Auto-renews · next in 1h 24m`. 구현: `Auto-renews · in 1h 24m` (`next` 누락). 이 차이가 의도적 단순화인지 실수인지 불명확.
  - 제안: spec §4.1과 정확히 일치하려면 `Auto-renews · next in ${humanizeUntil(...)}` 로 수정하고 테스트에 `.toMatch(/Auto-renews · next in/i)` 단언 추가. 의도적 단순화라면 spec 갱신 필요.

- **[INFO]** `humanizeUntil` 경계: 테스트에 days (`≥24h`) 단위 경계(정확히 24h) 단언이 있다(`minutesFromNow(24*60)` → `"1d"`). fake timers 고정으로 이 경계가 결정적으로 통과하게 됐다. 단위 변환 로직 자체는 spec §4.1 `<duration>` 정의(minutes/hours+minutes/days)와 일치한다.

---

### 파일 2: schedules-page.test.tsx — openAddDialog + RBAC queryByTitle 수정

- **[INFO]** 기능 완전성: `findAllByRole[0]` 방식은 flaky 원인(EmptyState 렌더 후 "Add schedule" 버튼 2개 동시 존재 → `findByRole` 단수 다중 매칭 throw)을 정확하게 제거한다. 의도와 구현 일치.
  - 위치: `schedules-page.test.tsx` L554–566

- **[INFO]** RBAC 테스트 교정 — `queryByTitle` → `queryByRole`: spec §2.1 "토글·수정·삭제는 editor 이상 권한(RoleGate)에서만 노출"과 구현(`aria-label={t("schedules.editTooltip")}` / `"Delete"`)의 대응. 변경 후 테스트가 실제 aria-label(`"Edit"`, `"Delete"`)로 검증하므로 false-negative 제거 완료. 이는 기존 코드 결함의 수정이며 spec §2.1 RBAC 규칙 검증이 이제 실효성 있다.
  - 위치: `schedules-page.test.tsx` L874–882

- **[INFO]** spec fidelity — 스케줄 §2.1 "Run now": 테스트에 viewer가 "Run now" 버튼을 볼 수 있음을 검증한다 (`screen.getByRole("button", { name: /run now/i })`). spec §2.1은 "Run now" 버튼 권한에 대한 명시적 규정 없이 `인라인 버튼: 즉시 실행(Run), 활성/비활성 토글(Toggle), 수정(Edit), 삭제(Delete). 토글·수정·삭제는 editor 이상 권한(RoleGate)에서만 노출`로 기술 — "즉시 실행"의 viewer 접근 가능 여부가 spec 본문에 명시되지 않았으나 코드+테스트는 viewer도 실행 가능으로 구현. spec 본문 침묵 영역.
  - 제안: spec §2.1 표에 "즉시 실행(Run) — 권한 무관(viewer 포함 가능)" 명시 권고 (spec-planner 위임).

---

### 파일 3: review/code/2026/06/28/13_47_12/SUMMARY.md — 리뷰 산출물

- **[INFO]** 리뷰 아티팩트 파일로 요구사항 관점 분석 대상 외.

---

### 파일 4: _retry_state.json — 오케스트레이터 상태 파일

- **[INFO]** 오케스트레이터 내부 상태 파일로 요구사항 관점 분석 대상 외.

---

## 요약

이번 변경의 핵심은 두 테스트 파일의 flaky 제거다. `status-badge.test.tsx`의 fake timers 추가는 `Date.now()` 이중 읽기 문제를 정확히 해결하며, `schedules-page.test.tsx`의 `findAllByRole[0]` 전환과 `queryByTitle` → `queryByRole` 교정은 각각 비결정적 DOM 매칭과 false-negative RBAC 검증을 제거한다. spec fidelity 관점에서 `subLabel` 포맷이 spec §4.1의 `"Auto-renews · next in <duration>"`과 `"next in"` 차이가 있으며, 더 중요하게는 `needsAttention`에 기존 `TODO` 주석으로 인지된 `autoRefresh` 가드 미구현이 spec §2.4·§11.4 위반 상태로 잔존한다. 이 가드 미구현 문제는 이번 변경 범위 밖이지만 `computeAttentionBreakdown` 테스트가 해당 케이스를 커버하지 않아 회귀를 잡을 안전망이 없다.

## 위험도

LOW
