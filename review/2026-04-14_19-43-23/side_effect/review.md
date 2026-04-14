## 발견사항

### [WARNING] `saveCanvas` 시그니처 변경 — 기존 호출자 영향
- **위치**: `workflows.service.ts` (diff), `workflows.controller.ts` (diff)
- **상세**: `saveCanvas(id, workspaceId, dto)` → `saveCanvas(id, workspaceId, userId, dto)`로 매개변수가 추가되었습니다. 컨트롤러는 이미 수정되었으나, 외부에서 이 서비스를 직접 사용하는 다른 모듈이 존재할 경우 런타임 오류가 발생합니다. `workflows.module.ts`에서 `WorkflowsService`를 `exports`로 내보내고 있어 외부 모듈에서 주입하여 사용 가능한 구조입니다.
- **제안**: `grep -r "saveCanvas"` 로 다른 호출 지점을 확인하세요.

---

### [WARNING] 버전 생성 실패 시 캔버스와의 불일치 (비원자성)
- **위치**: `workflows.service.ts:304-312` (diff의 `+await this.workflowVersionsService.createVersion(...)`)
- **상세**: 캔버스 트랜잭션 커밋 이후 `createVersion`이 별도 호출됩니다. `createVersion`이 실패하면 캔버스는 저장되었지만 버전 기록은 누락됩니다. 스펙(§9)에서 "다음 저장에서 자동으로 따라잡힌다"고 명시하였으나, 실제 구현에서 이를 보장하는 복구 로직은 없습니다. 연속 실패 시 버전 번호가 캔버스 변경 횟수보다 적어져 이력 신뢰성이 저하됩니다.
- **제안**: `createVersion` 실패를 로깅하고 silent하게 처리하거나, 재시도 로직을 추가하세요.

---

### [WARNING] `restoreVersion` 내 `findById` 결과 미사용
- **위치**: `workflows.service.ts` (diff의 `restoreVersion` 메서드)
- **상세**: `await this.findById(workflowId, workspaceId)` 호출 후 반환값을 사용하지 않고 `workspaceId` 검증 목적으로만 사용됩니다. 이는 의도된 동작이지만, `_` 관례 없이 결과를 버리는 코드는 오해를 유발합니다. 더 큰 문제는 이후 `saveCanvas` 호출 시 `findById`가 **다시 한 번** 호출되어 동일 워크플로우를 DB에서 두 번 조회합니다.
- **제안**: `void`로 명시하거나 주석으로 의도를 표시하세요. 또는 `findById` 결과를 `saveCanvas`에 전달하는 방식으로 중복 조회를 제거하세요.

---

### [WARNING] `buildSnapshot`이 `public` 메서드로 노출
- **위치**: `workflows.service.ts` (diff의 `buildSnapshot`)
- **상세**: `buildSnapshot`은 내부 구현 세부사항이나 `public`으로 선언되어 있습니다. 테스트(`workflows.service.spec.ts`)에서 직접 호출하지 않으며, 외부에서 이 메서드를 통해 잘못된 스냅샷 구조를 직접 생성할 수 있는 경로가 열립니다.
- **제안**: `private buildSnapshot(...)` 으로 변경하세요.

---

### [WARNING] 버전 생성 시 낙관적 잠금(Optimistic Locking) 미적용으로 인한 중복 버전 번호 위험
- **위치**: `workflow-versions.service.ts` (`createVersion` 메서드)
- **상세**: "최신 버전 조회 → nextVersion 계산 → 저장" 패턴은 동시에 두 개의 저장 요청이 들어올 경우 동일한 `(workflowId, version)` 을 시도하게 됩니다. `@Unique(['workflowId', 'version'])` 제약이 있어 DB 오류(UniqueViolation)로 이어지며, 이 오류는 컨트롤러까지 전파되어 500으로 응답합니다.
- **제안**: DB 레벨 `INSERT ... ON CONFLICT DO NOTHING` 또는 시퀀스/잠금을 사용하거나, UniqueViolation을 `ConflictException`으로 변환하는 예외 처리를 추가하세요.

---

### [INFO] `restoreVersion` 후 `window.location.reload()` — 저장되지 않은 변경사항 소실
- **위치**: `restore-confirm-dialog.tsx` (`onSuccess` 콜백)
- **상세**: 복원 성공 시 페이지를 강제 리로드합니다. 사용자가 복원 직전에 저장하지 않은 캔버스 변경사항이 있을 경우 경고 없이 소실됩니다. 스펙(§6)에서 페이지 리로드를 명시하였으나, 비저장 변경사항에 대한 언급은 없습니다.
- **제안**: `isDirty` 상태를 확인하여 비저장 변경사항이 있을 경우 추가 경고를 표시하거나, 복원 확인 다이얼로그에서 이를 명시하세요.

---

### [INFO] `DiffSection`의 children 비어있음 감지 로직 불완전
- **위치**: `version-diff-dialog.tsx` (`DiffSection` 컴포넌트)
- **상세**: `Array.isArray(children) ? children : [children]`으로 children을 배열로 변환한 후 `filter(Boolean)`으로 빈 섹션을 숨기려 합니다. 그러나 React의 `children`은 `ReactNode`이며, `map`이 빈 배열을 반환할 경우 부모에서 `{diff.nodes.added.map(...)}` 자체가 빈 배열 `[]`로 전달됩니다. 빈 배열은 `Boolean([])` === `true`이므로 빈 섹션이 렌더링될 수 있습니다.
- **제안**: `diff.nodes.added.length === 0` 조건으로 섹션 렌더링 여부를 제어하거나, `DiffSection`에 `items` prop을 직접 전달하세요.

---

### [INFO] `QueryWorkflowDto`의 `folderId` — `null` 변환 후 `@IsUUID()` 검증 순서
- **위치**: `query-workflow.dto.ts`
- **상세**: `@Transform`이 빈 문자열을 `null`로 변환하고, `@IsUUID()`는 변환된 `null`을 허용합니다(`@IsOptional()`). 그러나 query string에서 `?folderId=null` (문자열 "null")이 전달되면 `IsUUID` 검증 실패가 발생하는 것은 올바르지만, `folderId=` (빈값)은 의도대로 `null`로 처리됩니다. 동일 패턴이 `create-workflow.dto.ts`, `update-workflow.dto.ts`에도 일관되게 적용되어 있어 동작은 일관적입니다.

---

## 요약

이번 변경은 워크플로우 버전 이력 기능을 신규 추가한 것으로, 전반적으로 설계가 명확하고 스펙을 잘 반영하고 있습니다. 주요 부작용 위험은 세 가지입니다: (1) `saveCanvas` 시그니처 변경으로 인한 숨겨진 호출자 파손 가능성, (2) 캔버스 트랜잭션과 버전 생성이 분리된 비원자 구조에서 동시 요청 시 `(workflowId, version)` 유니크 제약 충돌이 500 오류로 이어지는 경로, (3) `buildSnapshot`이 `public`으로 노출되어 내부 구현이 불필요하게 외부에 열린 점입니다. 프론트엔드는 `window.location.reload()` 사용이 스펙 의도와 일치하나 비저장 변경사항 소실 UX 위험이 존재합니다.

---

## 위험도

**MEDIUM**