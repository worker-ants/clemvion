# Security Review — EIA `getStatus` context 스키마화 (oneOf/DTO 리팩터)

대상 diff base: `origin/main` (a02db4f9a spec + 0302bd7ea impl)
핵심 변경: `codebase/backend/src/modules/external-interaction/{dto/responses.dto.ts, interaction.service.ts}` + 테스트, `codebase/channel-web-chat/src/lib/eia-types.ts`, spec 문서 3건.

## 검증 방법

1. `interaction.service.ts` 의 `getStatus()` 전체를 직접 읽고 리팩터 전(git diff)과 대조해 redaction 호출 3곳의 위치·순서·인자를 라인 단위로 추적.
2. `responses.dto.ts` 신규 DTO(`CurrentNodeDto`, `WaitingContextBaseDto`, `ButtonsContextDto`, `NodeOutputContextDto`)가 wire 상 새 필드를 추가하는지 원본 inline 타입과 필드셋 비교.
3. `spec/conventions/swagger.md` §0(Swagger UI 노출 정책) 및 §1-4(신설) 검토 — 문서화 강화가 실제 값이 아닌 봉투 구조만 스키마화하는지 확인.
4. `interaction.service.spec.ts` 기존 secret-masking 테스트(라인 654~) + 신규 테스트 실행 — `npx jest interaction.service.spec.ts dto/responses.dto.spec.ts` → 52 tests 전부 통과.
5. `git diff` 전체에 하드코딩 시크릿 패턴 grep.

## 발견사항

### 리다크션 호출부 3곳 — 순서·래핑 모두 보존됨 (회귀 없음)

- **위치**: `interaction.service.ts:280` (`nodeOutput`), `:265-267`(`conversationThread`), `:337/:344`(`result`/`error`)
- **상세**:
  - `const out = deepRedactSecrets(nodeExec.outputData ?? {})` 는 `if (interactionType)` 분기 **이전**(라인 280, 분기 라인 303 이전)에 한 번 계산되고, 리팩터된 코드에서도 `buttonConfig: { buttons: bc.buttons, nodeOutput: out }` 과 `{ ...base, nodeOutput: out }` 양쪽 모두 이 이미 마스킹된 `out` 을 그대로 사용한다. `bc = structured.config?.buttonConfig ?? structured.buttonConfig` 도 `out` 을 타입 캐스팅한 `structured` 에서 읽으므로 `bc.buttons` 역시 이미 redact 된 데이터의 일부다 — `buttonConfig.nodeOutput` 뿐 아니라 `buttonConfig.buttons` 도 우회 경로 없음.
  - `conversationThread = execution.conversationThread ? redactThreadForPublic(execution.conversationThread) : undefined` (라인 265-267)는 `base: WaitingContextBase` 조립(라인 307-311) **이전**에 계산되어 그대로 스프레드된다. 리팩터가 `if/else if` 를 삼항 표현식으로 바꿨을 뿐, `base` 조립과 `conversationThread` 마스킹 시점 관계는 변경되지 않았다.
  - `result`/`error` 필드는 리팩터 대상 밖(diff 미터치)이며 여전히 `deepRedactSecrets(execution.outputData ?? null)` 를 각각 독립 호출한다.
  - 세 곳 모두 `codebase/backend/src/shared/` (redaction 헬퍼 구현체)는 이번 diff 에서 전혀 수정되지 않았음을 `git diff --stat -- codebase/backend/src/shared/` 로 확인(출력 없음) — 헬퍼 자체의 로직 변경 리스크는 없다.
  - 기존 `interaction.service.spec.ts` 의 3개 secret-masking 테스트(durable thread turn 텍스트, `nodeOutput.conversationConfig`, `COMPLETED result`/`FAILED error`)가 이번 diff 에서 손대지 않은 채로 남아 있고 실행 결과 전부 통과 — 리팩터가 마스킹 동작을 깨지 않았음을 실증.
- **결론**: 리다크션 우회/재정렬 없음.

### `CurrentNodeDto` / variant DTO — 새 필드 노출 없음

- **위치**: `responses.dto.ts:234-249` (`CurrentNodeDto`), `:258-282` (`WaitingContextBaseDto`), `:285-310` (`ButtonsContextDto`/`NodeOutputContextDto`)
- **상세**: 원본 inline 타입 `currentNode?: { id: string; type: string; interactionType: 'form'|'buttons'|'ai_conversation'|null } | null` 과 신규 `CurrentNodeDto` 의 필드셋(`id`/`type`/`interactionType`)이 정확히 일치. 마찬가지로 `context` 의 원본 `Record<string, unknown> | null` (완전 개방) 대비 신규 `ButtonsContextDto`/`NodeOutputContextDto` 는 필드를 **추가**하는 것이 아니라 이미 조립부(`interaction.service.ts`)가 런타임에 채워 넣던 필드(`interactionType`/`waitingNodeId`/`conversationThread`/`buttonConfig`/`nodeOutput`)를 사후적으로 타입·스키마 레벨에서 문서화한 것뿐이다. `interaction.service.ts` 조립 로직 자체(어떤 값을 어떤 키에 넣는지)는 리팩터 전후 동일 — 컨트롤 플로우만 `if/else if` → 삼항 표현식으로 바뀜.
- **결론**: wire 상 신규 노출 필드 없음.

### Swagger 문서화 강화가 실제 시크릿을 스키마에 새기지 않음

- **위치**: `responses.dto.ts` 신규 `@ApiProperty`/`@ApiPropertyOptional` 데코레이터들
- **상세**: `conversationThread` 필드는 TS 타입으로는 `import type { ConversationThread } from '.../conversation-thread.types'` 를 참조하지만, Swagger 데코레이터는 명시적으로 `type: 'object', additionalProperties: true` 로 선언되어 있어 OpenAPI 스키마에는 `ConversationThread` 의 내부 필드(turns[].text 등, 실제 값이 담기는 곳)가 **전개되지 않는다** — "봉투만 스키마화, 내부는 열린 map" 설계가 실제로 스키마 노출을 제한하고 있음을 코드에서 확인. `nodeOutput`/`buttonConfig` 도 동일하게 `additionalProperties: true` 로 내부 payload 를 비공개 유지. 신규 `responses.dto.spec.ts` 테스트가 이 열린-map 성질을 회귀 가드로 명시 검증(`nodeOutput.additionalProperties === true`, `ConversationThreadDto` 자체가 생성되지 않음을 확인).
- Swagger UI 자체 노출 정책(§0, non-production 기본·`ENABLE_SWAGGER_IN_PROD` opt-in)은 이번 diff 에서 변경되지 않았고, 이번 변경은 스키마의 **구조적 정밀도**(oneOf/필드명)만 높일 뿐 실제 응답 값·시크릿 예시를 스키마에 하드코딩하지 않는다(`@ApiProperty({ example: 'Carousel' })` 등 예시 값은 노드 타입 이름 정도로 민감하지 않음).
- **결론**: 문서화 강화로 인한 신규 정보 누출 없음.

### `discriminator` 미선언 — 보안과 무관하지만 정확성 노트

- **위치**: `responses.dto.ts:333` `@ApiExtraModels`, `context` 필드의 `oneOf`
- **상세**: `interactionType='buttons'` 이면서 `buttonConfig` 복원 실패 시 `NodeOutputContextDto` 로 fallthrough 하는 케이스 때문에 `discriminator` 를 의도적으로 생략함(주석·spec Rationale 명시). 이는 정보 누출이 아니라 SDK 생성기 오분류 방지를 위한 정확성 조치로, 보안상 문제 없음.

### 프런트(webchat) `eia-types.ts` 타입 갱신 — 서버 응답과 일치화

- **위치**: `codebase/channel-web-chat/src/lib/eia-types.ts:128-136`
- **상세**: `currentNode` 타입을 `string | null` (기존 오선언) → 실제 wire 인 `{id, type, interactionType} | null` 로 정정. 서버가 이미 객체를 보내고 있었으므로 클라이언트 타입만 실제와 일치시키는 변경이며 새로운 데이터 노출이 아니다.

### 기타 확인 사항 (문제 없음)

- 하드코딩 시크릿: diff 전체 grep 결과, 매치되는 문자열은 전부 redaction 테스트 fixture (`sk-live-LEAKED-9988`, `sk-NODEOUT-LEAK`, `AKIA-NODEOUT-2`, `sk-RESULT-LEAK` 등 명백한 가짜 값으로, 마스킹이 이 값들을 제거하는지 검증하는 용도)이며 실제 인증에 사용되는 시크릿이 아님.
- 인젝션: TypeORM `findOne({ where: {...} })` 파라미터화 쿼리만 사용, raw SQL/문자열 결합 없음.
- 인증/인가: 이번 diff 는 `getStatus` 의 인증 미들웨어/가드 로직을 건드리지 않음(스코프 밖).
- 테스트 실행: `npx jest interaction.service.spec.ts dto/responses.dto.spec.ts` → 2 suites / 52 tests 전부 통과.

## 요약

이번 변경은 `GET /api/external/executions/:id` 응답의 `context`/`currentNode` 필드를 `Record<string, unknown>` 개방형에서 판별 union DTO(`ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto`)로 정밀화하고 OpenAPI `oneOf` 스키마를 부여하는 순수 타입/문서화 리팩터다. `interaction.service.ts` 의 실제 데이터 조립 로직은 `if/else if` 를 삼항 표현식으로 바꾼 것 외에 변경되지 않았으며, EIA §R17 이 요구하는 세 곳의 리다크션 호출(`deepRedactSecrets(nodeExec.outputData)` → `buttonConfig.nodeOutput`/`buttonConfig.buttons`/`nodeOutput`, `redactThreadForPublic(execution.conversationThread)` → `context.conversationThread`, `deepRedactSecrets(execution.outputData)` → `result`/`error`)는 모두 값 조립 이전에 계산되어 우회 없이 그대로 이어진다. `shared/` 의 마스킹 헬퍼 구현체 자체는 diff 대상에 포함되지 않았고, 기존 3개 secret-masking 회귀 테스트를 포함해 52개 테스트가 전부 통과했다. 신규 DTO 는 원본 inline 타입과 필드셋이 정확히 일치하며, Swagger 스키마 강화는 내부 payload(`nodeOutput`/`buttonConfig`/`conversationThread`)를 여전히 `additionalProperties: true` 열린 map 으로 유지해 값 수준 정보를 추가로 스키마에 새기지 않는다. 종합적으로 이번 변경으로 인한 신규 보안 취약점이나 EIA 공개 표면 리다크션 우회는 발견되지 않았다.

## 위험도

NONE
