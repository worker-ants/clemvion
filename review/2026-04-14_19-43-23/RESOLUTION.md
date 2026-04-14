# RESOLUTION — 2026-04-14_19-43-23

워크플로우 버전 이력 구현에 대한 다중 에이전트 코드 리뷰(`SUMMARY.md`)에서 제기된 이슈에 대한 조치 내역.

## CRITICAL — 모두 해결

### 1. WorkflowVersionsController 스펙 부재 → ✅ 추가
- 신규: `backend/src/modules/workflow-versions/workflow-versions.controller.spec.ts`
- 커버: `findByWorkflow` / `findOne` 정상 흐름, `assertWorkspaceOwnership` 실패 시 NotFoundException 전파, 권한 실패 시 후속 호출 차단

### 2. WorkflowsController에 `restoreVersion` / `saveCanvas` 테스트 누락 → ✅ 추가
- `backend/src/modules/workflows/workflows.controller.spec.ts`에 두 번째 describe 블록 추가
- 커버: `saveCanvas`가 `user.sub`를 서비스에 전달, `restoreVersion`이 `(workflowId, workspaceId, versionId, userId)` 순서로 전달

---

## WARNING — 모두 해결

### 3. 트랜잭션 비원자성 + Race Condition (createVersion) → ✅ 해결
- `WorkflowVersionsService.createVersion`이 optional `EntityManager`를 받도록 변경
- `WorkflowsService.saveCanvas`가 동일 트랜잭션 안에서 `createVersion`을 호출 → 캔버스/버전이 함께 커밋 또는 함께 롤백
- 트랜잭션 안에서는 `setLock('pessimistic_write')`로 동시 저장 시 동일 버전 번호 할당 차단
- UNIQUE 제약 위반 시 `QueryFailedError`를 `ConflictException`(`WORKFLOW_VERSION_CONFLICT`)으로 변환

### 4. WorkflowVersionsController 워크스페이스 IDOR → ✅ 해결
- `WorkflowVersionsModule`이 `Workflow` repository를 import
- 새 메서드 `assertWorkspaceOwnership(workflowId, workspaceId)` 추가
- 컨트롤러의 `findByWorkflow` / `findOne`이 `@WorkspaceId()` 데코레이터를 받고 진입 시점에 워크스페이스 소속 검증

### 5. restoreVersion 스냅샷 미검증 → ✅ 해결
- `WorkflowsService.restoreVersion`이 `snapshot.nodes`/`snapshot.edges`가 배열인지, `snapshot.name` 타입이 올바른지 검사
- 실패 시 `BadRequestException`(`INVALID_VERSION_SNAPSHOT`) 던짐 → 캔버스 전체 삭제 시나리오 차단

### 6. `buildSnapshot` 캡슐화 위반 → ✅ 해결
- `public` → `private`으로 변경

### 7. SaveCanvasDto.changeSummary 검증 테스트 누락 → ✅ 해결
- `workflow-dto-validation.spec.ts`에 SaveCanvasDto describe 블록 추가
- 누락/500자/501자 케이스 검증

### 8. WorkflowVersionsService.findOne 쿼리 파라미터 미검증 → ✅ 해결
- spec을 `where: { id, workflowId }` 정확한 객체로 검증하도록 변경

### 9. restoreVersion 오류 시나리오 미검증 → ✅ 해결
- spec에 NotFoundException 전파 / malformed snapshot 케이스 추가

### 10. VersionDetailDialog / VersionDiffDialog 테스트 누락 → ✅ 해결
- 신규: `version-detail-dialog.test.tsx` (정상 렌더, 에러 상태)
- 신규: `version-diff-dialog.test.tsx` (낮은 버전이 before가 되도록 정렬, 에러 상태)

---

## INFO — 후속 과제로 유보

다음 항목은 위험도가 낮거나 기존 시스템 전반의 정책 결정이 필요해 별도 작업으로 분리:

- `description`/`tags`/`settings` MaxLength — 기존 DTO 전반의 정책 변경. 본 변경 범위 밖.
- 키 순서가 다른 동일 객체에 대한 `JSON.stringify` 비교 — 현재 동작 의도(필드 단위 deep compare)에 합리적이며, 노드 config 변경 감지 노이즈는 없는 것으로 확인.
- `WorkflowsService → WorkflowVersionsService` 직접 의존성 → 도메인 이벤트로 분리: 향후 멀티 사용자 협업 확장 시 재검토.
- `RestoreConfirmDialog`의 `window.location.reload()` 직접 호출 → 추후 editor store 액션으로 대체 가능.

---

## 검증

- backend: `npx jest` → 73 suites / 988 tests pass
- frontend: `npx vitest run` → 41 files / 565 tests pass
- backend: `npm run build` → success
- frontend: `npm run build` → success
- backend changed files lint: 0 errors (warnings는 기존 패턴과 동일 — `any` 추론 관련 spec 파일 표준)
- frontend changed files lint: 0 errors / 0 warnings
