# 문서화(Documentation) 리뷰 — dup-delete-audit

## 발견사항

- **[WARNING] 프로젝트 관례상 이 급의 동시성 버그 수정은 `CHANGELOG.md` 에 `## Unreleased` 항목을 남기는데, 이 PR 은 `CHANGELOG.md` 를 전혀 건드리지 않았다**
  - 위치: `CHANGELOG.md` (변경 없음 — `git diff --stat origin/main...HEAD -- CHANGELOG.md` 결과 없음)
  - 상세: 같은 파일의 직전 세 항목(`ae4fbc374` 통합 rotate 잃은 갱신, `ea27c21b3` SSRF 가드, 그리고 `CHANGELOG.md:119` `## Unreleased — 워크플로·워크스페이스를 지워도 트리거의 자원이 남았다`)은 전부 "동시 X 두 건이 Y 를 틀리게 만들었다" 류의 결함을 고칠 때 같은 커밋 안에서 원인·고친 것·남는 것 3단 구성으로 `CHANGELOG.md` 를 갱신해 왔다(`git show --stat ae4fbc374` 로 같은 커밋에 포함됨을 확인). `CHANGELOG.md:119-145` 의 기존 항목은 트리거/스케줄/워크플로/워크스페이스 4경로의 **자원 정리 누락**을 다루지만, 이번 PR 이 고치는 **감사 로그 중복**(동시 DELETE 두 건이 `workflow.deleted` 를 두 번 남기는 것)은 별개 결함이고 그 항목에도 언급이 없다. `plan/in-progress/dup-delete-audit.md` 자체가 "이 결함 클래스" 를 명시적으로 서술하고 있어(§A·§B) 그대로 요약해 옮기면 되는 내용인데 빠져 있다.
  - 제안: 이 PR 의 마무리 커밋에 `CHANGELOG.md` `## Unreleased — 동시 워크플로 DELETE 두 건이 `workflow.deleted` 감사 행을 두 번 남겼다` 류의 항목을 추가한다(원인: `lockParentAndListTriggerIds` 가 잠근 행의 존재 여부를 버림 · 고친 것: `{parent, triggerIds}` 반환 + 워크플로 삭제가 `parent==='absent'` 면 404 · 판별력 실측: e2e 로 이전엔 `[204,204]`+감사 2건, 이후 `[204,404]`+감사 1건).

- **[INFO] `spec/2-navigation/1-workflow-list.md` §2.6 의 "삭제" 행이 트리거 목록 §4.4 와 달리 동시 삭제 시 두 번째 요청의 동작(404)을 명시하지 않는다**
  - 위치: `spec/2-navigation/1-workflow-list.md:106` (§2.6 표의 "삭제" 행) — 대조: `spec/2-navigation/2-trigger-list.md:318` (§4.4 "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`")
  - 상세: 이번 PR 로 워크플로 삭제도 트리거와 대칭으로 "두 번째 요청은 404" 동작을 갖게 됐지만(`WorkflowsService.remove()`), workflow-list.md §2.6/§3 어디에도 그 사실이 없다. `/consistency-check --impl-prep` 산출물(`review/consistency/2026/09/20/19_30_57/plan_coherence.md` INFO#5, `SUMMARY.md` INFO#5)이 이미 같은 비대칭을 확인했고, `plan/in-progress/dup-delete-audit.md` §"선례" 가 "새 정책이 아니라 트리거 선례를 따르는 것" 이라는 근거로 `spec_impact: none` 을 정당화하고 있다 — 그 근거 자체는 타당하다(API 계약 신설이 아니라 기존 표준 에러 규약의 자연스러운 적용).
  - 제안: 차단 사유는 아니다. 다만 문서 대칭성을 원하면 후속 project-planner 턴에서 §2.6 "삭제" 설명 끝에 "동시 삭제 시 두 번째 요청은 404 (트리거 목록 §4.4 와 동일 규약)" 한 줄을 추가하는 것을 고려할 것 — 이미 SUMMARY 에 후속 항목으로 기록돼 있으므로 중복 조치는 불필요.

- **[INFO] plan 이 스스로 약속한 트래커 교차 참조가 이 스냅샷 시점엔 아직 반영되지 않았다**
  - 위치: `plan/in-progress/dup-delete-audit.md:55-58` (§"`--impl-prep` 이 요구한 것" W2) — 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md:4501`(«네 자리 공용 형태» 항목), `:4741`(«동시 중복 DELETE» 원 항목, 아직 `- [ ]`)
  - 상세: `dup-delete-audit.md` 는 "트래커의 그 칸에 한 줄 남긴다" 고 스스로 약속했고, `review/consistency/.../SUMMARY.md` 권장조치 #2 도 "developer 가 이번 PR 마무리 커밋에서 직접 처리 가능" 이라고 적었다. 그런데 `git diff --stat origin/main...HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md` 는 빈 결과다 — 아직 그 파일을 건드리지 않았다. `dup-delete-audit.md` 자신의 체크리스트에도 "`/ai-review` → Critical/Warning 0"·"트래커 항목 해소 + `plan/complete/` 로" 가 `- [ ]` 로 남아 있어, 이 시점엔 미완료가 **예상된 정상 상태**로 보인다.
  - 제안: 이 리뷰(그리고 후속 `--impl-done`) 통과 후 마무리 커밋에서 (1) `spec-draft-nullable-notation-followups.md:4741` 항목을 해소로 표시하고, (2) `:4501` 항목에 이 PR 이 바꾼 반환 계약(`{parent, triggerIds}`) 한 줄을 남기고, (3) `dup-delete-audit.md` 를 `plan/complete/` 로 이동하는 것을 잊지 말 것 — 코드 자체의 결함은 아니므로 CRITICAL/WARNING 으로 올리지 않는다.

## 독스트링·인라인 주석 품질 (양호 — 발견사항 아님, 참고용)

- `LockedParentTriggers` 인터페이스(`trigger-resource-release.ts:117-129`)와 `TriggerResourceReleasePort.lockParentAndListTriggerIds` JSDoc(`:161-174`)은 "왜 `string[] | null` 대신 이름 있는 상태를 쓰는지" 를 근거와 함께 정확히 설명하고, 새 필드(`parent`/`triggerIds`) 각각에 개별 주석이 붙어 있다 — 코드와 100% 정합.
- `trigger-resource-releaser.service.ts:86-88` 의 구현부 인라인 주석은 "종전엔 버렸다 → 왜 문제였나 → `manager.remove` 는 0행이어도 던지지 않는다" 를 정확히 설명하며 실제 구현과 일치한다.
- `workflows.service.ts` `remove()` 안의 세 군데 주석(잠금 순서 근거·404 분기 근거·`.catch` 안 "반쯤 삭제 상태 아님" 근거)은 실제 분기 조건(`locked.parent === 'absent'`, `err instanceof NotFoundException`)과 정확히 일치한다.
- `workspaces.service.ts:519-523` 의 새 주석("부모 부재는 여기서 따로 보지 않는다 — `assertWorkspaceDeletable` 재검사가 처리")은 실측 가능한 주장이고 실제로 `assertWorkspaceDeletable` 이 잠금 재검사를 수행하는 코드와 일치한다 — 판정이 두 곳에 흩어지지 않고 한 곳(workspaces)·다른 한 곳(workflows) 으로 의도적으로 분리된 이유가 명확히 남아 있다.
- `test/workflow-delete-concurrency.e2e-spec.ts:8-20` 의 파일 상단 JSDoc은 시나리오·판별력·선례(같은 기법을 쓴 과거 plan 문서 링크)를 모두 포함해 신규 e2e 로서 모범적이다.
- `plan/in-progress/dup-delete-audit.md` 는 결함·처방·선례·비대칭 근거·"하지 않는 것"·판별력 실측(원복 실험으로 RED `[204,204]`+감사 2건 확인)까지 상세히 기록해 후속 검토자가 재구성할 필요가 없다.

## 요약

핵심 변경(`LockedParentTriggers` 신설, 헬퍼 반환 계약 확장, 워크플로 삭제의 404 분기, 워크스페이스 삭제 호출부 조정, 신규 e2e)은 JSDoc·인라인 주석·plan 문서 모두 코드와 정확히 일치하며 근거도 충실하다. 다만 이 저장소가 "동시 X 두 건" 류 결함마다 같은 커밋에서 `CHANGELOG.md` 를 갱신해 온 확립된 관례를 이번 PR 만 건너뛰었고(WARNING), 트리거 목록 §4.4 대칭 문구를 워크플로 목록 §2.6 에 추가하는 문제와 developer 가 스스로 약속한 트래커 교차 참조는 이미 알려진 비차단 후속 항목(INFO)으로 남아 있다.

## 위험도

LOW
