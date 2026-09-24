# 문서화(Documentation) 리뷰 — nestjs12-upgrade (`@nestjs/typeorm` 12 범프, 2라운드)

## 발견사항

- **[WARNING]** `deps-typeorm12.md` 의 후속 항목이 `nestjs-v12-coordinated-upgrade.md` 에
  "함께 처리한다" 고 명시한 대상 문서에 실제로 착지하지 않는다 — 두 plan 사이 추적 링크가 끊겨 있다
  - 위치: `plan/in-progress/deps-typeorm12.md:122` (`` `nestjs-v12-coordinated-upgrade.md` §3
    재개 조건과 함께 처리한다 ``)
  - 상세: `spec/5-system/1-auth.md` §Rationale 의 `^11.0.1` 캐럿 인용이 향후 `@nestjs/common`
    을 12 로 올리는 동반 업그레이드가 완료되면 stale 해진다는 사실은 이번 `--impl-prep`
    consistency-check(`review/consistency/2026/09/24/17_31_27/plan_coherence.md`)가 이미
    발견했고, 그 checker 는 명시적으로 "`nestjs-v12-coordinated-upgrade.md` §E 또는 '후속' 에
    ... 항목을 추가할 것" 이라 제안했다. 그런데 실제로 그 항목이 추가된 곳은 제안받은 파일이
    아니라 **형제 plan `deps-typeorm12.md` 자신의 '후속' 절**이고, 거기서는 "`§3 재개 조건과
    함께 처리한다`" 는 한 줄짜리 교차 참조만 남겼다. 정작 참조 대상인
    `nestjs-v12-coordinated-upgrade.md` 를 직접 읽어보면(`§3. 재개 조건` 3항목,
    `§E. 종결 조건` 4항목 — 파일 전체 156줄에 걸쳐 `1-auth`/`11.0.1` 문자열 0회 등장, `§C` 절의
    무관한 한 문장 제외) 이 캐럿 정정 작업은 **어디에도 체크리스트 항목으로 존재하지 않는다.**
    같은 후속 절의 바로 다음 항목(`#1382` close)은 실제로 `nestjs-v12-coordinated-upgrade.md`
    §E 에 `- [ ] #1382 close (#1339 는 deps-typeorm12 가 처리했다)` 로 정확히 미러링돼 있어,
    이 캐럿 정정 항목만 선택적으로 누락됐음이 대조로 드러난다.
  - 왜 문제인가: `deps-typeorm12.md` 는 이 PR 이 머지되면 체크리스트의 "plan `complete/` 로"
    가 완료되어 `plan/complete/` 로 옮겨진다(관례상 완료 plan 은 grep 은 가능해도 능동적으로
    다시 열어보는 대상이 아니다). 반면 `nestjs-v12-coordinated-upgrade.md` 는 상류(mailer·
    throttler·TS6)가 풀릴 때까지 `in-progress` 로 계속 열려 있다가 §3 세 조건이 풀리면
    재개된다. 재개 시점의 담당자는 (완료돼 archive 로 넘어간) `deps-typeorm12.md` 의 '후속'
    절이 아니라 눈앞의 `nestjs-v12-coordinated-upgrade.md` §3/§E 체크리스트를 기준으로
    "다 됐다" 를 판단할 개연성이 높다. 그 체크리스트에는 이 항목이 없으므로, §3 세 조건이
    전부 풀리고 §E 네 조건도 전부 체크되어 이 plan 이 `complete/` 로 이동해도 `1-auth.md`
    806~807행의 `^11.0.1` 은 정정되지 않은 채로 남을 수 있다 — `plan_coherence.md` 가 지적한
    바로 그 stale 재발 클래스("캐너리 수치는 spec 에 미러링 말 것" 원칙이 옆 문장의 버전
    숫자에는 적용되지 않았던 전례)가 이번에도 문서 추적 층위에서 반복되는 형태다.
  - 제안: `nestjs-v12-coordinated-upgrade.md` 의 `§3. 재개 조건` 또는 `§E. 종결 조건`에
    "`spec/5-system/1-auth.md` 806~807행의 `^11.0.1` 캐럿 정정 — planner 턴" 항목을 실제
    체크박스로 추가한다(consistency-check 가 원래 요구한 자리). `deps-typeorm12.md` 의
    "후속" 절은 그대로 두되 "이미 `nestjs-v12-coordinated-upgrade.md` §E 에 등재함" 으로
    갱신해 실제 착지를 보증할 것.

## 그 외 확인한 항목 (문제 없음 · 실측으로 검증)

- **`PROJECT.md` 신규 문장** (Node 지원 floor 단락 말미, "backend floor 를 내릴 때의 숨은
  결속") — `pnpm-lock.yaml` 의 `@nestjs/typeorm@12.0.1` 엔트리에 실제로
  `engines: {node: '>=20.19.0'}` 가 있고, `codebase/backend/package.json` 의
  `engines.node` 는 현재 `>=24` 로 그 하한을 충분히 덮는다(직접 확인). "e2e 부팅으로
  확인했다(2026-09-24)" 주장도 `deps-typeorm12.md` 체크리스트의 "e2e 380 PASS" 와
  `RESOLUTION.md` TEST 결과 표와 일치한다. 문서-코드 정합, 위치 지정 정확.
- **`spec-draft-nullable-notation-followups.md` 의 신규 backlog 항목**(lockfile `libc:`
  진동) — 표에 적힌 5개 커밋(`6e5a54816`·`2245cda06`·`1b17701aa`·`f40d0cbd0`·`65df1974f`)의
  작성자와 `libc: [glibc]` 등장 횟수 전/후 값을 `git show` 로 각각 직접 재현했다. 5건 전부
  표와 **정확히 일치**(사람 커밋 2건: 35→0·35→0, dependabot 3건: 0→35·0→35·35→38). 저장소
  자체 규약("실측했다" 주장은 검증 가능해야 한다)을 충실히 지킨 드문 고품질 사례.
- **`pnpm-lock.yaml` diff 축소 결과** — `deps-typeorm12.md` §B 와 `RESOLUTION.md` W1 조치가
  "15줄, 전부 typeorm" 이라 주장한 것을 `git diff origin/main -- pnpm-lock.yaml` 로 직접
  재현: 정확히 15줄 변경, 전부 `@nestjs/typeorm` 관련 필드(`specifier`/`version`/
  `resolution`/`engines`/`peerDependencies`)뿐이었다. 1라운드 WARNING #1(리뷰
  `18_22_23`)이 정확히 해소됨을 확인.
- **`nestjs-v12-coordinated-upgrade.md` frontmatter `worktree: (unstarted)`** — 1라운드
  WARNING #2 에 대한 조치로 본문에 추가된 설명 블록(왜 `(unstarted)` 를 유지하는지)이
  `plan-lifecycle.md §4` 의 sentinel 규정과 이 세션의 실제 상황(전량 롤백, 커밋 0)을 정확히
  근거로 든다. 해소 확인.
- `CHANGELOG.md` 미변경 — 과거 동종 커밋(`0b5b226b3` jest-ESM 네이티브 로드)도 CHANGELOG 를
  건드리지 않은 순수 `build` 범주였고, `git log --oneline -- CHANGELOG.md` 로 확인한 최근
  이력도 전부 사용자에게 보이는 계약/동작 변경(`fix`/`feat`)에만 CHANGELOG 항목을 붙이는
  관례였다. 이번 무동작 의존성 범프에 CHANGELOG 항목이 없는 것은 저장소 관례와 일치 — 갭
  아님.
- `README.md`(루트) 의 "Node.js 24+ (내부) / 20+ (외부 SDK)" 표기는 이번 `PROJECT.md` 신규
  문장과 상충하지 않는다 — 별도 갱신 불필요.
- `codebase/backend/package.json` 단일 캐럿 변경에는 독스트링/README 갱신 대상 코드가 없다.

## 요약

실질 코드 변경은 여전히 `package.json` 한 캐럿 범프뿐이며, 1라운드에서 지적된 WARNING 3건
(lockfile 규모, frontmatter 모순, ESM/CJS 암묵 결속)은 이번 진단에서 전부 실측으로 재확인한
결과 정확히 해소돼 있다. 다만 이번 diff 에 새로 포함된 `deps-typeorm12.md` "후속" 절이
`spec/5-system/1-auth.md` 의 stale 캐럿 인용 정정을 `nestjs-v12-coordinated-upgrade.md` 로
"함께 처리한다" 고 약속하면서도, 정작 그 대상 문서(§3/§E)에는 그 항목이 존재하지 않는 새로운
교차-문서 추적 갭이 하나 발견됐다 — consistency-check(`plan_coherence.md`)가 원래 요구한
착지 지점에 항목이 없으므로, 상류 plan 이 재개·종결될 때 이 정정이 조용히 누락될 위험이
있다. 차단 사유는 아니며 체크박스 한 줄 추가로 해소된다.

## 위험도

LOW
