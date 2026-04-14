## 발견사항

### [WARNING] `WorkflowVersionsController` — 워크스페이스 권한 검증 없음
- **위치**: `workflow-versions.controller.ts` — `findByWorkflow`, `findOne` 핸들러
- **상세**: `WorkflowsController.restoreVersion`은 `@WorkspaceId()` 데코레이터로 워크스페이스 소유권을 확인하지만, `WorkflowVersionsController`는 `wfId`를 받아 서비스를 직접 호출합니다. 인증된 사용자라면 다른 워크스페이스의 버전 목록/스냅샷을 조회할 수 있습니다.
- **제안**: `findByWorkflow`, `findOne` 모두 `@WorkspaceId()`를 주입받아 `findById(wfId, workspaceId)` 소유권 확인 후 버전을 반환하도록 수정.

---

### [WARNING] `WorkflowVersion.changeSummary` — TypeScript 타입과 DB 스키마 불일치
- **위치**: `workflow-version.entity.ts:35`
- **상세**: DB 컬럼은 `nullable: true`이지만 TypeScript 타입은 `string`(non-nullable)으로 선언되어 있습니다. null 값이 실제로 저장·조회될 때 타입 오류가 숨겨집니다.
- **제안**: `changeSummary: string | null;`로 수정.

---

### [WARNING] `createVersion` — 버전 번호 경쟁 조건
- **위치**: `workflow-versions.service.ts` `createVersion` 메서드
- **상세**: `getOne()`으로 최신 버전을 조회한 뒤 `+1`하는 read-then-write 패턴입니다. 동일 워크플로우에 대해 두 요청이 동시에 진입하면 같은 버전 번호를 계산하여 `(workflow_id, version)` UNIQUE 제약 위반이 발생합니다. 재시도 로직 없음.
- **제안**: `INSERT ... SELECT MAX(version)+1` 방식의 단일 쿼리나 DB 시퀀스, 또는 낙관적 잠금(+ 재시도)으로 교체.

---

### [WARNING] `Workflow.currentVersion` — 갱신되지 않는 필드
- **위치**: `workflow.entity.ts:51` (`currentVersion`)
- **상세**: `createVersion` 호출 시 `Workflow.currentVersion`이 업데이트되지 않습니다. 엔티티 필드는 기본값 `1`로 고정된 채 실제 버전 카운트와 영구적으로 乖離됩니다. 이 필드를 읽는 외부 코드가 있을 경우 잘못된 값을 반환합니다.
- **제안**: `createVersion` 완료 후 `workflowRepository.update(workflowId, { currentVersion: nextVersion })`로 동기화하거나, 필드가 실제로 사용되지 않는다면 entity에서 제거.

---

### [WARNING] `restoreVersion` — 스냅샷 구조 검증 없음
- **위치**: `workflows.service.ts` `restoreVersion` 메서드 (diff +312~326)
- **상세**: `target.snapshot`을 `as { name?: string; nodes?: unknown[]; edges?: unknown[] }`로 타입 단언한 뒤 `?? []` 폴백을 사용합니다. 스냅샷이 손상되거나 `nodes`가 `null`인 경우 빈 배열로 SaveCanvas가 호출되어 **기존 노드/엣지가 전부 삭제**됩니다. 오류 없이 데이터를 잃습니다.
- **제안**: `Array.isArray(snapshot.nodes)` 확인 후 그렇지 않으면 `BadRequestException` 던지기.

---

### [INFO] `VersionDetailDialog`, `VersionDiffDialog` — 테스트 파일 없음
- **위치**: `frontend/src/components/editor/version-history/`
- **상세**: `diff-utils.test.ts`, `restore-confirm-dialog.test.tsx`, `version-history-panel.test.tsx`는 존재하지만 `version-detail-dialog.tsx`, `version-diff-dialog.tsx`에 대한 테스트가 없습니다.
- **제안**: 두 다이얼로그에 대해 로딩 상태, 에러 상태, 정상 렌더링 케이스를 커버하는 테스트 추가.

---

### [INFO] `version-history-panel.test.tsx` — 비교(Diff) 흐름 테스트 누락
- **위치**: `version-history-panel.test.tsx`
- **상세**: 패널에서 Compare 토글 활성화 → 두 버전 선택 → Diff 버튼 클릭 → `VersionDiffDialog` 렌더링 흐름이 테스트되지 않았습니다.
- **제안**: 해당 인터랙션 경로를 커버하는 테스트 케이스 추가.

---

### [INFO] `tags` — 개별 항목 길이 제한 없음
- **위치**: `create-workflow.dto.ts:40`, `import-workflow.dto.ts` `ImportWorkflowDto.tags`
- **상세**: `@IsString({ each: true })`는 적용되어 있지만 개별 태그 문자열 길이 제한이 없어 임의 길이 문자열이 저장 가능합니다.
- **제안**: `@MaxLength(100, { each: true })` 등 추가.

---

## 요약

전반적으로 스펙(`spec/2-navigation/12-workflow-version-history.md`)에 정의된 기능(자동 스냅샷, 버전 목록 조회, 상세/Diff/복원 다이얼로그, 툴바 진입점)은 빠짐없이 구현되어 있고 API 경로·응답 구조·UI 동작 모두 스펙과 일치합니다. 다만 **워크스페이스 권한 검증 누락**(버전 엔드포인트), **버전 번호 경쟁 조건**, **`currentVersion` 필드 desync**, **스냅샷 구조 미검증**이 실제 운영 환경에서 데이터 손실 또는 권한 우회를 유발할 수 있으므로 반드시 해결이 필요합니다.

## 위험도

**MEDIUM**