# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 인가 누락(정보 노출), 동시성 취약점(TOCTOU), cascade 미보장이 복합적으로 존재하며 즉각 수정이 필요한 항목이 다수

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **보안 / API** | `PATCH /workspaces/:id` no-op 분기에서 멤버십 인가 검사 없이 워크스페이스 메타데이터(이름·슬러그·타입) 반환 — 모든 인증된 사용자가 임의 UUID로 타 워크스페이스 존재 여부 및 정보 열람 가능 | `workspaces.controller.ts` — `update()`, `dto.name === undefined` 분기 | no-op 분기 제거 후 `name`을 DTO에서 required로 선언. 또는 해당 분기에 `assertMembership` 추가 |
| 2 | **동시성 / DB** | `leaveWorkspace`의 sole-owner 검사(owners.length ≤ 1)와 `memberRepository.remove` 사이에 트랜잭션 미적용 — 두 owner 동시 탈퇴 시 owner 0명 워크스페이스 생성 가능 (TOCTOU) | `workspaces.service.ts` — `leaveWorkspace()` | `dataSource.transaction` + `SELECT ... FOR UPDATE` 또는 DB constraint(owner ≥ 1)으로 원자적 처리 |
| 3 | **보안 / 사이드이펙트** | `removeMember`에서 `member.userId === requesterId`(자기 자신 제거) 경로가 `leaveWorkspace`의 가드(personal 워크스페이스 차단, sole-owner 보호)를 완전히 우회 | `workspaces.service.ts` — `removeMember()` | 자기 자신 제거 시 `leaveWorkspace` 위임 또는 동일 가드 적용 |
| 4 | **DB / 무결성** | `deleteWorkspace`에서 멤버·초대 레코드의 cascade 처리를 "외부 정리에 의존"이라고만 기술 — 엔티티/마이그레이션에 `ON DELETE CASCADE` 미설정 시 orphan 레코드 발생 및 FK 제약 위반 | `workspaces.service.ts` — `deleteWorkspace()` 주석 | `WorkspaceMember` 엔티티에 `onDelete: 'CASCADE'` 설정 확인. 없으면 서비스에서 멤버·초대 명시적 삭제 후 워크스페이스 삭제 |
| 5 | **동시성 / DB** | `deleteWorkspace`와 `leaveWorkspace` 모두 다단계 쿼리를 트랜잭션 없이 실행 — 동시 요청 시 race condition 및 이중 삭제 발생 가능 | `workspaces.service.ts` — `deleteWorkspace()`, `leaveWorkspace()` | 두 메서드 전체를 `dataSource.transaction`으로 감싸기 |
| 6 | **아키텍처 / HTTP** | 이름 길이 검증 실패(2자 미만 또는 100자 초과) 시 `ConflictException`(HTTP 409) 사용 — 입력값 오류는 `BadRequestException`(400)이 적합하며 Swagger `@ApiBadRequestResponse` 선언과 불일치. `createTeam`도 동일 패턴 반복 | `workspaces.service.ts` — `renameWorkspace()`, `createTeam()` | `ConflictException` → `BadRequestException`으로 교체. DTO `@MinLength/@MaxLength` 검증에 위임하고 서비스 내 중복 검증 제거 가능 |
| 7 | **아키텍처** | 컨트롤러의 `dto.name === undefined` 분기에 비즈니스 로직 누출 — `findById` 직접 호출 및 응답 조립이 서비스 레이어 책임 | `workspaces.controller.ts` — `update()` | no-op 분기 제거 후 `name`을 required로 처리 |
| 8 | **테스트** | 컨트롤러 레이어(`update`, `remove`, `leave`) 테스트 부재 — HTTP envelope shape, `ParseUUIDPipe`, auth guard 동작 미검증 | `workspaces.controller.ts` 전체 | `@nestjs/testing` 기반 컨트롤러 유닛 테스트 또는 E2E 테스트 추가 |
| 9 | **테스트 / DTO** | `renameWorkspace` 서비스 테스트의 `throws when name is too short` 케이스가 실제 HTTP 경로와 불일치 — DTO `@MinLength(2)`가 먼저 차단하므로 서비스 직접 호출 테스트와 실제 경로가 다른 레이어를 검증 | `workspaces.service.spec.ts` | 서비스 내 중복 길이 검증 제거 후 DTO validation 경계값 컨트롤러 테스트로 이동 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **코드 중복** | `roleLabelKey(role: WorkspaceRole): TranslationKey` 함수가 두 파일에 동일하게 중복 정의 — role 추가 시 두 곳 동시 수정 필요 (Shotgun Surgery) | `sidebar.tsx`, `settings/page.tsx` | `@/lib/utils/workspace.ts`로 추출 후 양쪽에서 import |
| 2 | **미사용 코드** | `DangerZoneTabProps`에 `workspaceRole: WorkspaceRole` 선언되어 있으나 구현부에서 미사용 | `settings/page.tsx` — `DangerZoneTabProps` | prop 제거. 필요 시 그때 추가 |
| 3 | **상태 동기화** | `CreateTeamWorkspaceDialog.onSuccess`에서 Zustand store 수동 갱신(`setWorkspaces`) + TanStack Query 캐시 무효화(`invalidateQueries`) 이중 처리 — 동기화 오류 가능성 | `create-team-workspace-dialog.tsx` — `onSuccess` | `useWorkspaceSync()` 커스텀 훅으로 단일 진입점 추출 |
| 4 | **UX** | 워크스페이스 생성 직후 전환 시 `createSuccess` toast와 `workspace.switched` toast가 연속으로 두 번 표시 | `create-team-workspace-dialog.tsx`, `providers.tsx` | 생성 직후 전환 시 `switched` toast suppress 플래그 적용 또는 `createSuccess` toast 제거 |
| 5 | **에러 코드** | `renameWorkspace`에서 이름 100자 초과 시에도 `WORKSPACE_NAME_TOO_SHORT` 에러 코드 사용 — 의미 불일치 | `workspaces.service.ts` — `renameWorkspace()` | `WORKSPACE_NAME_INVALID`로 통합하거나 `WORKSPACE_NAME_TOO_LONG` 분리 |
| 6 | **의존성** | `@radix-ui/react-dialog`, `@radix-ui/react-tabs` 신규 패키지 `package.json` 선언 여부 미확인 | `frontend/package.json` | 선언 확인 필요 (미선언 시 런타임 오류) |
| 7 | **i18n** | `dangerLeaveOnlyOwner` 번역 키가 양쪽 사전에 추가되었으나 `settings/page.tsx`에서 미참조 | `en.ts`, `ko.ts` | 프론트엔드에서 `SOLE_OWNER_CANNOT_LEAVE` 에러 코드 파싱 후 연결하거나 키 제거 |
| 8 | **DB / 성능** | `leaveWorkspace`의 `(workspaceId, role)` 복합 인덱스 미설정 시 역할 조회 시 full scan 가능성 | `WorkspaceMember` 엔티티 | `@Index(['workspaceId', 'role'])` 복합 인덱스 추가 검토 |
| 9 | **성능** | `leaveWorkspace`에서 `workspace`와 `membership` 조회가 직렬 실행 — 두 쿼리는 독립적으로 병렬화 가능 | `workspaces.service.ts` — `leaveWorkspace()` | `Promise.all([workspaceRepo.findOne(...), memberRepo.findOne(...)])` 적용 |
| 10 | **아키텍처** | `renderWorkspaceGroup`이 일반 함수로 구현되어 React DevTools 미추적, 훅 사용 불가 | `sidebar.tsx` — `renderWorkspaceGroup` | `WorkspaceGroup` 컴포넌트로 전환 |
| 11 | **REST 규약** | `DELETE /workspaces/:id` 성공 응답이 `{ data: { ok: true } }` HTTP 200 — 다른 삭제 엔드포인트의 204 패턴과 불일치 | `workspaces.controller.ts` — `remove()` | 프로젝트 삭제 엔드포인트 응답 패턴 통일 |
| 12 | **보안 (낮음)** | 프론트엔드 삭제 확인 입력값 비교가 클라이언트 단독 검증 — API 직접 호출로 우회 가능 | `settings/page.tsx` — `DangerZoneTab` | 중요도 높다면 서버에서도 `confirmName` 검증 추가 고려 |
| 13 | **코드 품질** | `cn("border-[hsl(var(--destructive))]/40")` — 조건 없이 단일 문자열만 전달하여 `cn` 불필요 | `settings/page.tsx` — `DangerZoneTab` | 직접 `className` 문자열로 전달 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | no-op 분기 인가 누락 + `leaveWorkspace` TOCTOU |
| Database | MEDIUM | 트랜잭션 미적용(TOCTOU), cascade 미보장, no-op 분기 멤버십 미검증 |
| Concurrency | MEDIUM | `leaveWorkspace` sole-owner TOCTOU, `deleteWorkspace` 동시 삭제 race |
| API Contract | MEDIUM | no-op 분기 권한 없이 응답, `ConflictException` 오용, null 200 반환 |
| Side Effect | MEDIUM | `removeMember` 자가 탈퇴 시 가드 우회, cascade 미보장, toast 중복 |
| Testing | MEDIUM | 컨트롤러 테스트 부재, cascade 미검증, DTO·서비스 검증 불일치 |
| Requirement | MEDIUM | no-op 인가 누락, 에러 코드 의미 불일치, cascade 미보장 |
| Architecture | LOW | 컨트롤러 로직 누출, 검증 순서 비일관, `ConflictException` 오용 |
| Maintainability | LOW | `roleLabelKey` 중복, no-op 분기, `ConflictException` 오용 |
| Documentation | LOW | cascade 의존 주석 불명확, 에러 코드 불일치, 미사용 i18n 키 |
| Performance | LOW | 직렬 DB 조회(병렬화 가능), no-op 경로 불필요 조회 |
| Dependency | LOW | Radix UI 패키지 `package.json` 선언 확인, `roleLabelKey` 중복 |
| Scope | LOW | `workspaceRole` 미사용 prop, `addMember→invite` 행동 변경 미언급 |

---

## 발견 없는 에이전트
없음 (13개 에이전트 전원 발견사항 보고)

---

## 권장 조치사항

1. **[즉시] `PATCH /workspaces/:id` no-op 분기 제거** — `UpdateWorkspaceDto`에서 `name`을 required로 변경하거나, `dto.name === undefined` 분기에 `assertMembership` 추가. 현재 인증된 모든 사용자가 임의 워크스페이스 정보를 조회 가능한 인가 취약점

2. **[즉시] `removeMember` 자가 탈퇴 경로에 `leaveWorkspace` 가드 적용** — `member.userId === requesterId` 조건에서 `leaveWorkspace` 위임 또는 동일 가드(personal 차단, sole-owner 보호) 추가

3. **[즉시] `leaveWorkspace` + `deleteWorkspace` 트랜잭션 적용** — `dataSource.transaction` + 비관적 락으로 TOCTOU 경쟁 조건 차단. `leaveWorkspace`의 sole-owner 보호 로직은 현재 원자성 미보장

4. **[단기] `deleteWorkspace` cascade 보장** — `WorkspaceMember`, `WorkspaceInvitation` 엔티티의 `onDelete: 'CASCADE'` 설정 확인. 미설정 시 서비스 내 명시적 삭제 코드 추가

5. **[단기] `ConflictException` → `BadRequestException` 교체** — `renameWorkspace`, `createTeam`의 이름 길이 검증 실패 시 HTTP 400 반환. Swagger 계약과 일치. DTO 검증(`@MinLength/@MaxLength`)에 위임 후 서비스 내 중복 검증 제거

6. **[단기] 컨트롤러 레이어 테스트 추가** — `update`, `remove`, `leave` 엔드포인트의 HTTP envelope, UUID 파이프, guard 동작 검증

7. **[중기] `roleLabelKey` 공유 유틸로 추출** — `@/lib/utils/workspace.ts`로 이동 후 `sidebar.tsx`, `settings/page.tsx` 양쪽에서 import

8. **[중기] 미사용 코드 정리** — `DangerZoneTabProps.workspaceRole` prop 제거, `dangerLeaveOnlyOwner` i18n 키 연결 또는 삭제, `cn()` 단순 문자열 치환

9. **[선택] `leaveWorkspace` DB 조회 병렬화** — `workspace`와 `membership` 첫 조회를 `Promise.all`로 처리하여 응답 지연 감소