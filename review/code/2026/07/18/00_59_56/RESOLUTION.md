# RESOLUTION — 2026/07/18/00_59_56

MEDIUM · Critical 0 · Warning 13. main 이 사전 분류·검증한 지시(반드시 고칠 것 /
문서화만 / 절대 건드리지 말 것)를 그대로 따라 처리했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1  | 코드 | `441820b89` | `_lock_is_dead` 를 `_file_mtime` 초단위 산술로 통일(`find -mmin` 분단위 truncation 제거). sub-60s grace 회귀 테스트 2건 추가 |
| W2  | 문서화 (코드 미변경, 지시에 따름) | `441820b89` | hung `npm install` 타임아웃 부재 — bootstrap 주석 + plan §A 에 알려진 한계로 명시 |
| W3  | 코드 | `8308515c4` | `harness-checks.yml` paths 에 `.githooks/**` 추가 |
| W4  | 건드리지 않음 (지시에 따름) | — | npm 취약점(undici HIGH 등) — diff 밖, `plan/in-progress/harness-guard-followups.md` §F 에 이미 등록. 수정 안 함 |
| W5  | 건드리지 않음 (지시에 따름) | — | 의존성 스캔 갭 — 위와 동일, §F 등록 완료. 수정 안 함 |
| W6  | **미분류 — 아래 "보류·후속 항목" 참조** | — | main 의 이번 지시 3분류(반드시 고칠 것/문서화만/건드리지 말 것) 어디에도 명시되지 않음. "지정한 것만 처리" 원칙에 따라 손대지 않았다 |
| W7  | 코드 | `e8a056fec` | `lint_mermaid_posttooluse.py` 의 SoT import 를 형제 훅과 동일한 명시적 fail-open(try/except → `is_ready=None`)으로 정렬 |
| W8  | 코드(테스트) | `e8a056fec` | PostToolUse 2건 + pre-commit 2건, 실행 기반 서브프로세스 회귀 테스트 신설(`MERMAID_LINT_TOOL_DIR` 오버라이드 + 스텁 `node`) |
| W9  | 코드(테스트) | `441820b89` | `test_concurrent_sessions_install_at_most_once` 를 `assertEqual(1)` + 완료 마커 확인으로 강화 |
| W10 | 코드(문서) | `441820b89` | 락 해제 주석 "rmdir's" → 실제 명령(rm -rf)에 맞게 정정 |
| W11 | 코드(문서) | `441820b89` | 테스트 모듈 docstring 에 신규 두 축(liveness·throttle) 요약 추가 |
| W12 | 문서화 (코드 미변경, 지시에 따름) | `441820b89` | liveness PID 재사용(ABA) — bootstrap 주석 + plan §A 에 알려진 한계로 명시 |
| W13 | 코드(테스트) | `e8a056fec` | `test_marker_without_node_modules_dir_is_not_ready` 를 `os.path.isdir` mock 기반 실제 검증으로 교체 |
| I1~I17 | 건드리지 않음 (지시에 따름) | — | 리뷰어 전원 "조치 불요"/"우선순위 낮음"/"diff 밖" 표기. 손대지 않음 |

**ITEMS 카운트(Critical+Warning 만, INFO 제외)**: 13개 중 10개 조치 완료(W1·W3·W7·W8·
W9·W10·W11·W13 코드/테스트 + W2·W12 알려진 한계 문서화). W4·W5 는 지시에 따라 diff 밖
유지(별도 plan §F 가 이미 추적). **W6 은 main 의 세 분류 어디에도 없어 미조치 — 아래
참조.**

## TEST 결과

- lint  : 해당 없음 (변경 파일이 모두 `.claude/**`·`.github/**`·`plan/**` — `run-test.sh
  lint`(pnpm 워크스페이스: backend/frontend/web-chat/channel-web-chat/internal
  packages)가 커버하는 `codebase/**` 를 전혀 건드리지 않아 실행해도 이 diff 에 대해
  아무 신호도 주지 않는다. 대신 harness 자체 스위트(아래)로 전량 검증)
- unit  : 통과 — `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` **310/310**.
  세션 시작 시점(직전 커밋 `d31f99a11`)으로 6개 변경 파일을 일시 되돌려 재측정한
  베이스라인은 **304/304 통과** — 순증 6건(W1 sub-minute grace 테스트 2건 + W8
  PostToolUse/pre-commit 실행 기반 테스트 4건). W9·W10·W11·W13 은 기존 테스트를
  강화/교체한 것이라 개수 자체는 늘지 않는다.
- build : 해당 없음 (`codebase/**` 무변경 — build 스테이지 대상 아님)
- e2e   : **면제** (화이트리스트: `PROJECT.md` §e2e 면제 화이트리스트의 `.claude/**`·
  `.github/**`·`plan/**` — 변경 파일 6개(`.claude/tools/bootstrap-session.sh`,
  `.claude/hooks/lint_mermaid_posttooluse.py`, `.claude/tests/test_bootstrap_mermaid_install.py`,
  `.claude/tests/test_mermaid_lint_ready.py`, `.github/workflows/harness-checks.yml`,
  `plan/in-progress/harness-guard-followups.md`) 전부가 이 3개 prefix 의 부분집합)
- plan-frontmatter : 통과 — `plan/in-progress/harness-guard-followups.md` 를 수정해
  `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts`
  실행, **93/93 통과**

### 비-vacuity 실증

- **W1**: `test_sub_minute_grace_young_dead_pid_lock_is_not_stolen`(age=5s, grace=30s)
  와 `test_sub_minute_grace_dead_pid_lock_is_stolen_once_aged_past_it`(age=40s,
  grace=30s) 두 신규 테스트를, `_lock_is_dead` 를 수정 전(`find -mmin
  "-$(( lock_grace / 60 ))"`) 코드로 일시 되돌려 재실행 — **age=5s 케이스만
  FAIL**(`AssertionError: 1 != 0`, 30/60=0 truncation → `find -mmin -0` 이 항상
  무매칭이라 나이 게이트가 무력화돼 young 락도 훔쳐감), age=40s 케이스는 수정
  전/후 모두 PASS(두 나이 모두 "이미 aged" 로 오판되는 값이라 이 케이스 단독으로는
  뮤턴트를 못 잡음 — age=5s 케이스가 실제 판별력의 핵심). 확인 후 수정 코드로 복원,
  두 테스트 모두 재통과 확인.
- **W8 (PostToolUse)**: `is_ready is None or not is_ready(tool_dir)` 를 `is_ready is
  None or is_ready(tool_dir)` (SUMMARY 가 지목한 "`if not is_ready` → `if is_ready`"
  뮤턴트) 로 일시 변경 — 신규 `PostToolUseExecutionTest` 2건 모두 FAIL(스텁 `node`
  호출 여부·exit code 불일치), 기존 `ConsumerBindingTest.test_posttooluse_imports_is_ready`
  (assertIn 기반)는 **그대로 PASS** — "소스 텍스트 검사의 맹점"을 직접 재현. 원복 후
  전량 재통과 확인.
- **W8 (pre-commit)**: `.githooks/pre-commit` 의 `python3 "$mermaid_ready" ...` 앞에
  `!` 를 추가(SUMMARY 가 지목한 두 번째 뮤턴트 형태) — 신규 `PreCommitExecutionTest`
  2건 모두 FAIL, 기존 `test_precommit_reads_via_the_shared_helper`(assertIn 기반)는
  **그대로 PASS**. 원복 후 `git diff .githooks/pre-commit` 빈 diff 로 완전 복원 확인,
  전량 재통과 확인.
- **W9**: `mkdir "$lock" 2>/dev/null` 을 `false && mkdir "$lock" 2>/dev/null` 으로
  일시 변경(락을 아무도 못 얻는 뮤턴트, "5세션 전원 skip" 재현) — 강화된 신규 단언
  (`assertEqual(1)`)은 FAIL(`0 != 1`), 원래의 구 단언(`assertLessEqual(1)`)으로
  스크립트 치환해 같은 뮤턴트에 재실행하면 **PASS**(0 ≤ 1 이 참이라 무신호 실패를
  놓침) — "전원 skip 도 통과시키던 구멍"을 직접 재현. 양쪽 모두 원복 후 재통과 확인.

## 보류·후속 항목

- **W6 (미조치, 다음 세션에서 판정 필요)**: `bootstrap-session.sh` 책임#2(mermaid-lint
  설치)를 `ensure-mermaid-lint-deps.sh` 로 추출하자는 아키텍처 제안. main 의 이번
  지시는 "반드시 고칠 것"(W1·W3·W7·W8·W9·W10·W11·W13), "문서화만"(W2·W12), "절대
  건드리지 말 것"(W4·W5, I1~I6) 세 그룹만 명시했고 **W6 은 그 어디에도 없다** — scope
  오염 방지 원칙("지정한 것만 처리")에 따라 코드도, 문서화도 하지 않고 그대로
  두었다. 다음 세션에서 (a) W2/W12 처럼 알려진 한계로 문서화할지, (b) 실제 추출을
  수행할지, (c) I-항목처럼 조치 불요로 종결할지 판단 필요.
- **W4·W5 (건드리지 않음)**: `.claude/tools/mermaid-lint` npm 트리의 실제 취약점
  (undici HIGH 등)과 보안 스캔 사각지대. `plan/in-progress/harness-guard-followups.md`
  §F 에 이미 별건으로 등록되어 있어 이번 세션은 손대지 않았다(지시 명시).
- **I1~I17**: 전부 리뷰어가 "조치 불요"/"우선순위 낮음"/"diff 밖" 표기. 조치 없음.

## 참고

- 직전 라운드 RESOLUTION: `review/code/2026/07/17/20_06_45/RESOLUTION.md`
- 이번 세션 SUMMARY: `review/code/2026/07/18/00_59_56/SUMMARY.md`
- fix commit 3건: `441820b89`(bootstrap 락 판정+동시성 테스트+W2/W12 문서화),
  `e8a056fec`(소비처 fail-open 정렬+실행 기반 테스트), `8308515c4`(CI paths)
