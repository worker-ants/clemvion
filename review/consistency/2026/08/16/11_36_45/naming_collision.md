# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

`git diff origin/main..HEAD --stat -- spec/` 결과 **`spec/5-system/` 를 포함해 `spec/` 하위 파일은
이번 diff 에서 전혀 변경되지 않았다.** 프롬프트에 번들된 `spec/5-system/*.md` 전문은 리뷰어가
맥락을 파악하기 위한 **배경 참조**일 뿐, target 이 실제로 도입한 변경분이 아니다.

실제 변경 파일(`git log origin/main..HEAD` 6 커밋, `git diff --stat`):

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` (+91)
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` (신규 테스트 스위트 +98)
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (docstring 정정만, 로직 무변경)
- `CHANGELOG.md`, `plan/in-progress/eia-terminal-error-sanitize.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (문서·plan)
- `review/**` (리뷰 산출물)

즉 target 은 EIA 종결 이벤트(`execution.failed` 등)의 `error.message`/`error.details` 를
egress 시점에 `deepRedactSecrets` 로 마스킹하는 **내부 구현 하드닝**이며, spec 신규 조항·API
표면·이벤트명·ENV var·파일 경로를 새로 도입하지 않는다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 신규 ID 부여 없음 (spec 미변경).
2. **엔티티/타입명 충돌** — diff 에서 유일하게 새로 추가된 식별자는 module-private 함수
   `redactTerminalError` (`terminal-error-payload.ts:107`, `export` 되지 않음). 코드베이스 전체
   grep(`grep -rn "redactTerminalError\b" codebase/`) 결과 정의 1곳 + 같은 파일 내 호출 4곳뿐이며
   타 모듈에 동명 식별자 없음 — 충돌 없음. 재사용된 `deepRedactSecrets` 는 `sanitize-error-message.ts:127`
   에 **origin/main 시점에 이미 존재**하던 함수(diff 로 신규 도입된 게 아님, `git show origin/main:...`
   로 확인) — 신규 식별자가 아니므로 충돌 검토 대상이 아니다.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음. Controller/`@Post`/`@Get` 등 데코레이터 추가
   흔적 없음 (diff 전체 grep 결과 0건).
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음. 기존 `execution.failed` 등
   종결 이벤트의 payload **값**(마스킹)만 바뀌고 이벤트명·필드 키는 무변경.
5. **환경변수·설정키 충돌** — 신규 `process.env.*` 참조 없음 (diff 전체 grep 결과 0건).
6. **파일 경로 충돌** — 신규 spec 파일 없음. `terminal-error-payload.spec.ts` 는 기존 파일 확장.

## 발견사항

없음 — target 은 spec 을 변경하지 않고, 코드 레벨에서도 module-private 함수 1개(`redactTerminalError`)
만 신규 추가했으며 이는 코드베이스 전역에서 유일한 정의로 명명 충돌이 없다. 기존 식별자
(`deepRedactSecrets`, `sanitizeErrorMessage`, `stripAndRedact`, `sanitizePayloadForWs`)는 모두
재사용이며, 이번 diff 의 docstring 들이 이 자매 유틸 간 책임 경계(알림 경로 vs egress 초크포인트)를
오히려 명시적으로 구분해 혼동 위험을 낮췄다.

## 요약

이번 target 변경은 `spec/5-system/` 을 전혀 건드리지 않는 순수 구현 하드닝(EIA 종결 이벤트
`error` 필드의 egress 마스킹)이며, 새로 도입한 식별자는 module-private 함수
`redactTerminalError` 하나뿐이다. 전역 grep 으로 유일 정의임을 확인했고, 재사용한
`deepRedactSecrets` 는 이미 존재하던 함수라 신규 식별자 충돌 표면 자체가 발생하지 않는다.
요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·파일 경로 어느 관점에서도 충돌 신호가
없다.

## 위험도

NONE
