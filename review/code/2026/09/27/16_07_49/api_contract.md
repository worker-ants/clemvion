# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 요청 DTO 3필드(`string`/`string[]` → `string | null`/`string[] | null`)는 순수 additive 변경 — breaking 아님
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:49-62`, `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:55-62`, `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:27-35`
  - 상세: `PATCH /workflows/:id` `description` · `PATCH /nodes/:id` `description` · `PATCH /auth-configs/:id` `ipWhitelist` 는 원래 런타임에서 `null` 을 받아 값을 지웠는데 OpenAPI 선언(`@ApiPropertyOptional`)과 TS 타입이 그 입력을 광고하지 않고 있었다. 이번 변경은 **선언을 실제 런타임 동작에 맞춘 것**으로, 기존에 `string`/`string[]` 만 보내던 클라이언트는 영향이 없고 신규로 `null` 을 보낼 수 있는 폭만 넓어진다. 응답 DTO(`WorkflowResponseDto.description`, `NodeResponseDto.description`, `AuthConfigResponseDto.ipWhitelist`, 모두 diff 밖 기존 코드)는 이미 `nullable: true` 로 선언돼 있어, 요청↔응답 스키마가 이번 변경으로 오히려 정합해졌다. 검증도 `contractForDto` 기반 선언 캐너리(각 DTO spec) + `swagger-dto-contract.spec.ts` 가드로 고정됨. Breaking change 없음, 버전 관리 이슈 없음.
  - 제안: 조치 불요. OpenAPI 스펙을 코드젠하는 외부 클라이언트가 있다면 배포 노트에 "3개 요청 필드가 nullable 로 확장됨"만 남기면 충분.

- **[INFO]** `PATCH` 로 NOT NULL 컬럼에 `null` 전송 시 500 — 이번 diff 의 3필드는 해당 없으나 API 에러 응답 관점의 기존 결함이 이번 조사로 드러남
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1440-1454` (신규 트래커 항목), 근거 실측은 `plan/in-progress/patch-body-followups.md:21-30`
  - 상세: `@IsOptional()` 은 `null` 도 "값 없음"으로 취급해 다른 검증 데코레이터(`@IsString`, `@MaxLength` 등)를 건너뛰므로, NOT NULL 컬럼(`Workflow.name/tags/isActive`, `Node.config`, `AuthConfig.name/isActive`, `Folder.name` 등)에 `null` 이 그대로 병합돼 Postgres 23502 위반이 나고 전역 예외 필터가 이를 500 `INTERNAL_ERROR` 로 응답한다(노드 `label: null` 은 라벨 중복 검사가 오작동해 엉뚱한 409 로 나온다). 클라이언트 입력 오류가 4xx 가 아니라 5xx 로 응답되는 것은 에러 응답 계약(HTTP 상태 코드 적절성) 위반이다. **이번 diff 가 다루는 3개 필드는 모두 nullable 컬럼**이라 이 결함과 무관하고, 새 결함도 아니다 — 실측(`_test_logs/e2e-20260927-151214.log`, 수정 전 코드)으로 기존부터 있던 동작임을 확인했고 `--impl-prep`(`review/consistency/2026/09/27/15_19_25`, BLOCK:NO)에서 별도 트래커 항목으로 이미 등재·처분됐다.
  - 제안: 이번 PR 범위로 끌어올 필요 없음(조치 불요). 다만 새 트래커 항목이 실제로 착수될 때 처방은 필터의 23502 매핑이 아니라 **입구(DTO) 검증**(`@ValidateIf` 등)이어야 한다는 점만 재확인 — 트래커 문서가 이미 그렇게 적어 두었다.

- **[INFO]** `ipWhitelist` "화이트리스트 없음" 상태가 `null` 과 `[]` 두 값으로 공존 — canonical 값 정규화 없음
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:49,52-53`
  - 상세: CHANGELOG·JSDoc 이 "`null` 과 빈 배열은 같은 뜻"이라 명시하고 enforcement 레벨(`verifyWebhookRequest`)에서 `it.each(['null', []])` 캐너리로 동치를 확인했지만(`auth-configs.service.spec.ts:716-732`), 저장/응답 값 자체는 보낸 그대로(`null` 이면 `null`, `[]` 이면 `[]`) 유지된다. 계약상 동치이나 `=== null` 로 엄격 비교하는 클라이언트가 있으면 오작동할 수 있다.
  - 제안: 의도된 설계로 판단됨(차단 사유 아님). 후속으로 저장 시 canonical 값(`[]` 등)으로 정규화하는 방안을 고려할 여지는 있음.

## 요약

이번 diff 는 `PATCH /workflows/:id`·`PATCH /nodes/:id`·`PATCH /auth-configs/:id` 세 요청 DTO 필드의 타입/OpenAPI 선언을 이미 존재하던 런타임 동작(`null` 로 값 지우기)에 맞추는 순수 additive 변경이다. 응답 DTO 는 이미 `nullable: true` 로 선언돼 있어 요청↔응답 스키마 정합성이 오히려 개선됐고, 선언과 동작 양쪽을 잡는 캐너리(검증기 + `contractForDto` 스키마 단언)와 mutation 테스트(D1~D6)로 회귀 방지가 확인됐다. 하위 호환성 파괴·버전 관리 이슈·URL/페이지네이션/인증·인가 관련 변경은 없다. 조사 중 드러난 "PATCH NOT NULL 필드 + `null` → 500"은 에러 응답 계약 관점에서 실재하는 기존 결함이지만 이번 diff 범위 밖이며 이미 별도 트래커 항목으로 문서화·처분(BLOCK:NO)됐으므로 본 PR 을 막을 사유는 아니다.

## 위험도
LOW
