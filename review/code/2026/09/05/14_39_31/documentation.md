# 문서화(Documentation) 리뷰

## 검증 방법

`response-contract.ts`/`.spec.ts` 의 신규 JSDoc(§5.4 판정 규칙 표·"왜 있나"·"왜 개별 단언을
안 쓰나")을 실제 구현(`visit`/`descend`)과 대조했고, `audit-logs.service.ts`/`.spec.ts`/4개
e2e 스펙에 새로 붙은 인라인 주석이 인용하는 수치(user 키 26개, `ExecutionDto` 22필드/
required 12개 등)를 해당 엔티티·DTO 소스를 직접 열어 재검산했다. `plan/in-progress/` 두
파일의 diff 가 주장하는 "이미 해소" 문구(`spec/1-data-model.md:474`, `3-error-handling.md`
§1.4)를 spec 원문과 대조했고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
의 모집단 수치("DTO 60개")를 `find`/`grep` 으로 재계산했다. `CHANGELOG.md` 에 이번 보안
수정에 대응하는 항목이 있는지 확인했다. 저장소에는 아무것도 쓰지 않았다(읽기 전용 검증만).

## 발견사항

- **[WARNING]** 감사 로그 엔드포인트의 실제 wire 축소(민감 필드 노출 제거)가 `CHANGELOG.md`
  에 기록되지 않았다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:40-49` (수정 본문),
    `CHANGELOG.md` (신규 항목 없음 — 파일 전체 확인)
  - 상세: 이번 diff 의 핵심 수정은 `GET /api/audit-logs` 응답의 `user` 객체가 26개 키(`passwordHash`·
    `twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·
    `emailVerifyToken`·`emailChangeToken` 포함)를 그대로 내보내던 것을 3개 키(`id`/`name`/`email`)로
    줄인 것이다 — API 소비자가 그 응답을 파싱했다면 **관측 가능한 wire 변경**이고, 노출됐던 필드의
    성격(자격증명·계정 탈취 토큰)상 보안 감사 관점에서도 기록 가치가 있다. `CHANGELOG.md` 는 바로
    같은 세션에서 만들어진 두 선례(`## Unreleased — AlertRuleDto.threshold...`, `## Unreleased —
    Behavior change (breaking): GET /api/executions/workflow/:workflowId 의 workflowId 쿼리
    파라미터 제거`)에서 "엔티티 그대로 반환 → OpenAPI 선언과 실제 wire 불일치" 유형의 수정을 매번
    상세 섹션(종전/지금 표·영향·재발 방지)으로 기록해 왔다. 이번 수정은 그 두 선례와 원인(컨트롤러가
    엔티티를 그대로 반환)·발견 경로(§5.4 검증자)까지 같은데도 `CHANGELOG.md` 에는 어떤 언급도 없다.
    `review/code/2026/09/05/13_49_54/documentation.md` 가 "CHANGELOG 불요" 라고 판단한 근거는
    "뮤테이션 검증(payload → {}) 으로 4개 DTO 모두 기존 응답이 선언과 이미 일치함을 확인했으므로
    wire 변경도, 새로 발견된 버그도 없다" 였는데, 그 판단은 **보안 수정이 적용되기 전** 시점의
    것이다(수정은 이후 커밋 `45c1cdf63`). 지금 diff 는 정확히 그 wire 변경을 포함하므로 그 근거가
    더 이상 성립하지 않는다.
  - 제안: `CHANGELOG.md` 에 `## Unreleased` 항목을 추가한다 — 선례 형식(종전/지금 표 + 영향 +
    재발 방지)을 따라 "`GET /api/audit-logs` 의 `user` 필드가 `User` 엔티티 전체(26키, `passwordHash`
    등 자격증명 포함)를 노출하고 있었고 `AuditLogUserDto` 가 광고하는 3필드로 좁혔다" 는 사실과,
    "이 응답을 그대로 저장/로깅하던 소비자가 있었다면 그 로그에 이미 민감정보가 남아있을 수 있다" 는
    영향을 명시한다.

- **[WARNING]** plan 문서가 재검토용 모집단 수치("DTO 60개")의 정의를 "클래스 수" 라고 명시했는데,
  그 정의대로 세면 실측치가 두 배 이상 차이난다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:289-292`("`src/**/dto/
    responses/**` 의 DTO **60개**... 60 은 `dto/responses/` 아래 **클래스** 수다"), 동일 파일:564
    ("응답 DTO 60개 중 56개")
  - 상세: 문서가 스스로 정의한 대로 `find codebase/backend/src -path "*/dto/responses/*.ts"`
    (spec 제외)로 잡히는 파일은 36개이고, 그 안의 `^export class` 선언을 전부 세면 **134개**다(24개
    파일이 클래스 2개 이상을 담고 있음 — 예: `knowledge-base-response.dto.ts` 18개,
    `integration-response.dto.ts` 16개, `workspace-response.dto.ts` 10개). 문서가 말하는 "60"
    이 실제로는 "컨트롤러가 `@ApiOkResponse` 로 직접 광고하는 최상위 응답 DTO 만" 을 뜻하는 것이라면
    (중첩 서브 DTO 는 `descend()` 가 자동으로 따라 들어가므로 별도 배선이 불필요하다는 논리는
    타당하다) 그 정의가 문서 문구("클래스 수")와 다르므로 다음 착수자가 "60개 중 56개 남음" 을
    "`dto/responses/` 아래 export class 를 전부 세면 56개 남음" 으로 오독해 스윕 규모를 실제의 절반
    이하로 잘못 예상할 수 있다. 이 수치는 같은 문서 §5.4 2단계 항목의 착수 규모 판단에 직접 쓰이므로
    (트래커 표 gate:564) 오독의 비용이 작지 않다.
  - 제안: "60" 이 정확히 무엇을 세는지(예: "컨트롤러 `@ApiOkResponse`/`@ApiResponse` 의 최상위
    타입 인자로 등장하는 DTO 클래스 수, 중첩 서브 DTO 제외") 한 줄로 명시하거나, 실제로 export class
    전체를 뜻한 것이었다면 134로 정정한다.

- **[INFO]** `ContractViolation`/`ContractCheckOptions` 인터페이스 자체에는 최상위 JSDoc 이 없다
  (필드별 주석만 있음) — 이전 라운드(`13_49_54`)에서 이미 지적됐고 이번 diff 에서도 그대로다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `ContractViolation`
    (65-70행 부근), `ContractCheckOptions`(80-88행 부근) 선언부
  - 상세: 파일 상단 대형 JSDoc(38-46행 판정 규칙 표)이 두 타입의 의미를 사실상 설명하고 있어 영향은
    경미하다. 새로운 결함은 아니고, 이전 라운드가 "선택사항" 으로 남긴 것을 그대로 확인했다.
  - 제안: 조치 불요 — 필요하면 한 줄 요약 주석을 덧붙이는 정도로 충분하다.

## 검증 결과 (문제 없음으로 확인 — 오탐 방지 기록)

- `response-contract.ts` JSDoc 의 판정 규칙 표(38-43행)는 이제 "출처" 열로 §5.4 원문 3행과 이
  검증자의 확장(undeclared) 1행을 갈라 적고 있고, "키 생략형" 행에 "단 스키마가 `nullable` 도 함께
  선언했으면 `null` 을 허용한다" 예외가 명시돼 있다 — 실제 구현(`visit()` 의 `!nullable` 가드,
  194-204행)과 정확히 일치한다. 이는 직전 라운드(`13_49_54`)의 api_contract WARNING #5 가 지적한
  JSDoc-구현 불일치가 실제로 해소된 상태임을 코드 레벨에서 재확인한 것이다.
- `workflow-execution.e2e-spec.ts:144-152` 의 주석("`ExecutionDto` 22필드 중 required 12개는
  엄격 검증, 나머지 10개는 있을 때만 검사")은 `execution-response.dto.ts` 를 직접 세어 대조한
  결과 필드 수·required 개수·"optional+nullable" 10개 필드 이름 목록까지 정확히 일치한다.
  과장된 커버리지 서술이 아니다.
- `audit-logs.service.ts:40-47` 주석의 "user 키 26개" 는 `User` 엔티티(`users/entities/user.entity.ts`)
  의 실제 컬럼 수와 일치한다(id/email/passwordHash/name/avatarUrl/locale/theme/
  twoFactorEnabled/twoFactorSecret/totpRecoveryCodes/webauthnRecoveryCodes/emailVerified/
  emailVerifyToken/emailVerifyExpiresAt/passwordResetToken/passwordResetExpiresAt/
  pendingEmail/emailChangeToken/emailChangeExpiresAt/loginAttempts/lockedUntil/
  oauthProvider/oauthProviderId/notificationPreferences/createdAt/updatedAt = 26).
- `audit-logs.spec.ts` 의 새 테스트(`user 조인은 AuditLogUserDto 가 광고하는 3필드만 select
  한다`)에 붙은 JSDoc 은 "e2e 에도 캐너리가 있지만 여기에도 두는 이유" 를 정확히 설명하고,
  실제로 `qb` mock 에 `leftJoinAndSelect` 키 자체가 없어 되돌리는 뮤테이션이 "함수가 없다" 로
  즉시 깨진다는 주장도 mock 정의(28-38행)와 일치한다.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 diff 가 "이미 해소" 라고
  주장하는 두 spec 항목(`spec/1-data-model.md:474`, `spec/5-system/3-error-handling.md` §1.4)을
  직접 열어 확인 — 둘 다 실제로 "단일 등재처가 아니다" 서술 + 앵커/등재처 분기가 반영돼 있다.
  지어낸 해소 주장이 아니다.
- `codebase/backend/src/shared/testing/` 디렉터리에는 README 가 없지만, 인접한 기존 파일
  `swagger-probe.ts` 도 같은 방식(파일 상단 대형 JSDoc, README 없음)을 쓰고 있어 이번 신규 파일이
  그 관례에서 벗어난 것은 아니다. `codebase/backend/README.md` 도 `swagger-probe.ts` 를 언급하지
  않으므로 `response-contract.ts` 미언급도 기존 관례와 일관된다.
- `spec/5-system/2-api-convention.md` frontmatter `code:` 에 `response-contract.ts` 가 아직
  등재되지 않은 gap 은 같은 diff 에 포함된 plan 항목(`spec-draft-nullable-notation-followups.md`
  gate:276-281)이 이미 정확히 지목해 planner 트랙으로 위임해 두었다 — 새로 조치를 요구하지 않는다.
- `review/code/2026/09/05/13_49_54/**`, `review/consistency/2026/09/05/12_48_13/**` 하위 신규
  파일(RESOLUTION/SUMMARY/각 리뷰어 리포트/meta.json 등)은 과거 리뷰 라운드의 산출물 기록이며
  코드가 아니다 — 문서화 점검 관점(독스트링/README/API 문서/CHANGELOG)이 적용되는 대상이 아니라고
  판단해 통상적인 발견사항 형식으로는 다루지 않았다. 훑어본 결과 특이한 결함은 없었다.

## 요약

핵심 신규 코드(`response-contract.ts`/`.spec.ts`)와 그 배선(4개 e2e 스펙)은 JSDoc·인라인 주석이
실제 구현·실제 필드 수·실제 엔티티 컬럼 수와 전수 대조 결과 정확했고, 직전 라운드가 지적한
JSDoc-구현 불일치(§5.4 "키 생략형+nullable" 조합)도 실제로 해소돼 있었다. 다만 이번 diff 의 핵심
수정 — 감사 로그 응답에서 `passwordHash`·2FA 복구 코드·비밀번호 재설정 토큰 등 23개 민감 필드
노출을 제거한 것 — 은 같은 저장소가 유사한 "엔티티 그대로 반환 → wire 불일치" 유형의 수정마다
꾸준히 남겨 온 `CHANGELOG.md` 항목이 이번엔 빠져 있다. 또한 `plan/` 트래커의 모집단 수치("DTO
60개")가 스스로 밝힌 정의(디렉터리 아래 클래스 수)로 재계산하면 134로 두 배 이상 벌어져, 다음
착수자의 스윕 규모 판단을 오도할 수 있다. 두 건 모두 코드 동작에는 영향이 없는 순수 문서 갭이다.

## 위험도

MEDIUM
