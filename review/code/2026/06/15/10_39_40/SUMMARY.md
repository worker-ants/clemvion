# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 인가(Authorization) 검증 누락 가능성, 이전 PR(form-validation-minmax-pattern) 구현의 비의도적 revert 혼입, 유저 가이드 미갱신이 주요 우려 사항. 핵심 기능(WorkflowTestDataset CRUD+clone) 구현 자체는 spec 과 높은 일치도를 보임.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 인증/인가 | `visibility='workspace'` 데이터셋 반환 시 요청 유저의 워크스페이스 멤버십 검증 누락 가능성. `workspace_id` 를 아는 것만으로 타 워크스페이스 공유 데이터셋에 접근 가능한 IDOR 위험 | `workflow-test-datasets.service.ts` — list/findOne 경로 (서비스 코드 diff omitted) | list/findOne 쿼리에서 요청 유저가 해당 workspace_id 의 구성원인지 확인하거나 RLS/Guard 레이어에서 워크스페이스 멤버십 검증 |
| W-2 | 인증/인가 | `clone` 엔드포인트에서 소스 데이터셋 접근 권한 미검증 가능성 — `datasetId` 를 알면 권한 없는 private 데이터셋 복제(IDOR) 위험 | `POST /test-datasets/:datasetId/clone`, `workflow-test-datasets.service.ts` | clone 핸들러에서 소스 데이터셋 조회 시 `owner_id = requestUser OR (visibility = 'workspace' AND workspace_id = userWorkspace)` 조건 강제 |
| W-3 | 요구사항 / 기능 결함 | `copyName` JSDoc 이 "(Copy 2)" 재시도 로직을 약속하나 구현은 단순 `(Copy)` suffix 추가만 하여 두 번째 clone 시도부터 409 반환 — 의도-구현 불일치 | `workflow-test-datasets.service.ts` L206-L211 `copyName()` | copyName 을 async 로 전환하여 충돌 시 번호 증가 재시도 구현, 또는 JSDoc 을 "충돌 시 409 DUPLICATE_NAME 반환, 재시도는 클라이언트 책임" 으로 수정 |
| W-4 | 변경 범위 / 요구사항 | `FormModalField.min?/max?/pattern?` 삭제 + `execution-engine.service.ts` docstring 롤백 + `spec-sync-form-gaps.md` 체크박스 `[ ]` 복귀 + 이전 PR 리뷰 산출물 전량 삭제 — 이전 PR(form-validation-minmax-pattern) 구현이 현 PR에서 revert 된 것으로 보이나 이유가 어디에도 명시되지 않음 | `codebase/backend/src/modules/chat-channel/types.ts`, `execution-engine.service.ts`, `plan/in-progress/spec-sync-form-gaps.md`, `review/code/2026/06/14/22_49_26/` 및 `23_05_30/` 전체 삭제 | revert 의도 여부 확인. 비의도적이면 `FormModalField min?/max?/pattern?` 필드·검증 로직·체크박스 복원. 의도적이면 plan 에 근거 기록 및 별도 PR로 분리 |
| W-5 | 변경 범위 | 이전 PR review/ 산출물 전량 삭제 및 `plan/complete/form-validation-minmax-pattern.md` 삭제가 현 §2.2 구현 PR에 혼입 — 현 작업과 무관한 파일 삭제로 추적성 손실 | `review/code/2026/06/14/22_49_26/`, `review/code/2026/06/14/23_05_30/`, `review/consistency/2026/06/14/22_22_50/`, `plan/complete/form-validation-minmax-pattern.md` | 현 PR에서 해당 삭제를 제외하거나 별도 cleanup PR로 분리. 삭제가 불가피하면 커밋 메시지에 사유 명시 |
| W-6 | API 계약 | `list` 엔드포인트에 페이지네이션 없이 전체 행 반환 — JSONB `input` 컬럼 포함 대용량 응답 가능, 미래 클라이언트가 페이지네이션 없음을 계약으로 가정할 수 있음 | `workflow-test-datasets.controller.ts` L48-68, `workflow-test-datasets.service.ts` L73-90 | 단기: 서버 측 `take(N)` 상한 추가. 중장기: `?limit=&offset=` 파라미터 도입 및 응답 래핑, 또는 목록 응답에서 `input` 필드 제외 |
| W-7 | API 계약 | `clone` 엔드포인트 Swagger 에 `@ApiConflictResponse` 없음 — API 계약 문서 불완전 | `workflow-test-datasets.controller.ts` L124-141 | `@ApiConflictResponse({ description: '동일 이름 복제본 이미 존재' })` 추가 |
| W-8 | 유저 가이드 | "Run with Input" 다이얼로그에 Datasets 패널(저장·불러오기·공유·clone·삭제) 신설됐으나 `running-a-workflow.{mdx,en.mdx}` 에 관련 안내 전무 — visibility 개념·clone 필요성 등 비직관적 UX | `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` 및 `.en.mdx` | Save as Dataset 흐름, Datasets 드롭다운 사용법, visibility(private/workspace), 공유본 Clone, Delete(소유자 전용) 내용을 추가 |
| W-9 | 부작용 | `FormModalField` 타입에서 min?/max?/pattern? 필드만 제거되고 `form-mode.ts` 내 관련 검증 로직이 잔존할 경우 해당 필드가 항상 `undefined` 가 되어 검증 무력화 위험 (`form-mode.ts` diff 가 생략되어 직접 확인 불가) | `codebase/backend/src/modules/chat-channel/types.ts`, `form-mode.ts` (diff omitted) | `form-mode.ts` 와 `form-mode.spec.ts` 의 실제 diff 를 확인하여 타입 삭제와 검증 로직 제거가 원자적으로 함께 처리됐는지 검증 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 보안 | `data JSONB` 컬럼 저장 페이로드 크기 제한 없음 — DoS 위험 낮으나 존재 | `V097__workflow_test_dataset.sql`, `CreateWorkflowTestDatasetDto` | DTO 에 JSON 직렬화 크기 상한(예: 64KB) 또는 NestJS 글로벌 Body Size Limit 재확인 |
| I-2 | 보안 | `PATCH`/`DELETE /test-datasets/:id` 의 소유자 검증 — 서비스 코드 diff 미포함으로 직접 확인 불가 | `workflow-test-datasets.controller.ts`, `workflow-test-datasets.service.ts` | `update`/`remove` 에서 `WHERE id = :id AND owner_id = :userId` 조건 또는 `ForbiddenException` 패턴 확인 |
| I-3 | 성능 | `list`·`create` 마다 `assertWorkflow` 선행 SELECT — DB 왕복 2회 발생 | `workflow-test-datasets.service.ts` L78, L98 | JOIN/EXISTS 서브쿼리로 1회 왕복으로 통합 가능 |
| I-4 | 성능 | `list()` 가 JSONB `input` 컬럼 포함 전체 컬럼 조회 — 페이지네이션 없이 전체 행 메모리 적재 | `workflow-test-datasets.service.ts` L79-88 | 목록 응답 DTO 에서 `input` 제외 또는 `.take(200)` 소프트 리미트 |
| I-5 | 아키텍처 | `WorkflowTestDatasetsModule` 이 `WorkflowsModule` 내부 서비스 대신 `Workflow` 엔티티 레포지토리를 직접 참조 — 묵시적 도메인 경계 결합 | `workflow-test-datasets.module.ts` | `WorkflowsModule` 에서 제한된 인터페이스를 exports 하고 imports 하는 방식으로 모듈 경계 명시화 (현 규모에서 즉시 필수 아님) |
| I-6 | 아키텍처 | `TestDatasetVisibility` 타입이 프론트엔드-백엔드에 중복 정의 | `frontend/src/lib/api/workflow-test-datasets.ts`, `backend/entities/workflow-test-dataset.entity.ts` | `codebase/packages/` 공유 패키지로 이전 (장기 부채) |
| I-7 | 아키텍처 | 엔티티 속성명 `input` 과 DB 컬럼명 `data` 불일치 — TransformInterceptor 이중 래핑 방지 목적이나 레이어 결합도 증가 | `entities/workflow-test-dataset.entity.ts` L489 | 현 상태 허용(JSDoc 설명 충분). 근본 해결은 `TransformInterceptor` 개선 |
| I-8 | 유지보수성 | `EditorToolbar` 컴포넌트 850+ 줄 — 이번 변경으로 상태·핸들러 추가되어 책임 누적(기존 부채) | `editor-toolbar.tsx` 전체 | 장기적으로 `useDatasetFeature` 커스텀 훅 또는 `DatasetPicker`/`SaveDatasetForm` 서브컴포넌트로 분리 |
| I-9 | 테스팅 | 컨트롤러 레벨 단위 테스트 부재 — `@Roles('editor')` 가드·파이프 등 컨트롤러 계층 미검증 (기존 모듈과 패턴 불일치) | `workflow-test-datasets.controller.ts` | `workflow-test-datasets.controller.spec.ts` 추가 |
| I-10 | 테스팅 | `remove` 소유자 happy-path, `clone` 자기 소유 private 복제, e2e `update`/`remove` 성공 경로 미검증 | `workflow-test-datasets.service.spec.ts`, `workflow-test-dataset.e2e-spec.ts` | 각 케이스 추가 (우선순위 낮음) |
| I-11 | 테스팅 | 프론트엔드 테스트에서 clone/delete UI 흐름 및 저장 실패 토스트 케이스 부재 | `editor-toolbar-run-input.test.tsx` | `dsCloneMock`/`dsRemoveMock` 호출 케이스 및 실패 토스트 케이스 추가 |
| I-12 | DB | `list()` 쿼리 OR 조건이 기존 인덱스 선두 컬럼과 불일치 — 대규모 데이터 시 쿼리 플랜 비효율 가능 | `V097__workflow_test_dataset.sql` 인덱스, `service.ts` list() | EXPLAIN ANALYZE 확인 후 필요 시 `(workflow_id, workspace_id)` 복합 인덱스 추가 |
| I-13 | 문서화 | `spec-sync-form-gaps.md` 체크박스 `[ ]` 복귀 근거 미기술, `update` 메서드 JSDoc 누락, `UpdateWorkflowTestDatasetDto.input` description 불일치 | `plan/in-progress/spec-sync-form-gaps.md`, `workflow-test-datasets.ts`, `update-workflow-test-dataset.dto.ts` | 각 파일에 한 줄 근거/설명 추가 |
| I-14 | API 계약 | `list` 응답이 다른 엔드포인트와 달리 래핑 없이 배열 직접 반환 — TransformInterceptor 동작 일관성 확인 필요 | `workflow-test-datasets.controller.ts` L56-58 | 프로젝트 전반 목록 응답 패턴 확인 후 Swagger 문서 일치 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 워크스페이스 멤버십 검증 누락 가능성(W-1), clone IDOR(W-2), PATCH/DELETE 소유자 검증 확인 필요(I-2) |
| performance | LOW | assertWorkflow 이중 쿼리(I-3), input 컬럼 전체 조회(I-4) — 모두 INFO 수준 |
| architecture | LOW | 모듈 경계 묵시적 결합(I-5), 타입 중복(I-6), 컬럼/속성명 불일치(I-7) |
| requirement | MEDIUM | copyName JSDoc-구현 불일치(W-3), form-validation revert 의도 불명(W-4) |
| scope | MEDIUM | 이전 PR review/plan 산출물 삭제 혼입(W-5), form validation revert 범위 이탈(W-4) |
| side_effect | MEDIUM | FormModalField 타입만 제거 시 검증 로직 잔존 위험(W-9), review 산출물 삭제 추적성 손실 |
| maintainability | LOW | EditorToolbar 책임 누적 기존 부채(I-8), findAccessible boolean 파라미터 가독성 |
| testing | LOW | 컨트롤러 단위 테스트 부재(I-9), 일부 happy-path/UI 흐름 미검증(I-10, I-11) |
| documentation | LOW | spec-sync-form-gaps.md 근거 미기술(I-13), 일부 JSDoc 누락 |
| database | LOW | list() 인덱스 매칭 확인 필요(I-12), copyName 재시도 로직 부재는 기능 결함 |
| api_contract | LOW | 페이지네이션 없음(W-6), clone Swagger 불완전(W-7), URL 네임스페이스 혼재 |
| user_guide_sync | WARNING | running-a-workflow.{mdx,en.mdx} 갱신 누락 — Datasets 기능 전체 미문서화(W-8) |

---

## 발견 없는 에이전트

없음. 모든 에이전트에서 발견사항 존재.

---

## 권장 조치사항

1. **(즉시 — 보안)** `list`/`findOne` 경로에서 `visibility='workspace'` 레코드 반환 시 요청 유저의 워크스페이스 멤버십 검증 여부 서비스 코드 직접 확인 및 누락 시 수정 (W-1).
2. **(즉시 — 보안)** `clone` 핸들러 내 소스 데이터셋 접근 권한 검증 (`owner_id = requestUser OR visibility='workspace' AND workspace_id = userWorkspace`) 확인 및 누락 시 수정 (W-2).
3. **(즉시 — 부작용)** `form-mode.ts` diff 를 직접 확인하여 `FormModalField` 타입 삭제와 검증 로직 제거가 원자적으로 처리됐는지 검증. 로직 잔존 시 즉시 제거 또는 타입 복원 (W-9).
4. **(중요 — revert 의도 확인)** `FormModalField min?/max?/pattern?` · `execution-engine.service.ts` docstring · `spec-sync-form-gaps.md` 체크박스 역전이 의도적인지 확인. 비의도적 rebase 충돌이면 main rebase 후 복원; 의도적이면 plan 에 근거 기록 및 별도 PR 분리 (W-4).
5. **(중요 — 범위)** 이전 PR review/plan 산출물 삭제를 현 PR 에서 제외하거나 별도 cleanup PR 로 분리. 불가피하면 커밋 메시지에 사유 명시 (W-5).
6. **(중요 — 기능)** `copyName` JSDoc 을 실제 구현("충돌 시 409 반환, 재시도 없음")에 맞게 수정하거나, "(Copy 2)" 번호 증가 재시도 로직을 구현하여 clone UX 보장 (W-3).
7. **(중요 — 유저 가이드)** `running-a-workflow.{mdx,en.mdx}` 에 Datasets 기능(저장·불러오기·visibility·clone·delete) 섹션 추가 (W-8).
8. **(개선 — API)** `list` 엔드포인트에 서버 측 `take(200)` 소프트 리미트 추가 및 clone 핸들러에 `@ApiConflictResponse` 추가 (W-6, W-7).
9. **(개선 — 테스팅)** 컨트롤러 단위 테스트 파일 추가, `remove`/`clone` happy-path 및 e2e update/remove 케이스 보완 (I-9, I-10).
10. **(장기 — 아키텍처)** `TestDatasetVisibility` 공유 패키지 이전, `EditorToolbar` 서브컴포넌트 분리, `TransformInterceptor` 근본 개선으로 컬럼/속성명 통일 (I-6, I-7, I-8).

---

## 라우터 결정

라우터가 선별함 (routing_status=done).

- **실행** (12명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터에 의해 제외 |
  | concurrency | 라우터에 의해 제외 |

- **강제 포함 (router_safety)** (8명): database, documentation, maintainability, requirement, scope, security, side_effect, testing