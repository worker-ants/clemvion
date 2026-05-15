### 발견사항

---

**[WARNING] `saveCanvas` 트랜잭션 경계 외부에서 버전 생성 — 원자성 보장 불완전**
- 위치: `workflows.service.ts` — `saveCanvas` 메서드, diff +305~+313
- 상세: 캔버스 저장(트랜잭션) 완료 후 `workflowVersionsService.createVersion()`이 트랜잭션 외부에서 호출됩니다. 캔버스 저장은 성공했는데 버전 생성이 실패하면 버전 없는 캔버스 상태가 됩니다. spec 9절에서 "다음 저장에서 자동으로 따라잡힌다"고 허용하고 있으나, 이는 비즈니스 불변식을 서비스 계층에서 보장하지 않고 운영 우연성에 의존하는 구조입니다.
- 제안: `createVersion` 실패 시 로깅 + 무시(best-effort) 처리임을 코드 주석으로 명시하거나, 별도 이벤트 기반 접근(도메인 이벤트 발행 → 버전 생성 리스너)으로 책임을 분리하세요.

---

**[WARNING] `WorkflowsService`가 `WorkflowVersionsService`에 직접 의존 — 단방향 의존성 위반 위험**
- 위치: `workflows.module.ts`, `workflows.service.ts`
- 상세: `WorkflowsModule`이 `WorkflowVersionsModule`을 import하고, `WorkflowsService`가 `WorkflowVersionsService`를 직접 주입받습니다. `restoreVersion`은 내부적으로 다시 `saveCanvas`를 호출합니다. 현재는 순환 의존성이 없지만, `WorkflowVersionsService`가 미래에 `WorkflowsService`를 참조하게 되면 순환이 발생합니다. 두 모듈이 서로를 알아야 하는 구조적 압력이 생겼습니다.
- 제안: 버전 생성/복원 로직을 `WorkflowVersioningService` 또는 도메인 이벤트 핸들러로 분리하여 `Workflows ↔ WorkflowVersions` 간 직접 참조를 제거하세요.

---

**[WARNING] `buildSnapshot`이 `public` 메서드 — 캡슐화 위반**
- 위치: `workflows.service.ts` diff +337
- 상세: `buildSnapshot`은 `WorkflowsService`의 내부 직렬화 로직임에도 `public`으로 선언되어 외부 호출이 가능합니다. 테스트 파일에서도 직접 사용하지 않으므로 의도적으로 public일 이유가 없습니다.
- 제안: `private buildSnapshot(...)`으로 변경하세요.

---

**[WARNING] `restoreVersion`이 `saveCanvas`를 재호출 — 복원 경로의 레이어 오염**
- 위치: `workflows.service.ts` diff +316~+340
- 상세: `restoreVersion`이 `saveCanvas`를 내부 호출하는 구조는 복원 동작에 캔버스 검증 로직(manual trigger 필수, label unique 검사 등)을 함께 강제합니다. 스냅샷은 이미 저장 시점에 검증을 통과한 데이터인데, 복원 시 동일한 검증을 재수행하는 것은 과도한 제약입니다. 만약 스냅샷에 저장됐던 노드 타입이 이후 제거된다면 복원 자체가 불가능해지는 취약성이 있습니다.
- 제안: `restoreVersion` 전용 경로(트랜잭션 직접 실행)를 별도로 두거나, 검증을 스킵할 수 있는 내부 메서드(`applySnapshot`)를 분리하세요.

---

**[INFO] `snapshot` 필드 타입이 `Record<string, unknown>` — 타입 안전성 부재**
- 위치: `workflow-version.entity.ts`, `workflows.service.ts restoreVersion`
- 상세: 엔티티의 `snapshot` 컬럼 타입이 `Record<string, unknown>`으로 선언되어 있고, `restoreVersion`에서는 타입 단언(`as { name?: string; nodes?: unknown[]; edges?: unknown[] }`)으로 접근합니다. 프론트엔드의 `VersionSnapshot` 인터페이스와 중복되며, 백엔드에 공유 타입이 없습니다.
- 제안: 백엔드에 `SnapshotDto` 혹은 인터페이스를 정의하고, `WorkflowVersion.snapshot` 타입에 적용하세요. `as unknown[]` 캐스팅 없이 안전하게 접근할 수 있습니다.

---

**[INFO] 버전 번호 경쟁 조건(Race Condition) 가능성**
- 위치: `workflow-versions.service.ts` — `createVersion`
- 상세: 최신 버전 조회(`getOne`) 후 `nextVersion = latest.version + 1`로 계산하는 사이에 다른 요청이 동일 버전을 생성하면 `(workflowId, version)` UNIQUE 제약 위반이 발생합니다. 현재는 단일 사용자 편집 모델이라 실제 발생 가능성은 낮지만, 협업 편집 확장 시 문제가 됩니다.
- 제안: DB 시퀀스 또는 `INSERT ... SELECT MAX(version)+1 ... WHERE workflow_id = ?` 방식의 원자적 버전 증가로 교체하세요.

---

**[INFO] `WorkflowVersionsController`가 workspace 권한 검증 없음**
- 위치: `workflow-versions.controller.ts`
- 상세: `GET /workflows/:wfId/versions`와 `GET /workflows/:wfId/versions/:versionId`는 `wfId`만 받고 workspace 소속 여부를 검증하지 않습니다. 인증된 사용자라면 다른 워크스페이스의 버전 이력에 접근 가능합니다. `WorkflowsController`의 다른 엔드포인트들은 `@WorkspaceId()` 데코레이터로 workspace 검증을 수행합니다.
- 제안: `findByWorkflow`, `findOne`에 `workspaceId` 파라미터를 추가하고 `WorkflowsService.findById(wfId, workspaceId)`로 소유권 검증 후 버전을 반환하세요.

---

**[INFO] `RestoreConfirmDialog`가 `window.location.reload()` 직접 호출**
- 위치: `restore-confirm-dialog.tsx`
- 상세: 복원 성공 후 `window.location.reload()`를 직접 호출합니다. 이는 컴포넌트가 브라우저 전역 객체에 직접 의존하여 테스트가 어렵고(실제 테스트에서도 `window.location` mocking이 필요), 향후 Next.js App Router의 `router.refresh()`나 에디터 스토어의 상태 재초기화 방식으로 교체하기 어렵습니다.
- 제안: `onRestored?: () => void` prop을 통해 상위에서 reload 동작을 주입하거나, `editorStore`에 `reloadFromServer` 액션을 추가하세요.

---

**[INFO] `DiffSection` 컴포넌트의 빈 섹션 필터링 로직이 불안정**
- 위치: `version-diff-dialog.tsx` — `DiffSection`
- 상세: `items.filter(Boolean)` 로 빈 섹션을 숨기는 로직은 children이 React 엘리먼트 배열일 때 동작하지만, 단일 엘리먼트나 Fragment가 전달될 경우 예상과 다르게 동작합니다.
- 제안: `children` 대신 `items: T[]` prop을 직접 받아 길이 기반으로 렌더링 여부를 판단하세요.

---

### 요약

이번 변경은 워크플로우 버전 이력 기능을 전체 스택(DB 엔티티 → 서비스 → API → 프론트엔드 컴포넌트)에 걸쳐 일관성 있게 구현했으며, spec과의 정합성도 높습니다. 그러나 아키텍처 관점에서 핵심 우려 사항은 두 가지입니다. 첫째, `saveCanvas` 트랜잭션 외부에서 버전을 생성하는 구조는 원자성 보장이 없으며 이를 운영 허용 정책으로 선언해두었지만 코드에 명시적 의도가 없습니다. 둘째, `WorkflowsService → WorkflowVersionsService` 직접 의존 + `restoreVersion`이 `saveCanvas`를 재호출하는 패턴은 두 모듈 간 양방향 압력을 생성하여 향후 순환 의존성 위험과 검증 로직 충돌을 일으킬 수 있습니다. 그 외 `WorkflowVersionsController`의 workspace 권한 검증 누락은 보안 관점에서 반드시 처리가 필요합니다.

### 위험도

**MEDIUM**