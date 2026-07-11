# 신규 식별자 충돌 검토 — spec-draft-eia-context-schema-absence-convention

> 검토 대상: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md`
> 검토 모드: spec draft 검토 (--spec)
> 비고: orchestrator 가 전달한 payload 코퍼스(`_prompts/naming_collision.md`)에는 `spec/5-system/2-api-convention.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/swagger.md`, 백엔드 DTO 파일의 실제 본문이 포함돼 있지 않아, 본 검토는 워크트리의 실제 파일을 직접 Read/Grep 하여 수행했다.

## 발견사항

- **[WARNING]** `§5.4` 참조가 EIA 문서 **자기 자신의 기존 §5.4** 와 동일 문서 내에서 무규정(bare) 충돌
  - target 신규 식별자: `api-convention.md` 신규 `### 5.4 부재 표현 — null vs 키 생략` + 갭3 항목 "EIA §R17 → 부재 표현이 SSE parity 에서 파생됨을 **§5.4 참조**로 1문장" (target 본문 128–131행, qualifier 없는 두 번째 불릿)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:473` `### 5.4 명시적 취소 — POST /api/external/executions/:executionId/cancel`
  - 상세: target 의 갭3 두 불릿 중 첫째("EIA §5.3 의 키 생략 문단 → 새 `api-convention §5.4` 로 링크")는 파일명을 정확히 qualify 했으나, 둘째("EIA §R17 → ... §5.4 참조로 1문장")는 파일명을 생략했다. 이 문장이 문자 그대로 EIA 문서의 `### R17` 절(923줄 아래, 같은 문서 내 `### 5.4 명시적 취소` 로부터 약 630줄 떨어진 동일 파일)에 삽입되면, 독자는 "§5.4"를 EIA 자신의 §5.4(취소 엔드포인트)로 오독할 개연성이 높다 — 두 "§5.4" 는 완전히 다른 의미(신규 api-convention.md 의 null-vs-omission 규칙 vs. 기존 EIA 의 cancel endpoint)이며 같은 문서 안에서 경합한다. 프로젝트 관행(본 코퍼스 전역에서 예외 없이 확인됨)은 cross-doc 참조 시 항상 `[Spec XXX §N.N](link)` 형태로 문서명을 명시하는 것이며, 이 자리만 그 관행에서 이탈한다.
  - 참고: `spec/conventions/swagger.md` §5-4("새 엔드포인트 체크리스트"), `spec/5-system/15-chat-channel.md` §5.4("Bot Token rotation API 응답 계약"), `spec/5-system/8-embedding-pipeline.md` §5.4 등 프로젝트 전역에 "§5.4" 섹션이 다수 존재하지만, 이들은 전부 **다른 파일**이라 완전 경로로 링크하는 한 문제가 없다. 실질 위험은 **동일 문서 내 자기참조**인 이 한 곳뿐이다.
  - 제안: 실제 EIA §R17 편집 시 "…SSE parity 에서 파생됨을 [API 규약 §5.4](./2-api-convention.md#54-부재-표현--null-vs-키-생략) 참조로 1문장" 처럼 파일명+링크를 반드시 명시한다. target 본문(갭3 두 번째 불릿)도 동일하게 qualifier 를 추가해 두면 향후 반영 시 실수를 방지한다.

- **[WARNING]** EIA `context` variant DTO 명명 미확정 — `ExecutionContext`(엔진 런타임 개념)와의 잠재 충돌
  - target 신규 식별자: target 은 봉투/variant DTO 의 구체 클래스명을 명시하지 않고 `codebase/**` 구현(developer)에 위임한다(체크리스트 마지막 항목). swagger.md §1-4 개정안 예시는 `VariantA`/`VariantB` placeholder 뿐이다.
  - 기존 사용처: `codebase/backend/src/nodes/core/node-handler.interface.ts:31` `export interface ExecutionContext { ... }` — 워크플로우 엔진이 노드 핸들러에 dispatch 직전 주입하는 **런타임 실행 컨텍스트**(workflowId/executionId/variables/nodeOutputCache 등). SoT 는 `spec/conventions/execution-context.md`(별도 정식 규약 문서, God-Object 방지용 필드 분류 체계 보유). 백엔드에는 이미 `ParallelBranchContext`, `AuthContext`, `WebhookAuthContext`, `ExecutionRoutingContext` 등 다수의 `*Context` 인터페이스가 공존하지만, 전부 접두 qualifier 로 구분돼 있어 `ExecutionContext` 단독명과는 겹치지 않는다.
  - 상세: EIA `getStatus.context` 필드(`ExecutionStatusDto.context`, `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:102`)는 "대기 중인 인터랙션 상태"를 나타내는 **완전히 다른 개념**(엔진 내부 실행 상태가 아니라 외부 API 소비자용 waiting-for-input 스냅샷)이다. 그런데 본 작업의 worktree/plan 명칭 자체가 `eia-execution-context-schema`이고, target 문서 제목도 "`getStatus.context` 스키마화"다 — 구현 단계에서 자연스럽게 `ExecutionContextDto` 또는 `GetExecutionContextDto` 류의 이름을 선택할 유인이 크다. 이 경우 이미 `execution-context.md` 가 SoT 로 소유한 `ExecutionContext` 라는 이름을 API 응답 DTO 가 재사용하게 되어, "ExecutionContext" 라는 용어가 (a) 엔진이 노드에 주입하는 실행 컨텍스트, (b) EIA 외부 API 가 노출하는 대기-상태 봉투 — 두 가지 의미로 갈리는 CRITICAL 급 혼선을 유발할 수 있다.
  - 제안: target 체크리스트("구현 위임 (developer)")에 명명 가드 한 줄을 추가한다 — 예: "봉투/variant DTO 명은 `ExecutionContext*` 접두를 예약어로 취급해 피한다(엔진 런타임 개념과 충돌, SoT `spec/conventions/execution-context.md`). 대안: `WaitingForInputContextDto`/`InteractionContextDto` 등, 프런트 `eia-types.ts` 의 기존 `WaitingForInputEvent` 명명과 정렬." 이는 CRITICAL 화를 사전에 막는 예방적 WARNING 이다(현재 target 은 구체 이름을 확정하지 않았으므로 아직 실제 충돌은 아님).

- **[INFO]** "부재 표현" / "present-when-available" — 기존 어휘와 충돌 없음(확인 완료)
  - target 신규 식별자: `api-convention.md` 신규 절 제목 `5.4 부재 표현` + 본문의 "present-when-available" 표기
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:442` "SSE wire 도 동일하게 present-when-available, 위젯은 부재를 빈 히스토리로 graceful 처리"
  - 상세: "present-when-available" 은 이미 EIA §5.3 본문(2026-07-09 R17 재조정 커밋)에 존재하는 용어이며, target 의 Rationale 표는 이를 **선례로 명시 인용**하고 있다(새 발명이 아니라 성문화라고 스스로 밝힘). "부재 표현" 이라는 절 제목 문자열 자체는 `spec/` 전체에서 이번이 최초 등장(기존 heading·본문 어디에도 없음) — 새 헤딩이 기존 헤딩과 텍스트 충돌하지 않는다. 두 용어 모두 안전하게 신설 가능하다.
  - 제안: 없음(조치 불요). target 이 이미 올바르게 선례를 cross-ref 하고 있다.

- **[INFO]** `api-convention.md` §5.4 신설 자체는 자기 문서 내 충돌·연쇄 재번호 위험 없음(확인 완료)
  - target 신규 식별자: `spec/5-system/2-api-convention.md` `### 5.4 부재 표현`
  - 기존 사용처: 없음 — 해당 파일의 기존 §5 하위는 5.1(단일 리소스)/5.2(목록 응답)/5.3(에러 응답) 3개뿐이며 5.4 는 비어 있다.
  - 상세: `## 6. HTTP 상태 코드` 이하는 최상위 `##` 헤딩이라 `### 5.4` 삽입으로 밀리지 않는다. `spec/` 전체를 grep 한 결과 `api-convention.md#5-4`(또는 `#54-...`) 를 가리키는 inbound 링크는 현재 하나도 없어(기존 §5.1~§5.3 참조만 다수 존재), 신설 앵커가 다른 문서의 기존 링크를 오염시키거나 끊을 위험이 없다.
  - 제안: 없음(조치 불요).

## 요약

target 이 직접 도입하는 식별자(신규 요구사항 ID·엔티티명·endpoint·이벤트명·ENV/config 키·spec 파일 경로) 차원에서는 실질 충돌이 없다 — `api-convention.md` §5.4 는 해당 파일에 비어 있던 자리이고, "부재 표현"/"present-when-available" 은 기존 EIA 선례를 그대로 인용한 것이며, plan 파일명도 기존 컨벤션과 충돌하지 않는다. 다만 두 가지 예방적 위험이 있다: (1) target 갭3 의 EIA §R17 cross-ref 문구가 파일명 qualifier 없이 "§5.4 참조"라고만 적혀 있어, 그대로 반영되면 EIA 문서 자신이 이미 보유한 §5.4(명시적 취소 endpoint)와 같은 문서 내에서 혼동을 일으킬 수 있다 — 실제 편집 시 반드시 "[API 규약 §5.4]" 형태로 qualify 해야 한다. (2) target 이 EIA `context` variant DTO 의 구체 클래스명을 확정하지 않고 구현에 위임했는데, 이 작업의 문맥(`getStatus.context` 스키마화, worktree 명 `eia-execution-context-schema`) 상 구현자가 무의식적으로 `ExecutionContext*` 접두 이름을 고를 유인이 크고, 이는 이미 `spec/conventions/execution-context.md` 가 SoT 로 소유한 엔진 런타임 개념(`node-handler.interface.ts` `ExecutionContext`)과 의미가 전혀 다르면서 이름만 겹치는 CRITICAL 급 혼선으로 이어질 수 있다 — 지금 단계에서 명명 가드 한 줄을 체크리스트에 박아두는 것을 권한다. 두 항목 모두 현재는 아직 구체화되지 않은 예방적 리스크이므로 BLOCK 사유는 아니다.

## 위험도

LOW
