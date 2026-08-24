STATUS=success convention_compliance review complete (target: spec/5-system/6-websocket-protocol.md)
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `spec/5-system/6-websocket-protocol.md`

## 방법론 note (분석 신뢰도에 영향)

전달된 `_prompts/convention_compliance.md` 번들에서 `spec/conventions/node-output.md` ·
`egress-masking.md` · `error-codes.md` · `node-cancellation.md` · `swagger.md` ·
`interaction-type-registry.md` 등 target 문서가 가장 많이 인용하는 핵심 conventions 문서
**본문이 "컨텍스트 예산 초과" 로 전부 절단**되어 있었다(각 5,684~25,756자 원문이 헤더만 남음).
번들만으로는 이 검토가 성립하지 않아, 위 conventions 파일들과 target 문서 전문을 저장소에서
직접 Read 하여 대조했다. (기존 교훈: `feedback_consistency_spec_mode_budget.md` 와 같은 클래스의
예산 갭 — 이번엔 `--impl-prep` 모드에서도 재현됨.)

## 검토 범위

target 은 `spec/5-system/6-websocket-protocol.md` (1143줄) 단일 파일. 아래 conventions 문서
전문을 직접 대조했다: `node-output.md`, `node-cancellation.md`, `error-codes.md`,
`egress-masking.md`, `redis-keys.md`, `interaction-type-registry.md`, `conversation-thread.md`
(관련 절), `swagger.md`(적용 여부 확인용), `spec-impl-evidence.md`(frontmatter 스키마).

## 발견사항

- **[WARNING]** `background:run:{id}` 채널이 §3.2 채널 패턴 표에서 누락 — §3.3 인가 표에만 등장
  - target 위치: `spec/5-system/6-websocket-protocol.md` §3.2 "채널 패턴" 표 (전체) vs §3.3 "권한 검증" 표의 `background:run:{id}` 행
  - 위반 규약: `spec/conventions/redis-keys.md` §4 "인접 네임스페이스" 표 — `background:run:<id>` · `execution:<id>` · `workflow:<id>` 3개 Socket.IO 채널의 **SoT 를 본 WebSocket 문서(§채널)로 명시 지목**
  - 상세: target §3.2 는 채널 4종(`execution:{executionId}` / `workflow:{workflowId}` / `kb:{documentId}` / `notifications:{userId}`)만 나열하고, §3.3 인가 표에만 `background:run:{id}` 행이 등장한다(패턴·목적·발행 이벤트 설명 없이). `redis-keys.md` 가 이 문서를 `background:run:<id>` 채널의 SoT 로 명시했음에도, 정작 그 채널이 이 문서의 "채널" 섹션(§3.2)에는 정의되지 않는다. 실측(`grep -rn "background:run" spec/`)하면 그 채널의 실질 정의(패턴·발행 이벤트 `execution.background_run.started/completed`·payload shape·unsubscribe 시점)는 `spec/4-nodes/1-logic/12-background.md` §8.5 와 `spec/3-workflow-editor/3-execution.md` 에 흩어져 있다 — `redis-keys.md` 의 포인터가 가리키는 문서와 실제 정의가 있는 문서가 어긋난다.
  - 제안: (a) target §3.2 표에 `background:run:{id}` 행을 추가하고 `12-background.md §8.5` 로 상세를 위임하는 캐비엇을 붙이거나, (b) `redis-keys.md` §4 의 포인터를 `[Background §8.5](../4-nodes/1-logic/12-background.md)` 로 정정 — 어느 쪽이든 "SoT 문서" 와 "실제 정의 위치" 를 일치시켜야 한다. target 문서 단독 수정이면 (a) 가 최소 변경.

- **[INFO]** `duration` vs `durationMs` 필드명 — 이미 자각·기록된 표기 차이
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.completed` 행(`{ …, output, duration }`) 및 §4.1 하단 "종결 3종" 블록쿼트 마지막 줄
  - 위반 규약: `spec/conventions/node-output.md` §Principle 2 — `meta.durationMs: number` 가 공통 canonical 필드명
  - 상세: WS 봉투 필드명이 `duration` 인데 node-output.md 의 canonical 이름은 `durationMs` 다. target 문서 스스로 "`durationMs` 를 본 문서 계열이 `duration` 으로 적어 온 표기 차이는 그대로 둔다(같은 값)" 이라고 명시해 두어 CRITICAL 급 미인지 drift 는 아니다.
  - 제안: 조치 불요(문서가 의도적으로 남긴 기록). 다음에 이 표를 만지는 사람이 "왜 다른가" 를 재조사하지 않도록 이 한 줄을 지우지 말 것.

- **[INFO]** API 문서 규약(perspective #4, swagger/OpenAPI 데코레이터·DTO 명명)은 target 에 해당 없음
  - 상세: target 은 Socket.IO 프로토콜 문서로 REST DTO/`@ApiProperty` 데코레이터를 정의하지 않는다. `spec/conventions/swagger.md` 는 NestJS Swagger 플러그인 기반 REST DTO 문서화 전용 규약이라 이 문서엔 적용 대상이 없다. (§4 관점에서 별도 결함 없음 — 커버리지 확인 목적의 기록.)

## 확인된 양호 사항 (violation 아님, 교차검증 근거로 기록)

- 문서 구조: `## Rationale` 섹션 보유(§끝, 1019행대). `## Overview` 는 없지만 `spec/5-system/` 이 다중 파일 영역이라 `_product-overview.md` 로 분리되는 정상 패턴(project-planner SKILL.md "Spec 문서 구조" 표의 명시 예외) — 실측 확인함.
- frontmatter: `id: websocket-protocol` (basename 기반 kebab-case), `status: partial` + `pending_plans:` 조합이 `spec-impl-evidence.md` §2.1/§3 규칙과 일치. `pending_plans` 경로(`plan/in-progress/spec-sync-websocket-protocol-gaps.md`) 실존 확인.
- `output.error` 표준 형태(§4.1 `execution.node.failed`)가 `node-output.md` §3.2/§3.2.1 과 정확히 일치(`code`/`message`/`details.retryable`/`retryAfterSec`).
- `NodeHandlerOutput` 5필드 규약(§4.4 `buttonConfig.nodeOutput`)이 `node-output.md` Principle 0/1.1.4 와 정확히 일치(`type` 판별자 미포함 근거까지 인용).
- `AbortError` / `ExecutionCancelledError` 두 sentinel 분류(§4.1 `execution.node.cancelled`)가 `node-cancellation.md` §5.1 및 `error-codes.md` §3 historical-artifact 레지스트리 행과 정합.
- `MAX_SANITIZE_DEPTH` vs REST 값-마스커 상한의 "별개 불변식(비교 연산자 차이로 한 칸 다름)" 서술(§4.1 캐비엇)이 `egress-masking.md` §1/§1.1 과 정확히 일치.
- `interactionType` 4값(`form`/`buttons`/`ai_conversation`/`ai_form_render`, §4.4)이 `interaction-type-registry.md` §1.1 내부 enum 과 일치.
- `messages[].source` 2값(`live`/`injected`) ↔ 내부 `ConversationTurnSource` 5값 매핑(§4.4.6)이 `conversation-thread.md` §1.1 의 5값(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`) 정의와 정확히 일치.
- WS 전용 `INVALID_EXECUTION_STATE` vs REST core `INVALID_STATE`(422) vs EIA REST `STATE_MISMATCH`(409) 3-way 표기 분리(§4.2)가 `3-error-handling.md` §1.3/§1.5 의 "의도적 결정" 서술과 정합.
- 에러 코드는 전부 `UPPER_SNAKE_CASE`로 `error-codes.md` §1 표기 규칙 준수(예외 레지스트리에 해당하는 lowercase/PascalCase 코드는 target 범위 밖).

## 요약

target 문서는 정식 규약(spec/conventions/**) 준수 관점에서 전반적으로 매우 높은 정합도를 보인다 — `node-output.md`, `node-cancellation.md`, `error-codes.md`, `egress-masking.md`, `interaction-type-registry.md`, `conversation-thread.md` 등 다수 conventions 의 세부 조항(필드 shape·명명 규칙·역사적 예외)을 정확히 인용·반영하고 있으며, 의도적 표기 차이는 스스로 Rationale 에 기록해 두었다. 유일한 실질적 gap 은 `redis-keys.md` 가 이 문서를 SoT 로 지목한 `background:run:{id}` 채널이 정작 이 문서의 채널 정의 섹션(§3.2)에 없고 인가 표(§3.3)에만 등장한다는 점으로, 이는 다른 규약 문서가 기대하는 소유 범위와 실제 문서 내용 사이의 완전성 gap 이다(CRITICAL 은 아님 — 실제 정의는 다른 spec 파일에 존재하고 인가 로직 자체는 정상 문서화됨). 번들 payload 의 컨텍스트 예산 절단으로 인해 핵심 conventions 원문이 배달되지 않은 상태였음을 함께 기록한다.

## 위험도

LOW
