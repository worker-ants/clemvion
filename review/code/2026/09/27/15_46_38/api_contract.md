# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** PATCH 요청의 NOT NULL 컬럼 필드에 `null` 을 보내면 500(`INTERNAL_ERROR`)이 난다 — 에러 응답 계약(4번 관점: HTTP 상태 코드 적절성) 위반이지만 이번 diff 의 회귀가 아니라 **이미 실측되고 트래커에 등재된 기존 결함**이다.
  - 위치: `plan/in-progress/patch-body-followups.md`(실측 표, "실측 (2026-09-27, origin/main `6acc4dbc5`)" 절) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(새 백로그 항목 "PATCH 의 NOT NULL 필드에 `null` 을 보내면 500 이다")
  - 상세: `@IsOptional()` 이 `null` 도 "값 없음" 으로 보고 이후 검증기를 건너뛰어, NOT NULL 컬럼(예: `Workflow.name/tags/isActive`, `Node.config`, `AuthConfig.name/isActive`, `Folder.name`)에 `null` 이 그대로 병합돼 Postgres 23502 위반 → 전역 예외 필터가 500 으로 떨어뜨린다. 클라이언트 입력이 500 을 만드는 형태라 API 계약 관점에서는 400 이어야 정상이다.
  - 제안: 이미 작성된 처리(입구 DTO 에 `@ValidateIf`류로 null 도 검증기에 닿게 하거나 "생략은 되지만 null 은 안 됨" 공용 데코레이터)를 그대로 진행하면 된다 — 이번 PR 의 범위로 끌어올 필요는 없음(트래커 항목이 이미 그 방향과 `keyset-cursor-uuid-validation.md §A`(필터 매핑 기각 근거)를 인용해 두었다).

- **[INFO]** `ipWhitelist` 의 "화이트리스트 없음" 상태가 `null` 과 빈 배열(`[]`) 두 가지 값으로 표현되며, 응답도 마지막으로 보낸 값을 그대로 반영한다(정규화 없음) — 계약 상 동치이나 클라이언트는 두 형태를 모두 처리해야 한다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:52-53`(description·`nullable: true`), `codebase/backend/test/patch-partial-body.e2e-spec.ts` 케이스 E("`ipWhitelist: null`" 를 보내면 응답·GET 모두 `null`)
  - 상세: CHANGELOG 에 "`null` 과 빈 배열(`[]`)이 같은 뜻"이라고 명시했지만, `[]` 로 지운 뒤 GET 하면 `[]` 가, `null` 로 지운 뒤 GET 하면 `null` 이 그대로 응답에 실린다(둘 다 유효한 "empty" 표현이 영구히 공존). 엄격한 동등 비교(`ipWhitelist === null`)를 하는 클라이언트가 있다면 오작동할 수 있다.
  - 제안: 이미 문서화된 의도적 설계이므로 차단 사유는 아니다. 다만 서비스 계층에서 저장 시 하나의 canonical 값(예: `[]`)으로 정규화하는 방안을 향후 고려할 여지는 남겨둔다.

## 정합성 확인 (참고 — 문제 없음)

- 응답 DTO(`workflow-response.dto.ts:25`, `node-response.dto.ts:44`, `auth-config-response.dto.ts:28`)는 이미 이전 PR(`patch-omit-undefined`)에서 `string | null` / `string[] | null` 로 nullable 을 선언해 두었다. 이번 diff 는 그 대칭이 안 맞던 **요청** DTO(`UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist`) 셋만 실제 런타임 동작(이미 null 을 받아 값을 지운다)에 맞춰 `nullable: true` + `T | null` 로 선언한 것으로, 응답·요청 스키마 간 drift 를 없애는 방향의 변경이다. Breaking change 아님(순수 additive — 이미 동작하던 입력을 이제서야 광고).
- 검증 로직 변경 없음(`@IsOptional()` 이 원래도 `null` 을 통과시켰다) — 타입·데코레이터만 동작을 뒤따라간 것이므로 하위 호환성 문제 없음.
- 선언(swagger)과 타입(TS)을 함께 되돌리는 회귀를 잡는 캐너리(`auth-config-ip-whitelist.dto.spec.ts` · `node-dto-validation.spec.ts` · `workflow-dto-validation.spec.ts` 각 "OpenAPI 가 nullable 로 광고한다")가 신설됐고, 뮤테이션(D1~D6)으로 "캐너리 없이는 기존 swagger 가드가 이 조합을 못 잡는다"는 빈 곳까지 실측했다 — 계약 회귀 방지 커버리지가 충분하다.
- URL/경로·페이지네이션·인증/인가는 이번 diff 에서 변경되지 않았다(엔드포인트 신설/변경 없음, 가드 미변경).
- `omit-undefined.ts` 변경은 JSDoc 주석 추가뿐으로 계약에 영향 없음.

## 요약

이번 변경은 `PATCH /workflows/:id`·`PATCH /nodes/:id`·`PATCH /auth-configs/:id` 세 요청 DTO 의 OpenAPI 선언(`nullable`)과 TS 타입을, 이미 그렇게 동작하던 런타임에 맞춰 추가한 것으로 순수 additive 하며 breaking change 가 아니다. 응답 DTO 는 이전 PR 에서 이미 nullable 로 선언돼 있어 요청·응답 스키마 간 정합성이 이번 변경으로 완성되며, 선언·동작 회귀를 잡는 캐너리와 뮤테이션 실측까지 갖춰 계약 방어가 탄탄하다. 부수적으로 발견된 "NOT NULL 필드에 null PATCH → 500" 은 실제 에러 응답 계약 결함이지만 이번 PR 범위 밖으로 명확히 분리되어 트래커에 등재됐고, `ipWhitelist` 의 `null`/`[]` 동치 표현 공존은 사소한 응답 일관성 관찰이다. 둘 다 차단 사유가 아니다.

## 위험도

LOW
