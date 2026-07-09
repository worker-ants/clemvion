# 정식 규약 준수 검토 — `spec/4-nodes/7-trigger/1-manual-trigger.md`

검토 모드: 구현 완료 후 (`--impl-done`, diff-base `origin/main`)
Target: `spec/4-nodes/7-trigger/1-manual-trigger.md` (본 PR 에서는 diff 없음 — 코드만 변경)

## 검토 방법

target 문서 자체는 이번 diff 에서 변경되지 않았다. 따라서 (a) target 문서의 기존 서술이 `spec/conventions/**` 규약과 여전히 부합하는지, (b) 이번 diff 로 새로 생긴 코드 표면(에러 코드 발행 경로, frontmatter 가 가리켜야 할 구현 파일, i18n 키 등)이 target 문서·관련 규약과 정합한지를 함께 점검했다. 주로 대조한 규약: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`, `spec/conventions/i18n-userguide.md`.

## 발견사항

- **[WARNING] frontmatter `code:` 가 이번 diff 로 새로 채워진 구현 surface 를 반영하지 않음**
  - target 위치: 문서 상단 frontmatter (`code:` 4개 항목, line 4-8)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface 의 구현 경로") · §3 (`status: implemented` 는 `code:` ≥1 매치 의무 — gate 자체는 기존 4개 파일로 여전히 통과하므로 CI 는 안 걸리지만, 규약이 의도하는 "약속 대 구현" 대응은 흐려짐)
  - 상세: 이번 diff 는 (1) `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts` — `config.parameters` 스키마 lookup 을 `category: NodeCategory.TRIGGER` 에서 `type: NODE_TYPES.MANUAL_TRIGGER` 로 교정해 §4 "사전 해석(어댑터 단계)" 이 설명하는 `defaultValue` 해석 자체가 정상 동작하게 만든 핵심 파일, (2) `codebase/backend/src/modules/workflows/workflows.service.ts` — §6 이 서술하는 "구조 위반은 저장 시점에 걸린다" 는 promise 를 신규로 실제 구현한 `validateManualTrigger()` 게이트(`INVALID_TRIGGER_PARAMETERS` 발행) — 를 수정/신설했다. 두 파일 모두 target frontmatter `code:` 목록(`manual-trigger.handler.ts`/`manual-trigger.schema.ts`/`resolve-trigger-parameters.ts`/`trigger-configs.tsx`)에 없다. `spec-impl-evidence.md` R-1 이 "글로브 기반이라 완전성은 `/spec-coverage` 가 보완" 이라고 명시적으로 이 gap 을 용인하므로 build 는 깨지지 않으나, 이번 PR 이 정확히 "spec 이 약속했지만 코드에 없던 surface 를 채우는" 케이스라는 점에서 frontmatter 갱신을 누락한 것은 이 규약이 방지하려는 상황(텔레그램 chat-channel 케이스, Overview 참조)의 축소판이다.
  - 제안: `code:` 에 `codebase/backend/src/modules/workflows/workflows.service.ts` 와 `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts` 추가.

- **[WARNING] §6 에러 코드 표가 신규 저장 시점 `INVALID_TRIGGER_PARAMETERS` 발행 경로를 반영하지 않음**
  - target 위치: §6 "에러 코드" — 상단 reason 코드 표(`invalid_schema` / `handler.validate (저장 시점)` 행) 및 하단 "실행 시점 어댑터별 누락(missing_required)" 표
  - 위반 규약: `spec/conventions/error-codes.md` Overview ("본 규율은 ... 프로젝트 전체의 에러 코드 문자열에 적용된다") + §1 의미 기반 명명(코드 하나가 가리키는 조건이 어디서 발행되는지 문서로 추적 가능해야 클라이언트/리뷰어가 신뢰) · `spec/conventions/node-output.md` Principle 11 (출력/에러 문서화 규칙 — 케이스별 완전성)
  - 상세: 하단 표는 `INVALID_TRIGGER_PARAMETERS` 를 "Manual (주 실행 경로) → `workflows.controller.ts`" 단일 처리 위치로만 매핑한다. 이번 diff 는 `workflows.service.ts`(`POST /:id/save` → `validateManualTrigger`)에서 **동일 코드**를 다른 메시지("Manual Trigger has an invalid parameter schema")로 신규 발행한다 — 확인: `git grep INVALID_TRIGGER_PARAMETERS` 결과 `workflows.controller.ts:309`(실행 경로, 기존) 와 `workflows.service.ts:613`(저장 경로, 신규) 두 곳. 상단 reason 표는 `invalid_schema` 의 시점을 "handler.validate (저장 시점)" 이라고만 적을 뿐 실제 HTTP `error.code` 값을 명시하지 않는다. 결과적으로 §6 만 읽어서는 "저장 시점 스키마 구조 위반이 어떤 `error.code` 로 응답되는가"를 알 수 없다. 캐노니컬 카탈로그(`spec/5-system/3-error-handling.md` §1.7 인근)도 현재 "Manual 실행 경로의 `INVALID_TRIGGER_PARAMETERS` 도 동일 헬퍼를 쓴다" 라고만 적어, 저장 경로 신규 발행처는 그쪽에도 아직 없다(참고용 — 해당 문서는 target 이 아니므로 본 리뷰의 판정 대상은 아님).
  - 제안: 하단 표에 "저장 시점(`POST /:id/save`, `invalid_schema`) → 400 `INVALID_TRIGGER_PARAMETERS` → `workflows.service.ts`" 행을 추가하거나, 상단 reason 표의 `handler.validate (저장 시점)` 행에 실제 발행 코드를 명시. `5-system/3-error-handling.md` 동기화는 별도 spec 문서 갱신 사항으로 위임 가능.

- **[INFO] §6 "handler.validate (저장 시점)" 표현이 실제 코드 경로와 어긋날 소지**
  - target 위치: §6 상단 reason 코드 표, "시점" 열
  - 위반 규약: 직접적인 conventions 조항 위반은 아님 — `spec-impl-evidence.md` 가 기대하는 "문서가 가리키는 구현 지점의 정확성" 과 맞물린 참고 사항
  - 상세: `workflows.service.ts` 신규 코드의 주석("Without this gate an invalid slot ... at runtime it then ... fails the run with a generic `INVALID_NODE_CONFIG` (the engine's handler.validate pre-flight)")을 보면, `ManualTriggerHandler.validate()` 는 여전히 **런타임 실행 pre-flight 전용**으로만 호출되고 있고, 신규 저장 시점 게이트는 `WorkflowsService.validateManualTrigger()` 안에서 `validateTriggerParameterSchema` 를 **직접 재호출**하는 별도 경로다(handler.validate() 를 부르지 않음). `git -C <worktree> grep -n "handler.validate\|NodeRegistry" codebase/backend/src/modules/workflows/workflows.service.ts` 로 확인해도 handler.validate 호출은 없다. §6 문구 "handler.validate (저장 시점)"은 "저장 시점에 handler.validate 가 호출된다"는 인상을 주지만 실제로는 로직만 공유하는(같은 `validateTriggerParameterSchema` 헬퍼) 독립 경로다.
  - 제안: 문구를 "config 저장 시점 (`WorkflowsService.validateManualTrigger` — `handler.validate` 와 동일 스키마 검증 헬퍼를 재사용)" 처럼 정정하면 인용 정확도가 오른다. CRITICAL 로 볼 사안은 아니다.

## 확인했으나 위반 없음 (참고)

- 신규 에러 코드/필드 코드 표기(`INVALID_TRIGGER_PARAMETERS`, `INVALID_SCHEMA` 등)는 `error-codes.md` §1 UPPER_SNAKE_CASE 규율, `node-output.md` §3.2 형식과 모두 일치.
- `BadRequestException({ code, message, details })` 봉투 형식은 기존 실행 경로와 동형이며 `GlobalExceptionFilter` → 공식 에러 봉투 규약(§api-convention §5.3)과 정합.
- `POST /:id/save` 의 `@ApiBadRequestResponse({ description: 'Manual Trigger 누락/중복 또는 입력값 검증 실패' })` 는 신규 검증 실패 사유를 포괄하는 범위라 `swagger.md` §2-4 상태코드 데코레이터 규칙 위반 없음.
- 프론트 신규 i18n 키(`errorNameRequired`/`errorNameInvalid`/`errorNameDuplicate`)는 `dict/ko`·`dict/en` 양쪽에 동시 추가돼 `i18n-userguide.md` Principle 1(하드코딩 금지)·Principle 2(ko/en parity) 를 모두 준수. 한국어 문구도 해요체(`-세요`/`-어요`) 로 Principle 6 글로서리 톤 규약과 일치.
- `load-trigger-parameter-schema.ts` 의 lookup 키 변경(`category`→`type`)은 `NODE_TYPES` 공용 상수를 사용해 새 식별자 리터럴을 만들지 않음 — 명명 규약 위반 없음.

## 요약

target 문서 자체는 이번 diff 로 직접 수정되지 않았으나, diff 가 §4/§6 이 이미 서술해 둔 "저장 시점 구조 검증"·"defaultValue 정상 해석" 약속을 실제로 구현한 결과, 문서(및 frontmatter)가 새 구현 surface를 따라잡지 못한 두 군데 간극이 발견됐다 — frontmatter `code:` 미갱신(spec-impl-evidence.md)과 §6 에러 코드 표의 신규 저장 경로 미반영(error-codes.md/node-output.md). 두 건 모두 CI 게이트를 깨뜨리지 않는 문서 완전성 수준의 문제이며, 명명·포맷·금지 패턴 등 하드 위반은 발견되지 않았다. i18n·swagger·에러 봉투 형식은 모두 기존 규약과 일치했다.

## 위험도

LOW
