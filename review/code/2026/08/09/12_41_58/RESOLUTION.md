# RESOLUTION — 12_41_58 (audit 조치분 + 1차 fix 재검증)

**Critical 0 · WARNING 3 · INFO 8 · risk LOW.** router 가 8명 선별(= forced 화이트리스트
전원), 8/8 success, 디스크 리포트 8건 실측 확인 — `forced_missing=[]`, `unfinished=[]`.

**3건 전부 수정.** 이번 라운드의 성격은 1차와 달랐다 — 동작 결함이 아니라 **1차 fix 가
남긴 잔여**(문서 방향·중복·미검증 입력 형태)다. 수렴 신호로 읽는다.

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | requirement/문서 | `.claude/tests/README.md:49` 카탈로그 행이 1차 fix(조건 반전 `== 'true'` → `!= 'false'`)를 반영 못해 **현재 코드와 반대 방향**의 위험을 서술. "`needs: changes` 를 빠뜨리면 전 스텝이 조용히 no-op" 이라고 적혀 있는데, 실제로는 빈 문자열에서 `!= 'false'` 가 참이 되어 스텝이 **실행**된다 | **수정.** 같은 fix 커밋이 다른 3곳(스크립트 docstring · plan 본문 · `test_workflow_yaml_structure.py` 카탈로그 행)은 정정했는데 이 행만 빠졌다 — **문서 미러 4곳 중 1곳 누락**이라는 이 저장소의 반복 패턴. 방향뿐 아니라 "그래서 지금 위험한 회귀는 조건을 되돌리는 것" 까지 다시 씀 |
| W2 | maintainability | `scripts/ci-paths-changed.sh` 의 fail-safe 3줄 블록(사유 출력 · `emit true` · `exit 0`)이 5개 분기에 손으로 복제 | **수정.** `fail_safe()` 헬퍼로 추출. 이 중복이 위험한 이유를 주석에 남겼다 — 한 곳만 고치고 놓치는 실수의 방향이 하필 `emit false`(조용한 통과)라 이 스크립트가 존재하는 이유인 실패를 그대로 만든다. **뮤테이션: 헬퍼를 `emit false` 로 뒤집으면 6건 RED**(추출 전에는 분기 하나당 2건이었다 — 단일 지점이 6분기 전체를 커버하게 됐다) |
| W3 | testing | 실사용 pathspec `'codebase/**/package.json'`(중간 `**`)이 어떤 테스트에도 없었다. 신설 테스트는 끝이 `**` 인 형태만 검증 | **수정 + 실제 갭 확인.** 무수정 프로브로 실측: 중간 `**` 는 디렉터리가 **1개 이상**일 때만 맞아 `codebase/package.json`(깊이 0)을 놓친다. 지금 그런 파일이 없어 잠복이지만 생기는 순간 조용히 `relevant=false` 다. → 워크플로에 깊이 0 pathspec 명시 + 사유 주석, 테스트 3종(깊이 0/1/2 단언 · **"짝이 왜 둘인지" 를 고정하는 반증 테스트** · 워크플로 결속). **뮤테이션: 워크플로에서 깊이 0 을 지우면 RED** |

### 후속·미조치 (INFO 8건)

전부 조치 불요이거나 이미 추적 중이다. 세 건만 기록해 둔다:

- **INFO 1 (scope)** — 의존성 패치가 이 PR 에 번들된 것. 이번 PR 이 `audit` 잡을 처음
  실행시켜 드러난 기존 취약점이라, 해소하지 않으면 "체크를 통과시켜 required 로 올린다"
  는 목적 자체가 달성되지 않는다. plan §부수 에 근거 기록.
- **INFO 2 (dependency)** — `overrides.nanoid` 가 unscoped. 향후 `nanoid@^5` 를 요구하는
  패키지가 오면 조용히 `^3.3.17` 로 강제된다. 현재 소비 경로가 postcss 전이 1곳뿐이고,
  이 저장소는 충돌이 **실제로 생겼을 때** 레인지 스코프로 좁히는 것을 규약으로 적어두고
  있다(`pnpm-workspace.yaml` undici 주석) — 없는 충돌을 미리 설계하지 않는다.
- **INFO 3 (lockfile `libc` churn)** — `deps-guard-hardening.md` §후속(P3)에 등재 완료.

INFO 4·5·6·8(주석 복제 · `case` 스타일 · substring 매칭 정밀도 · 테스트 헬퍼 env 중복)은
가독성 항목이고, INFO 4 는 이미 W7(reusable workflow 추출)로 추적 중이다. INFO 7
(`permissions: contents: read` 미명시)은 저장소 전역 관례라 이 PR 에서 단독 변경하지 않는다.

## TEST 결과

- lint : **PASS** (53s)
- unit : **PASS** (73s)
- build : **PASS** (116s)
- e2e : **PASS** (270s — backend jest 46 suites/261 + playwright 51, 로그 전수 확인)
  > **e2e 를 돌린 근거**: fix 변경 set 에 `scripts/ci-paths-changed.sh` 가 있다.
  > `.claude/**`·`.github/**`·`*.md`·`review/**` 는 화이트리스트지만 `scripts/**` 는
  > **목록에 없다**(`PROJECT.md §e2e 면제 화이트리스트`). "CI 헬퍼라 성격상 `.github/**`
  > 와 같다" 는 것은 화이트리스트의 임의 확대이고, 그 문서가 명시로 금지한다.
- harness : **942 tests OK** (신규 3건 — 깊이 0/1/2 · 반증 · 워크플로 결속)

## 보류·후속 항목

없음. INFO 중 추적이 필요한 것은 위 §후속 에 적었고, 각각 기존 plan 에 이미 등재돼 있다.
