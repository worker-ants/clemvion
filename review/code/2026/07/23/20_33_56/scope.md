### 발견사항

- **[INFO]** 후속 PR용 신규 백로그 항목(§J, 차단성 게이트 우회)이 이번 plan diff 에 통째로 추가됨 — 원 작업 범위("item C won't-do 종결 + 세그먼트 FN 해소")를 넘어서는 문서 확장
  - 위치: `plan/in-progress/harness-guard-followups.md` diff 라인 425 (`## J. push 가드 detection 이 따옴표 env 접두에서 뚫린다 — **차단성, 최우선**`) ~ 라인 453, 그리고 체크리스트 라인 479-480 (`- [ ] **J — push 가드 ...**`)
  - 상세: 이번 diff 의 표제 작업은 (1) plan §C(`_redact_inert_text` 공유)를 won't-do 로 닫는 것, (2) 그 과정에서 드러난 반대 부호 결함(세그먼트 미검사 FN)을 `guard_default_branch_bash.py` 에서 해소하는 것이다. 그런데 diff 에는 이와 별개로, `guard_review_before_push.py`(**차단형** 게이트)의 `_GIT_PUSH` 정규식이 따옴표 env 접두에서 `git push` 자체를 탐지 못해 리뷰-before-push 게이트 전체가 우회된다는, 훨씬 더 심각하고 완전히 다른 파일·다른 성격(nudge → hard gate)의 신규 발견을 §J 로 신설해 문서화하고 있다. RESOLUTION.md(`review/code/2026/07/23/20_02_29/RESOLUTION.md` 라인 55-74)가 "이 PR 에서 고치지 않는 이유"를 명시하고 실제 코드 수정은 포함하지 않았으므로 **기능적 스코프 침범은 아니다** — 하지만 plan 문서 자체에는 새 섹션 전체(표·근거·후속 작업 항목 2개)와 체크리스트 최우선 항목이 이번 diff 로 함께 들어간다. 발견 자체가 W1 조사 중 파생됐다는 점에서 기록할 필요성은 이해되나, 순수 "작업 범위" 관점에서는 원 커밋 제목이 다루는 대상(nudge 훅의 FN)과 무관한 별도 이슈(차단형 게이트의 보안 우회)가 같은 diff 에 섞여 있다는 사실 자체는 남는다.
  - 제안: 스코프상 차단 사유는 아님(코드 수정 없음, 별도 PR 로 명시적으로 위임됨). 다만 후속 리뷰에서 "이 diff 가 §J 이슈까지 고치는 중인가?"로 혼동하지 않도록, RESOLUTION.md 처럼 plan §J 서두에도 "본 PR 은 발견·기록만, 수정은 별건"이라는 한 줄이 이미 있으므로 그대로 유지하면 충분.

- **[INFO]** 이미 `plan/complete/` 로 이동된 완료 문서에 사후 추가 편집
  - 위치: `plan/complete/harness-push-guard-subcommand-detection.md` diff 라인 166-172 (신규 4줄 삽입)
  - 상세: 프로젝트 컨벤션상 `plan/complete/` 는 완료된 작업의 종착점이고 `plan/complete/archive/from-*/` 만 예외적으로 사후 편집 대상이다. 이번 diff 는 이미 완료 처리된 다른 plan 에 "여기서 만든 `_redact_inert_text` 공유 제안이 §C 에서 won't-do 로 닫혔다"는 상호 참조 4줄을 순수 append 방식으로 추가한다. 원 내용 재작성이나 결론 번복이 아니라 순수 forward-reference 이고, 그 문서의 §C 관련 서술이 이번 결정의 근거 대상이므로 실질적 위험은 낮다. 다만 "완료 문서는 건드리지 않는다"는 일반 원칙에 대한 예외 사례이므로 인지 목적으로 기록한다.
  - 제안: 조치 불필요. 향후 유사 사례가 반복되면(완료 plan에 사후 상호참조 추가) 예외 패턴으로 컨벤션 문서에 한 줄 남기는 것을 고려할 수 있음.

### 스코프 대조 (핵심 코드·테스트·문서)

- `.claude/hooks/guard_default_branch_bash.py` — `_is_mutating` 을 세그먼트 분할 + `VAR=value`(따옴표 포함) 접두 스킵 + 단일 `&` 구분자로 확장. plan 체크리스트(파일 7, 라인 193-210)에 명시된 항목과 1:1 대응하며, 무관한 함수 리팩토링·신규 기능은 없음.
- `.claude/hooks/guard_review_before_push.py` — 순수 교차 참조 주석 1개 블록 추가(라인 141-148). 기능 변경 없음. RESOLUTION.md W2 처리 방식과 일치(공유 추출 대신 주석).
- `.claude/tests/test_guard_default_branch_bash_mutating.py`(신규) — 위 코드 변경 전부에 대응하는 pin. `EnvPrefixTest`(따옴표 값 포함), `BacktrackingTest`(ReDoS), `AcknowledgedFalsePositiveTest`(heredoc 케이스 포함) 모두 diff 의 코드 변경과 직접 대응하며 범위를 벗어나는 무관한 테스트는 없음.
- `.claude/tests/README.md` — 신규 테스트 파일 1행 카탈로그 등재. `test_tests_readme_catalog.py` 가드 대응 필수 동반 수정.
- `.claude/docs/worktree-policy.md` — D 정책 서술 1문단만 코드 동작에 맞춰 갱신. 무관한 절 수정 없음.
- `plan/in-progress/harness-guard-followups.md` — Overview 정정 + §C 결론 갱신 + §J 신설(위 INFO 참고) + 체크리스트 동기화. 본문/체크리스트 양쪽 갱신 컨벤션 준수.
- `review/code/2026/07/23/20_02_29/*`(RESOLUTION.md, SUMMARY.md, 9개 reviewer 산출물, `_retry_state.json`, `meta.json`) — 직전 리뷰 라운드의 산출물을 최초로 커밋하는 것으로, 프로젝트 컨벤션상 `review/` 는 gitignore 대상이 아니며 "구현 완료 후 review→fix→커밋" 워크플로의 정상적 부산물이다. 이번 diff 자체의 스코프 확장이 아니라 이전 리뷰 세션 실행 결과의 아카이빙.

### 요약

핵심 코드 변경(`guard_default_branch_bash.py` 의 세그먼트 분할 + `VAR=value` 접두 스킵, 및 그 후속 W1/W2/W3 리뷰 반영)은 plan 체크리스트·RESOLUTION.md 가 명시한 단일 작업 목표에 정확히 대응하며, 무관한 리팩토링·포맷팅·불필요한 임포트·의도치 않은 설정 변경은 발견되지 않았다. `guard_review_before_push.py` 변경은 순수 주석 추가로 기능에 영향 없다. 유일하게 주목할 점은 plan 문서에 이번 작업과 직접 관련 없는 별도의 차단형 게이트 보안 결함(§J)이 신규 섹션 전체로 함께 커밋된 것인데, 실제 코드 수정 없이 "별건 PR로 위임"이 명시돼 있어 기능적 스코프 침범은 아니고 문서 수준의 부수적 확장에 그친다. `plan/complete/` 문서에 대한 사후 append 도 순수 상호참조로 위험이 낮다. `review/code/2026/07/23/20_02_29/*` 다수 파일 추가는 직전 리뷰 라운드 산출물의 정상적 커밋이며 스코프 위반이 아니다. 종합적으로 이번 diff 는 의도된 범위에서 벗어나지 않았다.

### 위험도
LOW
