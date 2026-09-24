# 신규 식별자 충돌 검토 — `spec/5-system` (impl-prep, target: `plan/in-progress/member-auth-order.md`)

## 스코프 확인

`--impl-prep spec/5-system` 검토 대상 번들은 `spec/5-system/*`(대부분 예산 초과로 생략, 전문 포함된 것은
`3-error-handling.md`·`1-auth.md`·`2-api-convention.md`) + 실제 변경 target 인
`plan/in-progress/member-auth-order.md` 다. 이 plan 은 `spec_impact: none` — spec 파일을 고치지
않고 `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `removeMember()` 내부
검사 순서만 바꾼다. 따라서 "target 이 새로 도입하는 식별자"는 spec 신규 항목이 아니라, 그 코드
변경이 실제로 도입/재사용하는 식별자들이다. 아래는 그 식별자들을 저장소 전체(`codebase/`, `spec/`,
`plan/`)와 대조한 결과다.

## 발견사항

없음 — 아래 후보들을 개별 확인했고 모두 충돌 없음을 확인했다.

- **신규 함수명 `throwNotAMember()` / `throwAdminRequired()`** (plan §B) — `codebase/`, `spec/`,
  `plan/` 전체에서 `grep -rn "AdminRequired\|NotAMember"` 결과 plan 파일 자신 외 사용처 0건.
  `WorkspacesService` 안의 기존 선례(`throwMemberNotFound()` `:342`, `throwCannotRemoveOwner()`
  `:~365`, 자매 서비스의 `throwTriggerNotFound()`/`throwScheduleNotFound()`/
  `throwIntegrationNotFound()`)와 명명 패턴이 일치하고, private 메서드라 클래스 스코프 밖으로
  새어나가지 않는다. 충돌 없음.
- **에러 코드 `NOT_A_MEMBER`(403) / `ADMIN_REQUIRED`(403)** — plan 이 새로 부여하는 코드가 아니라
  기존 코드를 **같은 의미**(워크스페이스 비멤버 / Admin 권한 부족)로 재사용한다. 두 코드 모두
  `3-error-handling.md` §1.2 에 이미 등재돼 있고(`NOT_A_MEMBER`: "대상 워크스페이스 멤버십 검증
  실패", `ADMIN_REQUIRED`: "워크스페이스 Owner/Admin 역할 필요"), 코드 내 기존 발행처
  (`workspaces.service.ts:674`(leaveWorkspace), `:892`(assertMembership), `:905`(assertAdmin),
  `auth.service.ts:1135`(switchWorkspace))와 의미가 동일하다. **다른 의미로 이미 쓰이고 있는
  경우가 아니므로** 요구사항 ID 충돌(관점 1)에 해당하지 않는다.
- **API endpoint** — 신규 endpoint 없음. 기존 `DELETE /api/workspaces/:id/members/:memberId`
  (`removeMember`)의 응답 **분포**만 바뀐다(세 갈래 → 비멤버는 단일 `403 NOT_A_MEMBER`). method+path
  충돌 대상 없음.
- **이벤트/메시지명** — 신규 audit action·webhook·queue·SSE 이벤트 없음. 기존
  `AUDIT_ACTIONS.MEMBER_REMOVED` 그대로 사용.
- **환경변수·설정키** — 해당 없음.
- **파일 경로** — `plan/in-progress/member-auth-order.md` 는 기존 `plan/in-progress/*.md` 평면
  명명 컨벤션(kebab-case, 영역-요약)과 일치하고, 동일 이름의 기존 파일(`plan/in-progress/`,
  `plan/complete/`)이 없음을 확인했다(`find plan -iname "*member-auth-order*"` → 1건, 이 파일
  자신).

## 참고 (충돌 아님, 정보성)

- `3-error-handling.md` §1.2 의 `NOT_A_MEMBER` 카탈로그 설명은 발행 경로를 "전환·탈퇴·멤버십 확인
  경로"로 열거하며 `removeMember` 의 비멤버 분기는 아직 언급하지 않는다. 이는 **의미 충돌이
  아니라 등재 누락**이고, plan §E 가 이미 "`spec/` 은 developer 권한 밖이라 planner 항목으로
  등재한다"고 명시적으로 후속 처리를 예고했다 — 새로 발견한 결함이 아니라 plan 이 스스로 인지하고
  스코프 밖으로 미룬 항목이다. 신규 식별자 충돌 관점에서는 조치 불요.

## 요약

`member-auth-order` plan 은 `spec/5-system` 에 어떤 신규 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수·파일 경로도 도입하지 않는다. 코드 레벨에서 새로 만드는 두 private
헬퍼 함수명(`throwNotAMember`·`throwAdminRequired`)은 저장소 전체 검색상 기존 사용처가 전무하고
같은 클래스 안의 기존 명명 관례(`throwMemberNotFound`·`throwCannotRemoveOwner`)와 정합한다.
재사용하는 두 에러 코드(`NOT_A_MEMBER`·`ADMIN_REQUIRED`)는 기존 카탈로그 정의와 동일한 의미로만
쓰이므로 "다른 의미로 이미 사용 중"인 충돌이 아니다. 카탈로그 설명의 발행 경로 열거 누락은 plan
이 스스로 planner 후속 항목으로 등재를 예고한 상태라 이 검토의 차단 사유가 아니다.

## 위험도

NONE
