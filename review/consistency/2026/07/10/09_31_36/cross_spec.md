# Cross-Spec 일관성 검토 — conversation-thread-secret-hardening

## 검토 범위 정정 (중요)

`_prompts/cross_spec.md` 에 임베드된 "target 문서" 는 `spec/data-flow/` 전체(0-overview.md·1-audit.md 등)를 통째로
붙여넣은 고정 템플릿이며, 실제 diff 와 무관하다. 실제 변경은 `git diff origin/main...HEAD` 로 확인했다:

- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — 기존 stack-trace/connection-string
  strip 에 더해 shared SoT `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `redactSecrets`
  (`SECRET_LEAK_PATTERNS`) 를 재사용해 secret 토큰 마스킹을 추가.
- `codebase/backend/src/modules/schedules/schedule-runner.service.ts` — `dispatchScheduleFailedNotification` 의
  `schedule_failed` 알림 메시지 조립에 `sanitizeErrorMessage()` 적용 (기존에는 raw `message` 를 그대로 이어붙임).
- 나머지 변경은 대응 `*.spec.ts` 테스트와 `review/code/2026/07/10/{09_17_14,09_29_31}/` 산출물(이미 완료된 `/ai-review`
  라운드 + WARNING 1건 fix 처분)이며 spec 영향 없음.

이 변경은 **behavior 확장이 아니라 defense-in-depth 하드닝**이다 — 사용자向 알림/이메일 메시지에서 secret-shaped
토큰을 한 겹 더 마스킹할 뿐, 엔티티·API·상태 전이·권한 모델·계층 책임 중 어느 것도 바꾸지 않는다. 이하 6개 관점을
차례로 점검했다.

## 검토 관점별 확인

1. **데이터 모델 충돌** — 신규/변경 엔티티·컬럼 없음(`notification.message` 컬럼의 *내용*만 마스킹, 스키마 불변). 해당 없음.
2. **API 계약 충돌** — 신규/변경 endpoint 없음. `schedule_failed` 알림의 `resource_type`/`resource_id`/딥링크 계약
   (`spec/2-navigation/_layout.md §3.1`, `spec/data-flow/8-notifications.md` `schedule_failed` row)은 그대로 유지된다
   (`message` 필드의 *문자열 내용*만 영향받고 필드 shape 은 불변). 해당 없음.
3. **요구사항 ID 충돌** — 코드 주석이 "EIA §R17 잔여 하드닝" 을 인용한다. `spec/5-system/14-external-interaction-api.md`
   §Rationale R17 은 실제로 `shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`
   을 공유 SoT 로 재사용하는 동일 패턴(conversationThread/ai_message egress 마스킹)을 다루므로 인용은 취지상 정합
   — R17 이 스케줄 알림을 직접 언급하진 않지만 "공유 SoT 를 새 소비처가 재사용" 이라는 동일 원칙의 연장이라 ID
   충돌·오용은 아니다. 해당 없음(문제 아님).
4. **상태 전이 충돌** — `notification`/`schedule`/`execution` 어느 엔티티의 상태 머신도 변경되지 않음. 해당 없음.
5. **권한·RBAC 모델 충돌** — 권한 체크 경로 변경 없음. 해당 없음.
6. **계층 책임 충돌** — `sanitizeErrorMessage`(execution-engine 소유) 가 shared `redactSecrets`(SoT, `shared/utils/`)
   를 재사용하는 구조는 이미 `spec/2-navigation/4-integration.md`(HMAC 진단 로그) · `spec/5-system/11-mcp-client.md`
   (MCP 에러 메시지) · `spec/5-system/14-external-interaction-api.md` R17(conversationThread/ai_message egress) 3곳에서
   확립된 "새 소비처는 공유 SoT 패턴만 재사용, 별도 redaction 로직 신설 금지" 원칙과 **일치**한다. `schedule-runner.service.ts`
   가 `execution-engine/sanitize-error-message` 를 import 하는 것도 기존에 `background-execution.processor.ts` ·
   `execution-engine.service.ts` 가 동일 함수를 쓰던 패턴의 3번째 소비처일 뿐이라 계층 경계 위반이 아니다
   (schedules → execution-engine 방향 import 는 `spec/data-flow/10-triggers.md` 가 이미 명시한
   `ScheduleRunnerService.process()` → `ExecutionEngineService` 의존 방향과 동일선상).

## 발견사항

- **[INFO]** `schedule_failed` 알림의 메시지 새니타이징이 domain data-flow 문서에 미기재
  - target 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.ts` (`dispatchScheduleFailedNotification`)
  - 충돌 대상: `spec/data-flow/3-execution.md:143` (`background_failed` 행 — "`dispatchFailureNotification` — sanitize 된
    error message 포함" 이라고 명시) vs. `spec/data-flow/10-triggers.md` §1.3/§1.4 (`schedule_failed` 발사 경로에는
    동급의 "sanitize 된 error message" 언급이 없음)
  - 상세: 세 실패 알림(`execution_failed`/`background_failed`/`schedule_failed`) 모두 이제 `sanitizeErrorMessage()` 를
    거치는 동일 계약이 됐다(`execution-engine.service.ts:4533`, `background-execution.processor.ts:72`,
    `schedule-runner.service.ts` 신규). 그러나 `spec/data-flow/3-execution.md` 는 `background_failed` 경로에만 "sanitize
    된 error message 포함" 을 명문화했고, `execution_failed`(같은 파일 §1.x 어디에도 없음)와 `schedule_failed`
    (`10-triggers.md`)는 이 사실이 spec 문면에 없다. 이는 코드와 모순되는 것은 아니고(spec 이 뭔가를 "하지 않는다"고
    주장하지 않으므로 CRITICAL/WARNING 대상 아님), 세 경로의 새 parity 를 문서에도 반영해두면 향후 회귀(예: 한
    경로만 sanitize 가 빠지는 변경)를 spec 리뷰에서 잡기 쉬워진다.
  - 제안: `spec/data-flow/10-triggers.md` §1.3 또는 `spec/data-flow/8-notifications.md` 의 `schedule_failed` row 에
    "메시지는 `sanitizeErrorMessage()`(execution_failed/background_failed 와 동일 SoT)로 새니타이즈됨" 한 줄을 추가.
    (선택 사항 — `project-planner` 후속 spec 동기화 대상이지 이번 구현 PR 을 막을 사유는 아님.)

## 요약

이번 변경은 `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` 와
`codebase/backend/src/modules/schedules/schedule-runner.service.ts` 두 파일에 한정된 secret 마스킹 defense-in-depth
추가로, 새 엔티티·API·요구사항 ID·상태 전이·RBAC 을 도입하지 않으며 계층 책임(shared SoT 재사용 원칙)도 기존에
`spec/2-navigation/4-integration.md`·`spec/5-system/11-mcp-client.md`·`spec/5-system/14-external-interaction-api.md`
R17 이 확립한 패턴과 정합한다. 유일한 관찰 사항은 `spec/data-flow/10-triggers.md`(및 `8-notifications.md`)가
`schedule_failed` 알림의 새 sanitize 계약을 아직 명문화하지 않은 INFO 급 문서 gap 이며, cross-spec 모순은 아니다.

## 위험도

NONE
