# Plan 정합성 검토 — ResultDetail waiting props 공용 hook 추출 (V-05 후속)

검토 모드: impl-done · scope=`spec/conventions/` · diff-base=`origin/main`
Target 커밋: `b6a9c6cf5`(refactor) + `358f12ca1`(ai-review W-1 후속)
Plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — V-05 후속 항목 2번째 (refactor hook 추출)

## 발견사항

검토 관점 1(미해결 결정 우회)·2(선행 plan 미해소)·3(후속 항목 누락) 전부에 대해 위반 없음.

- **[INFO]** 체크박스 상태와 실제 diff 의 정합 확인 완료
  - target 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-05 후속 2번째 항목(`[x] (refactor) ...`)
  - 관련 plan: 동일 문서, V-05 후속 항목 리스트
  - 상세: 체크박스가 서술하는 3가지 주장을 모두 실제 코드/spec diff 로 교차 검증했다.
    1. **hook 추출**: `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts` 신규 생성 확인(`git diff origin/main` new file, 73줄). waiting selector 11개 + resume 콜백 4개를 단일화하고, `deriveFlags(isSelectedWaiting)` 를 순수 함수로 분리해 Rules of Hooks(드로어의 idle early return) 를 준수하는 설계도 코드와 일치.
    2. **registry SoT 동반 갱신**: `spec/conventions/interaction-type-registry.md` §1.2 매트릭스가 `(d) drawer` + `(e) page` 두 행을 `use-result-detail-waiting.ts` `deriveFlags` 단일 site (d) 로 병합한 diff 확인. `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 배열이 4개 파일→3개 파일(drawer/page 제거, hook 추가)로 diff 상 정확히 반영됨.
    3. **`isLiveConversation` 잔존**: `run-results-drawer.tsx` 에 여전히 `isLiveConversation`(2값 subset, plain 비교)이 남아있고 exhaustive 가드 대상이 아님 — 코드 확인 결과 실제로 그대로 유지됨(grep 확인, hook 으로 이관되지 않음).
  - 결론: 체크박스 서술과 실제 구현 사이에 괴리 없음.
  - 제안: 없음(현행 유지).

- **[INFO]** ai-review Warning 해소 후속 커밋 존재 확인
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 (ai_form_render 행 레터링 (d)→(f)/(g)→(f))
  - 관련 plan: `review/code/2026/07/05/21_06_38/SUMMARY.md` W-1(convention, "레터 갭")
  - 상세: 최초 hook 추출 커밋(`b6a9c6cf5`)에서 매트릭스 행 병합 시 레터가 (d)→(f)로 건너뛰는 표기 갭이 발생했고, 후속 커밋 `358f12ca1`("registry 매트릭스 레터 연속화 + hook test 강화")에서 (a)~(f) 연속화로 해소됐다. 현재 워킹트리 diff(HEAD 기준)는 이미 해소된 최종 상태를 반영하고 있어 residual 불일치 없음.
  - 제안: 없음.

- **[INFO]** V-05 후속 3번째 항목("미사용 i18n 키 제거 + 폴더 rename 검토")은 여전히 `[ ]` 로 미착수 — 본 PR 범위 의도적 제외
  - target 위치: 코드 diff 는 i18n 키(`executions.tabPreview/tabInput/tabOutput/tabError`)나 `components/editor/run-results` 폴더명에 손대지 않음(코드 diff 확인)
  - 관련 plan: `spec-code-cross-audit-2026-06-10.md` V-05 후속 3번째 `[ ] (low)` 항목
  - 상세: 이 항목은 plan 문서 자체가 "본 PR 범위 밖" 으로 이미 명시한 low-priority 후속이라, 이번 hook 추출 PR 이 이를 처리하지 않은 것은 후속 항목 누락이 아니라 계획대로다. 다만 hook 추출로 `components/editor/run-results` 폴더가 에디터·실행내역 이중 소유 상태가 더 굳어졌으므로(신규 파일이 같은 폴더에 추가됨) rename 검토 항목의 근거는 오히려 강화됐다 — plan 문서가 이미 그 사유를 담고 있어 별도 갱신 불요.
  - 제안: 없음(추적 메모 수준, 이미 plan 에 반영됨).

- **[INFO]** 다른 in-progress plan 과의 상호 참조 — 충돌 없음
  - target 위치: 없음(cross-check)
  - 관련 plan: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` 58행 (`ResultDetail` 언급, PR #817 V-05 본체 관련 서술)
  - 상세: `run-results-drawer.tsx`/`use-result-detail-waiting.ts`/`interaction-type-registry.md` 를 언급하는 다른 in-progress plan 문서는 이 문서 하나뿐이며, 해당 언급은 V-05 서브탭 구현(PR #817) 자체를 가리키는 역사적 서술로 이번 hook 리팩터와 무관·비충돌.
  - 제안: 없음.

## 요약

`spec-code-cross-audit-2026-06-10.md` 의 V-05 후속 hook 추출 체크박스(`[x]`)는 실제 diff(hook 신규 파일, registry 매트릭스 병합, `REGISTRY_SITES` 3파일 축소)와 정확히 일치하며 과장·축소 없이 서술됐다. ai-review 에서 나온 유일한 Warning(레터 갭)은 후속 커밋으로 이미 해소되어 현재 워킹트리에 잔존 불일치가 없다. 같은 plan 문서의 미해결 결정(V-05 후속 3번째 i18n/rename 항목, 다른 plan 의 미해결 도구-연결 결정 등)과 충돌하는 일방적 결정은 없으며, 다른 in-progress plan 의 관련 서술도 이번 변경을 무효화하지 않는다. Plan 정합성 관점에서 문제 없음.

## 위험도
NONE
