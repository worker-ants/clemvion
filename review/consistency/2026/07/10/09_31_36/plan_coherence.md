# Plan 정합성 검토 결과

## 검토 대상

- diff: `git diff origin/main...HEAD` (실측, 워킹트리 `conversation-thread-secret-hardening-6477bb`)
  - `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — `redactSecrets`(shared SoT `shared/utils/sanitize-error-message.ts`) 재사용 추가, stack-trace/connection-string strip 뒤에 secret 토큰 마스킹 적용
  - `codebase/backend/src/modules/schedules/schedule-runner.service.ts` — `schedule_failed` 알림 `message` 생성 시 `sanitizeErrorMessage()` 적용 (기존에는 미적용이었음 — 신규 import)
  - 대응 unit 테스트 2건 신설/보강
  - `review/code/2026/07/10/09_17_14/**`, `review/code/2026/07/10/09_29_31/**` — 이미 2라운드 `/ai-review` 수행 흔적 (SUMMARY/RESOLUTION 포함)
  - `spec/**` 변경 없음
- target: `spec/data-flow/` (프롬프트 지정 scope) — 이번 diff 는 이 영역을 실제로 건드리지 않음
- plan: `plan/in-progress/**` 전수 스캔 (특히 `spec-sync-data-flow-8-notifications-gaps.md`, `spec-sync-external-interaction-api-gaps.md`, `execution-engine-residual-gaps.md`, `node-output-redesign/**`)

## 배경 확인

이번 변경은 `plan/complete/eia-secret-masking-residuals.md`(2026-07-10 완료, 동일 worktree)의 **P3-8 조사 결과**를 그대로 잇는다. 해당 완료 plan 은 P3-8 을 "중복 아님·dedup 불필요" 로 종결하면서도, 말미에 명시적으로 잔여를 남겼다:

> "(경미: error 알림 경로의 Bearer 토큰 미마스킹 가능성은 pre-existing·별도 backlog 감.)" / "남은 잔여(문서화): ... error-알림 경로 토큰 마스킹(P3-8 경미)."

이번 diff 는 정확히 이 잔여 항목(스케줄 실패 알림 message 의 Bearer 토큰 미마스킹)을 shared `redactSecrets` 재사용으로 닫는다. 완료 plan 이 예고한 후속 작업과 방향이 일치하며, "다른 concern(중복 아님)" 판정과도 모순되지 않는다 — 모듈을 병합한 것이 아니라 shared 패턴셋만 조합했다.

## 발견사항

- **[INFO]** 완료 plan 의 잔여 노트가 갱신되지 않음
  - target 위치: (해당 없음 — spec 변경 없음)
  - 관련 plan: `plan/complete/eia-secret-masking-residuals.md` §"남은 잔여(문서화)" — "error-알림 경로 토큰 마스킹(P3-8 경미)"
  - 상세: 본 diff 가 이 잔여 항목을 실제로 해소했지만, 해당 문서는 `plan/complete/` 로 이미 이동되어 있고 이번 세션에서 그 잔여 노트가 "해소됨"으로 갱신되지 않았다. `plan/in-progress/**` 범위 밖이라 CRITICAL/WARNING 대상은 아니지만, 완료 plan 의 잔여 추적이 stale 해질 소지가 있다.
  - 제안: (선택) `plan/complete/eia-secret-masking-residuals.md` 의 해당 줄에 "→ 해소(schedule-runner sanitizeErrorMessage 적용, <커밋/PR>)" 주석을 덧붙이거나, 신규 초소형 plan 없이 커밋 메시지·PR 설명에 P3-8 잔여 해소를 명시. Plan 문서 자체를 재오픈할 필요는 없음(작업 범위가 이미 좁고 완결적).

- **[INFO]** target(spec/data-flow/) 무변경은 정합함
  - target 위치: `spec/data-flow/8-notifications.md` §2 (`schedule_failed`/`execution_failed` 행)
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` (PR3 `schedule_failed`/`execution_failed` 발사 완료로 기표)
  - 상세: 이 spec 행들은 알림의 *발사 조건·수신자·채널·resource_id 딥링크 계약* 을 SoT 로 삼고, `message` 문자열의 내용 새니타이징 여부는 다루지 않는다. 이번 diff 는 메시지 "형태"가 아니라 "내용 방어" 만 강화하므로 스키마/흐름 표를 갱신할 의무가 없다고 판단된다 — spec 갱신 누락이 아님.

`plan/in-progress/**` 전수를 대상으로 (1) 미해결 결정과의 충돌, (2) 선행 plan 미해소 가정, (3) 후속 항목 누락을 점검했으나 위 두 건 외에는 발견사항이 없다. `spec-sync-external-interaction-api-gaps.md`(EIA 잔여), `execution-engine-residual-gaps.md`, `node-output-redesign/**`(secret/redact/mask 관련 각 노드 spec 잔여) 어디에도 이번 diff 의 대상(스케줄 실패 알림 message 새니타이징)과 충돌하거나 이를 전제로 하는 미해결 항목이 없다.

## 요약

이번 diff 는 `plan/complete/eia-secret-masking-residuals.md` 가 P3-8 조사에서 명시적으로 남긴 "error 알림 경로 Bearer 토큰 미마스킹" 잔여를 그대로 좁게 닫는 후속 작업이며, `plan/in-progress/**` 의 어떤 미해결 결정과도 충돌하지 않고 어떤 선행 조건도 가정하지 않는다. target scope(`spec/data-flow/`)는 실제로 변경되지 않았고, 이는 메시지 내용 방어(defense-in-depth)일 뿐 데이터 흐름 스키마·발사 계약을 바꾸지 않으므로 spec 갱신 누락도 아니다. 유일한 관찰은 완료된 plan 문서의 잔여 노트가 이번 해소를 반영하도록 갱신하면 추적성이 더 좋아진다는 INFO 수준 제안뿐이다.

## 위험도

NONE
