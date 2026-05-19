# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `sanitizeLastErrorMessage` 임포트 위치 — 모듈 경계 간 직접 참조
- 위치: `execution-engine.service.ts` line 35 (diff +import)
- 상세: `sanitizeLastErrorMessage` 는 `integration-oauth.service.ts` 에서 export 된 함수를 실행 엔진이 직접 임포트한다. 이 함수는 OAuth 통합 서비스의 내부 유틸리티 성격으로, 의존성 방향이 다소 어색하다 (execution-engine → integrations). 그러나 이 임포트는 현재 변경의 핵심 목적(LLM 오류 메시지 sanitize) 에 직결되며, 별도 유틸 모듈 없이 가장 빠른 경로를 택한 것으로 이해된다.
- 제안: 범위 관점에서 이 임포트 자체는 현재 버그픽스 작업과 인과관계가 있으므로 범위 이탈은 아니다. 다만 장기적으로 `sanitizeLastErrorMessage` 를 공유 유틸 모듈로 이동하는 것이 적절하며, 이는 후속 리팩토링 태스크로 분리 권장.

### [INFO] `ResumableNodeHandler` 임포트 추가
- 위치: `execution-engine.service.ts` line 43 (diff +ResumableNodeHandler)
- 상세: `handleAiTurnError` 의 파라미터 타입으로 직접 필요하므로 이 임포트 추가는 변경 의도와 완전히 연결된 필수 변경이다. 불필요한 정리가 아님.

### [INFO] `state-machine.ts` — `WAITING_FOR_INPUT → FAILED` 전이 추가
- 위치: `state-machine.ts` diff 전체
- 상세: 이 변경은 핵심 버그픽스 경로(`finalizeAiNode` 가 WAITING_FOR_INPUT 상태에서 FAILED 전이를 수행할 수 있도록)에 필수적이다. 무관한 전이나 기존 전이의 수정 없이 신규 전이 한 건만 추가했다.

### [INFO] `ai-agent.handler.ts` — `buildMultiTurnFinalOutput` 리팩토링
- 위치: `ai-agent.handler.ts` diff, `output` 객체 구성 방식 변경 (+18줄 내외)
- 상세: 기존 inline 객체 리터럴로 return 하던 `output` 을 `const output: Record<string, unknown>` 변수로 분리한 뒤, `errorPayload` 가 있을 때만 `output.error` 를 추가하도록 조건부 처리를 삽입했다. 이 구조 변경은 `errorPayload` 지원을 위해 필요한 최소한의 리팩토링이며, 기능 의미는 그대로 보존된다. 불필요한 코드 정리는 없음.

### [INFO] `node-handler.interface.ts` — `endMultiTurnConversation` 주석 확장 + `errorPayload` 파라미터 추가
- 위치: `node-handler.interface.ts` diff
- 상세: 인터페이스 계약 변경(파라미터 추가 + 주석 확장)은 엔진-핸들러 간 신규 호출 계약을 정의하는 작업의 일부로, 변경 의도와 직결된다. 불필요한 주석 변경 없음.

### [INFO] `execution-engine.service.spec.ts` — 신규 end-to-end 테스트 1건 추가
- 위치: `execution-engine.service.spec.ts` diff, +112줄
- 상세: 회귀를 방지하는 e2e 시나리오 테스트가 정확히 버그 시나리오(processMultiTurnMessage throw → WAITING_FOR_INPUT 영구 잔류) 를 커버한다. 범위를 벗어나지 않는다.

### [INFO] `ai-agent.handler.spec.ts` — 신규 단위 테스트 3건 추가
- 위치: `ai-agent.handler.spec.ts` diff, +121줄
- 상세: `buildMultiTurnFinalOutput` + `endMultiTurnConversation` 의 `errorPayload` 경로를 각각 검증. 변경된 코드에 대한 직접 테스트이므로 범위 내.

## 요약

6개 파일의 변경 전체가 "AI Agent multi-turn 모드에서 LLM 오류(429/timeout/connection) 발생 시 NodeExecution 이 WAITING_FOR_INPUT 으로 영구 잔류하는 버그를 수정한다"는 단일 목적에 수렴한다. 의도 이상의 수정, 무관한 리팩토링, 기능 확장, 포맷팅 전용 변경, 불필요한 임포트 추가·정리, 무관한 설정 파일 변경은 발견되지 않았다. `sanitizeLastErrorMessage` 를 OAuth 서비스에서 직접 임포트하는 점은 의존성 방향 측면에서 장기적으로 개선 여지가 있으나, 현 버그픽스 범위 내에서는 허용 범위에 해당한다.

## 위험도

NONE
