# 요구사항(Requirement) 리뷰 — workflow-test-dataset

**대상 스펙**: `spec/3-workflow-editor/3-execution.md §2.2` / `spec/1-data-model.md §2.13.3`
**리뷰 일시**: 2026-06-15

---

## 발견사항

### [INFO] `list` 쿼리의 "워크스페이스 공유본" 필터 — visibility=workspace 조건이 workspace_id 제약 없이 적용

- 위치: `workflow-test-datasets.service.ts` lines 83–93
- 상세: `list` 쿼리는 `d.workspace_id = :workspaceId` 와 `(d.owner_id = :userId OR d.visibility = :workspace)` 를 조합한다. 이 조합은 "같은 워크플로우 + 같은 워크스페이스 내에서 내 것 또는 workspace 공유본" 을 정확히 필터한다. workspace_id 조건이 visibility=workspace 행에도 자동 적용되므로 논리적으로 올바르다. 그러나 `assertWorkflow` 가 workflow+workspace 교차를 검증한 뒤 쿼리가 다시 `workspace_id` 로 재필터하는 것은 방어적 이중검증으로 의도적이다. 문제 없음.

### [INFO] `findAccessible` — requireOwner=false 경로의 "내 private 소유본" 접근 허용

- 위치: `workflow-test-datasets.service.ts` lines 130–151
- 상세: `!isOwner && entity.visibility !== WORKSPACE` 일 때만 404 를 던진다. 따라서 소유자가 자신의 private 데이터셋을 clone 하는 경우(self-clone)도 허용된다. 이는 서비스 주석 "조회 가능한(내 것 or 공유본)" 설명과 일치하며 테스트(`소유자 self-clone(private 본인 소유) 성공`)도 존재한다. 올바른 동작.

### [INFO] `copyName` 에서 기존 " (Copy)" suffix 중복 처리 없음

- 위치: `workflow-test-datasets.service.ts` lines 219–224
- 상세: `copyName("이름 (Copy)")` 는 `"이름 (Copy) (Copy)"` 를 생성한다. 서비스 JSDoc 과 사용자 문서(en.mdx, ko.mdx Callout)가 "이미 같은 이름 존재 시 409 — 이름을 바꿔서 다시 Clone" 으로 명시하여 이를 클라이언트 책임으로 위임했다. spec §2.2 / R-2.2 어디에도 suffix 중복 방지 의무가 없어 현 구현은 spec 부합.

### [INFO] `entity.ts` — visibility 컬럼에 TypeORM `enum` 타입 미사용

- 위치: `workflow-test-dataset.entity.ts` lines 51–56
- 상세: `type: 'varchar', length: 20` 로 선언하고, DB 수준 CHECK constraint(`V097` 마이그레이션)로 값 범위를 제한한다. TypeORM `{ type: 'enum', enum: TestDatasetVisibility }` 패턴을 쓰지 않은 것은 PostgreSQL native `ENUM` DDL 변경의 번거로움을 피하는 일반적인 프로젝트 선택이다. spec 은 컬럼 타입을 "Enum" 으로만 명시할 뿐 TypeORM 구현 방식을 강제하지 않으므로 위반 아님.

### [INFO] e2e invariant E — 테스트가 403/404 모두 허용

- 위치: `workflow-test-dataset.e2e-spec.ts` line 2098
- 상세: cross-workspace `PATCH` 시 `expect([403, 404]).toContain(res.status)` 로 두 상태를 모두 허용한다. 실제 서비스 로직에서는 `findAccessible` 의 `where: { id, workspaceId }` 필터가 타 워크스페이스 데이터셋을 찾지 못해 404 를 반환하고, 403 은 발생하지 않는다. 테스트가 404 만 기대해도 충분하지만, 두 상태 허용은 거짓 통과를 일으키지 않으며 spec 에도 명시 규정이 없다. 보완 권장이나 차단 불필요.

### [INFO] 프론트엔드 `handleLoadDataset` — `d.input ?? {}` 로드 시 null 방어

- 위치: `editor-toolbar.tsx` line 2537
- 상세: `workflowTestDatasetsApi` 응답 타입 `WorkflowTestDatasetData.input` 은 `Record<string, unknown>` (non-nullable)이므로 `?? {}` 는 엄밀히 중복 방어이지만 무해하다. 런타임 안전성 관점에서 허용.

### [INFO] `spec/1-data-model.md` §2.13.3 제목 — "2.13.3" 이나 직전 섹션은 "2.13.2"

- 위치: `spec/1-data-model.md` 라인 511
- 상세: 리뷰 대상 변경(파일 23)에서 `§2.13.3 WorkflowTestDataset` 를 `§2.13.2 ExecutionToken` 바로 다음에 삽입했다. 기존 `§2.14 NodeExecution` 이 이어지므로 번호 체계상 공백 없이 자연스럽다. plan 에서 "data-model §2.13.2 동기화" 라고 표기했으나 실제 spec 파일에는 §2.13.3 으로 삽입됐다. plan 체크박스 설명 텍스트만의 소소한 불일치이며 코드/spec 동작에 영향 없음.

---

## 요약

코드 변경은 spec/3-workflow-editor/3-execution.md §2.2 (테스트 데이터셋 저장/이름 지정) 와 R-2.2 (권한·소유 모델) 에서 명시한 기능을 완전하게 구현했다. 데이터 모델(V097 마이그레이션 + TypeORM 엔티티), 백엔드 서비스(CRUD + clone + 소유자 전용 수정/삭제 + workspace 격리 + UNIQUE 위반 → 409), 컨트롤러(API 경로 spec §9 일치, Editor+ 권한), 프론트엔드 API 클라이언트, Mock Input 다이얼로그 UI(데이터셋 목록·저장·복제·삭제), i18n(en/ko), e2e 시나리오(7개 invariant), unit 테스트가 모두 spec 의 행위 명세·필드 정의·에러 코드·권한 모델과 line-level 로 일치한다. 발견된 항목은 모두 INFO 수준(spec 에 명시 없는 edge 처리 방식 또는 테스트 안전망 개선 권장)으로 기능 정확성 또는 spec 위반을 시사하지 않는다.

## 위험도

NONE
