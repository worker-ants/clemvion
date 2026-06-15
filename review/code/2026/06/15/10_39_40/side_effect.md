# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] FormModalField 인터페이스에서 `min?/max?/pattern?` 필드 제거 — 기존 호출자 Breaking Change 가능성
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` (파일 7)
- 상세: 이전 PR(form-validation-minmax-pattern)에서 추가된 `FormModalField.min?`, `max?`, `pattern?` 세 필드가 이번 변경에서 삭제됐다. 이 필드들이 이전 PR에서 이미 프로덕션에 merge/배포된 상태라면, 해당 필드를 참조하는 코드(예: `validateFormSubmission` 내 min/max/pattern 검증 로직, `extractFormFields` 내 추출 로직)가 TypeScript 컴파일 오류 없이 암묵적으로 `undefined`를 받게 된다. 단, 변경 diff 상 `execution-engine.service.ts`의 docstring도 함께 롤백되어("미적용 Planned" 복귀) 검증 로직 자체도 제거된 것으로 추정되나, `form-mode.ts`(파일 5·6)의 실제 diff가 "prompt size limit" 으로 생략되어 `validateFormSubmission`과 `extractFormFields` 내 min/max/pattern 로직이 함께 제거됐는지 직접 확인할 수 없다.
  - 만약 `form-mode.ts` 내 검증 로직은 잔존하는데 `FormModalField` 타입에서만 필드가 제거됐다면, 런타임에 `def.min`, `def.max`, `def.pattern`이 항상 `undefined`가 되어 검증이 무력화되는 의도치 않은 부작용이 발생한다.
  - 반대로 두 파일이 함께 롤백됐다면 하위 호환성은 유지되나, form-mode.spec.ts도 롤백 여부를 확인해야 한다.
- 제안: `form-mode.ts`와 `form-mode.spec.ts`의 실제 diff 내용을 확인해 `types.ts` 필드 삭제와 검증 로직 제거가 원자적으로 함께 처리됐는지 검증할 것.

### [WARNING] `spec-sync-form-gaps.md`에서 `§6.2 min/max·pattern 검증` 항목이 완료(체크)에서 미완료(미체크)로 롤백 — plan 상태 불일치 위험
- 위치: `plan/in-progress/spec-sync-form-gaps.md` (파일 25)
- 상세: 이전 PR에서 `[x]` 완료로 표시됐던 `§6.2 서버측 validation.min/max(숫자 범위)·pattern(정규식) 검증` 항목이 `[ ]` 미완료로 되돌려지고, "INFO 후속" 섹션도 제거됐다. 이는 이 PR이 min/max/pattern 구현을 의도적으로 롤백함을 의미한다. 그러나 롤백 이유가 plan 파일에 명시되지 않아 향후 개발자가 왜 완료됐다가 미완료로 돌아갔는지 맥락을 알 수 없다.
- 제안: plan 파일 또는 주석에 "exec-test-dataset PR에서 이 항목을 롤백한 이유"를 간략히 기재할 것.

### [INFO] `WorkflowTestDatasetsModule`이 `AppModule`에 추가됨 — 전역 NestJS IoC 컨테이너 상태 변경
- 위치: `codebase/backend/src/app.module.ts` (파일 3)
- 상세: `WorkflowTestDatasetsModule` 등록으로 NestJS 부트스트랩 시 전역 모듈 컨테이너에 `WorkflowTestDatasetsService`, `WorkflowTestDatasetsController`, `TypeORM Repository<WorkflowTestDataset>`, `TypeORM Repository<Workflow>`가 추가로 등록된다. 이는 의도된 변경이지만, `Workflow` entity의 Repository가 `WorkflowTestDatasetsModule`에서도 `forFeature`로 중복 등록된다는 점에 주의가 필요하다. TypeORM forFeature는 여러 모듈에서 같은 entity를 중복 등록해도 문제없이 동작하나, 만약 `Workflow` entity에 대한 기존 모듈의 Repository와 동작 차이가 생긴다면 혼란의 여지가 있다.
- 제안: 현재 구조는 NestJS/TypeORM 표준 패턴으로 부작용 없음. 단, `Workflow` entity가 `WorkflowTestDatasetsModule`과 `WorkflowsModule` 양쪽에서 `forFeature` 등록되는 점은 의도됐는지 확인 권장.

### [INFO] `ROOT_ENTITIES`에 `WorkflowTestDataset` 추가 — 데이터베이스 연결 시점 entity 메타데이터 변경
- 위치: `codebase/backend/src/database/root-entities.ts` (파일 4)
- 상세: `ROOT_ENTITIES` 배열은 TypeORM의 `forRoot` 설정에서 참조되는 전역 entity 목록이다. `WorkflowTestDataset`이 추가됨으로써 TypeORM이 애플리케이션 시작 시 해당 entity의 메타데이터를 로드한다. `app.module.spec.ts`의 `REQUIRED_ENTITIES`에도 동일하게 추가돼 일관성이 유지된다. 의도된 변경이므로 부작용 없음.
- 제안: 추가 조치 불필요.

### [INFO] `WorkflowTestDataset` entity의 `input` 속성과 DB 컬럼명 `data` 불일치 — TransformInterceptor 충돌 회피 의도
- 위치: `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` (파일 12)
- 상세: `@Column({ name: 'data', ... }) input: Record<string, unknown>` 패턴은 entity 속성명을 `input`으로 하되 DB 컬럼명은 `data`로 유지한다. 주석에서 "TransformInterceptor가 top-level `data` 키를 '이미 래핑됨'으로 오판"하는 문제를 회피하기 위한 의도적 설계임을 명시하고 있다. 이 패턴 자체는 TypeORM이 지원하는 정상 패턴이나, 향후 raw query나 QueryBuilder 사용 시 컬럼명(data)과 entity 속성명(input) 혼동으로 버그가 발생할 수 있다. 단, 이는 TransformInterceptor 전역 동작을 의도치 않게 우회하는 것이 아니라 오히려 이중 래핑 부작용을 방지하는 설계임.
- 제안: 문서화는 충분하다. raw SQL/QueryBuilder 사용 시 컬럼명 `data`를 명시해야 함을 팀에 공유할 것.

### [INFO] 프론트엔드 API 클라이언트(`workflowTestDatasetsApi`)에서 `update` 메서드가 테스트 mock에 포함되지 않음
- 위치: `codebase/frontend/src/lib/api/workflow-test-datasets.ts` (파일 20), `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` (파일 18)
- 상세: `workflowTestDatasetsApi`에는 `list`, `create`, `update`, `remove`, `clone` 다섯 메서드가 정의됐으나, 테스트 mock에는 `list`, `create`, `clone`, `remove` 네 메서드만 포함되고 `update`가 누락됐다. `editor-toolbar.tsx`(파일 19, diff 생략)에서 `update`가 실제로 호출되는 경우, 테스트에서 mock되지 않아 실제 API 클라이언트 호출이 일어날 수 있다.
- 제안: `editor-toolbar.tsx`의 `update` 사용 여부를 확인하고, 사용한다면 테스트 mock에 추가할 것. 사용하지 않는다면 현재 테스트 커버리지는 충분.

### [INFO] i18n 키 추가 — 기존 Dict 타입 정합성
- 위치: `codebase/frontend/src/lib/i18n/dict/en/editor.ts` (파일 21), `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` (파일 22)
- 상세: en/ko 양쪽에 동일한 키 집합(datasets, datasetShared, datasetClone, datasetDelete, datasetListEmpty, datasetSaveAs, datasetSave, datasetNamePlaceholder, datasetShareWorkspace, datasetSaved, datasetSaveFailed, datasetCloned, datasetCloneFailed, datasetDeleted, datasetDeleteFailed — 총 15개)이 추가됐다. Dict 타입에 이 키들이 선언돼 있다면 추가 조치 불필요. 만약 Dict 타입이 자동 생성되지 않는다면 타입 정의 파일 갱신 여부를 확인해야 한다.
- 제안: `Dict["editor"]` 타입 정의에 신규 키가 반영됐는지 확인. 누락 시 TypeScript 컴파일 오류 발생.

### [INFO] 이전 PR 리뷰 산출물 삭제 (`review/code/2026/06/14/22_49_26/`, `review/code/2026/06/14/23_05_30/`) — 추적성 손실 가능성
- 위치: 파일 26~48 (review/code 산출물 삭제)
- 상세: form-validation-minmax-pattern PR의 코드리뷰 산출물(SUMMARY, RESOLUTION, 각 에이전트 결과, retry_state, meta.json)이 전부 삭제됐다. 해당 산출물은 plan/complete/ 이동 시 함께 유지되는 것이 일반적이나, plan 파일(form-validation-minmax-pattern.md)도 함께 삭제됐다. 프로젝트 규약상 `review/**`는 gitignored가 아니고 커밋 대상이므로, 이전 PR의 리뷰 이력이 이 커밋으로 history에서 제거된다. 향후 감사(audit) 또는 재검토 시 이전 리뷰 근거를 찾기 어려울 수 있다(git log로는 이전 상태 복원 가능).
- 제안: 삭제 이유(예: "min/max/pattern 구현 롤백으로 관련 PR/리뷰 산출물 제거")를 커밋 메시지에 명시하거나, RESOLUTION.md에 이관 근거를 남길 것.

### [INFO] SQL migration V097 — CASCADE 삭제로 인한 데이터 손실 위험 (의도된 설계)
- 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql` (파일 1)
- 상세: `workflow_id`, `owner_id`, `workspace_id` 세 FK 모두 `ON DELETE CASCADE`로 정의돼 워크플로우/유저/워크스페이스 삭제 시 연관 데이터셋이 자동 삭제된다. 이는 주석에 명시된 의도된 설계이나, 특히 `workspace_id CASCADE`의 경우 워크스페이스 삭제 이벤트가 발생하면 해당 워크스페이스의 모든 공유 데이터셋이 일괄 삭제되는 광범위한 부작용이 생긴다. 애플리케이션 레이어에서 워크스페이스 삭제 전 확인/경고 없이 CASCADE가 자동 실행되면 사용자 데이터 손실로 이어진다.
- 제안: 워크스페이스 삭제 플로우에서 연관 데이터셋 존재 시 사용자에게 경고하는 로직이 있는지 확인할 것. 없다면 소프트 삭제(soft delete) 또는 CASCADE 제거 후 애플리케이션 레이어 처리 고려.

---

## 요약

이번 변경의 핵심 부작용 관점 리스크는 두 가지다. 첫째, `FormModalField`에서 `min?/max?/pattern?` 필드 제거(파일 7)가 `form-mode.ts`의 관련 검증 로직 제거와 원자적으로 함께 처리됐는지 확인이 필요하다 — 타입만 제거되고 로직이 잔존하면 해당 필드가 항상 `undefined`가 되어 검증이 무력화된다. 둘째, 이전 PR 리뷰 산출물과 plan 파일의 일괄 삭제로 form-validation-minmax-pattern PR의 추적 이력이 제거된다. 신규 `workflow-test-datasets` 모듈은 NestJS/TypeORM 표준 패턴을 따라 전역 상태 오염 없이 잘 격리됐으며, entity의 `input`/`data` 컬럼명 불일치는 TransformInterceptor 이중 래핑 방지를 위한 의도된 설계로 문서화도 충분하다. SQL migration의 세 FK 전부 `ON DELETE CASCADE`는 명세에 따른 설계이나 특히 `workspace_id CASCADE`의 광범위한 데이터 삭제 가능성은 애플리케이션 레이어에서 경고 처리가 필요하다.

## 위험도

MEDIUM
