## 의존성 리뷰 결과

### 발견사항

---

**[INFO] 외부 패키지 추가 없음**
- 위치: 전체 변경사항
- 상세: 이번 변경은 신규 외부 라이브러리를 일절 추가하지 않았습니다. 백엔드는 기존 `typeorm`, `@nestjs/*`, `class-validator`, `class-transformer`를, 프론트엔드는 기존 `@tanstack/react-query`, `lucide-react`, `zustand`를 재사용합니다.
- 제안: 없음

---

**[INFO] 내부 모듈 의존 방향이 단방향으로 정상**
- 위치: `workflows.module.ts`, `workflow-versions.module.ts`
- 상세: `WorkflowsModule → WorkflowVersionsModule` 방향의 단방향 의존이 형성되며, `WorkflowVersionsModule`은 `WorkflowsModule`에 의존하지 않습니다. 엔티티 레벨에서도 `WorkflowVersion → Workflow`(ManyToOne) 방향이며 역방향 참조가 없어 순환 의존이 없습니다.
- 제안: 없음

---

**[WARNING] `buildSnapshot` 메서드가 `public`으로 노출됨**
- 위치: `workflows.service.ts` — `buildSnapshot` 메서드
- 상세: `buildSnapshot`은 `saveCanvas` 내부 구현 세부 사항으로, 외부 모듈이 직접 호출할 이유가 없습니다. `public`으로 노출되면 향후 다른 모듈이 이 메서드에 의존하게 되어 내부 API 표면이 의도치 않게 확장될 수 있습니다.
- 제안: `private buildSnapshot(...)` 으로 변경

---

**[WARNING] 버전 생성이 캔버스 트랜잭션 바깥에서 호출됨 — 부분 실패 시 의존 관계 불일치**
- 위치: `workflows.service.ts` — `saveCanvas` 메서드 마지막 부분
- 상세: `dataSource.transaction` 커밋 이후에 `workflowVersionsService.createVersion`이 별도로 호출됩니다. `createVersion` 실패 시 캔버스는 이미 저장된 상태로 버전 레코드만 누락됩니다. 스펙은 이를 허용하고 있으나("다음 저장에서 자동 따라잡힘"), 이 동작은 두 서비스 간 **암묵적 결합**을 만들고, 실제 운영에서 버전 누락이 발생할 수 있습니다.
- 제안: 허용 가능한 설계라면 코드 주석으로 의도를 명시하거나, 장기적으로는 outbox 패턴 또는 애플리케이션 레벨 보상 트랜잭션을 고려하세요.

---

**[INFO] 버전 관련 엔드포인트가 두 컨트롤러에 분산됨**
- 위치: `workflow-versions.controller.ts` (GET), `workflows.controller.ts` (POST restore)
- 상세: 버전 조회(`GET /workflows/:wfId/versions`, `GET /workflows/:wfId/versions/:versionId`)는 `WorkflowVersionsController`에, 복원(`POST /workflows/:id/versions/:versionId/restore`)은 `WorkflowsController`에 위치합니다. 기능적으로 동작하지만, 향후 버전 관련 엔드포인트 추가 시 어느 컨트롤러에 배치할지 판단 기준이 모호해질 수 있습니다.
- 제안: 당장 변경할 이슈는 아니나, restore 엔드포인트를 `WorkflowVersionsController`로 이동하면 버전 관련 API가 한 곳에 집중됩니다. 이 경우 `WorkflowVersionsService`에서 직접 `saveCanvas` 로직을 호출하거나 `WorkflowsService`를 `WorkflowVersionsModule`에 주입해야 하므로 **순환 의존 주의** (`WorkflowVersions ↔ Workflows`)가 필요합니다. 현재 구조가 더 안전합니다.

---

**[INFO] 프론트엔드 `diff-utils.ts`가 타입만 임포트**
- 위치: `frontend/src/components/editor/version-history/diff-utils.ts`
- 상세: `@/lib/api/workflows`에서 인터페이스 타입만 임포트하며 런타임 번들에 영향을 주지 않습니다. 순수 유틸리티 함수로 번들 크기 영향이 최소화됩니다.
- 제안: 없음

---

### 요약

이번 변경은 신규 외부 의존성을 전혀 추가하지 않고 기존 스택(TypeORM, NestJS, React Query, Zustand, lucide-react)만으로 워크플로우 버전 이력 기능을 구현했습니다. 내부 모듈 의존 방향도 `WorkflowsModule → WorkflowVersionsModule` 단방향으로 순환 의존이 없고, 프론트엔드 컴포넌트 계층도 기존 패턴을 그대로 따릅니다. 주목할 사항은 `buildSnapshot`이 불필요하게 `public`으로 노출된 점(내부 API 표면 확장 위험)과, 버전 생성이 트랜잭션 외부에서 호출되어 실패 시 버전 누락이 발생할 수 있다는 점입니다. 두 가지 모두 즉각적인 장애를 일으키지는 않으나, `buildSnapshot`의 가시성 수정은 간단하고 효과가 명확하므로 권장합니다.

### 위험도

**LOW**