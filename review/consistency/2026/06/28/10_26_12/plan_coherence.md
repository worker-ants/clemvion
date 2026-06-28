# Plan 정합성 검토 결과

**Target**: `spec/7-channel-web-chat/3-auth-session.md`
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [WARNING] V-18 미결 결정과의 부분 충돌 — §3.1 재로드 복원 시퀀스

- **target 위치**: `3-auth-session.md §3.1 재로드 복원 시퀀스 (per_execution)` — step 2 전체 (`GET /api/external/executions/:id` 상태 확인 → 200+status·404·401 분기) 및 401 낙관적 refresh 1회 절차, 그리고 §R4 Rationale.
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §V-18 [minor] 위젯 재로드 복원 시퀀스 (line 107–113). 해당 항목은 `잔여: V-04·V-05·V-09·V-10·V-12·V-13·V-14·V-18 (결정 대기)` 목록에 포함된 **미해소 상태**.
- **상세**: V-18 은 `3-auth-session §3.1` 이 규정하는 "GET 상태 확인 → 200/401/404 분기 → 401 낙관적 refresh 1회" 시퀀스가 코드(`use-widget.ts`)에 **미구현** 임을 감지했다 — `getStatus` 미호출, SSE 직행. 권장 결정은 "보류 + spec 명시(v1 은 SSE 직행, 상태확인/낙관적 refresh 는 후속임을 §3.1 에 명시)" 이고 아직 사용자 결정이 내려지지 않은 채로 열려 있다.

  target 문서의 §3.1 은 `webchat-spec-polish-followups.md` 항목 #1 의 수정(step 2 응답 코드 `410`→`200+status·404` 정정)을 반영했으나, V-18 이 문제 삼은 **시퀀스 자체(GET 상태 확인·401 낙관적 refresh)** 는 그대로 남아 있다. 즉, 코드에 구현되지 않은 동작이 spec 에 확정된 절차로 기술된 상태가 유지된다. V-18 권장 방향("spec 에 v1 범위 단서 명시")은 반영되지 않았다.

  - `§R4` Rationale("재로드 `401` — 낙관적 refresh 1회 후 종료")도 현재 코드와 괴리된 상태를 근거 문단 없이 서술하고 있어, V-18 의 미결 결정을 실질적으로 우회하는 효과가 있다.

- **제안**: 두 가지 중 하나를 선택해야 한다.
  1. **spec-code-cross-audit V-18 결정을 먼저 내린 뒤** target 을 확정한다 — "코드 구현"을 선택하면 현 §3.1 서술 유지(구현 후속), "보류 + spec 명시"를 선택하면 §3.1 에 "v1 은 SSE 직행 복원, GET 상태확인·낙관적 refresh 는 후속" 단서를 추가하고 §R4 에도 v1 미구현 표기.
  2. **본 polish 범위를 V-18 과 독립으로 처리**하려면, `spec-code-cross-audit-2026-06-10.md` V-18 항목에 "본 polish PR(webchat-spec-polish-followups)은 응답 코드 오기(410→200+status) 만 정정하며, 시퀀스 존재 여부 결정은 V-18 미결 상태 그대로" 임을 명시하고, target 의 §3.1 에 v1 partial 단서 한 줄을 추가해 구현 범위를 정직하게 표기한다.

---

### [INFO] spec-sync-external-interaction-api-gaps 와의 간접 연관 추적 권장

- **target 위치**: `3-auth-session §3.1 step 2` — `GET /api/external/executions/:id` 응답의 `currentNode` / `context` / `seq` 실값 활용을 함축.
- **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `GET /api/external/executions/:id` 의 `currentNode: null`, `context: null`, `seq: 0` placeholder 미구현 항목(EIA §5.3).
- **상세**: §3.1 step 2 는 `waiting_for_input` 이면 `context` 로 현재 표면 시드(`EIA §5.3`)한다고 명시한다. 그러나 `getStatus()` 가 `context: null` 을 반환하는 동안 이 동작은 불가능하다. target 이 이 시퀀스를 spec 에 그대로 두려면 EIA gaps plan 의 해당 항목이 먼저 구현되어야 함을 이미 target 이 EIA §5.3 cross-ref 로 인정하고 있으므로, 별도 차단 사항은 아니다. 다만 V-18 결정 시 "코드 구현" 경로를 선택할 경우 EIA §5.3 `context` 구현이 연동 전제임을 plan 에 기재해 두면 추적에 유리하다.
- **제안**: V-18 결정 기록 시 EIA §5.3 `context` 구현 선행 의존을 명시.

---

## 요약

target(`3-auth-session.md`)의 주요 변경 — 응답 코드 정정(§3.1 step 2 `410`→`200+status·404`), frontmatter 훅 추가, §R6 localStorage 잔류 정책, Overview 추가 — 은 현재 활성 plan(`webchat-spec-polish-followups.md`)의 체크리스트와 정합하며, 관련 없는 다른 in-progress plan 과의 충돌도 없다. 단, `spec-code-cross-audit-2026-06-10.md` V-18 이 "미결 결정 대기"로 열어 둔 "§3.1 복원 시퀀스 자체를 spec 에 남길지·v1 단서를 달지" 문제에 대해, target 이 시퀀스를 그대로 유지하면서도 V-18 권장 단서("v1 은 SSE 직행, 상태확인·refresh 는 후속")를 추가하지 않아 WARNING 수준의 정합 미흡이 있다. 이는 미구현 동작이 spec 에 확정 절차로 남아 구현자를 오해하게 할 수 있는 품질 위험이다.

## 위험도

LOW
