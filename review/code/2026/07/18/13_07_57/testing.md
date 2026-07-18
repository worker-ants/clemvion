# 테스트(Testing) 리뷰 — bootstrap-session.sh mermaid-lint 마커 lockfile-해시 결속

## 대상
- `.claude/tools/bootstrap-session.sh` (install-decision + install-execution 블록 변경)
- `.claude/tests/test_bootstrap_mermaid_install.py` (신규 테스트 6개 + 헬퍼 확장)
- `.claude/tests/README.md` (해당 표 항목 갱신)

## 검증 방법
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체 실행: **305/305 pass**.
- `test_bootstrap_mermaid_install.py` 단독 11개 전부 pass.
- **Mutation testing 2건**을 실제 `bootstrap-session.sh`에 적용해(원본은 `cp` 백업 후 정확히 복원, `git status --porcelain`으로 클린 확인) 신규 테스트의 실제 회귀 포착력을 실측:
  1. 142행 `printf '%s\n' "$(_lock_hash)"` → `printf '%s\n' "$want_hash"` (post-install 재계산을 pre-install 값 재사용으로 되돌림 = W2 회귀 재현) → `test_npm_rewriting_lockfile_still_converges` **단독 FAIL**(`3 != 1`), 나머지 10개는 그대로 pass.
  2. 129행 해시-불일치 `elif` 조건을 `elif false; then`으로 무력화(W1 핵심 로직 제거) → `test_lockfile_change_retriggers_install` **단독 FAIL**(`1 != 2`), 나머지 10개는 그대로 pass.
  - 두 mutation 모두 정확히 의도된 단일 테스트만 잡아내고 다른 테스트를 오염시키지 않음 — 신규 테스트가 vacuous 가 아니라 실제 회귀 포착력을 가짐을 확인.
- `bash bootstrap-session.sh`를 실제 임시 git repo에서 직접 구동하는 2건의 수동 프로브(스크래치패드에서 실행, 대상 파일 무변경)로 아래 발견사항의 실제 동작을 재현·확인.

## 발견사항

- **[WARNING]** 해시-트리거 재설치 실패 시 마커가 구 해시로 방치되는 경로가 테스트되지 않음
  - 위치: `.claude/tools/bootstrap-session.sh:144-146` (else 분기, 마커 미갱신) / `.claude/tests/test_bootstrap_mermaid_install.py:158-170` (`test_failed_install_leaves_no_marker_so_it_retries`)
  - 상세: 마커가 이미 존재하는 상태(정상 설치 완료 후)에서 lockfile 변경으로 재설치가 트리거됐는데 `npm install`이 실패하면, else 분기는 `fail_marker`만 찍고 기존 `$marker`(구 해시)는 그대로 남긴다. 실제로 재현해보면 — 초기 설치(해시 H1) → lockfile 변경(H2) → 재설치 실패 → 마커는 여전히 H1, `mermaid_lint_ready.is_ready()`는 여전히 `True`. 즉 **"still-vulnerable node_modules"가 계속 "ready"로 read** 되고, 이후 세션도 throttle 창(기본 1800s) 동안 조용히(stderr 한 줄만) 이 상태를 유지한다. 이 시나리오는 이 PR의 핵심 동기(review 12_06_58 W1 — 보안 픽스가 기존 설치에 전파되도록)의 **실패 측면**인데, 기존 `test_failed_install_leaves_no_marker_so_it_retries`는 "마커가 애초에 없던" 최초-설치 실패만 커버해 성격이 다르다(그 경우 결과는 "린트 비활성화"이지 "스테일 취약 트리를 ready로 오인"이 아니다). 두 실패 시나리오는 `is_ready()` 관점에서 결과가 정반대(False vs True)라 회귀 방지 가치가 겹치지 않는다.
  - 제안: `_write_lock` 두 번(H1→성공 설치, H2로 변경)→`NPM_STUB_FAIL=1`로 재설치 실패→마커가 H1 그대로인지, `fail_marker`가 찍혔는지, 그리고 (선택) throttle 해제 후 재시도 시 H2로 수렴하는지를 pin하는 테스트 추가.

- **[WARNING]** 구-포맷(빈 파일) 마커 → 해시-바인딩 마이그레이션 경로가 테스트되지 않음
  - 위치: `.claude/tools/bootstrap-session.sh:127-130` (`[ ! -f "$marker" ]` / hash-mismatch 분기) / 테스트 파일 전체(해당 시나리오 부재)
  - 상세: 이 PR 이전 버전의 `bootstrap-session.sh`는 마커를 `: > "$marker"`(빈 파일)로 썼다. 즉 **이 PR이 머지되는 순간 이미 설치를 마친 모든 기존 체크아웃의 마커는 빈 파일**이다. 신규 로직상 `cat "$marker"`가 빈 문자열을 반환하고 실제 해시와 절대 일치하지 않으므로, 첫 SessionStart에서 정확히 1회 재설치 후 수렴한다 — 실제로 프로브로 재현해 확인함(빈 마커 → 1회 npm 호출 → 유효 해시로 갱신 → 다음 세션부터 스킵). **현재 동작은 올바르다**. 그러나 이 마이그레이션 경로(모든 실사용자가 머지 직후 1회씩 반드시 거치는 경로)를 pin하는 테스트가 없어, 향후 리팩터가 "빈 콘텐츠는 특별 취급" 같은 변경을 넣어도 아무 테스트도 잡지 못한다.
  - 제안: `setUp` 이후 `open(self.marker, "w").close()`로 구-포맷 빈 마커를 직접 만들어두고(디렉토리는 `os.makedirs(os.path.dirname(self.marker))`), lockfile+정상 hasher 상태에서 1회 재설치 후 수렴하는지 확인하는 테스트를 추가.

- **[WARNING]** 동시성 테스트가 신규 해시-바인딩 경로를 전혀 태우지 않음
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:234-262` (`test_concurrent_cold_start_converges_and_then_stops_reinstalling`)
  - 상세: 이 테스트의 `setUp`에는 `package-lock.json`이 없다(`_write_lock`을 호출하는 테스트만 lockfile을 만든다). 따라서 이 테스트 동안 `want_hash`는 항상 빈 문자열이라 129행의 해시-비교 분기는 한 번도 평가되지 않고, 순수하게 "마커 존재 여부"만으로 수렴을 확인하는 **구 로직(this PR 이전)에 대한 회귀 테스트**로 남아있다. 정작 `bootstrap-session.sh:78-84`의 설계 노트는 "여러 세션이 동시에 같은 install-needed 조건을 보는 창이 이제 최초-설치 한정이 아니라(lockfile 변경마다 재-오픈) recurring"이라고 스스로 리스크를 상향 조정했는데, 그 상향된 리스크 축(설치-완료 후 lockfile 변경 시점의 동시 재설치 경쟁)을 검증하는 테스트는 하나도 없다. 특히 마커가 이제 (이전의 빈 touch-file과 달리) **의미 있는 콘텐츠(해시 문자열)를 담게 되어**, 동시 쓰기가 찢어지면(torn write) 그 결과가 향후 어떤 유효한 해시와도 영원히 불일치해 매 세션 재설치 루프에 빠질 수 있는 새로운 실패 형태가 이론상 존재한다 — 기존 동시성 테스트는 마커의 **존재만** assert하고 콘텐츠 유효성은 assert하지 않는다.
  - 제안: 이미 설치 완료(마커=H1)된 상태에서 lockfile을 H2로 바꾼 뒤 N개 프로세스를 동시에 기동하는 변형 테스트를 추가하고, 수렴 후 (a) 후속 세션이 재설치하지 않는지, (b) 마커 콘텐츠가 `_lock_hash()`의 현재 값과 실제로 일치하는지(존재뿐 아니라)까지 assert.

## 강점 (참고용, 조치 불요)
- 신규 6개 테스트 전부 review round ID(W1/W2/W3)를 docstring에 명시해 "왜 이 테스트가 존재하는가"를 추적 가능하게 함 — 가독성·의도 전달이 우수.
- 마커 콘텐츠 회귀(W2, post-install 재계산)와 핵심 트리거 로직(W1, 해시 불일치 시 재설치)은 각각 정밀한 mutation으로 실측 검증됨 — vacuous 테스트가 아님.
- Mock 경계가 적절함: `npm`/`shasum`/`sha256sum`만 PATH stub으로 대체하고 `bootstrap-session.sh` 자체는 실제 subprocess로 구동 — 스크립트 내부 로직을 mock으로 우회하지 않아 실제 동작과 괴리가 없음.
- 테스트 격리 양호: 매 테스트 `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree)`로 독립 실행, 전역 상태 공유 없음, 순서 의존성 없음.
- `harness-checks.yml`의 트리거 paths에 `.claude/tools/**`가 이미 등재돼 있어(24행) `bootstrap-session.sh`만 단독 수정해도 이 스위트가 CI에서 실제로 돈다 — 과거 반복됐던 "CI trigger paths 갭"류 문제 없음.
- `.claude/tests/README.md` 표 갱신 내용이 실제 추가된 테스트 커버리지와 정확히 일치(드리프트 없음).

## 요약
신규 lockfile-해시 결속 로직(W1)과 post-install 재계산(W2) 두 핵심 동작은 정밀한 회귀 테스트로 뒷받침되며, 실제 mutation testing으로 그 포착력을 확인했다 — 이 부분의 테스트 품질은 높다. 다만 이 기능이 목표로 하는 "보안 픽스 전파" 시나리오의 **실패/경계 측**, 즉 (1) 해시-트리거 재설치 자체가 실패했을 때 스테일(취약) 트리가 `ready`로 방치되는 경로, (2) 이 PR 머지 직후 모든 기존 체크아웃이 반드시 거치는 구-포맷 마커 마이그레이션 경로, (3) 콘텐츠를 갖게 된 마커가 동시-재설치 경쟁 하에서도 유효하게 수렴하는지는 테스트로 pin되어 있지 않다. 세 경로 모두 현재 구현이 실제로는 올바르게 동작함을 직접 재현·확인했으므로 지금 당장의 결함은 아니지만, 이 코드의 존재 이유 자체가 "보안 픽스 전파의 실패 모드를 없애는 것"이라는 점에서 그 실패 모드에 대한 회귀 보호가 비어 있는 것은 후속 리팩터에서 조용히 재발할 수 있는 리스크다.

## 위험도
MEDIUM
