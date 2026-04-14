### 발견사항

---

**[CRITICAL] WorkflowVersionsController 스펙 파일 부재**
- 위치: `backend/src/modules/workflow-versions/workflow-versions.controller.ts`
- 상세: 새로 추가된 `GET /workflows/:wfId/versions/:versionId` 엔드포인트에 대한 컨트롤러 스펙이 존재하지 않습니다. `findByWorkflow` 기존 엔드포인트에 대한 테스트도 없습니다.
- 제안: `workflow-versions.controller.spec.ts` 파일 생성 — `findOne` NotFoundException 전파, ParseUUIDPipe 동작, 정상 응답 검증 포함

---

**[CRITICAL] WorkflowsController에 `restoreVersion` 엔드포인트 테스트 누락**
- 위치: `workflows.controller.spec.ts`
- 상세: `POST /:id/versions/:versionId/restore` 가 `workflows.controller.ts` diff에 추가되었으나 `workflows.controller.spec.ts`는 `execute` 엔드포인트만 테스트합니다. 새 엔드포인트의 인증 전달, 404 전파, 정상 응답 등이 전혀 검증되지 않습니다.
- 제안: `restoreVersion` 엔드포인트에 대한 테스트 추가 — 정상 복원, workflowId 불일치 404, versionId 불일치 404 케이스 포함

---

**[WARNING] `VersionDetailDialog`, `VersionDiffDialog` 테스트 파일 없음**
- 위치: `frontend/src/components/editor/version-history/`
- 상세: `version-detail-dialog.tsx`와 `version-diff-dialog.tsx`에 대한 테스트 파일이 존재하지 않습니다. 로딩/에러/정상 상태 렌더링, Diff 방향 결정 로직(`a.version <= b.version`), `DiffSection` 빈 섹션 숨김 동작 등이 미검증 상태입니다.
- 제안: 각 컴포넌트에 대한 `__tests__` 파일 추가. 특히 Diff 방향 결정 로직(`version-diff-dialog.tsx` 내 `[before, after]` 정렬)은 반드시 단위 테스트 필요

---

**[WARNING] `SaveCanvasDto.changeSummary` MaxLength 검증 테스트 누락**
- 위치: `workflow-dto-validation.spec.ts`
- 상세: `save-canvas.dto.ts`에 `changeSummary?: string`과 `@MaxLength(500)`이 추가되었으나 `workflow-dto-validation.spec.ts`에는 이에 대한 테스트가 전혀 없습니다. 501자 입력 거부, 500자 허용, 미입력 허용 케이스가 누락되었습니다.
- 제안:
```typescript
describe('SaveCanvasDto', () => {
  it('should fail when changeSummary exceeds 500 chars', async () => {
    const dto = plainToInstance(SaveCanvasDto, { ..., changeSummary: 'a'.repeat(501) });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.some(e => e.property === 'changeSummary')).toBe(true);
  });
});
```

---

**[WARNING] `restoreVersion` 서비스 오류 시나리오 미검증**
- 위치: `workflows.service.spec.ts`, `restoreVersion` describe 블록
- 상세: 현재 테스트는 정상 복원 경로만 검증합니다. 다음 케이스가 누락됩니다:
  1. `findById` 실패 → 워크플로우가 해당 workspace 소속이 아닐 때
  2. `workflowVersionsService.findOne` → NotFoundException 전파
  3. 스냅샷에 `name`이 없을 때 (`snapshot.name`이 undefined)
- 제안: 각 오류 케이스에 대한 `rejects.toThrow` 테스트 추가

---

**[WARNING] `WorkflowVersionsService.findOne` 테스트가 쿼리 파라미터를 검증하지 않음**
- 위치: `workflow-versions.service.spec.ts`, `findOne` describe 블록
- 상세: `mockRepo.findOne`이 호출될 때 `{ where: { id: versionId, workflowId } }` 형태로 두 조건 모두 전달되는지 검증하지 않습니다. `workflowId` 필터 없이 `id`만으로 조회해도 현재 테스트를 통과할 수 있어 보안 취약점을 숨길 수 있습니다.
- 제안:
```typescript
it('should query by both id and workflowId', async () => {
  mockRepo.findOne.mockResolvedValue({ id: 'v-1', workflowId: 'wf-1' });
  await service.findOne('wf-1', 'v-1');
  expect(mockRepo.findOne).toHaveBeenCalledWith({
    where: { id: 'v-1', workflowId: 'wf-1' },
    relations: ['creator'],
  });
});
```

---

**[WARNING] `buildSnapshot` 메서드 직접 테스트 없음**
- 위치: `workflows.service.ts` — `buildSnapshot` (public 메서드)
- 상세: `buildSnapshot`은 버전 스냅샷의 구조를 결정하는 핵심 메서드이지만 직접 단위 테스트가 없습니다. 스냅샷 필드 누락이나 `null` 기본값 처리가 검증되지 않은 상태입니다.
- 제안: `buildSnapshot`에 대한 독립 `describe` 블록 추가 — 빈 노드/엣지, optional 필드의 null 기본값 처리, 스냅샷 구조 형식 검증 포함

---

**[WARNING] `version-history-panel.test.tsx` — 주요 인터랙션 시나리오 누락**
- 위치: `version-history-panel.test.tsx`
- 상세: 현재 테스트는 데이터 표시와 닫기만 검증합니다. 다음이 누락됩니다:
  - Diff 모드 토글 시 체크박스 노출 여부
  - 버전 2개 선택 후 Diff 버튼 활성화
  - Eye 버튼 클릭 → `VersionDetailDialog` 노출
  - Restore 버튼 클릭 → `RestoreConfirmDialog` 노출
  - `listVersions`가 올바른 `workflowId`로 호출되는지 검증
- 제안: 위 인터랙션별 테스트 케이스 추가

---

**[WARNING] `restoreVersion` 성공 후 `onClose` 호출 여부 검증 누락**
- 위치: `restore-confirm-dialog.test.tsx`
- 상세: 복원 성공 후 `window.location.reload()`는 검증되지만 `onClose`가 호출되는지(또는 의도적으로 호출되지 않는지)는 검증되지 않습니다. 또한 뮤테이션 진행 중 버튼 비활성화 상태와 "Restoring…" 텍스트도 미검증입니다.
- 제안:
```typescript
it('shows loading state during mutation', async () => {
  vi.mocked(workflowsApi.restoreVersion).mockImplementation(
    () => new Promise(() => {}) // never resolves
  );
  // render → click → expect button text "Restoring…" and disabled
});
```

---

**[INFO] `diffSnapshots` — `config` 객체 키 순서 의존성 미검증**
- 위치: `diff-utils.test.ts`
- 상세: `fieldEqual`이 `JSON.stringify`를 사용하므로 `{ a: 1, b: 2 }` vs `{ b: 2, a: 1 }`처럼 키 순서가 다른 동치 객체를 "변경됨"으로 잘못 감지할 수 있습니다. 이 동작이 허용 가능한지 테스트로 명시해야 합니다.
- 제안: `config` 필드의 키 순서가 다른 동치 객체에 대한 테스트 추가

---

**[INFO] `workflows.controller.spec.ts` — `saveCanvas` 변경 사항 미반영**
- 위치: `workflows.controller.spec.ts`
- 상세: `saveCanvas` 시그니처가 `_user` → `user`로 변경되어 `user.sub`를 서비스에 전달하도록 수정되었으나, 컨트롤러 테스트에 `saveCanvas` 테스트가 아예 없어 이 변경 사항이 정상 동작하는지 검증되지 않습니다.

---

**[INFO] `UpdateWorkflowDto` 검증 테스트 최소화**
- 위치: `workflow-dto-validation.spec.ts`
- 상세: `UpdateWorkflowDto`에 대한 테스트는 `folderId` 변환 2케이스와 검증 1케이스만 존재합니다. `name` MaxLength(255), `tags` 배열 검증, `settings` 객체 검증, `isBoolean` 등의 필드가 미검증 상태입니다.

---

### 요약

워크플로우 버전 이력 기능 구현에 있어 핵심 서비스 계층(`WorkflowVersionsService`, `WorkflowsService`)의 테스트는 주요 흐름을 검증하고 있으나, **컨트롤러 테스트가 전반적으로 부실**합니다. 특히 신규 추가된 `restoreVersion` 컨트롤러 엔드포인트와 `WorkflowVersionsController` 전체에 대한 스펙이 없습니다. 프론트엔드에서는 `diff-utils` 유틸과 `RestoreConfirmDialog`·`VersionHistoryPanel`에 대한 기본 테스트는 존재하지만, `VersionDetailDialog`와 `VersionDiffDialog`에 대한 테스트가 완전히 누락되어 있고 패널의 핵심 인터랙션(Diff 모드, 버전 선택, 다이얼로그 트리거)이 검증되지 않은 상태입니다. `SaveCanvasDto.changeSummary` 검증 테스트 누락과 `findOne` 쿼리 파라미터 미검증은 잠재적 보안/회귀 리스크를 내포합니다.

### 위험도

**HIGH**