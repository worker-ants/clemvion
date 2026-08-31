# 요구사항(Requirement) 충족 리뷰 — 엔진 에러 코드 앵커링(error-codes-layer-split)

## 검증 방법

정적 판독 외에 다음을 실제로 실행해 확인했다 (저장소 뮤테이션 없음 — `git status --short` 최종 확인 결과 리뷰 산출물 디렉터리만 untracked, 소스 변경 없음):

- `npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` → **11/11 PASS**
- `npx jest ai-turn-orchestrator.service.spec.ts execution-engine.service.spec.ts shutdown-state.service.spec.ts engine-error-code-anchor.spec.ts` → **4 suites / 568 tests 전부 PASS**
- `npx tsc --noEmit` (diff 대상 7파일만 필터) → **0 에러** (전체 실행 시 나오는 `carousel/chart/table *.spec.ts`, `ai-turn-orchestrator.service.spec.ts` 에러는 `git show HEAD~1:...` 대조로 **이번 diff 이전부터 있던 무관 에러**임을 확인)
- `npx eslint` (diff 대상 7파일) → 0 errors, 1 warning(아래 INFO #1)
- `grep -rn` 으로 `ENGINE_DIR`(및 저장소 전체) 안에 `'EXECUTION_QUEUE_WAIT_TIMEOUT'|'WEBCHAT_IDLE_TIMEOUT'|'WORKER_HEARTBEAT_TIMEOUT'|'SERVER_INTERRUPTED'` 맨 문자열 잔존 여부 확인 → 실제 코드(바인딩)에는 **잔존 없음**, JSDoc 주석 안의 예시 인용뿐
- `ANCHORED_ELSEWHERE` 6개 항목의 실제 소스 위치(`workflow-errors.ts`·`execution-engine.service.ts`·`trigger-parameter.types.ts`)를 `grep` 으로 직접 대조 → 서술과 **일치**

## 발견사항

- **[INFO]** `engine-error-code-anchor-fixture.ts` 상단의 `/* eslint-disable @typescript-eslint/no-unused-vars */` 가 실제로는 불필요한 지시어다 (eslint 가 "Unused eslint-disable directive" 경고).
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-fixture.ts:15`
  - 상세: 파일 하단에서 `export { objectForm, code, FixtureError, target, notACode, otherName };` 로 전부 export 하므로 `no-unused-vars` 위반 자체가 애초에 발생하지 않는다. 기능에는 영향 없는 lint 청결도 문제.
  - 제안: disable 지시어 제거(또는 `eslint --fix`).

- **[INFO]** `EngineErrorCode` 신설의 경계 규칙("노드 핸들러가 아니라 엔진 자신이 `Execution.error`/`NodeExecution.error` 에 싣는 값")이 파일 전체에 소급 적용되지 않는다 — `EXECUTION_TIME_LIMIT_EXCEEDED`·`EXECUTION_QUEUE_WAIT_TIMEOUT` 의 자매인 `USER_CANCELLED`/`INTERACTION_TIMEOUT`/`RETRY_STATE_NOT_FOUND` 등도 개념상 "엔진이 싣는 값"에 해당하지만 여전히 `ErrorCode` 에 남아 있다.
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `ErrorCode` 객체 리터럴 내 `EXECUTION_TIME_LIMIT_EXCEEDED`(67~73행) 등
  - 상세: 다만 이는 **의도적으로 문서화된 스코프 축소**다 — `plan/complete/exec-intake-followups.md` 의 완료 기록이 "① '노드 핸들러 코드와 혼재'는 과장이었다"·"9지점만 리다이렉트했다"를 명시적으로 밝히고 있어, 발견되지 않은 결함이 아니라 알려진 채로 남긴 경계다. 향후 신규 엔진 코드 추가 시 `ErrorCode`/`EngineErrorCode` 중 어디에 넣을지 판단 기준이 신구 코드 사이에서 갈릴 여지는 있다.
  - 제안: 조치 불요(문서화된 트레이드오프). 후속에서 `EngineErrorCode` 확장 시 이 경계 판단 기준을 JSDoc에 한 줄 보강하면 좋다.

- **[INFO]** spec fidelity — 관련 spec 은 `spec/conventions/error-codes.md`(§3 historical-artifact 레지스트리, `WORKER_HEARTBEAT_TIMEOUT` 행) · `spec/5-system/3-error-handling.md`(§1.4/§1.5, `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`/`SERVER_INTERRUPTED` 값 인용) · `spec/5-system/4-execution-engine.md`(§7/§8/§11) 세 문서다. 이번 변경은 **문자열 값을 전혀 바꾸지 않는** 내부 리다이렉트(코드→상수 참조)이므로 이 spec 문서들의 어떤 행도 갱신이 필요하지 않다 — 실제로 각 신규 상수 값(`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`/`WEBCHAT_IDLE_TIMEOUT`)이 원래 리터럴과 byte-identical 함을 diff 로 확인했다. `spec_impact: none` (plan frontmatter)이 정확하다.

## 요약

`ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`shutdown-state.service.ts` 세 곳의 엔진 레벨 에러 코드 맨 문자열 9지점(4개 코드: `EXECUTION_QUEUE_WAIT_TIMEOUT`·`WORKER_HEARTBEAT_TIMEOUT`·`SERVER_INTERRUPTED`×2·`WEBCHAT_IDLE_TIMEOUT` + 이미 `ErrorCode` 에 있던 `LLM_RATE_LIMIT`/`LLM_CALL_FAILED`×3)를 신설 `EngineErrorCode`/`ErrorCode` 상수 참조로 교체했다. 모든 치환이 원래 문자열 값을 그대로 보존해(rename 없음) 런타임 동작·DB 영속값·spec 이 서술하는 계약을 전혀 바꾸지 않았고, 회귀 방지용 AST 기반 가드(`engine-error-code-anchor-guard.ts` + spec + 픽스처)가 향후 같은 유형의 맨 문자열 재발을 검증 가능한 형태로 차단한다. `ANCHORED_ELSEWHERE` 예외 목록(6건)의 각 근거를 소스에서 직접 대조해 모두 사실과 일치함을 확인했다. 실제로 가드 테스트(11/11)·영향받는 3개 서비스 spec(568/568)·`tsc`·`eslint` 를 전부 실행해 GREEN 을 확인했으며, 저장소에 잔존하는 맨 문자열 사이트가 없음을 grep 으로 재확인했다. TODO/FIXME/HACK 마커 없음, 반환값·에러 시나리오·엣지 케이스 모두 기존 동작을 그대로 보존하는 순수 리팩터로 기능적 결함을 찾지 못했다. 발견된 3건은 모두 INFO 수준(lint 청결도 1건, 문서화된 스코프 경계 1건, spec 정합성 확인 1건)이며 코드 fix 나 spec 갱신을 요구하지 않는다.

## 위험도

NONE
