# 요구사항(Requirement) 충족 리뷰 — 엔진 에러 코드 앵커링 (`error-codes-layer-split`, 5라운드)

## 컨텍스트

이번 diff(`origin/main` 대비, HEAD `e6f2b5c8c`)는 본 구현(`adc4a3ff6`) + 4라운드분 fix/문서
커밋(`4141c64e3`/`eb65d3e6d`/`18062a61a`/`e6f2b5c8c`)의 누적이며, 이전 4라운드 `/ai-review`
(7-forced-reviewer, `review/code/2026/08/31/{20_27_29,20_43_35,20_59_14,21_12_31}/`)에서 매번
**Critical 0**으로 수렴했다. 본 라운드는 그 누적 상태에 대한 5번째(독립 재검증) 패스로,
prior 라운드 리포트를 신뢰하지 않고 실제 소스·spec·테스트를 직접 대조했다.

## 검증 방법 (실제 실행, 저장소 뮤테이션 없음)

- `git log --oneline -10` / `git status --short` — HEAD `e6f2b5c8c`, 이번 세션 산출 디렉터리
  외 저장소 변경 없음(clean).
- `codebase/backend/src/nodes/core/error-codes.ts` 전문을 `Read`로 직접 열어 `EngineErrorCode`
  4개 값·JSDoc 서술 전체 확인.
- `engine-error-code-anchor-guard.ts`/`engine-error-code-anchor.spec.ts` 전문(프롬프트에서
  생략된 두 파일)을 `Read`로 직접 열어 5-form AST 수집 로직·`ANCHORED_ELSEWHERE`·테스트
  단언 전체를 확인.
- `npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts src/nodes/core/error-codes.spec.ts`
  → **32/32 PASS**.
- `npx tsc --noEmit -p .` (변경 파일 필터) → 관련 에러 0건.
- `ANCHORED_ELSEWHERE` 6개 항목의 실제 앵커 위치를 grep+Read로 직접 대조:
  - `InvalidExecutionStateError.code`(`workflow-errors.ts:114`), `ErrorPortFallbackError.code`
    (`execution-engine.service.ts:315`) — 클래스 `readonly` 필드 확인.
  - `trigger-parameter.types.ts:26-72` — `TriggerParameterErrorDetail['code']` 유니온 +
    `REASON_TO_DETAIL` 맵의 `code: 'MISSING_REQUIRED_FIELD'` 등 4개 property-assignment 형태
    (가드가 실제로 히트시키고 `ANCHORED_ELSEWHERE`가 필터링하는 형태임을 코드 레벨로 확인).
  - `ai-conversation-helpers.ts:38-47` `RehydrationError` 생성자 파라미터가 리터럴 유니온
    (`'RESUME_CHECKPOINT_MISSING' | 'RESUME_FAILED' | 'RESUME_INCOMPATIBLE_STATE'`)임을 확인.
  - `execution-engine.service.ts:2796-2801` `markExecutionCancelled(executionId, code: 'RESUME_CHECKPOINT_MISSING' | 'RESUME_FAILED' | 'RESUME_INCOMPATIBLE_STATE')` —
    `RESUME_FAILED`가 일반 메서드 인자(리터럴 유니온 파라미터)로만 쓰여 가드 5형태 밖이고
    타입이 오탈자를 잡는다는 JSDoc/가드 주석의 주장을 소스 레벨로 확인.
- spec fidelity 라인 대조:
  - `spec/conventions/error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행 — "PR4 재정의 발효" 서술이
    `error-codes.ts` JSDoc의 "2026-07-04 부터 의미가 재정의됐고 코드명은 유지"와 일치. §3은
    **이름이 부정확한** 코드만 등록하는 레지스트리이므로 `EXECUTION_QUEUE_WAIT_TIMEOUT`/
    `WEBCHAT_IDLE_TIMEOUT`/`SERVER_INTERRUPTED`(이름이 의미와 정확히 부합)가 등재되지 않은 것도
    설계와 일치 — 누락이 아님.
  - `spec/5-system/3-error-handling.md:140,142` — `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`
    이 `cancelled`(not `failed`)로 귀결한다는 서술이 JSDoc과 line-level 일치.
  - `spec/5-system/14-external-interaction-api.md:594`(§6, "API 명세 — Outbound Notification"
    섹션 안, 헤더 라인 573과 대조해 확인) — "`markQueueWaitTimeout` 의 값은 큐 대기 시간이다"가
    `EngineErrorCode.EXECUTION_QUEUE_WAIT_TIMEOUT` JSDoc의 인용과 정확히 일치.
  - `spec/1-data-model.md:474` — `SERVER_INTERRUPTED`가 graceful shutdown 미완료 노드로
    서술되어 JSDoc과 일치.
- `plan/complete/exec-intake-followups.md` ARCH#5 완료 기록(9지점 표·4R 미러 보정 인용 블록
  포함)과 `CHANGELOG.md`/`error-codes.ts` JSDoc 3곳의 "9지점·4코드·5형태" 서술이 상호 일치함을
  대조.
- `grep -rn "'EXECUTION_QUEUE_WAIT_TIMEOUT'\|'WORKER_HEARTBEAT_TIMEOUT'\|'SERVER_INTERRUPTED'\|'WEBCHAT_IDLE_TIMEOUT'\|'LLM_RATE_LIMIT'\|'LLM_CALL_FAILED'"` (non-spec) →
  코드 바인딩 잔존 0건, 나머지는 주석 인용뿐.
- TODO/FIXME/HACK/XXX grep(diff 대상 8개 소스 파일) → 실 마커 없음(가드 spec 안의
  `'TODO'`는 예시로 인용된 문자열 리터럴일 뿐).

## 발견사항

- **[INFO]** 가드의 "5형태" 스캔 범위 밖에 있는, `ENGINE_DIR` 내 별개의 조건부-표현식 바인딩
  형태 2곳(이번 diff 와 무관, 사전 존재 코드)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1288`
    (`explicitCode === 'LLM_RATE_LIMIT'`, `classifyLlmError`) /
    `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts:103`
    (`const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';`, 이후 118행
    `error: { code: errorCode, ... }`로 `skipped[]`에 실림)
  - 상세: 전자는 업스트림 LLM 클라이언트가 던지는 코드 문자열과의 **동등비교**(대입이 아님)라
    가드의 `CODE_BINDING_NAMES`(`code`/`errorCode`) 대상도, 5형태(property/변수선언/클래스필드/
    대입/생성자 인자) 중 어디에도 해당하지 않는다 — 실제로 같은 줄의 `'LLM_CONNECTION_ERROR'`도
    `ErrorCode`/`EngineErrorCode` 어디에도 없는 **외부 SDK 코드**임을 확인해, 이 블록 전체가
    카탈로그 소관이 아니라는 설계가 일관됨을 확인했다. 후자는 `errorCode`가 `ConditionalExpression`
    으로 초기화되어(`err.name` 또는 리터럴 `'UNKNOWN_ERROR'`) `record()`의
    `ts.isStringLiteral(literal)` 검사를 직접 통과하지 못하는 6번째 형태다 — 가드 JSDoc이 명시적으로
    "형태 추격을 여섯 번째에서 멈췄다"고 선언한 바로 그 경계와 정확히 같은 종류의 케이스다.
    `UNKNOWN_ERROR`는 `ErrorCode`/`EngineErrorCode` 어디에도 없고 `skipped[].error.code`는
    JS `Error.name`(예: `TypeError`)을 그대로 code 자리에 싣는 별개 설계라, 이번 PR이 다루는
    `Execution.error.code`/`NodeExecution.error.code` 최상위 봉투(FE·알림·chat-channel이
    직접 분기하는 필드)와는 층위가 다르다.
  - 이 diff 가 건드리지 않은 사전 존재 코드이고, 가드의 문서화된 스코프 경계(다섯 형태,
    "형태 공간이 열려 있어 여기서 멈춘다")와 정확히 일치하는 사례라 회귀도 아니고 가드 설계의
    결함도 아니다 — **가드가 스스로 선언한 한계가 실측과 정합함을 보여주는 확인**으로 기록한다.
  - 제안: 조치 불요. 향후 `skipped[].error.code`/`explicitCode` 비교 계열까지 앵커링 범위를
    넓히고 싶다면 별도 후속 항목으로 다루는 편이 낫다(가드 스코프를 다시 넓히면 이미 4라운드에
    걸쳐 확정한 "형태 추격 중단" 결정과 충돌한다).

- **[INFO]** (재확인, 신규 아님) `EngineErrorCode` 경계 규칙이 `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED`
  등 개념상 유사한 엔진 코드에는 소급 적용되지 않는다 — `plan/complete/exec-intake-followups.md`가
  "의도된 스코프 축소"로 명시한 항목이며, 실제로 `workflow-errors.ts:212`에서
  `readonly code = ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED`로 이미 타입 앵커가 있어 옮길
  필요가 없음을 소스 레벨로 재확인했다.
  - 제안: 조치 불요.

- **[INFO]** spec fidelity — 관련 spec은 `spec/conventions/error-codes.md`(§3
  historical-artifact 레지스트리) · `spec/5-system/3-error-handling.md`(§1.4/§1.5) ·
  `spec/5-system/14-external-interaction-api.md`(§6) · `spec/1-data-model.md` 네 문서다. 이번
  diff는 문자열 **값을 전혀 바꾸지 않는** 내부 리다이렉트이며, 4개 신규 상수 값 모두
  원래 리터럴과 byte-identical 함을 직접 대조로 재확인했다. `spec_impact: none`(plan
  frontmatter) 정확.

## 요약

`ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`shutdown-state.service.ts`
세 곳의 엔진 레벨 에러 코드 맨 문자열 9지점(4개 코드 `EXECUTION_QUEUE_WAIT_TIMEOUT`·
`WORKER_HEARTBEAT_TIMEOUT`·`SERVER_INTERRUPTED`×2·`WEBCHAT_IDLE_TIMEOUT` + 이미 `ErrorCode`에
있던 `LLM_RATE_LIMIT`/`LLM_CALL_FAILED`×3)를 신설 `EngineErrorCode`/기존 `ErrorCode` 상수
참조로 교체한 순수 리팩터다. 값이 전부 byte-identical로 보존돼 런타임 동작·DB 영속값·spec
계약을 바꾸지 않으며, `npx jest`(가드 spec+error-codes.spec.ts 32/32)·`tsc --noEmit` 을 직접
재실행해 GREEN을 확인했다. 재발 방지용 AST 가드(`engine-error-code-anchor-guard.ts` + fixture
+ spec)가 앵커 없는 맨 문자열 재발을 5-form 기반으로 차단하며, `ANCHORED_ELSEWHERE` 예외 6건
전부의 실제 앵커(클래스 `readonly code`·`TriggerParameterErrorDetail['code']` 유니온·
`RehydrationError.code` 생성자 리터럴 유니온)를 소스에서 직접 대조해 사실과 일치함을 확인했다.
`spec/conventions/error-codes.md` §3·`spec/5-system/3-error-handling.md`·
`spec/5-system/14-external-interaction-api.md §6`·`spec/1-data-model.md` 네 문서와의 line-level
대조에서도 불일치를 찾지 못했다. 이미 4라운드(20_27_29→20_43_35→20_59_14→21_12_31) 동안
발견의 성격이 "CHANGELOG 부재 → 가드 보장 범위 → 문서 역전파(2/3→3/3 미러) → 설계 전제 미검증"
으로 좁혀지며 Critical 0을 유지해 왔고, 본 5라운드 독립 재검증(전체 소스 직접 열람·spec
line-level 대조·guard 스코프 경계의 실측 재확인)에서도 새로운 기능적 결함이나 spec 불일치를
찾지 못했다. 새로 발견한 것은 가드의 문서화된 스캔 경계(5형태) 밖에 있는, 이 diff와 무관한
사전 존재 코드 2곳(`explicitCode === 'LLM_RATE_LIMIT'` 동등비교·`foreach-executor.ts`의
삼항식 `errorCode`)뿐이며, 이는 가드 설계의 결함이 아니라 이미 문서화된 경계와 정합하는
확인 사항이라 INFO로 기록한다. 반환값·에러 시나리오·엣지 케이스는 모두 원본 동작을 그대로
보존하는 기계적 치환이고 TODO/FIXME/HACK 마커도 없다.

## 위험도

NONE
