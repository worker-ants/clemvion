# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--impl-done` (origin/main 재베이스 후 재검증, PR #903 흡수분 포함)
- diff-base: `origin/main` (실측: `git diff origin/main...HEAD`)
- target: `spec/5-system/14-external-interaction-api.md` (EIA §5.3 context 스키마화)
- 참조 정식 규약(워킹트리 텍스트): `spec/conventions/swagger.md` §1-4/§5-2/§Rationale, `spec/5-system/2-api-convention.md` §5.4

## 검증 방법

payload 의 diff·규약 텍스트는 참고만 하고, 판정은 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b`)의 실제 파일을 절대경로로 직접 Read/Grep 하여 수행했다. `git diff origin/main...HEAD --stat` 로 실 changeset 을 확인했고(코드: `dto/responses.dto.ts`, `dto/responses.dto.spec.ts`, `interaction.service.ts`, `interaction.service.spec.ts`, `test/external-interaction.e2e-spec.ts`, `channel-web-chat/src/lib/eia-types.ts`; spec/conventions: `14-external-interaction-api.md`, `2-api-convention.md`, `swagger.md`), PR #903(`49c2185d1`)이 `origin/main` 에서 유입된 선행 커밋임을 `git log`/`git show --stat` 로 확인했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 발견사항 없음. 아래는 점검 항목별 확인 결과(모두 통과)와 INFO 1건.

### [INFO] `CurrentNodeDto` 를 `@ApiExtraModels` 에 등록하는 것은 엄밀히는 불필요하지만 무해함
- target 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:152` — `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)`
- 위반 규약: 없음 (참고용 관찰) — `spec/conventions/swagger.md` §1-4 는 `@ApiExtraModels` 를 "닫힌 union(oneOf) variant" 등록 용도로 예시한다.
- 상세: `currentNode` 필드는 `oneOf` 조합이 아니라 `type: () => CurrentNodeDto` 로 직접 참조되므로, `@nestjs/swagger` CLI 플러그인이 별도 `@ApiExtraModels` 없이도 참조 스키마를 자동 등록하는 것이 일반적이다(직접 타입 참조는 리플렉션으로 감지됨. `@ApiExtraModels` 는 주로 oneOf/anyOf/allOf 처럼 간접 참조되는 타입에 필요). 다만 실제 OpenAPI 문서 생성 테스트(`responses.dto.spec.ts` — "variant DTO 가 components.schemas 에 등재된다")가 `schemas.CurrentNodeDto` 존재를 통과시키므로 부작용은 없다.
- 제안: 조치 불요. 과잉등록이 스키마 누락보다 안전한 방향이라 현행 유지 권장.

## 점검 관점별 결과

### (a) swagger.md §1-1 — 신규 DTO 필드 한국어 JSDoc
`responses.dto.ts` diff 로 신설/변경된 모든 필드·클래스에 한국어 JSDoc 확인:
- `CurrentNodeDto`(클래스 + `id`/`type`/`interactionType` 3필드), `WaitingContextBaseDto`(클래스 + `interactionType`/`waitingNodeId`/`conversationThread` 3필드), `ButtonsContextDto`(클래스 + `buttonConfig`), `NodeOutputContextDto`(클래스 + `nodeOutput`) — 전부 JSDoc 보유.
- `ExecutionStatusDto` 의 변경분(`currentNode`/`context`/`result`/`error`/`seq`) 도 각 필드 상단에 새 JSDoc 라인 추가됨(`result`/`error` 는 이번 diff 에서 처음 JSDoc 을 얻음 — 이전에는 `@ApiPropertyOptional` description 만 있었다).
- 결론: **완전 준수**.

### (b) swagger.md §1-4 — 닫힌 union(`oneOf` + `getSchemaPath` + `ApiExtraModels`, discriminator 금지)
- `ExecutionStatusDto.context` — `@ApiPropertyOptional({ oneOf: [{ $ref: getSchemaPath(ButtonsContextDto) }, { $ref: getSchemaPath(NodeOutputContextDto) }], nullable: true })`, 클래스 레벨 `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)`. `discriminator` 키 미사용 — 규약 §1-4 예시 코드와 1:1 일치.
- `interaction.service.ts` 의 `getStatus()` 조립 로직도 `interactionType` 을 판별자로 쓰지 않고 **키 존재**(`'buttonConfig' in ctx`)로 분기하도록 재작성됐고, `interaction.service.spec.ts`/`responses.dto.spec.ts`/`external-interaction.e2e-spec.ts` 3계층 모두 이 fallthrough·discriminator 부재를 직접 테스트로 고정한다(`responses.dto.spec.ts`: `expect(context.discriminator).toBeUndefined()` — 실제 OpenAPI 문서 생성 후 검증이라 데코레이터 메타만 읽는 것보다 강한 회귀 가드).
- 결론: **완전 준수**. 참고로 이 규약 자체가 본 diff 와 동일 세션에서 신설/구체화된 항목(swagger.md §Rationale "EIA `getStatus` 의 `context` 가 반례")이라 구현·규약이 co-authored 관계다.

### (c) swagger.md §1-4 — 열린 map 은 "실제로 키가 런타임 결정"되는 곳에만
- `buttonConfig`(`ButtonsContextDto`), `nodeOutput`(`NodeOutputContextDto`) — 노드 타입별 자유 payload. `additionalProperties: true` 로 유지. swagger.md §Rationale "왜 EIA `context` 는 봉투만 스키마화하고 내부는 열어 두는가" 가 이 결정의 근거를 명시적으로 소유.
- `conversationThread`(`WaitingContextBaseDto`) — `type: 'object', additionalProperties: true`. 별도 `ConversationThreadDto` 클래스를 만들지 않는다 — shape SoT 는 `conversation-thread.md §1.3` 이며, 이중 SoT 화를 피하기 위한 의도적 선택(같은 Rationale 절에서 명시). `responses.dto.spec.ts` 가 `expect(schemas.ConversationThreadDto).toBeUndefined()` 로 이 결정을 고정.
- `result`/`error`(`ExecutionStatusDto`) — 기존부터 열린 map(terminal envelope, 노드/에러 타입별 자유 구조). 이번 diff 는 `nullable: true` 를 추가했을 뿐 구조 변경 없음 — §1-4 "적용 범위 — 신규 변경 한정" 유예 대상이기도 하나, 애초에 진짜 열린 페이로드라 유예를 원용할 필요 자체가 없다.
- 결론: **완전 준수**. 봉투(envelope)만 스키마화하고 내부 payload 를 여는 경계가 일관되게 지켜짐.

### (d) api-convention.md §5.4 — DTO 선언이 부재 표현(null vs 키 생략)을 미러링
- `conversationThread?: ConversationThread`(`| null` 미사용) + `@ApiPropertyOptional`(nullable 미지정) — **키 생략** 패턴과 정확히 일치. JSDoc 도 "부재 시 키 자체를 생략한다 ... 따라서 `| null` 을 쓰지 않는다" 로 §5.4 근거(기준 (a): SSE wire parity)를 인용.
- `result?: Record<string, unknown> | null` / `error?: Record<string, unknown> | null` — 이번 diff 에서 `nullable: true` 가 **신규로 추가**됐다(diff 확인: 이전 데코레이터에는 `nullable: true` 가 없었음, 즉 §5.4 미러 요구를 이번 변경이 새로 충족시킴). JSDoc "completed/failed 가 아니면 `null` (키 present — API 규약 §5.4)" 도 부합.
- `currentNode?: CurrentNodeDto | null` / `context?: ButtonsContextDto | NodeOutputContextDto | null` — 둘 다 `nullable: true` + `| null` 타입으로 **null(키 present)** 기본 패턴과 일치.
- `spec/5-system/14-external-interaction-api.md` §5.3 본문·§R17 인접 절에도 "부재 표현이 형제 필드와 다른 이유" 콜아웃이 신설되어 `api-convention.md#54-부재-표현--null-vs-키-생략` 를 명시 인용 — spec 본문과 DTO 선언·JSDoc·와이어 예시(jsonc) 4곳이 모두 동일 근거(기준 (a))로 정합.
- 결론: **완전 준수**, 그리고 사전에 있던 갭(`result`/`error` 의 `nullable: true` 누락)을 이번 diff 가 해소.

### (e) PR #903 `STATUS_PROJECTION_COLUMNS` (`satisfies (keyof Execution)[]`) 규약 준수 및 본 브랜치 변경과의 상호작용
- `interaction.service.ts:67-74` — `const STATUS_PROJECTION_COLUMNS = ['id','status','workflowId','startedAt','finishedAt','outputData'] satisfies (keyof Execution)[];`. `spec/conventions/**` 안에 이 패턴(TypeORM `select` 배열의 `satisfies (keyof Entity)[]` 타입 강제)을 규정하거나 금지하는 항목은 없다(grep 결과 0건) — swagger/api-convention 어느 쪽에도 저장소 계층 projection 관용구에 대한 규칙이 없으므로 **규약 위반도, 규약 준수 주장도 성립하지 않는 영역**(정식 규약의 사각지대, 위반 아님)이다. 다만 JSDoc 주석 자체는 한국어로 근거(오기 시 컴파일 에러화)를 설명해 프로젝트 전반의 "코드 자체 설명" 관행과는 부합한다.
- 본 브랜치 변경과의 상호작용: `getStatus()` 1단계 조회는 `STATUS_PROJECTION_COLUMNS`(`conversation_thread` 제외)를 쓰고, `waiting_for_input` 분기에서만 2단계로 `select: ['id', 'conversationThread']` 재조회한다(`interaction.service.ts:295-299`). 이번 브랜치가 도입한 `WaitingContextBaseDto.conversationThread`(§5.4 키생략 패턴)는 이 2단계 조회 결과(`threadRow?.conversationThread`)를 `redactThreadForPublic` 마스킹 후 소비하며(`interaction.service.ts:313-315, 344-351`), `result`/`error` 는 1단계 `STATUS_PROJECTION_COLUMNS` 에 포함된 `outputData` 를 그대로 사용한다(`interaction.service.ts:376-389`). 즉 #903 의 컬럼 축소가 본 브랜치의 DTO 필드 요구사항(6개 응답 필드 전부)을 정확히 커버하도록 이미 설계돼 있고 — `STATUS_PROJECTION_COLUMNS` 에 `updatedAt` 계산에 필요한 `startedAt`/`finishedAt` 도 포함 — 규약(§1-4/§5.4) 위반으로 이어지는 상호작용은 없다. `git log` 상 `49c2185d1`(#903)은 `origin/main` 에서 유입된 선행 커밋이고, 로컬 브랜치의 EIA context 스키마화 커밋(`c44673cfd`/`525beca8e`/`ee271026e`)들은 그 이후 리베이스 시점 커밋이라 두 변경 사이에 편집 충돌은 없었다(diff 자체에 `STATUS_PROJECTION_COLUMNS` 라인이 나타나지 않음 — origin/main 원본 그대로).
- 결론: #903 은 conventions 사각지대(위반 없음)이며, 본 브랜치가 도입한 §5.4/§1-4 규약과 **정합하게 조합**된다.

### (f) frontmatter `code:` glob 정확성
- `spec/5-system/14-external-interaction-api.md` frontmatter `code:` — `codebase/backend/src/modules/external-interaction/**`(신규 `dto/responses.dto.spec.ts`·수정 `dto/responses.dto.ts`·`interaction.service.ts`·`interaction.service.spec.ts` 전부 커버), `codebase/channel-web-chat/src/lib/eia-types.ts`(명시 등재, 이번 diff 의 유일한 프런트 변경 파일과 정확히 일치). `codebase/backend/test/external-interaction.e2e-spec.ts` 는 glob 에 없으나, 저장소 관행상 `code:` 는 구현 코드 대상이고 e2e 스펙 파일은 다른 spec 문서들(`audit-actions.md` 등)에서도 일관되게 미등재 — 위반 아님.
- `spec/conventions/swagger.md` frontmatter `code:` — 인프라 파일(`common/swagger/**`, `nest-cli.json`, `production-guards.ts`, `main.ts`)만 등재하며 이번 diff 는 이 파일들을 건드리지 않음(순수 소비자 측 DTO 변경) — 갱신 불요, 현행 정확.
- `spec/5-system/2-api-convention.md` frontmatter `code:` — 공용 인프라(exception filter, validation pipe, transform interceptor 등) 등재, 이번 diff 대상 파일과 무관 — 갱신 불요, 현행 정확.
- 결론: **전부 정확**, 갱신 필요 없음.

### 부수 확인 — 문서 구조 규약
`spec/5-system/2-api-convention.md`(`## Rationale` 존재), `spec/conventions/swagger.md`(`## Rationale` 존재), `spec/5-system/14-external-interaction-api.md`(`## Overview (제품 정의)` + `## Rationale` 존재) 모두 CLAUDE.md 가 권장하는 Overview/본문/Rationale 3섹션 구조를 유지하고 있다. `spec/conventions/<name>.md`·`0-` prefix 등 명명 규약 위반 없음.

## 요약

`--impl-done` 재검증 결과, `git diff origin/main...HEAD` 로 확인한 실 changeset(EIA `context` 닫힌-union 스키마화 + 부재표현 §5.4 정합화)은 같은 브랜치에서 함께 개정된 `swagger.md` §1-4·`api-convention.md` §5.4 규약을 정확히 충족한다 — `oneOf`+`getSchemaPath`+`ApiExtraModels` 조합·discriminator 명시적 생략·봉투만 닫고 내부 payload 는 열어두는 경계·`null` vs 키생략 DTO 미러링(특히 이번 diff 가 `result`/`error` 의 `nullable: true` 누락을 새로 해소) 모두 실제 OpenAPI 문서 생성 테스트로 회귀 고정됐다. origin/main 에서 유입된 PR #903(`STATUS_PROJECTION_COLUMNS`, `satisfies (keyof Execution)[]`)은 conventions 가 다루지 않는 저장소 계층 관용구라 위반 소지가 없고, 본 브랜치가 소비하는 6개 응답 필드(특히 `conversationThread`/`result`/`error`)를 정확히 커버하도록 이미 설계돼 있어 두 변경 사이에 마찰이 없다. frontmatter `code:` glob 은 이번 diff 의 모든 구현 파일을 커버하며 갱신이 불필요하다. CRITICAL/WARNING 없음.

## 위험도

NONE
STATUS: SUCCESS
