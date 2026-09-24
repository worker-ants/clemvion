# 신규 식별자 충돌 검토 — removeMember 순서 테스트 (spec/2-navigation)

## 검토 범위 재확인

- scope(`spec/2-navigation/`) 델타: **0 파일**. 이 브랜치는 해당 spec 영역을 변경하지 않았다.
- 실제 구현 diff: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 1개 파일, 테스트 케이스 2개 추가 (`git diff origin/main...HEAD --stat` 기준 48줄, 그 외 변경은 전부 `plan/`·`review/`·`CHANGELOG.md`).
- 신규 코드는 **테스트 파일뿐**이며, 신규 프로덕션 코드·신규 API·신규 엔티티·신규 spec 문서는 없다.

## 발견사항

새로 부여된 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트/메시지명, 환경변수·설정키, spec 파일 경로 — 6개 관점 전부에서 target 이 **새로 도입하는 식별자가 없다.**

target 은 기존 `WorkspacesService.removeMember()` 의 판정 순서(대상 존재 → admin 권한 → self 위임)를 검증하는 unit 테스트 2건을 기존 `workspaces.service.spec.ts` 에 추가한 것이 전부다. 추가된 테스트가 참조하는 식별자를 확인한 결과:

- **`MEMBER_NOT_FOUND`** — `codebase/backend/src/modules/workspaces/workspaces.service.ts:344, 770` 에 이미 정의된 기존 에러 코드. `workspaces.controller.spec.ts:230`, 기존 `workspaces.service.spec.ts` 의 다른 다수 케이스(예: 1118, 1568, 1652행)에서 동일 의미로 이미 사용 중이다. 신규 테스트는 같은 코드를 같은 의미(대상 멤버 미존재)로 재사용한다 — 충돌 없음.
- **`ADMIN_REQUIRED`** — `workspaces.service.ts:923` 에 이미 정의된 기존 에러 코드. `workspaces.controller.spec.ts:131`, 기존 `workspaces.service.spec.ts` 의 여러 케이스(394, 535, 544, 547, 556, 559, 568, 1681, 1689, 1728, 1736, 1765행)에서 동일 의미(admin 미만 권한 거부)로 사용 중이다. 신규 테스트도 같은 코드를 같은 의미로 재사용한다 — 충돌 없음.
- 신규 `it()` 테스트 설명 문자열(예: `'비-admin 이 없는 대상을 지목하면 ADMIN_REQUIRED 가 아니라 MEMBER_NOT_FOUND 다'`, `'요청자 role 을 한 번만 조회한다'`)은 Jest 테스트 타이틀일 뿐 코드 식별자가 아니며, 같은 `describe` 블록 내 다른 테스트 제목과 겹치지 않는다.
- 신규 API endpoint, 신규 webhook/queue/SSE 이벤트명, 신규 ENV var·config key, 신규 spec 파일 경로 — 모두 **해당 사항 없음**(diff 에 그러한 추가가 존재하지 않음, 위 워킹트리 `git diff origin/main...HEAD --stat` 로 확인).
- 번들에 포함된 `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/1-workflow-list.md` 는 이 target 이 변경한 파일이 아니라(scope 델타 0) 참고용 기존 본문이므로, 그 안의 기존 식별자(예: `MEMBER_NOT_FOUND` 와 무관한 `PASSWORD_REQUIRED`, `invitation_email_mismatch` 등)와 target 신규 코드 간 충돌 검토 대상도 아니다 — 대조 결과 겹치는 신규 식별자 없음.

## 요약

target 은 `spec/2-navigation/` 을 변경하지 않았고(델타 0), 유일한 실질 변경은 `WorkspacesService.removeMember` 판정 순서를 검증하는 unit 테스트 2건 추가다. 이 테스트들이 참조하는 `MEMBER_NOT_FOUND`·`ADMIN_REQUIRED` 는 모두 기존에 이미 동일한 의미로 정의·사용 중인 에러 코드이며, 신규로 도입된 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·spec 파일 경로는 전혀 없다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
