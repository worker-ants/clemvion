# 신규 식별자 충돌 분석 — spec/5-system/4-execution-engine.md (--impl-prep)

검토 모드: 구현 착수 전 (--impl-prep)  
대상 plan: `plan/in-progress/refactor/c1-engine-split.md` (PR1 NodeBootstrapService + WORKFLOW_EXECUTOR 토큰)  
검토 브랜치: `claude/engine-split-s1-nodebootstrap`

---

## 발견사항

### 발견사항 없음 — PR1 범위 (NodeBootstrapService + WORKFLOW_EXECUTOR 토큰)

PR1 이 도입하는 신규 식별자는 아래 두 가지다.

**`WORKFLOW_EXECUTOR` (DI 주입 토큰 상수)**

- target 신규 식별자: `WORKFLOW_EXECUTOR` 심볼/문자열 상수 (plan 체크리스트: `workflow-executor.interface.ts` 에 co-locate)
- 기존 사용처: 없음. `grep -r "WORKFLOW_EXECUTOR"` 결과 0건.
- 비고: `WorkflowExecutor` 인터페이스 자체는 `codebase/backend/src/nodes/core/workflow-executor.interface.ts` 에 이미 존재하며 `ExecutionEngineService` 가 구현 중이다. 토큰 상수만 새로 추가하는 것이므로 의미 충돌 없음. 기존 `EXECUTION_RUN_QUEUE` / `BACKGROUND_EXECUTION_QUEUE` / `CONTINUATION_EXECUTION_QUEUE` / `MONITORED_QUEUE_HANDLES` 등 기존 토큰들과 명칭 겹침 없음.

**`NodeBootstrapService` (NestJS 서비스 클래스)**

- target 신규 식별자: `NodeBootstrapService` 클래스, `node-bootstrap.service.ts` / `node-bootstrap.service.spec.ts` 파일
- 기존 사용처: `class NodeBootstrapService` — `grep -r "NodeBootstrapService"` 결과 0건. `OnApplicationBootstrap` 구현 클래스로는 `ChatChannelModule`, `StuckDocumentRecoveryService` 가 있으나 명칭 충돌 없음.
- 비고: `NodeComponentRegistry.bootstrap()` 메서드(`node-component.registry.ts:bootstrap`)와 명칭 의미는 관련있지만 서로 다른 아티팩트 타입(메서드 vs 서비스 클래스)이고 호출 관계가 명확하므로 혼동 위험 없음.

---

### [WARNING] PR3 미래 충돌 예고 — `InteractionService` 이름 중복

- target 신규 식별자: plan PR3 항목 "Form/Button `InteractionService`" — `waitForFormSubmission`/`processFormResumeTurn`/`waitForButtonInteraction`/`processButtonResumeTurn` 을 execution-engine 모듈 내 신규 서비스로 추출 예정
- 기존 사용처: `codebase/backend/src/modules/external-interaction/interaction.service.ts:57` — `export class InteractionService` 가 이미 존재. spec 6개소 이상에서 `InteractionService.interact()` 로 인용 (`spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/12-webhook.md`, `spec/data-flow/15-external-interaction.md`)
- 상세: 두 클래스가 같은 이름을 사용하면 import 경로가 달라도 (`external-interaction/interaction.service` vs `execution-engine/interaction.service` 등) NestJS DI container 에서 타입 이름 기반 추론·에러 메시지·검색 시 혼동이 생긴다. 특히 spec 이 `InteractionService.interact()` 를 고유 인터페이스로 인용하므로, execution-engine 내 동명 서비스는 spec 가독성도 해친다.
- 제안: PR3 착수 시 execution-engine 내 추출 서비스를 `FormButtonInteractionService` 또는 `BlockingInputService` 등 엔진 내부 역할을 명시하는 이름으로 구분한다. 현재(PR1) 는 블로킹 없음 — PR3 설계 전에 확인.

---

### [INFO] EngineDriver (PR2) — 사전 확인 결과

- target 신규 식별자: `EngineDriver` (plan PR2, 엔진 내부 전용 콜백 계약)
- 기존 사용처: `grep -r "EngineDriver"` 결과 0건. `class.*Driver` 패턴도 codebase 전체 0건.
- 상세: 충돌 없음. plan 이 명시한 "WorkflowExecutor 재사용 금지(engine↔노드 계약 의미 과적 회피)" 결정과 일치하며 명칭도 직교한다.

---

## 요약

PR1 (`NodeBootstrapService` + `WORKFLOW_EXECUTOR` 토큰) 도입 식별자는 codebase 어디에도 충돌 없다. 기존 `WorkflowExecutor` 인터페이스와 명칭은 공유하지만 아티팩트 종류(인터페이스 vs DI 토큰)가 다르고 같은 파일에 co-locate 하는 plan 설계가 오히려 명확하다. PR2 (`EngineDriver`)도 충돌 없다. 주의가 필요한 것은 PR3 에서 `InteractionService` 라는 이름을 execution-engine 내부 서비스에 재사용하면 기존 `external-interaction/interaction.service.ts` 와 동명 충돌이 발생한다는 점 — 현재 브랜치는 아직 PR1 단계이므로 즉각 차단은 아니나 PR3 설계 시 반드시 이름을 구분해야 한다.

## 위험도

LOW
