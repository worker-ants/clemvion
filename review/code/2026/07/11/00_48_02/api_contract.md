# API 계약(API Contract) 리뷰 — EIA `getStatus.context` 닫힌 union 스키마화 × PR #903 (2단계 컬럼 projection) 병합 결과

## 검토 대상 및 방법

payload 에 첨부된 6개 파일은 대부분 이전 라운드의 review/consistency 산출물(md)과 spec 문서 diff 였고, 실제 코드(DTO·서비스) diff 는 포함돼 있지 않았다. 지시받은 검증 항목(생성된 OpenAPI 문서, 런타임 wire, `STATUS_PROJECTION_COLUMNS`, 하위호환)은 문서만으로 판정할 수 없으므로, 워킹트리의 실제 코드를 직접 읽고 **실행**하여 검증했다:

- `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (DTO 전문 Read)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()` 전문 Read)
- `git diff origin/main..HEAD -- codebase/backend/src/modules/external-interaction/` (실제 코드 변경분만 분리 확인 — `git log`로 `49c2185d1`(#903, perf) 가 `origin/main` 이력에 이미 존재하고, 그 위에 `525beca8e`/`ee271026e`(EIA 닫힌 union 화 + 리뷰 fix)가 rebase 돼 있음을 확인)
- `npx jest src/modules/external-interaction/dto/responses.dto.spec.ts src/modules/external-interaction/interaction.service.spec.ts` — 실행, **60/60 PASS**
- 스캐폴드 스크립트(`SwaggerModule.createDocument()`, 검증 후 즉시 삭제 — 저장소에 남기지 않음)로 실제 `ExecutionStatusDto` OpenAPI 스키마 JSON 을 덤프해 육안 대조

## 발견사항

### 검증 결과 요약 (지시받은 4개 항목)

**(1) 생성된 OpenAPI 문서** — `responses.dto.spec.ts` 를 실행하고 별도로 전체 스키마를 덤프해 직접 대조했다. 실측 결과:

```json
"context": {
  "description": "waiting_for_input 상태의 인터랙션 표면. buttonConfig 변형 또는 nodeOutput 변형 (키 존재로 분기).",
  "oneOf": [
    { "$ref": "#/components/schemas/ButtonsContextDto" },
    { "$ref": "#/components/schemas/NodeOutputContextDto" }
  ],
  "nullable": true
}
```

`discriminator` 키 없음, `additionalProperties`/`type` 없음(닫힌 union 이 열린 map 으로 뭉개지지 않음), `components.schemas` 에 `ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto` 3종만 신규 등재되고 `WaitingContextBaseDto`(export 됐지만 `@ApiExtraModels` 미등록)·`ConversationThreadDto`(애초에 클래스 없음)는 등재되지 않는다 — target 이 의도한 그대로다. `openapi: "3.0.0"` 확인. PR #903 은 서비스 레이어(쿼리)만 건드리고 `responses.dto.ts` 를 전혀 수정하지 않았으므로(diff 로 직접 확인) 이 스키마는 #903 의 영향을 받지 않는다.

**(2) 런타임 wire 키** — `interaction.service.ts` `getStatus()` 전문을 읽고 `git diff origin/main..HEAD` 로 이 함수의 실제 변경분만 분리했다. 변경은 `if (interactionType === 'buttons' && bc) {...} else if (interactionType) {...}` 2-branch 구조를 `if (interactionType) { context = 조건 ? {...buttonConfig} : {...nodeOutput} }` 1-branch+삼항으로 재작성한 것뿐이며, `interactionType` 이 falsy 일 때 `context` 가 최초 선언값 `null` 로 남는 동작(양쪽 버전 동일)을 포함해 **분기 결과가 완전히 동일**하다(문자 그대로의 리팩터, 로직 변경 없음). 실측된 조립 규칙:
  - `base = { interactionType, waitingNodeId, ...(conversationThread ? { conversationThread } : {}) }` — `conversationThread` 는 값이 있을 때만 spread, 없으면 키 자체가 없음(옵셔널, `| null` 아님) → DTO `conversationThread?: ConversationThread` 선언과 정합.
  - `context = interactionType==='buttons' && bc ? {...base, buttonConfig} : {...base, nodeOutput}` — `buttonConfig`/`nodeOutput` 는 항상 정확히 하나만 존재(XOR), 둘 다 없거나 둘 다 있는 경우는 타입·런타임 양쪽에서 불가능.
  - `seq: SSE_SEQ_PLACEHOLDER`(=0) — 모든 응답에서 상수.
  - `result`/`error` — `execution.status === COMPLETED/FAILED` 일 때만 값, 그 외 `null` (DTO `nullable: true` 와 정합).
  - `responses.dto.spec.ts`(15 케이스) + `interaction.service.spec.ts`(2단계 projection 전용 신규 스위트 포함) 로컬 실행 결과 전부 PASS — wire 계약이 코드·테스트 양쪽에서 실측으로 뒷받침된다.

**(3) `STATUS_PROJECTION_COLUMNS` (#903) 이 DTO 가 약속하는 컬럼을 누락하는가** — 실제 상수:

```ts
const STATUS_PROJECTION_COLUMNS = [
  'id', 'status', 'workflowId', 'startedAt', 'finishedAt', 'outputData',
] satisfies (keyof Execution)[];
```

`getStatus()` 가 반환하는 `ExecutionStatusDto` 의 모든 필드를 역추적해 이 프로젝션과 대조했다:

| DTO 필드 | 출처 | 1단계 프로젝션에 포함? |
|---|---|---|
| `id` | `execution.id` | ✓ |
| `workflowId` | `execution.workflowId` | ✓ |
| `status` | `execution.status` | ✓ |
| `currentNode` | 2단계 `NodeExecution` 조회(+`node` relation) — `Execution` 컬럼 아님 | N/A (별도 엔티티) |
| `context` | 2단계 `Execution.conversationThread`(별도 `select`) + `NodeExecution.outputData` | N/A (2단계에서 명시적으로 별도 select) |
| `result` | `execution.outputData` (COMPLETED 시) | ✓ (`outputData`) |
| `error` | `execution.outputData` (FAILED 시) | ✓ (`outputData`) |
| `seq` | 상수(`SSE_SEQ_PLACEHOLDER`) | N/A |
| `updatedAt` | `execution.finishedAt ?? execution.startedAt ?? new Date()` | ✓ (`startedAt`, `finishedAt` 둘 다 포함) |

**누락 없음.** 특히 `updatedAt` 은 코드 주석이 스스로 경고하듯("`finishedAt`/`startedAt` 누락 시 `new Date()` 로 조용히 회귀") 가장 위험한 필드인데 두 컬럼 모두 프로젝션에 있다. 이 매핑은 black-box 방식(구현 상수를 import 하지 않고 독립적으로 재기술)의 전용 유닛 테스트(`getStatus — 컬럼 projection (2단계 조회)` describe 블록, `select.slice().sort()).toEqual(BASE_COLUMNS...)` 정확 집합 비교)로 회귀 방지가 걸려 있다 — 컬럼을 실수로 빼거나 초과 추가하면 이 테스트가 fail 한다. 또한 `satisfies (keyof Execution)[]` 타입 강제로 컬럼명 오타(`output_data` 같은 snake_case) 는 컴파일 타임에 걸린다.

**(4) 두 변경의 합집합에서 하위호환 파괴 여부** — 없음. 근거:
  - #903 은 `interaction.service.ts` 의 쿼리 메커니즘(1단계 얇은 select → `waiting_for_input` 일 때만 2단계 재조회)만 바꿨고 `responses.dto.ts` 는 전혀 건드리지 않았다(diff 로 확인).
  - EIA 스키마화(525beca8e/ee271026e)는 `responses.dto.ts` 의 데코레이터 메타데이터(`@ApiExtraModels`/`oneOf`/`nullable`)와 `getStatus()` 내부 조립 로직의 **표현만** 바꿨을 뿐(위 (2) 참조, 완전 동치 리팩터) 실제 JSON 응답 바이트는 변경하지 않는다.
  - 두 변경의 교집합은 `getStatus()` 함수 그 자체(같은 파일, 인접 코드) 뿐인데, git diff 를 줄 단위로 대조한 결과 서로 다른 절(#903=1단계 `select`/2단계 분기 진입 조건, EIA=2단계 안의 `context` 조립 삼항식)을 건드려 실제 충돌·상호작용이 없다.
  - controller(`interaction.controller.ts`) — 라우트·HTTP 메서드·상태 코드·에러 응답 데코레이터·인증(`@Public()` + `InteractionGuard`) 전부 이번 diff 범위 밖(diff 없음, 직접 확인).
  - 요청 DTO(`interact.dto.ts`/`cancel.dto.ts`) — 변경 없음.
  - 인가 경계: 2단계 조회가 1단계와 다른 `executionId` 를 잘못 조회하면 iext 토큰 scope 밖의 대화 히스토리가 새어나갈 수 있는 회귀 클래스인데, 전용 테스트(`2단계 조회는 1단계와 동일한 executionId 로 스코프된다 (인가 경계)`)가 두 조회의 `where` 절이 항상 동일 `executionId` 임을 명시적으로 고정하고 있다 — 두 PR 이 만나는 지점에서 가장 우려되는 실질 리스크(인가 경계)가 이미 테스트로 봉인돼 있다.

### [INFO] `context` 필드의 `oneOf` + `nullable: true` sibling 조합은 OpenAPI 3.0 스펙상 엄밀히는 모호한 패턴

- 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:193-202` (`ExecutionStatusDto.context`)
- 상세: 실측 덤프에서 문서 버전은 `openapi: "3.0.0"` 이다. OAS 3.0 스펙상 `nullable` 키워드는 공식적으로 `type` 을 수식하는 것으로 정의돼 있고(`type` 이 있을 때 그 타입 + `null` 을 허용), `oneOf` 배열 자체에는 `type` 이 없다. 즉 `{ oneOf: [...], nullable: true }` 형태는 "null 도 유효하다"는 의도가 명확하지만, 매우 엄격한 OAS validator(예: 특정 AJV 기반 strict 모드)나 구버전 codegen 은 이 sibling `nullable` 을 무시하고 `context: null` 을 스키마 위반으로 판정할 수 있다.
- 다만 이는 **이번 diff 가 새로 만든 리스크가 아니라 같은 DTO 안에 이미 존재하는 동형 패턴**이다 — `currentNode` 필드도 `{ allOf: [{$ref: CurrentNodeDto}], nullable: true }` 로 동일한 sibling 구조를 쓰고 있고(실측 확인), 이는 이번 diff 이전부터 이 코드베이스의 `@nestjs/swagger` 사용 관례다. 현재 이 OpenAPI 문서를 소비하는 코드 생성기(SDK codegen)가 저장소 안에 없음도 확인했다(`codebase/frontend` 에 `ExecutionStatusDto` 참조 0건, `codebase/channel-web-chat` 은 손수 작성한 타입을 씀 — 자동 codegen 미사용). 실사용 상 Swagger UI·대부분의 실전 OAS 3.0 툴체인은 이 패턴을 관용적으로 허용한다.
- 제안: 조치 불필요(사용자 요청 범위 밖 + 실제 소비자 부재로 리스크 낮음). 장래에 자동 SDK 생성기를 도입한다면 그 시점에 `nullable: true` 대신 OAS 3.1 스타일(`oneOf` 배열에 `{ type: 'null' }` 원소 추가) 전환을 함께 검토하면 된다.

## 관점별 결론

1. **하위호환성** — 파괴 없음. wire 는 동치 리팩터로 유지, 두 PR 의 교집합 코드도 줄 단위로 비충돌 확인.
2. **버전 관리** — 해당 없음(URL 비버저닝 정책, `spec/5-system/2-api-convention.md §1` 그대로). 이번 변경은 breaking 이 아니므로 버전 관리 이슈 자체가 발생하지 않는다.
3. **응답 형식** — `context` 의 닫힌 2-variant `oneOf`(discriminator 없음) 는 실제 생성 OpenAPI 문서로 실측 확인됐고, 런타임 wire(정확히 하나의 `buttonConfig`/`nodeOutput`)와 정합. `currentNode`/`result`/`error` 의 `nullable: true` 도 실측 확인.
4. **에러 응답** — 이번 diff 범위 밖, 변경 없음(컨트롤러 에러 데코레이터·서비스 예외 매핑 미변경).
5. **요청 검증** — 이번 diff 범위 밖, 요청 DTO 변경 없음.
6. **URL/경로 설계** — 변경 없음(컨트롤러 라우트 diff 0).
7. **페이지네이션** — 해당 없음(`getStatus` 는 단건 리소스 조회, 목록 API 아님).
8. **인증/인가** — 변경 없음(`@Public()` + 토큰 guard 그대로). 2단계 조회 도입으로 새로 생길 수 있었던 execution-scope 인가 경계 회귀 클래스는 전용 유닛 테스트로 봉인돼 있음을 확인.

## 요약

두 PR(`getStatus()` 2단계 컬럼 projection #903, `ExecutionStatusDto.context` 닫힌 `oneOf` 스키마화)이 만나는 `getStatus()` 를 실제 코드·테스트 실행으로 직접 검증한 결과, 두 PR 모두의 "wire unchanged" 주장은 병합 결과에서도 유지된다. `STATUS_PROJECTION_COLUMNS`(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`)는 `getStatus()` 가 반환하는 모든 DTO 필드(특히 회귀 위험이 큰 `updatedAt` 파생 로직)를 정확히 커버하며 이는 black-box 정확-집합 비교 테스트로 회귀 방지가 걸려 있다. `context` 조립 로직은 두 PR 사이에서 구조만 리팩터(if/else-if → if+삼항)됐을 뿐 분기 결과가 완전히 동일하고, 생성된 OpenAPI 문서(실제 `SwaggerModule.createDocument()` 실행으로 스캐폴드 덤프해 확인)는 target 이 의도한 `oneOf`(discriminator 없음)+`nullable`+3종 스키마 등재(`WaitingContextBaseDto`/`ConversationThreadDto` 미등재)를 정확히 반영한다. 백엔드 관련 유닛 테스트 60건 전부 로컬 실행 PASS. 두 PR 의 교집합 코드에서 가장 우려됐던 인가 경계(2단계 조회가 1단계와 다른 execution 을 조회할 위험)도 전용 테스트로 고정돼 있다. 유일한 발견사항은 `context` 필드가 OpenAPI 3.0 스펙상 다소 모호한 `oneOf`+`nullable` sibling 패턴을 쓴다는 INFO 급 관찰인데, 이는 같은 DTO(`currentNode`)에 이미 존재하는 기존 관례이고 실사용 SDK 생성기 소비자가 저장소에 없어 실질 리스크는 낮다. API 계약 관점에서 breaking change·에러 응답 불일치·인증/인가 회귀·URL/페이지네이션 이슈는 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
