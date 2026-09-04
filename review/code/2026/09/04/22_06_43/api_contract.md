# API 계약(API Contract) 리뷰

## 범위 확정

`git diff --stat origin/main...HEAD -- codebase/ CHANGELOG.md plan/ spec/` 로 실측한 결과,
실질 코드·문서 변경은 다음 6개 파일뿐이다(90개 diff 파일 중 나머지 84개는
`review/code/**`·`review/consistency/**` 산출물이 신규 커밋된 것으로, 이 저장소의 표준
워크플로 — 리뷰 라운드 산출물을 그 라운드가 유발한 수정과 함께 커밋 — 를 따른 것이며 API
엔드포인트·DTO·라우팅과 무관하다):

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold` 를 `number` → `string` 으로 정정 (핵심 변경)
2. `CHANGELOG.md` — 위 변경 기록
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 재발 방지
   정적 가드(`findNumericAsNumber`) 신설
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 가드 테스트
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 실 HTTP 로 wire 타입을
   고정하는 신규 e2e
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신

`alerts.controller.ts`·`alerts.service.ts`·`dto/alert-rule.dto.ts`(요청 DTO)·
`alert-rule.entity.ts` 는 이번 diff 밖이지만, 서술 검증을 위해 직접 열어 대조했다(아래
발견사항에 반영).

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 의 OpenAPI 스키마 타입 정정(`number`→`string`)은
  실제로는 **wire-호환 정정**이며, 이전 라운드에서 지적된 후속 결함이 모두 해소된 상태로
  확인됨
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28-29`,
    `CHANGELOG.md:1-38`
  - 상세: 컬럼(`alert_rule.threshold`)이 `numeric(12,4)`이고 TypeORM 이 정밀도 보존을 위해
    문자열로 반환하는데, 컨트롤러가 엔티티를 그대로 내려보내(`alerts.controller.ts` 의
    `list`/`create`/`update` 모두 반환 타입 미애노테이트) 실제 응답은 항상 문자열이었다.
    이전 리뷰 라운드(`19_43_18`)가 지적한 두 가지 — (a) 코드젠 클라이언트 영향(`영향:`)
    문단 누락, (b) "list() 만" 이라는 축소 서술 — 를 현재 `CHANGELOG.md` 에서 직접 재확인한
    결과 **둘 다 반영되어 있다**: "**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서
    `threshold` 가 `number` → `string` 으로 바뀐다…" 문단이 있고, "`list`·`create`·`update`
    세 응답 모두" 로 정정되어 있다. 라우트 표기도 `GET /api/alerts/rules`(오기) 대신
    `GET /api/alerts`(실제 `@Controller('alerts')` 와 일치)로 되어 있다.
    요청측 DTO(`CreateAlertRuleDto.threshold: number`, `@IsNumber() @Min(0)`)는 이번 diff
    밖이지만 직접 열어 확인한 결과 응답측과의 읽기/쓰기 비대칭이 CHANGELOG 서술대로
    정확하며, 검증 데코레이터도 정상이다.
  - 제안: 없음 — 조치 불요, 근거가 코드로 검증됨.

- **[INFO]** 신규 정적 가드(`findNumericAsNumber`)는 `<Entity>Dto` 이름 관례에 의존하는
  알려진 한계를 스스로 문서화·대조군으로 고정해 두었다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 의
    `findNumericAsNumber` docstring, `swagger-dto-contract.spec.ts` 의
    `[알려진 한계] '<Entity>Dto' 관례를 벗어난 이름은 못 본다` 테스트
  - 상세: 저장소에 실제로 관례를 벗어난 `StatisticsResponseDto`(자매 numeric 컬럼
    `LlmUsageLog.costUsd` 노출)가 있으나, 그쪽은 서비스가 `SUM(...)::float` + `Number(...)`
    로 명시 변환해 무해함을 서비스 코드 확인 없이 docstring 근거로만 신뢰하기보다, 리뷰
    관점에서 최소 위험으로 판단한다 — 정적 가드가 놓치는 자리이므로 향후 세 번째 numeric
    컬럼이 이름 관례를 벗어난 응답 DTO 로 노출되면 이 가드는 그것을 잡지 못한다. 이번 e2e
    (`alerts-threshold-wire-type.e2e-spec.ts`)도 `alerts` 엔드포인트 하나만 덮으므로, 다른
    numeric 노출 경로의 런타임 검증은 여전히 없다.
  - 제안: 조치 불요(이번 PR 범위 내에서는 실제 위반이 없고 한계도 명시됨). 다만 plan
    문서가 이미 "엔드포인트마다 개별 단언 대신 일반화된 응답-대-DTO 대조 헬퍼를 검토"를
    다음 착수 항목으로 등재해 두었으므로, 그 트랙에서 이 한계도 함께 다루면 된다.

- **[INFO]** `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 라벨링해 실제 wire·엔티티
  타입(`string`, `numeric(12,4)`)과 어긋나 있음을 직접 확인 — 이미 plan 에 planner 트랙
  후속으로 등재되어 있어 이번 리뷰의 조치 대상은 아님
  - 위치: `spec/1-data-model.md:873`; 등재는
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 체크박스
    (`spec/1-data-model.md:873` 이 threshold 를 Float 로 라벨링…)
  - 상세: `spec/1-data-model.md` 는 이번 diff 대상이 아니고, 이번 diff(plan 문서)가 그 스펙
    오기를 planner 트랙 항목으로 정확히 등재해 두었다(`spec/` 쓰기 권한은 developer 에게
    없으므로 올바른 처리). API 계약 관점에서는 "DTO/CHANGELOG 는 맞는데 상위 데이터 모델
    문서가 아직 stale" 상태가 남아 있다는 점만 기록해 둔다.
  - 제안: 없음 — 이미 올바른 트랙(planner)으로 위임됨. 조치 불요.

## 요약

이번 changeset 에서 API 계약에 실질적으로 관여하는 변경은 `AlertRuleDto.threshold` 의
Swagger/TS 타입을 실제 wire 형태(`string`)에 맞춰 정정한 것 하나이며, 소스 코드를 직접
열어 대조한 결과 wire 바이트·내부 소비자(`lib/api/alerts.ts`) 동작 모두 불변인 순수 계약
정합화임을 재확인했다. 이전 여러 리뷰 라운드(`19_43_18`~`21_45_58`)가 지적한 항목들 —
코드젠 영향 고지 누락, `list()` 단수 서술로 인한 영향 범위 축소, 라우트 표기 오기, 정적
가드의 정규식 위음성 4형태, 경로 판별의 OS 의존성, 이름 관례 한계 미문서화 — 은 현재 코드
상태에서 전부 반영·해소되어 있음을 CHANGELOG·DTO·가드·spec 문서를 직접 열어 확인했다.
읽기(`string`)/쓰기(`number`) 비대칭은 검증 데코레이터(`@IsNumber`, `@Min(0)`)까지 포함해
의도대로 구현되어 있고, 실 HTTP 요청으로 세 응답(`POST`/`GET`/`PATCH`)의 wire 타입·정밀도
왕복을 고정하는 e2e 테스트도 신설되었다. 에러 응답 형식·URL 설계·페이지네이션·인증/인가는
이번 diff 가 건드리지 않았고 기존 상태(라우트는 RESTful, admin 역할 가드 적용)에 이상 없다.
새로 지적할 CRITICAL/WARNING 수준 결함은 없으며, 남은 항목(가드의 이름 관례 한계, 데이터
모델 문서의 Float 오기)은 이미 올바르게 후속 트랙에 등재되어 있다.

## 위험도

NONE
