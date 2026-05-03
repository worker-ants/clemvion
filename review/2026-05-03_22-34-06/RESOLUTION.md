# RBAC UI 리뷰 조치 — 2026-05-03 22:34

리뷰 보고서: `SUMMARY.md` (Critical 0, Warning 14, Info 11)

## 조치한 이슈

### Warning

| # | 카테고리 | 조치 | 위치 |
|---|----------|------|------|
| 1 | Security/Architecture/Requirement | RolesGuard 역할 계층 검증 — 신규 단위 테스트 `roles.guard.spec.ts` 13건. `@Roles('editor')` 라우트가 owner/admin/editor 통과·viewer 차단, `@Roles('admin')` 라우트가 owner/admin 통과·editor/viewer 차단을 it.each 로 검증. 추가로 미가드 핸들러 통과·userId/workspaceId/멤버십 누락 시 거부 케이스. | `backend/src/common/guards/roles.guard.spec.ts` (신규) |
| 2 | Testing/Architecture | 동일 `roles.guard.spec.ts` 가 RolesGuard.canActivate() 를 직접 호출해 실제 가드 동작을 검증. e2e 까지 가지 않고도 가드 내부 로직 회귀를 잡는다. (전체 supertest e2e 까지는 확장하지 않음 — 단위 레벨 커버리지로 충분.) | 동상 |
| 3 | Testing | `roles.guard.spec.ts` 의 it.each 가 4단계 역할(owner/admin/editor/viewer) × 2개 라우트 케이스를 모두 다룸. 컨트롤러 메타데이터 스펙도 4단계 모두에 자동 적용. | 동상 |
| 5 | Security | `auth-configs/regenerate` 를 `@Roles('editor')` → `@Roles('admin')` 격상. 키 교체는 외부 호출자 토큰을 즉시 무효화해 다른 서비스 중단을 유발하므로 표준 보안 관행에 맞춰 Admin+ 만 허용. 컨트롤러 코멘트·Swagger `@ApiForbiddenResponse` 문구·spec 메타데이터 테스트 모두 동기화. `plan/stages/05-rbac-enforcement.md` 진행 노트에도 명시. | `auth-configs.controller.ts` `regenerate()`, `auth-configs.controller.spec.ts`, `plan/stages/05-rbac-enforcement.md` |
| 6 | Testing/Requirement | schedules Delete 버튼에 `title={t("schedules.deleteTooltip")}` 추가. 신규 i18n 키 `schedules.deleteTooltip` ko/en. 테스트는 `screen.getByTitle(/^delete$/i)` / `queryByTitle` 으로 명시적 assertion 으로 교체. | `schedules/page.tsx`, `schedules-page.test.tsx`, `i18n/dict/{ko,en}.ts` |
| 7 | Testing/Side Effect | `schedules-page.test.tsx`·`triggers-page.test.tsx` 의 RBAC describe `beforeEach` 에 `useWorkspaceStore.getState().reset()` 추가. `cleanup()` 호출 위치도 `beforeEach` 첫 줄로 통일. | 동상 |
| 8 | Testing/Maintainability | `EditorToolbar` More 메뉴 트리거에 `data-testid="editor-toolbar-more-menu"` + `aria-label={t("editor.moreMenu")}` 추가. 테스트는 `screen.getByTestId(...)` 로 안정적 식별 (이전엔 마지막 버튼 인덱스에 의존). 신규 i18n 키 `editor.moreMenu` ko/en. | `editor-toolbar.tsx`, `editor-toolbar-rbac.test.tsx`, `i18n/dict/{ko,en}.ts` |
| 9 | Testing | `useWorkspaceStore.getState().reset()` 존재 확인 — `workspace-store.ts` 에 정의되어 있어 안전. 별도 조치 없음. | `workspace-store.ts:47` |
| 11 | Maintainability | schedules 테스트의 `document.querySelector('button[title*="Edit" i]')` → `screen.getByTitle(/^edit$/i)` / `queryByTitle` 로 testing-library 권장 API 로 교체. | `schedules-page.test.tsx` |
| 13 | Side Effect | `EditorToolbar` 의 역할 검사 메커니즘을 단일화. `useHasRole("editor")` → `canEdit` 변수 하나로 Save·이름 inline rename·Delete(More 메뉴) 모두 `{canEdit && ...}` 조건 렌더로 통일. `RoleGate` import 제거. | `editor-toolbar.tsx` |
| I3 | Documentation | `role-gate.tsx` `ROLE_LEVEL` 위에 역할 계층 (`viewer < editor < admin < owner`) 과 backend `roles.guard.ts` 와의 동기화 의무를 명시한 주석 추가. | `role-gate.tsx` |
| I11 | Maintainability | `editor-toolbar.tsx` 의 WHAT 주석 (`{/* Center: editable name */}`, `{/* Save (Editor+) */}`, `{/* More menu */}`) 제거. | `editor-toolbar.tsx` |

### Info — 부분 조치

I3·I11 위 표 참조.

## 조치하지 않은 이슈와 사유

| # | 카테고리 | 사유 |
|---|----------|------|
| W4 | Security | `getUsage` 응답 (`AuthConfigUsageDto`) 필드는 `totalCalls`/`triggerName`/`status`/`startedAt`/`id` 로 모두 운영 메타데이터. 비밀값은 `AuthConfigDto.config` 에서 마스킹 처리되어 별도 노출 경로 없음. Viewer 가 사용 통계를 보는 것은 read 권한 범위로 의도된 동작. |
| W10 | Maintainability | `setRole` 헬퍼는 3개 테스트 파일에 ~6줄씩 복제. 추출 비용 ≥ 유지 비용으로 판단해 현 상태 유지. 4번째 호출자가 추가될 때 `frontend/src/test-utils/workspace.ts` 로 이전. |
| W12 | Architecture | `APP_GUARD` 전역 등록 + `@SkipRoles()` opt-out 모델 전환은 모든 컨트롤러 검증·기존 가드 호환성·@Public 라우트 설계까지 동반하는 stage 단위 작업. 본 사이클의 RBAC UI 잔여 작업 범위 밖이라 별도 stage 로 분리 (Stage 5 후속). |
| W14 | Scope | execution-engine·handler-output.adapter 변경은 `npm run lint --fix` 자동 결과 — 본 PR 에서 `style(backend): lint --fix 자동 정리` 별도 커밋으로 이미 분리되어 있음. PR 단위로 함께 들어가나 commit 단위로는 분리 완료. |
| I1 | Maintainability | 역할 문자열 상수화는 본 사이클 변경 외에도 기존 6개 컨트롤러 동시 마이그레이션이 필요. 별도 정리 작업으로 분리. |
| I2 | Architecture | `structured?.config ?? undefined` 단순화는 lint --fix 가 만든 변경 자체가 아니라 사람이 한 정리. 동작 영향 없으나 본 RBAC PR 범위 밖이라 후속 정리. |
| I4 | Maintainability | 컨트롤러 메타데이터 테스트 헬퍼 추출 — 현재 2개 파일이라 비용 < 효과 임계 미달. 3개 이상 누적 시 `backend/test/test-utils/roles-metadata.ts` 로 추출. |
| I5 | Performance | row 내 RoleGate 인스턴스화는 zustand selector 호출 수준 (memoized referential) 비용. PAGE_SIZE=20 기준 측정 가능한 성능 영향 없음. 향후 PAGE_SIZE 가 100+ 로 커지면 재고. |
| I6 | Requirement | auth-configs Editor CRUD 권한이 spec 표 ("Integration 읽기·사용") 와 다르다는 지적은 사실이나, auth-configs 는 Integration 과 별도 자원이며 워크플로우 인증 설정의 일종이라 Editor CRUD 가 합당. spec 신규 정의는 project-planner 영역으로 분리. |
| I7 | Architecture | Undo/Redo 가 viewer 에게도 활성 — viewer 는 어차피 Save 가 비표시라 Undo/Redo 의 결과가 영구화되지 않음. UX polish 로 별도 처리. |
| I8 | Requirement | viewer 가 isDirty 상태로 Run 시도하면 saveBeforeRun 에서 백엔드 403 → 토스트 — 본 사이클의 가드 적용 결과로 발생한 **현실적으로 드문** 경로 (viewer 는 dirty 상태를 만들 trigger UI 가 모두 차단됨). 후속 polish 항목. |
| I9 | Testing | `it.each` 직렬화 가독성은 jest 출력 형식 한계. 케이스명에 영향 미미. |
| I10 | Side Effect | `cleanup()` 위치 통일은 W7 조치 시 함께 적용 (모든 RBAC describe 의 beforeEach 첫 줄로). |

## 검증

- 새 테스트: `roles.guard.spec.ts` 13건 통과
- 기존 RBAC 테스트 4 파일 (editor-toolbar / triggers / schedules / role-gate) 20건 모두 통과
- TEST WORKFLOW 재실행 결과: 별도 commit 메시지 본문 참조
