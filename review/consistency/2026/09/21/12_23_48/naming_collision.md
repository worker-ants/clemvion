# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-prep, `plan/in-progress/member-dup-remove.md`)

## 검토 대상 요약

이번 target 은 `spec/2-navigation` 전체 번들이지만, 실제 착수 대상은
`plan/in-progress/member-dup-remove.md` 다 (`spec_impact: none`). 계획은
`WorkspacesService.removeMember()` 의 동시 삭제 요청이 감사 행(`member.removed`)을
두 번 남기는 결함을, 이미 병합된 다섯 자리(`workflows`/`workspaces.deleteWorkspace`/
`triggers`/`schedules`/`integrations` — #1369~#1372)와 동일한 패턴(락 없이 원자적
`DELETE` 의 `affected` 로 판정)으로 고치는 순수 구현 작업이다. **spec 문서 자체를
수정하지 않으므로, 이 target 이 "새로 도입"하는 식별자는 없다** — 아래는 계획 본문이
언급하는 식별자들이 기존 spec/코드 사용처와 정말 일치하는지(=신규가 아님을) 확인한
결과다.

## 발견사항

- **[INFO]** 계획이 언급하는 식별자는 전부 기존 정의의 재사용이며 신규 도입이 아님
  - target 신규 식별자: (없음) — `MEMBER_REMOVED` / `member.removed` (audit action),
    `MEMBER_NOT_FOUND` / `CANNOT_REMOVE_OWNER` / `NOT_A_MEMBER` (에러 코드),
    `DELETE /api/workspaces/:id/members/:memberId` (endpoint)
  - 기존 사용처:
    - `member.removed` — `codebase/backend/src/modules/audit-logs/audit-action.const.ts:65`
      (`MEMBER_REMOVED: 'member.removed'`), 이미 `workspaces.service.ts:675`(기존
      직접-제거 자리와 무관한 다른 호출부) 및 `:811`(`removeMember`)에서 사용 중이고
      `spec/5-system/1-auth.md:425`, `spec/data-flow/1-audit.md:75`,
      `spec/data-flow/12-workspace.md:275` 세 곳에 이미 문서화되어 있다.
    - `MEMBER_NOT_FOUND` / `CANNOT_REMOVE_OWNER` — `workspaces.service.ts:788,799`
      (수정 대상 함수 자신에서 이미 사용 중인 코드).
    - `NOT_A_MEMBER` — `spec/5-system/3-error-handling.md:49`,
      `spec/5-system/1-auth.md:502`, `spec/data-flow/12-workspace.md:113,123` 에
      문서화, `auth.service.ts`·`workspaces.service.ts` 양쪽에서 재사용 중인 기존 코드.
    - `DELETE /api/workspaces/:id/members/:memberId` — 이미
      `spec/2-navigation/9-user-profile.md:378` 에 "멤버 제거 (Admin+ / 자가 탈퇴 시
      leave로 위임)" 로 문서화되어 있고, `workspaces.controller.ts:367-372` 의 기존
      `removeMember` 컨트롤러 메서드가 이 endpoint 를 서빙한다.
  - 상세: 계획서 §A~D 를 통틀어 새 요구사항 ID, 새 엔티티/DTO/인터페이스명, 새
    endpoint, 새 이벤트/큐 이름, 새 ENV var/config key, 새 spec 파일 경로 중 어느
    것도 신설되지 않는다. `affected === 0` 판정 패턴도 형제 PR #1372(`integrations`)
    가 이미 도입한 관용구를 그대로 재사용한다(새 이름을 만들지 않음).
  - 제안: 없음 — 정보성 확인. `spec_impact: none` 판단이 근거(위 3곳 문서화 + 코드
    상수 존재)로 뒷받침됨을 기록해 둔다.

- **[INFO]** 수정 대상 파일(`workspaces.service.ts`)이 이미 두 spec 문서의 `code:`
  glob 에 걸쳐 있음 — 이름 충돌은 아니고 추적성 메모
  - target 신규 식별자: (없음, 파일 경로 충돌도 아님)
  - 기존 사용처: `spec/2-navigation/9-user-profile.md` 의 `code:` 가
    `codebase/backend/src/modules/workspaces/**` 글롭으로 이 파일을 이미 포함하고,
    `spec/2-navigation/3-schedule.md` 의 `code:` 도 같은 파일을 (`resolveTimezone` 용도로)
    개별 등재한다.
  - 상세: 이는 "새 식별자"가 아니라 한 파일이 두 spec 문서의 evidence 로 이미 이중
    등재된 기존 구조다. `removeMember()` 편집은 관련 있는 `9-user-profile.md` 쪽
    glob 범위 안에 있으므로 spec 갱신 의무를 만들지 않는다(성격이 다른 함수를 건드리지
    않음). 신규 식별자 충돌 관점에서는 영향 없음 — 참고로만 기록.
  - 제안: 없음.

## 요약

`plan/in-progress/member-dup-remove.md` 는 spec 을 변경하지 않는(`spec_impact: none`)
순수 코드 결함 수정이며, 계획 본문이 참조하는 audit action(`member.removed`)·에러
코드(`MEMBER_NOT_FOUND`/`CANNOT_REMOVE_OWNER`/`NOT_A_MEMBER`)·API endpoint
(`DELETE /api/workspaces/:id/members/:memberId`)는 전부 `spec/2-navigation/9-user-profile.md`,
`spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/12-workspace.md`
와 기존 코드 상수에 이미 동일한 의미로 존재하는 재사용이다. 형제 다섯 PR(#1369~#1372)이
확립한 "락 없이 원자적 `DELETE` 의 `affected` 로 판정" 패턴도 새 이름을 만들지 않고
그대로 답습한다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·spec 파일
경로 어느 축에서도 신규 식별자가 도입되지 않으므로 충돌 대상 자체가 없다.

## 위험도
NONE
