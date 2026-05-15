# 코드 리뷰 이슈 조치 내역

리뷰 결과: `./SUMMARY.md` (Critical 0, Warning 9, Info 13). 전체 위험도 MEDIUM.

모든 **Warning**은 해소했으며, 그 중 Info도 일부 처리했다.

---

## Warning 조치 (9/9 완료)

| # | 카테고리 | 조치 내용 | 수정 파일 |
|---|----------|----------|-----------|
| W1 | 보안 / API | `UpdateWorkspaceDto.name`을 required로 변경하고 `PATCH /workspaces/:id` 컨트롤러의 no-op 분기 제거. 이제 `renameWorkspace`가 항상 `assertAdmin`으로 멤버십/권한을 검증하므로 정보 노출 우회 경로가 사라짐 | `dto/update-workspace.dto.ts`, `workspaces.controller.ts:update()` |
| W2 | 동시성 / DB | `leaveWorkspace`를 `memberRepository.manager.transaction()` 안에서 수행하고 멤버십 조회와 owners 조회에 `pessimistic_write` 락 적용. sole-owner 판정과 삭제 사이의 TOCTOU 제거 | `workspaces.service.ts:leaveWorkspace()` |
| W3 | 보안 / 사이드이펙트 | `removeMember`에서 `member.userId === requesterId` 경로를 `leaveWorkspace` 위임으로 교체. personal 워크스페이스 차단·sole-owner 보호 가드가 자가 탈퇴 경로에도 동일하게 적용됨 | `workspaces.service.ts:removeMember()` |
| W4 | DB / 무결성 | `deleteWorkspace` 내부에서 `invitationRepository.delete({workspaceId})`와 `memberRepository.delete({workspaceId})`를 명시적으로 수행해 `WorkspaceInvitation` 관계 부재에 따른 orphan 위험 제거. `WorkspaceMember`는 기존 FK cascade 유지 | `workspaces.service.ts:deleteWorkspace()` |
| W5 | 동시성 / DB | `deleteWorkspace`도 `transaction()` + `pessimistic_write`로 감쌌다. 멤버십 조회(owner 확인), 워크스페이스 조회(type 확인), 삭제 전 과정이 원자적 | `workspaces.service.ts:deleteWorkspace()` |
| W6 | 아키텍처 / HTTP | `createTeam`의 이름 길이 검증 에러를 `ConflictException`(409) → `BadRequestException`(400) + `WORKSPACE_NAME_INVALID`로 변경. `renameWorkspace`의 중복 길이 검증은 제거하고 DTO `@MinLength/@MaxLength`에 위임 | `workspaces.service.ts:createTeam()`, `renameWorkspace()` |
| W7 | 아키텍처 | W1과 함께 해소: 컨트롤러의 `dto.name === undefined` 분기 및 `findById` 직접 호출 제거 | `workspaces.controller.ts:update()` |
| W8 | 테스트 | `workspaces.controller.spec.ts` 신규 작성. `update`/`remove`/`leave` 엔드포인트의 서비스 위임과 HTTP envelope(`{data:{ok:true}}`, `{data:{id,name,...}}`) 및 예외 전파 검증 (총 6개 테스트) | `workspaces.controller.spec.ts` |
| W9 | 테스트 / DTO | `renameWorkspace`의 "throws when name is too short" 케이스 삭제. 길이 검증이 DTO로 이동했으므로 서비스 단위 테스트에서 검증할 책임이 아님 | `workspaces.service.spec.ts` |

---

## Info 조치 (4/13 완료)

| # | 카테고리 | 조치 내용 | 수정 파일 |
|---|----------|----------|-----------|
| I1 | 코드 중복 | `roleLabelKey`를 `@/lib/utils/workspace.ts`로 추출하고 `sidebar.tsx`·`settings/page.tsx` 양쪽에서 import | `utils/workspace.ts` 신규, `sidebar.tsx`, `settings/page.tsx` |
| I2 | 미사용 코드 | `DangerZoneTabProps.workspaceRole` prop 제거 | `settings/page.tsx` |
| I4 | UX | 팀 워크스페이스 생성 직후 `createSuccess` toast 제거. 이어지는 `switchWorkspace` 호출로 `workspace.switched` toast가 자동으로 뜨므로 동일 정보의 이중 토스트 해소 | `create-team-workspace-dialog.tsx` |
| I7 | i18n | 서버 에러 코드 `SOLE_OWNER_CANNOT_LEAVE`를 파싱해 `workspace.dangerLeaveOnlyOwner` 키로 메시지 표시. 아울러 rename/leave/delete 에러 핸들러를 공통 `parseApiError()`로 통일 | `settings/page.tsx` |
| I13 | 코드 품질 | 조건 없이 단일 문자열만 전달하던 `cn("border-...")` 직접 `className` 문자열로 치환 | `settings/page.tsx` |

### 미조치 Info (근거)

| # | 내용 | 미조치 근거 |
|---|------|------------|
| I3 | `CreateTeamWorkspaceDialog`의 store + query 이중 처리 | 현재 프로젝트 전반 패턴(여러 생성 Dialog에서 동일하게 사용). 전사 리팩터링 주제라 본 범위 밖 |
| I5 | 이름 100자 초과 시 `WORKSPACE_NAME_TOO_LONG` 세분화 | DTO `@MaxLength`가 HTTP 경로에서 먼저 거부. 서비스 진입 시점에서는 길이 조건 이미 통과 상태이므로 분리 실익 없음 |
| I6 | Radix UI 패키지 `package.json` 선언 | `@radix-ui/react-dialog@^1.1.15`, `@radix-ui/react-tabs@^1.1.13` 이미 선언 확인 |
| I8 | `(workspaceId, role)` 복합 인덱스 | 성능 이슈 보고 없음. 스키마 마이그레이션이 필요한 별도 작업 |
| I9 | `leaveWorkspace` DB 조회 병렬화 | 현재 workspace 선조회 후 `transaction`이 분리 구조. 병렬화 위해 구조 재편 필요, 본 범위 밖 |
| I10 | `renderWorkspaceGroup`의 컴포넌트 전환 | 현재 2번 호출되는 presenter. 순수 함수로도 동작에 문제 없으며 React DevTools 추적은 개발자 경험 항목 |
| I11 | `DELETE /workspaces/:id` 204 응답 | 프로젝트 전반에서 `{ data: { ok: true } }` 패턴으로 통일되어 있음 (기존 `removeMember` 참조). 변경 시 전사 컨벤션 영향 |
| I12 | 프론트엔드 삭제 확인 입력 검증 | 브라우저 UX 보호 장치. 실제 권한은 서버 `OWNER_REQUIRED` 가드가 담당 |

---

## 검증

조치 후 다시 실행한 결과:

- **Backend lint**: ✓ (eslint "{src,apps,libs,test}/**/*.ts" --fix)
- **Frontend lint**: ✓ (eslint)
- **Backend unit tests**: ✓ 1435 passed (이전 1430 → 신규 workspaces.controller.spec.ts 5 테스트 추가)
- **Frontend unit tests**: ✓ 990 passed
- **Backend build**: ✓ nest build
- **Frontend build**: ✓ next build (Compiled successfully)

## 스키마 차원의 추가 고려

- `WorkspaceInvitation` 엔티티는 현재 `@ManyToOne(() => Workspace)` 관계가 선언돼 있지 않다. 마이그레이션 단에서 FK + `ON DELETE CASCADE`를 부여하면 `deleteWorkspace` 내 명시적 `invRepo.delete`를 제거할 수 있다. 본 PR 범위에서는 schema migration을 동반하지 않는 서비스-레이어 처리로 안전하게 해소.
