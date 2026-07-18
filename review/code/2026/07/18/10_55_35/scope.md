# 변경 범위(Scope) 리뷰 — .claude/tools/bootstrap-session.sh 외 3파일

## 리뷰 방법론 메모

프롬프트가 각 파일의 "전체 파일 컨텍스트"만 제공하므로, 실제 diff 는 대상 worktree
(`harness-guard-followups-f7140c`, branch `claude/harness-guard-followups-f7140c`) 에서
직접 확인했다. `git status` 는 clean(리뷰 산출물 디렉토리만 untracked)이므로 리뷰 대상은
최신 커밋 `a16d80290`("fix(harness): mermaid 설치 락 제거 — 마커-only 로 전환 (02_06_42 C1)")
의 diff이며, `meta.json`/`_retry_state.json` 이 지정한 4개 리뷰 대상 파일(`bootstrap-session.sh`,
`test_bootstrap_mermaid_install.py`, `.githooks/pre-commit`, `.claude/tests/README.md`) 과
정확히 일치한다. 커밋 의도(커밋 메시지 + `plan/in-progress/harness-guard-followups.md` §A 개정 +
`review/code/2026/07/18/02_06_42/RESOLUTION.md`)는 명확하다 — 사용자 결정(2026-07-18)에 따라
review 02_06_42 C1(TOCTOU stale-lock steal)을 손대신 **손수 짠 `mkdir` 락 apparatus 를 통째로
제거**하고 마커+throttle-only 로 단순화하는 것.

## 발견사항

- **[INFO]** 락 제거와 무관한 중복 assertion 라인 삭제가 같은 커밋에 섞임
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py` `test_failed_install_retries_after_cooldown()` (diff 기준 옛 L327 부근)
  - 상세: `self.assertTrue(os.path.isfile(self.marker))` 가 바로 위 줄과 완전히 동일한 문자열로
    두 번 반복돼 있던 것 중 한 줄이 이번 diff 에서 삭제됐다. 이 테스트 메서드는 락과 무관하고
    커밋 메시지의 변경 목록("락 테스트 9건 + `_plant_lock` 삭제. 동시 테스트는 …")에도 언급되지
    않는다. 동작 영향은 없다(중복 제거일 뿐, 검증 내용 손실 없음) — 사실상 이전 커밋에서 생긴
    복붙 중복의 정리에 가깝다.
  - 제안: 실질적 문제는 아니므로 조치 불요. 굳이 분리하려면 별도의 "test hygiene" 커밋으로
    뺄 수 있었겠지만, 1줄·무해·같은 파일 내 자연스러운 인접 정리라 이번 커밋에 남겨도 무방.

- **[INFO]** `_env()` 독스트링에서 이전 라운드 WARNING 번호 인용이 함께 삭제됨
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py` `_env()` 시그니처/독스트링
  - 상세: `lock_grace` 파라미터 제거(필요한 변경)와 같은 줄 편집으로, 독스트링의
    `"(WARNING #6 — no per-test copies)"` 인용구도 함께 사라졌다. "한 곳에서 env 를 만든다"는
    개념 자체는 락 제거와 무관하게 여전히 유효한데, 그 근거였던 과거 라운드 번호 인용만
    부수적으로 사라졌다. 이미 편집 중인 줄이라 diff 노이즈로 보기는 어렵고, 문서 정확성엔
    영향 없음(그 WARNING 항목 자체가 이번 라운드에서 moot 된 락 코드와 관련됐을 가능성이 높음).
  - 제안: 조치 불요. 근거 필요 시 원 인용 라운드를 확인해 재부착할 수 있으나 우선순위 낮음.

## 스코프 내로 확인된 항목 (참고용, 발견사항 아님)

다음은 표면적으로는 "커밋 메시지가 언급하지 않은 변경"처럼 보일 수 있으나, 검토 결과
이번 PR 의 명시된 스코프(락 제거 + 같은 리뷰 라운드의 W5/W6 문서 정정)에 정확히 부합해
scope 위반으로 분류하지 않는다:

- `.githooks/pre-commit` 헤더 주석에 세 번째 공유 SoT(`mermaid_lint_ready.py`) 언급 추가 —
  `review/code/2026/07/18/02_06_42/RESOLUTION.md` 의 W6 항목("`.githooks/pre-commit` 헤더에
  3번째 공유 SoT 추가")을 그대로 이행한 것이고 커밋 메시지도 "README·pre-commit 헤더 문서
  정정(W5·W6)"로 명시한다. 프로젝트 규약상 같은 리뷰 라운드의 Critical 과 Warning 을 같은
  커밋에서 함께 해소하는 것은 표준 워크플로(CLAUDE.md "구현 완료 후 자동 review/fix")다.
- `.claude/tests/README.md` 의 `test_bootstrap_mermaid_install.py` 행 설명 교체 — 같은 W5 항목
  ("동시 테스트 메서드명/의미를 marker-only 수렴으로 교체… README 도 락→마커-only 로 정정")의
  이행이며, 테이블의 해당 1행만 바뀌고 다른 행·구조는 무변경.
- `bootstrap-session.sh` 의 확장된 설계 노트(`NO LOCK, deliberately …`) — 커밋 메시지가
  "설계 노트로 왜 락이 없는지 + 잔여 리스크 명시"라고 명시적으로 예고한 변경이며, 이
  코드베이스는 과거 3라운드 연속으로 "주석에 안전하다고 썼다가 다음 라운드에 반증됨"을
  반복해 온 이력이 있어(커밋 메시지 자체가 인용) 방어적으로 상세한 근거·잔여 리스크 기술은
  과잉이 아니라 이번 결정의 핵심 산출물이다.

## 파일별 스코프 정합성

### `.claude/tools/bootstrap-session.sh`
diff 는 섹션 2(mermaid-lint 설치 가드) 내부에만 국한된다. 섹션 1(githooks 활성화)·섹션 3(GC)·
섹션 4(reaper 위임)는 한 글자도 손대지 않았다. 삭제된 것은 `lock` 변수, `lock_grace` 변수,
`_lock_is_dead()` 함수, 그리고 install 블록 내 `mkdir "$lock"`/owner 파일/owner-checked
release 로직뿐이다. 새로 추가된 로직·함수·변수는 없다(순수 삭제 + 주석 갱신) — 기능 확장이나
불필요한 리팩터링의 흔적이 없다. `marker`/`fail_marker`/`retry_after`/`_file_mtime`/
`_install_throttled` 는 락 도입 이전부터 있던 로직 그대로 유지된다.

### `.claude/tests/test_bootstrap_mermaid_install.py`
삭제된 테스트 9건(`test_held_lock_makes_this_session_skip_rather_than_race`,
`test_stale_lock_is_stolen_so_it_cannot_wedge_forever`,
`test_lock_is_released_after_a_successful_install`,
`test_lock_is_released_after_a_failed_install`,
`test_live_but_slow_lock_is_not_stolen_even_when_aged`, `test_dead_pid_lock_is_stolen`,
`test_young_dead_pid_lock_is_not_stolen`,
`test_sub_minute_grace_young_dead_pid_lock_is_not_stolen`,
`test_sub_minute_grace_dead_pid_lock_is_stolen_once_aged_past_it`)과 `_plant_lock` 헬퍼는
모두 삭제된 락 코드 경로를 검증하던 것들로, 코드 삭제에 정확히 대응한다.
`test_concurrent_sessions_install_at_most_once`(exactly-once 단언)는
`test_concurrent_cold_start_converges_and_then_stops_reinstalling`(convergence 단언)로
교체됐고, 이는 락 제거로 실제 보장 성질이 달라졌기 때문에 필요한 변경이다. 새로 추가된
테스트 로직은 이 하나뿐 — 커밋 메시지가 예고한 "마커-미기록 뮤턴트로 비-vacuity 확인"과
일치. `self.lock` 속성 제거, `_env`/`_run` 시그니처에서 `lock_grace` 파라미터 제거도 락
삭제에 정확히 종속된 변경.

### `.githooks/pre-commit`
헤더 주석 한 줄 추가(`mermaid_lint_ready.py` 언급)만 변경. 본문 로직(guard 1 branch, guard 2
mermaid lint, readiness 판정 호출)은 무변경.

### `.claude/tests/README.md`
테이블의 `test_bootstrap_mermaid_install.py` 행 1개만 교체. 다른 행, 서문, "Conventions for
new tests" 절 등은 무변경.

## 리뷰 대상 밖(참고) — 같은 커밋의 다른 파일

`meta.json` 기준 이번 라운드의 scope 리뷰 대상은 위 4파일뿐이나, 같은 커밋 `a16d80290` 은
`.gitignore`(`.install.lock` ignore 항목 제거 — 락 파일 삭제에 종속된 정합적 변경),
`plan/in-progress/harness-guard-followups.md`(§A 재작성 + §G 방향 전환 + 체크리스트 갱신 —
plan 라이프사이클 규약에 따른 표준 기록), `review/code/2026/07/18/02_06_42/*.md`(직전 리뷰
라운드의 SUMMARY/RESOLUTION/개별 리포트 — 리뷰 산출물은 커밋 대상이라는 프로젝트 규약에
부합)도 함께 포함한다. 이들은 이번 서브에이전트의 리뷰 대상 파일 목록 밖이라 개별 등급을
매기지 않으나, 훑어본 결과 모두 "락 제거 결정의 이행 및 기록"이라는 동일 의도에 종속되어
있어 별도의 스코프 이슈로 보이지 않는다.

## 요약

4개 대상 파일의 diff 는 커밋 메시지가 명시한 의도(review 02_06_42 C1 대응 — 손수 짠 `mkdir`
락을 전량 제거하고 마커+throttle-only 설계로 전환, 그리고 같은 리뷰 라운드의 문서성
WARNING(W5/W6) 동시 해소)와 라인 단위로 정확히 대응한다. 새 기능·불필요한 리팩터링·무관한
파일 영역 수정·의미 없는 포맷팅·부적절한 주석/임포트/설정 변경은 발견되지 않았다 — 오히려
코드량이 순감소하는 드문 유형의 변경이다. 발견된 것은 같은 diff hunk 안에 자연스럽게 얹힌
극히 사소한 부수 정리(중복 assertion 제거, 관련 없어진 인용구 삭제) 2건뿐이며 둘 다 동작·
검증력에 영향이 없고 별도 커밋으로 분리할 실익도 없는 수준이다.

## 위험도
NONE
