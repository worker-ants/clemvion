# 문서화(Documentation) 리뷰

## 범위에 대한 메모

이 diff(`origin/main...HEAD`, 92개 파일 표시분)는 harness 위생 4개 코드 파일
(`plan_guard.py`/`test_plan_guard.py`/`spec-links.test.ts`/`stray-tool-tags.test.ts`),
`plan/**` 트래킹 문서 다수, `spec/conventions/error-codes.md` 1개 문단, 그리고 이전 2개
리뷰 라운드(`22_25_37`, `22_44_29`)와 6개 consistency 라운드의 **커밋된 세션 산출물**로
구성된다. 실제 "이번에 새로 문서화가 필요한 코드"는 4개 파일뿐이며, 이 4개는 이미 스스로
매우 상세한 근거 주석·docstring·plan 기록을 갖추고 있다(리뷰 1R·2R 가 이미 지적한 매직
넘버·정렬 기준·비대칭 카운팅 근거가 전부 인라인 주석/docstring 으로 반영됨). 아래 발견사항은
그 위에서 남은 잔여 지점과, 실측으로 대조해서 드러난 사소한 불일치에 집중했다.

## 발견사항

- **[INFO]** `_all_checkboxes_done()` 함수 docstring 이 새 비대칭 카운팅 규칙을 설명하지 않는다
  - 위치: `.claude/hooks/_lib/plan_guard.py` — `def _all_checkboxes_done(repo_root: str, plan_rel: str) -> bool:` 바로 아래 한 줄 docstring
  - 상세: docstring 은 `"""True when the plan has at least one checkbox and none are open (`[ ]`)."""` 그대로다. 이번 PR 은 이 함수의 카운팅 규칙을 **비대칭**으로 바꿨다 — 열린 체크박스는 인용문(`>`) 안이어도 세지만(거부권), 닫힌 체크박스는 인용문 안이면 세지 않는다(`elif not _QUOTED.search(m.group("quote")): done_count += 1`). 이 근거는 `_CHECKBOX` 정규식 위 20줄짜리 모듈 레벨 주석에는 충실히 있지만, 정작 그 규칙을 **소비하는** 이 함수 자신의 docstring 에는 반영되지 않았다. 함수만 보고 호출하는 다음 사람은 "체크박스가 하나라도 있고 열린 게 없으면 완료" 로만 읽는다 — "닫힌 체크박스는 자기 것만 센다" 는 조건이 빠진 채다.
  - 제안: docstring 한 줄을 보강 — 예: `"""True when the plan has ≥1 checkbox of its own done and none open (quoted checkboxes: open still vetoes, done does not count)."""` 정도로, 규정을 함수 시그니처 바로 옆에도 요약해 둔다.

- **[INFO]** 커밋된 이전 리뷰 라운드 문서(`review/code/2026/09/01/22_25_37/documentation.md`)가 `error-codes.md` 변경을 "위임"으로 잘못 서술한다 — 실제로는 "삭제"였다
  - 위치: `review/code/2026/09/01/22_25_37/documentation.md`의 "확인했으나 문제 없음" 세 번째 항목("`spec/conventions/error-codes.md`(파일 68)에 추가된 ... 목적지 필드도 카탈로그 SoT(`3-error-handling.md §1`)로 위임하고 직접 재선언하지 않아, 앞선 WARNING(SoT 중복)도 해소돼 있다.")
  - 상세: `plan/complete/spec-draft-error-code-two-surfaces.md`와 `review/consistency/2026/09/01/21_56_30/cross_spec.md`(그리고 그 앞 라운드들)를 직접 대조하면, 목적지 필드(`Execution.error`/`NodeExecution.error`) 서술을 다룬 방식은 "카탈로그 SoT 로 위임"이 아니라 **문장 자체를 완전히 삭제**하는 것으로 최종 확정됐다(`21_56_30/cross_spec.md:21`: "그 위임 문장 **자체를 삭제**하는 방식으로 해소했다"; `21_56_30/convention_compliance.md:21`: "목적지 필드 서술 자체를 **완전히 제거**했다"). 실제로 `spec/conventions/error-codes.md`의 이번 diff(§Overview 새 문단)에도 `output.error.code`/`Execution.error`/`NodeExecution.error` 등 목적지 필드 언급이 전혀 없다 — "위임"이라면 `3-error-handling.md §1`(또는 `1-data-model.md`)로의 링크가 있어야 하는데 없다. 5차 consistency 라운드(`21_49_21`)가 정확히 "그 위임 문장이 가리키는 SoT 가 실제로 그 정보를 갖지 않는다"고 지적했고, 6차 라운드에서 draft 는 그 잘못된 포인터를 **고치는 대신 문장을 없애는** 쪽을 택했다 — plan 본문도 "포인터를 고치는 대신 문장을 없앴다"고 명시한다. 즉 round-1 documentation 리뷰의 "위임" 서술은 이 6라운드짜리 반전 이력의 결론과 어긋난다.
  - 제안: 이 파일은 이미 커밋된 세션 기록(다른 항목들과 동일하게 point-in-time 산출물)이라 사후 수정을 요구하는 성격은 아니다. 다만 향후 이 로그를 근거로 "목적지 필드가 어디로 위임됐는지" 를 추적하는 사람이 있다면 잘못된 실마리를 따라갈 수 있으니 참고용으로만 남긴다 — 조치 불요.

## 확인했으나 문제 없음 (근거 기록)

- `stray-tool-tags.test.ts`(신규 파일)는 이번 changeset 안에서 가장 doc-heavy 한 파일이다. 헤더 주석의 실측 수치를 직접 검증했다 — `plan/` 5파일 6건, `review/` 31파일(`grep -rlE '^\s*</?(content|invoke|parameter|function_calls|antml)\b[^>]*>\s*$' review/ | wc -l` → 31, 일치). `MIN_EXPECTED_MD_FILES`(`plan: 250`, `spec: 190`)는 docstring 이 "실측의 절반 언저리"라고 주장하는데, 실제 루트별 실측(`plan` 505, `spec` 386)의 각각 49.5%/49.2%로 일치한다. `TOOL_TAGS` 배열도 docstring "알파벳 순" 주장대로 `antml < content < function_calls < invoke < parameter` 순으로 정렬돼 있다. 이 파일은 1R·2R INFO(매직 넘버·정렬 기준·전제 테스트 vacuous)를 모두 상수화·리터럴 고정·루트별 하한으로 흡수한 상태다.
- `.claude/hooks/_lib/plan_guard.py`의 `_CHECKBOX`/`_QUOTED` 정규식과 그 위 주석은 실제 카운팅 로직(`_all_checkboxes_done` 내 `if mark==" ": open_count+=1` / `elif not _QUOTED.search(quote): done_count+=1`)과 정확히 일치한다. 인용된 선례 문서(`deps-peer-gating-and-eslint10.md`, `spec-draft-error-cause-criterion.md`, `auth-config-webhook-followups.md`)도 실제로 존재한다.
- `.claude/docs/plan-lifecycle.md`에 추가된 "이동하는 문서 자신의 outgoing 링크" 절이 인용하는 `findBrokenPlanLinks` JSDoc(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:433-439`)을 직접 열어 대조했다 — "`plan/complete/**`는 의도적으로 제외, `plan-lifecycle.md §3`가 point-in-time 기록을 옛 경로에 둔다"는 근거 문구가 정확히 일치하고, `plan-lifecycle.md`의 해당 절도 실제로 `## 3. 이동 규칙` 아래에 있어 "§3" 인용이 정확하다.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`에 추가된 멀티라인 ANCHOR fixture와 line 단언(`#nope`→4, `./missing.md`→5, `./real.md#no-such-anchor`→7=시작 줄)을 fixture 원문과 줄 단위로 대조 — 정확히 일치한다.
- `spec/conventions/error-codes.md`에 추가된 `EngineErrorCode` 병기 문단의 사실 주장(같은 파일에 자매 const, 키 비중첩)을 `error-codes.ts:8,147` + `error-codes.spec.ts:59`(`shares no code with ErrorCode` 테스트)로 직접 확인했고, "§3 예외 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT` 이 이미 `EngineErrorCode` 멤버"라는 주장도 `error-codes.ts:161`(JSDoc이 `error-codes.md §3`를 SoT로 역참조)와 `error-codes.md:80`의 해당 행으로 확인했다. "층(layer)" 대신 "비대칭" 프레이밍을 최종 채택한 것도 6라운드 consistency 이력과 일치한다.
- `plan/in-progress/harness-review-gate-followups.md`에 새로 등재된 두 후속 항목(SoT 미등재, `plan-stale-audit.sh` drift)은 유예 사유·재개 신호·어긋나는 방향을 명시해 project 관례(`feedback_deferral_rationale_must_be_measured.md` 계열)를 충족한다.
- CHANGELOG.md 갱신 누락 여부: `git log --oneline -15 -- CHANGELOG.md`로 최근 반영 이력을 확인한 결과 전부 `codebase/` 제품 기능 변경(backend/frontend fix·feat) 커밋이었고, harness/plan/spec-convention 성격 커밋이 CHANGELOG를 갱신한 선례는 없다 — 이번 변경도 그 관례를 깨지 않는다.

## 요약

실제 코드 변경 4개 파일은 이례적으로 잘 문서화돼 있다 — 근거 주석·실측 수치·docstring 을 직접 대조해도 어긋나는 지점을 찾지 못했고, 2라운드에 걸친 앞선 리뷰가 지적한 매직 넘버·정렬 기준·vacuous 전제 문제도 이미 상수화·리터럴 고정으로 흡수됐다. 남은 지점은 둘 다 경미하다 — (1) `_all_checkboxes_done()` 자신의 docstring 이 이번에 도입된 비대칭 인용 규칙을 요약하지 않는 것(모듈 레벨 주석에는 있음), (2) 이미 커밋된 1라운드 리뷰 로그 한 줄이 `error-codes.md` 목적지 필드 처리를 "위임"으로 서술하지만 실제 6라운드 consistency 이력의 결론은 "삭제"였다는 것 — 둘 다 차단 사유는 아니다. `spec-impl-evidence.md` SoT 미등재(`stray-tool-tags.test.ts`)는 1R·2R 에서 이미 발견·유예 근거·재개 신호까지 갖춰 등재됐으므로 이번 라운드에서 재차 지적하지 않는다.

## 위험도

LOW
