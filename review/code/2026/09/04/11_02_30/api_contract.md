# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `BackgroundRunResponseDto` 계열 응답 필드 7개의 OpenAPI `required` 가 `false → true` 로 전환된다 — 실질은 "계약 거짓 정정"이라 breaking 아님
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43-44`(`finishedAt`), `:46-47`(`durationMs`), `:49-56`(`inputData`), `:58-65`(`outputData`), `:67-74`(`error`), `:84-88`(`nextCursor`), `:142-143`(`completedAt`), `:145-149`(`durationMs`, `BackgroundRunResponseDto`)
  - 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 로 바뀌면서 OpenAPI 스펙상 이 필드들이 `required: false`(선택)에서 `required: true`(항상 존재, 값만 null 가능)로 바뀐다. `nextCursor` 는 기존에 `nullable` 조차 선언돼 있지 않았다(TS 타입은 이미 `string | null` 이었음) — 순수 문서 결함이었다. 실제 서버가 이 필드들을 wire 상 항상 채워 보내고 있었다면(리뷰 대상 plan 문서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 실측 근거) 이번 변경은 스펙을 실제 동작에 맞춘 교정이라 클라이언트 breaking 은 아니다. 다만 OpenAPI 코드제너레이터(orval/openapi-typescript 등)를 쓰는 소비자는 재생성 시 생성 타입이 `field?: T | null` → `field: T | null` 로 바뀌어 타입 체크가 더 엄격해진다 — 컴파일 타임에 걸리는 정도이고 런타임 계약을 넓히는 방향(선택적→항상 존재)이라 실사용에서 안전한 방향이다.
  - 제안: 이 DTO 를 소비하는 외부 SDK/코드제너레이터가 있다면 재생성이 필요하다는 점을 changelog 에 남기는 정도로 충분. 별도 API 버전 분기는 불필요해 보인다(계약을 느슨하게 만드는 것이 아니라 정합화이므로).

- **[INFO]** `CreateAssistantSessionDto.llmConfigId` 요청 DTO 타입이 `string?` → `string | null` 로 넓어졌다 — 검증 동작은 이미 그랬음(타입만 실제를 반영)
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: 데코레이터는 이미 `@ApiPropertyOptional({ nullable: true })`(변경 전 상태, 그대로 유지) 였고 `@IsOptional()` 이 `null`/`undefined` 를 조건 없이 통과시키므로, `null` 을 담은 요청 바디는 이 변경 전에도 런타임에서 이미 수락되고 있었다. 이번 변경은 TS 컴파일 타임 타입이 실제 런타임/문서 계약을 뒤늦게 따라간 것 — 서버 측 요청 검증 동작에 변화 없음.
  - 제안: 없음(교정 완료로 충분).

- **[INFO]** 신설 가드 `swagger-dto-contract-guard.ts` 의 boolean 옵션 판독이 리터럴 `true`/`false` 만 인식한다 — 상수 참조로 쓰면 조용히 미탐지될 수 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:58-74`(`readBooleanOption`)
  - 상세: `nullable`/`required` 값이 `nullable: SOME_CONST` 처럼 식별자·표현식으로 주어지면 `TrueKeyword`/`FalseKeyword` 매칭에 걸리지 않아 `undefined` 로 처리되고, presence 축은 데코레이터 이름 기본값으로, null 축은 `false` 로 취급된다 — 이 경우 실제 불일치가 있어도 가드가 못 잡을 수 있다. 저장소 전수 실측(1,096개 필드, `@Transform` 18개 등)에서는 현재 전부 리터럴이라 오탐/누락이 없지만, 향후 누군가 상수를 쓰면 이 축이 조용히 무력화된다.
  - 제안: 크리티컬은 아니지만, 리터럴이 아닌 boolean 인자를 만나면 (조용히 넘기지 말고) 별도 경고/미판정으로 표시하는 방어를 고려할 만하다. 지금은 즉시 조치 불필요.

- **[INFO]** DTO 스키마 교정에 대응하는 API 버전 관리 흔적이 없음
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` 전체
  - 상세: 이번 diff 는 OpenAPI 스펙(`required`/`nullable`)을 바꾸지만 API 버전 필드·헤더·엔드포인트 경로 어디에도 버전 마킹이 없다. 저장소 관례상 API 버전 관리 체계 자체가 명시적으로 존재하는지 이 diff 만으로는 판단할 수 없었고, 변경이 계약을 "좁히는" 것이 아니라 "정합화"하는 성격이라 버전 분기가 필수는 아니라고 판단했다. 다만 프로젝트에 별도 API 버전 정책이 있다면 이 자리에서 참조가 필요한지 확인 권장.
  - 제안: `spec/5-system/2-api-convention.md` 의 버전 관리 절과 대조해 정책 위반이 없는지 재확인(이번 리뷰 범위에서는 해당 절 본문이 diff 에 포함되지 않아 직접 대조 불가).

## 요약

이번 변경분의 실질 API 계약 표면은 두 DTO 파일(`background-run-response.dto.ts`, `create-assistant-session.dto.ts`)로 좁다. 두 파일 모두 "OpenAPI 선언 vs TS 타입"이 서로 다른 말을 하던 기존 결함(계약 거짓)을 실제 wire 동작에 맞춰 정정하는 성격이며, 요청 검증(`@IsOptional()` + `@IsUUID()`)이나 실제 런타임 응답 구성 로직 자체는 바뀌지 않는다. 응답 DTO 의 `required: false → true` 전환은 스펙을 더 엄격(=더 정확)하게 만드는 방향이라 기존 소비자에게 breaking 하지 않다고 판단된다. 여기에 더해 이 축을 지속적으로 강제하는 AST 기반 repo-guard(`swagger-dto-contract-guard.ts`/`swagger-dto-contract.spec.ts`)가 신설되어, 향후 유사한 OpenAPI-TS 불일치를 CI 단계에서 원천 차단한다 — API 계약 관점에서는 위험 요소라기보다 거버넌스 강화로 평가한다. 나머지 파일(테스트 픽스처 리팩터링, plan 문서 갱신)은 API 계약과 직접 관련이 없다. CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
