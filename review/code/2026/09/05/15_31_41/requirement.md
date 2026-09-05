# 요구사항(Requirement) Review

## 검증 방법

`git log origin/main..HEAD` 기준 이 브랜치는 11개 커밋(핵심 기능 커밋 3개: `ab6fa6863`
§5.4 검증자 신설, `df8be1859` 3개 DTO 로 확장, `45c1cdf63` 감사 로그 `User` 전 컬럼 노출
수정 + 검증자 중첩 대조 + `bf02fe328` union 캐너리 추가·미사용 파라미터 제거 — 나머지는
`docs(review)`/`docs(plan)`)로 구성된다. 이미 3라운드(`13_49_54`→`14_39_31`→`15_12_02`)
review-fix 루프를 거쳤으므로, 이전 라운드가 지적·수정한 항목을 재확인하는 대신 **현재
코드 상태**(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts`,
`audit-logs.spec.ts`, `codebase/backend/src/shared/testing/response-contract.ts`,
`.spec.ts`, 4개 e2e 파일)를 직접 Read 하고, 관련 spec(`spec/5-system/2-api-convention.md`
§5.4, `spec/5-system/1-auth.md` §4.2)과 line-level 로 대조했다. 저장소에는 어떤 뮤테이션도
가하지 않았다(`git status --short` 로 확인 — 세션 산출물 외 변경 없음).

## 발견사항

- **[INFO]** §5.4 스펙 본문과 `response-contract.ts` JSDoc 판정 규칙 표가 현재 상태로는
  **일치한다** — 이전 라운드(`13_49_54`)가 지적했던 "키 생략+nullable" 조합의 서술 불일치는
  이미 해소돼 있다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:37-55`(판정 규칙 표 +
    "넷째 행을 §5.4 로 적었던 것은 틀렸다" 정정문) vs `spec/5-system/2-api-convention.md:188-191`
    (DTO 선언 형태 규칙: "키를 생략하는 필드 → `@ApiPropertyOptional()` + `field?: T`(`| null`
    금지)")
  - 상세: spec 은 응답 DTO 의 키 생략 필드에 `| null` 을 명시적으로 금지한다. 코드 JSDoc 은
    이제 "req+nullable 아님 / req+nullable / 키생략(non-null) / **키생략+nullable(§5.4 아님 —
    선언 층 위반, 이 도구의 판정 대상 아님)**" 으로 정확히 4행을 구분해 스펙 문구와 자기
    일관적이다. 구현(`visit()` 함수, `:248-259`)도 `if (value === null) { if (!nullable) ... }`
    로 이 서술과 정확히 일치하게 동작한다 — nullable 선언이 있으면 키생략 필드도 null 을
    통과시킨다. `response-contract.spec.ts:44-50,179-189` 의 대조군 테스트(`legacy` 필드)가
    이 두 케이스(`note: null` → 위반, `legacy: null` → 통과)를 독립적으로 문다.
  - 조치: 불요 — 정보성 확인. (참고: 이 "optional+nullable" 조합 자체가 실제 배선된
    `AuditLogDto.user`/`ipAddress`, `WorkflowDto`, `ExecutionDto` 에 광범위하게 존재하는
    선언 층 §5.4 drift 라는 별도 지적은 이전 라운드(`13_49_54` api_contract.md WARNING,
    `15_12_02` RESOLUTION I3)가 이미 발견·"다른 트랙(§5.4 스윕 트래커)" 으로 정확히 처분해
    두었다 — 재등재하지 않는다.

- **[INFO]** 감사 로그 유출 수정의 수치 주장(CHANGELOG "26개 키" · "패키지 3필드")이 실제
  코드와 정확히 일치함을 직접 재확인
  - 위치: `CHANGELOG.md:3-6` vs `codebase/backend/src/modules/users/entities/user.entity.ts`
    (컬럼 데코레이터 26개, `grep -c` 로 재확인) 및
    `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`
    (`AuditLogUserDto` — `id`/`name`/`email` 3필드)
  - 상세: `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
    `passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 7개 필드 모두 `User` 엔티티에
    실제로 존재하고, `@Column`/`@PrimaryGeneratedColumn`/`@CreateDateColumn` 총 개수가
    정확히 26이다. 수정 후 `audit-logs.service.ts:60-61` 의
    `.leftJoin('al.user','user').addSelect(['user.id','user.name','user.email'])` 는
    `AuditLogUserDto` 가 광고하는 3필드와 정확히 일치한다 — 과다도 과소도 아니다.
  - 조치: 불요 — 검증 완료 기록.

- **[INFO]** 이전 라운드가 지적한 두 유지보수성 WARNING(`dtoName: string` 중복 타이핑,
  `ContractViolationKind.'missing'` 이중 의미)이 현재 코드에서 이미 구조적으로 해소돼 있다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:112-117`
    (`DtoContract.name` 이 `contractForDto` 내부(`:395`)에서 `Dto.name` 으로 파생되어
    호출부가 더 이상 DTO 이름을 문자열로 재입력하지 않는다 — 4개 e2e 호출부
    (`audit-logs.e2e-spec.ts:39`, `session-revocation.e2e-spec.ts:47`,
    `workflow-crud.e2e-spec.ts:122`, `workflow-execution.e2e-spec.ts:68`)가 모두
    `contractForDto(XxxDto)` 한 인자만 전달), `:72-76`(`ContractViolationKind` 에
    `'invalid-payload'` 전용 kind 가 분리되어 `:106` required-누락 `'missing'` 과
    `:329` payload-자체-비객체 케이스가 더 이상 값을 공유하지 않는다)
  - 상세: `13_49_54` 라운드 api_contract.md/maintainability.md 가 지적했던 "호출부마다
    `schemaForDto(Dto)` + `'DtoName'` 이중 기입", "`missing` 이 서로 다른 두 의미로
    재사용" 두 결함 모두 후속 커밋에서 API 설계 자체가 바뀌어 해소됐다.
    `response-contract.spec.ts:392-393` 이 `invalid-payload` kind 분리를 회귀 테스트로
    고정하고 있다.
  - 조치: 불요 — 검증 완료 기록.

- **[INFO]** TODO/FIXME/HACK/XXX 마커 없음
  - 위치: `git diff origin/main..HEAD -- codebase/` 전체
  - 상세: 코드베이스 diff 전체에서 미완성 작업을 시사하는 주석 마커가 발견되지 않았다.
  - 조치: 불요.

## 검증 결과 (문제 없음으로 확인 — 오탐 방지 기록)

- `audit-logs.spec.ts` 의 신규 unit 테스트(`user 조인은 AuditLogUserDto 가 광고하는 3필드만
  select 한다`)는 `qb.leftJoin`/`qb.addSelect` 인자와 `qb` 에 `leftJoinAndSelect` 속성이
  없음을 함께 단언해, "되돌리는 편집"(`leftJoinAndSelect` 로 복귀)이 컴파일이 아니라
  런타임에서 즉시 실패하도록 만들어져 있다 — 회귀 방지력이 실질적이다.
- `response-contract.spec.ts` 는 §5.4 의 4개 선언 형태·중첩 `$ref`·배열·자기참조·판별자 없는
  `oneOf`/`anyOf`·비객체 payload 를 각각 독립 대조군으로 문다. "여러 위반이 한 번에 다
  나온다"·"위반은 알파벳순" 캐너리까지 갖춰 findContractViolations 의 계약(단언이 아니라
  목록 반환)이 실제로 지켜짐을 확인했다.
- `audit-logs.e2e-spec.ts`/`session-revocation.e2e-spec.ts`/`workflow-crud.e2e-spec.ts`/
  `workflow-execution.e2e-spec.ts` 4곳 모두 실제 HTTP 응답 1건을 생성된 OpenAPI 스키마와
  전수 대조하는 `assertMatchesContract` 를 배선했고, 그중 `audit-logs.e2e-spec.ts` 는 추가로
  `user` 키 집합을 `['email','id','name']` 으로 정확히 고정하는 독립 캐너리를 남겨 "검증자
  자신이 놓친 유출" 이라는 재발 경로를 별도로 막는다.
- `spec/5-system/1-auth.md` §4.2 는 "관리자(Admin+)만 조회 가능 / 기간·사용자·액션 유형으로
  필터링" 만 규정하고 `user` 필드의 정확한 shape 는 규정하지 않는다 — 이번 수정이 그 shape 를
  `AuditLogUserDto` 로 좁힌 것은 §4.2 위반이 아니라 §5.4(부재/노출 규약)의 사후 시행이다.

## 요약

핵심 변경 두 가지 — (1) `AuditLogsService.findAll` 이 `User` 엔티티 전 컬럼(26키, 자격증명·
계정탈취 토큰 포함)을 응답에 실었던 결함을 3필드 명시 select 로 고친 것, (2) 그 결함을
"놓친 이유"(최상위 키만 보던 계약 대조기)를 중첩 `$ref`/배열/자기참조/`oneOf` 까지 내려가는
일반 §5.4 검증자로 근본 보강한 것 — 모두 코드·테스트·spec 이 line-level 로 일치한다. 직접
재검증한 수치(User 컬럼 26개, `AuditLogUserDto` 3필드)와 인용 근거(`spec-draft-nullable-
notation-followups.md` 의 59/46/78 건 실측)가 모두 정확했다. 이전 세 라운드가 지적한
Critical·WARNING(자기참조 거짓 통과, union 사각지대, `dtoName` 중복, `missing` kind 이중
의미, JSDoc-구현 불일치)은 전부 후속 커밋에서 구조적으로 해소된 상태를 직접 확인했고, 남은
INFO 항목(§5.4 스윕 대상 DTO 의 선언 층 tri-state drift, `response-contract.ts` 의 spec
`code:` glob 미등재)은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
올바르게 등재돼 planner 트랙으로 위임돼 있다 — 이번 PR 범위에서 추가 조치가 필요한
요구사항 충족 결함은 발견되지 않았다.

## 위험도

NONE
