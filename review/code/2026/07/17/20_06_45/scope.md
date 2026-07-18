# 변경 범위(Scope) 리뷰 — bootstrap mermaid-lint 설치 경쟁 + 부분 설치 영속 수정

## 검증 방법

- `git diff --stat origin/main...HEAD` 로 payload 의 4개 파일·변경량(`+360/-5`)과 실제 워크트리
  diff 를 대조 — 완전히 일치(diff-list 누락 없음).
- `git log --oneline origin/main..HEAD` → 단일 커밋(`bbf72268e`, "fix(harness): mermaid-lint
  설치 경쟁 + 부분 설치 영속 — 마커 + mkdir 락"). 커밋 메시지가 plan 항목 A 설명과 정확히 일치.
- `bootstrap-session.sh` / `.gitignore` 의 현재 파일 내용을 직접 Read 해 diff 결과와 대조 —
  정확히 일치, stale·누락 없음.
- diff hunk 경계 확인(`@@ -31,13 +31,43 @@`): 변경은 bootstrap-session.sh 의 섹션
  2(mermaid-lint 설치)에만 있고, 섹션 1(githooks 활성화)·섹션 3(state 마커 GC)·섹션
  4(reaper 호출, anchor 파생)는 문자 그대로 무변경.
- 신규 테스트 파일을 기존 자매 테스트 `.claude/tests/test_reap_merged_worktrees.py` 와 대조 —
  모듈 docstring 스타일, `import _harness  # noqa: F401`, `_git`/`_write` helper 명명, stub
  스크립트 패턴(`_GH_STUB` ↔ `_NPM_STUB`)이 동일 관례.
- 신규 테스트가 사용하는 `REAP_MIN_INTERVAL`/`REAP_GH_BIN` 이 `reap-merged-worktrees.sh` 자체
  문서화 env(`Env: REAP_GH_BIN`, `REAP_MIN_INTERVAL`)임을 원본에서 확인 — 새로 발명한 테스트
  seam 아님.
- plan 문서가 인용한 과거 리뷰 근거 실물 대조: `review/code/2026/07/17/18_04_20/concurrency.md`
  에 "mermaid-lint `npm install` 은 모든 워크트리가 공유하는 단일 디렉터리에 대해
  check-then-act 경쟁을 갖고 있다" WARNING 이 실제로 존재 — plan 의 "출처" 표기가 날조가
  아님을 확인.

## 발견사항

- **[INFO]** 신규 plan 문서가 이번 PR 이 구현하지 않는 후속 항목(B~E) 4건 + won't-do 1건을
  함께 등록
  - 위치: `plan/in-progress/harness-guard-followups.md`
  - 상세: 문서는 `.claude/` 하네스 가드 관련 미해결 리뷰 발견 5건(A~E)을 한 plan 에 모은다.
    이번 diff 로 실제 구현·완료된 것은 A(bootstrap npm 경쟁 + 부분 설치)뿐이며, B(reaper
    `gh` N+1 배치화)·C(`_lib/git_command_detection.py` 추출)·D(push 훅 `main()` 테스트)·
    E(fail-open 정책 결정)는 체크박스 `[ ]` 로 미착수 상태다. 이 4건에 대응하는 코드 변경은
    diff 어디에도 없다 — 변경 파일 4개 중 실제 코드 변경은 `bootstrap-session.sh` 하나뿐이고
    나머지(테스트·`.gitignore`)도 그 하나의 기능 변경에 대한 직접 종속물이다. 문서의
    Rationale 절도 "기존 어떤 plan 도 이 항목들을 커버하지 않아 `review/` 산출물에만 남아
    증발할 상태였다"는 근거를 대고 있고, 이는 실제 grep 결과(0건 커버)로 뒷받침된다.
  - 제안: 조치 불요. `plan/` 갱신은 developer skill 의 정상 쓰기 범위이고, "리뷰 산출물에만
    남아 증발하는 발견을 plan 으로 승격해 등록"하는 것은 CLAUDE.md 명시 관례
    (`plan/in-progress/<name>.md` 라이프사이클) 및 이 저장소의 기존 선례(gap-closure·
    refactor-04 후속 결정 plan)와 부합한다. plan 등록과 코드 구현 범위 사이의 경계를 문서
    스스로(체크박스 + Rationale) 명확히 긋고 있다.

- **[INFO]** bootstrap-session.sh 의 조건문 구조 변경은 무관한 리팩토링이 아니라 신규 로직이
  요구하는 최소 재구성
  - 위치: `.claude/tools/bootstrap-session.sh` (구 섹션 2 블록)
  - 상세: 기존 `[ -f package.json ] && [ ! -d node_modules ]` + 중첩 `if command -v npm` 2단
    구조, `&&`/`||` 라인 연결 install 분기가 `if/then/else` 로 바뀌었다. 이는 스타일 정리가
    아니라, "마커 파일 기록은 설치 성공 분기에서만 일어나야 하고 그 사이에 락 획득/해제가
    끼어야 한다"는 새 요구를 표현하는 데 필요한 최소 구조 변경이다 — 기존 `&&`/`||`
    체이닝으로는 성공 분기에 추가 statement(마커 write)를 넣을 수 없다. 목적과 무관한
    정리성 리팩토링이 섞여 있지 않다.
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트의 `REAP_MIN_INTERVAL`/`REAP_GH_BIN` 설정은 무관한 기능 결합이 아니라
  기존 테스트 관례이며, 이 시나리오에서는 사실상 비활성(no-op)
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:113-122`(`_run`),
    `188-195`(`test_concurrent_sessions_install_at_most_once`)
  - 상세: `bootstrap-session.sh` 는 섹션 2(mermaid-lint) 외에 섹션 4(reaper 호출)도 동일
    스크립트 실행 시 함께 돈다. 신규 테스트가 이 두 env var 를 설정하는 것은 기존
    `test_reap_merged_worktrees.py` 의 확립된 패턴을 그대로 따른 방어적 조치다. 다만
    `setUp` 은 `bootstrap-session.sh` 만 임시 저장소에 복사하고 `reap-merged-worktrees.sh`
    자체는 복사하지 않으므로, bootstrap 4단계의 `[ -f "$reaper" ]` 는 이 테스트 트리에서
    항상 거짓이라 두 env var 는 실질적으로 아무 것도 스위칭하지 않는다(harmless dead
    config). 새 기능 결합이 아니며 스코프 위반도 아니다.
  - 제안: 조치 불요(정보 제공 목적).

## 변경 파일별 범위 적합성

| 파일 | 판정 | 근거 |
| --- | --- | --- |
| `.claude/tests/test_bootstrap_mermaid_install.py` (신규) | 범위 내 | plan 항목 A(마커+락)가 서술하는 정확히 그 동작(1회 설치, 마커 존재 시 skip, 부분 설치 재시도, 락 보유 시 skip, stale 락 탈취, 락 해제, 동시성 5-프로세스)만 검증. `_harness` import 는 기존 공용 헬퍼 재사용 |
| `.claude/tools/bootstrap-session.sh` | 범위 내 | 섹션 2(mermaid-lint 설치)만 수정. 섹션 1/3/4 는 origin/main 대비 무변경 확인 |
| `.gitignore` | 범위 내 | 신규 도입된 `mkdir` 락 디렉터리(`$tool_dir/.install.lock`)는 기존 `node_modules/` 패턴이 커버하지 못하는 경로라 신규 ignore 항목이 필수. 기존에 이를 포괄하는 패턴 없음(redundant 아님), trailing slash 로 디렉터리 한정이라 과잉 매칭도 아님 |
| `plan/in-progress/harness-guard-followups.md` (신규) | 범위 내 (프로세스 문서) | CLAUDE.md 정보 저장 위치 컨벤션 준수. 코드 구현은 A 만, B~E 는 미체크 상태로 추적만 |

## 요약

4개 변경 파일 모두 "PR #970 리뷰 3라운드가 defer 한 mermaid-lint 설치 경쟁·부분 설치 영속
수정(plan 항목 A)"이라는 단일 의도에 정확히 대응한다. 단일 커밋(`bbf72268e`)이며, `git diff
--stat` 이 payload 와 완전히 일치해 diff 목록 누락이 없었다. `bootstrap-session.sh` 는 diff
hunk 경계상 문제의 섹션(mermaid-lint 설치) 하나만 건드리고 나머지 섹션(githooks·state GC·
reaper 호출)은 origin/main 과 동일함을 직접 대조로 확인했으며, 조건문 구조 변경도 마커/락
로직이 요구하는 최소 재구성이지 무관한 정리가 아니다. `.gitignore` 항목은 이번에 신설된 락
디렉터리를 위해 필수적인 3줄뿐이고, 테스트 파일은 plan 이 서술한 두 결함(경쟁·영속)과 그
수정(마커·락·stale 락 탈취)을 1:1 로 검증하는 범위에 머문다. 신규 plan 문서가 향후 항목
(B~E)까지 등록하지만 전부 미체크 상태의 추적 항목이며 실구현은 A 하나뿐이라 "요청 외 추가
구현"에 해당하지 않고, 문서가 인용한 과거 리뷰 근거도 실물 대조로 왜곡이 없음을 확인했다.
목적 없는 포맷팅·주석·임포트 변경이나 무관한 파일 수정은 발견되지 않았다.

## 위험도

NONE
