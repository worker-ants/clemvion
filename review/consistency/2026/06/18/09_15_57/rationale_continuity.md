# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-update-engine-split.md`
검토 기준: `spec/5-system/4-execution-engine.md ##Rationale`, `spec/0-overview.md ##Rationale`, `plan/in-progress/refactor/02-architecture.md`, `spec/conventions/node-output.md`

---

## 발견사항

- **[INFO]** `EngineDriver` in-process 전제 — 기존 Rationale 와 완전 정합
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale 신설 항
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "C-1 god-class strangler-fig 분할" (L1456–1466); `plan/in-progress/refactor/02-architecture.md` C-1 옵션 A 채택 근거
  - 상세: target 이 "엔진 내부 전용 `EngineDriver`(token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`, **in-process 전제** — 분산 분리 아님)"를 명시하는 것은 spec Rationale 의 기존 결정(PR #625 에서 신설, PR3·4 재사용)과 정확히 일치한다. 기각된 대안("WorkflowExecutor 재사용", "per-node task queue", "분산 분리")도 각각 재확인되어 있다.
  - 제안: 정합 확인 — 추가 조치 불요.

- **[INFO]** `WorkflowExecutor` 재사용 기각 반복 확인
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale 신설 항 — "`WorkflowExecutor` 재사용 기각(engine↔노드 계약 과적)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` L1465; `plan/in-progress/refactor/02-architecture.md` L17, L25, L36
  - 상세: `WorkflowExecutor` 재사용 기각은 02-architecture.md 에서 "spec 상 engine↔노드 계약이라 엔진 내부 통신에 재사용하면 계약 의미가 과적됨"으로 이미 명시된 결정이다. target 이 이를 §Rationale 신설 항에 동일 근거로 포함한다 — 기각된 대안의 재도입 없이 기각 결정을 문서화하는 작업.
  - 제안: 정합 확인 — 추가 조치 불요.

- **[INFO]** `ExecutionEventEmitter` 직접 주입 유지 — §4.4 단일 sink 정책 준수
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale 신설 항 — "이벤트 발행은 `ExecutionEventEmitter` 직접 주입 유지(§4.4 — 추상화 미도입)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.4 (L436–449) "결정: 실행 엔진의 외부 이벤트 발행 sink 는 `WebsocketService` 가 canonical 이며, 별도 추상화(`IExecutionEventEmitter` 같은 인터페이스 / Nest `EventEmitter2`)를 도입하지 않는다"; L1466 "§4.4 단일 sink 정책이 금지하는 것은 외부 이벤트 sink 추상화이지 엔진 내부 클래스 분할이 아님"
  - 상세: target 의 기술은 §4.4 에서 확립된 YAGNI 기반 단일-sink 정책을 정확히 따른다. 추출 서비스가 `ExecutionEventEmitter` 를 직접 주입받는 것은 추상화 도입이 아니라 기존 패턴의 연장이다.
  - 제안: 정합 확인 — 추가 조치 불요.

- **[INFO]** `previousOutput` Phase 3 예외 — 기존 폐기 결정 내 예외 경로 명시
  - target 위치: `spec/conventions/node-output.md` §4.2 — "`previousOutput` 폐기 예정 항에 'presentation resume 경로(`ButtonInteractionService`)는 Phase 3 완료 전 `previousOutput` 보존 예외' 명시"
  - 과거 결정 출처: `spec/conventions/node-output.md` L194 (기존 텍스트: "현재 carousel/chart/table/template의 `output.previousOutput` → 제거. ... **단 Phase 3 완료 전 과도기 예외**: presentation resume 경로(`ButtonInteractionService`)는 재개 출력에 `previousOutput`(nested chain 은 strip)을 transitional legacy 필드로 여전히 보존한다 — Phase 3 정리 시 제거 예정 (코드 주석 SoT)")
  - 상세: 이 예외 조항은 기존 spec 텍스트에 이미 존재한다. target 은 C-1 분할로 `ButtonInteractionService` 가 구체 클래스명으로 명확해졌기 때문에 기존 "presentation resume 경로"의 주어를 해당 서비스명으로 갱신하는 것이며, 폐기 결정 자체를 번복하지 않는다.
  - 제안: 정합 확인 — 추가 조치 불요.

- **[INFO]** `button_continue` `selectedItem?`·`url?` optional 등재
  - target 위치: `spec/conventions/node-output.md` §4.5
  - 과거 결정 출처: `spec/conventions/node-output.md` L259 (기존 텍스트: "`button_continue` | `{ buttonId, buttonLabel, url?, selectedItem? }` | ... `url`=링크 버튼 URL(존재 시), `selectedItem`=carousel item-level 버튼(존재 시) — 둘 다 조건부 동봉 (`ButtonInteractionService`)")
  - 상세: target 이 "PR3 이전부터 verbatim 존재, git diff 실증된 기존 행위"라고 명시하는 내용은 node-output.md L259 에 이미 반영돼 있다. target 의 변경은 기존 spec 에 이미 기재된 내용의 재확인이거나 기재 누락을 보완하는 수준으로, Rationale 상 기각된 결정과 충돌 없다.
  - 제안: 정합 확인 — 추가 조치 불요.

- **[INFO]** `spec/4-nodes/0-overview.md §1.0` bootstrap 주어 명확화
  - target 위치: `spec/4-nodes/0-overview.md §1.0`
  - 과거 결정 출처: `plan/in-progress/refactor/02-architecture.md` M-3 / C-1 step1 — "bootstrap 주체(`NodeComponentRegistry`)는 spec 명시, **호출 위치는 무언급** — 이동은 구현 재량"; `spec/4-nodes/0-overview.md` L55 (현재 기술: "서버 부팅 시 `NodeBootstrapService.onModuleInit`이 `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출하고")
  - 상세: L55 를 확인한 결과 `spec/4-nodes/0-overview.md` 에는 이미 `NodeBootstrapService.onModuleInit` 이 명시되어 있다. target 이 제안하는 변경은 현재 텍스트 상태와 사실상 동일하다 — 이미 적용된 것일 가능성이 있다. Rationale 위반은 없다.
  - 제안: 반영 전 실제 파일 현재 상태 확인 권장. 이미 적용된 경우 변경 생략.

---

## 요약

target 문서(`spec-update-engine-split.md`)는 C-1 god-class strangler-fig 분할이 완료된 후의 spec 포인터 갱신 및 Rationale 신설을 다루는 문서 정합성 작업이다. 검토한 모든 항목 — `EngineDriver` in-process 전제, `WorkflowExecutor` 재사용 기각, `ExecutionEventEmitter` 직접 주입 유지, `previousOutput` Phase 3 예외, `button_continue` optional 필드 등재 — 이 기존 `spec/5-system/4-execution-engine.md ##Rationale`, `spec/0-overview.md ##Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"`, `plan/in-progress/refactor/02-architecture.md` C-1 결정과 완전히 정합한다. 기각된 대안(per-node task queue, WorkflowExecutor 재사용, 이벤트 추상화 도입, 분산 분리)을 재도입하는 항목이 없으며, 합의된 원칙(in-process dispatch, 단일 sink, strangler-fig 연속)을 무시하는 설계도 없다. `spec/4-nodes/0-overview.md §1.0` 의 경우 현재 파일에 이미 `NodeBootstrapService.onModuleInit` 이 기재된 것으로 확인되어 실질적 변경이 없을 수 있다 — 적용 전 재확인이 권장되지만 Rationale 상 이슈는 아니다.

---

## 위험도

NONE
