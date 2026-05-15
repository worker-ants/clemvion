## 발견사항

### [WARNING] `transferOwnership` 컨트롤러 엔드포인트에 `@Roles('owner')` 미적용
- **위치**: `workspaces.controller.ts`, `transferOwnership` 메서드
- **상세**: 엔드포인트에 `@Roles` 데코레이터가 없어 `RolesGuard`가 모든 인증된 사용자를 통과시킨다. 서비스 레벨에서 owner 여부를 검증하므로 기능적으로는 정상 동작하지만, API 계약의 명시성과 방어 심층(defense-in-depth) 관점에서 누락이다. `deleteWorkspace` 등 다른 owner-only 작업도 같은 패턴을 따른다면 프로젝트 관례와 일치하지만, 스펙 상 "Owner 이양 | Owner"로 명시된 만큼 컨트롤러에서도 선언적으로 표현하는 것이 바람직하다.
- **제안**: `transferOwnership` 메서드에 `@Roles('owner')` 추가

---

### [WARNING] 트랜잭션 외부에서 로드된 `workspace` 엔티티의 stale-write 위험
- **위치**: `workspaces.service.ts`, `transferOwnership` 메서드 (~line 400)
- **상세**: `workspace`를 트랜잭션 시작 전에 `this.workspaceRepository.findOne`으로 로드한 뒤, 트랜잭션 내에서 `workspace.ownerId = targetMembership.userId`로 수정하고 `wsRepo.save(workspace)`를 호출한다. 멤버 레코드에는 `FOR UPDATE` 락이 걸리지만 `workspace` 엔티티는 잠기지 않아 동시 수정 시 중간 변경이 덮어쓰일 수 있다. owner 이양이 직렬화된다는 전제에서는 무해하지만 엄밀히는 안전하지 않다.
- **제안**: `workspaceRepository.findOne`을 트랜잭션 내부 `wsRepo.findOne(..., { lock: { mode: 'pessimistic_write' } })`로 이동

---

### [WARNING] 감사 로그(Audit Log) 미생성
- **위치**: `workspaces.service.ts`, `transferOwnership` 메서드
- **상세**: Owner 이양은 워크스페이스의 최종 통제권이 변경되는 고-임팩트 보안 이벤트다. 프로젝트에 `AuditLogsModule`이 존재하며, 다른 민감 작업(멤버 제거, 워크스페이스 삭제 등)에서 감사 로그를 기록한다면 이 기능만 누락된 것이다. 보안 요구사항 `NF-SC-06` (감사 로그 — 주요 액션 기록, ✅)과의 정합성 불일치 가능성이 있다.
- **제안**: 두 멤버 role swap 및 `workspace.ownerId` 갱신 후 감사 로그 엔트리 생성 추가

---

### [INFO] 이양 다이얼로그에서 네이티브 `<select>` 사용
- **위치**: `frontend/src/app/(main)/workspace/settings/page.tsx`, 이양 다이얼로그 내 멤버 선택 UI
- **상세**: 설정 페이지의 나머지 select 계열 UI는 Shadcn UI `<Select>` 컴포넌트를 사용하는데, 이양 대상 선택 드롭다운은 인라인 스타일이 포함된 네이티브 `<select>` 요소다. 기능적 문제는 없으나 디자인 시스템 일관성에서 벗어난다.
- **제안**: `@/components/ui/select`의 `<Select>` 컴포넌트로 교체

---

## 요약

Owner 이양 기능은 핵심 요구사항(팀 워크스페이스 전용, 비-owner 멤버 대상, 이메일 확인, 트랜잭션 내 동시 role swap + `ownerId` 동기화)을 충실히 구현했다. 글로벌 `RolesGuard` 리팩터링(per-controller `@UseGuards` → `APP_GUARD`) 역시 올바르며, 불필요해진 `WorkspacesService` mock 제거 등 테스트 정리도 적절하다. 단, 컨트롤러에 `@Roles('owner')` 선언 누락, 트랜잭션 외부 엔티티 로드 후 내부 저장이라는 stale-write 패턴, 고-임팩트 보안 이벤트임에도 감사 로그가 없는 점이 보완이 필요한 지점이다.

## 위험도
**MEDIUM**