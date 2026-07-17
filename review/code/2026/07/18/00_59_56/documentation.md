# 문서화(Documentation) 리뷰 — mermaid 설치 가드 자기리뷰 보강 3건 (락 liveness·throttle·공유 판정 SoT)

> 대상 커밋: `d31f99a11`(직전 리뷰 `review/code/2026/07/17/20_06_45` 의 Warning #1/#2/#3 을
> 같은 PR 에서 처리한 후속 커밋). 6개 파일 전체를 diff 기준 + 전체 컨텍스트로 대조 검증했다.

## 발견사항

- **[WARNING]** 락 해제(release) 설명 주석의 "rmdir" 표현이 실제 명령(`rm -rf`)과 불일치 — 같은 파일이 가르치는 구분과 자기모순
  - 위치: `.claude/tools/bootstrap-session.sh:61-63`
  - 상세: 섹션 요약 주석은 "Release is owner-checked too: a session only rmdir's a lock it still owns, so it can't delete a lock a stealer already re-acquired." 라고 "rmdir's" 를 동사로 쓴다. 그러나 실제 해제 코드(line 126)는 `rm -rf "$lock"` 이고, 정확히 40여 줄 아래(line 108)의 인접 인라인 주석은 "`rm -rf`, not rmdir: the lock dir holds an `owner` file, and a genuinely dead+aged lock cannot also be a fresh re-acquisition..." 라며 이 파일 스스로 두 명령의 차이(빈 디렉터리만 지우는 `rmdir` vs 내용물이 있어도 강제로 지우는 `rm -rf`)를 명시적으로 가르친다. `lock` 디렉터리는 `owner` 파일을 담고 있어 실제로 `rmdir` 을 쓰면 실패한다 — 그 정확한 이유를 이 파일이 별도로 설명해 놓은 바로 그 지점에서, 다른 요약 주석이 부정확한 동사를 쓰는 자기모순이다.
  - 제안: line 62 의 "rmdir's" 를 "removes"/"rm -rf's" 로 교정.

- **[WARNING]** 신규 env `MERMAID_INSTALL_LOCK_GRACE_SEC` 가 이름과 달리 분 단위로만 유효 — 1~59 범위 값은 grace 를 사실상 무력화하며 문서화·테스트 모두 안 됨
  - 위치: `.claude/tools/bootstrap-session.sh:74, 98`
  - 상세: 변수명 접미사 `_SEC`(초)와 인라인 주석("min age before a dead-PID lock is stolen")은 단위를 초로 암시하지만, 실제 나이 판정은 `find "$lock" -maxdepth 0 -mmin "-$(( lock_grace / 60 ))"` 로 bash 정수 나눗셈을 거쳐 **분** 단위로만 이뤄진다. scratchpad 에서 `find -mmin -0`/`-mmin -1` 을 5·30·65·120·300·600초로 미리 나이 먹인 실제 파일에 대해 실행해 실측한 결과: `lock_grace` 가 1~59(→ `lock_grace/60=0` → `-mmin -0`) 이면, 실제로 존재 가능한 어떤 나이의 파일에도 이 find 조건이 매치되지 않아 "young(보호)" 판정이 **항상 거짓**이 된다 — 즉 나이 게이트가 사실상 통과(더 낡음 취급)되어 owner 생존 여부만으로 즉시 탈취가 결정된다. 사용자가 (예: 테스트 대기시간 단축 목적으로) 30 을 넣으면 "30초 유예"가 아니라 **유예 0**(더 정확히는 항상 "grace 경과"로 취급)이 되는 셈이다. 기본값 600(=10분, 60 의 배수)은 이 경계 위라 안전하지만, 이 quantization 함정은 코드 어디에도 disclosure 되어 있지 않다. `.claude/tests/test_bootstrap_mermaid_install.py` 는 `_env()`/`_run()` 에 `lock_grace` 파라미터를 정의해 두고도(grep 확인) **실제로 0 이 아닌 커스텀 값을 넘겨 호출하는 테스트가 단 하나도 없어**, 이 갭은 회귀 테스트로도 검출되지 않는다.
  - 제안: 인라인 주석에 "값은 60 초 단위로 내림 처리되어 사실상 분 단위로만 유효하다"를 명시하거나, 변수명을 분 단위로 바꾸거나(`_MIN`), 최소 60 으로 clamp. 최소한 이 경계를 문서화하고 non-multiple-of-60 `lock_grace` 값을 실제로 exercise 하는 테스트 1건 추가를 권장.

- **[WARNING]** `test_bootstrap_mermaid_install.py` 모듈 docstring 이 이번 커밋에서 추가된 두 축(락 liveness, 실패 throttle)을 반영하지 않음
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:1-15`
  - 상세: 파일 상단 docstring 은 "Two failures follow from that, and these tests pin both" 라며 (①경쟁 ②영속) 두 실패만 서술한다. 이번 diff 로 파일에 5개 신규 테스트(`test_live_but_slow_lock_is_not_stolen_even_when_aged` / `test_dead_pid_lock_is_stolen` / `test_young_dead_pid_lock_is_not_stolen` / `test_failed_install_is_throttled_within_cooldown` / `test_failed_install_retries_after_cooldown`, 전체 14개 중 5개 = 1/3 이상)가 추가되어 "락 liveness 판정"과 "실패 throttle" 이라는, 원 docstring 의 "두 실패" 와 구별되는 새 축을 커버하는데 최상단 요약은 갱신되지 않았다. 파일 내부는 `# --- lock liveness (WARNING #1...) ---` / `# --- failure throttle (WARNING #3) ---` 로 섹션을 잘 나눠 놓았지만, 새 기여자가 맨 처음 참고할 "이 파일이 무엇을 지키는가" 진입점(모듈 docstring)은 그 1/3 이상을 누락한다.
  - 제안: docstring 에 "이 락 자체가 두 새 방식으로 영구 wedge 되지 않게 하는 갭 — 살아있는 홀더의 오탐 탈취, 실패 후 무한 재시도 — 도 함께 고정한다" 정도의 한 단락 추가.

- **[INFO]** `lint_mermaid_posttooluse.py` 의 모듈 docstring·사용자 노출 메시지가 "부분 설치" 케이스를 언급하지 않음(인라인 주석과의 정밀도 격차)
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:26-27`(모듈 docstring 마지막 문장), `:109-113`(사용자에게 실제로 보이는 stderr 메시지) vs `:105-108`(인라인 주석)
  - 상세: 모듈 docstring 은 "If deps aren't installed yet we fail open — the SessionStart bootstrap installs them" 이라고만 서술하고, 실제로 stderr 에 출력되는 메시지도 "tooling deps not installed. Run: (cd .claude/tools/mermaid-lint && npm install)" 이다. 그러나 판정 함수는 이제 `is_ready()`(node_modules 존재 **AND** 마커 존재)로 "설치 안 됨" 뿐 아니라 "부분 설치"도 함께 fail-open 시킨다 — 바로 그 코드 지점의 인라인 주석("Deps not installed *or only partially*")은 이를 정확히 반영하지만, 모듈 docstring 과 사용자 노출 메시지는 이전(마커 도입 전) 수준으로 남아 있다. 오류는 아니고(일반화가 여전히 참, "npm install" 재실행도 여전히 유효한 해법) 실제 영향은 작지만, node_modules 가 이미 존재하는데도 "not installed" 로 안내받는 개발자가 혼란을 겪을 수 있다.
  - 제안: 우선순위 낮음. 여유 있을 때 두 문구에 "(or only partially installed)" 를 덧붙이면 정합.

- **[INFO]** `test_mermaid_lint_ready.py::test_marker_without_node_modules_dir_is_not_ready` 가 이름·주석이 약속하는 시나리오를 실제로 구성하지 않음
  - 위치: `.claude/tests/test_mermaid_lint_ready.py:61-63`
  - 상세: 테스트명과 주석("marker path implies node_modules/, but guard the isdir check anyway")은 "마커는 있는데 node_modules 디렉터리는 없는" 상태를 방어한다고 서술하지만, 테스트 본문은 `self.assertFalse(ready.is_ready(self.tool_dir))` 단 한 줄이며 마커도 node_modules 도 아무것도 만들지 않는다. `marker_path()` 가 `os.path.join(tool_dir, "node_modules", MARKER_NAME)` 로 마커를 node_modules **내부**에 강제하므로, "마커는 파일로 존재하는데 node_modules 는 디렉터리가 아님" 상태는 실제 파일시스템에서 애초에 구성 불가능하다 — 결과적으로 이 테스트는 (아무것도 안 만든) `test_no_tool_dir_is_not_ready` 의 두 번째 assertion 과 구분되지 않는 사실상 중복이며, `is_ready` 가 `isdir(node_modules)` 검사를 생략한 `return isfile(marker_path(tool_dir))` 로 바뀌어도 (마커가 여전히 없으니) 통과해 "isdir 가드가 실제로 뭔가를 잡아준다"는 방어 목적을 검증하지 못한다.
  - 제안: 우선순위 낮음(`is_ready` 자체 로직은 정확 — 코드 결함 아님). 이 시나리오가 구조적으로 도달 불가능함을 주석에 명시하거나, 이름을 실제로 검증하는 바("둘 다 없을 때")에 맞게 정정.

- **[INFO]** (이번 diff 밖, 참고용) `test_stale_lock_is_stolen_so_it_cannot_wedge_forever` 의 주석이 신규 형제 테스트 3건과의 관계를 설명하지 않음
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:159-166` (이번 diff 에서 미변경 — `bbf72268e` 부터 존재하는 코드/주석)
  - 상세: 이 테스트는 owner 파일을 전혀 쓰지 않는 락(`os.makedirs(self.lock)` 만)을 심어 `_lock_is_dead()` 의 "unlabelled/garbage owner → age 만으로 판정" 분기를 검증하는데, 주석("1h — well past the 10min steal threshold")은 초판 시절의 단순 "10분 임계값" 서술에 머물러 있다. 바로 아래 이번 diff 로 추가된 `test_live_but_slow_lock_is_not_stolen_even_when_aged` / `test_dead_pid_lock_is_stolen` / `test_young_dead_pid_lock_is_not_stolen` 3건은 모두 owner PID 를 명시적으로 심고 그 생사로 판정하는 시나리오라, 이 테스트가 "owner 라벨이 아예 없는" 네 번째 분기를 다룬다는 관계가 코드만 봐서는 잘 드러나지 않는다.
  - 제안: 우선순위 낮음(이번 diff 스코프 밖, 차단 사유 아님). 재작업 시 "이 락은 owner 라벨이 없다 — 아래 세 테스트(라벨 있음)와 대구" 한 줄 추가 권장.

## 확인했으나 결함 없음 (참고용 — 긍정 사례)

- **CHANGELOG.md 미갱신은 결함 아님**: 539줄·60개 "Unreleased" 항목 전수 grep 재확인 — `.claude/`/`bootstrap`/`mermaid` 언급 0건, 최근 순수 harness 커밋(`cdad5a1ec`/`67871ffbd`/`d89169460`/`f562c04f6`) 도 전부 CHANGELOG 미접촉. harness 변경은 이 컨벤션 대상이 아님이 다시 확인됐다.
- **`.claude/tests/README.md` 신규 2행 · `.gitignore` 락 주석**: 직전 리뷰 라운드(`20_06_45`)의 Warning #4 · INFO #4 로 이미 처리되어 현재 내용이 실제 코드(owner PID 생존 확인 + grace age)와 정확히 일치.
- **`test_doc_sync_matrix` / `test_summary_agent_contract` 인용**: 두 파일 모두 실재하며 README 서술이 인용 취지(cross-file 문자열 drift 를 테스트로 결속하는 컨벤션)와 일치. 근거 날조 없음.
- **`REAP_MIN_INTERVAL` 유비 인용**(`bootstrap-session.sh:67`): `reap-merged-worktrees.sh` 에 실재하는 메커니즘과 정확히 대응.
- **plan 문서**(`plan/in-progress/harness-guard-followups.md`): 이번 3건 보강(WARNING #1/#2/#3)의 서술이 코드·RESOLUTION.md 와 정확히 일치, 체크리스트 상태(`[x]`)도 실제 완료 상태와 부합.
- **`pre-commit`/`mermaid_lint_ready.py` 신규 인라인 주석 전반**: 코드 로직과 대조 검증 결과 위에 적시한 항목 외에는 정확 — 특히 `repo_top` 기반 `mermaid_ready` 조회(버전관리 파일이라 모든 워크트리에 존재) vs `main_root` 기반 `tool_dir`(gitignored, 메인 체크아웃 전용) 구분이 파일 상단 주석의 기존 근거와 일관.

## 요약

이번 diff(자기리뷰 보강 3건 — 락 liveness·throttle·공유 판정 SoT)는 전반적으로 매우 높은 문서화 수준을 유지한다. 신규 로직 대부분에 "왜"를 설명하는 상세 주석이 붙었고, CHANGELOG 면제·README 테스트 표 갱신·인용 근거 등 직전 라운드(20_06_45)가 지적한 항목은 모두 해소된 채로 재확인됐다. 다만 이번 정밀 대조에서 새로 3건의 WARNING 을 발견했다 — ① `bootstrap-session.sh` 자신이 "rm -rf, not rmdir" 구분을 명시적으로 가르치는 바로 그 파일 안에서 다른 요약 주석이 부정확하게 "rmdir's" 를 쓰는 자기모순, ② 신규 env `MERMAID_INSTALL_LOCK_GRACE_SEC` 가 이름(`_SEC`)과 달리 분 단위로만 유효해 1~59 범위 값이 grace 를 사실상 무력화하는데 이것이 실측(scratchpad `find -mmin` 경계 테스트)으로 확인되도록 어디에도 문서화·테스트되지 않은 점(기본값 600 은 안전 범위), ③ 신규 테스트 파일 모듈 docstring 이 이번에 추가된 liveness·throttle 두 축(전체 테스트의 1/3 이상)을 반영하지 않아 "이 파일이 무엇을 지키는가"의 1차 진입점이 불완전해진 점. 세 건 모두 기본 동작(기본값)에는 영향이 없고 저비용으로 교정 가능한 정밀도 문제이며, 나머지 2건은 INFO 수준의 테스트/문서 자기서술 정확성 이슈(1건은 이번 diff 밖의 기존 코드)다. API 문서·신규 README 필요성은 이 변경의 성격(내부 harness 버그 수정 + 회귀 테스트, 신규 공개 API 없음)상 해당 사항이 없다.

## 위험도

MEDIUM
