# Code Review 통합 보고서

**리뷰 세션**: `review/code/2026/06/15/12_10_03`
**대상**: `exec-test-dataset-22` — `workflow-test-dataset` §2.2 구현 (신규 엔티티·모듈·프론트엔드 UI)
**리뷰어**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract (11명 전원 success)

---

## 전체 위험도

**MEDIUM** — 인덱스 설계와 직렬 쿼리 패턴이 데이터 증가 시 성능 위험을 내포. 보안·기능·요구사항 충족 수준은 양호. 구조적·문서적 개선 과제 다수는 WARNING 수준.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 보안 | `data` JSONB 컬럼에 크기 제한 없음 — 대용량 페이로드 DoS 가능 | `create-workflow-test-dataset.dto.ts` L21–25; `V097__workflow_test_dataset.sql` L15 | DTO에 `@MaxJsonBytes(1_048_576)` 커스텀 데코레이터 + DB CHECK constraint `pg_column_size(data) < 1048576` 추가 |
| W-2 | 보안 | 프론트엔드 오류 핸들러에서 `console.error`로 에러 객체 전체 출력 — 내부 정보 노출 가능 | `editor-toolbar.tsx` L573/L597/L612 | 프로덕션 환경에서 구조화 로거(Sentry 등) 사용 또는 `error.message` 만 기록 |
| W-3 | 성능 | `list()`/`create()`에서 `assertWorkflow` 와 실제 쿼리가 순차 직렬 실행 — RTT 2회 | `workflow-test-datasets.service.ts` `list()` / `create()` | JOIN/EXISTS 서브쿼리로 1-쿼리 통합 또는 `Promise.all` 병렬화 |
| W-4 | 성능 | `list()` WHERE 패턴(`workflow_id AND workspace_id AND (owner_id OR visibility)`)이 현재 인덱스 구조와 불일치 | `V097__workflow_test_dataset.sql` L65–69; `workflow-test-datasets.service.ts` `list()` | `(workflow_id, workspace_id, updated_at DESC)` 복합 인덱스 추가 |
| W-5 | 아키텍처 | `findAccessible(requireOwner: boolean)` boolean 플래그 파라미터 — 정책 확장 시 OCP 위반 위험 | `workflow-test-datasets.service.ts` L1652–1686 | `findAsOwner` / `findAsAccessible` 분리 또는 `accessMode: 'owner' \| 'readable'` 유니온 타입으로 교체 |
| W-6 | 아키텍처 | `EditorToolbar` 컴포넌트에 데이터셋 관련 상태 5개·핸들러 5개 추가 — SRP 약화 | `editor-toolbar.tsx` L81–131, L539–620 | `useTestDatasets(workflowId)` 커스텀 훅 또는 `<DatasetPanel>` 서브컴포넌트 분리 |
| W-7 | 유지보수성 | `saveUnique` 내 `QueryFailedError` 코드 추출 타입 단언 중복 + `'23505'` 매직 스트링 | `workflow-test-datasets.service.ts` `saveUnique` | `isUniqueConstraintError(err)` 유틸 추출 + `PG_UNIQUE_VIOLATION = '23505'` 상수 정의 |
| W-8 | 유지보수성 | `copyName` 의 `255` 와 `' (Copy)'` 가 DTO/SQL/서비스 3곳에 분산 | `workflow-test-datasets.service.ts` `copyName`; DTO; `V097` SQL | `DATASET_NAME_MAX_LENGTH = 255`, `CLONE_SUFFIX = ' (Copy)'` 상수 중앙화 |
| W-9 | 테스팅 | 프론트엔드 `workflowTestDatasetsApi.update` 메서드가 UI 미사용·테스트 미적용 dead code | `workflow-test-datasets.ts` `update()`; `editor-toolbar-run-input.test.tsx` | UI 미사용 확정 시 제거 또는 TODO 주석; clone/delete 실패 `toastError` 테스트 추가 |
| W-10 | 테스팅 | 서비스 테스트에서 `update`/`remove` 의 `workspaceId` 격리 필터 assertion 누락 | `workflow-test-datasets.service.spec.ts` `update` / `remove` describe 블록 | `expect(datasetRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS }) }))` 추가 |
| W-11 | API 계약 | 목록 API 소프트 리미트 200이 클라이언트에 불투명 — 잘림 여부 인지 불가 | `workflow-test-datasets.service.ts` `list()` `.take(200)` | 응답에 `meta: { truncated: boolean }` 또는 `X-Total-Count` 헤더 추가 |
| W-12 | API 계약 | `PATCH /test-datasets/:id` 빈 바디 허용 시 no-op 200 반환 — 계약 미명시 | `workflow-test-datasets.service.ts` `update()`; `UpdateWorkflowTestDatasetDto` | `@AtLeastOneField()` validator 로 빈 바디 400 처리 또는 스펙에 "no-op 허용" 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 보안 | `findAccessible` workspace 격리가 헤더 신뢰에 의존 — JWT claim 교차 검증 확인 필요 | `workflow-test-datasets.service.ts` L658–L686 | `@WorkspaceId()` 데코레이터가 JWT claim 기반인지 확인 |
| I-2 | 보안 | `copyName` `slice`가 멀티바이트 문자 경계 미고려 | `workflow-test-datasets.service.ts` L1753–1757 | `Intl.Segmenter` 또는 `MaxLength(255)` 데코레이터 검증 의존 |
| I-3 | 성능 | `findAccessible()` 에서 `data` JSONB 전체 로드 후 JS 레이어 소유권 판단 (`remove` 포함) | `workflow-test-datasets.service.ts` `findAccessible()` | `remove` 경로에 `select: { id, ownerId, visibility, ... }` 적용 |
| I-4 | 성능 | `list()` 200건 JSONB 전체 적재 — Mock Input 크기 제한 미명시 상태에서 잠재적 메모리 위험 | `workflow-test-datasets.service.ts` `list()` | 목록 API에서 `data` 컬럼 제외 또는 spec에 최대 크기 명시 |
| I-5 | 성능 | UNIQUE `(workflow_id, owner_id, name)` 제약과 `(owner_id, workflow_id)` 별도 인덱스 중복 | `V097__workflow_test_dataset.sql` L61–66 | UNIQUE 순서 `(owner_id, workflow_id, name)` 으로 변경해 별도 인덱스 제거 고려 |
| I-6 | 아키텍처 | `WorkflowTestDatasetsModule` 이 `Workflow` 엔티티를 `forFeature` 직접 참조 — 모듈 경계 불명확 | `workflow-test-datasets.module.ts` L1233 | `WorkflowsModule` 에서 `WorkflowExistsGuard` 또는 `assertExists()` export 권장 |
| I-7 | 아키텍처 | `list()` 200 상한이 서비스 코드에 리터럴 박힘 | `workflow-test-datasets.service.ts` L1625 | `const LIST_LIMIT = 200` 상수 추출 |
| I-8 | 아키텍처 | 프론트엔드 API 클라이언트 `update()` 메서드가 현재 UI에서 미사용 | `workflow-test-datasets.ts` L3275–3281 | 향후 인라인 편집 UI 계획이라면 TODO 주석 명시 |
| I-9 | 범위 | `plan/complete/form-validation-minmax-pattern.md` 에 현 PR 범위 외 frontmatter 수정 포함 | `plan/complete/form-validation-minmax-pattern.md` | 무해한 메타데이터 보완이나 수용 여부 확인 |
| I-10 | 데이터베이스 | QueryBuilder 에서 DB 컬럼명 snake_case 직접 참조 (`d.workflow_id` 등) | `workflow-test-datasets.service.ts` `list()` QueryBuilder | `d.workflowId`, `d.workspaceId`, `d.ownerId`, `d.updatedAt` 으로 통일 |
| I-11 | 데이터베이스 | `updated_at` DB 레벨 UPDATE 트리거 부재 — ORM 우회 쿼리 시 미갱신 위험 | `V097__workflow_test_dataset.sql` | 프로젝트 내 다른 테이블 패턴 확인 후 `CREATE TRIGGER set_updated_at` 추가 고려 |
| I-12 | 데이터베이스 | `visibility` CHECK constraint(SQL)와 TypeScript enum 이중 관리 | `V097__workflow_test_dataset.sql`; `workflow-test-dataset.entity.ts` | 값 추가 시 마이그레이션 체크리스트에 두 위치 동기화 명시 |
| I-13 | 테스팅 | `list()` QueryBuilder `workspace_id` andWhere 필터가 서비스 테스트에서 미검증 | `workflow-test-datasets.service.spec.ts` `list` 테스트 | `expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('workspace_id'), ...)` 추가 |
| I-14 | 테스팅 | e2e IDOR assertion `expect([403, 404])` 느슨 — 실제는 404 확정적 | `workflow-test-dataset.e2e-spec.ts` L2317 | `expect(res.status).toBe(404)` 로 확정 또는 의도 주석 명시 |
| I-15 | 테스팅 | e2e `afterAll` 에서 `db.end()` 미호출 — Jest "open handles" 경고 가능 | `workflow-test-dataset.e2e-spec.ts` L1989 | `afterAll(async () => { await db.end(); })` 추가 |
| I-16 | 테스팅 | 프론트엔드 `handleSaveDataset` 오류 경로(toast.error) 테스트 부재 | `editor-toolbar-run-input.test.tsx` | `dsCreateMock.mockRejectedValue(...)` 후 `toastError` 호출 검증 케이스 추가 |
| I-17 | 테스팅 | `copyName` 경계값(248/249자) 테스트 부재 | `workflow-test-datasets.service.ts` `copyName` | 248자·249자 이름 경계 단위 테스트 추가 |
| I-18 | 테스팅 | 컨트롤러 단위 테스트 부재 (`ParseUUIDPipe` 400 검증 등) | `workflow-test-datasets.controller.ts` | 서비스 mock + 컨트롤러 단위 테스트 추가 (낮은 우선순위) |
| I-19 | 문서화 | `WorkflowTestDatasetsModule` 클래스 레벨 JSDoc 없음 | `workflow-test-datasets.module.ts` | 한 줄 JSDoc 추가 |
| I-20 | 문서화 | `create`/`remove` public 메서드 JSDoc 누락 (list/update/clone 은 있음) | `workflow-test-datasets.service.ts` | 각 메서드에 JSDoc 추가 (권한·에러 코드 명시) |
| I-21 | 문서화 | `list` 컨트롤러에 `@ApiForbiddenResponse` 누락; `update`/`remove`/`clone` 에 `@ApiUnauthorizedResponse` 누락 | `workflow-test-datasets.controller.ts` | 컨트롤러 클래스 레벨 공통 선언 또는 누락 핸들러에 개별 추가 |
| I-22 | 문서화 | clone 409 응답 설명에 "이름 suffix 증가 재시도는 클라이언트 책임" 미명시 | `workflow-test-datasets.controller.ts` `@ApiConflictResponse` | Swagger 설명에 재시도 전략 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | JSONB 크기 제한 없음(DoS W-1), 프론트엔드 console.error 정보 노출(W-2) |
| performance | MEDIUM | 직렬 2-쿼리 패턴(W-3), 인덱스와 쿼리 패턴 불일치(W-4) |
| architecture | LOW | `findAccessible` boolean 플래그 OCP 위험(W-5), EditorToolbar SRP 약화(W-6) |
| requirement | NONE | 모든 §2.2 요구사항 완전 충족, 발견 전원 INFO |
| scope | LOW | form-validation plan 범위 외 수정 포함(무해, I-9) |
| side_effect | LOW | ROOT_ENTITIES 추가(정상 패턴), e2e db.end() 누락(I-15) |
| maintainability | LOW | QueryFailedError 타입 단언 중복(W-7), copyName 매직 넘버 분산(W-8) |
| testing | LOW | workspaceId 격리 assertion 누락(W-10), update dead code 미테스트(W-9) |
| documentation | LOW | JSDoc 일부 누락(I-19·I-20), Swagger 데코레이터 일관성 부족(I-21). 전체 문서화 수준 양호 |
| database | LOW | QueryBuilder snake_case 직접 참조(I-10), updated_at 트리거 부재(I-11). 설계·인덱스·N+1은 양호 |
| api_contract | LOW | 목록 API 잘림 불투명(W-11), 빈 PATCH no-op 미명시(W-12) |

---

## 발견 없는 에이전트

없음 — 모든 에이전트에서 발견사항 존재. 단, **requirement** 는 전원 INFO(기능 정확성·스펙 위반 없음).

---

## 권장 조치사항

1. **(W-1) JSONB 크기 제한 추가** — DTO 커스텀 validator + DB CHECK constraint. 보안·성능 겸용 효과.
2. **(W-3 + W-4) 쿼리 최적화** — `list()` 의 `assertWorkflow` 쿼리 병합(1-쿼리) + `(workflow_id, workspace_id, updated_at DESC)` 인덱스 추가 마이그레이션.
3. **(W-10) 서비스 테스트 workspace 격리 assertion 추가** — `findOne` 호출 시 `workspaceId` 인자 포함 여부 검증으로 IDOR 회귀 방지.
4. **(W-5 + W-6) 구조 리팩터링** — `findAccessible` boolean 플래그 → 분리 메서드/유니온 타입; `EditorToolbar` 데이터셋 로직 → `useTestDatasets` 훅 분리.
5. **(W-7 + W-8) 유지보수성 개선** — `isUniqueConstraintError` 유틸 + `PG_UNIQUE_VIOLATION`/`DATASET_NAME_MAX_LENGTH`/`CLONE_SUFFIX` 상수 중앙화.
6. **(W-9) 프론트엔드 `update` dead code 정리** — UI 미사용 확정 시 제거 또는 TODO 주석; clone/delete 오류 경로 테스트 추가.
7. **(W-11 + W-12) API 계약 명확화** — 목록 응답에 `meta.truncated` 추가 또는 스펙 명시; 빈 PATCH 바디 처리 정책 결정 및 명시.
8. **(W-2) 프론트엔드 에러 로깅 개선** — 프로덕션에서 구조화 로거 사용 또는 `error.message` 만 기록.
9. **(I-10) QueryBuilder 컬럼명 통일** — `d.workflow_id` → `d.workflowId` 등 TypeORM 엔티티 속성명으로 교체.
10. **(I-15) e2e `db.end()` 추가** — `afterAll` 에서 DB 연결 정리로 Jest open handles 경고 제거.

---

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (11명)
  - **제외**: 3명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 제외 |
  | concurrency | 라우터 제외 |
  | user_guide_sync | 라우터 제외 |

  - **강제 포함(router_safety)**: `database, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명)