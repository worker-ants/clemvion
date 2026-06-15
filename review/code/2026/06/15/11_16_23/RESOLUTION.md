# RESOLUTION — 11_16_23

fresh ai-review (2026-06-15 11:16:23) 의 2차 조치 결과. 1차 fix commit `60635810` 에 이어 이번 commit `e7b491c9` 로 마무리.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드 | e7b491c9 | `@ApiOkResponse` → `ApiOkWrappedArrayResponse` — 런타임 `{ data: [...] }` 래핑과 Swagger 스키마 정합 |
| W-2 | 비조치 | — | flat `/test-datasets/:id` 경로는 datasetId 가 전역 고유 PK 라 workflowId 불필요. auth-configs 등 선례 동일 패턴. spec §9 에 두 경로 모두 명시 → 의도적 설계로 accept |
| W-3 | 코드 | e7b491c9 | service.spec — `remove` 소유자 성공 → `datasetRepo.remove` 호출 검증 케이스 추가 |
| W-4 | 코드 | e7b491c9 | service.spec — `update` 대상 없음(`findOne`→null) → `NotFoundException` 케이스 추가 |
| W-5 | 비조치 | — | `list` QueryBuilder 조건 검증 — `andWhere` 에 `owner_id = :userId OR` 포함 단언이 기존 테스트(L129)에 이미 있어 추가 가치 낮음. accept |
| W-6 | 코드 | e7b491c9 | service.spec — `update` 23505 → `ConflictException` 케이스 추가 |
| W-7 | 코드 | e7b491c9 | service.spec — `clone` 소유자 self(private) 성공(isOwner=true) 케이스 추가 |
| W-8 | 코드 | e7b491c9 | frontend — `dsCloneMock`/`dsRemoveMock` 실사용 (Clone 버튼 → dsCloneMock, Delete 버튼 → dsRemoveMock), empty state("No saved datasets") 렌더 검증 추가 |
| W-9 | 비조치 | — | `handleSaveDataset` 빈 이름 guard — `datasetName.trim() === ""` 시 함수 초반에 return + Save 버튼 `disabled` 처리 이미 구현(L784-788). 커버리지 추가 가치 낮음. accept |
| W-10 | 비조치 | — | `findAccessible` boolean trap — Maintainability. 범위 대비 위험도 낮음. defer |
| W-11 | 비조치 | — | `EditorToolbar` 컴포넌트 비대화 — Maintainability. defer |
| W-12 | 비조치 | — | `copyName` 매직 넘버 — Maintainability. defer |
| W-13 | 코드 | e7b491c9 | `plan/complete/form-validation-minmax-pattern.md` 을 `origin/main` 으로 복원 — 이전 fix commit(60635810)이 추가한 `spec_impact` frontmatter 제거 (scope 회귀). **주의**: Gate C 단위 테스트(`spec-plan-completion.test.ts`)가 이 파일의 `spec_impact` 부재로 1건 실패하는데, 이는 PR #610 이 merge 될 때부터 main 에서도 동일하게 실패하는 **pre-existing** 문제다. 본 PR 의 책임 범위 밖. |
| W-14 | 코드+spec | e7b491c9 | `spec/3-workflow-editor/3-execution.md` §9 clone 행에 "동일 이름 복제본 이미 존재 시 409 DUPLICATE_NAME" 구절 추가. 컨트롤러의 `@ApiConflictResponse` 는 1차 fix(60635810)에서 이미 추가됨. |
| W-15 | 비조치 | — | `handleSaveDataset` JSON.parse stale state — Side Effect. 런타임 `jsonError` 실시간 검증이 선행 방어하므로 실제 도달 경로 없음. defer |
| I-16 (W-16) | 코드 | e7b491c9 | PATCH `@ApiOperation` description `data` → `input` 으로 수정 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4401 passed, 1 skipped) — Gate C 1건 실패는 pre-existing (form-validation-minmax-pattern.md §spec_impact 미선언 — PR #610 소유)
- e2e   : 통과 (199/199) — `workflow-test-dataset.e2e-spec.ts` invariant G(DELETE) 포함 전 케이스 통과

## 보류·후속 항목

- **W-2 (URL flat 경로)**: 의도적 설계. flat `/test-datasets/:id` 가 spec §9 에 명시됨. 변경 불필요.
- **W-5 (list QueryBuilder 격리 단언)**: 기존 테스트에 부분 단언 존재. 추가 보강 defer.
- **W-9 (빈 이름 guard 테스트)**: 구현이 이미 커버. defer.
- **W-10 (boolean trap)**: Maintainability. 향후 리팩토링 시 처리.
- **W-11 (컴포넌트 비대화)**: Maintainability. 향후 `useDatasetPanel` 훅 추출 고려.
- **W-12 (매직 넘버)**: Maintainability. 향후 상수화.
- **W-15 (JSON.parse stale state)**: 실질 도달 없음. defer.
- **Gate C pre-existing 실패**: `plan/complete/form-validation-minmax-pattern.md` 에 `spec_impact` 미선언. PR #610 follow-up 에서 처리 필요.
- **fresh /ai-review 권고**: fix commit(e7b491c9)이 11_16_23 review 를 stale 화 → main 이 fresh `/ai-review` 1회 더 수행 필요.
