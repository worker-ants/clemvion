# Plan 정합성 검토 — `spec/5-system/` (--impl-prep)

## 발견사항

- **[WARNING]** `eia-terminal-error-sanitize.md` 착수가 `spec-sync-external-interaction-api-gaps.md`
  의 동일 갭 항목을 인지·갱신하지 않은 채 진행 중이다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 `error.message`/`error.details`
    (종결 이벤트 `execution.failed` payload)
  - 관련 plan:
    - `plan/in-progress/eia-terminal-error-sanitize.md` (오늘 2026-08-16 시작, `worktree:
      eia-r8-cache-scope-4ae434` — 본 세션의 활성 작업으로 보임). 체크리스트 전항목 미체크.
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"종결 `error.message` 가
      값-패턴 마스킹을 안 거친다 (2026-08-14 등재, `22_55_51` security W2)". 체크리스트 미체크.
  - 상세: 두 plan 이 **같은 증상**(`Execution.error.message` 가 WS fanout/SSE/outbound webhook
    으로 값-패턴 마스킹 없이 원문 노출)을 서로 다른 지점·메커니즘으로 고치려 한다.
    - `eia-terminal-error-sanitize.md`: **DB write 시점**(`execution-engine.service.ts:636`
      `failFirstSegmentSetup` · `:4991` `finalizeFailedExecution` · `retry-turn.service.ts:958`
      `failRetryExecution`)에 `sanitizeErrorMessage()`(내부적으로 `shared/utils/sanitize-error-message.ts`
      의 `redactSecrets`/`SECRET_LEAK_PATTERNS` 재사용, 실측 확인 완료)를 적용해 "DB = wire"
      불변식(#1172)을 지키는 방향.
    - `spec-sync-external-interaction-api-gaps.md`: `toTerminalErrorPayload` 내부 또는 fanout
      경계에서 `message`/`details` 에 `deepRedactSecrets` 적용해 REST `getStatus`(이미
      `stripAndRedact` 적용)와 대칭을 맞추는 방향.
    - 코드로 실측한 결과 두 함수 모두 같은 SoT 패턴(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`)
      을 공유하므로, `eia-terminal-error-sanitize.md` 가 착지하면 `message` 필드에 한해
      `spec-sync` 쪽 항목의 실질 문제도 함께 해소될 가능성이 높다. 그런데
      - `eia-terminal-error-sanitize.md` 본문 어디에도 `deepRedactSecrets`·`spec-sync` 트래커·
        `22_55_51` 라운드에 대한 언급이 없고 (`grep` 0건),
      - `spec-sync-external-interaction-api-gaps.md` 쪽도 `eia-terminal-error-sanitize` 나
        `sanitizeErrorMessage` 를 언급하지 않는다 (`grep` 0건).
      - `details` 필드는 현재 세 write 지점 어디도 채우지 않아(`toTerminalErrorPayload` 의
        JSDoc이 이를 확인) 오늘은 실질 gap 이 아니지만, `spec-sync` 항목은 `details` 도 명시
        대상으로 포함하고 있어 두 plan 의 **스코프가 정확히 일치하지도 않는다**.
    - 이 저장소가 이미 여러 차례 기록한 실패 형태(같은 `durationMs` 계열에서 "자매 트래커
      미동기화가 네 번 반복") 와 같은 클래스다 — 한쪽만 착지하면 다른 트래커의 체크박스가
      영구 미체크로 남거나, 반대로 두 번째 팀이 같은 필드를 다시 손대 중복 작업이 된다.
  - 제안: `eia-terminal-error-sanitize.md` 구현/PR 시 (a) 커밋/체크리스트에
    `spec-sync-external-interaction-api-gaps.md` 의 해당 항목을 명시적으로 참조하고, (b) `message`
    필드에 한해 그 항목을 해소로 표시할지(“DB-write-time sanitize 로 실질 해소, `details` 는
    현재 미사용이라 잔여 없음”) 아니면 fanout 경계 redaction 이 별도로 여전히 필요한지
    (예: 레거시 string 흡수 경로·미래 `details` 사용 대비) 판단해 두 plan 문서를 동시에 갱신할 것.

## 요약

Plan 트리 대부분(§R8 캐시 스코프, terminal payload/emit facade, stalled atomicity, ws-event-types
추출, `eia-db-wire-invariant` 등)은 이미 완료·정합 상태이며 target 문서(`14-external-interaction-api.md`)
의 R8·R17·§6.2~6.5 서술은 관련 plan 의 열린 항목(예: `nodeOutput` 일반 키 allowlist 잔여,
`turnDebug` 이름충돌 회피)과 충돌 없이 정확히 반영돼 있다. 유일하게 실질적인 정합성 문제는
같은 오늘(2026-08-16) 시작된 `eia-terminal-error-sanitize.md` 가 2026-08-14 부터 이미 등재돼
있던 `spec-sync-external-interaction-api-gaps.md` 의 동일 증상 항목을 인지하지 못한 채 별도
메커니즘으로 진행 중이라는 점이다 — 미해결 결정 충돌은 아니지만 "후속 항목 누락/자매 트래커
미동기화" 로 이 저장소가 반복 겪은 실패 형태와 동일하다. 부수적으로
`plan/in-progress/retry-turn-terminal-guard.md` 의 "spec 자기모순 정정"(project-planner 위임)
항목은 target(`spec/5-system/4-execution-engine.md:1549-1550`)에 2026-07-28 자로 이미 철회·정정
서술이 들어가 있음에도 체크박스가 미체크 상태로 남아 있어(INFO), 다음 세션이 이미 끝난 planner
턴을 다시 조사할 위험이 있다.

## 위험도

LOW
