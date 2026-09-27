# Plan 정합성 검토 — patch-omit-undefined (impl-done)

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

### 확인한 근거 (충돌 없음의 논거)

- **미해결 결정과의 충돌 없음**: 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 항목 "`Object.assign(엔티티, DTO)` … 남은 세 곳"이 플랜 대상이었고, 그 항목이 명시적으로 남겨둔 미해결 판단("가드를 둘까")은 이번 plan `plan/in-progress/patch-omit-undefined.md` §"가드를 둘까"에서 정면으로 다루고 "두지 않는다"로 결론 낸 뒤 근거(정규식 허용목록의 한계, 타입 가드 표면 확대, 선례 #970)를 남겼다 — 트래커가 결정을 요구한 항목을 우회한 것이 아니라 그 항목이 요청한 판단을 정확히 수행했다.
  - `code:` 등재처(도메인 spec 양쪽 vs `2-api-convention.md` 단일 소재)처럼 실제로 planner 판단이 필요한 항목은 developer가 임의로 정하지 않고, 호출부가 2곳→5곳으로 늘었다는 사실만 트래커 항목 (6)에 보강하고 결정은 그대로 "planner 가 정한다"로 남겨두었다 (`spec-draft-nullable-notation-followups.md:6329-6332`).
- **선행 plan 미해소 없음**: 이 PR이 재사용하는 공용 헬퍼 `src/common/utils/omit-undefined.ts`의 신설 주체인 `plan/complete/folders-contract-e2e.md`는 이미 `complete/`로 이동돼 있어 선행조건이 실제로 해소된 상태였다 (`ls plan/in-progress/folders-contract-e2e.md` → 없음, `plan/complete/folders-contract-e2e.md` → 존재).
- **후속 항목 누락 없음**: `--impl-prep`(review/consistency/2026/09/27/13_11_33, BLOCK: NO)이 지적한 W1~W4가 전부 트래커에 반영되어 있음을 직접 확인했다 — 항목 (6) 호출부 5곳 확장 + 소관 spec 4곳 명시, 항목 (7) PATCH "키 생략=값 불변" 문장 보강 대상(`1-workflow-list.md` §3.2, `6-config.md`) + `settings` null 의미, 항목 (8) `1-workflow-list.md` §2.3 자기모순 문구 정정, 그리고 이 PR과 무관한 기존 drift(`1-data-model.md` §2.2 Schedule 타임존)는 별도 신규 항목으로 분리 등재됨 (`spec-draft-nullable-notation-followups.md:6329-6346`). `/ai-review` 2R의 W1(직렬화 계층 부재)·W2(`description` nullable 미선언) 수렴 예외도 "PATCH 부분 본문 후속" 항목으로 같은 트래커에 이미 등재됨(`spec-draft-nullable-notation-followups.md:1404-1419`).
- **코드-plan 정합성**: `_code_diff.patch`를 직접 읽어 plan이 서술한 처방(워크플로 `settings` 가드를 `settings != null`로, `nodes.service.ts` `update()` 반환에서 `workflow` 관계 제거, 세 서비스에 `omitUndefined` 적용)이 실제 diff와 정확히 일치함을 확인했다.
- **다른 in-progress plan과의 충돌 없음**: `omit-undefined`·`Object.assign(workflow|node|config`를 참조하는 in-progress plan은 트래커 자신과 이 plan 둘뿐이며(grep 전수), 변경된 세 서비스 파일을 언급하는 나머지 plan(`spec-sync-auth-gaps.md`)의 해당 대목은 감사 로그(`recordAudit`) 세부사항으로 이번 diff가 건드리지 않은 코드라 무관하다.
- `spec/2-navigation/1-workflow-list.md`·`spec/3-workflow-editor/1-node-common.md`의 `code:` frontmatter는 각각 `workflows.service.ts`·`modules/nodes/**`를 이미 포함하고 있어 이번 변경에 대한 spec 소유 관계도 어긋나지 않는다. `spec_impact: none`은 타당하다 — 이 PR은 spec이 이미 서술한 계약(응답 필드 존재, `settings` 병합)을 코드로 맞춘 버그 수정이지 새 결정이 아니다.

경미한 관찰(비차단, 보고 목적):
- 트래커 항목 본문(`spec-draft-nullable-notation-followups.md:1396`)이 이미 "완료 (2026-09-27, `plan/complete/patch-omit-undefined.md`)"라고 완료·이동을 전제로 서술하지만, 실제로는 `plan/in-progress/patch-omit-undefined.md`에 `- [ ] --impl-done` 체크박스가 아직 미완료 상태다. 이는 본 impl-done 리뷰가 통과한 뒤 같은 마무리 커밋에서 체크와 `complete/` 이동이 함께 이뤄지는 정상 워크플로 패턴(선행 기록 → 사후 이동)으로 보이며, 현시점 정합성 결함으로 판단하지 않는다. 다만 이 리뷰가 통과하면 체크박스 체크와 `plan/complete/` 이동이 동일 커밋에서 실제로 수행되는지는 마무리 단계에서 확인이 필요하다.

## 요약

`patch-omit-undefined` plan은 자체적으로 `--impl-prep`(BLOCK: NO) 단계에서 이미 발견된 모든 plan 정합성 이슈(트래커 항목 갱신, 신규 항목 등재, 무관한 기존 drift의 분리 등재)를 해당 세션에서 처리했고, 이번 검토에서 코드 diff·트래커·spec frontmatter를 직접 대조한 결과 그 처리가 실제로 반영되어 있음을 확인했다. 미해결 결정을 우회하거나, 선행 plan을 무시하거나, 후속 항목을 누락한 사례는 발견되지 않았다.

## 위험도
NONE
