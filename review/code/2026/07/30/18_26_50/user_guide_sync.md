STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# User Guide Sync Review — codebase/backend/src/modules/execution-engine/{engine-driver.interface.ts, retry-turn.service.ts, state/state-machine.ts}

## 컨텍스트 확인

- `.claude/config/doc-sync-matrix.json` (rows[], 20건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(116~144행) 을 SSOT 로 적재.
- 리뷰 대상 3파일은 `git diff --name-only main...HEAD` 기준 브랜치 전체 diff 의 부분집합이며, 전체 diff 에는 다음도 포함된다: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`, `run-results.en.mdx` (+ spec 3건, plan 3건). 즉 이 reviewer 프롬프트의 "리뷰 대상 파일" 목록에는 doc MDX 가 빠져 있지만, 실제 변경 set 에는 포함돼 있어 `git diff`/`Read` 로 직접 대조했다.
- 이번 라운드(18:26:50, HEAD=`0f0bdabe8`)의 정확한 델타는 직전 리뷰 라운드 시점 커밋(`3c306d593`, 10R)과의 diff 로 확인: `engine-driver.interface.ts`(JSDoc 7줄 추가) + `run-results.mdx`(1줄) + `run-results.en.mdx`(4줄) + plan 문서. `retry-turn.service.ts`/`state-machine.ts` 는 이번 델타에 코드 변경이 없고(8R~9R 에서 이미 반영, 이번엔 연관 컨텍스트로만 제공됨).

## 매트릭스 매칭

- `run-debug-flow-change`(실행·디버깅 흐름 변경, semantic) — 매칭. `execution-engine` 의 `retry_last_turn` 재진입(`FAILED→RUNNING`/`FAILED→WAITING_FOR_INPUT`) 결함 수정은 실행·디버깅 흐름 변경에 해당하며, targets = `codebase/frontend/src/content/docs/05-run-and-debug/`.
- 그 외 trigger 없음: 노드 추가/schema(`backend/src/nodes/**` 미해당), TSX 신규 문자열(0건), 통합/제공자(해당 없음), 신규 섹션 디렉토리(해당 없음), auth 흐름(`modules/auth/**` 미해당), 표현식 언어(`packages/expression-engine/**` 미해당), 신규 warning/errorCode(`error-codes.ts`/warningRules 미변경 — `RetryLastTurnError` 는 `workflow-errors.ts` 소속이며 이번 diff 밖), cross-cutting enum(ALLOWED_TRANSITIONS 는 `interaction-type-registry.md` 대상 enum 이 아니라 `ExecutionStatus` 상태전이 규칙 — 해당 없음).

## 동반 갱신 검증 (run-debug-flow-change)

`codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`(97~116행) · `run-results.en.mdx`(90~106행) 를 직접 Read 해 대조했다.

- **KO/EN 구조 일치 확인**: "재시도 가능/불가" 2-bullet → "재시도가 성공했을 때 보이는 화면은 두 가지" → "대화가 끝난 경우/계속되는 경우" 2-bullet → "60분 이내 한 번" 문단 → "대화가 끝난 경우, 하류 노드 실행" 문단. EN 도 동일 순서(Retryable/Not retryable → "ends in one of two ways" → 2-bullet → "once within 60 minutes" → "Once the conversation is finished, downstream..."). 이전 라운드(10R)에서 EN 의 "Not retryable" bullet 이 두 리스트 사이에 끼어 있던 결함과, KO/EN 양쪽의 마지막 문단이 "재시도가 성공하면(무조건)" 으로 서술돼 재파킹(WAITING_FOR_INPUT) 케이스에서는 하류가 실행되지 않는데도 무조건 실행되는 것처럼 읽히던 결함이, 이번 HEAD 커밋(`0f0bdabe8`, "11R 수렴")에서 함께 수정됨을 `git diff 3c306d593 0f0bdabe8 -- run-results.mdx run-results.en.mdx` 로 직접 확인했다.
- **코드-문서 일치 확인**: `state-machine.ts` 의 `allowRetryReentry` opt-in 이 허용하는 두 목적지(`FAILED→RUNNING`, `FAILED→WAITING_FOR_INPUT`) 가 문서의 "대화가 끝난 경우(다음 노드로 이어짐)" / "대화가 계속되는 경우(입력 대기로 복귀)" 두 시나리오와 정확히 대응한다. `retry-turn.service.ts` 의 `applyRetryLastTurn`(PARK_RELEASED 분기 vs 정상 종료 후 `resumeGraphAfterRetry`) 도 동일하게 대응.
- **에러 코드 표 확인**: `run-results.mdx` 179~190행 FieldTable 에 `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY` 가 이미 등재돼 있고, 이 코드들은 `workflow-errors.ts`(이번 diff 밖, `RetryLastTurnError` 정의처) 소속이라 이번 변경으로 신규 발행된 코드가 아니다 — `backend-labels.ts` WARNING_KO/ERROR_KO 매핑 의무 트리거 없음.
- 이 외 `codebase/frontend/src/content/docs/02-nodes/ai.mdx`, `05-run-and-debug/error-handling.mdx` 등에 등장하는 "재시도" 언급은 스키마 검증 재시도·per-node Retry 정책 등 **별개의 재시도 메커니즘**이라 이번 PR 과 무관함을 grep 으로 확인.

## 발견사항

없음. 매칭된 유일한 trigger(`run-debug-flow-change`)의 필수 동반 갱신(`05-run-and-debug/run-results.{mdx,en.mdx}`)이 같은 브랜치의 선행 라운드(8R~11R)에서 이미 작성됐고, 이번 HEAD 커밋이 직전 라운드에서 발견된 KO/EN 구조·조건문 결함(10R 회귀)을 정확히 수정했음을 실측으로 확인했다. i18n dict(`{ko,en}/*.ts`)·`backend-labels.ts`·신규 섹션 디렉토리·auth 가이드 등 다른 8개 점검 관점은 트리거 자체가 없어 검토 대상이 아니다.

## 요약

매트릭스 20개 행 중 시맨틱 매칭 1건(`run-debug-flow-change`, 실행·디버깅 흐름 변경) 발견, 나머지 19건은 미매칭(노드/TSX/auth/표현식/신규 코드 등 무관). 매칭된 1건의 필수 동반 갱신(`05-run-and-debug/run-results.mdx` + `.en.mdx`)은 같은 브랜치 안에서 이미 반영·검증됐으며, 직전 라운드가 지적했을 법한 KO/EN 리스트 순서·조건문 결함도 이번 HEAD 커밋에서 해소됨을 diff 로 직접 확인했다. 누락 0건.

## 위험도

NONE
