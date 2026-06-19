# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] spec/5-system/4-execution-engine.md — EngineDriver ISP 분할 반영 미완
- 위치: `spec/5-system/4-execution-engine.md §Rationale`, EngineDriver 기술 부분
- 상세: 이번 변경에서 단일 12-멤버 `EngineDriver` 가 `CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver` 로 ISP 분해됐다. consistency check(cross_spec.md INFO-3)가 "구현 착수 전 정상 선행 상태"로 판단했고 "구현 완료 후 spec §Rationale 및 EngineDriver 계약 기술 갱신 필요"를 명시했다. 현재 구현이 완료됐으므로 spec 갱신이 후속으로 필요한 상태이다.
- 제안: project-planner 가 `spec/5-system/4-execution-engine.md §Rationale` 의 C-1 god-class 분할 절에 부분 인터페이스 계층(CoreEngineDriver → InteractionEngineDriver / AiTurnEngineDriver / RetryEngineDriver / EngineDriver) 및 소비자별 바인딩 근거를 반영한다.

### [INFO] engine-driver.interface.ts — 파일 수준 모듈 JSDoc 없음
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` 파일 상단
- 상세: 파일 내 각 인터페이스마다 JSDoc이 잘 작성돼 있다. 그러나 파일 자체의 모듈 레벨 JSDoc(인터페이스 계층 전체 그림을 한눈에 보여주는 파일 헤더)이 없다. 현재 최상단의 큰 블록 JSDoc은 `CoreEngineDriver` 인터페이스 소속으로, 파일이 내보내는 5개 인터페이스 + 합집합 `EngineDriver` + 토큰 `ENGINE_DRIVER` 의 전체 그림이 한 곳에 응집돼 있지 않다.
- 제안: 파일 최상단(import 전 또는 직후)에 인터페이스 계층 다이어그램을 간략히 기술하는 파일 수준 주석을 추가하거나, 현재 `CoreEngineDriver` 의 큰 블록 JSDoc을 파일 헤더로 분리하는 것을 검토한다. 단, 현재 각 인터페이스 JSDoc이 충분히 명확하므로 비차단 개선 사항이다.

### [INFO] continuation-execution.processor.ts — 클래스 JSDoc 내 RetryTurnService 분기 설명의 중복
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` 클래스 JSDoc + 생성자 인라인 주석
- 상세: 클래스 JSDoc에 "C-1 후속 ④ — retry_last_turn 분기는 engine→Retry 순환 DI 제거에 따라 엔진 delegator가 아니라 RetryTurnService.applyRetryLastTurn을 직접 호출한다"는 내용이 있고, 생성자의 retryTurnService 매개변수 인라인 주석에도 동일 내용이 거의 그대로 반복된다. 중복이 미래 변경 시 한쪽만 갱신되면 불일치가 발생할 수 있다.
- 제안: 생성자 인라인 주석을 클래스 JSDoc으로 위임하거나 @see 링크로 간략화한다. 비차단 수준이다.

### [INFO] execution-event-emitter.service.ts — forwardRef 도입 이유가 생성자에만 있고 클래스 JSDoc에 미반영
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 클래스 JSDoc vs 생성자 주석
- 상세: 클래스 JSDoc("C-6 strangle step 1"의 책임·배경 설명)이 이번 변경으로 새로 생긴 `forwardRef` 추가 배경(ws.service ↔ gateway ↔ event-emitter ES-module 순환)을 포함하지 않는다. 이 이유는 생성자 인라인 주석에만 기재돼 있다.
- 제안: 클래스 수준에서 WebsocketService 의존 방향을 한 줄 언급하거나, 현재 생성자 인라인 주석으로도 충분히 설명되므로 현 상태 유지도 무방하다. 비차단 INFO.

### [INFO] continuation-execution.processor.spec.ts — 파일 상단 검증 범위 설명이 retry_last_turn 분리를 반영하지 않음
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.spec.ts` 라인 10-20 (전체 파일 컨텍스트 기준)
- 상세: 파일 상단 JSDoc의 "검증 범위" 목록 1번이 "5개 type dispatch (continue / cancel / button_click / ai_message / ai_end_conversation) 가 ExecutionEngineService 의 대응 메서드를 호출"이라고 설명하는데, retry_last_turn dispatch는 이제 RetryTurnService를 호출한다. 검증 범위 설명이 변경된 구조를 완전히 반영하지 않는다. 파일 하단 retry_last_turn dispatch describe 블록은 정확하나, 상단 요약이 부분적으로 구식이다.
- 제안: 검증 범위 1번 항목을 "ExecutionEngineService 의 대응 메서드를 호출 (retry_last_turn 은 RetryTurnService 경유)"으로 갱신하거나, 6개 type dispatch로 명시해 retry_last_turn 이 포함됨을 상단에서도 분명히 한다.

### [INFO] spec — EngineDriver vs ISP 분할 계층 이름 불일치 위험
- 위치: `spec/5-system/4-execution-engine.md` (구현에 반영됐으나 spec 본문은 미갱신)
- 상세: consistency check rationale_continuity.md INFO-2 에서 "EngineDriver(engine 내부 계약)와 WorkflowExecutor(nodes→engine 공개 계약)의 역할 구분이 Rationale 에만 기술되고 본문에 없다"는 점을 지적했다. ISP 분할 이후 CoreEngineDriver / AiTurnEngineDriver 등 새 이름이 코드에 정착했으나 spec 본문에 반영되지 않아, 코드를 처음 보는 독자가 spec의 "EngineDriver" 와 코드의 분할 계층 간 대응 관계를 유추해야 한다.
- 제안: 구현 완료 직후 `spec/5-system/4-execution-engine.md §1.3` 또는 §Rationale 의 "C-1 god-class 분할" 절에 ISP 분할 계층 그림(소비자 → 부분 인터페이스 → 합집합 EngineDriver)을 1~2 줄로 반영한다. project-planner 영역 후속 작업.

## 요약

이번 변경(C-1 후속 ④ — EngineDriver ISP 분할 + engine→Retry 순환 DI 제거)은 코드 레벨 문서화 품질이 전반적으로 양호하다. 각 인터페이스(`CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver`)에 목적·소비자·멤버별 의도를 설명하는 JSDoc이 잘 작성돼 있고, 서비스 클래스의 클래스 JSDoc도 변경된 driver 타입명을 정확히 반영했다. 인라인 주석도 "C-1 후속 ④" 레이블과 함께 변경 이유를 명확히 기록하고 있다. 주요 미비 사항은 (1) 구현 완료 후 `spec/5-system/4-execution-engine.md §Rationale` 에 ISP 분할 계층이 반영돼야 하는 후속 spec-sync 작업이 아직 미완료 상태이고(INFO — consistency check에서 이미 추적 중), (2) `continuation-execution.processor.spec.ts` 상단 검증 범위 설명에서 `retry_last_turn` 이 `RetryTurnService` 를 호출함을 명시적으로 언급하지 않아 부분적으로 구식이 된 점이다. 모두 비차단 INFO 수준이며 기능 정확성에는 영향이 없다.

## 위험도

LOW

STATUS: SUCCESS
