# Code Review 통합 보고서

리뷰 대상: workflow-test-datasets 모듈 신설 (spec/3-workflow-editor/3-execution.md §2.2)
리뷰 일시: 2026-06-15 11:53:35
리뷰어: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database(파일 없음), concurrency, api_contract, user_guide_sync

---

## 전체 위험도

**MEDIUM** — 테스트 품질 결함(e2e DB 연결 누수, 서비스 spec 인자 오류) 및 컴포넌트 비대화가 중기 CI 안정성·유지보수에 영향을 줄 수 있음. 기능 구현 자체의 spec 충실도·보안·아키텍처는 양호.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Testing | e2e 테스트 `afterAll` 에서 `db.end()` 누락 — CI 환경에서 pg Client 연결 누수·테스트 프로세스 hang 위험 | `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` `beforeAll` | `afterAll(async () => { await db.end(); });` 추가 |
| W-2 | Testing | 서비스 spec `update` 호출 인자 오류 — 첫 번째 인자로 dataset id 대신 workflow id(`WF`)를 전달. 현재는 mock 반환값으로 통과하나 리팩토링 시 오탐/미탐 유발 | `workflow-test-datasets.service.spec.ts` L1412–1414 | `service.update('ds-1', WS, OWNER, ...)` 로 수정 후 `findOne` 호출 인자 검증 assertion 추가 |
| W-3 | Testing | e2e 테스트 B/D/F 케이스 — 같은 `workflowId`/`ownerToken` 조합으로 고정 이름 데이터셋 반복 생성 시 잔류 데이터와 409 충돌 가능성 | `workflow-test-dataset.e2e-spec.ts` 케이스 B·D·F | `uniqueName()` 유틸 적용 또는 케이스별 고유 이름 prefix 사용 |
| W-4 | Testing | 컨트롤러 단위 테스트 부재 — `ParseUUIDPipe` 잘못된 UUID → 400 응답, 데코레이터 바인딩, `@HttpCode(204)` 등이 서비스 spec 으로 커버되지 않음 | `workflow-test-datasets.controller.ts` 전체 | `workflow-test-datasets.controller.spec.ts` 신설 또는 e2e 에서 UUID 무효 케이스 추가 |
| W-5 | Testing | 프론트엔드 `update` API 호출 경로 미테스트 — `workflowTestDatasetsApi.update()` 정합성 검증 없음 | `workflow-test-datasets.ts`, `editor-toolbar-run-input.test.tsx` | update API 클라이언트 단위 테스트 추가 (현 PR 에서 UI 미사용이면 INFO 수준) |
| W-6 | Architecture | `WorkflowTestDatasetsModule` 이 `WorkflowsModule` 경계를 우회해 `Workflow` Repository 를 `forFeature` 직접 등록 — 모듈 경계 약결합 위반 | `workflow-test-datasets.module.ts` line 4, `workflow-test-datasets.service.ts` line 10 | `WorkflowsModule` 이 `WorkflowsService.assertExists` 를 export 하면 해당 서비스 위임으로 교체. 코드베이스 전반 관행이면 INFO 강등 가능 |
| W-7 | Side Effect | `update()` 에서 entity 객체 직접 변이(mutation) 후 `saveUnique` — UNIQUE 위반 예외 시 entity 인스턴스가 부분 변이 상태로 잔류 | `workflow-test-datasets.service.ts` L1741–1743 | `Object.assign({}, entity, updateFields)` shallow copy 후 save 하거나 partial object 직접 전달 패턴 사용 |
| W-8 | Requirement | e2e 테스트 E(IDOR) — `expect([403, 404]).toContain(res.status)` 로 403 과 404 모두 PASS 허용. 실제 경로에서 403 은 불가능하므로 테스트가 실제 동작을 과도 허용 | `workflow-test-dataset.e2e-spec.ts` L2206 | `expect(res.status).toBe(404)` 로 단정 |
| W-9 | Maintainability | `editor-toolbar.tsx` 에 데이터셋 상태 5개 + 핸들러 4개 추가로 컴포넌트 비대화 심화 — 단일 책임 원칙 이탈 경향 | `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` | `useDatasetManager` 커스텀 훅 또는 `DatasetPanel` 서브컴포넌트로 중기 추출 권장 |
| W-10 | Documentation | 컨트롤러 JSDoc 의 `[Spec 인증 §3.2]` 참조가 파일 경로 없이 텍스트만 제공 — 다른 파일의 전체 경로 명시 패턴과 불일치 | `workflow-test-datasets.controller.ts` L951–955 | `spec/1-authentication.md §3.2` (또는 실제 경로) 형식으로 변경 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Security | JSONB `input` 필드 크기 제한 없음 — 소프트 DoS 가능성 (실질 영향 낮음, body-parser 설정 확인 필요) | `create-workflow-test-dataset.dto.ts`, `update-workflow-test-dataset.dto.ts` | JSON.stringify 기준 64–128 KB 상한 커스텀 validator 또는 body-parser limit 문서화 |
| I-2 | Security | `ownerId` 응답 DTO 노출 — UUID 자체는 민감 정보 아니나 불필요한 내부 식별자 누출 가능성 | `workflow-test-dataset-response.dto.ts` | `isOwner` 필드만으로 대체 가능 여부 검토 |
| I-3 | Security | `@WorkspaceId()` 데코레이터가 헤더 값 단순 passthrough 인지 JWT/DB 기반 멤버십 검증인지 확인 필요 | `workflow-test-datasets.controller.ts`, `workflow-test-datasets.service.ts` | `Roles('editor')` 가드가 JWT claim 또는 DB 조회로 워크스페이스 멤버십 검증하는지 확인 |
| I-4 | Performance | `list()` 에서 `assertWorkflow` 선행 SELECT 추가 RTT | `workflow-test-datasets.service.ts` `list()` | 404 의미 분리가 필요하면 현행 유지, 불필요하면 단일 쿼리로 통합 |
| I-5 | Performance | `findAccessible` — `remove` 경로에서도 JSONB 전체 컬럼 SELECT | `workflow-test-datasets.service.ts` `findAccessible()` | `select: { id, ownerId, workspaceId, visibility }` 최소 컬럼 조회 옵션 추가 |
| I-6 | Performance | list() 200행 상한 시 JSONB 대량 전송 가능성 | `workflow-test-datasets.service.ts` `.take(200)` | `CHECK (pg_column_size(data) <= 65536)` 추가 또는 summary/detail 응답 분리 검토 |
| I-7 | Performance | TanStack Query `staleTime` 미설정 — 데이터셋 피커 반복 개폐 시 매번 재요청 | `editor-toolbar.tsx` `datasetsQuery` | `staleTime: 30_000` 설정 |
| I-8 | Performance | `handleSaveDataset` 내 `JSON.parse(jsonInput)` 중복 파싱 | `editor-toolbar.tsx` `handleSaveDataset` | 파싱 결과 state 캐싱 또는 이미 검증된 parsed 값 참조 |
| I-9 | Architecture | `findAccessible` 의 `requireOwner: boolean` — 향후 가시성 모델 확장 시 enum 교체 필요 | `workflow-test-datasets.service.ts` `findAccessible` | 레벨 3개 이상 확장 시 `AccessPolicy` 타입 도입 |
| I-10 | Architecture | `data`(DB 컬럼) vs `input`(엔티티 속성) 불일치 — 의도적이나 QueryBuilder raw SQL 시 혼동 가능 | `workflow-test-dataset.entity.ts` L50 | 현행 주석 수준으로 충분 |
| I-11 | Architecture | `workspace_id` 비정규화 — `workflow.workspace_id` 변경 시 stale 가능성 | `V097__workflow_test_dataset.sql`, entity | 워크플로우 워크스페이스 이동 불가 도메인 제약이면 문제없음 |
| I-12 | Requirement | plan 파일 `§2.13.2` → `§2.13.3` 참조 오타 | `plan/in-progress/spec-sync-execution-gaps.md` L3545 | `§2.13.2` → `§2.13.3` 정정 |
| I-13 | Side Effect | ON DELETE CASCADE 로 workflow/user/workspace 삭제 시 데이터셋 연쇄 삭제 — 기존 삭제 경로 e2e 미커버 | `V097__workflow_test_dataset.sql` | 기존 삭제 e2e 에 데이터셋 정리 검증 케이스 추가 권고 |
| I-14 | Side Effect | `WorkflowsModule` 미 import 시 `Workflow` subscriber/listener 부재 가능성 — 현재는 단순 조회만으로 무해 | `workflow-test-datasets.module.ts` | `Workflow` 에 subscriber 추가 시 재검토 |
| I-15 | Maintainability | `typeorm` import 2줄 분리 (`Repository`, `QueryFailedError`) | `workflow-test-datasets.service.ts` L7–8 | `import { Repository, QueryFailedError } from 'typeorm';` 로 병합 |
| I-16 | Maintainability | `copyName` 에서 255 상수가 entity 컬럼 선언과 별도 하드코딩 | `workflow-test-datasets.service.ts` `copyName` | `NAME_MAX_LENGTH = 255` 공유 상수로 단일 진실화 |
| I-17 | Maintainability | 프론트엔드 API `update` 메서드 body 타입 `Partial<CreateTestDatasetBody>` 재사용 | `workflow-test-datasets.ts` `update` | `UpdateTestDatasetBody` 명시적 인터페이스 분리 |
| I-18 | Maintainability | 데이터셋/히스토리 피커 JSX 구조 중복 | `editor-toolbar.tsx` dataset/history picker | 세 번째 패널 추가 시 `PickerPanel` 공용 컴포넌트 추출 |
| I-19 | Testing | `copyName` 255자 경계값 테스트 누락 | `workflow-test-datasets.service.spec.ts` | `clone` describe 에 경계값 케이스 추가 |
| I-20 | Testing | `saveUnique` 비-23505 DB 에러 재전파 테스트 누락 | `workflow-test-datasets.service.spec.ts` | 일반 에러 throw 시 동일 에러 전파 테스트 추가 |
| I-21 | Testing | 프론트엔드 `shareWorkspace=true` 저장 경로 미테스트 | `editor-toolbar-run-input.test.tsx` | 체크박스 toggle 케이스 + `visibility: "workspace"` 호출 검증 |
| I-22 | Testing | `toastSuccess`/`toastError` mock 정의만 있고 호출 assert 없음 | `editor-toolbar-run-input.test.tsx` | 각 성공 테스트에 `expect(toastSuccess).toHaveBeenCalled()` 추가 |
| I-23 | API Contract | PATCH/DELETE/clone 경로 flat vs list/create nested — spec §9 의도적 설계 | `workflow-test-datasets.controller.ts` | OpenAPI description 에 URL 구조 선택 rationale 추가 |
| I-24 | API Contract | 목록 API 200행 소프트 상한 미노출 | `workflow-test-datasets.controller.ts` | `@ApiOkWrappedArrayResponse` description 에 "최대 200개" 명시 |
| I-25 | API Contract | `@ApiUnauthorizedResponse` list 에만 선언, 나머지 엔드포인트 누락 | `workflow-test-datasets.controller.ts` | 나머지 핸들러 또는 클래스 레벨 공통 데코레이터 추가 |
| I-26 | API Contract | `clone` `@ApiNotFoundResponse` description 이 다른 워크스페이스 케이스 미포함 | `workflow-test-datasets.controller.ts` L1040–1060 | `'없음, 비공유, 또는 다른 워크스페이스'` 로 업데이트 |
| I-27 | User Guide Sync | `DUPLICATE_NAME`/`FORBIDDEN` 에러 코드 `backend-labels.ts` `ERROR_KO` 미등록 | `backend-labels.ts` | `editor-toolbar.tsx` 에러 처리 경로 확인 후 필요 시 한국어 메시지 추가 |
| I-28 | Documentation | 서비스 `create`/`remove` 공개 메서드 JSDoc 블록 없음 | `workflow-test-datasets.service.ts` | 패턴 일관성 위해 추가 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | JSONB 크기 제한 없음(I-1), `@WorkspaceId()` 서버 검증 여부 확인 필요(I-3) |
| performance | LOW | `findAccessible` JSONB 전체 로딩(I-5), `assertWorkflow` 선행 RTT(I-4), TanStack Query `staleTime` 미설정(I-7) |
| architecture | LOW | `WorkflowsModule` 경계 우회 `Workflow` repo 직접 등록(W-6) |
| requirement | LOW | e2e 테스트 E `[403,404]` 과도 허용(W-8), plan 파일 섹션 번호 오타(I-12) |
| scope | NONE | 범위 일탈 없음 |
| side_effect | LOW | entity 직접 변이 후 save(W-7), ON DELETE CASCADE 기존 테스트 미커버(I-13) |
| maintainability | LOW | `editor-toolbar.tsx` 컴포넌트 비대화(W-9), `copyName` 상수 중복(I-16) |
| testing | MEDIUM | e2e `afterAll db.end()` 누락(W-1), 서비스 spec `update` 인자 오류(W-2), 이름 충돌 취약성(W-3), 컨트롤러 spec 부재(W-4) |
| documentation | LOW | 컨트롤러 JSDoc spec 링크 불완전(W-10) |
| dependency | NONE | 신규 외부 패키지 없음, 기존 패턴 준수 |
| database | N/A | output_file 부재 — 결과 미수신 (재시도 필요 1건) |
| concurrency | NONE | await 누락·데드락·공유 상태 오남용 없음 |
| api_contract | LOW | Swagger 401 데코레이터 부분 누락(I-25), NotFound description 세분화(I-26) |
| user_guide_sync | LOW | 매트릭스 3개 trigger 충족, `DUPLICATE_NAME` `ERROR_KO` 미등록 주의(I-27) |

---

## 발견 없는 에이전트

- **scope**: 범위 일탈 없음 — 23개 변경 파일 모두 §2.2 기능 직접 구성 요소
- **dependency**: 신규 외부 패키지 없음, 내부 의존성 위험 없음
- **concurrency**: 동시성 결함 없음 — 표준 NestJS async 패턴 준수

---

## 권장 조치사항

1. **[W-1] e2e `afterAll` `db.end()` 추가** — CI pg 연결 누수·hang 방지. `afterAll(async () => { await db.end(); });` 1줄.
2. **[W-2] 서비스 spec `update` 인자 오류 수정** — `service.update('ds-1', WS, OWNER, ...)` 교정 + `findOne` 호출 인자 assertion 추가.
3. **[W-3] e2e 이름 충돌 방지** — 케이스 B·D·F 에 `uniqueName()` 또는 케이스별 고유 prefix 적용.
4. **[W-8] e2e 테스트 E IDOR 어설션 강화** — `expect([403,404]).toContain(...)` → `expect(res.status).toBe(404)`.
5. **[W-7] `update()` entity 직접 변이 방지** — `Object.assign({}, entity, updateFields)` shallow copy 후 save.
6. **[W-4] 컨트롤러 단위 테스트 신설** — `ParseUUIDPipe` 잘못된 UUID → 400 케이스 최소 포함.
7. **[W-6] 모듈 경계 정비 검토** — `WorkflowsModule` export 여부 확인 후 `WorkflowsService.assertExists` 위임 교체 (코드베이스 관행 우선 확인).
8. **[W-9] `editor-toolbar.tsx` 데이터셋 로직 분리** — 중기 리팩터링으로 `useDatasetManager` 훅 또는 `DatasetPanel` 서브컴포넌트 추출.
9. **[W-10] 컨트롤러 JSDoc spec 링크 정정** — `[Spec 인증 §3.2]` → 실제 파일 경로 형식.
10. **[I-27] `DUPLICATE_NAME` `ERROR_KO` 등록 검토** — `editor-toolbar.tsx` 에러 처리 경로 확인 후 필요 시 `backend-labels.ts` 한국어 메시지 추가.

---

## 라우터 결정

라우터 미사용 — `routing=fallback-all`. 전체 reviewer 실행.

- **실행** (14명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync
- **강제 포함(router_safety)** (8명): database, documentation, maintainability, requirement, scope, security, side_effect, testing
- **제외**: 없음
- **비고**: `database` reviewer 는 강제 포함 목록에 있었으나 output_file 이 부재하여 결과 수신 실패 — 재시도 필요 1건.