# 테스트(Testing) 리뷰

## 대상

- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` (신규 `describe` 블록 2 테스트 추가)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`endMultiTurnConversation` 시그니처에 `_errorPayload`/`_failedUserMessage`/`_failedUserMessageSource` 명시적 무시 파라미터 추가 + docblock)
- `codebase/backend/src/nodes/core/node-handler.interface.ts` (계약 docblock 정정 — 순수 문서 변경, 실행 코드 없음)
- 나머지 파일(4~12번, `plan/*.md`, `review/consistency/**`)은 plan/리뷰 산출물이며 테스트 관점 리뷰 대상 코드가 아님

## 검증 수행

- `npx jest src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` → 38 passed (신규 2건 포함), 격리 상태에서 정상 통과 확인.
- `npx tsc --noEmit` → 대상 3파일 관련 에러 0건 (참고: `ai-agent.handler.spec.ts`의 TS2352 2건은 origin/main에도 존재하는 이번 diff와 무관한 선재 이슈).
- `npx eslint` 대상 3파일 → 0 warning/error.

## 발견사항

- **[INFO]** 신규 `errorState()` 헬퍼가 같은 파일의 기존 `buildState()`(line ~773)와 필드가 상당 부분 중복
  - 위치: `information-extractor.handler.spec.ts:43-74` vs `:773-798`
  - 상세: `buildState`는 상위 `describe('execute (multi_turn)')` 블록 내부 함수라 JS 스코프상 새 `describe('endMultiTurnConversation — engine errorPayload contract ...')` (형제 블록)에서 재사용 불가능해 부득이 재정의한 것으로 보임. 기능상 문제는 없으나 두 팩토리가 향후 `MultiTurnState` 필드 추가/변경 시 한쪽만 갱신되는 drift 위험이 있음.
  - 제안: 여유 있을 때 `buildState`류 공통 상태 팩토리를 파일 최상단(describe 밖)으로 끌어올려 전역 재사용 — 지금 당장 블로킹할 사안은 아님.

- **[INFO]** 두 번째 테스트(`produces the same self-filled envelope when errorPayload is omitted`)가 첫 번째 테스트의 축소판이라 신규 검증 표면이 크지 않음
  - 위치: `information-extractor.handler.spec.ts:1387-1394`
  - 상세: `code`/`retryable` 두 필드만 재확인하며, 이는 이미 첫 테스트가 더 엄격하게 검증한 항목의 부분집합. "인자 개수가 달라도(2개 vs 5개) 동일 출력"이라는 관점에서는 의미가 있는 스모크 테스트이므로 유해하지 않음.
  - 제안: 조치 불필요 (현행 유지 가능). 굳이 강화하려면 `output.result.extracted`까지 재확인해 완전한 대칭성을 보장할 수 있음.

- **[INFO]** 엔진의 실제 트리거 경로(`handleAiTurnError`의 uncaught-throw safety-net → IE `endMultiTurnConversation` 5-인자 호출)는 end-to-end로 커버되지 않음, 대신 메서드 경계에서 직접 호출하는 방식으로 계약만 핀
  - 위치: 신규 테스트 전체 (`information-extractor.handler.spec.ts:1295-1394`)
  - 상세: `runTurnWithCollectionRetries`가 실제 LLM 오류(429/timeout 등)를 내부에서 전부 삼키므로(`{kind:'error'}` → `buildErrorOutput`, line 808-820), 엔진이 uncaught throw를 잡아 5-인자로 `endMultiTurnConversation`을 호출하는 case는 `resolveConfig`/`hydrateState` 등 turn 루프 진입 전 실패라는 희귀 케이스로 한정됨(plan 문서 Q1.2 판정과 일치). `ai-turn-orchestrator.service.spec.ts`는 이 디스패치 자체를 mock 핸들러로 범용 검증하고, 이번 spec은 IE가 그 인자를 실제로 어떻게 소비(무시)하는지를 검증 — 책임 분리가 합리적이라 이 자체는 결함이 아님.
  - 제안: 조치 불필요. 다만 향후 IE의 turn-loop-진입-전 실패 경로(예: `hydrateState`가 malformed state에서 throw)를 orchestrator 레벨 e2e/integration으로 재현하는 별도 테스트가 있으면 안전망이 한 겹 더 생김 — 우선순위 낮음.

- **[INFO]** `_retryState` 부재 단언이 비어있지 않은 진짜 회귀 핀임을 소스 교차 확인
  - 위치: `information-extractor.handler.spec.ts:121-124`
  - 상세: `information-extractor.handler.ts` 전체에서 `_retryState`는 docblock 주석에만 등장하고 실제 세팅 코드가 없음 — `AiAgentHandler`류 구현을 잘못 복사해 `_retryState`를 채우기 시작하는 미래 회귀를 잡아낼 수 있는 유효한 단언.

## 테스트 품질 특기사항 (긍정)

- **테스트 용이성**: `endMultiTurnConversation`이 순수 상태 변환 함수(state → output)로 구현돼 있어, `mockLlmService.chat` 등 어떤 협력자도 건드리지 않고 격리된 단위 테스트가 가능함 — 의존성 주입/부수효과 배제 설계가 테스트 작성 난이도를 크게 낮춤.
- **회귀 의도 명시**: 각 assertion에 "무엇을(errorPayload.code가 아니라 self-fill code) / 왜(spec §5.3 invariant)"를 주석으로 명시해, 실패 시 원인 추적이 즉시 가능한 수준의 가독성.
- **비대칭 커버리지 대조**: `AiAgentHandler`(verbatim relay, `ai-agent.handler.spec.ts:3076` 이하 §7.9 테스트)와 `InformationExtractorHandler`(self-fill, 이번 추가분)가 동일 인터페이스의 상반된 소비 방식을 각각 회귀 고정하고 있어, 두 구현의 의도적 발산이 코드/문서/테스트 3중으로 SoT화됨.
- **격리**: 새 `describe` 블록은 `beforeEach`가 만드는 `mockLlmService`/`handler`를 재사용하지만 실제로 호출하지 않으므로(순수 함수 경로) 테스트 간 상태 누수·순서 의존성 없음.
- **`node-handler.interface.ts` 변경**은 JSDoc만 정정하는 순수 문서 변경으로 행동 변화가 없어 별도 테스트 불요 — 적절한 판단.

## 요약

신규 테스트 2건은 `endMultiTurnConversation`의 "engine errorPayload를 의도적으로 무시하고 self-fill한다"는 계약을 정확한 지점(핸들러 메서드 경계)에서 견고하게 회귀 고정하며, 실행 결과(jest 38 passed, tsc/eslint clean)로도 확인됨. 테스트 대상 코드가 순수 상태 변환 함수라 mock 없이 격리 실행되고, 주석이 spec 근거(§5.3)를 인용해 실패 시 원인 추적이 쉬운 높은 품질의 회귀 테스트다. 발견된 항목은 전부 INFO 수준(로컬 상태 팩토리 중복, 두 번째 테스트의 검증 폭이 좁음, 실제 엔진 트리거 경로의 e2e 부재)이며 어느 것도 이번 변경의 정확성이나 안전성을 저해하지 않는다.

## 위험도

NONE
