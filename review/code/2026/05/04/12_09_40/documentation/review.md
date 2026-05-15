## 발견사항

---

**[INFO]** 컨트롤러 파일에 가드 제거 이유 미기재
- 위치: `alerts.controller.ts`, `auth-configs.controller.ts`, `folders.controller.ts`, `integrations.controller.ts`, `graph.controller.ts`, `knowledge-base.controller.ts`, `llm-config.controller.ts`, `schedules.controller.ts`, `triggers.controller.ts`, `workflow-assistant.controller.ts`, `workflows.controller.ts` (총 11개)
- 상세: `@UseGuards(RolesGuard)` 가 제거된 이유(전역 APP_GUARD 로 이관)에 대한 설명이 어느 컨트롤러에도 없다. `app.module.ts` 의 주석과 `workspaces.module.ts` 의 주석이 근거를 제공하지만, 해당 파일을 보지 않은 개발자는 실수로 제거된 것으로 오해하고 재추가할 수 있다.
- 제안: 대표 컨트롤러 하나에라도 `// RolesGuard는 AppModule APP_GUARD로 전역 등록됨 — 별도 UseGuards 불필요` 형태의 주석을 남기거나, 또는 현재의 `app.module.ts` 주석에 파일 경로 참조를 추가

---

**[INFO]** `transferOwnership` 엔드포인트에 `@Roles` 데코레이터 부재
- 위치: `workspaces.controller.ts`, `transferOwnership` 메서드
- 상세: 다른 쓰기 엔드포인트는 `@Roles('editor')` 또는 `@Roles('admin')` 으로 명시하는 반면, `transferOwnership` 은 `@Roles` 없이 서비스 레이어에서만 권한 검증을 수행한다. Swagger 에 `@ApiForbiddenResponse({ description: '권한 부족 (Owner 필요)' })` 와 summary 의 `(Owner)` 로 일부 표현되어 있으나, 코드 패턴이 불일치해 왜 데코레이터가 없는지 불명확하다.
- 제안: 메서드 상단에 `// @Roles 미적용 — owner 검증은 서비스 레이어의 requesterMembership.role 검증으로 수행` 주석 추가. 또는 일관성을 위해 `@Roles('owner')` 데코레이터 추가 후 서비스 내 중복 검증 제거

---

**[INFO]** `workflows.controller.spec.ts` — `WorkspacesService` 제거 사유 미기재
- 위치: `workflows.controller.spec.ts`, 두 `describe` 블록의 providers 섹션
- 상세: `WorkspacesService` 모킹이 제거된 이유(RolesGuard 가 더 이상 컨트롤러 단위로 등록되지 않으므로 DI 불필요)가 주석 없이 삭제되었다. 테스트만 읽는 개발자는 왜 이 서비스 모킹이 필요 없는지 추적이 어렵다.
- 제안: 각 `beforeEach` 상단에 `// RolesGuard가 전역 APP_GUARD로 이관되어 테스트 모듈에서 WorkspacesService 모킹 불필요` 짧은 주석 추가

---

**[INFO]** `workspaces.module.ts` 주석의 DI 의존 관계 방향이 불명확
- 위치: `workspaces.module.ts` 상단 주석 (`RolesGuard 는 AppModule 의 APP_GUARD 로 등록되어 전역에서 동작한다. WorkspacesService 만 @Global 로 export 해두면 RolesGuard 의 DI 가 해결된다.`)
- 상세: 주석이 올바른 사실을 담고 있으나, "왜 WorkspacesService export 가 RolesGuard DI 해결에 필요한가"(RolesGuard 가 WorkspacesService 에 의존하기 때문)라는 인과관계가 생략되어 있다.
- 제안: `WorkspacesService 만 @Global 로 export 해두면 RolesGuard(WorkspacesService 에 의존)의 DI 가 해결된다.` 로 한 구 추가

---

**[INFO]** `transfer-ownership.dto.ts` 파일 수준 JSDoc — 양호
- 위치: `transfer-ownership.dto.ts` 상단 블록 주석
- 상세: 대상 제약(같은 워크스페이스의 비-owner), 동작(트랜잭션 내 role swap), 사용 맥락을 잘 설명한다. 추가 조치 불필요.

---

**[INFO]** `workspaces.service.ts` — `transferOwnership` JSDoc — 양호
- 위치: `workspaces.service.ts`, `transferOwnership` 메서드 JSDoc
- 상세: caller 제약, personal 워크스페이스 제한, 트랜잭션 + FOR UPDATE 락, 역할 swap 동작을 모두 기술한다. 서비스 메서드 수준 문서화 품질이 전반적으로 코드베이스 내 가장 높다.

---

**[INFO]** spec 및 PRD 문서 업데이트 — 완전
- 위치: `spec/2-navigation/9-user-profile.md`, `prd/5-non-functional.md`, `plan/stages/05-rbac-enforcement.md`
- 상세: API 목록, UI 와이어프레임, 권한 매트릭스, NF-SC-02 상태 갱신이 모두 이번 변경을 정확히 반영한다. spec 문서의 API 테이블에 새 엔드포인트(`POST /api/workspaces/:id/transfer-ownership`)와 제약이 명시되어 있다.

---

## 요약

이번 변경은 RolesGuard 전역 등록 리팩토링 + Owner 이양 기능 구현이라는 두 축으로 이루어진다. 아키텍처 수준 문서화(app.module.ts 주석, workspaces.module.ts 주석, spec/PRD/plan 갱신)는 잘 되어 있으나, 11개 컨트롤러에서 `@UseGuards(RolesGuard)` 가 일괄 제거된 사유가 개별 파일에 남아있지 않아 향후 유지보수 시 혼란 가능성이 있다. `transferOwnership` 엔드포인트가 다른 엔드포인트와 달리 `@Roles` 데코레이터 없이 서비스 레이어 검증에 의존하는 패턴 불일치도 인라인 주석으로 명시할 필요가 있다. i18n 키, DTO JSDoc, 서비스 메서드 JSDoc 품질은 양호하다.

## 위험도

**LOW**