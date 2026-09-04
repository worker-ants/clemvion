# API 계약(API Contract) 리뷰

## 범위 확정

`git diff origin/main...HEAD --stat` 로 실측한 결과 이번 changeset 은 65개 파일이고, 그중
API 계약과 관련될 수 있는 실질 변경은 **4개 코드 파일 + CHANGELOG.md** 뿐이다. 나머지
59개(`review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30}/**`,
`review/consistency/2026/09/04/20_05_42/**`)는 이전 코드 리뷰 4라운드 + consistency-check
1라운드의 산출물 문서로, 엔드포인트·DTO·에러 응답 등 API 표면을 정의하지 않는다.
`plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신도 planner 트래커 텍스트일
뿐 코드가 아니다.

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold`: `number` → `string`, `@ApiProperty({ example: 10 })` →
   `@ApiProperty({ type: String, example: '10.0000' })`.
2. `CHANGELOG.md` — 위 변경의 breaking-change 고지 섹션.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 회귀 방지용
   술어 `findNumericAsNumber`/`scanNumericExposure` (AST 기반, presence·null 에 이은 제3의
   계약 검증 축).
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의
   저장소 전수 테스트 + 대조군.
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` (신규) — `POST → GET →
   PATCH` 세 응답 모두 `threshold` 가 실 HTTP 상에서 문자열임을 고정하는 e2e.

이 중 1~4 는 **직전 세 라운드**(`19_43_18`, `20_16_17`, `20_39_25`)에서 이미 API 계약 관점으로
반복 리뷰됐고, `git diff origin/main...HEAD -- <각 파일>` 로 현재 저장소 상태를 직접 대조한
결과 그 라운드들이 확인한 최종(WARNING 전량 `RESOLUTION.md` 반영) 상태와 **바이트 단위로
동일**하다. 5(e2e-spec)는 `20_39_25` 라운드에서 신규 추가된 뒤 이번 라운드까지 변경 없이
유지되고 있다.

## 발견사항

- **[INFO]** `threshold` 타입 정정은 wire·엔티티·프런트엔드 소비자와 재확인 결과 정합
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:20-29`
  - 상세: `@Column({ type: 'numeric', precision: 12, scale: 4 })` 컬럼을 TypeORM 이 문자열로
    반환하는 실제 wire 에 OpenAPI 선언(`number`)이 맞지 않던 것을 `string` 으로 정정했다.
    `alerts.controller.ts` 는 `@Controller('alerts')` + `@Get()`/`@Post()`/`@Patch(':id')`
    이고 CHANGELOG 의 `GET /api/alerts` 표기와 일치함을 직접 확인했다. 응답이
    `AlertRuleDto` 를 반환 타입으로 annotate하지 않고 엔티티를 그대로 내보내는 구조라 wire
    바이트 자체는 이 diff 로 변하지 않는다 — 문서(OpenAPI)만 사실에 맞춘 것이다. 신규
    e2e(`alerts-threshold-wire-type.e2e-spec.ts`)가 `POST`/`GET`/`PATCH` 세 응답 모두를
    실 HTTP 로 대조해 이 주장을 런타임에서 고정한다.
  - 제안: 없음.

- **[INFO]** CHANGELOG breaking-change 고지가 자매 항목과 동일 형식으로 유지됨
  - 위치: `CHANGELOG.md:3-40`
  - 상세: `**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서 threshold 가 number → string
    으로 바뀐다…` 문단을 포함하고, 원인 서술도 `list`/`create`/`update` 세 응답 모두를
    명시한다. 이는 codegen 클라이언트에게는 **관측 가능한 스키마 변경**(타입 자체가
    바뀜)이므로, 하위 호환성 관점에서 "breaking" 으로 명시 고지한 판단은 적절하다 — 실제
    wire 는 종전부터 문자열이었으므로 정상 동작 중이던 클라이언트에는 영향이 없고, 잘못된
    `number` 선언을 신뢰해 산술을 하던 코드가 있었다면 이미 런타임에서 깨지고 있었을
    것이라는 논리도 CHANGELOG 에 명시돼 있다.
  - 제안: 없음.

- **[INFO]** 신설 회귀 가드(`findNumericAsNumber`)가 AST 기반이고 CI 상시 배선됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (신규
    export `NumericAsNumberOffender`/`NumericExposureScan`/`findNumericAsNumber`/
    `scanNumericExposure`), `swagger-dto-contract.spec.ts:322-` (`numeric 컬럼을 number 로
    문서화한 응답 DTO` describe 블록)
  - 상세: `collectTsFiles(SRC_ROOT)` 전수 스캔을 쓰는 표준 backend jest spec 이라 CI 에 항상
    포함된다. presence(`required` vs `?`)·null(`nullable` vs `| null`) 두 축으로는 원시 타입
    차이(`number` vs `string`)를 못 잡는다는 구조적 공백을, "정밀도 손실로 이어지는 numeric
    컬럼 원시 노출" 이라는 좁은 축으로 메운다 — API 응답 스키마 일관성(점검 관점 3)을
    구조적으로 강제하는 방향이라 API 계약 관점에서 긍정적이다. `<Entity>Dto` 이름 관례에
    의존하는 스코프 제한은 docstring 과 음성 대조군(`StatisticsResponseDto`)으로 명시
    문서화돼 있다.
  - 제안: 없음(문서화된 의도적 스코프이며 현재 저장소에 실질 갭 없음).

- **[INFO]** 읽기(`string`)/쓰기(`number`) 비대칭은 이번 diff 범위 밖의 기존 의도된 설계
  - 위치: `alert-rule-response.dto.ts` (응답) vs
    `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts`(요청, diff 밖)
  - 상세: `CreateAlertRuleDto.threshold` 는 여전히 `number` 를 받고 서비스가 `String(...)`
    으로 저장한다. 요청 검증(점검 관점 5) 관점에서 문제는 없다 — 사용자 입력 UX 상 자연스러운
    선택이며 이번 diff 가 새로 만든 비대칭이 아니다.
  - 제안: 조치 불요(범위 밖). `spec/1-data-model.md` 의 `threshold` `Float` 라벨 정정과
    `spec/conventions/swagger.md` 에 numeric 불변식 성문화는 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로
    등재돼 있다.

- **[INFO]** 나머지 59개 신규 파일(`review/code/**`, `review/consistency/**`)은 API 표면이
  아닌 리뷰 리포트/메타데이터
  - 위치: `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30}/**`,
    `review/consistency/2026/09/04/20_05_42/**`
  - 상세: 엔드포인트·DTO·에러 응답·페이지네이션·인증/인가 어느 것도 정의하지 않는 마크다운
    리포트와 `_retry_state.json`/`meta.json` 오케스트레이션 메타데이터다. API 계약 관점에서
    검토할 대상이 없다.
  - 제안: 없음.

## 요약

이번 changeset 의 API 계약 관련 실질 변경(`AlertRuleDto.threshold`: `number` → `string` +
AST 기반 회귀 가드 + e2e 고정)은 직전 세 코드 리뷰 라운드(`19_43_18`, `20_16_17`,
`20_39_25`)와 consistency-check 라운드(`20_05_42`)를 거치며 지적된 WARNING(회귀 테스트
부재·영향범위 서술 축소·codegen 고지 누락·JSDoc 내부 서사 노출·라우트 오기)이 모두 해소된
상태로 유지되고 있다. `git diff` 로 현재 저장소를 직접 대조한 결과 이번 라운드에서 해당 5개
실질 파일에 새로 추가된 변경은 없으며, 이번 diff 가 새로 담고 있는 나머지 59개 파일은 이전
라운드들의 리뷰/consistency 리포트 자체(API 표면 아님)다. wire 바이트는 불변이고, OpenAPI
선언만 실제(문자열)에 맞춘 것이며 codegen 클라이언트 영향은 CHANGELOG 에 명시 고지돼 있다.
요청 검증·에러 응답·URL 설계·페이지네이션·인증/인가 어느 축에도 이번 changeset 이 새로
관여하지 않는다.

## 위험도

LOW
