# Cross-Spec 일관성 검토 — forbidden-desc-codes

## 검토 범위 요약

이 PR 은 `spec/**` 델타 0(코드 전용 PR)이며, 구현 diff(32파일/2407줄)는 `@ApiForbiddenResponse` 설명 129곳을
공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)`)로 교체하고, 그 문턱 계산(`lowestRequiredRole`)을
`RolesGuard` 와 공유시키며, reflection 가드 `forbidden-response-codes`를 신설한 것이다. 이 결정은 이미
`spec/conventions/swagger.md` §5-4(+ Rationale "403 설명의 거부 코드")와 `spec/data-flow/12-workspace.md`
Rationale "가드 거부의 오류 코드 (2026-09-25)"에 planner 커밋(`f262a638e`)으로 반영되어 있고, plan
(`plan/in-progress/forbidden-desc-codes.md`)의 `--impl-prep` 1회차에서 이미 이 문서 간 문구 불일치를
CRITICAL(C1, BLOCK:YES)로 잡아 spec 을 먼저 고친 뒤 재실행(BLOCK:NO)한 이력이 있다. 즉 본 리뷰가 겨냥하는
"draft 대 기존 spec 영역 충돌" 이 이미 한 라운드 전에 발견·정정된 상태에서 코드가 구현됐다.

## 대조 결과

1. **데이터 모델·API 계약** — 변경은 Swagger `description` 문자열(OpenAPI 문서 표현)에 한정되고, 상태 코드·
   본문 스키마·인가 로직은 diff 전체에서 불변(`RolesGuard.canActivate` 로직은 `lowestRequiredRole` 추출만 있고
   `roleLevel(role) >= roleLevel(threshold)` 판정 자체는 그대로). API 계약 충돌 없음.

2. **요구사항 ID / 오류 코드 정합** — 헬퍼가 보간하는 코드(`NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` ·
   `OWNER_REQUIRED`)는 `spec/5-system/3-error-handling.md` §1.2 카탈로그에 이미 등재된 코드·의미와 정확히 일치한다
   (예: `ADMIN_REQUIRED` = "Admin 권한 필요", `NOT_A_MEMBER` = "워크스페이스 비멤버"). 신규 코드 도입 없음 — 기존
   카탈로그와 충돌 없음.

3. **RBAC 모델** — `RolesGuard`·`workspace-roles.ts` 의 서열(Owner > Admin > Editor > Viewer)과 `viewer` 요구가
   멤버십 요구와 동일하다는 성질(`ROLE_REQUIRED.viewer === NOT_A_MEMBER`)은 `spec/5-system/1-auth.md` §3.1/§3.2
   RBAC 역할·매트릭스, `spec/data-flow/12-workspace.md` "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`" 결정과
   일치한다. `integrations.controller.ts` 의 `FORBIDDEN_EDITOR_OR_ORG_ADMIN`(라우트 가드 `editor` + 서비스 판정
   `admin` 이중 구조) 문구 변경도 `spec/2-navigation/4-integration.md` §8 "Organization 통합의 변경은 Admin
   이상이다 — 라우트 가드(`@Roles('editor')`)는 그 아래의 첫 번째 선일 뿐" 서술과 정확히 부합한다.

4. **계층 책임 분할** — 헬퍼는 `common/swagger/`(문서화 문자열 조립)에, 문턱 계산(`lowestRequiredRole`)은
   `common/constants/workspace-roles.ts`(가드·검사 공유 SoT)에 위치해 기존 계층 배치(가드=인가 실행, swagger
   헬퍼=문서 표현)와 일치한다. reflection 가드가 대조군을 별도 `fixtures/**` 로 두지 않고 가드 spec 안의 클래스로
   둔 것도 `spec/conventions/swagger.md` Rationale 이 명시한 설계(대조군·모델 캐너리 동일 파일)와 일치한다.

5. **문구 소급(레거시) 정책과의 정합** — `swagger.md` §1-4/§3 은 "신규 변경 한정, 기존 소급 정리 대상 아님"을
   원칙으로 두지만, §5-4 Rationale 은 이 규칙을 "§2-4(광고한 성공 코드)처럼 광고가 실제와 맞는가의 문제"로 분류해
   **기존 라우트까지 소급**하도록 명시적으로 예외를 뒀다. 이번 129곳 소급 교체는 그 예외 조항이 커버하는 범위이며,
   `swagger.md` §1-4/§3 의 "신규 변경 한정" 원칙과 충돌하지 않는다(범위가 이미 문서로 분리돼 있음).

6. **잔여 사실 확인** — `plan/in-progress/forbidden-desc-codes.md` 검토 경고 처리 표의 W1 항목(integrations 4곳의
   `@Roles('editor')` 자체가 `plan/in-progress/integration-personal-owner-followup.md` 에서 결정 대기)은 이 PR 이
   만든 신규 충돌이 아니라 기존에 알려진 별도 트랙의 선행 결정 대기이며, 본 PR 은 "현재 역할에 맞는 설명"만 반영해
   그 트랙과 독립적으로 정합하다.

## 발견사항

- **[INFO]** 소급 범위 근거가 두 문서에 나뉘어 있음
  - target 위치: 구현 diff 전반(129곳 소급 교체)
  - 충돌 대상: `spec/conventions/swagger.md` §1-4/§3 "신규 변경 한정, 소급 정리 대상 아님" 원칙
  - 상세: §5-4 Rationale "403 설명의 거부 코드"가 소급 예외를 명시하고는 있으나, §1-4/§3 원칙 본문 자체에는
    "단, §2-4·§5-4 류의 '광고=실제' 정합 문제는 소급한다"는 역참조가 없어, §1-4/§3 만 읽는 다음 사람이
    "이 저장소는 소급 안 한다"로 오독할 여지가 낮게나마 있다. 실질 충돌은 아니며 실제로는 Rationale 이 이미
    구분해 뒀다.
  - 제안: 옵션 — 다음 swagger.md 개정 때 §1-4/§3 원칙 문장 옆에 "예외: §2-4·§5-4 는 광고-실제 정합 문제라 소급"
    한 줄 각주를 붙이면 역참조 왕복 없이 원칙 읽는 사람도 예외 존재를 바로 안다. 이번 PR 범위에서 처리할
    필요는 없음(이미 plan 의 "TEST WORKFLOW"·`/ai-review` 2라운드 수렴을 통과한 문서 상태).

다른 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 항목에서 CRITICAL/WARNING 급 충돌은 발견되지
않았다.

## 요약

이 PR 은 spec 변경이 없는 코드 전용 리팩터이며, 그 리팩터가 구현하는 정책(403 설명에 가드 거부 코드를 싣는다·
비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`·viewer 요구는 멤버십 요구와 동일)은 이미 `spec/conventions/swagger.md`
§5-4 와 `spec/data-flow/12-workspace.md` "가드 거부의 오류 코드" Rationale 에 반영되어 있고, 두 문서 간 문구
불일치는 이 작업의 앞선 `--impl-prep` 라운드에서 이미 CRITICAL 로 잡혀 spec 정정 후 재검증(BLOCK:NO)까지 마쳤다.
코드 diff 를 `5-system/1-auth.md`(RBAC 역할·매트릭스), `5-system/3-error-handling.md`(오류 코드 카탈로그),
`2-navigation/4-integration.md`(Organization 통합 Admin 승격 규칙)와 대조한 결과 문구·코드·서열 모두 일치하며,
런타임 동작(상태 코드·인가 판정)은 diff 전체에서 불변이다. Cross-spec 관점에서 채택을 막을 모순은 없다.

## 위험도

NONE
