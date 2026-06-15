# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 테스트 커버리지 갭(서비스 브랜치 미검증·프론트엔드 dead mock)과 API 계약 불일치(Swagger 래핑 스키마, URL 계층 비일관성)가 복합적으로 존재하며, 이는 회귀 위험 및 클라이언트 오작동으로 이어질 수 있다. 보안·DB·기능 정합성은 양호하다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract | `GET /workflows/:workflowId/test-datasets` 목록 응답 Swagger 스키마가 실제 런타임 래핑(`{ data: [...] }`)과 불일치 — `@ApiOkResponse` 네이티브 데코레이터 사용 | `workflow-test-datasets.controller.ts` L973–976 | `ApiOkWrappedResponse(WorkflowTestDatasetDto, { isArray: true })` 커스텀 데코레이터로 교체 |
| 2 | API Contract | PATCH/DELETE/clone 엔드포인트가 `/test-datasets/:id` flat 경로 사용 — 생성·목록(`/workflows/:workflowId/test-datasets`)과 URL 계층 비일관성 | `workflow-test-datasets.controller.ts` `@Patch` / `@Delete` / `@Post(...clone)` | `/workflows/:workflowId/test-datasets/:id` 통합 형식으로 통일하거나 flat 경로를 spec 에 명시적으로 기록 |
| 3 | Testing | `remove` 성공 케이스 단위 테스트 없음 — `datasetRepo.remove` 호출 검증 누락 | `workflow-test-datasets.service.spec.ts` `describe('remove')` | 소유자 remove → `datasetRepo.remove` 호출 검증 케이스 추가 |
| 4 | Testing | `update` 404 케이스(데이터셋 미존재) 단위 테스트 없음 — `findOne` null 반환 시 NotFoundException 경로 미검증 | `workflow-test-datasets.service.spec.ts` `describe('update')` | `datasetRepo.findOne.mockResolvedValue(null)` 후 NotFoundException 검증 케이스 추가 |
| 5 | Testing | `list` QueryBuilder의 `where`/`andWhere` 조건 검증 부재 — workspaceId 격리 누락 시 cross-workspace 데이터 노출 버그를 단위 테스트가 탐지 불가 | `workflow-test-datasets.service.spec.ts` (~L1405) | `qb.where` / `qb.andWhere` 인자 개별 검증 또는 `workspaceId` 파라미터 바인딩 `expect.objectContaining` 단언 추가 |
| 6 | Testing | `update` 중복 이름(23505→409) 단위 테스트 없음 | `workflow-test-datasets.service.spec.ts` | update 경로에서 23505 에러 → ConflictException 검증 케이스 추가 |
| 7 | Testing | `clone` 소유자 self-clone 성공 케이스 없음 — `isOwner=true`일 때 정상 실행 경로 미검증 | `workflow-test-datasets.service.spec.ts` `describe('clone')` | `ownerId === userId` + `visibility=private` 소유자 clone 성공 케이스 추가 |
| 8 | Testing | 프론트엔드 테스트: 빈 목록(empty state) UI 미검증, clone/delete 버튼 핸들러 미검증 — `dsCloneMock`·`dsRemoveMock` 선언만 되고 실제 단언에 미사용(dead mock) | `editor-toolbar-run-input.test.tsx` | empty state 렌더 검증, Clone/Delete 버튼 클릭 → mock 호출 검증 케이스 추가 |
| 9 | Testing | 프론트엔드 테스트: `handleSaveDataset` JSON 유효성 에러·빈 이름 guard 분기 미검증 | `editor-toolbar-run-input.test.tsx` | 빈 이름 상태에서 Save 버튼 disabled 검증 케이스 추가 |
| 10 | Maintainability | `findAccessible(id, ws, uid, true/false)` boolean trap — 호출부에서 의도 파악 불가 | `workflow-test-datasets.service.ts` L1813–1847 | 유니온 타입 `'owner' \| 'accessible'` 파라미터 또는 별도 private 메서드(`findForOwner` / `findForReadAccess`)로 분리 |
| 11 | Maintainability | `EditorToolbar` 컴포넌트에 데이터셋 state 5개 + 핸들러 4개 추가 — 단일 컴포넌트 책임 비대화 | `editor-toolbar.tsx` L81 영역 | `useDatasetPanel(workflowId)` 커스텀 훅으로 추출 |
| 12 | Maintainability | `copyName`의 `' (Copy)'`와 `255` 매직 넘버 하드코딩 — DTO·SQL·서비스 3곳에 분산 | `workflow-test-datasets.service.ts` L1914–1918 | `DATASET_NAME_MAX_LENGTH = 255` · `CLONE_SUFFIX = ' (Copy)'` 상수화 후 참조 통일 |
| 13 | Scope | `plan/complete/form-validation-minmax-pattern.md` 에 이번 PR 무관한 `spec_impact` frontmatter 추가 | `/plan/complete/form-validation-minmax-pattern.md` | 이번 PR 에서 변경 제거; 필요 시 별도 fix 커밋으로 분리 |
| 14 | Requirement | `clone` 시 소유자 자신의 private 데이터셋 재복제 → 409 처리를 클라이언트에 위임 — spec §2.2 에 clone 충돌 처리 미명시로 정책 결정 명시성 부족 | `workflow-test-datasets.service.ts` `clone()` L1777–1793, `copyName()` L1914–1918 | clone endpoint 의 409 응답 시나리오(소유자 재복제)를 OpenAPI description 또는 spec 에 명시 |
| 15 | Side Effect | `handleSaveDataset` 내 `JSON.parse` — `jsonError` stale state 엣지 케이스에서 parse 예외 발생 시 catch 블록으로 처리되며 원인이 콘솔에만 기록 | `editor-toolbar.tsx` `handleSaveDataset` | catch 에서 `error instanceof SyntaxError` 별도 분기 후 더 구체적인 사용자 메시지 제공 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `input` JSONB 필드 크기 제한 없음 — 반복 대형 JSON 저장으로 DB I/O·메모리 부하 가능 | `create-workflow-test-dataset.dto.ts`, `V097__workflow_test_dataset.sql` | 글로벌 request body size limit(NestJS `body-parser`) 또는 커스텀 파이프로 최대 바이트 제한 |
| 2 | Security | `ownerId` UUID 응답 노출 — 클라이언트에 불필요한 내부 식별자 제공 가능성 | `workflow-test-dataset-response.dto.ts` | 클라이언트 요구사항 재검토 후 불필요하면 제거 또는 선택적 포함 |
| 3 | Security | `update`/`remove`/`clone`에 `assertWorkflow` 미호출 — 간접 격리(findAccessible WHERE 절)에만 의존 | `workflow-test-datasets.service.ts` | 명시적 주석 또는 e2e E 케이스를 변이 동사 전체에 추가 |
| 4 | Security | `@WorkspaceId()` 데코레이터의 JWT 클레임 대조 여부 불확인 | `workflow-test-datasets.controller.ts` | guard 가 workspaceId 헤더를 JWT 클레임과 교차 검증하는지 확인 |
| 5 | Security | 에러 메시지의 내부 code 키 응답 노출 — 의도적 설계라면 문서화 필요 | `workflow-test-datasets.service.ts` 전체 예외 throw | 전역 exception filter 에서 code 노출·은닉 방식 통일 또는 코드베이스 표준 확인 |
| 6 | Requirement | list 쿼리 workspaceId 격리가 visibility 필터보다 우선하는 의도가 주석 없어 혼동 가능 | `workflow-test-datasets.service.ts` L85–90 | 선택적으로 "workspaceId 격리가 visibility 필터보다 우선" 주석 추가 |
| 7 | Requirement | e2e E 케이스 `expect([403, 404]).toContain(res.status)` — 서비스 로직상 항상 404이므로 단언 범위 과도 | `workflow-test-dataset.e2e-spec.ts` L~2215 | 코드 경로 확인 후 `expect(res.status).toBe(404)` 로 단언 강화 고려 |
| 8 | Requirement | `@IsOptional()` 과 `@IsNotEmpty()` decorator 순서 불일치 (동작에는 문제없음) | `update-workflow-test-dataset.dto.ts` | `@IsOptional()` 을 맨 위에 두는 팀 관례 통일 |
| 9 | Database | `list()` 200행 소프트 리밋 — 초과 시 클라이언트가 잘림 여부를 감지 불가 | `workflow-test-datasets.service.ts` `.take(200)` | 응답에 `truncated: true` 플래그 또는 `X-Total-Count` 헤더 추가 |
| 10 | Database | QueryBuilder에서 DB 컬럼명 raw 리터럴 사용(`d.owner_id` 등) — TypeORM 엔티티 속성명으로 통일하면 컬럼명 변경 시 버그 방지 | `workflow-test-datasets.service.ts` `list()` andWhere 절 | `d.ownerId` 등 entity 속성명 기반으로 변경 |
| 11 | Database | `updated_at` 자동 갱신 트리거 마이그레이션 부재 — ORM 우회 직접 UPDATE 시 불일치 발생 가능 | `V097__workflow_test_dataset.sql` | 직접 DB UPDATE 허용 환경이면 `set_updated_at()` 트리거 추가 고려 |
| 12 | Maintainability | `typeorm` 이중 import 문 (`Repository`, `QueryFailedError` 분리) | `workflow-test-datasets.service.ts` L1701–1703 | `import { Repository, QueryFailedError } from 'typeorm'` 로 통합 |
| 13 | Maintainability | `WorkflowTestDatasetDto` 클래스명과 파일명(`-response.dto.ts`) 접두 불일치 | `workflow-test-dataset-response.dto.ts` | `WorkflowTestDatasetResponseDto` 로 통일하거나 파일명에서 `-response` 제거 |
| 14 | Maintainability | e2e `create` 헬퍼가 `workflowId`를 클로저로 캡처 — 다중 워크플로우 테스트 시 재사용 어려움 | `workflow-test-dataset.e2e-spec.ts` | `create(token, body, ws?, wfId?)` 형태로 파라미터화 |
| 15 | Maintainability | 프론트 `update` body 타입이 `Partial<CreateTestDatasetBody>` 재활용 — 백엔드 UpdateDto와 의미 괴리 | `workflow-test-datasets.ts` | `UpdateTestDatasetBody` 인터페이스 별도 선언 |
| 16 | Documentation | 컨트롤러 PATCH `@ApiOperation` description 에서 API 필드명 `input` 을 DB 컬럼명 `data` 로 잘못 표기 | `workflow-test-datasets.controller.ts` `update` 핸들러 | `'name·input·visibility 부분 갱신. 소유자가 아니면 403.'` 으로 수정 |
| 17 | Documentation | `spec/1-data-model.md §2.x` 모호 참조 — 실제 섹션 번호 불명 | `V097__workflow_test_dataset.sql` 헤더, `workflow-test-dataset.entity.ts` JSDoc | 실제 섹션 번호로 교체 |
| 18 | Documentation | e2e 파일 헤더에 `DELETE` 커버한다고 기술하나 실제 케이스 없음 — 문서·테스트 불일치 | `workflow-test-dataset.e2e-spec.ts` 파일 상단 JSDoc | 헤더에서 DELETE 줄 제거 또는 invariant G 추가 |
| 19 | Documentation | `WorkflowTestDatasetsModule` 클래스에 JSDoc 없음 | `workflow-test-datasets.module.ts` | 한 줄 주석으로 역할·spec 링크 추가 |
| 20 | Documentation | `create` 메서드 JSDoc 누락 (다른 메서드는 모두 있음) | `workflow-test-datasets.service.ts` | `/** 새 테스트 데이터셋을 저장한다. 항상 요청 유저 소유, 기본 private. */` 추가 |
| 21 | Testing | e2e DELETE 소유자 성공 케이스 없음 (invariant G 부재) | `workflow-test-dataset.e2e-spec.ts` | 소유자 DELETE 후 목록에서 제거됨을 확인하는 케이스 추가 권장 |
| 22 | Testing | `copyName` 255자 경계값 단위 테스트 없음 | `workflow-test-datasets.service.spec.ts` | clone 케이스에 248자 이상 이름 경계값 검증 추가 |
| 23 | API Contract | 409 Conflict 에러 바디 `code: DUPLICATE_NAME` 이 Swagger 스키마에 노출 안 됨 | `workflow-test-datasets.controller.ts` `@ApiConflictResponse` | description 에 `code: DUPLICATE_NAME` 명시 또는 에러 응답 DTO 별도 정의 |
| 24 | Side Effect | SQL 마이그레이션 DOWN 스크립트가 주석으로만 존재 — 롤백 시 수동 실행 필요 | `V097__workflow_test_dataset.sql` L74–75 | 팀 운영 지침에 DOWN 경로 명확히 문서화 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 전반적으로 견고. IDOR 방어·TypeORM 파라미터 바인딩 양호. INFO 5건 (JSONB 크기 제한, ownerId 노출 등) |
| requirement | LOW | 모든 spec 항목(API 경로·응답코드·권한모델·스키마)이 코드와 일치. WARNING 1건(clone 충돌 정책 명시성), INFO 4건 |
| scope | LOW | 이번 기능 범위 내 파일 정확. 무관 파일 1건(plan/complete/form-validation-minmax-pattern.md) WARNING |
| side_effect | LOW | 전역 상태·외부 서비스 영향 없음. handleSaveDataset JSON.parse stale state 엣지 WARNING 1건 |
| maintainability | LOW | NestJS 모듈 구조 양호. boolean trap·컴포넌트 비대화·매직 넘버 WARNING 3건 |
| testing | MEDIUM | 서비스 브랜치(remove 성공·update 404·self-clone 등) 미커버. 프론트 dead mock. WARNING 7건 |
| documentation | LOW | 전반 양호. @ApiOperation `data` 오표기 외 INFO 5건 |
| database | LOW | 마이그레이션 안전·인덱스·FK·N+1 없음 모두 양호. INFO 3건 |
| concurrency | — | 출력 파일 미존재 (파일 시스템 오류) — 재시도 필요 |
| api_contract | MEDIUM | 목록 Swagger 래핑 불일치·URL 계층 비일관성 WARNING 2건. 기존 API breaking change 없음 |
| user_guide_sync | NONE | i18n ko/en parity·MDX 동반 갱신 완충족. 누락 없음 |

---

## 발견 없는 에이전트

- **user_guide_sync**: 매트릭스 19개 행 전체 검토 — 동반 갱신 누락 없음 (NONE)

---

## 권장 조치사항
1. **(W-1) Swagger 래핑 불일치 수정**: `list` 핸들러의 `@ApiOkResponse` 를 `ApiOkWrappedResponse(WorkflowTestDatasetDto, { isArray: true })` 로 교체 — 클라이언트 코드 생성 오작동 방지
2. **(W-3~W-7) 서비스 단위 테스트 보완**: `remove` 성공·`update` 404·`update` 409·`clone` self-clone 성공 케이스 추가 — 회귀 탐지 능력 확보
3. **(W-8~W-9) 프론트엔드 테스트 보완**: dead mock(`dsCloneMock`·`dsRemoveMock`) 활성화, clone/delete 버튼 이벤트 및 empty state UI 검증 추가
4. **(W-5) list WorkspaceId 격리 단언 강화**: `where`/`andWhere` 조건 개별 검증으로 cross-workspace 버그 탐지 능력 확보
5. **(W-2) URL 계층 정합**: PATCH/DELETE/clone 경로를 `/workflows/:workflowId/test-datasets/:id` 로 통합하거나 flat 경로 설계를 spec 에 명시적 기록
6. **(W-10) boolean trap 제거**: `findAccessible` 네 번째 인자를 유니온 타입 또는 분리 메서드로 교체
7. **(W-13) 무관 파일 제거**: `plan/complete/form-validation-minmax-pattern.md` 변경을 이번 PR 에서 제외
8. **(W-11~W-12) 상수화 + 훅 추출**: `DATASET_NAME_MAX_LENGTH`·`CLONE_SUFFIX` 상수 선언 및 EditorToolbar → `useDatasetPanel` 훅 추출
9. **(I-16) ApiOperation description 오표기 수정**: `data` → `input` 으로 즉시 수정
10. **(I-18) e2e 파일 헤더 DELETE 언급 정합**: 헤더 수정 또는 invariant G 추가

---

## 라우터 결정

`routing_status=done` (router 가 선별):

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (11명)
- **제외**: 3명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 제외 |
  | architecture | 라우터 제외 |
  | dependency | 라우터 제외 |

- **강제 포함(router_safety)**: `database`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명)