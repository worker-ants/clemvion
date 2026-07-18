# Scope Review — bootstrap-session.sh / test_bootstrap_mermaid_install.py / tests/README.md

## 분석 방법

`review 대상 파일`의 "전체 파일 컨텍스트"만으로는 실제 diff 경계를 알 수 없어, 브랜치
`claude/mermaid-lint-undici-vuln-2956f1`과 `origin/main`의 fork-point
(`git merge-base HEAD origin/main` → `22cc48ef3`)를 확인하고, 거기서 `HEAD`까지의
실제 diff(3 커밋)를 3개 대상 파일에 한정해 추출해 검토했다. (주의: `git diff origin/main`
을 base 로 직접 쓰면 origin/main 이 이 브랜치에 없는 4개 커밋을 더 갖고 있어 무관한
reverse-diff 로 오염됨 — fork-point SHA 로 우회.)

```
git log --oneline 22cc48ef3..HEAD
ead99225c fix(harness): 마커-해시 결속의 자기유발 결함 2건 — install-후 재계산 + 정직한 창 서술 (§F 수렴 리뷰)
c5fdd1bb8 fix(harness): 보안 픽스가 기존 설치에 전파되도록 마커를 lockfile 해시에 결속 (§F 리뷰 W1)
02d69e324 fix(deps): mermaid-lint undici HIGH·dompurify moderate 취약점 해소 + Dependabot 편입 (§F)
```

3개 대상 파일이 변경된 커밋은 `c5fdd1bb8`(핵심 기능 추가)와 `ead99225c`(그 기능의 후속
수정)뿐이며, `02d69e324`(원 취약점 패치, `package-lock.json`/`dependabot.yml`)는 이
3개 파일을 건드리지 않는다.

## 의도 판정: "원 태스크"보다 넓지만 인과적으로 정당

브랜치명·최초 커밋(`02d69e324`)이 가리키는 표면 과제는 "mermaid-lint 의 undici/dompurify
취약점 lockfile 패치"다. 그런데 대상 3파일의 변경은 그 패치를 **설치 완료 마커가 실제로
소비하게 만드는 별도 메커니즘**(`_lock_hash`/`need_install`, lockfile 해시 결속)이다.
표면적으로는 "취약점 lockfile 패치"보다 넓어 보이지만, 다음 근거로 스코프 이탈이 아니라고
판단한다.

1. **인과적 전제조건**: 직전 회차 리뷰(`review/code/2026/07/18/12_06_58` WARNING #1,
   `git show c5fdd1bb8:review/code/.../12_06_58/SUMMARY.md`로 확인)가 정확히 이 갭을
   지적했다 — 기존 "존재-only" 완료 마커는 lockfile 내용과 무관해, 이미 설치를 마친
   checkout·개발자 로컬 클론에는 이번 보안 패치가 전파되지 않는다. 같은 diff 가 신설한
   Dependabot npm 스케줄은 향후 모든 보안 범프를 lockfile-only 로 만들어, 이 활성화 갭이
   1회성이 아니라 **매 후속 보안 PR 마다 구조적으로 재발**한다. 즉 마커-해시 결속이 없으면
   `02d69e324`의 패치 자체와 Dependabot 등록 모두 이미 부트스트랩된 환경에서 사실상
   무의미해진다 — "취약점 해소"라는 원 목표에 대한 인과적 필요조건이다.
2. **프로젝트 표준 워크플로가 명시적으로 요구**: `CLAUDE.md` §외부 LLM 호출 정책은
   "SUMMARY 의 Critical/Warning 에 대한 fix 는 같은 턴의 강제 의무"라고 규정한다.
   `c5fdd1bb8`은 12_06_58 회차의 WARNING #1을 그대로 해소한 커밋, `ead99225c`는
   그 다음 회차(`12_31_29`, `git show ead99225c:review/.../12_31_29/SUMMARY.md`)의
   W1(설계주석 wording)·W2(install-전 해시 스냅샷으로 인한 비수렴 재현)·W3(해셔 부재
   폴백 무테스트)·W4(README/docstring 갱신 누락)를 그대로 해소한 커밋이다. 즉 3커밋
   전체가 "패치 → 리뷰가 찾은 갭 fix → 그 fix의 리뷰가 찾은 자기유발 결함 fix"라는
   단일하고 연속적인 이야기이며, 각 라인이 특정 WARNING 번호에 1:1로 추적된다.
3. **직전 scope 리뷰가 이미 동일 결론**: `12_31_29`회차의 scope 에이전트 자신이
   "마커-lockfile 해시 결속 확장은 원 태스크명(mermaid-lint-undici-vuln)보다 넓지만,
   이 확장이 없으면 같은 diff가 추가한 Dependabot 등록 자체가 기존 checkout에 대해
   무의미해지는 인과적 전제조건이라 정당"이라고 판정(위험도 NONE)했다. 이번 회차에서
   최종 상태를 재검토한 결과도 동일하다.

## 파일별 diff 정밀 검토 — 무관 변경 없음

**`.claude/tools/bootstrap-session.sh`**
- 헤더 주석 §2·섹션2 주석·런타임 echo 메시지의 "once"/"one-time" 표현 삭제 —
  기능이 실제로 "1회성"에서 "lockfile 변경마다"로 바뀐 데 따른 필수 정정(W1 대응).
  무관한 워딩 손질이 아니다.
- "NO LOCK, deliberately" 설계 노트 재작성 — 잔존 동시성 리스크의 재발 빈도가
  "최초 1회뿐"에서 "lockfile 변경마다(정기 Dependabot 포함)"로 실제로 바뀐 것을
  반영(W1 대응). 코드 동작 변경 없이 서술만 고친 대목이지만, 정확히 review 가 지정한
  라인(L63-87 등)만 건드렸고 그 주변 텍스트(TOCTOU 이력, 두 real fix 추적 등)는
  그대로 보존됐다.
- 신규 `_lock_hash()` — 기존 `_file_mtime()`과 동일한 "BSD/GNU 이중 폴백" 관용구를
  재사용(스타일 일관). 새 추상화나 오버엔지니어링 없음.
- `want_hash`/`need_install` 도입으로 조건문 분해 — 리뷰(`I8`, maintainability)가
  "가독성 개선"으로 별도 긍정 평가한 대목으로, 기존 4중 AND 단일조건을 대체할 뿐 다른
  분기·플래그·CLI 인자를 추가하지 않았다.
- 마커 쓰기를 `: > "$marker"`(빈 touch)에서 `printf '%s\n' "$(_lock_hash)" > "$marker"`
  (POST-install 재계산)로 변경 — W2가 실측 재현한 "install-전 해시 스냅샷 → npm 이
  lockfile 재작성 시 영구 비수렴" 결함의 직접 수정.
- 섹션 1(githooks 활성화)·섹션 3(상태 마커 GC)·섹션 4(reaper 호출)는 완전히 무변경 —
  스코프가 섹션 2(설치 가드)에만 정확히 국한됨을 뒷받침.

**`.claude/tests/test_bootstrap_mermaid_install.py`**
- 모듈 docstring에 lockfile-해시 결속 불릿 1개 추가(W4 대응).
- `_NPM_STUB`에 `NPM_REWRITES_LOCK` 조건부 3줄 추가 — W2 테스트(`test_npm_rewriting_
  lockfile_still_converges`)에 필요한 스텁 확장이며 그 외 스텁 동작(pid 기록, sleep,
  fail 분기)은 무변경.
- `_env()`/`_run()` 시그니처에 `rewrites_lock` 파라미터 1개만 추가 — 기존 호출부
  전부 기본값 호환.
- 신규 테스트 4건(`test_lockfile_change_retriggers_install`,
  `test_unchanged_lockfile_does_not_reinstall`,
  `test_npm_rewriting_lockfile_still_converges`,
  `test_missing_hasher_degrades_to_presence_only`) — 각각 W1/W2/W3에 정확히 대응하며
  기존 8개 테스트 바디는 단 한 줄도 수정되지 않았다(순수 추가, drive-by 리팩터 없음).
- import 추가/정리 없음.

**`.claude/tests/README.md`**
- `test_bootstrap_mermaid_install.py` 행 1곳만 수정 — 신규 테스트 4건 요약을
  기존 표의 문체("Also exercises …" 패턴)를 그대로 따라 추가(W4가 요구한 정확한 범위).
  다른 39개 행·컨벤션 절은 완전히 무변경.

## 포맷팅 · 주석 · 임포트 · 설정 체크리스트

| 관점 | 판정 |
|---|---|
| 의도 이상의 변경 | 없음 — 확장된 범위(마커-해시 결속)는 원 취약점 패치의 인과적 전제조건이자 두 차례 리뷰 WARNING 대응, 프로젝트 표준 워크플로가 요구하는 동일-턴 fix |
| 불필요한 리팩토링 | 없음 — 조건문 분해(`need_install`)는 새 기능 구현에 필요한 최소 구조화, 기존 섹션 1/3/4 무변경 |
| 기능 확장(over-engineering) | 없음 — 새 CLI 인자·새 파일·새 추상화 계층 없음. `_lock_hash()`는 기존 `_file_mtime()` 패턴 재사용 |
| 무관한 파일/영역 수정 | 없음 — 3파일 모두 마커-해시 결속이라는 단일 관심사에만 집중, 각 파일 내에서도 무관 섹션 무변경 |
| 포맷팅 변경 | 없음 — 공백/줄바꿈 전용 hunk 없음, 모든 hunk 가 실질 콘텐츠 변경 |
| 주석 변경 | 전부 정당 — 삭제/수정된 주석은 실제로 부정확해진 서술("once")을 바로잡거나 새 메커니즘을 설명하는 것뿐. 무관 주석 추가·삭제 없음 |
| 임포트 변경 | 해당 없음 — 3파일 모두 import 변경 없음 |
| 설정 변경 | 해당 없음 — 3파일 중 설정 파일 없음(`bootstrap-session.sh`는 실행 스크립트) |

## 요약

대상 3파일의 diff(fork-point `22cc48ef3` → `HEAD`, 커밋 `c5fdd1bb8`+`ead99225c`)는
"mermaid-lint undici 취약점 해소"라는 원 태스크명보다 문면상 넓어 보이지만, 실제로는
① 그 취약점 패치가 이미 설치된 checkout 에 전파되지 않는다는 인과적 갭(직전 리뷰
12_06_58 WARNING #1)을 메우는 것과 ② 그 메움 자체가 자기유발한 두 결함(12_31_29
W2/W3)과 문서 드리프트(W4)를 같은 턴에 해소하는 것으로, 프로젝트 표준(`CLAUDE.md`
"SUMMARY Critical/Warning 은 같은 턴 강제 의무")이 요구하는 정상적인 리뷰→수정
사이클이다. 각 diff 라인이 특정 리뷰 발견 번호에 1:1로 추적되며, 무관한 리팩토링·
포맷팅 잡음·기능 확장·불필요한 주석/임포트/설정 변경은 발견되지 않았다. 직전 회차
scope 에이전트의 독립 판정(NONE)과도 일치한다.

## 위험도

NONE
