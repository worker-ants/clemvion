# 요구사항(Requirement) 리뷰 — `22_06_43`

## 검토 범위

이번 changeset 의 실질 파일은 6개다 (나머지는 이전 리뷰 라운드(`19_43_18`~`21_45_58`)의
산출물로 diff 상 신규 파일이지만 이번 요구사항 검토의 "기능" 대상이 아니다):

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold: number` → `string` 정정
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` —
   `numeric`/`decimal` 컬럼 노출 축(`findNumericAsNumber`/`scanNumericExposure`) 신설
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 가드의
   회귀 테스트 (대조군·캐너리 포함)
4. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 실 HTTP POST/GET/PATCH
   왕복으로 wire 타입을 고정하는 e2e
5. `CHANGELOG.md` — 위 변경을 설명하는 신규 Unreleased 섹션
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신
   (§5.4 drift 2단계 진행 상황·후속 3건 등재)

## 검증 방법

Read/Grep 으로 entity·DTO·controller·service·프런트엔드 소비처·spec 문서를 직접 열어
diff 의 서술(CHANGELOG·JSDoc·plan)과 대조했다. 저장소에는 아무것도 쓰지 않았다 —
`git status --short` 로 확인, 이 리뷰 세션 산출 디렉터리(`review/code/.../22_06_43/`) 외
변경 없음. `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 를 직접
실행해 34/34 PASS 를 재확인했다(e2e 는 docker 인프라가 필요해 재실행하지 않고 RESOLUTION.md
의 실측 기록에 의존).

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 정정은 엔티티·wire·프런트엔드 실측과 완전히 일치
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:29`
  - 상세: `AlertRule.threshold` 엔티티 컬럼은 `@Column({ type: 'numeric', precision: 12, scale: 4 })` (`codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:34-35`, TS 타입도 `string`). 컨트롤러 `list`/`create`/`update` 세 메서드 모두 반환 타입 애노테이션 없이 서비스의 `Promise<AlertRule[]>`/`Promise<AlertRule>` 를 그대로 반환함을 확인했다(`alerts.controller.ts`, `alerts.service.ts:14,25,43`). 프런트엔드 `codebase/frontend/src/lib/api/alerts.ts` 는 이미 읽기 타입을 `threshold: string`(11행), 쓰기 DTO 를 `threshold: number`(21행)로 갈라 두었고, 소비 화면(`profile/alerts/page.tsx:158`)은 `{r.threshold}` 로 그대로 렌더링해 타입 변경에 영향받지 않는다. `CreateAlertRuleDto`/`UpdateAlertRuleDto` 는 여전히 `@IsNumber() @Min(0) threshold: number` 로 요청측 검증이 유지된다 — 서술한 읽기/쓰기 비대칭과 정확히 일치.
  - 제안: 없음(조치 불요, 코드·문서·spec 전부 실측과 부합).

- **[INFO]** 신설 가드(`findNumericAsNumber`/`scanNumericExposure`)가 실제로 회귀를 잡는지, 그리고 "위반 0건"이 "스캔 자체가 비었기 때문"이 아닌지까지 테스트로 고정돼 있음을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:353-500` (describe `numeric 컬럼을 number 로 문서화한 응답 DTO`)
  - 상세: 저장소의 `numeric`/`decimal` 컬럼이 실제로 `alert_rule.threshold`·`llm_usage_log.cost_usd` 둘뿐임을 `grep`으로 재확인했다(엔티티 전수 검색 결과 이 두 곳만 `type: 'numeric'`/`'decimal'`). `LlmUsageLog` 계열 DTO(`StatisticsSummaryDto` 등)는 이름 관례(`<Entity>Dto`)를 벗어나 이 가드의 페어링 대상이 아니며, 실제로 서비스가 `SUM(u.cost_usd)::float` + `Number(...)`로 명시 변환하고 있어(`statistics.service.ts:346,376`) 이 가드가 못 보는 자리라도 무해함을 코드로 확인했다. `[전제]` 테스트(369-377행)가 "스캔이 실재하는 컬럼/DTO 를 집었다"를 별도로 단언해 vacuous-pass 위험을 닫는다. `npx jest`로 직접 실행해 34/34 PASS 재확인.
  - 제안: 없음.

- **[INFO]** e2e 테스트가 실제 controller route·in-memory 응답과 DB 재조회 양쪽에서 정밀도 보존을 검증
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts:73-118`
  - 상세: `POST /api/alerts` → `GET /api/alerts`(DB 재조회) → `PATCH /api/alerts/:id` → `GET /api/alerts`(재조회) 네 단계 모두에서 `typeof threshold === 'string'`과 정확한 값(`'12.3456'`/`'7.0625'`)을 단언한다. 컨트롤러 라우트(`@Controller('alerts')` + `@Post()`/`@Get()`/`@Patch(':id')`)와 헬퍼 시그니처(`registerAndLogin`/`createTeamWorkspace`)를 직접 열어 대조한 결과 정확히 일치했다. scale(4자리)을 꽉 채운 소수 값을 쓴 것도 "정수만 쓰면 반올림 손실이 있어도 통과하는" 공허한 테스트를 피하는 적절한 설계다. `test/jest-e2e.json`의 `testRegex: ".e2e-spec.ts$"`에 정확히 걸려 실행 대상에 포함됨을 확인.
  - 제안: 없음.

- **[INFO]** spec fidelity — `spec/1-data-model.md:873`이 `threshold`를 `Float`로 라벨링하지만 이 diff 는 그 문서를 건드리지 않음(회색지대, 이미 추적 중)
  - 위치: `spec/1-data-model.md:873` (`| threshold | Float | 임계치 (DB 는 NUMERIC(12,4) 고정소수) |`)
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md`의 새 체크리스트 항목(`19_43_18` INFO#6 인용)이 이 라벨 오기를 planner 트랙으로 이미 등재해 두었다. `spec/2-navigation/9-user-profile.md:406`의 API 계약 표는 **요청**(POST body)의 `threshold`를 `number`로 명시하는데, 이는 `CreateAlertRuleDto.threshold: number`와 정확히 일치하며 이번 diff 가 건드리지 않은 부분이다. 같은 문서는 응답(GET/list)의 `threshold` wire 타입을 명시하지 않으므로(320행은 컬럼 존재만 언급) 이번 DTO 변경과 직접 충돌하는 spec 문장은 없다 — CRITICAL 대상 아님. `spec/conventions/swagger.md`에도 아직 numeric 불변식 문서화가 없음을 직접 확인했는데, plan 문서가 이 역시 별도 planner 항목으로 이미 등재했다(같은 편집 세션으로 묶음 지시까지 명시).
  - 제안: 코드 변경 불필요. `spec/1-data-model.md:873`의 `Float` → `NUMERIC(문자열)` 계열 라벨 정정과 `spec/conventions/swagger.md`의 numeric 불변식 성문화는 plan 이 이미 planner 턴으로 정확히 스코프한 대로 별도 세션에서 처리.

- **[INFO]** `CHANGELOG.md`가 이전 리뷰 라운드(`19_43_18`)에서 지적된 두 WARNING(영향 문단 누락·"list()만" 축소 서술)을 이미 반영한 상태
  - 위치: `CHANGELOG.md:22-24`(영향 문단), `CHANGELOG.md:27-29`(`list·create·update 세 응답 모두`)
  - 상세: 이전 라운드 `documentation.md`가 지적했던 두 결함이 현재 파일 내용에는 존재하지 않는다 — codegen 영향 문단이 명시적으로 들어가 있고("**영향**: OpenAPI 로 타입을 생성하는 클라이언트에서…"), 원인 서술도 "list·create·update 세 응답 모두"로 정정돼 있다. 참고용으로만 기록(조치 불요).
  - 제안: 없음.

TODO/FIXME/HACK/XXX 주석은 신규 6개 소스 파일 전체에서 0건.

## 요약

이번 changeset 의 핵심 요구사항 — "`AlertRuleDto.threshold`가 `number`라고 문서화했지만 실제
wire 는 `numeric(12,4)` 컬럼을 TypeORM 이 정밀도 보존을 위해 문자열로 반환한다"는 사실에 맞춰
DTO 타입을 정정하고, 같은 결함 클래스(numeric 컬럼을 `number` 라 문서화)를 재발 방지하는 정적
가드 축을 추가하며, 정적 가드가 원리적으로 못 보는 런타임 wire 검증을 e2e 로 보강하는 것 —
은 엔티티·컨트롤러·서비스·프런트엔드 소비처·spec 문서를 직접 열어 대조한 결과 모두 실제
코드와 정확히 일치했다. 신설 가드는 vacuous-pass(스캔 자체가 빈 경우)를 막는 `[전제]` 테스트와
과거 정규식 구현이 놓쳤던 4가지 형태를 회귀 캐너리로 고정하는 등 방어 수준이 높고, `npx jest`
직접 실행으로 34/34 PASS 를 재확인했다. e2e 는 정수가 아닌 scale-4 값을 써 정밀도 손실을 실제로
가를 수 있는 fixture 설계다. spec 문서(`1-data-model.md`·`swagger.md`)의 두 갱신 필요 항목은
이 diff 범위 밖으로 정확히 스코프돼 planner 트랙에 이미 등재돼 있어 새로운 gap 이 아니다.
CRITICAL/WARNING 급 요구사항 미충족 사항은 발견되지 않았다.

## 위험도

NONE
