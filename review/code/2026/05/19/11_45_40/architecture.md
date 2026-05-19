# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [CRITICAL] 레이어 위반 — `sanitizeLastErrorMessage` 를 `integration-oauth.service` 에서 직접 import
- 위치: `execution-engine.service.ts` line 35 (`import { sanitizeLastErrorMessage } from '../integrations/integration-oauth.service'`)
- 상세: `ExecutionEngineService` 는 실행 엔진 레이어에 속하고, `integration-oauth.service` 는 외부 OAuth 통합 레이어에 속한다. 두 레이어는 수직 방향으로 상하 관계가 없으며, 엔진이 통합 레이어 구현체에 직접 의존하는 것은 DIP(Dependency Inversion Principle) 위반이다. `sanitizeLastErrorMessage` 는 이름부터 OAuth-specific utility 처럼 보이지 않음에도 OAuth 서비스 파일에 정의되어 있어 응집도(cohesion) 도 낮다. 이 함수는 `execution-engine` 모듈 내부의 공유 유틸(`utils/sanitize.ts`)이나 별도의 `shared/sanitize` 모듈로 이동해야 한다.
- 제안:
  1. `sanitizeLastErrorMessage` 를 `codebase/backend/src/shared/utils/sanitize-error-message.ts` 같은 중립적 위치로 추출한다.
  2. `integration-oauth.service` 와 `execution-engine.service` 모두 해당 위치에서 import 한다.
  3. 이로써 횡단 의존성(cross-layer coupling)이 제거되고 단일 책임(SRP)도 회복된다.

---

### [WARNING] `ExecutionEngineService` 의 과도한 책임 누적 — God Object 안티패턴 지속
- 위치: `execution-engine.service.ts` 전체 (클래스 주석에도 ~4200줄 언급)
- 상세: 이번 변경으로 `handleAiTurnError`, `extractAiTurnErrorPayload` 라는 두 메서드가 같은 God Object 에 추가됐다. AI turn 오류 처리 도메인은 독립적인 서비스(`AiConversationErrorHandler` 등)로 분리될 수 있는 충분한 응집도를 갖고 있다. 클래스 주석에서 스스로 "PR-H/I 에서 점진적 책임 분해 예정"이라고 명시하고 있으나, 매 변경마다 기존 God Object 에 로직이 추가되는 패턴이 반복되고 있다.
- 제안: AI 대화 처리 관련 private 메서드(`handleAiTurnError`, `extractAiTurnErrorPayload`, `waitForAiConversation`, `handleAiMessageTurn`, `handleAiEndConversation`, `finalizeAiNode`)를 `AiConversationService` 또는 `AiNodeLifecycleService` 로 추출한다. PR-H/I 계획을 구체적인 마일스톤으로 격상시키는 것을 권장한다.

---

### [WARNING] `handleAiTurnError` 내 레이어 혼합 — DB 직접 조작과 이벤트 발행이 단일 메서드에 공존
- 위치: `handleAiTurnError` 메서드 내 (`nodeExec.outputData = safe` 직접 mutation) 및 `finalizeAiNode` FAILED 분기 내 `nodeExecutionRepository.save(nodeExec)` + `eventEmitter.emitNode`
- 상세: `handleAiTurnError` 는 (1) 오류 페이로드 추출, (2) 핸들러 종료 호출, (3) context/cache 갱신, (4) DB entity 직접 뮤테이션이라는 네 가지 책임을 가진다. 이는 SRP 위반이며, 특히 DB entity 직접 뮤테이션(`nodeExec.outputData = safe`)이 영속화 전에 수행되어 finalize 단계의 단일 진입점(single commit point) 원칙과 불일치를 야기한다. 주석에서도 "일관성 위해 outputData 도 동기 갱신"이라고 설명하지만, 이는 두 곳에서 같은 entity 를 수정하는 구조적 취약점이다.
- 제안: `handleAiTurnError` 는 오류 페이로드 빌드와 핸들러 종료까지만 수행하고, context/cache 갱신과 entity 뮤테이션은 `finalizeAiNode` FAILED 분기에서 일괄 처리하는 단일 경로를 유지한다.

---

### [WARNING] `extractAiTurnErrorPayload` 가 static 메서드임에도 sanitize 유틸에 외부 의존
- 위치: `extractAiTurnErrorPayload` (static, line ~206)
- 상세: static 메서드는 인스턴스 상태에 의존하지 않아 재사용·테스트가 용이하다. 그러나 `sanitizeLastErrorMessage` 를 외부 서비스 파일에서 import 하므로, 이 static 메서드를 독립적으로 테스트하거나 다른 컨텍스트에서 재사용할 때 OAuth 서비스 전체가 끌려온다. `sanitizeLastErrorMessage` 가 공유 유틸로 이동하면 이 문제도 동시에 해소된다.
- 제안: CRITICAL 항목의 `sanitizeLastErrorMessage` 이동과 함께 해결.

---

### [WARNING] `finalizeAiNode` FAILED 분기의 sentinel throw 가 암묵적 제어 흐름을 생성
- 위치: `finalizeAiNode` FAILED 분기 마지막 (`throw new Error(errorMessage)`)
- 상세: `finalizeAiNode` 는 일반적으로 "노드를 완료 상태로 정리하는" 메서드로 기대되지만, FAILED 경로에서는 NODE_FAILED 이벤트를 발행한 뒤 sentinel error 를 throw 해 `runExecution` top-level catch 로 제어를 넘긴다. 이는 예외를 정상 제어 흐름(control flow)으로 사용하는 안티패턴이다. 호출자(`waitForAiConversation`)는 이 throw 를 명시적으로 catch 하지 않고 propagate 하는 의도가 있으나, 코드를 읽는 사람이 "finalize 가 throw 한다"고 쉽게 파악하기 어렵다.
- 제안: `finalizeAiNode` 의 반환 타입을 `Promise<{ threw: boolean }>` 또는 판별 유니온으로 변경해 caller 가 명시적으로 분기하거나, FAILED 시 throw 를 지양하고 `runExecution` 이 `finalStatus` 를 직접 전달받아 처리하도록 리팩터링한다.

---

### [INFO] `details` sanitize 시 `JSON.parse(sanitize(JSON.stringify(...)))` 이중 직렬화
- 위치: `extractAiTurnErrorPayload` 내 `details` 처리 블록 (line ~243–250)
- 상세: `rawDetails` 를 JSON.stringify → sanitize → JSON.parse 하는 패턴은 (1) `rawDetails` 가 직렬화 불가능한 객체(순환 참조 등)면 throw, (2) 불필요한 역직렬화 비용 발생의 위험이 있다. 기능은 동작하지만 의도가 명확하지 않고 취약하다.
- 제안: `sanitizeLastErrorMessage` 가 문자열만 처리하는 설계라면 `rawDetails` 에 대해서는 별도의 `sanitizeObject` 유틸을 제공하거나, details 를 단순 `String(rawDetails)` 로 문자열화해 sanitize 하는 방식을 검토한다.

---

### [INFO] `finalStatus` 가 `string` 리터럴 유니온으로 누수 — 전용 타입 부재
- 위치: `waitForAiConversation`, `handleAiTurnError`, `finalizeAiNode` 시그니처
- 상세: `'COMPLETED' | 'FAILED'` 리터럴이 여러 함수 시그니처에 분산 선언돼 있다. 타입 별칭(`type AiFinalStatus = 'COMPLETED' | 'FAILED'`)이 없어 향후 `'CANCELLED'` 등 상태 추가 시 선언 위치를 모두 찾아 수정해야 한다.
- 제안: `node-handler.interface.ts` 또는 전용 `ai-conversation.types.ts` 에 `export type AiFinalStatus = 'COMPLETED' | 'FAILED'` 를 선언하고 참조를 통일한다.

---

## 요약

이번 변경의 핵심인 "AI turn 오류 시 FAILED 분기로 확실히 진입"하는 로직은 spec §7.9 요구사항을 충족하고 버그(WAITING_FOR_INPUT 영구 잔류)를 해소한다는 점에서 기능적으로 타당하다. 그러나 아키텍처 관점에서는 두 가지 중요한 문제가 있다. 첫째, `sanitizeLastErrorMessage` 를 OAuth 통합 레이어에서 직접 import 하는 것은 레이어 경계를 위반하는 CRITICAL 수준의 의존성 역전 문제이며, 즉시 공유 유틸로 이동해야 한다. 둘째, 이번 패치로 AI 대화 오류 처리 책임이 이미 4200줄 규모인 `ExecutionEngineService` 에 추가로 쌓였고, sentinel exception 을 정상 제어 흐름으로 사용하는 패턴, `handleAiTurnError` 내 DB entity 직접 뮤테이션과 같이 단일 책임 및 단일 진입점 원칙에 반하는 설계가 복수 존재해 향후 유지보수 비용을 높인다.

## 위험도

**HIGH**

(CRITICAL 등급의 레이어 위반이 1건 존재하며, 운영 환경에서 OAuth 서비스와 실행 엔진 사이의 불명확한 결합이 장기적으로 순환 의존성이나 모듈 분리 실패로 이어질 위험이 있다.)
