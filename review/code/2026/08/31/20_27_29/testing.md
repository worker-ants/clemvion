# 테스트(Testing) 리뷰 — error-codes-layer-split

## 리뷰 범위 요약

이번 변경은 두 축으로 구성된다.

1. **기계적 리팩터**: `execution-engine.service.ts`(`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`stalledError`) · `shutdown-state.service.ts`(`markRemainingAsInterrupted` ×2) · `ai-turn-orchestrator.service.ts`(`classifyLlmError` 계열)에서 맨 문자열 에러 코드(`'SERVER_INTERRUPTED'` 등)를 `error-codes.ts` 신설 `EngineErrorCode`/기존 `ErrorCode` 상수 참조로 교체. 값 자체는 불변이라 순수 anchor 교체.
2. **신규 정적 가드 3파일**(`repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}`): 엔진 모듈에서 `code`/`errorCode` 에 앵커 없는 UPPER_SNAKE 문자열 리터럴이 다시 생기는 것을 AST 기반으로 차단하는 회귀 가드.

실측(직접 실행, mutate 없이 read-only):

```
npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts   → 11 passed
npx jest .../shutdown-state.service.spec.ts .../ai-turn-orchestrator.service.spec.ts → 101 passed (2 suites)
npx jest .../execution-engine.service.spec.ts                          → 456 passed
```
합계 568건 전부 GREEN. 값이 리터럴 문자열에서 `as const` enum 참조로 바뀌었을 뿐이라 기존 회귀 테스트(하드코딩 문자열 assertion 다수, 예: `execution-engine.service.spec.ts:5049,5077,5091`의 `'WORKER_HEARTBEAT_TIMEOUT'`, `shutdown-state.service.spec.ts:133`의 `'SERVER_INTERRUPTED'`)가 값 동일성 덕에 그대로 유효함을 확인했다. 저장소는 리뷰 시작·종료 시점 모두 `git status --short` 클린(리뷰 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `findUnanchored` 는 위반이 실제로 생겼을 때 non-empty 를 반환하는 경로가 합성 케이스로 직접 단위 테스트되지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:200-204` (함수 `findUnanchored`)
  - 상세: `collectBoundCodes(repoRoot, relDir)` 는 스캔 디렉터리를 인자로 받아 `engine-error-code-anchor.spec.ts` 의 "바인딩 형태 커버리지" 테스트가 `__tests__` 픽스처 디렉터리를 넘겨 형태별 수집을 직접 검증한다. 반면 `findUnanchored(repoRoot)` 는 스캔 디렉터리가 `ENGINE_DIR` 로 하드코딩돼 있어, 이 함수 자체(= `!(h.code in ANCHORED_ELSEWHERE)` 필터)를 픽스처(`FIXTURE_*`, 어느 anchor 에도 없는 가짜 코드)로 직접 겨냥해 "위반이 실제로 검출된다" 를 확인하는 테스트가 없다. 현재 spec 의 `'앵커 없는 엔진 에러 코드가 없다'` 테스트는 실제 저장소가 이미 클린(0건)한 상태만 확인한다. 다만 그 필터를 반전시키는 뮤테이션은 `ANCHORED_ELSEWHERE` 의 코드들(`INVALID_EXECUTION_STATE` 등)이 `workflow-errors.ts`/`trigger-parameter.types.ts` 등 ENGINE_DIR 안에 실제 리터럴로도 존재하는 우연 덕에 간접적으로 걸린다 — 설계된 불변식이 아니라 현재 코드 분포에 의존하는 우연한 안전망이다.
  - 제안: `findUnanchored` 에도 `collectBoundCodes` 처럼 `relDir` 파라미터를 열어, `__tests__` 픽스처 디렉터리를 대상으로 "앵커 없는 `FIXTURE_*` 코드가 실제로 검출된다" 는 positive-path 단위 테스트를 추가하면 필터 로직 자체의 회귀를 저장소 상태와 독립적으로 보장할 수 있다.

- **[INFO]** 리팩터 대상 3서비스의 기존 회귀 테스트는 여전히 맨 문자열로 코드 값을 단언한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5049,5077,5091,3157,3172,4668` / `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.spec.ts:133` / `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:980-1191` (예: `expect(result.code).toBe('LLM_RATE_LIMIT')`)
  - 상세: 이번 diff 는 프로덕션 코드만 앵커로 옮기고 테스트는 건드리지 않았다. 값이 동일해 회귀는 안전(GREEN 확인됨)하지만, 이제 `EngineErrorCode`/`ErrorCode` 상수가 존재하므로 테스트도 상수를 참조하면 향후 코드값 리네임 시 테스트가 컴파일 타임에 함께 깨져 "테스트만 초록, 상수는 이미 바뀜" 류 drift 를 막을 수 있다.
  - 제안: 필수는 아님(이번 PR 스코프 밖) — 후속 정리 항목으로 남겨도 무방.

- **[INFO]** 새 가드 spec 의 "premise" 테스트(`readDeclaredCodes`/`collectBoundCodes` 가 각각 0 이 아님을 먼저 확인)는 매우 좋은 설계다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts:40-60`
  - 상세: 파서가 깨져 `declared`/`hits` 가 공집합이 되면 본 단언(`앵커 없는 코드가 없다`)이 "우연히" 전부 통과하는 vacuous-GREEN 함정을 별도 전제 테스트로 선제 차단한다. `collectBoundCodes` 하한을 `ANCHORED_ELSEWHERE` 키 개수에 결속해, 리팩터가 진행돼 리터럴 수가 줄어들어도 테스트가 깨지지 않도록 한 점도 적절하다.
  - 이 항목은 시정 요청이 아니라 근거 확인용 긍정 기록.

## 요약

전체 diff는 (1) 값 불변 리터럴→enum-anchor 치환(순수 리팩터, 동작 변화 없음, 기존 568건 회귀 테스트 실측 GREEN 확인)과 (2) 그 anchor 를 강제하는 신규 AST 기반 repo-guard 3파일(가드 로직/불변 픽스처/소비 spec 분리)로 구성된다. 새 가드 테스트는 이 리포의 과거 vacuous-test 실패 패턴(자기 목적 대상이 사라지는 자멸형 단언, 조용한 0건 통과)을 명시적으로 인지하고 픽스처 분리·premise 단언·mutation 근거(docstring 에 실제 뮤테이션 실험 기록)로 선제 방어한 매우 높은 완성도를 보인다. 유일한 갭은 `findUnanchored` 자체의 위반-검출 경로가 실제 저장소의 "현재 클린" 상태에 의존해서만 간접 검증된다는 점으로, 심각하지 않은 개선 여지(INFO)다. Mock 은 전혀 쓰이지 않고 실제 파일시스템/AST 를 읽는 것이 이 성격의 repo-guard 에 적절하며, 형제 가드(`redis-fail-open-catalog-guard.ts`)와 동일한 관례를 따라 일관적이다. 테스트 격리·가독성·회귀 유효성 모두 문제 없음.

## 위험도

NONE
