# 정식 규약 준수 검토 — EIA `getStatus.context` 스키마화 (`--impl-done`)

- diff base: `origin/main` (4 commits: `311015832` spec · `60c4c8900` impl · `efc9e791e` review-fixes · `b1d69ed8c` resolution-hash)
- target: `spec/5-system/14-external-interaction-api.md` (§5.3 `context` 스키마화 + 부재 표현 규칙)
- 관련 정식 규약(본 브랜치에서 함께 개정): `spec/conventions/swagger.md` §1-4/§5-2/§Rationale, `spec/5-system/2-api-convention.md` §5.4
- 검증 대상 코드: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`, `interaction.service.ts`, 대응 `*.spec.ts`/e2e, `codebase/channel-web-chat/src/lib/eia-types.ts`

payload 가 지목한 파일 목록은 실제 `git diff origin/main...HEAD --stat` 결과와 일치함을 직접 확인했다 (`spec/5-system/14-external-interaction-api.md`, `spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md`, `codebase/backend/.../dto/responses.dto.ts(.spec.ts)`, `interaction.service.ts(.spec.ts)`, `external-interaction.e2e-spec.ts`, `channel-web-chat/.../eia-types.ts`, 신규 plan `spec-draft-eia-context-schema-absence-convention.md` + 기존 `spec-sync-external-interaction-api-gaps.md` 갱신, `review/code/**`·`review/consistency/**` 산출물). 범위 밖 파일은 없었다.

## 점검 항목별 결과 ((a)~(g))

### (a) swagger.md §1-1 — 신규 DTO 필드 전수 한국어 JSDoc
전수 확인 결과 **전부 준수**.

- `CurrentNodeDto.id`/`type`/`interactionType` 3필드 — 모두 JSDoc 존재.
- `WaitingContextBaseDto.interactionType`/`waitingNodeId`/`conversationThread` 3필드 — 모두 JSDoc 존재 (`conversationThread` 는 다중행 JSDoc + `API 규약 §5.4` cross-ref 포함).
- `ButtonsContextDto.buttonConfig`, `NodeOutputContextDto.nodeOutput` — 각 1필드, JSDoc 존재.
- 기존 `ExecutionStatusDto.currentNode`/`context`/`result`/`error`/`seq` — 이번 diff 로 재선언된 필드 전부에 JSDoc 이 새로 추가되거나 갱신됨(`result`/`error` 는 `null` 근거를 §5.4 로 cross-ref).

위반 없음.

### (b) swagger.md §1-4 — 닫힌 union 패턴 (oneOf + getSchemaPath + ApiExtraModels, discriminator 미사용)
**준수**.

- `ExecutionStatusDto` 에 `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)`.
- `context` 필드에 `oneOf: [{$ref: getSchemaPath(ButtonsContextDto)}, {$ref: getSchemaPath(NodeOutputContextDto)}]` + `nullable: true`.
- `discriminator` 미선언 — 코드에 없을 뿐 아니라 `responses.dto.spec.ts` 가 `expect(context.discriminator).toBeUndefined()` 로 회귀 가드까지 신설(실 OpenAPI 문서 생성 후 검증이라 데코레이터 메타데이터 누락도 잡는다).
- swagger.md §Rationale "`discriminator` 는 판별자가 sound 할 때만" 이 이 EIA 사례(`interactionType='buttons'` 가 두 variant 양쪽에 나타남)를 정확히 반례로 인용하고 있고, 실제 구현(`interaction.service.ts` 의 `if (interactionType === 'buttons' && bc) ... else ...` fallthrough)과 일치함을 `interaction.service.spec.ts` 신규 테스트로 확인.

위반 없음.

### (c) swagger.md §1-4 — 열린 map 은 "실제로 키가 런타임 결정" 인 경우 한정 (nodeOutput/buttonConfig/conversationThread)
**대체로 준수, 문서 명료성 관점 INFO 1건.**

- `nodeOutput: Record<string, unknown>`, `buttonConfig: { buttons: unknown; nodeOutput: Record<string, unknown> }` — 노드 타입별 자유 payload로 §1-4 본문이 말하는 "실제로 키가 열려 있는" 사례에 정확히 부합.
- `conversationThread?: ConversationThread` 는 `type: 'object', additionalProperties: true` 로 열어 뒀는데, 실제 런타임 타입(`ConversationThread`)은 `turns[]`/`source`/`totalChars`/`nextSeq` 로 **형태가 고정**돼 있어 §1-4 본문의 "실제로 키가 열려 있는" 기준과는 결이 다르다. 다만 이는 우연한 누락이 아니라 swagger.md §Rationale("왜 EIA `context` 는 봉투만 스키마화하고 내부는 열어 두는가")이 명시적으로 승인한 예외다 — `conversation-thread.md §1.3` 이 이미 그 shape 의 SoT 이므로 `ConversationThreadDto` 를 별도로 만들면 SoT 이중화가 된다는 근거.
- 즉 코드는 규약(본문 + Rationale)을 정확히 따른다. 다만 **§1-4 본문 자체는 "키가 실제로 열려 있는 경우"만 언급**하고 "형태는 고정이지만 타 문서 SoT 와의 중복을 피하려 의도적으로 열어 둔다"는 제3의 사유는 Rationale 에만 있다. 향후 리뷰어/작성자가 본문만 보고 conversationThread 를 "형태가 고정됐으니 스키마화해야 한다"고 오판할 여지가 있다.

INFO 로 하단에 기록.

### (d) api-convention §5.4 — DTO 선언 미러 규칙
**준수**.

- `conversationThread?: ConversationThread` — 키 생략 필드 규칙(`@ApiPropertyOptional` + `field?: T`, `| null` 금지) 그대로 적용.
- `result?: Record<string, unknown> | null` / `error?: Record<string, unknown> | null` — `null` 규칙(`@ApiPropertyOptional({ nullable: true })` + `field?: T | null`) 적용, 이번 diff 에서 `nullable: true` 가 새로 추가됨(이전엔 미준수였고 `responses.dto.spec.ts` 신규 스키마 테스트가 검출해 수정).
- `currentNode?: CurrentNodeDto | null` — 동일 `null` 규칙, `nullable: true` + `type: () => CurrentNodeDto`.
- e2e(`I-2`)가 실 HTTP round-trip 으로 `conversationThread` 키 자체 부재(`Object.keys(context)` 미포함)와 `result`/`error` 의 `null` 을 함께 검증.

위반 없음.

### (e) swagger.md §5-2 — 각주 형태 확인 (표 행이 아님)
**준수**.

§5-2 표(헬�터 인벤토리) 바로 아래에 표 행이 아니라 **별도 blockquote 각주**로 추가됨:

> 위 표는 `common/swagger/` 가 export 하는 **호출형 헬퍼 함수**의 인벤토리다. 응답 body 전체가 아니라 **DTO 의 한 필드**가 닫힌 union 인 경우는 대응 헬퍼가 없고, `@ApiExtraModels` + `@ApiProperty({ oneOf: [...] })` 데코레이터 조합을 직접 쓴다 (§1-4).

표 컬럼 구조(헬퍼/용도/반환 스키마)에 새 행이 섞이지 않았음을 diff 로 직접 확인. plan 문서(`spec-draft-eia-context-schema-absence-convention.md` 체크리스트)도 "§5-2 각주(행 아님)" 로 동일하게 기록해 의도와 실행이 일치.

### (f) §1-4 / api-convention §5.4 — 소급 미적용 캐리브 존재 확인
**둘 다 준수**.

- swagger.md §1-4: "> **적용 범위 — 신규 변경 한정**: 기존 `additionalProperties: true` 필드를 일괄 소급 스키마화하지 않는다 ... (`execution-context.md` §원칙 3 과 동일 취지)." — 존재.
- api-convention.md §5.4: "**소급 적용 대상 아님**: 본 규칙은 **앞으로 도입·변경되는 필드**에 적용한다. 이미 문서화된 키 생략 필드(`mcpDiagnostics`, cafe24 `status`·`requiresCafe24Approval`, chat-channel `details.statusCode` 등)는 기준 (b) 를 충족하는 것으로 간주하고 사유 문구를 소급 요구하지 않는다." — 존재.

두 문서 모두 소급 비적용 범위와 이유(누적 방지 vs 정리)를 일관되게 설명하며 서로 cross-reference 하고 있어(§원칙 3 인용) 상호 모순 없음.

### (g) swagger.md frontmatter `code:` glob 정확성
**정확함, 갱신 불요**.

```yaml
code:
  - codebase/backend/src/common/swagger/**
  - codebase/backend/nest-cli.json
  - codebase/backend/src/common/config/production-guards.ts
  - codebase/backend/src/main.ts
```

이 glob 은 Swagger 문서화 **인프라**(공용 래퍼 헬퍼 `common/swagger/**`, CLI 플러그인 설정, prod 노출 가드, bootstrap)를 가리키는 것이지 이 패턴을 소비하는 개별 DTO 파일 전체를 나열하는 목록이 아니다. 이번 diff 가 건드린 `external-interaction/dto/responses.dto.ts`/`interaction.service.ts` 는 이 규약의 **소비처**이지 규약 자체의 구현 SoT 가 아니므로 glob 에 추가할 필요가 없다 — 다른 모듈(예: `workflows.controller.ts` 등)도 이 규약을 따르지만 `code:` 목록에 없는 것과 동일한 패턴. `common/swagger/**` 안의 `api-wrapped.ts`(`wrapOneOfDataSchema`, `ApiOkWrappedOneOfResponse`) 는 이미 glob 범위 안에 있고 이번 Rationale 이 그 파일의 기존 JSDoc 을 규약 레벨로 승격했다고 명시하므로 정합.

## 추가 관찰 (요청 항목 외)

- **naming collision 방지 처리 확인**: EIA 문서 자신도 "§5.4 명시적 취소"라는 로컬 섹션을 갖고 있어 `api-convention.md §5.4` 인용이 겹칠 위험이 있었다(plan 문서가 이를 선제적으로 우려·기록: `naming_collision W5`). 실제 diff 는 두 군데 모두 `[API 규약 §5.4](./2-api-convention.md#54-부재-표현--null-vs-키-생략)` 로 **파일명 qualify** 했고, 한 곳은 괄호로 "(본 문서 자신의 §5.4 '명시적 취소' 가 아니다)" 라고 명시적으로 구분해 두어 규약 위반 소지를 사전에 해소했다.
- **§5-1 위치 규약(`dto/responses/*-response.dto.ts`) 과의 편차**: 실제 파일은 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (flat 파일, 서브폴더 아님) 로 §5-1 의 권장 위치와 다르다. 그러나 이는 **이번 diff 이전부터 존재하던 파일**(diff 는 `cfb508e64..b8eed2864` 수정이지 신규 생성이 아님)이라 본 PR 이 새로 만든 편차가 아니며, `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` §후속 에 "`external-interaction` 모듈의 `dto/responses.dto.ts` flat 파일 → `dto/responses/` 서브디렉토리 이관 (swagger.md §5-1. 25개 모듈 중 본 모듈만 미준수 — impl-prep W1)" 로 이미 별도 후속 작업으로 등록돼 있다. 이번 PR 범위에서 조치할 필요 없음.

## 발견사항

- **[INFO]** §1-4 본문이 "형태는 고정이지만 SoT 이중화 회피를 위해 의도적으로 여는" 제3의 사유를 명시하지 않음
  - target 위치: `spec/conventions/swagger.md` §1-4 "열린/동적 map" 단락
  - 위반 규약: 없음(규약 위반이 아니라 규약 문서 자체의 명료성 개선 제안)
  - 상세: §1-4 본문은 열린 map 허용 기준을 "실제로 키가 열려 있는 경우" 로만 서술한다. `conversationThread` 는 형태가 고정(`ConversationThread` 타입, `conversation-thread.md §1.3` SoT)이므로 이 문구만 보면 스키마화 대상으로 오판될 수 있다. 실제로는 §Rationale("왜 EIA `context` 는 봉투만 스키마화하고 내부는 열어 두는가")이 "타 문서 SoT 와의 중복 회피" 라는 별도 사유로 예외를 승인하고 있어, 코드는 규약 전체(본문+Rationale)에 부합하지만 본문만 읽는 독자에게는 기준이 불완전해 보인다.
  - 제안: §1-4 본문에 "형태가 고정돼도 타 conventions 문서가 이미 그 shape 의 SoT 일 때는 재선언 대신 열어 두고 description 으로 cross-ref 한다" 는 문장을 1줄 추가해 Rationale 로 미루지 않고 본문에서 바로 규칙화. (규약 갱신 제안이며, 이번 PR 의 구현 결함은 아님.)

- **[INFO]** `dto/responses.dto.ts` 가 §5-1 flat-file 미준수 상태로 남아 있음 (기존 편차, 이번 diff 무관)
  - target 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (파일 경로 자체)
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치: `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`"
  - 상세: 이번 PR 은 기존 flat 파일에 신규 DTO 클래스 4개를 추가했을 뿐 파일 위치 자체는 이번 diff 이전부터 §5-1 미준수였다(diff 가 신규 생성이 아니라 기존 파일 수정임을 `git diff --stat` 로 확인). 25개 모듈 중 이 모듈만 미준수라는 점이 plan 문서에 이미 기록돼 있다.
  - 제안: 이미 `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` §후속 에 별도 후속 작업으로 등록돼 있으므로 추가 조치 불요 — 본 PR 범위 밖임을 재확인하는 차원의 기록.

## 요약

이번 PR 은 `spec/conventions/swagger.md` §1-4/§5-2 와 `spec/5-system/2-api-convention.md` §5.4 를 이 브랜치 안에서 함께 개정하고, 그 개정된 규약을 EIA `getStatus.context` DTO(`CurrentNodeDto`/`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`)에 즉시 적용한 사례다. 요청된 7개 점검 항목((a) 한국어 JSDoc 전수, (b) 닫힌 union oneOf+getSchemaPath+ApiExtraModels+discriminator 미사용, (c) 열린 map 판단 기준, (d) DTO 선언 미러 규칙, (e) §5-2 각주 형태, (f) 두 문서의 소급 미적용 캐리브, (g) frontmatter code glob 정확성) 을 실제 working-tree 규약 텍스트와 shipped 코드·신규 테스트(`responses.dto.spec.ts` 의 실 OpenAPI 문서 생성 검증, `interaction.service.spec.ts` fallthrough 가드, e2e `I-2`)로 교차 확인한 결과 전부 준수 상태이며 CRITICAL/WARNING 급 위반은 발견되지 않았다. `conversationThread` 의 open-map 처리는 §1-4 본문 기준만 보면 이질적으로 보이지만 같은 문서의 Rationale 이 명시적으로 승인한 예외이고, EIA 문서 자신의 로컬 §5.4 와의 잠재적 naming collision 도 파일명 qualify + 명시적 구분 문구로 이미 해소돼 있다. 남은 두 건은 모두 INFO 성격(규약 본문 명료성 제안 1건, 이미 후속 작업으로 등록된 기존 파일 위치 편차 1건)으로 이번 PR 을 막을 사유가 아니다.

## 위험도
LOW

STATUS: SUCCESS