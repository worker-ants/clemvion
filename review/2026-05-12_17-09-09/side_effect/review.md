## 부작용 리뷰 결과

### 발견사항

---

**[WARNING] `WorkflowsService.findAll` 시그니처 파괴적 변경**
- 위치: `workflows.service.ts` L51, `workflows.controller.ts` L87
- 상세: `findAll(workspaceId, query)` → `findAll(workspaceId, query, userId)` — `userId`가 필수 매개변수로 추가됨. TypeScript는 컴파일 타임에 잡아주지만, 다른 모듈(예: 스케줄러, 관리자 커맨드, 통계 집계 서비스)이 이 메서드를 직접 호출한다면 런타임 전까지 발견되지 않는 경우도 있음.
- 제안: `userId: string | undefined = undefined`로 기본값을 줘서 하위 호환성을 유지하거나, 컨트롤러가 유일한 호출자임을 `grep`으로 확인하고 주석으로 명시.

---

**[WARNING] `WorkspacesService` DI 주입 — `WorkflowsModule` 임포트 미확인**
- 위치: `workflows.service.ts` L47, 테스트 L116
- 상세: `WorkflowsService` 생성자에 `WorkspacesService`가 주입되었으나, `WorkflowsModule`의 `imports` 배열에 `WorkspacesModule`이 추가되었는지 diff에 없음. 누락 시 NestJS DI 컨테이너가 런타임에 `WorkspacesService cannot be resolved` 에러를 던짐. 단위 테스트는 mock으로 우회하므로 이를 통해 감지되지 않음.
- 제안: `backend/src/modules/workflows/workflows.module.ts`에서 `WorkspacesModule` import 여부 확인 필요.

---

**[WARNING] 순환 의존성 잠재 위험**
- 위치: `workflows.service.ts` L21
- 상세: `WorkflowsService` → `WorkspacesService` 의존이 추가됨. 만약 `WorkspacesService`(또는 그 하위 의존)가 `WorkflowsService`를 참조한다면 NestJS의 순환 의존성 에러 발생. 현재 diff만으로는 확인 불가.
- 제안: `WorkspacesService` 모듈 트리를 확인하거나, `forwardRef()` 없이 정상 부트업되는지 빌드 후 검증.

---

**[WARNING] ownership 필터 시 추가 DB 쿼리 (N+1 유사 패턴)**
- 위치: `workflows.service.ts` L86–96
- 상세: `ownership === 'mine' || 'shared'`인 모든 요청마다 `workspacesService.findById(workspaceId)`가 추가 호출됨. 팀 워크스페이스에서 ownership 필터가 기본값이 될 경우, 모든 목록 조회에 DB 쿼리가 1개 더 추가됨. 또한 이 조회는 기존 `qb` 쿼리빌더의 트랜잭션 외부에서 독립 실행됨.
- 제안: `workspaceId`를 키로 컨트롤러나 미들웨어 단에서 워크스페이스 타입을 미리 resolve해 전달하거나, `@CurrentWorkspace()` 데코레이터로 추출해 `userId`처럼 직접 넘기는 방식 검토.

---

**[INFO] `ownership` 상태가 워크스페이스 전환 시 초기화되지 않음**
- 위치: `page.tsx` L48, L100–103
- 상세: 사용자가 팀 워크스페이스에서 `ownership = 'mine'`을 선택 후 개인 워크스페이스로 전환하면, `ownership` state는 `'mine'`으로 남음. UI는 `isTeamWorkspace` 가드로 버튼을 숨기고, queryFn도 파라미터를 전송하지 않아 **기능상 정상 동작**. 그러나 React Query 캐시 키가 `["workflows", ..., "mine", ...]`로 남아 워크스페이스 재전환 시 불필요한 캐시 미스 발생 가능.
- 제안: `currentWorkspace` 변경 시 `ownership`을 `'all'`로 reset하는 `useEffect` 추가.

---

**[INFO] `registry.ts` 섹션 키 변경 — 디렉토리명 일치 여부**
- 위치: `registry.ts` L71–79
- 상세: `03-expression-language` → `04-expression-language` 등 섹션 키가 일괄 변경됨. `SECTION_LABELS`는 실제 파일시스템 디렉토리명을 키로 사용하므로, 디렉토리가 renumber되지 않은 상태라면 해당 섹션이 한글 레이블 없이 `humanize()` 결과로 fallback됨. 빌드 에러 없이 무음으로 실패함.
- 제안: `src/content/docs/` 하위 디렉토리명이 실제로 renumber되었는지 확인 필요.

---

### 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, `WorkflowsService.findAll`의 시그니처 파괴적 변경으로 컨트롤러 외 다른 호출자가 있을 경우 컴파일 에러가 발생하며, `WorkspacesService`의 DI 주입을 위해 `WorkflowsModule`에 모듈 임포트가 추가되었는지 diff에서 확인되지 않아 런타임 부트업 실패 위험이 있다. 둘째, ownership 필터가 활성화될 때마다 추가 DB 쿼리가 발생하는 구조로, 성능에 부담이 될 수 있다. 프론트엔드의 `ownership` 상태 미초기화 문제와 docs 섹션 키 변경은 기능 오동작보다는 UX 미세 결함 수준이다.

### 위험도

**MEDIUM** — DI 미임포트 시 런타임 부트업 실패라는 숨은 위험이 있으며, 빌드/단위 테스트만으로는 이를 포착할 수 없음.