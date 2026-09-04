# API 계약(API Contract) 리뷰

## 범위 확정

`git diff origin/main...HEAD --stat` 로 실측한 결과 이번 changeset 은 52개 파일이며, 그중
API 계약(엔드포인트·DTO·응답 스키마)과 직접 관련된 실질 변경은 다음 6개뿐이다. 나머지
46개(`review/code/2026/09/04/{19_43_18,20_16_17,20_39_25}/**`,
`review/consistency/2026/09/04/20_05_42/**`)는 이전 세 코드 리뷰 라운드 +
consistency-check 라운드의 산출물이 이 브랜치에 신규 커밋으로 포함된 것으로, 리포트
문서 자체이지 API 표면이 아니다.

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold`: `number` → `string`, `@ApiProperty({ example: 10 })` →
   `@ApiProperty({ type: String, example: '10.0000' })`.
2. `CHANGELOG.md` — 위 변경의 breaking-change 고지 섹션.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 회귀
   방지용 술어 `findNumericAsNumber`(AST 기반, 제3의 계약 검증 축) 신설.
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의
   저장소 전수 테스트 + 대조군.
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — `POST → GET → PATCH`
   세 응답의 `threshold` wire 타입을 실 HTTP 로 고정하는 신규 e2e.
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신
   (코드 아님).

이 6개 파일은 직전 세 라운드(`19_43_18`→`20_16_17`→`20_39_25`)에서 이미 API 계약
관점으로 리뷰됐다. 소스를 직접 열어 팩트를 독립 재검증한 결과는 아래와 같다.

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 타입 정정(`number`→`string`)이 wire·엔티티·프런트엔드
  소비자·요청 DTO 전부와 실측으로 부합함
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28-29`
    (`@ApiProperty({ type: String, example: '10.0000' }) threshold: string;`)
  - 상세: 직접 확인한 사실 — 엔티티 `alert-rule.entity.ts:35` `threshold: string`
    (`@Column({ type: 'numeric', precision: 12, scale: 4 })`), 서비스 `alerts.service.ts`
    가 `list(): Promise<AlertRule[]>` / `create()`·`update(): Promise<AlertRule>` 로 엔티티를
    그대로 반환, 컨트롤러 `alerts.controller.ts` 의 `list`/`create`/`update` 세 핸들러 모두
    반환 타입 미명시(`{ data: rules }` 로 그대로 감싸 반환), 요청 DTO
    `dto/alert-rule.dto.ts:34` `CreateAlertRuleDto.threshold: number`(`@IsNumber() @Min(0)`).
    즉 "엔티티가 그대로 나가는데 컨트롤러에 반환 타입 표기가 없어 `tsc` 가 못 잡았다"는
    CHANGELOG·JSDoc 서술이 코드와 정확히 일치하고, 읽기(`string`)/쓰기(`number`) 비대칭도
    실제 검증 데코레이터·서비스 저장 로직과 부합한다. 순수 문서 정합화이며 런타임 wire
    바이트 변화 없음.
  - 제안: 없음.

- **[INFO]** 신규 e2e(`alerts-threshold-wire-type.e2e-spec.ts`)가 실제 라우트·응답 포맷과
  일치함
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:65-95`
  - 상세: 테스트가 호출하는 `POST /api/alerts`, `GET /api/alerts`,
    `PATCH /api/alerts/${id}` 는 컨트롤러의 `@Controller('alerts')` + `@Post()`/`@Get()`/
    `@Patch(':id')` 와 정확히 일치한다(과거 라운드가 지적했던 `/api/alerts/rules` 오기는
    이 파일에 없다). 값·타입 이중 단언(`typeof === 'string'` + `Number(...)` 값 비교 +
    `GET` 응답에는 `/^\d+\.\d{4}$/` scale 패턴까지)으로 "타입만 맞고 값은 무엇이든 통과"하는
    공허한 단언을 피했다. `POST`/`PATCH` 는 `threshold: number`(10, 15)를 보내고 응답이
    문자열임을 확인해 요청·응답 비대칭도 함께 고정한다.
  - 제안: 없음.

- **[INFO]** 신설 회귀 가드(`findNumericAsNumber`)는 CI 상시 배선된 저장소 전수 스캔이며,
  알려진 스코프 제한이 음성 대조군으로 문서화돼 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
    (`scanNumericExposure`, `dto.replace(/Dto$/, '')` 로 `<Entity>Dto` 이름 관례에 의존),
    `swagger-dto-contract.spec.ts:293`(`expect(findNumericAsNumber(collectTsFiles(SRC_ROOT))).toEqual([])`),
    `:443-455`(`[알려진 한계] <Entity>Dto 관례를 벗어난 이름은 못 본다`)
  - 상세: `collectTsFiles(SRC_ROOT)` 전수 스캔이라 backend jest 표준 실행에 자연 포함되는
    상시 가드다. 다만 술어는 `<Entity>Dto` 명명 관례(예: `AlertRuleDto` ↔ `AlertRule`)에
    의존하므로, 엔티티를 그대로 반환하면서 이 명명을 따르지 않는 새 응답 DTO(예:
    `AlertRuleDetailDto`, `AlertRuleSummaryDto`)가 향후 추가되면 `numeric` 컬럼을 `number`
    로 잘못 문서화해도 조용히 통과한다. 이 한계는 저장소가 스스로 인지하고 테스트로
    캐너리화해 두었으므로(negative control 존재), API 계약 위험이라기보다 향후 확장
    시 주의할 스코프 경계다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 `spec/conventions/swagger.md` 성문화 항목으로 등재돼 있어 별도 신규 지적은 불요.
  - 제안: 없음 (plan 에 이미 추적됨).

- **[INFO]** CHANGELOG breaking-change 고지가 자매 항목과 동일 형식(`**영향**:` 문단)으로
  보강돼 있어 일관성 있음
  - 위치: `CHANGELOG.md:25-27`
  - 상세: "**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서 `threshold` 가 `number` →
    `string` 으로 바뀐다…" 문단이 포함돼 있어, 같은 파일 내 `invitedBy`·`ipWhitelist`·
    `ExecutionStatusDto` 등 다른 DTO drift 항목들의 고지 형식과 일치한다. 원인 서술도
    `list`/`create`/`update` 세 응답 모두를 명시해 실측(컨트롤러 3곳 모두 반환 타입
    미명시)과 부합한다.
  - 제안: 없음.

- **[INFO]** 읽기(`string`)/쓰기(`number`) 비대칭은 이번 diff 가 만든 상태가 아니며, 요청
  검증 자체는 정상
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
    (응답) vs `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts:26-34`(요청, diff
    밖)
  - 상세: `CreateAlertRuleDto.threshold` 는 `@IsNumber() @Min(0)` 로 검증되는 `number` 이고
    서비스가 `String(...)` 으로 저장한다. 같은 리소스의 같은 필드가 요청·응답에서 원시
    타입이 다른 것은 API 문서를 처음 보는 제3자에게 직관적이지 않을 수 있으나, 이는
    기존 설계이고 이번 PR 범위 밖이며 요청 유효성 검증 자체에는 결함이 없다.
  - 제안: 없음 — 범위 밖.

## 요약

이번 changeset 의 API 계약 관련 실질 변경은 `AlertRuleDto.threshold` 의 OpenAPI 선언을
`number` 에서 실제 wire·엔티티 타입인 `string` 으로 정정한 것 하나이며(순수 문서
정합화, wire 바이트 불변), 엔티티·서비스·컨트롤러·프런트엔드 소비자·요청 DTO 를 직접
열어 재검증한 결과 CHANGELOG·JSDoc·plan 문서의 서술과 코드가 전부 일치했다. 신규
e2e 는 실제 라우트와 정확히 맞고 값까지 단언해 회귀를 실질적으로 방어하며, 신설
정적 가드는 CI 상시 배선에 알려진 스코프 제한도 음성 대조군으로 문서화돼 있다. 이
6개 실질 파일은 직전 세 리뷰 라운드에서 지적된 WARNING(회귀 테스트 부재·영향범위
서술 축소·codegen 고지 누락·plan 산술 불일치·라우트 오기)이 이미 모두 해소된
상태이고, 이번 재검증에서 그 사실을 코드 레벨로 재확인했을 뿐 새로운 계약 위반은
발견되지 않았다. 응답 형식·에러 응답·URL 설계·페이지네이션·인증/인가 어느 축에도
이번 changeset 은 추가로 관여하지 않는다.

## 위험도

LOW
