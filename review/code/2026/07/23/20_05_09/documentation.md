# 문서화(Documentation) 리뷰 — presentation-thread-optout-drift

대상: `plan/in-progress/node-output-redesign/form.md`, `plan/in-progress/presentation-thread-optout-drift.md`(신규),
`review/consistency/2026/07/23/19_48_09/**`(신규, consistency-check 산출물), `spec/4-nodes/6-presentation/0-common.md`,
`spec/conventions/conversation-thread.md`. 전부 문서/플랜 변경이며 `codebase/` 변경 없음.

## 발견사항

- **[WARNING]** 체크리스트 "developer 후속 task 등록" 완료 주장이 실제 산출물보다 과장됨
  - 위치: `plan/in-progress/presentation-thread-optout-drift.md:82` (체크리스트 4번째 항목
    — *"sibling `node-output-redesign/form.md:154` 에 D1 재검토 각주 + developer 후속 task
    등록 (WARNING 3)"*, `[x]` 로 완료 표시). 같은 파일 `:56-59`(비목표 — "별건 백로그로
    분리한다")·`:70`(WARNING pin 표 — "**실제로 분리한다.**")도 동일 주장을 반복.
  - 상세: 실제 diff 를 대조하면 `plan/in-progress/node-output-redesign/form.md` 에 추가된
    것은 각주(`:156-161`) **하나뿐**이다. 그 파일 자신의 구조화 추적 위치인
    `## 종합 개선안 (2026-05-16)` 섹션(`:185-189`)에는 새 `- [ ]` 항목이 추가되지 않았다 —
    같은 섹션의 기존 미해결 항목(`:188` `rawConfig ↔ config 분리 검증 unit 테스트`)과
    비교하면, 그 파일의 관례상 "추적해야 할 새 갭"은 checklist 형태 bullet 으로 남기지
    prose 각주만으로 남기지 않는다. 상위 인덱스 `node-output-redesign/README.md` 도
    재검증 라운드마다 "신규 발견 갭" 목록(예: 6차 갱신 블록)에 새 항목을 반영해 왔는데
    이번 D1 재발견은 그 목록에도 없다. 즉 "각주"는 실제로 있지만 "developer 후속 **task
    등록**"(추적 가능한 별도 항목 생성)은 없다 — 두 가지를 한 문구로 묶어 둘 다
    완료했다고 표시하면, 향후 재검증 라운드가 이 D1 갭을 놓칠 위험이 있다.
    (참고: 같은 세션의 `plan_coherence.md` checker 는 이 문제를 미리 지적하며 "최소한
    각주" 를 **최소** 대안으로 제시했었다 — 각주 자체는 checker 기준을 충족하지만,
    target 체크리스트 문구가 그 이상("등록")을 했다고 서술하는 것이 문제다.)
  - 제안: 체크리스트 문구를 실제로 한 일에 맞게 "각주만 추가, 구조화 task 등록은
    별도"로 정정하거나, 지금이라도 `node-output-redesign/form.md` `## 종합 개선안`
    섹션에 `- [ ] (impl) config echo 를 { ...rawConfig } spread → 명시 enumeration 으로
    전환 (D1, 2026-07-23 재발견)` 형태의 bullet 을 추가해 문구와 실제 산출물을 일치시킨다.

- **[INFO]** 신규 대칭 각주 두 곳이 특정 section 을 가리키면서 fragment anchor 를 생략
  - 위치: `spec/4-nodes/6-presentation/0-common.md:167` — `([conversation-thread.md
    §2.4](../../conventions/conversation-thread.md))`; `spec/conventions/conversation-thread.md:194`
    — `[presentation 공통 §4.6](../4-nodes/6-presentation/0-common.md) 참조.`
  - 상세: 두 링크 모두 링크 텍스트는 특정 절(§2.4/§4.6)을 명시하지만 href 는 파일
    최상단만 가리킨다(`#anchor` 없음). `spec-link-integrity.test.ts` 가드는 `#fragment`
    가 있을 때만 앵커 유효성을 검사하므로 이 두 링크는 가드를 통과하지만(파일 경로
    자체는 유효), 같은 문서 안의 다른 거의 모든 section 참조(예: 같은 파일의 `§9.7`,
    `§1.4`, `../4-nodes/3-ai/0-common.md#10-...` 등 20여 개)는 전부 `#anchor` 를 붙이는
    관례를 따른다. 이 두 신규 링크만 그 관례에서 벗어나 파일 전체를 열어 절을 직접
    찾아야 한다.
  - 제안: `#24-opt-out` / `#46-conversation-thread-opt-out-공통` (또는 실제 slug —
    `headingSlugs` 로 확인) 앵커를 붙여 기존 관례와 통일. 가드가 앵커 오류를 잡아주므로
    잘못된 슬러그를 붙여도 CI 가 검증한다.

- **[INFO]** `node-output.md §7 D1` 인용 정확성 확인 (문제 아님, 검증 결과 기록)
  - 위치: `plan/in-progress/node-output-redesign/form.md:156-161`
  - 상세: `spec/conventions/node-output.md:320` 에 실제로 `**config echo 구현 방식 —
    명시 enumeration 의무화** (D1):` 문구가 존재해 각주의 인용이 정확함을 확인했다.
    PR #997 참조(`plan/in-progress/presentation-thread-optout-drift.md:14`)도
    `git log`(`3d0bcd69b`)로 실재 확인됨 — 근거 날조 없음.

## 요약

이번 변경은 순수 spec/plan 문서 정밀화로, `codebase/` 변경이 없어 README·API 문서·CHANGELOG(선례: PR #997 도 CHANGELOG 미기재) 업데이트는 불필요하다. `spec/4-nodes/6-presentation/0-common.md` §4.6 과 `spec/conventions/conversation-thread.md` §2.4 의 대칭 편집은 코드 실측(appendInternal 게이트·5개 schema passthrough)과 정확히 부합하고 인용도 검증됐다. 다만 (1) 체크리스트가 "developer 후속 task 등록"까지 완료했다고 표시했으나 실제로는 각주 하나만 추가돼 구조화된 추적 항목(대상 파일 자신의 `## 종합 개선안` 관례)이 비어 있어 향후 재검증 라운드에서 이 D1 갭이 누락될 위험이 있고(WARNING), (2) 신규 상호 참조 두 건이 이 문서군의 앵커 관례를 따르지 않아 정밀도가 떨어진다(INFO, 가드 비차단). 두 건 모두 비차단이다.

## 위험도

LOW
