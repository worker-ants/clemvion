# 변경 범위(Scope) 리뷰 — column-guard-gaps (2라운드)

## 발견사항

- 핵심 코드 변경(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`)은 스코프 이탈이 없다. `plan/in-progress/column-guard-gaps.md` 의 "할 것" 목록(① 읽기 전용 세션 헬퍼(`readOnlyDataSourceOptions()`) 추출 + DDL 거부 회귀 테스트, ② `model_config.kind`·`workflow_assistant_session.last_interaction_at` 기본값 RETURNING 왕복 테스트, ③ 가독성 — `log`→`sqlMemory` 개명·`COLUMN_LEVEL_SAMPLES` 표본별 주석·헤더 JSDoc 정정)과 diff 내용이 정확히 1:1 대응한다. 신규 import(`ModelConfig`, `WorkflowAssistantSession`)도 새 테스트가 실제로 쓰는 것뿐이다. 1라운드 리뷰 조치(커밋 `a71642fe0` — `qr.connect()`/`startTransaction()` 을 `try` 안으로, 두 테스트의 `try`/`finally` 관용구 통일)도 실제 소스(590~663행 부근)에서 그대로 반영돼 있음을 직접 확인했다. drive-by 포매팅·무관 리팩토링·기능 확장 없음.

- **[WARNING — 1라운드에서 이미 지적, 조치는 "코드 밖·근거 기록"으로 종결됨]** 같은 changeset 에 실린 `--impl-prep` consistency-check 세션(`review/consistency/2026/09/20/00_34_58/**`)이 이 작업(`column-guard-gaps`, `spec_impact: none`, 대상 spec `spec/1-data-model.md`)과 무관한 스코프 `spec/2-navigation/` 로 실행됐다. `plan_coherence.md`(INFO #4)·`convention_compliance.md`·`naming_collision.md` 세 checker 가 스스로 "이번 호출 target 이 실제 작업과 무관하다"고 명시했고, `rationale_continuity` 만 리다이렉트 블록으로 실제 관련 spec 을 봤다. 그 결과 이 작업과 무관한 WARNING 2건(`GET /api/folders`·`GET /api/triggers/:id/history` 응답 포맷 spec 미기재)이 이번 changeset(`review/consistency/.../SUMMARY.md`)에 편입돼 있다.
  - 위치: `review/consistency/2026/09/20/00_34_58/SUMMARY.md` (WARNING #1·#2, INFO #4), `plan/in-progress/column-guard-gaps.md` 체크리스트 `--impl-prep` 항목
  - 상세: 1라운드 scope 리뷰(`review/code/2026/09/20/01_00_21/scope.md`)가 동일 사실을 WARNING 으로 이미 지적했고, `RESOLUTION.md` 는 이를 "코드 밖 · 조치 없음(근거 기록)" 으로 처분했다 — `--impl-prep` 이 디렉터리만 받을 수 있어 최상위 spec 파일(`spec/1-data-model.md`)을 직접 줄 수 없었다는 근거, 그리고 "보정 블록을 1개 checker 만 받았다"는 1라운드 리뷰어의 세부 지적에 대한 반박(5개 프롬프트 모두에 리다이렉트 블록이 붙어 있다)을 실제로 확인했다 — `grep -c "main 추가" review/consistency/2026/09/20/00_34_58/_prompts/*.md` → 5개 파일 모두 1건씩(cross_spec·rationale_continuity·convention_compliance·plan_coherence·naming_collision). 즉 1라운드 리뷰의 "1/5만 받았다"는 세부 진술은 부정확했고 RESOLUTION 의 정정이 맞다. 다만 이 정정은 "보정 블록이 몇 곳에 붙었나"에 대한 것일 뿐, 무관 스코프로 나온 WARNING 2건이 여전히 이 changeset 에 실려 있다는 근본 사실 자체는 바뀌지 않는다.
  - 판단: 코드(`codebase/`) 자체의 스코프 일탈은 아니며, 이미 문서화된 근거와 함께 명시적으로 "조치 없음"이 선언된 항목이라 이번 라운드에서 새로 조치를 요구하지 않는다. 다만 "관측한 이상 상태는 그대로 보고하라"는 규약에 따라 계속 기록으로 남긴다. 재발 방지책(다음에 같은 "선례" 사용 시 5개 checker 모두 리다이렉트 처리하거나, `--impl-prep` 이 단일 spec 파일을 target 으로 받게 호출 방식 개선)은 여전히 유효한 제안이다.
  - 제안: 이번 changeset 재작업 불요. 다음에 이 "선례"를 반복 사용할 계획이면 위 재발 방지책을 별도 harness 개선 항목으로 등록할 것.

- **[INFO — 후속 확인 필요, 1라운드에서도 동일 지적]** 무관 스코프 실행으로 나온 WARNING 2건이 plan 체크리스트에서 "마무리 커밋에서 트래커의 planner 항목으로 등재한다"로만 예고돼 있고, 이번 diff 범위(2라운드 시점)에서 실제 등재가 실행됐는지는 확인되지 않는다 — 트래커 파일(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 자체가 이번 리뷰 대상 파일 목록에 없다.
  - 위치: `plan/in-progress/column-guard-gaps.md` 체크리스트 `--impl-prep` 항목, `review/code/2026/09/20/01_00_21/RESOLUTION.md` W1 행
  - 상세: plan 자체의 남은 체크박스(`[ ] /ai-review 수렴`, `[ ] --impl-done`, `[ ] 트래커 해소 · 이 plan plan/complete/ 로`)가 이 등재를 "마무리" 단계로 명시적으로 미뤄 둔 상태이므로, 이는 스코프 위반이 아니라 정상적으로 트래킹되는 미완료 단계다.
  - 제안: 이 PR 을 마무리하는 커밋에서 실제 트래커 파일 수정이 포함되는지 확인.

- 그 외 리뷰/컨시스턴시 산출물 파일들(라운드 1 `review/code/2026/09/20/01_00_21/**`, `review/consistency/2026/09/20/00_34_58/**`)은 프로젝트 컨벤션상 `review/` 가 gitignore 대상이 아니라 커밋되는 workflow harness 산출물이며, 이 작업 자체의 스코프 밖으로 새어나간 프로덕션 코드·spec 수정은 아니다 — 위 WARNING 을 제외하면 전부 이 작업의 절차(1라운드 리뷰 · impl-prep 게이트)를 기록하는 정상적인 부산물이다.

## 요약

핵심 코드 변경은 plan 이 스스로 선언한 범위(테스트 파일 1개, 헬퍼 추출 + 신규 테스트 2건 + 개명·주석)를 벗어나지 않고, 1라운드 리뷰 조치도 소스에 정확히 반영돼 있어 깨끗하다. 유일한 스코프 이슈는 함께 커밋된 `--impl-prep` consistency-check 세션이 무관한 spec 스코프(`spec/2-navigation/`)로 실행돼 무관 WARNING 2건을 이 changeset 에 편입시킨 것인데, 이는 1라운드에서 이미 지적됐고 `RESOLUTION.md` 가 "코드 밖·근거 기록"으로 명시적으로 처분했으며 그 근거(리다이렉트 블록이 5개 checker 전부에 붙었다는 반박)도 직접 확인해 정확했다. 따라서 이번 라운드에서 코드 재작업을 요구할 사안은 없고, 남은 것은 plan 체크리스트가 스스로 예고한 "마무리 커밋에서 트래커 등재" 가 실제로 실행되는지 뿐이다.

## 위험도

LOW
