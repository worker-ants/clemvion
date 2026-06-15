# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [WARNING] 이전 PR(form-validation-minmax-pattern) review/ 산출물 전량 삭제 — 현 작업과 무관한 파일 삭제
- 위치: `review/code/2026/06/14/22_49_26/` 전체 (RESOLUTION.md, SUMMARY.md, _retry_state.json, api_contract.md, documentation.md, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md, testing.md, user_guide_sync.md), `review/code/2026/06/14/23_05_30/` 전체 (RESOLUTION.md, SUMMARY.md, _retry_state.json, documentation.md, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md, testing.md), `review/consistency/2026/06/14/22_22_50/` 전체 (_retry_state.json, SUMMARY.md, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md), `review/consistency/2026/06/14/23_05_43/SUMMARY.md`
- 상세: 이 모든 파일은 현재 PR(exec-test-dataset-22, spec §2.2 저장/이름 지정)과 전혀 관계없는 이전 작업(A-1 form validation.min/max·pattern)의 리뷰 산출물이다. PR branch `claude/config-call-history-929994` 에 이 삭제가 포함되어 있다면, 이전 PR의 산출물을 현 PR이 폐기하는 것으로 범위 이탈에 해당한다. review/ 산출물은 프로젝트 규약상 `review/code/**`, `review/consistency/**` 에 영구 보존하는 의무 아티팩트다(CLAUDE.md 정보 저장 위치 표). 의도된 삭제라면 별도 cleanup PR로 분리해야 한다.
- 제안: 이 삭제들이 의도치 않게 diff에 포함된 경우 git rebase/cherry-pick으로 현 branch에서 제거한다. 삭제가 의도적이더라도 현 PR의 기능 범위(§2.2 구현)와 무관하므로 별도 PR로 분리를 권장한다.

### [WARNING] plan/complete/form-validation-minmax-pattern.md 삭제 — 현 작업과 무관한 plan 정리
- 위치: `plan/complete/form-validation-minmax-pattern.md` (파일 23, 삭제됨)
- 상세: 이전 PR(A-1) 의 완료 plan 파일이 현 PR에서 삭제됐다. 이 파일의 삭제가 exec-test-dataset-22 작업의 명시적 범위에 포함되지 않는다. plan lifecycle 규약상 complete/ 파일은 영구 보존 대상이며, 삭제 시에는 명시적 근거가 필요하다. 설령 A-1 PR이 이미 main에 merge됐고 complete/ 정리가 필요하더라도, 이 파일 삭제는 현 §2.2 구현 PR에서 수행될 성격의 작업이 아니다.
- 제안: 현 PR에서 제외하거나, 삭제 근거를 명시한 별도 PR로 분리한다.

### [WARNING] plan/in-progress/spec-sync-form-gaps.md — min/max·pattern 체크박스 되돌림(unchecked) + INFO 후속 섹션 삭제
- 위치: `plan/in-progress/spec-sync-form-gaps.md` (파일 25)
- 상세: diff 를 보면, 이전 PR에서 `[x]`로 완료 표시된 "§6.2 서버측 validation.min/max·pattern 검증" 항목이 `[ ]`로 되돌아갔고, "impl-done INFO 후속" 섹션(인접 spec 동기화·execution-engine.service.spec 통합 케이스)이 삭제됐다. A-1 PR 이 완료·merge된 이후의 상태라면 이 체크박스 역전은 이력 훼손이며 현 작업 범위와 무관하다. 만약 A-1 이 아직 merge 전이고 이 branch가 공통 base에서 분기했다면, rebase 후 충돌 해결 과정에서 A-1 변경이 반영되지 않은 것일 수 있으나, 그 경우에도 §2.2 구현이 §6.2 체크박스를 되돌릴 이유가 없다.
- 제안: A-1 상태(merged 여부)를 확인하고, merge됐다면 main을 rebase base로 사용해 이 역전을 수정한다. merge 전이라면 conflict 해결을 재확인한다.

### [INFO] chat-channel/types.ts — FormModalField 에서 min?/max?/pattern? 필드 삭제 (파일 7)
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` (파일 7)
- 상세: A-1 PR에서 추가한 `min?`, `max?`, `pattern?` 세 필드가 현 PR diff에서 삭제(음수 라인)로 표시된다. 이는 현 branch가 A-1 merge 전 base에서 분기해 A-1 변경이 포함되지 않은 상태에서 추가 수정이 없어 삭제처럼 보이는 것이거나, 또는 의도적으로 제거된 것이다. 어느 쪽이든 현 PR(§2.2 데이터셋 구현)이 A-1(form validation)의 types.ts 변경을 되돌리는 것은 범위 이탈이다. 단, diff 맥락상 이 branch의 base가 A-1 이전 상태일 가능성이 높다.
- 제안: main rebase 후 A-1 변경이 이미 반영된 상태에서 현 PR diff를 재확인한다. 실제로 이 삭제가 포함돼 있다면 제거한다.

### [INFO] execution-engine.service.ts — docstring 변경이 현 작업 범위와 무관 (파일 8)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (파일 8)
- 상세: §6.2 min/max/pattern을 "미적용(Planned)"으로 되돌린 docstring 변경이 포함됐다. 이는 파일 7(types.ts)과 같이 A-1 변경이 반영되지 않은 base에서 분기한 결과일 가능성이 높다. 현 §2.2 구현(데이터셋 저장)이 form 검증 docstring을 수정할 이유가 없다.
- 제안: types.ts와 동일하게, rebase 후 A-1 변경이 이미 반영된 상태인지 확인한다.

### [INFO] 핵심 구현 파일(파일 1~6, 9~22) — 범위 내 정상 변경
- 위치: `V097__workflow_test_dataset.sql`, `app.module.spec.ts`, `app.module.ts`, `root-entities.ts`, `workflow-test-datasets/` 모듈 전체(entity/dto/service/controller/module/spec), `test/workflow-test-dataset.e2e-spec.ts`, `frontend/editor-toolbar*`, `frontend/lib/api/workflow-test-datasets.ts`, `lib/i18n/dict/en/editor.ts`, `lib/i18n/dict/ko/editor.ts`
- 상세: 이 파일들은 모두 spec §2.2(테스트 데이터셋 저장/이름 지정)의 직접 구현이다. DB 마이그레이션, 엔티티, CRUD 서비스/컨트롤러/DTO, app 모듈 등록, e2e 테스트, 프론트엔드 API 클라이언트, 편집기 UI 확장, i18n 문자열 — 모두 §2.2 범위에 해당한다. 불필요한 리팩토링, 기능 확장, 포맷팅 혼입, 불필요한 임포트 정리는 발견되지 않는다.
- 제안: 무방. 범위 내 정상 구현.

### [INFO] plan/in-progress/spec-sync-execution-gaps.md — §2.2 체크박스 완료 표시 (파일 24)
- 위치: `plan/in-progress/spec-sync-execution-gaps.md` (파일 24)
- 상세: §2.2 항목을 `[ ]`→`[x]` 로 갱신하고 구현 결정 내용 및 후속 체크리스트(TEST WORKFLOW / ai-review / consistency-check)를 추가했다. 이는 dev workflow 규약(plan 체크박스 갱신)에 따른 정상 동반 수정이다.
- 제안: 무방. 규약 준수 동반 파일.

## 요약

현 PR(exec-test-dataset-22, spec §2.2 워크플로우 테스트 데이터셋 저장)의 핵심 구현(파일 1~6, 9~22)은 의도된 범위 내에서 정확히 수행됐다. 그러나 이전 작업(A-1 form-validation-minmax-pattern)의 review/ 산출물 전량(22_49_26·23_05_30 code review, 22_22_50·23_05_43 consistency review)과 plan/complete/ 파일 삭제가 현 PR diff에 포함되어 있으며, 이는 현 §2.2 구현과 무관한 범위 이탈이다. 또한 A-1이 추가한 `types.ts` min/max/pattern 필드와 `execution-engine.service.ts` docstring, `spec-sync-form-gaps.md` 체크박스가 현 diff에서 되돌아간 것으로 보이는데, 이는 base branch 분기 시점 문제(A-1 merge 전 base)에서 비롯됐을 가능성이 높다. 이 부분들은 main rebase 후 확인·정리가 필요하다.

## 위험도
MEDIUM
