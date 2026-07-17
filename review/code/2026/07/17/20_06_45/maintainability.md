# 유지보수성(Maintainability) 코드 리뷰

대상: `.claude/tests/test_bootstrap_mermaid_install.py`(신규), `.claude/tools/bootstrap-session.sh`(수정),
`.gitignore`(수정), `plan/in-progress/harness-guard-followups.md`(신규)

## 발견사항

- **[WARNING]** 신규 동시성 테스트가 `_run()` 의 env 구성 로직을 그대로 복제 — 주석(rationale)도 전파 안 됨
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:81-90`(`_run`) 대 `:156-172`(`test_concurrent_sessions_install_at_most_once`, 특히 158-163)
  - 상세: 두 곳 모두 `PATH`/`NPM_CALL_LOG`/`NPM_STUB_FAIL`/`REAP_MIN_INTERVAL`/`REAP_GH_BIN` 5개 env 키를 리터럴로 동일하게 재구성한다. 후자는 5개 프로세스를 동시에 띄워야 해서 blocking 인 `subprocess.run` 기반 `_run()`을 그대로 재사용하지 못하고(`Popen` 필요) 통째로 복제한 것으로 보인다. 그 결과 `_run()` 87행의 `# No gh stub → the reaper cannot prove a merge and reaps nothing.` 설명 주석이 복제본에는 빠져 있다 — "왜 REAP_GH_BIN 을 존재하지 않는 경로로 두는가"라는 근거가 이미 한 곳에서 유실된 상태로, 향후 bootstrap-session.sh 에 새 env 게이트(같은 plan 문서의 B 항목 배치화 등)가 추가되면 이 복제본만 갱신이 누락되어 동시성 테스트가 조용히 다른 환경을 검증하게 될 위험이 있다.
  - 제안: `_env(self, fail=False) -> dict`(또는 `_popen(self, fail=False)`) 헬퍼를 추출해 `_run()`과 동시성 테스트 양쪽이 재사용하도록 리팩터.

- **[INFO]** stale-lock 임계값(10분)이 단일 진실 지점 없이 3곳에 흩어져 있음
  - 위치: `.claude/tools/bootstrap-session.sh:60`(`find "$lock" -maxdepth 0 -mmin -10`) / 동 파일 51-52행 주석("A lock whose holder died is stolen after 10 minutes") / `.claude/tests/test_bootstrap_mermaid_install.py:141`(`old = time.time() - 3600  # 1h — well past the 10min steal threshold`)
  - 상세: 같은 개념(락 탈취까지 대기 시간)이 코드 리터럴 `-10`, 스크립트 산문 주석, 테스트의 파생 리터럴 `3600`+주석으로 세 곳에 독립 서술돼 있다. 다만 테스트의 여유폭(1시간)이 임계값(10분)의 6배라 당장 실질 위험은 낮다 — 값이 대략 50분 이상으로 늘어나야 테스트가 flaky 해지는 시나리오이므로 실무적으로는 여유 있는 상태.
  - 제안: (선택) 스크립트에 `stale_after_min=10` 변수를 락 블록 위에 선언하고 `-mmin "-$stale_after_min"` 로 참조하면 최소한 스크립트 내부 코드·주석 간 drift 는 방지된다. 셸-파이썬 경계를 넘는 완전한 SoT 공유까지는 과함.

- **[INFO]** `bootstrap-session.sh` 섹션 2 브랜칭이 늘었지만 정당화되고 테스트로 뒷받침됨
  - 위치: `.claude/tools/bootstrap-session.sh:58-72`
  - 상세: 기존 "1단 `if` + `&&`/`||` 체인" 구조가 4개의 중첩 `if`(외곽 가드 → 락 탈취 검사 → `mkdir` 락 획득 → `npm install` 성공/실패)로 확장돼, 파일 내 가장 복잡한 블록이 됐다(최대 중첩 3단). 다만 (a) 기존 `(cmd) && echo A || echo B` 관용구를 명시적 `if/else`(65-69행)로 바꾼 것은 그 자체로 "A 성공, echo B 실패 시 echo C 도 실행되는" 안티패턴을 제거해 가독성·정확성을 함께 개선했고, (b) 이 저장소 셸 스크립트가 함수 없는 절차형 스타일을 계속 유지하는 기존 관례와도 맞으며, (c) 24행의 사전 설명 주석과 9개 유닛 테스트가 각 신규 분기(정상 설치·마커 존재 시 skip·부분설치 재시도·설치 실패·락 보유중 skip·stale 락 탈취·성공/실패 후 락 해제·5-세션 동시성)를 1:1 로 커버한다. 순수 branching 복잡도는 상승했지만 실질 결함(경쟁 조건 + 영속적 조용한 실패) 해소에 필요한 최소한의 복잡도이고 회귀 위험은 테스트가 상쇄한다.
  - 제안: 없음(정보성). `mkdir` 락 패턴이 다른 스크립트에도 필요해지면 그때 공유 헬퍼 추출을 고려 — 현재는 저장소 유일 사용처라 추상화가 이르다.

### 참고 — 이전 산출물(같은 세션 디렉토리)의 부정확한 인용 정정

같은 경로에 이전에 쓰인 `maintainability.md` 는 `.claude/tests/test_bootstrap_mermaid_install.py` 의 발견사항 위치를 "113-122", "188-198", "173행" 으로 인용했으나, 실제 파일을 직접 읽어 대조한 결과 이는 diff 표시(hunk 오프셋 +32)에서 비롯된 오차로 실제 파일 라인은 각각 81-90/156-172/141행이다. 또한 "자매 파일 `test_reap_merged_worktrees.py` 가 `_env(merged=(), gh_bin=None)` 전용 헬퍼로 이미 분리해뒀다"는 서술도 부정확하다 — 그 파일을 직접 확인하면 `_env()`라는 함수는 존재하지 않고, 인용된 111-116행은 `_run(self, *extra, merged=(), gh_bin=None, dry=False)` 자체의 본문이다(동시성 테스트가 없어 env 중복도 애초에 발생하지 않는 파일). 위 두 항목은 정정된 라인 번호와 서술로 다시 기재했다.

## 요약

이번 변경은 실질적인 동시성 결함(병렬 worktree 세션의 cold-checkout `npm install` 경쟁)과 그로 인한 영속적 조용한 실패(부분 `node_modules`를 디렉토리 존재 체크가 영구 승인해 mermaid lint 가 무신호로 죽는 문제)를 완료 마커 + `mkdir` 락으로 해소하며, 각 분기를 9개 단위 테스트로 개별 커버한다. 신규 테스트 파일은 자매 파일 `test_reap_merged_worktrees.py`의 docstring 스타일·`setUp`/`_git`/`_write` 헬퍼·"--- helpers/tests ---" 구획·클래스 네이밍 관례를 정확히 따르며, 스크립트 쪽은 `: > "$marker"` 관용구도 같은 tools 디렉토리의 `reap-merged-worktrees.sh`(234행)가 이미 쓰는 패턴이라 오히려 일관성이 높다(이는 대체를 제안할 사안이 아니다). `.gitignore`·plan 문서 역시 기존 스키마·주석 관례를 그대로 따른다. 발견된 항목은 테스트 파일의 env 구성 중복(WARNING, 리팩터 권장)과 10분 임계값의 다중 하드코딩(INFO, 선택적 개선) 정도이며 둘 다 동작에는 영향이 없다. 전반적으로 가독성·네이밍·기존 컨벤션 준수도가 높아 차단할 사유는 없다.

## 위험도

LOW
