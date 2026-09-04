# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `BackgroundRunResponseDto` 계열 응답 필드 8개의 OpenAPI `required` 가 `false → true` 로 전환된다 — 실질은 계약 거짓 정정이라 런타임 breaking 은 아니지만, 엄격한 코드제너레이터 소비자에게는 생성 타입이 바뀐다
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43`(`finishedAt`), `:46`(`durationMs`), `:49-55`(`inputData`), `:58-64`(`outputData`), `:67-73`(`error`), `:84-87`(`nextCursor`), `:142`(`completedAt`), `:145-148`(`durationMs`, `BackgroundRunResponseDto`)
  - 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환으로 OpenAPI 스펙상 이 8필드가 `required: false`(선택)에서 `required: true`(항상 존재, 값만 null 가능)로 바뀐다. 서비스 조립 코드(`background-runs.service.ts`)와 `spec/4-nodes/1-logic/12-background.md` 필드 표를 대조하면 이 필드들은 diff 이전부터 wire 상 항상 채워지고 있었으므로 실제 응답 바디는 변하지 않는다 — 문서가 실제를 뒤늦게 따라잡는 정합화다. 다만 OpenAPI 코드제너레이터(orval 등)를 쓰는 외부 소비자가 있다면 재생성 시 `field?: T | null` → `field: T | null` 로 타입이 더 엄격해진다. 이번 세션에서 `CHANGELOG.md` 에 이 변경(방향·영향 포함)을 명시적으로 기록해 두었다는 점은 확인했다(자매 항목 `invitedBy`·`ipWhitelist` 와 같은 포맷).
  - 제안: 코드 수정 불요 — 이미 CHANGELOG 로 고지됐다. 외부 SDK/코드젠 소비자가 실재하면 배포 노트에도 남기는 정도면 충분하다.

- **[INFO]** DTO 스키마 교정(9곳)에 대응하는 API 버전 분기·헤더 마킹이 없다
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` 전체, `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:12-19`
  - 상세: 이번 diff 는 응답/요청 DTO 의 `required`/`nullable` 선언만 바꾸고 엔드포인트 경로·버전 헤더는 건드리지 않는다. 저장소에 명시적 API 버전 관리 체계(`v1`/`v2` 경로 분기 등)가 이 diff 범위에서 확인되지 않는데, 변경 방향이 계약을 "넓히는" 것이 아니라 "정합화"하는 성격이라 버전 분기가 필수는 아니라고 판단한다. `background-run-response.dto.ts` 8필드는 `required` 를 좁히는 방향(`false→true`)이라 엄격한 소비자에게는 유일하게 실제 영향이 있는 변경인데도 별도 버전 마킹 없이 `Unreleased` CHANGELOG 기록으로만 고지된다.
  - 제안: `spec/5-system/2-api-convention.md` 의 버전 관리 절이 이런 "스키마 정합화" 류 변경까지 버전 분기를 요구하는지 재확인 권장. 이번 PR 자체를 막을 사안은 아니다.

- **[INFO]** 신설 계약 가드(`swagger-dto-contract-guard.ts`)의 `readBooleanOption` 이 `nullable`/`required` 값을 boolean 리터럴일 때만 인식한다 — 상수 참조·shorthand property 로 쓰면 조용히 "미선언" 취급된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:59-74` (`readBooleanOption`)
  - 상세: `nullable: SOME_CONST` 같은 비-리터럴 값이 오면 `TrueKeyword`/`FalseKeyword` 매칭에 걸리지 않아 `undefined` 로 처리되고, presence 축은 데코레이터 이름 기본값으로, null 축은 `false` 로 취급된다 — 실제 불일치가 있어도 놓칠 수 있다. 현재 저장소 전수(1,096개 `Api*` 필드)에는 이런 비-리터럴 사례가 0건이라 지금 당장의 위음성은 없고, 이 가드 자체가 API 계약 거버넌스를 강화하는 신규 자산이므로 이 갭이 이번 PR 이 만든 회귀는 아니다.
  - 제안: 급하지 않음. 향후 비-리터럴 패턴이 등장하면 "판정 불가"로 별도 카운트하거나 throw 하는 하드닝을 고려.

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 요청 DTO 는 이미 런타임에서 `null` 을 수락하고 있었고, 이번 변경은 TS 타입만 실제에 맞춘 것 — 요청 검증 동작 변화 없음
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:12-19`
  - 상세: `@ApiPropertyOptional({ nullable: true })` 데코레이터는 이 diff 이전부터 그 값이었고 `@IsOptional()` 은 `null`/`undefined` 모두 하위 검증(`@IsUUID()`)을 스킵한다(`class-validator` 구현 확인). 소비처(`workflow-assistant-session.service.ts` `dto.llmConfigId ?? null`)도 이미 이 값을 안전하게 처리하고 있었다. 생성된 OpenAPI 스키마 자체는 변하지 않으므로 요청 검증·계약 표면에 실질 영향이 없다. 자매 DTO(`update-assistant-session.dto.ts`)는 같은 필드를 이미 `string | null` 로 올바르게 선언하고 있어, 두 DTO 간 타입 표기가 그동안 갈려 있던 것을 이번에 맞춘 것이다.
  - 제안: 없음.

- **[INFO]** §5.4 규칙의 "응답 바디 전용" 스코프가 섹션 nesting 으로만 암시돼 있어 요청 DTO 에 오독·오적용될 뻔했다 — 이번 세션이 스스로 반증하고 정정했다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (§5.4 drift 배치 항목), `CHANGELOG.md` (`llmConfigId` 섹션)
  - 상세: 초안 CHANGELOG 문구는 `llmConfigId`(요청 DTO)에 대해 "§5.4 를 따랐다" 고 적었다가, `spec/5-system/2-api-convention.md` §5.4 가 `## 5. 응답 형식` 하위 절임을 재확인하고 정정했다(consistency checker W2). 아울러 향후 "§5.4 drift 104곳" 배치에서 `update-*.dto.ts` 류 PATCH tri-state 요청 DTO 를 카테고리째 제외하기로 명시적으로 결정했다 — 필드 생략(=값 불변)과 명시적 `null`(=초기화)이 다른 의미인 요청 바디에 응답 전용 규칙을 기계적으로 적용하면 실제 API 계약 회귀(부분 업데이트 의미 파괴)가 난다는 것을 근거로 든다. 이 diff 자체는 코드를 건드리지 않고 plan 문서·CHANGELOG 문구 정정에 그쳤다.
  - 제안: 없음 — 코드 결함이 아니라 향후 배치의 스코프를 올바르게 좁힌 결정으로, API 계약 관점에서 긍정적으로 평가한다. `spec/5-system/2-api-convention.md` §5.4 본문에 "응답 바디 한정" 문구를 명시하는 후속 작업이 이미 planner 항목으로 등재돼 있다(`plan/in-progress/spec-draft-nullable-notation-followups.md`).

## 요약

이번 diff 의 실질 API 계약 표면은 두 DTO 파일(`background-run-response.dto.ts` 8필드, `create-assistant-session.dto.ts` `llmConfigId` 1필드)로 좁고, 둘 다 "OpenAPI 선언과 TS 타입이 서로 다른 말을 하던" 기존 계약 거짓을 실제 wire 동작·spec 문서에 맞춰 정정하는 성격이다. 요청 검증(`@IsOptional`+`@IsUUID`)·응답 조립 로직 자체는 바뀌지 않았고, `background-run-response.dto.ts` 8필드의 `required: false→true` 전환만이 엄격한 코드제너레이터 소비자에게 유일하게 관측 가능한 영향이며 이는 CHANGELOG 에 방향·영향과 함께 명시적으로 고지됐다. 여기에 더해 이 축을 지속 강제하는 AST 기반 repo-guard(`swagger-dto-contract-guard.ts`/`.spec.ts`, `@nestjs/swagger` 비공개 별칭 가정을 검증하는 캐너리 포함)가 신설돼 향후 유사 OpenAPI-TS 불일치를 CI 에서 원천 차단한다. §5.4 규칙의 응답-전용 스코프를 요청 DTO 에 오적용할 뻔했던 것을 이번 세션 스스로 반증·정정하고, 후속 배치에서 PATCH tri-state 요청 DTO 를 카테고리째 제외하기로 한 결정도 API 계약 무결성을 지키는 방향이다. CRITICAL/WARNING 급 결함은 발견되지 않았고, 남은 항목은 전부 이미 완화됐거나(가드 canary 추가 완료) 위음성 확률이 낮은 방어적 관찰(INFO)이다.

## 위험도

LOW
