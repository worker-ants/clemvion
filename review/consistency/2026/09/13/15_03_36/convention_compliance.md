# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-done` (diff-base `origin/main`, scope `spec/conventions/`)
`spec/conventions/` 자체의 델타는 0파일(정상 — 이 브랜치는 conventions 문서를 바꾸지 않았다). 검토 대상은 구현 diff 5파일(`PROJECT.md` 1줄 · `guide-error-code-existence.test.ts`→`guide-identifier-existence.test.ts` · `guide-error-code-scan.ts`→`guide-identifier-scan.ts` · `guide-sanitized-message-parity.test.ts` 4줄)이 기존 `spec/conventions/**`(특히 `review-citations.md`·`user-guide-evidence.md`·`error-codes.md`)를 준수하는지다. 프롬프트 번들의 diff 섹션(`## 구현 변경 사항`)이 예산 절단으로 통째로 누락돼 있어, `git -C <worktree> diff origin/main...HEAD` 로 워킹트리를 직접 대조했다.

## 발견사항

- **[CRITICAL]** 신규 코드 주석에 `spec/conventions/review-citations.md §2` 가 명시적으로 금지한 **bare `hh_mm_ss`** 인용 형태를 새로 추가
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:98` — `// (`/ai-review` `14_41_14` testing WARNING#6). 좁은 회귀 형태를 이름으로 되돌린다.`
  - 위반 규약: `spec/conventions/review-citations.md §2 "날짜를 포함한다"` — "**bare `hh_mm_ss` 는 쓰지 않는다**" 를 표로 명문화(`전체 경로` 권장 / `날짜+시각` 허용 / `bare 시각` **금지**). 적용 범위는 §3 표의 "`codebase/**` 의 코드·테스트 주석 — 적용" 이 정확히 이 파일에 해당한다.
  - 상세: `git diff origin/main...HEAD` 로 대조한 결과 이 줄은 이번 PR 이 **새로 추가**한 것이다(구 파일 `guide-error-code-existence.test.ts` 에는 `14_41_14`/`ai-review`/`WARNING#6` 문자열이 전혀 없었다 — `git show origin/main:...guide-error-code-existence.test.ts | grep` 확인). 인용 대상 세션(`review/code/2026/09/13/14_41_14`)은 실존하지만(`ls` 확인), 날짜가 없어 다른 날짜의 같은 시각(`14_41_14`)과 훗날 구분 불가 — 이 규약이 §2 에 적은 근거(리포지토리 전역에 날짜만 다른 동일 시각이 46건 존재)가 그대로 적용되는 사례다. 더 나아가 **같은 PR** 이 같은 세션(`review/code/2026/09/13/14_41_14`)을 **다른 파일**(`guide-identifier-scan.ts:73`)에서는 규약이 권장하는 전체 경로 형태(`` `review/code/2026/09/13/14_41_14` ``)로 정확히 인용하고 있어, 같은 diff 안에서 표기가 갈린다.
  - 제안: `14_41_14` 를 `review/code/2026/09/13/14_41_14` (전체 경로) 로 교체. 예: `` (`/ai-review`(`review/code/2026/09/13/14_41_14`) testing WARNING#6). ``

- **[INFO]** `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 상단 주석이 `spec/conventions/user-guide-evidence.md` 를 "가드 가족" 의 SoT 로 인용하지만, 그 문서 §2 "Build-time 가드 (3건)" 표는 `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts` 셋만 열거하고 이 식별자-존재성 가드(구 `guide-error-code-existence.test.ts`/신 `guide-identifier-existence.test.ts`)는 등재하지 않는다
  - target 위치: `guide-identifier-scan.ts:4`("SoT: spec/conventions/user-guide-evidence.md (가드 가족) …") / `guide-identifier-existence.test.ts:25`("가족·위치의 근거는 `spec/conventions/user-guide-evidence.md`")
  - 위반 규약: 직접적인 조항 위반은 아니나, `error-codes.md §4.2` 가 스스로 지적한 "참조가 착지하지 않는 상태" 패턴(문서가 다른 문서를 SoT 로 가리키는데 그 문서엔 실제로 없음)과 같은 형태다.
  - 상세: `git log -S`/`git show origin/main:...guide-error-code-scan.ts` 로 확인한 결과 이 문구는 `#1330`(이전 PR) 부터 이미 동일하게 있었다 — **이번 PR 이 새로 만든 drift 가 아니다.** `spec/conventions/` 델타가 0인 것과 일관되게, 이번 PR 은 이 문구를 그대로 유지만 했다.
  - 제안: 이번 PR 범위에서 강제할 사안은 아니다(신규 회귀 아님). 다음에 `user-guide-evidence.md` 를 편집할 기회가 있으면 §2 표에 4번째 행(식별자 실재성 가드)을 추가하거나, 코드 주석의 SoT 인용을 더 정확한 위치(예: 별도 `spec/conventions/` 문서 부재를 인정하고 "가드 가족" 표현을 걷어냄)로 조정하는 편이 좋다.

## 요약

이번 PR 은 `spec/conventions/**` 문서 자체를 바꾸지 않았고(델타 0, 정상), 코드 diff 도 대체로 기존 규약(§리뷰 인용 전체 경로 형태·`GUIDE_EXTERNAL_VOCABULARY` 허용목록 4강제·`code:`/`SoT` 인용 구조)을 잘 따른다. 다만 신규 테스트 파일에 `spec/conventions/review-citations.md §2` 가 명시적으로 금지한 **bare `hh_mm_ss`** 인용을 하나 새로 추가했고, 같은 PR 의 다른 파일은 같은 세션을 규약이 권장하는 전체 경로로 정확히 인용하고 있어 표기 불일치가 뚜렷하다. `user-guide-evidence.md` 의 SoT 참조 착지 이슈는 실존하나 이번 PR 이전부터 있던 것으로 신규 회귀가 아니다.

## 위험도

MEDIUM
