## 발견사항

### **[WARNING]** 버전 이력 목록 API에 페이지네이션 없음
- 위치: `workflow-versions.controller.ts` - `GET /workflows/:wfId/versions`
- 상세: 버전이 누적되면 전체 목록을 한 번에 반환하므로 응답 크기가 무제한으로 증가할 수 있음. `snapshot` 필드는 제외되어 있지만(`findByWorkflow`는 `snapshot` 미포함), 장기 운영 워크플로우에서 수백 건 이상 누적될 수 있음
- 제안: `PaginationQueryDto`를 적용하거나 최소한 응답 건수를 제한하는 `limit` 파라미터 추가

### **[WARNING]** `saveCanvas` 서명 변경 — 내부 호출자에 대한 파괴적 변경
- 위치: `workflows.service.ts:285` — `saveCanvas(id, workspaceId, dto)` → `saveCanvas(id, workspaceId, userId, dto)`
- 상세: 메서드 시그니처에 `userId` 파라미터가 추가됨. 현재 코드베이스 내 모든 호출부가 업데이트되어 있지만, 이 서비스를 직접 주입해 사용하는 다른 모듈이 존재할 경우 런타임 오류 발생. 테스트에서도 기존 호출부 전체를 수동으로 수정함
- 제안: 하위 호환성이 필요하다면 `userId?: string` 옵셔널로 처리하거나, 서비스 내부적으로 컨텍스트(예: `AsyncLocalStorage`)로 전달하는 방식 고려

### **[WARNING]** 복원 엔드포인트가 워크스페이스 격리 검증을 `restoreVersion` 내부에서만 수행
- 위치: `workflows.controller.ts` - `POST /workflows/:id/versions/:versionId/restore`
- 상세: `restoreVersion` 서비스는 `findById(workflowId, workspaceId)`를 먼저 호출해 워크스페이스 소속을 검증하지만, 이후 `workflowVersionsService.findOne(workflowId, versionId)`는 `workflowId`만 일치하면 반환함. 다른 워크스페이스의 사용자가 `versionId`를 추측하면 워크스페이스 간 접근이 이론상 불가능하지만, 방어 레이어 부재
- 제안: `findOne`에 `workspaceId`까지 전달해 DB 쿼리 수준에서 격리 보장하거나, 컨트롤러에 `@WorkspaceGuard` 적용 여부 확인

### **[WARNING]** `snapshot` 타입이 `Record<string, unknown>`으로 느슨하게 정의됨
- 위치: `workflow-version.entity.ts:28`, `workflows.service.ts` - `restoreVersion`
- 상세: `target.snapshot as { name?: string; nodes?: unknown[]; ... }` 캐스팅에 의존함. 저장 시점과 복원 시점 사이에 스냅샷 스키마가 변경되면(마이그레이션 없이) 복원 시 `SaveCanvasDto` 검증(`validateManualTrigger` 등)은 통과해도 런타임에 예상치 못한 구조가 들어올 수 있음
- 제안: `buildSnapshot`의 반환 타입을 명시적 인터페이스로 정의하고, 복원 시 구조 검증(Zod 등) 추가

### **[INFO]** `changeSummary` 누락 시 `undefined` vs `null` 불일치
- 위치: `workflow-versions.service.ts:45` — `changeSummary: changeSummary || undefined`
- 상세: DB 컬럼은 `nullable: true`이고 TypeScript 타입은 `string | null`인데, 서비스에서 `changeSummary || undefined`로 처리하면 TypeORM이 `undefined`를 `null`로 변환하는 동작에 의존함. 프론트엔드 `WorkflowVersionSummary.changeSummary: string | null` 타입과는 일치하지만, 명시성 부족
- 제안: `changeSummary: changeSummary ?? null`로 명확하게 작성

### **[INFO]** 복원 응답과 `saveCanvas` 응답 구조가 래퍼 형식 불일치 가능성
- 위치: `frontend/src/lib/api/workflows.ts:204` — `restoreVersion` 응답 타입 `{ data: { workflow, nodes, edges } }`
- 상세: 프론트엔드는 `res.data.data`로 중첩 접근(`getVersion`, `listVersions`와 동일 패턴). `restoreVersion`도 동일 패턴을 기대하고 있음. 실제 컨트롤러는 `saveCanvas` 결과를 그대로 반환하므로 글로벌 응답 인터셉터가 `{ data: ... }` 래핑을 담당하는지 확인 필요
- 제안: 응답 인터셉터 적용 범위 문서화 또는 E2E 테스트에서 실제 응답 형식 검증

### **[INFO]** `GET /workflows/:wfId/versions/:versionId` 라우트 순서 충돌 위험 없음 (확인)
- 위치: `workflow-versions.controller.ts`
- 상세: `GET /` (목록)과 `GET /:versionId` (상세) 순서가 적절히 정의되어 있고, `:versionId`가 UUID이므로 다른 리터럴 세그먼트와 충돌 없음. NestJS 라우팅 특성상 문제없음
- 제안: 없음

---

## 요약

이번 변경은 워크플로우 버전 이력 기능 전체를 신규 추가한 것으로, 기존 API에 대한 **파괴적 변경은 최소화**되어 있습니다. `saveCanvas` 엔드포인트(`POST /workflows/:id/save`)에 선택적 필드 `changeSummary`가 추가된 것은 완전한 하위 호환성을 유지하며, 새로 추가된 엔드포인트들(`GET /versions`, `GET /versions/:id`, `POST /versions/:id/restore`)은 RESTful 경로 설계와 일관된 에러 응답(`NotFoundException` + `code` 필드) 형식을 따릅니다. 다만 버전 목록에 페이지네이션 부재, `snapshot` 타입의 느슨한 정의로 인한 복원 안정성 문제, 서비스 내부 메서드 시그니처 변경에 따른 잠재적 영향이 주요 개선 사항입니다.

## 위험도

**MEDIUM**