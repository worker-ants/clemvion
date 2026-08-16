# 정식 규약 준수 검토 — spec/5-system/ vs spec/conventions/

검토 모드: `--impl-prep` (구현 착수 전), scope = `spec/5-system/`. 실제 예정 작업은
`plan/in-progress/eia-fanout-and-internal-data-masking.md` (WS `execution.node.*`/`execution.*`
fanout 값-패턴 마스킹 + REST `inputData`/`outputData` 마스킹) — 아직 spec 본문에 반영 전이므로
본 검토는 **현재 커밋된 spec/5-system/ 본문**이 `spec/conventions/**` 을 준수하는지를 본다.

## 검토 범위

- 전문 로드: `2-api-convention.md`, `3-error-handling.md`, `6-websocket-protocol.md`,
  `12-webhook.md`, `14-external-interaction-api.md` (프롬프트 번들에 완전 포함).
- 컨텍스트 예산 초과로 번들에서 생략된 `spec/5-system/*`(1-auth, 4-execution-engine,
  15-chat-channel 등)와 다수 `spec/conventions/*`(swagger.md, error-codes.md, node-output.md,
  redis-keys.md, migrations.md, interaction-type-registry.md, spec-impl-evidence.md 등)는
  직접 `Read` 로 원본을 열어 대조했다.

## 발견사항

- **[WARNING] WS 이벤트 필드명 drift(`nodeName` vs `nodeLabel`)가 문서 자체 승격 경로에서 누락 추적**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표 — `execution.node.started` /
    `.completed` / `.failed` / `.skipped` 4행 (`payload` 열에 `nodeName` 표기) + 바로 아래
    `> **Note (spec drift)**` 블록.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 (`status: partial` → `pending_plans:` 가
    "미구현 surface 를 책임지는 plan" 을 실제로 담아야 하고, §3.1 "마지막 `pending_plans` 가
    `complete/` 로 이동하는 commit 안에서 `implemented` 로 승격" — 즉 pending_plans 항목이
    비워지면 문서가 자동으로 "완결"로 간주된다).
  - 상세: 문서가 스스로 "spec 에 `nodeName` 으로 표기되어 있으나 엔진 및 프론트엔드는 모두
    `nodeLabel` 을 사용" 이라고 인정한다. 실측 확인 —
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 실제 emit 은
    전부 `nodeLabel: node.label ?? node.type` (예: `:4842`, `:5933`, `:6119`, `:6238` 등) 이고
    `nodeName` 키를 쓰는 emit 은 코드베이스에 없다. 즉 이 4행은 실제 wire 출력 포맷과 다른 필드명을
    "정식 계약"인 것처럼 문서화하고 있다 — API 응답/이벤트 페이로드가 `spec/conventions/` 정본
    포맷을 그대로 반영해야 한다는 본 체크리스트 관점(②)에서 target 문서 자신이 위반 소스다.
    같은 절의 신설 이벤트 `execution.node.cancelled` 행은 이미 올바르게 `nodeLabel` 로 적혀 있어
    drift 가 국소적임도 확인된다. 이 문서는 `status: partial` +
    `pending_plans: plan/in-progress/spec-sync-websocket-protocol-gaps.md` 를 선언하고 있으나,
    그 tracker 파일을 열어 `nodeName`/`nodeLabel`/드리프트/정합 키워드로 전수 검색한 결과 이
    항목은 **어디에도 등록돼 있지 않다**. 즉 spec 이 자기 입으로 "정합 필요"라 적어 놓고도 그
    책임을 지는 `pending_plans` 문서에 담기지 않았다 — 그 tracker 의 마지막 항목이 `complete/`
    로 이동해 이 문서가 `implemented` 로 승격되는 순간 이 drift 는 추적 근거를 완전히 잃는다.
  - 제안: (a) 즉시 수정이 가장 저비용 — 코드 변경이 전혀 필요 없는 **순수 문서 정정**이다
    (`nodeName` → `nodeLabel` 4곳 치환)이므로 "본 PR scope 밖" 유예의 실익이 낮다. (b) 그래도
    유예한다면 `spec-sync-websocket-protocol-gaps.md` 에 이 항목을 명시적으로 등재해
    `pending_plans:` 매커니즘이 실제로 이 gap 을 커버하도록 한다.

## 준수 확인(양호) 요약 — 참고용

아래는 위반은 아니지만, 이번 대상(`spec/5-system/`)이 최근 EIA 마스킹 연쇄 PR(#1166~#1179)을 거치며
`spec/conventions/**` 을 상당히 촘촘히 준수하고 있음을 뒷받침하는 근거다:

- **문서 구조(3섹션)**: `3-error-handling.md`/`12-webhook.md`/`14-external-interaction-api.md` 는
  `## Overview (제품 정의)` + 본문 + `## Rationale` 3섹션을 모두 갖춘다. `2-api-convention.md`/
  `6-websocket-protocol.md` 는 별도 `## Overview` 가 없으나 `spec/5-system/_product-overview.md`
  가 영역 단위 Overview 를 담당하므로 `project-planner/SKILL.md` §Spec 문서 구조 예외("다중 spec
  파일을 가진 영역은 `_product-overview.md` 별도 파일")에 부합 — 위반 아님.
- **frontmatter(spec-impl-evidence.md)**: `14-external-interaction-api.md`(`status: partial` +
  `pending_plans: spec-sync-external-interaction-api-gaps.md`), `6-websocket-protocol.md`(`status:
  partial` + `pending_plans: spec-sync-websocket-protocol-gaps.md`) 모두 §2.1 필수 필드·§3
  라이프사이클 규칙을 지킨다. 두 `pending_plans` 경로 모두 `plan/in-progress/` 에 실존 확인.
- **에러 코드 명명(error-codes.md)**: 최근 신설된 `WEBCHAT_IDLE_TIMEOUT`(EIA-RL-07,
  `execution-engine.service.ts:1146` 등에서 실사용)은 `UPPER_SNAKE_CASE` + 도메인 prefix 패턴을
  따르고, `CHANNEL_` 대신 `WEBCHAT_` 을 택한 근거까지 §R17/§R19 본문에 명시돼 있어 §1 "의미 기반
  명명" 원칙에 부합.
- **Swagger DTO 패턴(swagger.md)**: `execution-response.dto.ts` 의 `error?: Record<string, unknown>
  | null`(`additionalProperties: true`) 는 §1-4 가 원칙적으로 요구하는 닫힌 union/DTO 화 대신 열린
  map 을 쓰고 있으나, 이 타입 선언은 최근 마스킹 PR(#1179) 이전부터 존재했던 필드이고(§1-4 "적용
  범위 — 신규 변경 한정: 기존 `additionalProperties: true` 필드를 일괄 소급 스키마화하지 않는다"),
  #1179 가 추가한 것은 마스킹 동작을 설명하는 JSDoc 뿐이다 — 소급 스키마화 면제 대상이라 위반
  아님. 응답 DTO 위치(`dto/responses/*-response.dto.ts`)·명시 필드 나열(JSDoc)도 §1/§5-1 패턴을
  따른다.
- **Redis 키/큐 명명(redis-keys.md)**: 신설 `WEBCHAT_IDLE_REAPER_QUEUE` 는 BullMQ 큐 이름이라
  §4 "인접 네임스페이스"(라이브러리 표준, 본 규약 범위 밖) 대상이며 별도 등재 의무가 없다 —
  `16-system-status-api.md` 의 `MONITORED_QUEUES` 레지스트리에 정상 등재됨.
  `secret-store.md` §1 URI scheme(`secret://<scope>/<resourceId>/<name>`)도 target 문서들이
  일관되게 참조.
- **금지 패턴 미답습**: `node-output.md` Principle 7 이 금지하는 spread-echo 패턴은 신규 마스킹
  헬퍼(`redact-stored-error.ts` 의 `redactStoredErrorForResponse`)에서 검색되지 않음 — 명시적
  `deepRedactSecrets` 위임 + `Record<string, unknown> | null` 형태 보존으로 작성돼 있어 이 금지
  항목을 위반하지 않는다.

## 요약

검토 대상 `spec/5-system/` 은 최근 EIA 마스킹 연쇄 작업(#1166~#1179)을 거치며 `spec/conventions/**`
(문서 구조·frontmatter·에러 코드 명명·Swagger DTO 패턴·Redis 키 네임스페이스·config-echo 금지
패턴)을 전반적으로 촘촘히 준수하고 있으며, CRITICAL 급 정식 규약 위반은 발견되지 않았다. 유일한
발견은 `6-websocket-protocol.md` §4.1 의 `nodeName`/`nodeLabel` 필드명 drift로, 문서 스스로 인지하고
있으나 `spec-impl-evidence.md` 가 요구하는 `pending_plans` 추적에는 담기지 않아 향후 tracker 종료
시 조용히 유실될 위험이 있다(WARNING). 코드 변경 없이 문서만 정정하면 되는 저비용 항목이라, 이번
`eia-fanout-and-internal-data-masking` 작업의 spec 반영 단계(체크리스트의 `6-websocket-protocol.md`
갱신 항목)에 곁들여 함께 정정하는 것을 권장한다.

## 위험도

LOW
