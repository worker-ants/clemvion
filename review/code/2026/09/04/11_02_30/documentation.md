# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 Swagger 계약 거짓 수정(9곳) 항목이 없다 — 바로 앞 두 자매 커밋과 같은 클래스의 변경인데 이번만 빠졌다
  - 위치: `CHANGELOG.md` (신규 항목 부재) / 관련 코드: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43,46,49,58,67,84,142,145` (파일 2 게이트), `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19` (파일 3 게이트)
  - 상세: `CHANGELOG.md` 최상단에는 정확히 같은 성격의 이전 커밋 2건이 기록돼 있다 — `## Unreleased — 초대자 계정을 지우면 invitedBy 가 null 인데 스키마는 필수 uuid 라고 했다`(`d8b7cb93e`, `#1274`) 와 `## Unreleased — AuthConfig.ipWhitelist 는 처음부터 null 일 수 있었는데 스키마가 아니라고 했다`(같은 `entity-nullable-column-type-mismatch` 작업 계열). 둘 다 "Swagger DTO 선언과 실제 nullable 여부가 어긋나 있었다 → 동작 변경 없이 스키마만 바로잡는다"는 동일 패턴이고, "종전/지금" 표까지 같은 포맷으로 남겼다. 이번 커밋(`fefec2b27`, `fix(dto): OpenAPI 선언과 TS 타입이 어긋난 9곳 + 그 축을 무는 가드`)은 같은 저장소, 같은 작업 계열(entity-nullable 정합화 후속), 같은 종류의 결함(Swagger 선언과 TS 타입 불일치, "OpenAPI 가 계약을 숨긴다")을 8+1=9곳 고치는데도 `git show fefec2b27 --stat` 기준 `CHANGELOG.md` 가 변경 파일 목록에 없다. 게다가 이번 변경은 방향이 더 소비자 영향이 크다 — 기존 두 CHANGELOG 항목은 스키마를 "느슨하게"(required→optional, non-null→nullable) 넓히는 쪽이었지만, 이번 8곳(`background-run-response.dto.ts`)은 반대로 OpenAPI `required` 를 `false→true` 로 **좁히는** 방향이라 엄격한 코드 생성기를 쓰는 소비자에게는 더 눈에 띄는 타입 변경이다.
  - 제안: 두 자매 항목과 같은 포맷("종전/지금" 표 + "동작 변경은 없다" 고지)으로 `CHANGELOG.md` 에 `## Unreleased` 항목을 추가한다. `background-run-response.dto.ts` 8필드 + `create-assistant-session.dto.ts` `llmConfigId`(반대 방향) 를 한 항목에 묶고, 재발 방지 가드(`swagger-dto-contract.spec.ts`)를 신설했다는 점도 덧붙이면 다음 사람이 왜 이 클래스의 결함이 앞으로 안 생기는지 알 수 있다.

- **[INFO]** 리팩터 후 남은 인라인 주석이 "모듈 스코프" 라는 표현을 그대로 써서 살짝 모호하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:120` ("// 구현은 모듈 스코프의 `withFiles` — 단일 파일 호출은 그 얇은 래퍼다.")
  - 상세: 이 주석은 `withFiles` 가 이 파일 안의 지역 함수였을 때 쓰여진 문구인데, 바로 위 JSDoc(41~47줄, 파일 게이트 기준)은 이미 `withFiles` 가 `common/__test-utils__/temp-fixture.ts` 로 옮겨져 **import** 된 것이라고 정확히 설명한다. "모듈 스코프" 라는 표현 자체가 틀린 것은 아니다(import 바인딩도 모듈 스코프 식별자다) — 다만 바로 위 JSDoc 이 이미 "공유 헬퍼로 옮겼다" 고 설명한 직후라, 이 짧은 주석만 따로 읽으면 `withFiles` 가 이 파일에 로컬로 남아있다는 인상을 줄 수 있어 두 서술이 살짝 어긋난 톤이다.
  - 제안: 사소하다. 여유가 있으면 "// 구현은 공유 헬퍼의 `withFiles`(import)" 정도로 한 단어만 바꾸면 위 JSDoc 과 완전히 같은 어휘가 된다. 급하지 않다.

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 설명이 명시적 `null` 케이스를 언급하지 않는다 (동작은 이미 동일함을 확인)
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:13` (`description: '사용할 LLM Config UUID. 생략 시 워크스페이스 기본값 사용'`)
  - 상세: 타입이 `string` → `string | null` 로 넓어졌는데 설명 문구는 "생략 시" 만 언급한다. `workflow-assistant-session.service.ts:91` (`llmConfigId: dto.llmConfigId ?? null`) 을 실측하니 생략(`undefined`)과 명시적 `null` 이 동일하게 워크스페이스 기본값으로 폴백돼 설명이 틀리지는 않지만, 명시적으로 "null 을 보내도 동일하게 폴백" 이라고 한 줄 보태면 소비자가 두 표현이 등가임을 굳이 코드를 보지 않아도 알 수 있다. 자매 DTO(`update-assistant-session.dto.ts:19`)는 "null 전달 시 workspace default로 폴백" 을 이미 명시하고 있어 대조된다.
  - 제안: 급하지 않음. 여유가 있으면 `update-assistant-session.dto.ts` 문구를 참고해 "(생략 또는 null 전달 시 워크스페이스 기본값 사용)" 으로 통일.

## 긍정 관찰 (참고)

- SDD 순서가 정확히 지켜졌다 — `spec/5-system/2-api-convention.md` §5.4 와 `spec/conventions/swagger.md` §1-4 정본 예제가 먼저(`cce8a188b`, planner 턴) 정정된 뒤에야 그 문면을 따라 DTO 코드가 고쳐졌다(`fefec2b27`). 코드가 아직 안 고쳐진 spec 을 앞질러 참조하는 흔한 결함이 없다.
- 신규 가드 2개(`swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`)와 공유 픽스처(`temp-fixture.ts`)는 모두 "왜 정규식이 아니라 AST 인가" 류의 근거 있는 헤더 문서를 갖췄고, 실측 수치(1,096개 모집단·18개 `@Transform`·1개 충돌)까지 코드 주석과 plan 문서(`spec-draft-nullable-notation-followups.md`) 양쪽에서 일치한다 — 교차 검증했다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 재실측 기록("101 vs 18" → "103 vs 17", 합계 129)이 산수까지 맞고, 두 번째 오류였음을 숨기지 않고 명시했다.
- DTO 필드 설명 문구(`nextCursor` 의 "없으면 null" 등)는 `nullable: true` 추가 후에도 여전히 정확하다 — 오래된 주석 문제 없음.

## 요약

전반적으로 이번 PR 의 문서화 수준은 높다 — 가드 신설의 근거, plan 문서 갱신, spec→code 순서가 모두 모범적이다. 다만 이 저장소가 같은 작업 계열에서 직전 두 커밋(`invitedBy`, `ipWhitelist`)에 대해 이미 확립한 `CHANGELOG.md` 관행이 정확히 같은 성격의 이번 9곳 수정에는 적용되지 않았다 — 이것이 유일하게 실질적인 문서화 공백이다. 나머지는 사소한 문구 다듬기 수준의 INFO 다.

## 위험도

LOW
