# 변경 범위(Scope) 리뷰 — EIA `getStatus.context` union DTO 스키마화

- diff base: `origin/main` (spec 커밋 `a02db4f9a` + impl 커밋 `0302bd7ea`)
- 사용자 요청(원문 요약): (1) `ExecutionStatusDto.context` 를 union DTO 로 스키마화, (2) null-vs-key-omission 규칙 성문화 + 위젯 소비자 검증

## 사전 확인 사항 — 이 PR 은 일반적인 "임의 확장"과 다른 이력을 가진다

리뷰에 앞서 diff 안의 `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` 와 `review/consistency/**` 산출물을 직접 대조했다. 이 작업은 프로젝트 SDD 프로세스(spec-draft → `/consistency-check --spec` → spec 커밋 → `/consistency-check --impl-prep` → 구현)를 그대로 밟았고, 아래에서 "요청 범위 밖"으로 보이는 항목 대부분이 **구현자의 임의 판단이 아니라 이 게이트들이 사전에 검출·의무화한 항목**이다. 이 사실 자체가 각 항목의 정당성 판단에 영향을 준다 — 프로세스가 승인한 확장과 구현자가 몰래 끼워넣은 확장은 같은 "요청 범위 초과"라도 리스크가 다르다.

## 발견사항

### [INFO] `CurrentNodeDto` 신설 — 리터럴 요청 범위(“context”) 밖이지만 impl-prep 게이트가 명시적으로 의무화
- 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (`CurrentNodeDto` 클래스 + `ExecutionStatusDto.currentNode` 재선언), `codebase/channel-web-chat/src/lib/eia-types.ts:131-134`, `responses.dto.spec.ts` currentNode 관련 3개 테스트 케이스
- 상세: 사용자 요청 (1)은 `context` 필드 하나를 명시했고, `currentNode` 는 형제 필드다. 그런데 `review/consistency/2026/07/10/22_50_15/SUMMARY.md` I4가 "cross_spec·rationale_continuity 2인 독립 제안"으로 이를 "구현 시 반영 의무화" 항목에 올렸고, 스스로 "(범위 확대이나 본 PR 의 명시 목적 '`Swagger` 에 sub-shape 노출' 과 동일 선상)" 이라고 확장임을 인정한 채 정당화했다. 근거: `swagger.md` §1-4 Rationale(이 PR 이 함께 작성한 spec 본문)이 `currentNode` 의 기존 타입 드리프트(`eia-types.ts` 가 `string|null` 로 잘못 선언 — 실제 wire 는 객체)를 §1-4 개정의 **실증 사례로 직접 인용**하고 있어, 그 사례를 그대로 방치하면 spec Rationale 이 스스로 인용한 문제를 코드가 해소하지 않는 모순이 남는다. 실제로 `eia-types.ts` 의 오선언(스칼라로 잘못 선언된 객체 필드)도 이번에 같이 고쳤다 — 이는 진짜 타입 정확성 버그 수정이다.
- 판단: **정당화된 파생 확장(justified)** — revert 불필요. 단, 문자 그대로 "context 만" 이라는 지시보다는 넓다는 점은 사실이므로, 구현자 개인 판단이 아니라 프로젝트 자체 게이트(2인 checker 독립 수렴 + SUMMARY 의무화 표기)가 사전 승인했다는 근거를 PR 설명에 남겨두는 것을 권장한다. 별도 후속 PR 로 미뤘다면 오히려 방금 커밋한 spec Rationale 이 스스로 인용한 드리프트 사례가 즉시 해소되지 않은 채 남는 더 나쁜 상태가 됐을 것이다.

### [INFO] `result`/`error` 에 `nullable: true` 추가 — in-scope
- 위치: `responses.dto.ts` L379-394
- 상세: 이 두 필드는 요청 (2) "null-vs-key-omission 규칙 성문화" 의 직접 대조군이다 — spec 본문 전체(§5.4, EIA §5.3)가 반복적으로 "`currentNode`/`result`/`error` 는 `null`, `conversationThread` 는 키 생략" 을 예시로 든다. TS 타입은 원래도 `Record<string, unknown> | null` 이었으나 Swagger 데코레이터에 `nullable` 표기가 누락된 **기존 버그**였고, 새로 성문화한 §5.4 규칙("null 필드는 `nullable: true` 명시")을 준수하려면 같은 DTO 안의 이 두 필드도 함께 고쳐야 규칙이 자기 파일 안에서부터 일관된다.
- 판단: 범위 내. revert 불필요.

### [INFO] EIA §5.3 예시 JSON 정정(`formConfig`/`conversationConfig` 유령 키 제거) + `seq: 42→0` — in-scope, 선행 게이트가 지시
- 위치: `spec/5-system/14-external-interaction-api.md` §5.3
- 상세: `review/consistency/2026/07/10/22_30_47/SUMMARY.md` W1(cross_spec·rationale_continuity·convention_compliance 3개 checker 독립 수렴)이 "이 정정 없이 갭1의 `oneOf` 스키마만 반영하면 같은 문서 안에서 신규 스키마(정확)와 기존 예시(부정확)가 모순된다" 며 Gap3 범위를 "cross-ref" 에서 "cross-ref + 예시 정정" 으로 명시적으로 확장시켰다. `seq: 42` 도 같은 문서 9줄 위 콜아웃("seq 는 항상 0 placeholder")과의 기존 모순을 바로잡는 것.
- 판단: 범위 내. 이 항목을 후속 PR 로 미뤘다면 **이번 커밋이 만든 새 oneOf 스키마와 바로 위 예시 JSON 이 같은 문서 안에서 즉시 자기모순 상태로 고정**됐을 것이므로, 같은 PR 에 포함하는 것이 오히려 올바른 스코핑이다.

### [INFO] `swagger.md` §1-4/§5-2 개정 — 요청 (1)의 필수 선행 작업, in-scope
- 상세: 개정 전 §1-4 는 "union 또는 dynamic: `additionalProperties: true`" 한 줄로 프로퍼티 레벨 닫힌 union 자체를 사실상 금지(정확히는 미정의)하고 있었다. 사용자 요청 (1) "`context` 를 union DTO 로 스키마화" 를 규약 위반 없이 수행하려면 이 규약 자체를 먼저 개정해야 했다 — 부수적 확장이 아니라 요청을 이행하기 위한 필수 선행 조건이다.
- 판단: 범위 내.

### [INFO] `eia-types.ts` `currentNode` 타입 정정 — 요청 (2)의 직접 산출물
- 상세: "위젯 소비자 검증" 이라는 요청이 요구하는 바로 그 산출물 — 검증 과정에서 실제 드리프트(스칼라로 잘못 선언된 필드)를 발견해 고쳤다.
- 판단: 범위 내.

### [INFO] `interaction.service.ts` `getStatus` 조립부 제어흐름 재구성(if/else-if → if + 삼항) + `WaitingContextBase` 타입 신설
- 위치: `interaction.service.ts` L299-540(diff)
- 상세: `context` 필드 타입을 `ButtonsContextDto | NodeOutputContextDto` 로 좁히면서, 기존 `const base = {...}` 객체 리터럴이 TS literal-widening(`interactionType` 이 리터럴 유니언이 아닌 `string` 으로 넓혀짐) 때문에 새 union 타입에 assignable 하지 않게 되어, `WaitingContextBase` 명시 타입 도입 + 단일 `if` 블록 내 조건식으로 재구성한 것으로 보인다. 코드 주석이 "런타임 wire 무변경" 임을 스스로 명시하고, 조건 로직(`interactionType==='buttons' && bc` → `buttonConfig` 분기, 그 외 truthy `interactionType` → `nodeOutput` 분기)은 그대로 보존된다. 신규 회귀 테스트 2건(`interaction.service.spec.ts` — buttons fallthrough·conversationThread 키 생략)이 동일 동작을 고정한다.
- 판단: **정당화된 최소 파생 변경**. DTO 를 엄격한 union 으로 타이핑한 유일한 실질적 파급 효과이며 동작 변경이 없다. 별도 파일로 옮기거나 후속 PR 로 미룰 이유가 약하다(같은 필드·같은 좁은 조립부).
- 제안: 조치 불요.

### [INFO] 미미한 포맷팅 노이즈 — `swagger.md` §1-4 헤더 뒤 공백 줄 삽입
- 위치: `spec/conventions/swagger.md` `### 1-4. nested / enum / union` 헤더 직후 1줄
- 상세: 실질 변경과 무관한 순수 공백 삽입. 마크다운 스타일 정리 수준으로 무해하다.
- 제안: 조치 불요(너무 사소해 언급만).

### 검토했으나 문제 없음 확인
- **임포트**: `ApiExtraModels`/`getSchemaPath`(신규) 모두 실사용, `type { ConversationThread }`(신규) 도 `conversationThread?` 필드 타입에 사용. `type WaitingContextBase`(신규) 도 `base` 변수 타이핑에 사용. 미사용 임포트 없음.
- **주석 변경**: 추가/수정된 JSDoc 은 전부 요청 (2)(null vs 키생략 규칙)를 코드 레벨에 반영하는 실질 문서화이며, 불필요한 주석 추가/삭제는 없음. `responses.dto.ts:57-58` 의 stale JSDoc(“`currentNode.interactionType` 으로 분기” — unsound discriminator 가정) 정정도 impl-prep 게이트(I1, rationale_continuity)가 요구한 것.
- **설정 변경**: 없음(tsconfig/eslint/docker/env 등 미변경).
- **무관한 파일**: 26개 변경 파일 전부가 (a) EIA `getStatus.context`/`currentNode` 스키마화 코드·테스트, (b) 그 코드가 근거로 삼는 spec 3건, (c) 프로젝트 규약상 필수 산출물인 plan/consistency-check 리뷰 아티팩트(CLAUDE.md 상 `review/consistency/**` 는 gitignore 대상이 아니라 커밋 대상)로 귀결된다. 요청과 무관한 파일(패키지 설정·다른 모듈·다른 기능)은 없음.
- **테스트 확장**: `responses.dto.spec.ts`(신규 14건) 는 실제 OpenAPI 문서를 생성해 `$ref`/`oneOf`/`nullable`/`additionalProperties` 를 검증하는 회귀 가드로, 요청 (1)(스키마화)과 (2)(null vs 키생략)를 정확히 커버한다. over-engineering 성 기능 확장은 없음(예: 불필요한 헬퍼 추상화, 범용 유틸리티 신설 등 없음).

## 요약

이번 diff 는 사용자가 명시한 두 항목(“context union DTO 화”, “null-vs-key-omission 규칙 성문화 + 위젯 검증”)보다 코드 표면적으로는 넓다 — `CurrentNodeDto` 신설, `result`/`error` `nullable` 보정, EIA §5.3 예시 JSON 정정, `swagger.md` 규약 개정, `interaction.service.ts` 조립부 재구성이 모두 “요청 밖” 추가처럼 보일 수 있다. 그러나 이들을 하나씩 추적한 결과 전부가 (a) 요청을 규약 위반 없이 이행하기 위한 필수 선행조건이거나, (b) 같은 파일/문서 안에서 이번 변경이 만드는 신규 불변식(닫힌 union 스키마, null-vs-omission 규칙)과 즉시 충돌했을 기존 부정확성을 같은 커밋에서 해소한 것이거나, (c) 프로젝트 자체 게이트(`/consistency-check --spec`·`--impl-prep`, 각 5-checker 합의)가 사전에 검출·의무화한 항목이었다. 임의의 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한 주석/임포트 변경은 발견되지 않았다(헤더 뒤 공백 1줄 정도가 유일한 순수 포맷팅 흔적이며 무해). 유일하게 문자 그대로의 “context 만” 지시와 형식적으로 어긋나는 것은 `CurrentNodeDto` 신설이지만, 이는 2개 독립 checker 가 수렴 제안하고 SUMMARY 가 “범위 확대이나 동일 선상”이라 명시적으로 인정·승인한 항목이며 실제 타입 드리프트 버그를 고친 결과이므로 revert 를 권하지 않는다.

## 위험도

LOW
