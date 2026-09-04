# API 계약(API Contract) 리뷰

## 검토 범위 메모

이번 배치(63개 파일)의 대다수는 이전 3회 코드리뷰(`11_02_30`→`11_44_16`→`12_17_50`)·1회
consistency-check(`11_33_21`) 세션 자신의 산출물(`review/**` 마크다운·JSON)이 커밋되어 diff 에
실려 있는 것이다. API 계약 관점에서 실질 표면을 갖는 파일은 다음 세 개뿐이며, 실제 저장소
파일을 직접 열어 diff 와 대조 확인했다.

- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
- `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (신규 — 위 두 DTO 류의
  계약 정합을 CI 에서 강제하는 AST 가드. API 엔드포인트 자체는 아니지만 계약 정확도를 담보하는
  코드라 함께 확인)

나머지(테스트 픽스처 리팩터, plan 문서, 이전 리뷰 산출물)는 API 계약과 무관하다.

## 발견사항

- **[INFO]** `BackgroundRunNodeExecutionDto`/`BackgroundRunResponseDto` 계열 8필드의 OpenAPI
  `required` 가 `false → true` 로 전환된다 — 실질은 "숨겨져 있던 사실을 드러낸 것"이라 breaking 아님
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43`(`finishedAt`), `:46`(`durationMs`), `:49-55`(`inputData`), `:58-64`(`outputData`), `:67-73`(`error`), `:84-87`(`nextCursor`), `:142`(`completedAt`), `:145-148`(`durationMs`, `BackgroundRunResponseDto`)
  - 상세: `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환으로 OpenAPI 스펙상 이
    필드들이 `required: false`(선택)에서 `required: true`(항상 존재, 값만 `null` 가능)로 바뀐다.
    TS 타입은 이번 diff 이전부터 이미 `T | null`(생략 불가)이었고, 서비스 레이어(응답 조립 로직)도
    diff 에 포함되지 않아 실제 wire 동작은 변하지 않는다 — 문서가 실제를 뒤늦게 따라잡는 방향.
    엄격한 OpenAPI 코드제너레이터(orval 등)를 쓰는 외부 소비자는 재생성 시 생성 타입이
    `field?: T | null` → `field: T | null` 로 바뀌어 컴파일 타임에 optional-check 분기가
    불필요해진다 — 컴파일 에러가 날 수 있는 유일한 방향은 "생성된 optional 체이닝을 유지한 채
    재생성 안 함" 인데 이는 흔한 안전한 상태다. 런타임 계약이 좁아지는(더 엄격해지는) 것이 아니라
    문서가 정확해지는 것이라 클라이언트 breaking 으로 보지 않는다.
  - 제안: 별도 API 버전 분기는 불필요(계약을 좁히는 것이 아니라 정합화이므로). `CHANGELOG.md` 에
    이미 "종전/지금" 표와 영향 서술이 기록돼 있어 충분하다.

- **[INFO]** `CreateAssistantSessionDto.llmConfigId` 요청 DTO 타입이 `string?` → `string | null` 로
  넓어졌다 — OpenAPI 출력·검증 동작 변화 없음, 실측으로 확인
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: 데코레이터는 이미 `@ApiPropertyOptional({ nullable: true })`(변경 전부터 동일)이고
    `@IsOptional()` 은 `null`/`undefined` 모두에서 `@IsUUID()` 검증을 건너뛴다(class-validator
    구현 확인). 소비처 `workflow-assistant-session.service.ts:91` (`dto.llmConfigId ?? null`)는
    이번 diff 이전부터 `null` 을 받아 처리하고 있었다 — 직접 grep 으로 확인. 자매 DTO
    `update-assistant-session.dto.ts:29`(`llmConfigId?: string | null`)는 한 걸음 더 나아가 키
    생략(=값 불변)과 명시적 `null`(=초기화)을 다른 의미로 쓰는 PATCH tri-state 이고, 이 필드가
    §5.4(응답 바디 전용 규칙)의 소급 대상이 아니라는 CHANGELOG 의 판단도 spec 문면과 일치한다.
  - 제안: 없음(정정 완료로 충분).

- **[INFO]** 신설 가드 `swagger-dto-contract-guard.ts` 의 boolean 옵션 판독이 리터럴 `true`/`false`
  만 인식한다 — 계약 정합 enforcement 자체의 신뢰도에 관한 잔여 갭(이전 라운드에서도 지목, 여전히 미조치)
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:58-74`(`readBooleanOption`), `:83-90`(`hasTopLevelNull` — `ParenthesizedTypeNode` 미언랩)
  - 상세: `nullable`/`required` 값이 상수 참조·표현식으로 주어지면 `TrueKeyword`/`FalseKeyword`
    매칭에 걸리지 않아 판정이 조용히 스킵된다. `(T | null)` 처럼 괄호로 감싼 유니온도 최상위
    `ts.isUnionTypeNode` 판정에서 벗어난다. 두 갭 모두 저장소 실측(2026-09-04, 1,096개 필드)에서는
    실사례 0건으로 즉각 위험은 없지만, 이 가드가 "API 계약과 TS 타입이 항상 일치함"을 보장하는
    유일한 CI 관문이므로 이 두 형태가 등장하는 순간 그 보장이 조용히 깨진다.
  - 제안: 낮은 우선순위(현재 실사례 없음, 이미 이전 라운드 testing/maintainability 리뷰에 등재됨).
    급하지 않다.

## 요약

이번 diff 의 실질 API 계약 표면은 두 DTO 파일(`background-run-response.dto.ts`,
`create-assistant-session.dto.ts`)로 좁고, 둘 다 "OpenAPI 선언 vs TS 타입"이 서로 다른 말을
하던 기존 결함(계약 거짓)을 실제 wire 동작에 맞춰 정정하는 성격이다 — 요청 검증
(`@IsOptional()`+`@IsUUID()`)이나 응답 조립 로직 자체는 바뀌지 않았고, 소비 서비스 코드가 이미
그 넓은/정확한 타입을 전제로 짜여 있었음을 직접 확인했다. 응답 DTO 8필드의
`required: false → true` 전환은 스펙을 더 엄격(=더 정확)하게 만드는 방향이라 기존 소비자에게
breaking 하지 않다. 재발 방지 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`)가 이 축을 AST
기반으로 지속 강제하도록 신설됐고, presence·null 두 축의 판정 로직 자체(§5.4 규칙과의 대조)도
직접 읽어 정확함을 확인했다 — 잔여 갭(비-리터럴 boolean 옵션, 괄호 유니온 미언랩)은 현재 실사례
0건인 이론적 한계로 이미 이전 라운드에 등재돼 있다. CRITICAL/WARNING 급 API 계약 결함은
발견되지 않았다.

## 위험도

LOW
