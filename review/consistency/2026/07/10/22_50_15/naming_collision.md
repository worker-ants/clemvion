# 신규 식별자 충돌 검토 — EIA `ButtonsContextDto` / `NodeOutputContextDto`

검토 모드: `--impl-prep` (구현 착수 전), scope = `spec/5-system/14-external-interaction-api.md`

## 점검 범위

구현이 도입할 신규 식별자는 정확히 2개:
- `ButtonsContextDto` (신설, `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`)
- `NodeOutputContextDto` (신설, 동일 파일)

그 외 `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `currentNode` 필드 타입 변경(신규 식별자 아님, 기존 필드의 타입 정정: `string | null` → 실제 wire 인 객체 `{id,type,interactionType}`)도 참고로 확인.

## 발견사항

- **[INFO]** `ButtonsContextDto` / `NodeOutputContextDto` — 신규 식별자, 코드 충돌 없음
  - target 신규 식별자: `ButtonsContextDto`, `NodeOutputContextDto`
  - 기존 사용처: `spec/conventions/swagger.md:93-103` (동일 branch 의 선행 커밋 `a02db4f9a`, `docs(spec): EIA context 닫힌 union 스키마화 규약...`) 에서 §1-4 "닫힌 union" 패턴의 **예시**로 이미 언급되어 있음. `codebase/` 전체(backend/frontend/channel-web-chat/packages) grep 결과 두 이름 모두 **실제 코드에는 아직 존재하지 않음** — `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 의 현재(구현 전) `ExecutionStatusDto.context` 는 여전히 `Record<string, unknown> | null` + `additionalProperties: true` 로 선언되어 있고, `ContextDto` 접미사를 가진 클래스는 프로젝트 어디에도 없음(`grep -rn "ContextDto" codebase/` 0건).
  - 상세: swagger.md 의 언급은 "다른 의미로 이미 쓰이는 기존 정의"가 아니라, **같은 작업 계열의 선행 spec 커밋이 미리 못박아 둔 정식 예시**다(동일 worktree/브랜치, 아직 `origin/main` 미머지: `git log origin/main..HEAD` = `a02db4f9a` 단일 커밋). 즉 target 문서(`14-external-interaction-api.md`)와 swagger.md 는 같은 설계를 공유하는 자매 문서이며, 이번 구현은 그 예시를 실제 코드로 구체화하는 것 — 충돌이 아니라 **의도된 정합**이다.
  - 제안: 조치 불필요. 구현 시 두 클래스가 swagger.md §1-4 예시 코드의 필드 shape(`context?: ButtonsContextDto | NodeOutputContextDto | null`, `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto)`)과 일치하는지만 확인.

- **[INFO]** `ExecutionContext*` 접두 회피 판단 — 타당함
  - target 신규 식별자: (회피된 이름) `ExecutionContext*` 계열 명명을 의도적으로 쓰지 않음
  - 기존 사용처: `codebase/backend/src/nodes/core/node-handler.interface.ts` 의 엔진 런타임 `ExecutionContext` — grep 결과 `codebase/backend/src/**` 전역 100+ 파일(노드 핸들러 전수·`execution-engine` 모듈 대부분)에서 참조되는 핵심 타입. SoT 는 `spec/conventions/execution-context.md`(God Object 방지 규약, 원칙 1~4).
  - 상세: 엔진 `ExecutionContext` 는 "노드 핸들러에 주입되는 실행 상태 객체"라는 완전히 다른 의미 축이다. 만약 `ExecutionContextDto` 류 이름을 썼다면 (a) grep/IDE 자동완성에서 엔진 타입과 뒤섞이고, (b) `execution-context.md` 규약(필드 분류 원칙)이 이 DTO에도 적용되는 것으로 오인될 위험이 있었다. `ButtonsContextDto`/`NodeOutputContextDto` 는 이 축과 어휘적으로 겹치지 않는다.
  - 제안: 조치 불필요 — 현재 선택이 올바른 회피다.

- **[INFO]** `ButtonConfig` 와의 근접명 — 구분 가능, 관계 명확화 권장
  - target 신규 식별자: `ButtonsContextDto`
  - 기존 사용처: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` (`export interface ButtonConfig { buttons: ButtonDef[]; buttonItemMap?: ... }`), `codebase/frontend/src/components/editor/run-results/button-config.ts` (`export interface ButtonConfig { buttons: ButtonDef[] }`) — 둘 다 노드 버튼 설정 자체의 shape.
  - 상세: 이름이 `Button**Config**` vs `Button**s**Context**Dto**` 로 어휘가 겹치지 않게 충분히 벌어져 있다(단수/복수, Config/Context, Dto 접미사 유무). 다만 target spec 상 `ButtonsContextDto` 는 내부에 `buttonConfig` 필드(키 이름 그대로, `{buttons, nodeOutput}` shape)를 담을 것으로 보이는데(`spec/5-system/14-external-interaction-api.md` 의 wire 예시: `"buttonConfig": { "buttons": [...], "nodeOutput": {...} }`), 이 `buttonConfig` sub-object 자체를 향후 별도 DTO 클래스로 승격할 경우 `ButtonConfig`(기존, 버튼 정의 shape) 와 `ButtonConfigDto`(신규, 있다면) 이름이 매우 근접해질 수 있다. 이번 구현 범위(2개 클래스, `context` 필드 레벨만 닫힌 union화)에서는 해당 sub-object 가 여전히 `additionalProperties: true` 로 열려 있을 전망(swagger.md 개정 근거: "봉투만 스키마화하고 내부는 열어 둔다")이라 지금 당장 충돌은 없음.
  - 제안: 조치 불필요(현재 범위 내 충돌 없음). 향후 `buttonConfig`/`nodeOutput` 내부까지 스키마화하는 후속 작업이 생기면, 그때 `ButtonConfig`(기존 버튼 정의 인터페이스)와 신규 DTO 이름이 겹치지 않도록 `Buttons*ConfigDto` 류가 아닌 명확히 구분되는 접미사(예: `ButtonInteractionConfigDto`)를 쓰도록 미리 표시해 둔다.

- **[INFO]** `NodeOutputContextDto` 와 `node-output.md` 규약 — 명명 충돌 없음
  - target 신규 식별자: `NodeOutputContextDto`
  - 기존 사용처: `spec/conventions/node-output.md` (노드 output 공용 규약, `output.result`/`output.error` 등 필드 명세) — TS 식별자 `NodeOutput`(interface/type/class) 는 어디에도 export 되어 있지 않음(`grep -rn "\bNodeOutput\b" codebase/backend/src` 결과 없음; 소문자 필드명 `nodeOutput` 만 wire/DTO 필드 키로 쓰임).
  - 상세: `NodeOutputContextDto` 는 EIA `context` 필드가 `nodeOutput` 키를 담는 variant 를 표현하는 DTO로, 필드 키 이름(`nodeOutput`)을 그대로 딴 자연스러운 명명이다. `node-output.md` 규약 문서는 TS 타입을 export 하지 않는 문서이므로 실제 코드 레벨 충돌 가능성이 없다.
  - 제안: 조치 불필요.

- **[INFO]** `ExternalInteractionType` — export/scope 확인 결과 정상
  - target: `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `currentNode` 타입 변경이 참조.
  - 기존 사용처: `eia-types.ts:26` 에서 이미 `export type ExternalInteractionType = "form" | "buttons" | "ai_conversation";` 로 정의·export 되어 있고, 같은 파일 내부(`WaitingForInputEvent`)와 `widget-state.ts`, `eia-events.ts` 에서 import/사용 중.
  - 상세: `currentNode` 필드 타입을 `string | null` → `{ id: string; type: string; interactionType: ExternalInteractionType | null } | null`(추정, backend `responses.dto.ts` 의 `currentNode` shape 과 정합) 로 바꿀 때 `ExternalInteractionType` 은 **같은 파일 내에 이미 존재**하므로 추가 import 불필요, in-scope 확인됨. 새 식별자를 도입하지 않는다는 전제와 일치.
  - 제안: 조치 불필요. 구현 시 `currentNode.interactionType` 의 타입을 `ExternalInteractionType | null` 로 맞추면 backend DTO(`responses.dto.ts` 의 `currentNode?.interactionType: 'form' | 'buttons' | 'ai_conversation' | null`)와 문자열 리터럴 유니온이 1:1 대응하는지만 재확인.

## 그 외 점검 관점 (해당 사항 없음)

- **요구사항 ID 충돌**: target 변경은 `spec/5-system/14-external-interaction-api.md` 의 응답 스키마·부재 표현 서술 정정이며 새 요구사항 ID(`EIA-*` 등)를 부여하지 않음. N/A.
- **API endpoint 충돌**: 신규 endpoint 없음(기존 `GET /api/external/executions/:id` 응답 shape 정교화). N/A.
- **이벤트/메시지명 충돌**: 신규 SSE/webhook/queue 이벤트명 없음. N/A.
- **환경변수·설정키 충돌**: 신규 ENV/config key 없음. N/A.
- **파일 경로 충돌**: `responses.dto.ts` 는 기존 파일(신규 파일 아님, 기존 파일에 클래스 2개 추가) — 경로 컨벤션 위반이나 기존 파일과의 경합 없음.

## 요약

target 이 도입하는 두 신규 식별자(`ButtonsContextDto`, `NodeOutputContextDto`)는 `codebase/` 전체를 grep 한 결과 기존 exported class/interface/type 어디와도 이름이 겹치지 않는다. 유일하게 사전에 이 이름들을 언급한 곳은 같은 작업(동일 worktree, 아직 `origin/main` 미머지 커밋 `a02db4f9a`)이 먼저 갱신한 `spec/conventions/swagger.md` §1-4 의 정식 예시 코드로, 이는 충돌이 아니라 자매 spec 문서 간 의도된 명명 정합이다. `ExecutionContext*` 접두를 피한 판단은 엔진 런타임 `ExecutionContext`(100+ 파일, `spec/conventions/execution-context.md` SoT)와의 실질적 혼동을 사전에 차단하는 올바른 선택으로 확인됐다. 근접명 후보(`ButtonConfig`, `node-output.md`)는 접미사·수식어 차이로 충분히 구분되며 당장의 충돌은 없고, 향후 `buttonConfig`/`nodeOutput` 내부까지 스키마화가 확장될 경우에 한해 재검토가 필요한 잠재 항목으로만 남긴다. `eia-types.ts` 의 `currentNode` 타입 변경이 참조하는 `ExternalInteractionType` 은 같은 파일 내에 이미 export 되어 있어 scope 문제가 없다. 전반적으로 이번 변경은 신규 식별자 충돌 관점에서 안전하다.

## 위험도

NONE
