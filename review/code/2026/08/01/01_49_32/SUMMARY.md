# Code Review 통합 보고서

세션: `review/code/2026/08/01/01_49_32` (harness-block-backstop) · 리뷰어 14/14 완료 · **CRITICAL 0 · WARNING 5 · INFO 10**

## 전체 위험도

**MEDIUM** — 애플리케이션/하네스 코드 표면 자체(보안·동시성·DB·API 계약·의존성·유저가이드 동기화)는 14개 리뷰어 전원이 독립적으로 NONE~LOW 로 판정했다. 그러나 **이번 라운드의 리뷰 대상 선정 로직 자체에 결함이 있어, 14-리뷰어 fan-out 전체가 이번 브랜치가 실제로 수정한 하네스 소스(4R/5R 커밋, `block_integrity.py`/`retry_state.py`/`guard_review_before_stop.py` 등)를 단 한 줄도 보지 못했다** — 대신 과거 리뷰 세션이 만든 `.md`/`.json` 산출물 44건만 재검토했다. 따라서 "이번 라운드 Critical 0"을 5R 수정의 정식 검증 근거로 오인하면 안 된다(개별 리뷰어 8명이 수동으로 소스를 열어 대조 확인한 결과 수정 자체는 정확했지만, 이는 정식 14-agent 검증을 대체하지 않는다 — architecture 리뷰어 자신도 이 점을 명시). 여기에 이전 수정 과정에서 새로 생긴 문서 지시대상 단절 결함 1건, 잠복한 테스트 스텁 결함 1건, 감사이력에 미완주 세션이 구분 없이 영구 커밋된 hygiene 문제가 더해져 WARNING 5건으로 수렴한다. 프로덕션 코드(`codebase/`, `spec/`) 변경은 이 브랜치에 전혀 없다(전부 `.claude/` 하네스 + `plan/` 문서 + `review/` 산출물).

**메타 참고 (상태 파일 정합성)**: 이 세션의 `_retry_state.json`은 `agents_pending`에 14명 전원이, `agents_success`/`agents_fatal`은 둘 다 빈 배열로 남아 있어 bookkeeping 상으로는 아무도 완료하지 않은 것처럼 보인다. 그러나 디스크에는 14개 리뷰어 `.md` 파일이 모두 존재하며 각각 조사방법·발견사항·요약·위험도를 완결된 형태로 담고 있다. 이는 이번 라운드의 여러 리뷰어(architecture/requirement/side_effect/scope)가 다른 세션(`00_03_38`, `01_17_47`)에서 지적한 것과 동일한 클래스의 "상태 파일이 reconcile 되지 않는" 기존 하네스 갭이지, 실제 재시도가 필요한 상황이 아니라고 판단해 **14명 전원을 완료(success)로 취급**해 아래 집계에 반영했다.

## Critical 발견사항

없음 (0건) — 14개 리포트 전체에서 [CRITICAL] 태그 findings 는 0건이었다.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 프로세스/스코프 | 이번 라운드의 changeset(44개 파일)이 실제 하네스 소스가 아니라 과거 리뷰 세션 산출물뿐 — root cause 는 `get_directory_files()`가 `.gitignore`를 참조하지 않는 raw `os.walk`이고, `collect_change_infos`의 `elif args.files:` 분기에는 기본 경로(`else:`)의 `warn_if_committed_work_is_missing`과 대칭되는 안전장치가 없다는 것. 그 결과 4R/5R 이 실제로 바꾼 소스 hunk 가 이번 14-리뷰어 정식 fan-out 에 한 번도 노출되지 않았다 | `code_review_orchestrator.py:968-975`(`get_directory_files`), `:1254-1259`(`collect_change_infos` elif 분기), `:1152-1190`(`warn_if_committed_work_is_missing`, else 분기에만 배선) | 머지 전 `--branch origin/main`으로 14-리뷰어 fan-out 최소 1회 재실행; `elif args.files:` 분기에 review/ 하위 경로 advisory 경고 추가; `get_directory_files()`에 gitignore 필터 적용 |
| 2 | 프로세스/스코프(같은 root cause) | 동일 결함으로 미완료/오염된 리뷰 세션 2건이 완주된 세션과 구분 없이 커밋 이력에 영구 보존됨: (a) `01_17_47` — 형제 세션(`01_17_35`)의 gitignore 대상 `_prompts/*.md` 14건을 "문서 변경"으로 오인해 documentation 리뷰어를 허위로 강제 발동, 라우터조차 미실행 상태로 방치(SUMMARY.md 없어 게이트 판정엔 영향 없음). (b) `00_03_38` — 8/14 리뷰어(강제 포함 security 포함)가 no_status 로 끝나 자체 SUMMARY가 "MEDIUM·security 미검토·재실행 필요"를 선언했음에도, 이후 완료된 `00_33_34`로 대체됐다는 pointer 없이 그대로 커밋 | `01_17_47/meta.json`(files[] 14건 전부 `01_17_35/_prompts/*`), `01_17_47/_retry_state.json`(routing_status=pending), `00_03_38/_retry_state.json`(agents_pending 14, 미reconcile), `00_03_38/SUMMARY.md` | 완전 무산 세션(`01_17_47`류)은 커밋 전 삭제 또는 plan 문서에 "오탐, 무시" 주석; 부분 실패 세션(`00_03_38`류)에는 "→`00_33_34`로 대체됨" 한 줄 추가; #1과 동일 수정(gitignore-aware 하드닝)으로 근본 해결 |
| 3 | documentation | `RESOLUTION.md`의 W9 수정이 `test_consistency_orchestrator_state.py` 모듈 docstring 을 과거형으로 고치며 문단을 재배치 — "Four reviewers reproduced it independently" 문장의 지시 대상(`it` = 과거 self-healing 갭)이 문단 경계 너머로 끊겨, 지금은 무관한 인접 문장("CLI 출력 계약")을 가리키는 것처럼 오독됨. 어떤 라운드도 아직 지적하지 않은 신규 결함 | `.claude/tests/test_consistency_orchestrator_state.py:1-18`(특히 11-15행) | 해당 문장을 원래 문단 끝(첫 문단 "...the surrounding work exists to remove." 뒤)으로 되돌리거나, `it`을 "that gap"처럼 명시적 명사구로 교체 |
| 4 | documentation | "Mirror code_review_orchestrator" 옛 섹션 헤더가 신규 위임 설명 주석과 모순된 채 공존하는 결함이 `merge_coordinator_orchestrator.py` 한 곳(이미 `01_17_35`가 INFO로 지적)뿐 아니라 `consistency_orchestrator.py`에도 바이트 단위로 동일하게 존재 — 이전 라운드가 보고한 것보다 실제 범위가 넓고 2라운드 넘게 미해소 | `consistency_orchestrator.py:79-89`, `merge_coordinator_orchestrator.py:79-82`(및 100-112) | 두 파일의 옛 "Mirror…" 3줄 구분 블록을 `code_review_orchestrator.py`가 이미 취한 대로 제거하거나 위임 설명으로 재작성 |
| 5 | testing | `test_stop_guard_failopen.py`의 `_CLEAN_PLAN` 스텁이 이미 다른 3곳(W16)에서 고친 것과 동일한 결함("PlanDecision 흉내 스텁에 `push_blocks` 누락")을 그대로 보유 — 오늘은 호출 순서상 우연히 트리거되지 않지만, "plan이 clean인 상태로 push 훅을 구동"하는 테스트가 하나라도 추가되면 크래시 후 fail-open을 정상 ALLOW로 오인하는 결함이 재발함 | `.claude/tests/test_stop_guard_failopen.py:49-51`(`_CLEAN_PLAN`), 트리거 지점 `guard_review_before_push.py:867` | `_CLEAN_PLAN`에 `push_blocks` property 추가(다른 3곳과 형태 통일); 근본적으로는 4곳의 스텁을 공유 헬퍼(`make_clean_plan_stub()`)로 통합해 구조적 재발을 차단 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 검증 완료 | 5R CRITICAL 수정(Stop 훅 note 스로틀 마커를 `enumerate` 인덱스 대신 note 텍스트의 sha1[:12] 다이제스트로 키잉)이 현재 소스에 정확히 반영돼 있고, "동일 문구 억제/다른 문구 통과" 양방향 회귀 테스트로 vacuous 하지 않게 고정됨 — 8개 리뷰어(security/performance/concurrency/documentation/maintainability/side_effect/testing/requirement)가 교차 확인 | `guard_review_before_stop.py:370-386`, `test_block_integrity.py:472-482` | 조치 불요(검증 완료) |
| 2 | 검증 완료 | W15 수정(`summary_block_verdict()`의 동률 tie-break를 조기종료 `search()`에서 전량 스캔 `finditer()`+마지막 채택으로 전환)이 정확성 개선을 위한 의도된 트레이드오프이며 실측상 성능 회귀 없음(0.0672s, 이전 라운드 0.0804s/0.061~0.098s 범위와 동일 수준) | `.claude/_shared/block_integrity.py:104-120` | 조치 불요 |
| 3 | 하네스 위생 | `_retry_state.json` 스냅샷이 로컬 개발자의 절대 파일경로(`/Volumes/project/private/clemvion/...`)를 그대로 git 이력에 영구 기록 — 자격증명/PII 아니고 저장소 전반에 이미 확립된 기존 패턴이라 이번 diff가 새로 만든 노출면은 아님 | `review/code/2026/08/01/*/_retry_state.json`(session_dir 등 절대경로 필드) | 조치 불요(저위험). 관례를 바꾸려면 상대경로 직렬화 고려(스코프 밖 하네스 전역 변경) |
| 4 | 성능 | `review/**` 전체 `os.walk` 스캔은 세션 수에 비례한 O(N)이며, 오늘도 세션 수가 늘었지만(consistency 732→767, code 769→850) 절대 실행시간은 안정적(0.02~0.16초 범위) — 이미 plan 문서 후속 항목으로 추적 중이고 이번 diff는 그 로직을 건드리지 않음 | `.claude/hooks/_lib/review_guard.py:400,535,689-697,729-771` | 이번 PR 범위에서 조치 불요(plan 후속 항목으로 기추적) |
| 5 | 문서 정합성 | `RESOLUTION.md`(원본 태그 합산, dedup 전 — CRITICAL 2/WARNING 20/INFO 32)와 같은 세션 `SUMMARY.md`(dedup 후 최종 집계 — CRITICAL 1/WARNING 13/INFO 13)의 헤더 건수 차이가 계산 기준 차이 때문인데, 어느 문서에도 그 기준이 라벨링돼 있지 않아 오인 소지 — 실제로는 둘 다 정확함 | `review/code/2026/08/01/01_17_35/RESOLUTION.md:3`, `.../SUMMARY.md:5` | `RESOLUTION.md` 류 문서 헤더에 "(14개 리포트 원본 태그 합산, dedup 전)" 라벨 추가 고려 |
| 6 | documentation | `retry_state.load_state()`에 형제 함수 4개(`save_state`/`reconcile_state_with_disk`/`emit_summary_state`/`apply_status_update`)와 달리 여전히 docstring 없음 — 3라운드째 남은 유일한 공백. `_retry_state.json` 부재 시 stderr+`sys.exit(1)` 계약이 이름만으로 드러나지 않음 | `.claude/_shared/retry_state.py:41-47` | 한 줄 docstring 추가(예: 부재 시 exit(1) 계약 명시) |
| 7 | documentation | push/stop 훅의 모듈 최상단 docstring 이 여전히 신규 non-blocking advisory(`notes`) 메커니즘을 언급하지 않음(개별 함수 docstring은 이미 보강됨) | `guard_review_before_push.py:1-41`, `guard_review_before_stop.py:1-27` | 우선순위 낮음, 여유될 때 한두 문장 추가 |
| 8 | testing | Gate 2의 `notes` 배선 — AST 기반 구조 검증 + 헬퍼 직접호출로 원래 mutation(인자 자체 삭제)은 확실히 잡지만, `evaluate_review()`를 실제로 실행해 반환된 `.notes`의 **값**을 확인하는 통합 테스트는 여전히 없음(빈 튜플 리터럴 하드코딩 같은 더 좁은 변이는 미포착). advisory 전용 채널이라 실무 영향은 낮음 | `.claude/hooks/_lib/review_guard.py:975-1016`, `test_block_integrity.py:484-550` | 여유 되면 real-git-repo 통합 테스트 패턴을 Gate 2에도 적용해 `.notes` 실값 확인 테스트 추가(급하지 않음) |
| 9 | testing | `test_retry_state_shared.py::AtomicWriteTest`가 context manager 없이 `json.load(open(...))`를 호출해 스위트 실행 시 `ResourceWarning: unclosed file` 발생(기능 결함 아님, 다른 테스트는 `subprocess.capture_output` 사용이라 이 문제 없음) | `.claude/tests/test_retry_state_shared.py:124,137` | `with open(...) as fh:` 형태로 교체(우선순위 낮음) |
| 10 | architecture | 리뷰 대상 파일을 모으는 책임이 `get_git_diff_files`(gitignore 인지)와 `get_directory_files`(미인지) 두 갈래로 나뉘어 있음 — 이 PR 자신이 다른 곳(`_shared/retry_state.py` 등)에서 없애려는 것과 같은 종류의 책임 중복/드리프트가 이 도구 자체엔 남아 있음(이번 PR 변경 범위 밖 기존 코드) | `code_review_orchestrator.py:857-872` vs `:968-975` | 우선순위 낮음(스코프 밖). 향후 "gitignore-aware 파일 나열" 공유 헬퍼로 통합 — WARNING #1의 제안과 동일 수정으로 함께 해결 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 공격표면 없음(리뷰 산출물뿐); 5R 보안 관련 수정 2건(마커 키잉, tie-break) 소스 대조 검증 완료; `_retry_state.json` 절대경로 노출은 저위험 기존 패턴 |
| performance | LOW | 5R 변경 성능 회귀 없음(실측); Stop 훅 회귀 테스트가 스위트 시간 증가시키나 정당; `review/**` 전수 스캔 O(N) 추세 재확인(조치 불요) |
| architecture | MEDIUM | 리뷰 대상 선정 로직에 "리뷰 산출물 vs 실제 소스" 경계 없음 — 이번 라운드가 실제 하네스 소스를 전혀 검토하지 못함(WARNING #1의 원 출처) |
| concurrency | NONE | 신규 스레드/락/공유가변상태 없음; 5R CRITICAL 수정 및 W5(docstring 과대주장 정정) 재확인; 기존 lost-update/TOCTOU는 문서화된 accept |
| database | NONE | 트랜잭션/스키마/쿼리 관련 코드 없음(순수 파일시스템 I/O) |
| dependency | NONE | 신규 외부 의존성 없음; merge-coordinator 부분 위임 서술 정확·plan 후속 추적 중; 위임 경로 테스트 갭은 5R에서 이미 해소 확인 |
| documentation | LOW | W9 수정이 새 지시대상 단절 결함 생성(WARNING #3); Mirror 헤더 모순 실제 범위가 기존 보고보다 넓음(WARNING #4); 그 외 CRITICAL 1+WARNING 4건은 전부 정확히 반영 확인 |
| maintainability | NONE | 검토 대상 소스 코드 없음; 과거 라운드 WARNING(Gate2 notes 유실, Stop 훅 인덱스 키잉) 전부 이후 커밋에서 해소 확인 |
| requirement | LOW | 동일 root cause의 orphan 세션(`01_17_47`) 영구 커밋 확인(WARNING #2); 이번 라운드 자체가 4R/5R 소스 diff 미포함 지적(WARNING #1); 핵심 요구사항 재대조 전부 drift 없음 |
| scope | LOW | 미완주 세션 2건(`01_17_47` 완전 무산, `00_03_38` 부분 실패)이 대체 표시 없이 커밋(WARNING #2); 리뷰 산출물 자체는 스코프 위반 아님 |
| side_effect | LOW | orphan 세션 `01_17_47`을 디버그 로그 타임스탬프까지 대조해 상세 재현(WARNING #2와 동일 결함, 가장 상세); 이전 결함 처분 재확인 |
| testing | LOW | `test_stop_guard_failopen.py`의 `_CLEAN_PLAN` `push_blocks` 누락 잠복 결함(WARNING #5); ResourceWarning 등 사소한 잔여; 749 tests OK 재현 |
| api_contract | NONE | REST API/DTO/인증 엔드포인트 관련 코드 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21행 매칭 0건(`codebase/`·`spec/` 변경 없음) |

## 발견 없는 에이전트

- **concurrency** — 신규 스레드/asyncio/락/공유가변상태 없음(순수 리뷰 산출물 diff)
- **database** — DB 엔진/ORM/스키마/트랜잭션 관련 코드 없음
- **maintainability** — 가독성/네이밍/복잡도 체크리스트를 적용할 소스 코드가 diff에 없음
- **user_guide_sync** — `.claude/config/doc-sync-matrix.json` 21행 중 매칭 trigger 0건
- **api_contract** — HTTP 라우트/컨트롤러/DTO/페이지네이션/인증 엔드포인트 관련 코드 없음

## 권장 조치사항

1. **(최우선)** 머지 전 `--branch origin/main`(또는 올바른 upstream ref)으로 14-리뷰어 fan-out을 최소 1회 재실행해, 4R/5R이 실제로 수정한 `.claude/_shared/block_integrity.py`/`retry_state.py`/`guard_review_before_stop.py` 등 소스 hunk가 정식 리뷰를 받도록 할 것 — 지금까지는 개별 리뷰어의 수동 대조로만 정확성이 확인됐다.
2. `code_review_orchestrator.py`의 `get_directory_files()`에 `.gitignore` 인지 필터(`git ls-files --others --exclude-standard` 또는 `git check-ignore` 조합)를 추가하고, `collect_change_infos`의 `elif args.files:` 분기에 `warn_if_committed_work_is_missing`과 대칭되는 advisory 경고(대상 경로가 `review/` 하위일 때)를 배선할 것.
3. `review/code/2026/08/01/01_17_47/`(완전 무산 세션)을 정리(삭제 또는 plan 문서에 "오탐, 무시" 주석)하고, `review/code/2026/08/01/00_03_38/`(부분 실패, 8/14 no_status)에는 "`00_33_34`로 재실행·대체됨" 한 줄을 남겨 감사 이력 혼동을 방지할 것.
4. `.claude/tests/test_consistency_orchestrator_state.py` 모듈 docstring의 끊긴 지시 대상("Four reviewers reproduced it independently")을 원래 문단으로 되돌리거나 `it`을 명시적 명사구로 교체할 것.
5. `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`(및 이미 알려진 `merge_coordinator_orchestrator.py`)의 옛 "Mirror code_review_orchestrator" 헤더를 `code_review_orchestrator.py`가 이미 취한 대로 제거/재작성할 것.
6. `.claude/tests/test_stop_guard_failopen.py`의 `_CLEAN_PLAN`에 `push_blocks` property를 추가(다른 3곳과 통일)하고, 여유가 되면 4개 스텁을 공유 헬퍼로 통합할 것.
7. **(낮은 우선순위, 급하지 않음)** `retry_state.load_state()` docstring 추가, push/stop 훅 모듈 docstring에 `notes` 메커니즘 언급, `test_retry_state_shared.py`의 `json.load(open(...))`를 context manager 형태로 교체, `evaluate_review()`의 `.notes` 실제 반환값을 확인하는 통합 테스트 추가.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: `--route=all`. 전체 reviewer(14명) 실행.
- 참고: 이 세션의 `agents_forced`에도 `["documentation"]`이 기록돼 있다(사유: "문서 파일(.md/.txt/.rst/.adoc/LICENSE/CHANGELOG 등) 변경"). `--route=all`이 이미 전원을 포함하므로 실질적으로 중복 표시일 뿐이지만, 이 강제 사유 자체가 위 WARNING #1(이번 라운드의 changeset이 실제로는 과거 리뷰 산출물 44건 — 전부 `.md`/`.json` — 뿐이라는 사실)의 직접적 방증이다.
- `agents_skipped`: 없음(빈 배열) — router에 의해 생략된 reviewer 없음.
---

## ⚠️ 후속 정정 (main Claude, 이 세션 종료 후 실측)

본 SUMMARY 의 §전체 위험도가 지적한 "fan-out 이 실제 소스를 못 봤다" 는 **사실로 확인됐다.**
`meta.json` 실측: 총 44개 파일 전부 `review/**` 산출물, 소스 0개.

**근본 원인 (재현 실험으로 특정):** `code_review_orchestrator --prepare` 에서 `--branch` 가
`--files` 를 **조용히 덮어쓴다.**

    A) --files 만            → meta.json files = 2 (내가 준 그대로)
    B) --branch + --files    → meta.json files = 44 (전부 review/**, 내 목록 폐기)

1R~5R 이 무사했던 것은 우연이다 — 그때는 리뷰 산출물이 untracked 라 branch diff 가 소스만
담았다. 5R 산출물을 커밋한 순간 branch diff 의 내용물이 바뀌었고, 같은 명령이 다른 결과를 냈다.

**추가 정정 — 위 진단은 절반만 맞다.** 호출자(main) 쪽에도 결함이 있었다: 셸이 zsh 인데
`--files $FILES` 로 호출했고, zsh 는 unquoted 파라미터를 단어 분할하지 않는다. 17개 경로가
**한 덩어리 문자열 하나**로 전달됐다(`${=FILES}` 라야 분할). 즉 `--branch` 가 없었더라도 명시
목록은 애초에 전달된 적이 없다. 두 결함이 겹쳐 "명시 파일" 절차가 이 브랜치 전 라운드에서
무효였고, 소스가 리뷰된 것은 `--branch` 의 diff 가 마침 소스뿐이었기 때문이다.

**따라서 본 라운드의 "CRITICAL 0" 은 5R 수정의 검증 근거가 되지 못한다.** 개별 리뷰어가 Read 로
직접 열어 찾아낸 발견 3건(W2/W5 및 유령 세션)은 main 이 각각 실측 확인 후 처분했으나, 정식
14-agent 커버리지는 성립하지 않았다. 올바른 changeset 으로 재실행한다 (7R).
