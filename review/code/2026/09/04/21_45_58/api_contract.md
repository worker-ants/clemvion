# API 계약(API Contract) 리뷰

## 범위 확정

`git diff --stat origin/main...HEAD -- codebase/` 로 실측한 결과, 이 브랜치가 `origin/main`
대비 실제로 바꾸는 코드는 4개 파일뿐이다:

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold` 를 `number` → `string` 으로 정정 (OpenAPI 계약 변경).
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — repo-guard 에
   `findNumericAsNumber` 축 신규 추가 (CI/개발 시점 정적분석 도구, 런타임 API 표면 아님).
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의 단위
   테스트 (동일하게 API 표면 아님).
4. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — `POST/GET/PATCH
   /api/alerts` 응답의 `threshold` 가 실제로 문자열임을 실 HTTP 로 고정하는 신규 e2e.

나머지는 `CHANGELOG.md`(문서), `plan/in-progress/spec-draft-nullable-notation-followups.md`
(planner 트래커), 그리고 `review/code/**`·`review/consistency/**` 하위 78개 중 70여 개는
**이전 리뷰 라운드(19_43_18 → 21_25_50, consistency 20_05_42)의 산출물이 이 저장소 관례에
따라 새로 커밋되는 것**이다 — 코드가 아니라 그 라운드들 자신의 기록이며, API 계약에
직접 영향을 주는 신규 표면이 아니다.

## 독립 실측 (기존 5라운드 재검증)

이 changeset 은 이미 `api_contract` reviewer 가 5회(19_43_18/20_16_17/20_39_25/21_10_30/
21_25_50) 독립적으로 검토했고 전부 LOW·Critical 0 으로 수렴했다. 그 판정을 신뢰하지 않고
직접 재확인했다:

- `alert-rule.entity.ts`: `@Column({ type: 'numeric', precision: 12, scale: 4 }) threshold:
  string;` — 엔티티가 이미 `string`. `alert-rule-response.dto.ts` 는 컨트롤러가 이 엔티티를
  그대로 반환하는 응답을 문서화하므로, 이번 정정(`number`→`string`)은 **wire 바이트를
  바꾸지 않고 선언을 실제에 맞춘 것**임을 확인.
- 쓰기 DTO(`CreateAlertRuleDto.threshold`/`UpdateAlertRuleDto.threshold`)는 여전히
  `@IsNumber() @Min(0)` 로 `number` 를 받는다 — 요청 검증은 이번 diff 로 약화되지 않았고,
  읽기/쓰기 비대칭은 의도된 설계로 양쪽 다 확인됨.
- `alerts.controller.ts`: `list`/`create`/`update` 모두 `@ApiBearerAuth`, `create`/`update` 는
  `@Roles('admin')` 로 인가가 걸려 있고, `@ApiBadRequestResponse`/`@ApiUnauthorizedResponse`/
  `@ApiForbiddenResponse` 로 에러 응답이 문서화돼 있다 — 이번 diff 가 손대지 않은 영역.
- `alerts-threshold-wire-type.e2e-spec.ts`: 정수가 아니라 `12.3456`/`7.0625` 처럼
  `numeric(12,4)` scale 을 꽉 채운 값을 쓰고, `POST`/`PATCH` 직후 응답뿐 아니라 **다시
  `GET` 으로 DB 를 재조회**해 문자열 정확 일치(`'12.3456'`)까지 단언한다 — 정수 입력이면
  `Math.round`/`parseInt` 개입으로도 통과하는 공허한 테스트가 될 수 있었던 자리를 실제로
  가른다.
- `git log`/`merge-base` 확인: `origin/main` 대비 diff 는 정확히 위 4개 코드 파일에 국한되고,
  `plan/**`·`review/**` 변경은 이 결함/가드와 결속된 문서일 뿐 다른 주제를 섞지 않는다.

## 발견사항

- **[INFO]** `CHANGELOG.md` 신규 항목에 codegen 클라이언트 영향(`**영향**: …`) 문단이
  이미 포함돼 있음을 확인 — 1라운드(`19_43_18`)에서 WARNING 으로 지적됐던 누락이 이번
  최종 diff 시점에는 이미 채워져 있다.
  - 위치: `CHANGELOG.md` 신규 섹션 내 "**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서
    `threshold` 가 `number` → `string` 으로 바뀐다…" 문단.
  - 상세: 조치 불요 — 이미 반영됨.

- **[INFO]** repo-guard(`findNumericAsNumber`)는 API 런타임 표면이 아니라 CI/개발 시점
  정적분석이므로 이 리뷰의 8개 체크리스트(하위호환·버전관리·응답형식·에러응답·요청검증·
  URL설계·페이지네이션·인증인가) 어디에도 직접 해당하지 않는다. 다만 **같은 클래스의
  DTO-엔티티 원시 타입 불일치가 향후 재발하는 것을 막는 계약 회귀 방지책**이라는 점에서
  API 계약 관점의 목적에는 부합한다 — 이번 결함(`threshold`)의 근본 원인(컨트롤러 반환
  타입 미표기로 `tsc` 가 DTO/엔티티를 대조하지 못함)은 이 가드가 있어도 여전히 열려 있고,
  이는 plan 문서(`spec-draft-nullable-notation-followups.md`)가 이미 "(a) 는 원리적으로
  안 된다 → (b) 응답 대조 테스트만 성립" 으로 스스로 정리해 둔 상태다. 이번 diff 는 그
  (b) 의 첫 대표 사례(`GET/POST/PATCH /api/alerts`)를 e2e 로 채웠다.

## 요약

이번 changeset 의 API 계약 관련 실질 변경은 `AlertRuleDto.threshold` 의 OpenAPI/TS 선언을
`number` 에서 실제 wire 형태인 `string` 으로 정정한 것 하나이며, wire 바이트·인증/인가·
요청 검증(`class-validator`)·에러 응답 문서화·URL 설계 어느 것도 변경되지 않았다. 유일한
내부 소비자(`codebase/frontend/src/lib/api/alerts.ts`)는 이미 이 형태를 손수 기대하고
있었고, 신규 e2e 테스트(`alerts-threshold-wire-type.e2e-spec.ts`)가 소수부까지 꽉 채운 값과
재조회(`GET`)로 이 사실을 실 HTTP 응답 수준에서 고정했다. 이 changeset 은 이미 API 계약
관점에서 5라운드 검토를 거쳐 제기된 Critical/Warning(정규식 위음성, 경로 판별, 명명 규약
의존, CHANGELOG 영향 고지 누락, e2e 입력이 분기를 못 가르는 문제 등)이 모두 조치·재확인됐고,
이번 독립 재검토에서도 추가로 발견된 계약 결함은 없다. `spec/1-data-model.md` 의
`threshold: Float` 라벨 불일치, `swagger.md` 성문화 등은 이미 planner 트랙 항목으로
등재돼 있어 이 reviewer 의 조치 대상이 아니다.

## 위험도

LOW
