# 요구사항(Requirement) 리뷰 — `AlertRuleDto.threshold` wire 타입 정정 + numeric 회귀 가드 신설

## 범위 확정

이번 changeset 은 `origin/main..HEAD` 3개 커밋(`a65a4f85e`·`5a7de8ab1`·`dc83c0312`)의 누적 diff다.
실질 코드/문서/spec 변경은 5개 파일뿐이고, 나머지 21개 파일(`review/code/2026/09/04/19_43_18/**`,
`review/consistency/2026/09/04/20_05_42/**`)은 이 changeset 을 만드는 과정에서 이미 실행된 두
차례 리뷰/일관성검토 라운드의 산출물(및 그 RESOLUTION)이 그대로 커밋된 것이다.

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold: number → string` 정정 (핵심 코드 변경)
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` —
   신규 술어 `findNumericAsNumber` (회귀 가드, 세 번째 축)
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의 테스트
4. `CHANGELOG.md` — 정정 서술 신규 항목
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — §5.4 drift 2단계 착수 근거 갱신

## 검증 절차 (저장소 직접 대조, 변형 없음)

- `alerts.controller.ts` — `list()`/`create()`/`update()` 모두 반환 타입 애노테이션 없이
  `{ data: rule(s) }` 로 엔티티를 그대로 반환함을 실측 확인 — CHANGELOG "list·create·update 세
  응답 모두" 서술과 일치(이전 라운드 WARNING 이었던 "list() 만" 서술은 이미 정정돼 있다).
- `alerts.service.ts:30,53` — `create`/`update` 모두 `String(dto.threshold)` 로 저장 — 읽기/쓰기
  비대칭 서술과 일치.
- `alert-rule.entity.ts:34-35` — `@Column({ type: 'numeric', precision: 12, scale: 4 }) threshold: string;`
  — DTO 의 `type: String, example: '10.0000'`(소수점 4자리)와 정합.
- `codebase/frontend/src/lib/api/alerts.ts:11,21` — 읽기 `threshold: string` / 쓰기
  `CreateAlertRulePayload.threshold: number` 로 이미 손수 분리돼 있음을 확인 — "프런트는 이미
  알고 있었다" 서술이 사실.
- `codebase/backend/nest-cli.json:9-11` — `@nestjs/swagger` 플러그인 `introspectComments: true`
  확인 — DTO 의 JSDoc 축약(경위를 비-JSDoc 주석으로 옮긴 조치, `20_05_42` W1)이 근거 있는
  수정이었음을 확인.
- `spec/1-data-model.md:873` — `threshold | Float` 라벨이 실제(`numeric(12,4)`, wire·엔티티 모두
  `string`)와 어긋난다는 서술 정확. 이 diff 는 spec 을 건드리지 않고 plan 에 planner 트랙으로만
  등재했다 — CLAUDE.md 의 "developer 는 spec 쓰기 권한 없음" 원칙에 맞다.
- `spec/conventions/swagger.md` — `numeric`/`decimal` 관련 서술 0건 확인. plan 의 W2("가드로만
  강제되고 규약 문서에는 없다") 서술이 정확하며, 이 역시 planner 트랙으로만 등재돼 있다.
- `spec/2-navigation/9-user-profile.md:406` — `POST /api/alerts` 요청 바디 `threshold(number,
  ≥0, ...)` 는 쓰기 DTO(`CreateAlertRuleDto`, 이 diff 로 불변) 서술이라 이번 응답 타입 정정과
  충돌하지 않음.
- `CHANGELOG.md:5` 및 `plan/in-progress/spec-draft-nullable-notation-followups.md:273` — 라우트
  표기가 `GET /api/alerts` 로 정정돼 있음(`@Controller('alerts')` 와 일치). 이전 라운드에서 지적된
  `/api/alerts/rules` 오기는 남아 있지 않다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md:281-315` — "불일치 59건" 표
  (46+6+4+3=59)와 하위 3건 분류표가 산술적으로 정합. 직전 라운드 WARNING(46+6+4+1=57 로 어긋남)은
  표를 "버킷 크기"와 "판정 결과"로 분리해 해소됐다.
- `swagger-dto-contract.spec.ts` — `findNumericAsNumber` 3방향 대조군(잡는다·`string`이면
  안 잡는다·`numeric` 아니면 안 잡는다) + 저장소 전수 스캔(현재 clean, `[]`) 확인.

## 발견사항

- **[WARNING]** `findNumericAsNumber` 의 엔티티측 탐지가 **정규식**(`NUMERIC_COLUMN`)이라, 이
  파일 자신의 헤더가 명시한 설계 원칙("왜 정규식이 아니라 AST 인가 — 정규식으로 세 번 틀렸다")과
  같은 취약점 클래스를 재도입한다. DTO측은 AST(`ts.isPropertyDeclaration`)로 견고하게 읽으면서,
  엔티티측만 raw 소스에 대한 정규식 매칭으로 되돌아갔다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:216-217`
    (`const NUMERIC_COLUMN = ...`), 사용부 `:236-239`
  - 상세: 직접 3가지 반례를 구성해 정규식 엔진(node)으로 실행 확인했다(뮤테이션 없이, 저장소 밖
    scratch 스크립트) —
    1. `@Column` 인자에 **중첩 객체**(예: `transformer: { to: ..., from: ... }`)가 있으면
       `[^}]*` 가 중첩 `}` 에서 멈춰 매칭 자체가 실패한다(false negative). TypeORM 의 `numeric`
       컬럼에 `transformer` 를 붙이는 것은 흔한 관용구다.
    2. `@Column({...})` 데코레이터와 필드 선언이 **같은 줄**에 있으면(`\s*\n\s*` 가 개행을
       강제하므로) 매칭이 실패한다. 저장소 안에 현재 두 numeric 컬럼은 둘 다 개행 스타일이라
       우연히 안전하지만, 술어 자체는 스타일에 의존한다.
    3. 필드 선언 앞에 `public`/`private`/`protected` 같은 **접근 제한자**가 있으면(정규식이
       `readonly` 만 선택적으로 허용) 매칭이 실패한다.
    세 경우 모두 대조군 스위트(`swagger-dto-contract.spec.ts:301-346`)에 케이스가 없어
    무방비다 — 이 가드가 정확히 막으려는 것("numeric 컬럼을 number 로 문서화한 응답 DTO 가
    조용히 통과")이 위 세 스타일 중 하나로 새로 생기면, 가드는 통과(green)를 낸다. 지금 저장소의
    두 numeric 컬럼(`alert_rule.threshold`, `llm_usage_log.cost_usd`)은 우연히 이 세 함정을
    피하는 스타일이라 현재는 오탐 없이 동작하지만, 이는 이 가드가 신규 회귀를 막기 위해 이번
    PR 이 만든 자리라는 점에서 "재발 방지" 주장(CHANGELOG:36-39, "가드에 축을 하나 더 세웠다 …
    잡는다")이 스타일 조건부라는 사실이 드러나지 않는다.
  - 제안: 엔티티측도 기존 `callDecorators`/`readBooleanOption` 패턴을 확장해 AST 로
    `@Column({...})` 의 `type` 프로퍼티 값을 읽도록 바꾼다(문자열 리터럴 프로퍼티 판독 헬퍼
    하나만 추가하면 됨). 최소한 위 3가지 형태 중 하나를 커버하는 대조군 테스트를 추가해 현재의
    스타일 의존성을 문서화한다.

## 그 외 확인된 사항 (결함 아님)

- 핵심 DTO 필드 타입 변경(`threshold: number → string`)은 엔티티·DB 컬럼(`NUMERIC(12,4)`)·
  서비스 저장 로직·프런트엔드 기존 소비 패턴과 전수 대조로 정합한다. 런타임 wire 변경 없음
  (`ClassSerializerInterceptor` 부재 확인 — DTO 는 순수 Swagger 문서 메타데이터).
- TODO/FIXME/HACK/XXX 주석 없음 (5개 실질 변경 파일 전수 grep).
- 두 차례 선행 라운드(코드리뷰 `19_43_18`, 일관성검토 `20_05_42`)에서 나온 WARNING 은 각각
  RESOLUTION.md 에 기록된 대로 실제 코드/문서에 반영됐음을 직접 대조로 확인했다 — 회귀 테스트
  부재(→ `findNumericAsNumber` 신설), CHANGELOG 축소 서술(→ "세 응답 모두"), 코드젠 영향 문단
  누락(→ "영향" 문단 추가), plan 산술 불일치(→ 표 재작성), JSDoc 내부 서사 공개 노출(→ 2문장
  축약 + 경위는 비-JSDoc 주석), 라우트 오기(→ `/api/alerts` 로 정정). 미반영으로 남은 항목(spec
  본문 갱신 2건 — `swagger.md` numeric 불변식, `1-data-model.md` Float 라벨)은 developer 권한
  밖이라 planner 트랙으로 plan 문서에 정확히 등재돼 있다 — CLAUDE.md 규약 위반 없음.
- 쓰기 DTO(`CreateAlertRuleDto.threshold: number`)는 이 diff 로 불변이며 spec §6.3 서술과 계속
  일치 — 읽기/쓰기 비대칭이 spec 과 충돌하지 않는다.

## 요약

핵심 코드 변경(`AlertRuleDto.threshold: number → string`)은 엔티티·DB 컬럼·서비스 저장 로직·
프런트엔드 기존 소비 패턴·spec 쓰기 DTO 서술과 전수 대조로 정합하며, wire 를 바꾸지 않는 순수
문서/타입 정정이라는 CHANGELOG 주장도 코드 확인으로 뒷받침된다. 동반된 신규 회귀 가드
(`findNumericAsNumber`)는 저장소의 실제 두 numeric 컬럼 사례를 정확히 커버하고 3방향 대조군까지
갖췄으나, 엔티티측 탐지를 정규식으로 구현해 이 파일 자신이 명시한 "정규식은 중첩 문법에서
세 번 틀렸다" 는 설계 원칙과 같은 클래스의 false-negative(중첩 객체·동일 줄 선언·접근 제한자)를
재도입한다 — 현재 두 실사례는 우연히 안전한 스타일이라 당장 오탐은 없지만, 이 가드가 막으려는
"조용히 새로 생기는 계약 거짓"을 특정 코딩 스타일에서는 여전히 놓친다(WARNING). 그 외 이전 두
리뷰 라운드의 WARNING 전부가 실제로 반영됐음을 직접 대조로 확인했고, spec 갱신이 필요한 잔여
2건은 developer 권한 밖으로 정확히 planner 트랙에 등재돼 있어 절차 위반이 없다.

## 위험도

LOW
