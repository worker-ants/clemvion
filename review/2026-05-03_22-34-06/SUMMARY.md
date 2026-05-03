# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — RBAC 가드 구조 자체는 올바르게 적용되었으나, RolesGuard의 역할 계층(owner ≥ admin ≥ editor ≥ viewer) 처리 방식이 이번 diff에서 검증되지 않아 Admin/Owner 사용자가 쓰기 엔드포인트에서 403을 받을 가능성이 있으며, 보안에 직결되는 RBAC 기능임에도 실제 HTTP 403 경로를 검증하는 테스트가 부재하다.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Architecture / Requirement | **RolesGuard 역할 계층 미검증 — Admin/Owner 차단 가능성** `@Roles('editor')` 가드가 `exact match`로 구현된 경우 owner·admin이 모든 write 엔드포인트에서 403을 받는 치명적 회귀가 발생한다. 현재 컨트롤러 스펙 테스트는 메타데이터 부착 여부만 확인하므로 이 시나리오를 잡을 수 없다. | `auth-configs.controller.ts:44`, `folders.controller.ts:42`, `roles.guard.ts` (diff 외부) | `roles.guard.ts`에서 `ROLE_HIERARCHY: Record<WorkspaceRole, number>` 맵으로 수치 비교하는지 확인. 아니라면 계층 포함 단위 테스트 추가 |
| 2 | Testing / Architecture | **백엔드 가드 테스트가 메타데이터만 검증 — 실제 HTTP 403 미테스트** `Reflector.get()`으로 데코레이터 부착 여부만 확인. RolesGuard 내부 버그, JWT 가드 순서 문제, 미들웨어 바이패스는 감지 불가. | `auth-configs.controller.spec.ts`, `folders.controller.spec.ts` | supertest 기반 e2e 테스트로 viewer 토큰의 `POST /auth-configs`, `PATCH /folders/:id` 호출 시 HTTP 403 반환 검증 추가 |
| 3 | Testing | **admin/owner 역할 커버리지 전무** 모든 RBAC 테스트가 `editor`/`viewer`만 검증. 역할 계층 변경 시 회귀 감지 불가. | `schedules-page.test.tsx`, `triggers-page.test.tsx`, `editor-toolbar-rbac.test.tsx`, `auth-configs.controller.spec.ts`, `folders.controller.spec.ts` | `it.each`에 `{ role, method, shouldPass }` 형태로 admin/owner 케이스 추가 |
| 4 | Security | **Viewer가 auth-config 실행 메타데이터 무제한 조회 가능** `getUsage` 엔드포인트에 `@Roles` 미적용. 응답에 요청 IP·입력 파라미터·인증 시도 패턴 등 민감 운영 정보가 포함될 경우 Viewer가 과도한 정보에 접근. | `auth-configs.controller.ts` `getUsage()` | `AuthConfigUsageDto` 실제 필드 검토 후 민감 필드가 있으면 `@Roles('editor')` 추가 또는 Viewer 전용 DTO로 민감 필드 제거 |
| 5 | Security | **Editor가 워크스페이스 인증 키 즉시 무효화 가능** `@Roles('editor')` 하나로 모든 편집자가 어떤 auth-config든 키 교체(rotation) 가능. 키 교체는 기존 토큰을 즉시 무효화하므로 다른 서비스 중단을 유발할 수 있다. 표준 보안 관행상 키 순환은 Admin 이상에게만 허용. | `auth-configs.controller.ts` `regenerate()` | `regenerate`에 `@Roles('admin')` 적용 또는 생성자 검증 서비스 레이어 추가. 설계 결정으로 유지한다면 spec에 명시 |
| 6 | Testing / Requirement | **schedules 페이지 Viewer Delete 버튼 비표시 실질 검증 누락** 테스트 설명은 "delete 비표시"를 명시하지만 Delete 버튼에 `title` 속성이 없어 실제 assertion이 없다. RoleGate 밖으로 빠져도 테스트가 통과된다. | `schedules-page.test.tsx:155–169`, `schedules/page.tsx` | Delete 버튼에 `title={t("schedules.deleteTooltip")}` 또는 `data-testid` 추가 후 명시적 assert 작성 |
| 7 | Testing / Side Effect | **RBAC describe 블록에서 Zustand 스토어 미초기화** `schedules-page.test.tsx`, `triggers-page.test.tsx`의 RBAC `beforeEach`에 스토어 리셋 호출 없음. 이전 describe 블록 상태가 잔류할 수 있어 테스트 실행 순서에 따라 결과가 달라지는 취약점. `editor-toolbar-rbac.test.tsx`는 `reset()`을 올바르게 호출해 일관성 불일치. | `schedules-page.test.tsx:61–70`, `triggers-page.test.tsx:65–74` | RBAC `describe`의 `beforeEach`에 `useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null, loaded: false })` 또는 `reset()` 추가 |
| 8 | Testing / Maintainability | **More 메뉴 트리거를 버튼 배열 마지막 인덱스로 식별** 버튼이 추가되면 인덱스가 바뀌어 의도와 다른 버튼을 클릭. 코드 주석도 취약성을 인정한 채 수정하지 않음. | `editor-toolbar-rbac.test.tsx:106,116` | `EditorToolbar` More 버튼에 `aria-label="More options"` 또는 `data-testid="more-menu-trigger"` 추가 |
| 9 | Testing | **`useWorkspaceStore.getState().reset()` 존재 여부 미확인** workspace store에 `reset` 메서드가 없으면 테스트 전체가 런타임 오류로 실패. | `editor-toolbar-rbac.test.tsx:73` | workspace-store 정의에서 `reset` 메서드 존재 확인. 없으면 `useWorkspaceStore.setState(initialState)` 로 대체 |
| 10 | Maintainability | **`setRole` / `createWrapper` 헬퍼 3개 파일에 완전 중복** `WorkspaceRole` 타입이나 store shape 변경 시 세 곳을 동시에 수정해야 함. | `schedules-page.test.tsx`, `triggers-page.test.tsx`, `editor-toolbar-rbac.test.tsx` | `frontend/src/test-utils/workspace.ts`로 추출해 재사용 |
| 11 | Maintainability | **`document.querySelector` 직접 사용 — testing-library anti-pattern** `screen.getByTitle` 사용 권장. cleanup 후 이전 DOM 참조 잔류 위험. | `schedules-page.test.tsx:158,176` | `screen.getByTitle(/edit/i)` 또는 `data-testid` 기반 `screen.getByTestId` 사용 |
| 12 | Architecture | **Opt-in guard 패턴 — 신규 컨트롤러 누락 시 무방비 노출** 각 컨트롤러에 수동으로 `@UseGuards(RolesGuard)` 선언. 빠뜨리면 RBAC 없이 노출. | `auth-configs.controller.ts:44`, `folders.controller.ts:42`, 모든 컨트롤러 | `APP_GUARD` 프로바이더로 전역 등록 후 `@SkipRoles()` / `@Public()` opt-out 모델 전환 |
| 13 | Side Effect | **EditorToolbar에서 역할 검사 메커니즘 이중화** `useHasRole`(명령형)과 `<RoleGate>`(선언형)가 동일 컴포넌트에서 혼용. 역할 위계 로직 변경 시 한 쪽만 업데이트되는 드리프트 위험. | `editor-toolbar.tsx:57`, `editor-toolbar.tsx:295` | 이름 편집도 `<RoleGate>`로 통일하거나 모두 `canEdit` 변수 조건 렌더로 통일 |
| 14 | Scope | **RBAC 무관 변경 혼재 (execution-engine, handler-output.adapter)** 타입 캐스트 제거, 포맷팅 변경이 RBAC PR에 혼입. 특히 타입 단언 제거는 타입 추론 변화를 수반하므로 별도 검토 필요. | `execution-engine.service.ts:1514`, `handler-output.adapter.spec.ts:111–115` | 별도 PR/커밋으로 분리 또는 의도를 커밋 메시지에 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Architecture | **`'editor'` 역할 문자열 여러 컨트롤러에 하드코딩** 역할명 변경 시 전체 검색·치환 필요. | `auth-configs.controller.ts`, `folders.controller.ts` 전체 `@Roles('editor')` | `export const ROLE = { EDITOR: 'editor', ADMIN: 'admin' } as const` 공유 상수로 추출 후 `@Roles(ROLE.EDITOR)` 사용 |
| 2 | Architecture / Maintainability | **`structured?.config ?? undefined` no-op 잉여 표현** 옵셔널 체이닝은 이미 `undefined`를 반환하므로 `?? undefined`는 효과 없음. | `execution-engine.service.ts:1514` | `const structuredConfig = structured?.config;`로 단순화 |
| 3 | Documentation | **`RoleGate` / `useHasRole` 소스에 역할 계층 미표기** `minRole="editor"` 의 ≥ 비교 의미가 코드에서 불명확. 미래 기여자가 `minRole` 잘못 사용할 여지. | `role-gate.tsx` 또는 `useHasRole` 선언부 | 역할 순서(`viewer < editor < admin < owner`)를 단 한 줄 주석으로 표기 |
| 4 | Maintainability | **백엔드 두 스펙 파일 완전 동일한 보일러플레이트** 컨트롤러 증가 시 동일 패턴 계속 복제. | `auth-configs.controller.spec.ts`, `folders.controller.spec.ts` | `testRolesMetadata(ControllerClass, writeMethods, readMethods)` 공유 헬퍼 backend test-utils에 정의 |
| 5 | Performance | **테이블 row 반복문 내 `RoleGate` 인스턴스화 (N개 Zustand 구독)** PAGE_SIZE=20 기준 20개 store 구독 생성. 역할은 세션 내내 불변에 가까운 값. | `schedules/page.tsx`, `triggers/page.tsx` row map | 페이지 최상단에서 `const canEdit = useHasRole('editor')` 한 번 읽고 row 내 `{canEdit && ...}`로 구독 N→1로 줄임 |
| 6 | Requirement | **auth-configs Editor CRUD 권한 — 역할 설계 테이블과 불일치** 원래 설계 테이블에서 Editor는 Integration "읽기·사용"만 가능. auth-configs가 Editor-writable임이 spec에 미반영. | `spec/` 또는 `prd/` 역할 정의 문서 | 역할 정의 spec 문서에 auth-configs가 Editor-writable임을 명시 |
| 7 | Architecture | **Viewer에게 Undo/Redo 버튼 노출** Save·이름 편집·Delete는 RoleGate로 숨겼지만 Undo/Redo는 Viewer에게도 활성 상태. UX 일관성 불일치. | `editor-toolbar.tsx` (diff 외부) | `disabled={undoStack.length === 0 \|\| !canEdit}` 조건 추가 또는 `RoleGate` 래핑 |
| 8 | Requirement | **Viewer의 `saveBeforeRun` 경로에서 403 오류 토스트 가능성** `isDirty`가 true인 채 마운트되면 Run 클릭 시 save 시도 → 백엔드 403 → 오류 토스트. | `editor-toolbar.tsx` `saveBeforeRun` | `if (!canEdit && isDirty) return false` 조건 추가 |
| 9 | Testing | **`it.each` 테스트명의 `$expected` 배열 직렬화로 가독성 저하** 테스트 이름이 `create 는 @Roles(["editor"]) 로 가드된다`로 출력될 수 있음. | `auth-configs.controller.spec.ts:17`, `folders.controller.spec.ts:15` | `expected: 'editor'` 단일 문자열로 변경 또는 template 단순화 |
| 10 | Side Effect | **`cleanup()` 호출 위치 불일치** `schedules/triggers` 테스트는 `beforeEach` 말미, `editor-toolbar` 테스트는 `beforeEach` 첫 줄에 배치. | `schedules-page.test.tsx:63`, `triggers-page.test.tsx:67` | `afterEach` 또는 `beforeEach` 첫 줄로 통일 |
| 11 | Maintainability | **TSX 주석이 WHAT을 설명 (CLAUDE.md 지침 위반)** `{/* Center: editable name */}`, `{/* Save (Editor+) */}` — 코드 자체가 이미 의도를 표현. | `editor-toolbar.tsx:222, 283` | 두 주석 모두 제거 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | MEDIUM | RolesGuard 역할 계층 미검증, schedules Delete 버튼 검증 누락 |
| Security | LOW | Viewer의 getUsage 민감 데이터 노출, Editor의 regenerate 권한 범위 |
| Architecture | LOW | Opt-in guard 패턴 누락 위험, 역할 계층 통합 테스트 부재 |
| Testing | LOW | 실제 HTTP 403 경로 미테스트, admin/owner 케이스 전무, 취약한 DOM 셀렉터 |
| Maintainability | LOW | setRole/createWrapper 3중 중복, More 버튼 인덱스 의존, document.querySelector |
| Side Effect | LOW | RolesGuard passthrough 계약 미명시, Zustand 스토어 상태 누수, 역할 검사 이중화 |
| API Contract | LOW | 쓰기 엔드포인트 403 추가는 의도적 breaking change, 읽기는 하위 호환 유지 |
| Dependency | LOW | Zustand setState 직접 조작으로 store shape 결합, RoleGate/useHasRole 혼용 패턴 |
| Documentation | LOW | RoleGate minRole 역할 계층 주석 부재 |
| Performance | LOW | row 내 RoleGate 반복 인스턴스화 (N개 구독), useHasRole+RoleGate 중복 호출 |
| Scope | LOW | execution-engine 타입 캐스트 제거·포맷팅 변경 RBAC PR 혼입 |
| Concurrency | NONE | 동시성 관련 변경 없음 |
| Database | NONE | DB 쿼리·스키마·트랜잭션 변경 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Concurrency | RBAC 데코레이터·UI 조건부 렌더링만 포함, 동시성 패턴 없음 |
| Database | DB 접근 레이어 무변경, execution-engine 변경도 순수 스타일 정리 |

---

## 권장 조치사항

1. **[즉시] RolesGuard 역할 계층 구현 확인** — `roles.guard.ts`에서 `owner/admin`이 `editor` 요건을 만족하는 수치 비교 로직이 있는지 확인하고, 없다면 수정 후 계층 포함 단위 테스트 추가. 이 버그가 있으면 현재 배포된 코드에서 Admin/Owner가 쓰기 불가 상태다.

2. **[단기] HTTP 403 경로 e2e 테스트 추가** — viewer 토큰으로 `POST /auth-configs`, `PATCH /folders/:id` 실제 호출 시 HTTP 403 반환을 검증하는 테스트 1~2개 추가. 보안 기능은 메타데이터 검증만으로는 부족하다.

3. **[단기] `regenerate` 권한 재검토** — Editor 누구든 인증 키를 즉시 무효화할 수 있는 현재 설계가 의도적인지 확인. Admin 이상 제한 여부를 결정하고 spec에 명시.

4. **[단기] schedules Delete 버튼 assert 보완** — `page.tsx`의 Delete 버튼에 `data-testid` 또는 `title` 추가 후 Viewer 테스트에 명시적 검증 추가.

5. **[단기] RBAC describe `beforeEach` 스토어 리셋 추가** — `schedules-page.test.tsx`, `triggers-page.test.tsx` RBAC 블록에 `useWorkspaceStore.setState(...)` 또는 `reset()` 추가하고 `reset` 메서드 존재 여부 확인.

6. **[중기] 테스트 헬퍼 공통화** — `setRole`/`createWrapper`를 `frontend/src/test-utils/workspace.ts`로 추출, More 버튼에 `data-testid="more-menu-trigger"` 추가, `document.querySelector` → `screen.getByTitle`/`screen.getByTestId`로 교체.

7. **[중기] Opt-in → Opt-out guard 모델 전환 검토** — `APP_GUARD`로 `RolesGuard` 전역 등록 후 공개 엔드포인트에 `@Public()` 데코레이터 적용. 신규 컨트롤러 누락 시 기본 차단.

8. **[중기] admin/owner 역할 테스트 케이스 추가** — `it.each`에 4단계 역할(viewer/editor/admin/owner) 및 통과/차단 예상값을 포함하여 역할 계층 회귀 감지 가능하게 구성.

9. **[저우선] auth-configs Editor CRUD 권한 spec 반영** — 역할 정의 spec 문서(`prd/` 또는 `spec/`)에 auth-configs가 Editor-writable임을 명시하여 설계 테이블과 구현 정합성 확보.

10. **[저우선] execution-engine 잉여 코드 정리** — `structured?.config ?? undefined` → `structured?.config`로 단순화 (별도 커밋으로 분리).