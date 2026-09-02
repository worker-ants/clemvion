# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 범위 확인

- scope(`spec/5-system`) 델타: 0개 파일 — 이 브랜치는 spec 을 바꾸지 않았다. 정상(코드 전용 PR).
- 실질 구현 diff: `codebase/backend/src/modules/websocket/{websocket-events.types.ts,websocket.gateway.ts}`,
  `codebase/frontend/src/lib/websocket/ws-client.ts` (+ 각 테스트) — WS 소켓 수명을 토큰 수명에
  종속시키는 `auth.token_expired` 사전 통지 + disconnect + 클라이언트 재핸드셰이크 구현.
- 위 diff 는 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(developer 트랙)의
  구현 대상이며, 그 결정은 `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md`
  (planner 트랙, 이미 `spec/5-system/6-websocket-protocol.md` 에 반영 완료 — commit `6ffadb1f4`,
  `origin/main` 에 존재)에서 확정됐다.

## 발견사항

- **[INFO]** 구현 완료 vs spec 배지 미반영 — 이미 추적 중, 실행만 남음
  - target 위치: `spec/5-system/6-websocket-protocol.md:52,876,1096,1100,1133` (`auth.token_expired`
    를 `_(계획·미구현)_`/"backend emit 은 구현 대기" 로 표기), `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23` (체크박스 미체크)
  - 관련 plan: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` 체크리스트
    "머지 후 planner 턴 — spec 의 `_(계획·미구현)_` 배지 flip … **developer 권한 밖**" 항목,
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:94-96` 동일 항목
  - 상세: 이번 diff 로 backend(`armExpiryTimers`, 타이머 emit+disconnect)·frontend
    (`refreshAndReconnect`, `auth.token_expired`/`disconnect` 구독)가 **전부 구현**됐지만, spec
    본문은 여전히 "Planned·구현 대기"로 남아 있다. 이는 두 plan 문서 모두가 처음부터
    명시적으로 예정해 둔 상태다 — developer plan 의 `spec_impact: none` 은 "이 문구의 원저자가
    아니므로 자기-반증형 소정정 예외 대상이 아니다"를 근거로 의도적으로 spec 을 건드리지
    않았다. `review/code/2026/09/02/19_41_19/SUMMARY.md` 의 SPEC-DRIFT#1 도 동일 갭을 이미
    보고했고 처리 방침(머지 후 별도 planner 턴)까지 일치시켰다 — 세 문서가 정확히 같은 결론에
    수렴해 있어 **충돌은 없다.**
  - 제안: 결정 우회나 plan 갱신 불요 — 이미 올바르게 스테이징돼 있다. 다만 이 항목이 실제로
    실행되는지(머지 후 planner 턴이 spec 배지 flip + 트래커 체크박스를 실제로 닫는지)는 이
    PR 자체가 보장할 수 없으므로, 머지 조율자가 병합 뒤 그 턴이 열리는지 확인할 것.

- **[INFO]** 형제 plan `spec-draft-ws-wontdo-maintenance-appping.md` 미정리 (본 diff 와 무관, 사전 존재)
  - target 위치: 해당 없음(본 diff 밖)
  - 관련 plan: `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md`
  - 상세: 이 draft 가 제안한 spec 변경은 이미 commit `36f2791a9` 로 `origin/main` 에 반영돼 있으나
    (`system.maintenance`·서버발신 app ping won't-do 종결), 이 plan 파일 자체는 체크리스트 없이
    Rationale 로 끝나고 `plan/complete/` 로 이동되지 않았다. 본 PR 이 만든 상태가 아니라 사전에
    존재하던 상태이며, 이번 diff 의 대상(`auth.token_expired` 구현)과는 별개 결정
    (`R-wontdo-maintenance-appping`)이라 본 검토의 3관점(미해결 결정 충돌/선행 plan 미해소/후속
    누락) 어디에도 직접 걸리지 않는다.
  - 제안: 별도 planner 턴에서 체크리스트 채움 + `plan/complete/` 이동으로 정리 권장(경미, 비차단).

## 교차 확인 — 충돌 없음 확인한 항목

- `spec-sync-websocket-protocol-gaps.md` 의 "남은 하나도 결정됐다 (2026-09-02)" 서술과 구현
  범위(닫는 것: 자연 만료만 / 안 닫는 것: 명시적 revoke)가 diff 의 `armExpiryTimers` 주석·동작과
  문구 단위로 일치.
  - `armExpiryTimers` 는 `exp` 없는 토큰에 타이머를 걸지 않음 — plan 의 "핸드셰이크 검증이
    먼저 거른다" 전제와 일치.
- `websocket.gateway.ts`/`ws-client.ts` 를 참조하는 다른 in-progress plan
  (`execution-engine-residual-gaps.md`, `retry-turn-terminal-guard.md`,
  `node-output-redesign/background.md`, `spec-sync-external-interaction-api-gaps.md`) 는 전부
  본 diff 의 삽입 지점(생성자 이후, `handleConnection` 직전)과 무관한 별도 라인(`background:run:`
  채널 상수, `forwardRef` 근거 주석, 앵커 이력)을 가리켜 충돌·staleness 없음.
- `harness-review-gate-followups.md` grep 결과 본 diff 대상 파일·이벤트명과 무교차.
- `spec-draft-ws-socket-lifetime-binds-token.md` 가 명시한 "닫지 않는 대안"(안 (b)(c)(d))·
  lead time 60초·`expiresAt` 3중 의미 구분이 diff 구현·JSDoc 과 문구 단위로 일치.

## 요약

이 diff(WS 소켓 수명↔토큰 수명 종속 구현)는 `spec-sync-websocket-protocol-gaps.md` →
`spec-draft-ws-socket-lifetime-binds-token.md`(결정, spec 반영 완료) →
`ws-token-expired-socket-lifetime-impl.md`(구현) 순으로 이어지는 단일 파이프라인의 마지막
단계이며, 세 plan 문서가 서로 문구 단위로 정합하고 code review SUMMARY 의 SPEC-DRIFT 판정과도
일치한다. 유일한 잔여 갭(spec 배지가 여전히 "Planned")은 세 곳(spec draft plan·impl plan·code
review SUMMARY) 모두가 동일하게 "머지 후 별도 planner 턴, developer 권한 밖"으로 못 박아 둔
의도된 대기 상태이지 이 PR 이 만든 결함이 아니다. 미해결 결정을 우회한 흔적, 선행 plan 미해소,
반영 누락된 후속 항목 모두 발견되지 않았다.

## 위험도
NONE
