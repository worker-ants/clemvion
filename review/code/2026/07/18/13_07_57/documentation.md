### 발견사항

- **[WARNING]** `bootstrap-session.sh` 설계 노트 안에서 방금 정정한 "first-install-only" 서술이 같은 문단 뒤쪽에 한 곳 더 남아 스스로 모순
  - 위치: `.claude/tools/bootstrap-session.sh:93` (모순 대상: 같은 "NO LOCK, deliberately." 문단의 `:78-83`)
  - 상세: 이번 커밋(`ead99225c`, 직전 리뷰 12_31_29 W1)은 "동시-설치 창이 이제 lockfile 변경마다(정기 Dependabot 머지 포함) 재개방되므로 더 이상 first-install-only 가 아니다"로 정정하면서, 파일 헤더 항목 2 (`:13-15`)·섹션 2 헤더 (`:35-36`)·런타임 `echo` 메시지 (`:135`) 3곳을 고쳤고 커밋 메시지도 "4곳 전부 정정"이라 명시한다. 그런데 같은 "NO LOCK, deliberately." 설계 노트 문단 **내부에도** 같은 낡은 표현이 한 번 더 있었고, 이번 diff 는 그 문단의 앞부분(`:75-84`, "that condition is no longer first-install-only … it is recurring, not one-off — which is what would justify revisiting plan §G")만 고치고 몇 문장 뒤 결론 문장(`:93`, "Judged an acceptable rare **first-install-only** window on a dev-tooling linter, not worth a hand-rolled lock…")은 그대로 두었다. 결과적으로 같은 코멘트 블록이 "이제 더 이상 first-install-only 가 아니다(recurring)"라고 말한 지 몇 줄 뒤에 "이건 그래도 first-install-only 창이라 감수할 만하다"고 다시 말하는 자기모순이 생겼다. §G(fcntl.flock) 재검토 트리거를 "recurring 이면"이라고 막 명시해 놓고 바로 뒤 결론 문장만 훑는 독자에게는 그 트리거가 무력화된 것처럼 읽힌다. 이 세션에서 이미 반복된 실패 패턴(반증된 안전 서술을 코드에 남기지 말 것 — #970 push 가드·#976 mermaid 락·이 파일의 marker 서술)의 또 다른 재발이며, 공교롭게도 그 패턴을 고치겠다고 명시한 바로 이 커밋 안에서 발생했다.
  - 제안: `:93`에서 "first-install-only" 를 제거하거나 `:78-83`의 정정된 프레이밍과 맞춘다. 예: `Judged an acceptable rare (now recurring, per above) window on a dev-tooling linter, not worth a hand-rolled lock whose safety keeps being wrong.` 또는 단순히 "Judged an acceptable rare window on a dev-tooling linter, …"로 표현을 좁혀 앞 문단과 충돌하지 않게 한다.

- **[INFO]** 신규 lockfile-rewrite 수렴 테스트가 문서가 인용하는 테스트명 와일드카드 패턴에 안 걸림
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:20-26` (모듈 docstring 4번째 불릿, 끝의 `` `test_lockfile_*` / `test_*_hasher_*` pin these. ``) 및 `.claude/tests/README.md:34` (끝의 `` (`test_lockfile_*` / `test_*hasher*`) ``)
  - 상세: 두 문서 모두 "해시가 install **후** 재계산돼 npm 이 재작성한 lockfile 에도 수렴한다"는 W2 주장 바로 뒤에 위 와일드카드 패턴으로 근거 테스트를 가리키지만, 그 주장을 실제로 pin 하는 신규 테스트 `test_npm_rewriting_lockfile_still_converges` (`test_bootstrap_mermaid_install.py:200`) 는 `test_lockfile_*` 로도 `test_*_hasher_*`/`test_*hasher*` 로도 매칭되지 않는다(이름이 `test_lockfile_`로 시작하지 않고 `_hasher_`도 포함하지 않음). 두 패턴이 실제로 가리키는 것은 `test_lockfile_change_retriggers_install`/`test_unchanged_lockfile_does_not_reinstall`(첫 절)과 `test_missing_hasher_degrades_to_presence_only`(마지막 절)뿐이라, 중간 절(post-install 재계산 수렴)의 근거 테스트를 이름 패턴만으로 찾으려는 독자는 놓친다. 코드 동작 자체는 정확히 서술돼 있어 오해를 유발하는 수준은 아니다.
  - 제안: 두 위치 모두 패턴 목록에 `test_npm_rewriting_lockfile_still_converges` 를 명시적으로 추가. 예: `` `test_lockfile_*` / `test_npm_rewriting_lockfile_still_converges` / `test_*hasher*` pin these. ``

### 요약
이번 diff(`02d69e324`·`c5fdd1bb8`·`ead99225c`)는 직전 리뷰 라운드(12_31_29)의 documentation WARNING 2건 — `bootstrap-session.sh` 3곳의 "once"/"one-time" 모순, `.claude/tests/README.md` 커버리지 표 + 모듈 docstring 의 lockfile-해시 결속 미요약 — 을 실제로 겨냥해 정확히 고쳤고, 새로 추가한 인라인 주석(post-install 해시 재계산 근거, W2/W3 인용)도 코드와 정확히 일치하며, README·모듈 docstring 갱신도 이 저장소의 기존 문체·인용 관례를 그대로 따랐다. 다만 "4곳 전부 정정"이라 주장한 "once"류 표현 수정이 실제로는 같은 설계 노트 문단 안에 한 곳(`:93`)을 더 남겨 두어, 몇 줄 위에서 스스로 정정한 내용과 정면으로 모순되는 자기모순 문장이 생겼다 — 이 정정 작업 자체가 고치려던 실패 패턴이 그 작업 안에서 재발한 사례라 WARNING 으로 표기한다. 그 외 CHANGELOG(하네스 로컬 툴링이라 해당 없음, 기존 결론 유지)·API 문서·신규 사용자 대상 설정값(신규 `NPM_REWRITES_LOCK` 은 테스트 전용 플래그로 소비 지점에 이미 인라인 문서화됨)·마커 소비자 3곳 간 정합성(`_lib/mermaid_lint_ready.py` 는 마커 내용이 아닌 존재만 확인하므로 이번 콘텐츠 포맷 변경에 영향받지 않음, 무변경 정확)에는 새 문제가 없다.

### 위험도
LOW
