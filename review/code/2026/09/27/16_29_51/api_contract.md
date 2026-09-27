# API 계약(API Contract) 리뷰

## 검증 방법

- `PATCH /workflows/:id` · `PATCH /nodes/:id` · `PATCH /auth-configs/:id` 요청 DTO 3종(`UpdateWorkflowDto.description` ·
  `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist`)의 현재 소스(`update-workflow.dto.ts` ·
  `update-node.dto.ts` · `update-auth-config.dto.ts`)를 직접 열어 `nullable: true` + `T | null` 선언과 데코레이터
  순서(`@IsOptional()` 가 `@IsString()`/`@IsArray()` 보다 앞)를 대조.
- 1R(`review/code/2026/09/27/15_46_38`) · 2R(`review/code/2026/09/27/16_07_49`) 의 api_contract 리포트와 RESOLUTION 을
  읽고, 이번 diff(3R, 2R 이후 코드 변경은 `6add3194e` 하나)가 그 판정을 뒤집는 새 사실을 들여오는지만 재확인.
- `6add3194e` 로 고친 세 DTO spec 의 JSDoc 참조(`patch-partial-body.e2e-spec.ts` 파일명만, 케이스 문자 제거)를 grep 으로
  실제 반영 확인.
- 저장소 트리에는 쓰지 않았다(읽기 전용 확인만 수행) — `git status --short` 변경 없음.

## 발견사항

- **[INFO]** 요청 DTO 3필드(`string`/`string[]` → `string | null`/`string[] | null`)는 순수 additive 변경 — breaking 아님, 버전 관리 이슈 없음
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`(`description?: string | null;`),
    `codebase/backend/src/modules/nodes/dto/update-node.dto.ts`(`description?: string | null;`),
    `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`(`ipWhitelist?: string[] | null;`)
  - 상세: 세 필드는 런타임에서 이미 `null` 을 받아 값을 지우던 기존 동작인데 OpenAPI 선언(`@ApiPropertyOptional`)과 TS 타입이 그
    입력을 광고하지 않고 있었다. 이번 변경은 선언을 실제 동작에 맞춘 것뿐이라 기존에 `string`/`string[]` 만 보내던 클라이언트는
    영향이 없다. 대응 응답 DTO(`WorkflowResponseDto.description` · `NodeResponseDto.description` ·
    `AuthConfigResponseDto.ipWhitelist`, 모두 이번 diff 밖)는 이미 `nullable: true` 로 선언돼 있어, 이번 변경으로 요청↔응답
    스키마가 오히려 정합해졌다.
  - 제안: 조치 불요.

- **[INFO]** 요청 검증(`class-validator`) 은 `@IsOptional()` 이 `null`/`undefined` 모두에서 후행 검증기(`@IsString()` ·
  `@IsArray()` · `@IsIpOrCidr({ each: true })`)를 건너뛰는 표준 동작에 의존한다 — 이번 diff 가 그 동작을 바꾸지 않았고, 선언
  캐너리(`auth-config-ip-whitelist.dto.spec.ts` · `node-dto-validation.spec.ts` · `workflow-dto-validation.spec.ts` 의
  "검증기가 null 을 통과시킨다"/"OpenAPI 가 nullable 로 광고한다")가 검증 통과와 스키마 선언 두 축을 각각 고정한다.
  - 위치: 위 세 DTO 파일 — 데코레이터 순서 `@IsOptional()` → `@IsString()`/`@IsArray()`/`@IsIpOrCidr` (변경 없음, 순서 유지 확인)
  - 제안: 조치 불요.

- **[INFO]** 에러 응답 계약: `PATCH` 요청 DTO 의 `@IsOptional()` 필드가 실제로는 NOT NULL 컬럼(예: `Workflow.name`/`tags`/`isActive`,
  `Node.config`, `AuthConfig.name`/`isActive`)에 매핑될 때 `null` 을 보내면 Postgres 23502 위반이 전역 예외 필터에서
  500(`INTERNAL_ERROR`)으로 응답된다 — 클라이언트 입력 오류가 4xx 가 아니라 5xx 로 나가는 것은 에러 응답 계약 위반이지만,
  **이번 diff 의 3필드는 모두 nullable 컬럼**이라 해당 없고 새로 만든 결함도 아니다. 이미 별도로 실측·등재·처분(BLOCK:NO)됐다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 트래커 항목 "PATCH 의 NOT NULL 필드에 `null` 을
    보내면 500 이다"), 근거 실측은 `plan/in-progress/patch-body-followups.md`
  - 제안: 이번 PR 범위 아님, 조치 불요·재-flag 금지(1R·2R 리포트가 이미 같은 결론). 착수 시 처방은 필터의 23502 매핑이 아니라
    입구(DTO) 검증(`@ValidateIf` 등)이어야 한다는 방향도 트래커에 이미 명시돼 있다.

- **[INFO]** `ipWhitelist` 의 "화이트리스트 없음" 상태가 `null` 과 빈 배열(`[]`) 두 값으로 영구 공존 — 저장/응답 값은 보낸 그대로
  유지되며 canonical 값으로 정규화하지 않는다(1R·2R 과 동일 관찰, 코드 변경 없음 재확인).
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`(`ipWhitelist?: string[] | null;` ·
    JSDoc "null · 빈 배열이면 전체 삭제")
  - 제안: 의도된 설계(CHANGELOG 명시, `verifyWebhookRequest` 의 `it.each(['null', []])` 캐너리로 동치 확인됨) — 차단 사유
    아님.

- **[INFO]** 2R WARNING(세 DTO spec 의 JSDoc 이 존재하지 않는 e2e 케이스 문자 `E` 를 인용하던 stale 참조)이 `6add3194e` 로
  해소됨 — 케이스 문자를 빼고 파일명만 인용하도록 세 파일 모두 동시 수정됨. API 계약 자체와는 무관한 문서 정합 수정이라
  본 리뷰 관점에서는 영향 없음(회귀 아님을 확인).
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts` ·
    `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts` ·
    `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts` — 세 파일 모두 "그 회귀를 여기서
    잡는다. 동작(null 이 값을 지운다)은 `test/patch-partial-body.e2e-spec.ts` 가 본다."로 통일됨(grep 으로 확인, 케이스 문자
    없음)
  - 제안: 조치 불요.

## 정합성 확인 (참고 — 문제 없음)

- URL/경로 설계·페이지네이션·인증/인가는 이번 diff 에서 변경되지 않았다(엔드포인트 신설/변경 없음, guard·라우트 미변경).
- 선언(swagger)과 타입(TS)을 함께 되돌리는 회귀를 잡는 캐너리 3건 + `swagger-dto-contract.spec.ts` 가드 + mutation(D1~D6)
  실측이 1R·2R 에 걸쳐 이미 검증돼 있고, 이번 diff 가 그 방어를 약화시키지 않았다.
- `review/code/2026/09/27/{15_46_38,16_07_49}/**` · `review/consistency/2026/09/27/15_19_25/**` 는 이번 작업의 리뷰
  세션 산출물(문서)이며 API 계약에 영향을 주는 코드가 아니다.

## 요약

3라운드째 재확인한 결과, 이번 변경은 `PATCH /workflows/:id`·`PATCH /nodes/:id`·`PATCH /auth-configs/:id` 세 요청 DTO
필드의 OpenAPI `nullable` 선언과 TS 타입을 이미 그렇게 동작하던 런타임에 맞춘 순수 additive 변경으로, breaking change
가 아니다. 요청 검증(`@IsOptional()` 경유 null 허용)은 동작 변화 없이 선언만 뒤따라갔고, 응답 DTO 와의 스키마 정합성도
이번 변경으로 완성됐다. 2R 에서 지적된 유일한 관련 WARNING(stale e2e 케이스 문자 참조)은 `6add3194e` 로 세 파일 모두
동시에 해소되어 재발 형태(한 곳만 고치는 부분 수정)가 아님을 확인했다. 조사 과정에서 드러난 "PATCH NOT NULL 필드 +
`null` → 500"과 "`ipWhitelist` null/`[]` 공존"은 실재하는 관찰이지만 둘 다 이번 diff 범위 밖의 기존 동작이며 이미
트래커에 등재·처분(BLOCK:NO)되어 있어 차단 사유가 아니다. 신규 Critical·Warning 없음.

## 위험도

LOW
