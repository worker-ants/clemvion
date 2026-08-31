# 요구사항(Requirement) Review — 엔진 에러 코드 `EngineErrorCode` 앵커링 (3라운드)

## 검증 방법

`Read`로 전체 파일을 직접 열어 diff 컨텍스트를 대조하고(`error-codes.ts` 전체,
`engine-error-code-anchor-guard.ts` 전체 — 프롬프트에서 diff 가 생략된 파일), 아래는 모두
**read-only**(저장소 트리에 아무것도 쓰지 않음, `git status --short` 로 시작·종료 시 확인):

- `npx jest engine-error-code-anchor.spec.ts` → **14/14 통과**
- `npx eslint` (`error-codes.ts` + guard 3파일, `--max-warnings 0`) → 클린
- `npx tsc --noEmit`(backend 전체) → 변경 대상 파일(`error-codes.ts`·`ai-turn-orchestrator.service.ts`·
  `execution-engine.service.ts`·`shutdown-state.service.ts`·guard 3파일)에 에러 0. 프로젝트 전체에
  기존 199개 무관 tsc 에러(주요 노드 spec 파일들의 pre-existing 타입 불일치)가 있으나 이번 diff 의
  회귀가 아님을 파일명 필터로 확인
- `grep` 으로 `execution-engine` 모듈 전체를 스캔해 `EngineErrorCode` 4개 리다이렉트 지점 외 잔존
  맨 문자열이 없음을 확인, `ANCHORED_ELSEWHERE` 8개 항목(`INVALID_EXECUTION_STATE`·
  `ERROR_PORT_FALLBACK`·trigger 4종·`RESUME_CHECKPOINT_MISSING`·`RESUME_INCOMPATIBLE_STATE`)이
  실제로 각각 클래스 필드/유니온 타입/생성자 positional 인자로 앵커돼 있음을 소스에서 직접 확인
- `spec/conventions/error-codes.md` §3, `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`,
  `spec/5-system/14-external-interaction-api.md`, `spec/5-system/3-error-handling.md`,
  `spec/data-flow/3-execution.md` 전수 grep 하여 4개 신규 상수 값(`EXECUTION_QUEUE_WAIT_TIMEOUT`·
  `WORKER_HEARTBEAT_TIMEOUT`·`SERVER_INTERRUPTED`·`WEBCHAT_IDLE_TIMEOUT`)의 문자열·상태 전이
  (`cancelled` vs `failed`)가 spec 서술과 line-level 로 일치함을 확인

## 발견사항

없음 (CRITICAL/WARNING 없음). 이전 라운드에서 지적된 항목은 실측상 이미 해소돼 있다:

- **[SPEC-DRIFT 아님 — 확인용 기록]** 이전 라운드(`20_43_35` W1)가 지적한 "가드가 생성자
  positional 인자 형태(`RehydrationError('RESUME_CHECKPOINT_MISSING', …)`)를 스캔하지 않는다"는
  갭은 이번 코드에서 실제로 해소됐다. `collectBoundCodes`(`engine-error-code-anchor-guard.ts:197-210`)에
  `ts.isNewExpression` 분기가 추가돼 `XxxError` 로 끝나는 생성자의 문자열 인자를 스캔하고,
  `ANCHORED_ELSEWHERE`(`engine-error-code-anchor-guard.ts:49-52`)에 `RESUME_CHECKPOINT_MISSING`·
  `RESUME_INCOMPATIBLE_STATE` 가 사유와 함께 등재됐다. 픽스처(`FIXTURE_CTOR_ARG_FORM`)와
  spec(`it.each` 5번째 케이스)이 이 형태를 커버함을 확인했다 — 위치:
  `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-fixture.ts:32-41`,
  `engine-error-code-anchor.spec.ts:81-84`.
  - 잔여 경계(의도적, 문서화됨): "일반 메서드 인자로 코드를 넘기는 형태"(예:
    `markExecutionCancelled(executionId, 'RESUME_FAILED')`)는 여전히 스캔 밖이다
    (`engine-error-code-anchor-guard.ts:137-152` 에 경계와 이유 명시). 실측으로 확인한 근거가
    유효하다 — `markExecutionCancelled` 의 두 번째 파라미터는
    `'RESUME_CHECKPOINT_MISSING' | 'RESUME_FAILED' | 'RESUME_INCOMPATIBLE_STATE'` 리터럴 유니온
    (`execution-engine.service.ts:2798-2801`)이라 오탈자는 `tsc` 가 잡는다. 이 경계는 이미
    reviewer 스스로 형태 공간이 무한히 열려 있다는 근거로 명시적으로 멈춘 지점이라 재지적하지
    않는다.

## 기능 완전성 · spec fidelity 확인

- 9개 리다이렉트 지점(ai-turn-orchestrator 4 + execution-engine 3 + shutdown-state 2) 전수 확인 —
  값 치환은 100% 동일 문자열이며 동작 변경 없음.
- `EngineErrorCode` 4개 값·JSDoc 이 `spec/conventions/error-codes.md §3`(`WORKER_HEARTBEAT_TIMEOUT`
  historical-artifact 행), `spec/5-system/4-execution-engine.md §7.1/§8/§11`,
  `spec/5-system/14-external-interaction-api.md`(EIA-RL-07, §6 durationMs), `spec/1-data-model.md`
  error 필드 서술과 line-level 로 일치.
- `WEBCHAT_IDLE_TIMEOUT` → `cancelled`(not `failed`), `WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`
  → `failed` 라는 JSDoc 의 상태 전이 서술이 실제 `ExecutionStatus.CANCELLED`/`FAILED` 코드와 일치함을
  `markWebChatIdleTimeout`/`finalizeStalledExhausted`/`shutdown-state.service.ts` 각각에서 직접 대조.
- `ANCHORED_ELSEWHERE` 8개 항목 전부가 실제로 (a) 그 값을 붙잡는 타입이 소스에 존재하고 (b)
  `collectBoundCodes` 로 여전히 수집되는 활성 값임을 확인(`가드 spec` "예외 목록이 죽은 항목을
  쌓지 않는다" 테스트가 이를 자동 검증, GREEN).
- TODO/FIXME/HACK/XXX 마커 없음(스캔 결과 1건은 "TODO 같은 알리바이를 막는다"는 설명 주석 내
  언급일 뿐, 미완성 표식이 아님).
- 모든 함수(`readDeclaredCodes`/`collectBoundCodes`/`findUnanchored`)가 모든 입력 경로(빈 디렉터리,
  파서 실패로 빈 `declared` 등)에서 일관된 타입의 값을 반환하며, 공허(vacuous) 통과를 막는 설계
  (형태 커버리지는 불변 픽스처, positive-path 검출 테스트 별도)가 실제로 동작함을 jest 실행으로 확인.

## 요약

3라운드 누적 수정 결과, 엔진 레벨 에러 코드 9지점의 맨 문자열 → 상수 리다이렉트와 신규
`EngineErrorCode`/AST 앵커 가드는 기능적으로 완결돼 있다. 이전 라운드(`20_43_35`)가 지적한 유일한
WARNING(생성자 positional 인자 스캔 누락)은 스캔 범위를 5형태로 넓히고 관련 두 값을
`ANCHORED_ELSEWHERE` 에 등재하는 방식으로 실측 검증 가능하게 해소됐다. spec 본문(4개 문서)과
line-level 로 대조한 결과 코드 값·상태 전이·SoT 링크가 전부 일치하며, TODO/FIXME 잔존이나 미반환
경로, 검증되지 않은 엣지 케이스는 발견되지 않았다.

## 위험도
NONE
