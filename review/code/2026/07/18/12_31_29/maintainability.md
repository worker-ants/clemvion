# Maintainability Review

리뷰 범위: `git diff 22cc48ef3..HEAD`(이 브랜치의 실제 fork-point. `origin/main`은 별개 미병합 커밋 `d25f552b2`을 하나 더 갖고 있어 `origin/main..HEAD`로 diff하면 그 커밋이 역-diff로 섞여 오염된다는 것을 먼저 확인하고 fork-point로 재계산함)로 산출한 5파일 순수 diff:

- `.claude/tools/bootstrap-session.sh` — 설치 판정 로직에 lockfile 해시 결속 추가 (+34/-3)
- `.claude/tests/test_bootstrap_mermaid_install.py` — 신규 테스트 2건 + 헬퍼 1개 (+32)
- `.github/dependabot.yml` — npm ecosystem 신규 엔트리 (+14)
- `.claude/tools/mermaid-lint/package-lock.json` — undici/dompurify 버전 범프 (자동생성, 코드 아님)
- `PROJECT.md` — 기존 불릿에 1문장 보강 (+1/-1)

이 라운드는 직전 리뷰(`review/code/2026/07/18/12_06_58`)의 WARNING #1(설치완료 마커가 lockfile과 무관해 보안 패치가 기존 checkout에 전파 안 됨)과 WARNING #2(PROJECT.md 거버넌스 절의 Dependabot npm 경로 미기재)를 해소하는 목적성 있는 후속 diff다.

## 발견사항

- **[INFO]** 컴포짓 조건문을 이름 붙은 중간 변수로 분해 — 가독성 개선 (지적 아닌 긍정 관찰)
  - 위치: `.claude/tools/bootstrap-session.sh` 설치 판정 블록 (구 `if [ -f pkg.json ] && [ ! -f marker ] && ! throttled && command -v npm` 4중 AND 단일 조건 → 신규 `want_hash`/`need_install` 2단계)
  - 상세: 기존에는 "설치가 필요한가"와 "지금 실행해도 되는가(throttle/npm 존재)"라는 서로 다른 두 판단이 하나의 4중 AND 체인에 뭉쳐 있었다. 신규 코드는 이를 `need_install`(마커 부재 OR 해시 불일치) 계산과, 그 결과를 소비하는 `if [ "$need_install" = 1 ] && ! _install_throttled && command -v npm ...` 실행 조건으로 분리했다. 각 판단에 이름이 붙어 "왜" 설치가 트리거되는지 코드만 보고 파악 가능해졌다.
  - 제안: 없음.

- **[INFO]** 신규 헬퍼(`_lock_hash`)가 스크립트 전역 변수(`$tool_dir`)를 암묵 참조 — 기존 컨벤션과 일관
  - 위치: `.claude/tools/bootstrap-session.sh:96-103`
  - 상세: `_lock_hash()`는 파라미터 없이 상위 스코프의 `$tool_dir`를 클로저처럼 읽는다. 일반적으로는 재사용성을 낮추는 패턴이지만, 이 파일은 이미 `_install_throttled()`가 `$fail_marker`/`$retry_after`를 동일 방식으로 참조하는 150줄짜리 단일 목적 부트스트랩 스크립트라 기존 스타일과 일관되다. 문제로 보지 않음.
  - 제안: 없음.

- **[INFO]** 신규 주석 블록의 밀도가 높음 — 파일 기존 스타일의 연장, 신규 결함 아님
  - 위치: `.claude/tools/bootstrap-session.sh:49-56` ("COMPLETION MARKER" 절에 8줄 추가)
  - 상세: "2. Ensure mermaid-lint deps" 섹션은 이미 과거 실제 인시던트(TOCTOU 락 경합, 부분설치 무신호 디스에이블)를 설명하는 50줄 이상의 주석을 갖고 있고, 이번 diff는 여기에 "마커를 lockfile 해시에 결속한 이유(review 12_06_58 W1)"를 8줄 더 추가했다. 코드 실질 로직(약 15줄)에 비해 주석이 훨씬 길어 스캔 시간이 늘지만, 반복된 실제 버그(TOCTOU 레이스 → 이번 stale 마커)를 다음 유지보수자가 되풀이하지 않도록 남긴 근거 기록이라 실질 결함으로 보지 않는다.
  - 제안: (선택, 비차단) 이 절의 주석이 더 늘어나면 설계 노트를 별도 문서로 분리하고 스크립트에는 요약 + 링크만 남기는 리팩터를 고려할 수 있음. 현재 분량에서는 불필요.

- **[INFO]** 신규 테스트 헬퍼(`_write_lock`)가 클래스 상단 `# --- helpers ---` 블록이 아닌 사용처 인접 위치에 정의됨
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py` (`_write_lock` 정의부, `test_lockfile_change_retriggers_install` 바로 앞)
  - 상세: 기존 관례는 `_git`/`_write`/`_env`/`_run`/`_npm_calls` 등 밑줄 프리픽스 헬퍼를 `setUp` 직후 `# --- helpers ---` 섹션에 모아둔다. 신규 `_write_lock`(`self._write`의 얇은 래퍼)은 대신 자신을 쓰는 두 테스트 바로 앞, 해당 그룹 코멘트 밑에 위치한다. "좁은 용도 헬퍼는 사용처와 지역성을 유지한다"는 것도 합리적 대안 스타일이라 결함이라 보기 어렵지만, 파일 전체에서 유일한 예외라 향후 유사 헬퍼가 늘면 배치 기준이 모호해질 소지가 있다.
  - 제안: 문제 삼을 정도는 아님. 다음에 유사한 국소 헬퍼가 하나 더 추가될 때 배치 규칙(전역 helpers 블록 vs 지역 그룹)을 한 줄로 명문화하는 정도면 충분.

## 점검 관점별 요약

1. **가독성**: 양호. 조건 분해로 오히려 개선.
2. **네이밍**: `_lock_hash`/`_install_throttled`/`_file_mtime`(함수, `_` prefix) vs `want_hash`/`need_install`(값, prefix 없음) 구분이 파일 기존 규약과 일치. 테스트 메서드명(`test_lockfile_change_retriggers_install` 등)도 기존 서술적 snake_case 패턴 준수.
3. **함수 길이**: `_lock_hash`(4줄), `_install_throttled`(4줄, 변경 없음) 모두 짧음. 신규 테스트 메서드도 15~20줄 내외로 기존 테스트와 비슷한 길이.
4. **중첩 깊이**: 신규 `if [ pkg.json ] { if [ !marker ] elif [ hash mismatch ] }` 는 2단 중첩으로 과도하지 않음.
5. **매직 넘버**: 신규 코드에 새로 도입된 매직 넘버 없음. `need_install=1/0`은 bash 관용 플래그 패턴이고 `retry_after` 기본값(1800)은 기존 코드(diff 밖)에서 이미 주석으로 설명됨.
6. **중복 코드**: `_lock_hash`의 `shasum || sha256sum` 폴백은 기존 `_file_mtime`의 `stat -f || stat -c` 폴백과 같은 관용구지만 서로 다른 대상(해시 vs mtime)에 대한 병렬 구현이라 중복이 아님. `.claude/tools/`, `.claude/hooks/` 전체에 유사 해시 로직이 이미 있는지 확인했으나 없음(신규 단일 지점).
7. **코드 복잡도**: 조건 분기가 소폭 늘었으나(단일 4중 AND → 중첩 if/elif + 최종 3중 AND) 추가된 동작(마커 부재 OR 해시 불일치)에 비례하는 수준. 과도하지 않음.
8. **일관성**: 인용 스타일(`"$var"`), 방어적 `... 2>/dev/null || true` 관용구, `[ ]` POSIX test 사용(bashism `[[ ]]` 미사용), `set -u` 하에서 사용 전 항상 값 대입되는 변수 초기화 습관 모두 파일 기존 관례를 그대로 따름. `dependabot.yml` 신규 엔트리도 기존 GitHub Actions 엔트리와 같은 "주석으로 근거 설명 후 설정 블록" 포맷을 유지. `PROJECT.md` 보강 문장도 해당 불릿의 기존 고밀도 서술 스타일과 일치.

## 요약

이번 diff는 직전 리뷰의 두 WARNING을 정확히 겨냥해 해소하는 목적성 있는 소규모 변경이다. 핵심 로직 변경(`bootstrap-session.sh`의 설치 판정)은 오히려 기존의 4중 AND 단일 조건을 `need_install`/`want_hash`라는 이름 붙은 중간 변수로 분해해 가독성을 개선했고, 헬퍼 함수 네이밍·인용 스타일·방어적 에러 처리 관용구 모두 파일 기존 컨벤션을 그대로 따른다. 신규 테스트 2건도 파일의 기존 명명·구조·독립 테스트 스타일과 일치하며 코드 변경량에 비례하는 커버리지를 추가했다. 매직 넘버·과도한 중첩·유해한 중복·높은 순환복잡도 등 실질적 유지보수성 문제는 발견되지 않았고, 주석 밀도·테스트 헬퍼 배치 위치 정도만 비차단 참고사항(INFO)으로 남긴다.

## 위험도

LOW
