---
title: 의존성 보안 가드 경화 3건 — 오버라이드 바닥 침식 검출 · audit 수용 근거 규약 · dependabot 되돌림 방지
worktree: (unstarted)
started: 2026-07-31
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

> **상태 (2026-08-08 위생 정리)** — **코드·CI 작업은 전부 머지됐다** (`#1043`, `a441e7f76`).
> `in-progress/` 에 남는 이유는 **§남은 수동 조치 1건뿐**이며, 그건 repo Settings 라
> 파일로 처리할 수 없다(사용자 액션). 그 1건이 끝나면 `complete/` 로 옮긴다.
>
> `worktree:` 를 `deps-guard` → `(unstarted)` 로 정정했다 — 그 worktree 는 머지 후 회수됐다.
> 죽은 이름을 두면 `plan_guard.py` 가 매칭할 대상이 없어 조용히 비게 되고,
> `plan-stale-audit.sh` 는 살아있는 worktree 로 오독한다.

## Overview

`#1034`·`#1036`·`#1038` 세 PR 이 각각 같은 뿌리에서 나온 결함을 고쳤다. 개별 증상은 닫았지만
**재발을 막는 장치가 없다**. 세 건 모두 "사람이 다음에도 똑같이 놓칠 것" 이 확실한 클래스라 자동화한다.

## 1. 오버라이드 바닥이 조용히 낮아지는 것을 검출한다 (P1)

### 관측된 사실

`pnpm-workspace.yaml` 의 `overrides` 는 "이 하한 아래로 내려가지 말라" 는 **보안 바닥** 선언이다.
그런데 그 패키지에 **새 CVE 가 공시되면 바닥이 그대로인 채 취약 버전이 다시 해소**된다. 실측 5건:

| 패키지 | 당시 바닥 | 필요 패치 | 발견 PR |
| --- | --- | --- | --- |
| `next>postcss` | `^8.5.14` | `>=8.5.18` | `#1036` |
| `liquidjs` | `^10.27.0` | `>=10.27.1` | `#1038` |
| `protobufjs` | `^7.6.3` | `>=7.6.5` | `#1038` |
| `fast-uri` | `^3.1.2` | `>=3.1.4` | `#1038` |
| `hono` | `^4.12.21` | `>=4.12.27` | `#1038` |

`pnpm audit` 이 사후에 잡아주긴 하지만, **그때는 이미 취약 버전이 설치 트리에 들어와 있다.**
게다가 audit 게이트가 다른 이유로 이미 빨간불이면 이 신호가 묻힌다(실제로 `#1038` 이전 17건 상태에서
4건이 묻혀 있었다).

### 조치

`scripts/check-pnpm-security-config.py` 에 **"오버라이드 하한 < 알려진 패치 하한"** 검출을 얹는다.

설계 메모 (착수 시 판단):

- 패치 하한을 어디서 얻나 — audit advisory 의 `patched_versions` 를 쓰면 네트워크 의존이 생긴다.
  현행 스크립트는 순수 로컬 스냅샷 대조라 **성격이 다르다**. 별도 스크립트/잡으로 분리할지,
  기존 스크립트에 옵셔널 모드로 넣을지 먼저 정할 것.
- CI 배선은 `deps-security-checks.yml` 의 config-guard 잡 옆에 두는 것이 자연스럽다.
- **주의**: `EXPECTED_OVERRIDES` 2-place 동기화 규약(`PROJECT.md`)을 깨지 않을 것.

## 2. audit 수용(`ignoreCves`) 근거 규약 (P1)

### 관측된 사실

`#1038` 에서 `brace-expansion` CVE 를 "두 경로 모두 dev 전용" 이라는 근거로 수용했는데 **틀렸다** —
세 번째 경로가 프로덕션이었다(`@nestjs-modules/mailer > mjml > … > brace-expansion@2.1.4`,
`@nestjs-modules/mailer` 는 `dependencies`, `mjml` 은 pnpm 이 충족한 optional peer).

원인은 검증 절차 자체였다:

1. `pnpm audit` 출력의 `paths` 를 잘라 보고(`[:3]`) 세 번째 경로를 못 봤다
2. `pnpm audit --prod` 를 **돌리지 않았다** — flag 없는 audit 은 dev/prod 를 구분하지 않는다

리뷰가 잡아 실제 해소로 전환했지만, **다음 사람도 같은 방식으로 틀릴 수 있다.**

### 조치

`ignoreCves` 에 항목을 추가할 때 요구할 근거를 규약으로 명문화한다:

- `pnpm audit --prod` 결과 (해당 CVE 가 prod 트리에 **없음**을 보이는 출력)
- 프로덕션 이미지 실물 확인 (`docker run … ls node_modules/.pnpm/<pkg>@*`)
- 경로를 **자르지 않은** 전체 `paths` 목록

문서 위치 후보: `PROJECT.md` 의 의존성 절, 또는 `pnpm-workspace.yaml` 의 `auditConfig` 주석 블록
(현재도 "수용은 반드시 근거·영향경로·해소 조건과 함께" 라고만 적혀 있어 **무엇이 충분한 근거인지**가
비어 있다). 가능하면 `check-pnpm-security-config.py` 가 신규 `ignoreCves` 항목에 대해 주석에
`--prod` 근거 문구가 있는지 정도는 기계적으로 확인할 수 있는지도 검토.

## 3. dependabot 되돌림 방지 (P2)

### 관측된 사실

`#1034` 가 고친 main 빌드 차단의 근본 원인:

- `5898ae13f` (#1029, **보안 그룹**): postcss `^8.5.14` → `^8.5.18` + lockfile 갱신 → CI success
- `395dedc8b` (#1030, next bump): **#1029 이전 base** 에서 만들어져 postcss 를 `^8.5.14` 로 **되돌림**.
  lockfile 은 `^8.5.18` 인 채 남아 `pnpm install --frozen-lockfile` 이 `ERR_PNPM_OUTDATED_LOCKFILE`
  로 실패 → **main CI failure**

즉 "구 base 에서 만들어진 PR 이 최신 보안 bump 를 조용히 되돌리는" 패턴이다. dependabot 이 group 으로
여러 PR 을 동시에 열면 언제든 재발한다.

### 조치 (택1 또는 병행)

- (a) dependabot 설정에 rebase 전략 강제 — 머지 직전 base 재기준화
- (b) `frozen-lockfile` 검증을 **required check** 로 승격 — 되돌림이 머지 전에 빨간불로 드러난다
- (c) `.github/workflows/` 에 "package.json ↔ lockfile specifier 정합" 전용 경량 잡 추가

(b) 가 가장 직접적이다 — 이번 결함의 발현 지점이 정확히 그것이었다. 다만 현재 `frozen-lockfile` 이
어느 잡에서 도는지(`deps-security-checks.yml` 인지 build 인지) 먼저 확인할 것.

## 체크리스트

- [x] §1 침식 검출 — `scripts/check-override-floors.py` 신설 + `deps-security-checks.yml` 에
      `override-floors` 잡 배선. **설계 판단**: 기존 `check-pnpm-security-config.py`(순수 로컬
      스냅샷)에 넣지 않고 분리했다 — 본 가드는 `pnpm audit` 레지스트리 조회가 필요해서, 한
      스크립트에 넣으면 네트워크 장애가 로컬 대조까지 죽인다.
- [x] §2 `ignoreCves` 근거 규약 — `pnpm-workspace.yaml` `auditConfig` 주석에 요구 근거 3종
      명문화(`--prod` 출력 · 프로덕션 이미지 실물 확인 · 자르지 않은 전체 `paths`) + `#1038`
      실패 경위를 근거로 기록. 기계 검사는 넣지 않았다(§아래 Rationale).
- [x] §3 dependabot — **루트 pnpm 워크스페이스가 `dependabot.yml` 에 아예 미등록**이었음을
      발견. npm_and_yarn 그룹 PR 은 repo Settings 의 security updates 만 만들고 있어 파일로
      제어할 여지가 없었다. 루트 트리 등록 + `rebase-strategy: auto` 명시 + 사고 경위 주석.
- [x] 회귀 테스트 — `.claude/tests/test_override_floors.py` **39건**(4축: 키 추출 · 분류 ·
      `ignoreCves` 억제 경로 baseline · fail-closed. + 회귀 고정 2클래스: 통합 리포트 ·
      스키마 드리프트). 워크플로 구조 가드 `test_workflow_yaml_structure.py` 6건.
      하네스 전체 **758건** 통과 (수치는 push 직전 재측정 — 라운드마다 늘어 stale 되기 쉽다).
      mutation 으로 non-vacuous 증명: 추출 로직 되돌림 · 분류 fail 경로 제거 · 다단 체인
      첫`>` 회귀 · fail-closed 분기 fail-open 되돌림 · YAML 사고 원문 재현 · 통합 리포트
      조기 return 부활 · actions 드리프트 옛 결합 복원(+반대편 오판) — 전부 RED 확인.
- [x] TEST WORKFLOW (1차) — lint PASS(54s) · unit PASS · build PASS(163s) · e2e PASS(260/260, 325s).
- [x] `/ai-review` 1차 (`01_12_24`) — Critical 4 + Warning 4. 권장 조치 8건 전부 반영:
      `ignoreCves` 전역 억제 사각(→ `actions[]` + 경로 baseline) · `run_audit()` fail-closed ·
      CI 등재 3건(harness-checks paths · README 카탈로그 · dependabot 루트 예외) ·
      `override_target()` 다단 체인 · 다건 동시 매칭 테스트 · unittest 잡 PyYAML.
- [x] TEST WORKFLOW (2차, 리뷰 조치 후) — lint PASS(54s) · unit PASS(73s) · build PASS(122s) ·
      e2e PASS(400s: backend jest 46 suites/260 tests + playwright 51). 하네스 스위트 731 OK.
      1차 e2e 는 `initdb: No space left on device` 로 postgres 가 안 떠 실패했다 — 회귀가
      아니라 디스크 부족. `docker builder prune -af` + image prune 으로 66GB 회수 후 통과.
- [x] `/ai-review` 2차 (`01_56_46`) — Critical 1 + Warning 8. **1차 조치가 새 Critical 을
      만들었다**: PyYAML 스텝을 기존 스텝의 `name:`/`run:` 사이에 끼워 넣어 `run:` 이
      중복됐고, YAML 은 뒤 값을 택하므로 `pip install` 이 통째로 소실됐다(위 스텝은
      `run`/`uses` 가 없는 스키마 위반). 로컬로는 절대 안 드러난다 — 워크플로는 개발 머신에서
      실행되지 않고 `yaml.safe_load` 도 조용히 받는다. reviewer 8명 전원이 독립 확인.
      → 구조 정정 + `test_workflow_yaml_structure.py` 신설(중복 키·스텝 run/uses).
      Warning 8건도 전부 조치(축 개수 서술·중간 scope 체인·통합 리포트·헬퍼 모듈화·
      PROJECT.md 3번째 잡·stdlib 전용 서술·카탈로그 2행) + INFO 11/12/13/15/16.
- [x] TEST WORKFLOW (3차) — lint PASS(54s) · unit PASS(65s) · build PASS(125s) ·
      e2e PASS(283s: backend jest 46 suites/260 + playwright 51). 하네스 739 OK.
- [x] `/ai-review` 3차 (`02_38_45`) — **Critical 0** · Warning 6 · INFO 11 (risk LOW).
      1·2차 Critical 5건 전부 해소 확인(reviewer 9명이 스위트 실행·실제 `pnpm audit` 호출·
      손상 커밋 원문 재생으로 직접 재검증). Warning 6건 전부 조치 — audit 하위 필드 스키마
      드리프트 fail-closed · plan 수치 stale · 중간 scope 조합 리터럴 pin · 스텁 조립 방식 ·
      워크플로 헤더 잡 개수 · "두 번→세 번" 서술. INFO 2·4·5·9·10 도 조치(나머지는 위
      §3차 리뷰에서 미조치로 남긴 것 에 근거 기록).
- [x] TEST WORKFLOW (4차) — lint PASS(51s) · unit PASS(62s) · build PASS(114s) ·
      e2e PASS(285s: backend jest 46 suites/260 + playwright 51). 하네스 744 OK.
- [x] `/ai-review` 4차 (`03_16_51`) — Critical 0 · Warning 2 (risk MEDIUM).
      **3차 조치가 또 결함을 남겼다**: `actions` 스키마 드리프트 판정에 `and not reported` 를
      붙여, override 와 **무관한** advisory 하나만 정상 파싱돼도 검사가 통째로 죽었다
      (실측 exit 0). `ignoreCves` 억제분을 보는 유일한 창구가 조용히 닫히는 형태 —
      이 스크립트가 막으려는 실패의 정확한 재현이다. `actions` 원소 자체로 판정하도록 분리.
      W2(문서 drift, 같은 클래스 3회째)는 수치를 코드에 결속해 닫았다 —
      `FailClosedSiteCountTest` 가 소스의 `_undecidable()` 호출 지점을 세어 docstring·README
      서술과 어긋나면 fail. 카탈로그 가드가 행의 *존재*만 보는 사각을 메운다.
- [x] TEST WORKFLOW (5차) — lint PASS(50s) · unit PASS(63s) · build PASS(112s) ·
      e2e PASS(267s: backend jest 46 suites/260 + playwright 51).
- [x] `/ai-review` 5차 (`03_47_10`) — Critical 0 · Warning 2 (둘 다 testing, 뮤턴트로 실증).
      (1) 스텁이 늘 exit 0 이라 "returncode 로 판단하지 않는다" 불변식이 미검증 —
      `proc.returncode != 0` 뮤턴트가 28건 전부 GREEN 이었다. 스텁에 종료 코드를 붙이고
      `ReturncodeInvariantTest` 로 양방향 고정. (2) `overrides` 키 자체가 없거나 오타면
      대상 0개로 **항상 exit 0** — 파일 부재는 갈랐는데 이 경로만 남아 있었다. fail-closed
      추가(빈 `overrides: {}` 는 의도일 수 있어 **키의 부재**만 가른다).
      INFO 3(reviewer 3명 공통): `subprocess.run` 에 `timeout=300` + `TimeoutExpired` 라우팅.
      → fail-closed 지점 6곳 → 8곳. `FailClosedSiteCountTest` 가 즉시 빨간불을 내
      문서 동반 갱신을 강제했다(4차에 심은 가드가 설계대로 동작).
- [x] TEST WORKFLOW (6차) — lint PASS(50s) · unit PASS(63s) · build PASS(112s) ·
      e2e PASS(295s: backend jest 46 suites/260 + playwright 51).
- [x] `/ai-review` 6차 (`04_09_43`) — Critical 0 · Warning 3. 셋 다 `load_override_targets()`
      **입력 경로 한 곳**으로 수렴해서, 형태를 하나씩 막지 않고 그 자리를 통째로 닫았다:
      (1) `overrides` 값 타입 미검증 — 키는 있는데 `None`·문자열·리스트면 대상이 유실된 채
      exit 0 (side_effect 가 `importlib` 로 실행 재현). 판정을 "키 존재" → **"매핑인가"** 로
      바꾸니 키 부재·오타·값 없음·비-매핑이 한 조건에 들어왔다. (2) `yaml.safe_load` 예외
      미처리 — 구문 오류가 traceback + **exit 1**, 즉 "침식 발견" 과 같은 코드로 죽었다.
      JSON 쪽은 이미 갈랐는데 YAML 쪽만 비어 있었다. (3) `TimeoutExpired` 분기 미검증 —
      안 던지는 예외 타입으로 바꿔도 33건 전부 GREEN 이었다(리뷰 실측). in-process mock 으로
      고정하고, `timeout=` 인자가 실제로 넘어가는지도 별도 단언(없으면 그 분기는 영원히 안 탄다).
      → fail-closed 지점 8곳 → 9곳.
- [x] TEST WORKFLOW (7차) — lint PASS(50s) · unit PASS(63s) · build PASS(110s) ·
      e2e PASS(305s: backend jest 46 suites/260 + playwright 51).
- [x] `/ai-review` 7차 (`04_35_33`) — Critical 0 · Warning 2, 둘 다 `main()` 의 `widened` 계산
      루프 9줄에 대한 무검증(뮤턴트 실측: 38건 전부 GREEN 유지). 그 9줄 안의 판단 둘이 이
      가드의 **범위 경계**를 정한다 — (a) override 미관리 모듈 스킵을 무력화하면 무관한
      패키지가 이 잡을 거짓으로 빨갛게 만들고, (b) `EXPECTED_SUPPRESSED_PATHS` 기본값을
      "이미 수용됨" 쪽으로 뒤집으면 신규 억제가 통째로 조용히 통과한다(막으려는 그 실패).
      `WidenedFilterTest` 로 양쪽 고정. INFO 11: PyYAML 1.1 리졸버가 `on`/`yes` 를 불리언으로
      만들어 최상위 키에 타입이 섞이면 진단 조립의 `sorted()` 가 TypeError 로 죽던 것 —
      `key=str` 로 제거(재현 후 수정).
- [x] TEST WORKFLOW (8차) — lint PASS(50s) · unit PASS(63s) · build PASS(111s) ·
      e2e PASS(261s: backend jest 46 suites/260 + playwright 51).
- [x] `/ai-review` 8차 (`04_58_18`) — Critical 0 · Warning 2. security/scope/side_effect/
      maintainability/documentation 5명은 8차 연속 LOW·clean 수렴.
      (1) **flaky 가드**: `WidenedFilterTest...always_widens` 가 50회 중 1회 exit 0 으로 끝났다
      (스텁이 돌았다면 나올 수 없는 값). 300회 재현 시도로는 안 나왔고 근본 원인 미확정이라,
      확률을 재는 대신 **구조로 없애고 재발 시 시끄럽게 만들었다** — 스텁을 rename 으로
      원자적으로 배치(`execvp` 는 PATH 항목이 EACCES 면 다음으로 넘어가므로 실행 불가 상태가
      잠깐이라도 보이면 진짜 pnpm 이 뽑힌다) + 스텁이 마커를 남기고 없으면 `StubNotUsed` 로
      즉시 실패. 뮤턴트(스텁 chmod 644)로 마커 단언이 실제로 문다는 것 확인.
      (2) `sorted(key=str)` 회귀 테스트 부재 → 추가.
      INFO 1(`read_text` 가 예외 범위 밖 — 유효하지 않은 UTF-8 이 traceback+exit 1) ·
      INFO 4(주석 위치) · INFO 6(4라운드 이월 "5건→4건" 서술) 코드 조치 완료 — 단
      예외 확장은 회귀 테스트가 9차에 가서야 붙었다(9차 W3). "조치 완료" 를 코드만
      보고 쓴 것이 이 브랜치의 "코드+테스트가 모여야 fix" 기준에 못 미쳤다.
- [x] TEST WORKFLOW (9차) — lint PASS(50s) · unit PASS(63s) · build PASS(112s) ·
      e2e PASS(305s: backend jest 46 suites/260 + playwright 51).
- [x] `/ai-review` 9차 (`05_36_28`) — Critical 0 · Warning 4. 셋은 실측 재현된 실제 결함:
      (1) `run_audit()` 이 `FileNotFoundError` 를 안 잡아 **pnpm 부재 시 traceback + exit 1** —
      이 스크립트에서 1 은 "침식 발견" 이라 실행 실패가 정상 발견 신호와 같은 코드가 된다.
      8차에서 형제 함수의 읽기 경로는 고쳤는데 이쪽 서브프로세스 호출을 빠뜨렸다. `OSError`
      포섭. (2) `chain_segments()` 가 `>` **앞** 공백을 구분자로 안 봐서 `"next > postcss"` 가
      유령 대상이 된다 — 축 1 실패의 **4번째 형제**이고 증상은 늘 조용한 통과. 추출 결과에
      공백이 남으면 fail-closed(npm 패키지명에 공백은 불가). (3) 8차의 예외 확장
      (`UnicodeDecodeError`/`OSError`)에 회귀 테스트 부재 — in-process 테스트 추가.
      → fail-closed 지점 9곳 → 11곳.
      **W4(scope)는 사실이나 조치하지 않는다**: 커밋 `f46c560e9` 가 RESOLUTION 을 쓰는 사이
      디스크에 떨어진 8차 세션 산출물 6개를 `git add -A` 로 함께 쓸어담았다. 기능 영향 없고
      아직 push 전이지만, 정리하려면 대화형 rebase 가 필요한데 이 환경에서는 쓸 수 없다.
      기록으로 남기고 넘어간다 — 교훈은 리뷰가 **비동기로 파일을 쓰는 동안** `git add -A` 를
      하지 말 것.
- [x] TEST WORKFLOW (10차) — lint PASS(50s) · unit PASS(64s) · build PASS(112s) ·
      e2e PASS(260s: backend jest 46 suites/260 + playwright 51).
- [x] `/ai-review` 10차 (`06_03_11`) — **Critical 2** (실 registry 실행으로 발견). §축 3 철회로 종결.
- [x] **축 3 철회** (사용자 결정) — 아래 §축 3 철회 참조.
- [x] TEST WORKFLOW (11차) — lint PASS(68s) · unit PASS(82s) · build PASS(172s) ·
      e2e PASS(315s: backend jest 46 suites/260 + playwright 51).
- [x] `/ai-review` 11차 (`08_20_09`) — **Critical 0 · Warning 1**. 10차 CRITICAL 2건이 축 3
      철회로 해소됐음을 reviewer 7명 전원이 교차 검증(diff 대조·grep 전수·in-process 실측).
      남은 W1: `advisories` 컨테이너 타입 미검증 — list 로 오면 `.items()` 가 AttributeError 로
      죽어 exit 1(= "침식 발견")이 된다. **10차에 지적됐는데 그 함수를 손대면서도 이월시켰다.**
      타입 가드 + 회귀 테스트 추가(뮤턴트 RED). fail-closed 지점 10곳 → 11곳.
- [x] RESOLUTION 최종 (`04_35_33/RESOLUTION.md`) — 라운드 1~11 통합
- [x] push + PR — **머지 완료 `#1043` (`a441e7f76`)**. 리뷰를 못 받은 채 넣었던 11차 W1 fix
      (`advisories` 컨테이너 타입 가드)까지 함께 착지한 것을 실측 확인:
      `scripts/check-override-floors.py:233` `if not isinstance(advisories, dict)`.
      (이 체크박스는 머지 후에도 `[ ]` 로 남아 있었다 — 2026-08-08 위생 정리에서 정정.)

> **마지막 조치는 리뷰를 받지 않았다.** 11차 W1 fix 는 그 리뷰 이후에 넣었다. 사용자가 "축 3
> 처분 후 PR 올리고 종료" 로 범위를 정했고, 이 브랜치는 `codebase/**` 를 안 건드려 push
> 게이트가 차단하지 않는다(`evaluate_review()` dry-run: "no codebase/ changes — allowed").
> 변경은 타입 가드 3줄 + 테스트 1건이며 뮤턴트로 non-vacuous 확인했다.

## 개발 중 실측으로 드러난 것

**패키지명 추출을 세 번 틀렸다.** override 키가 `pkg` · `a>b` · `a>b>c` · `pkg@range` 로
오고 scope 패키지가 체인 어디에든 섞인다. 셋 다 증상이 같았다 — 매칭 0건 → **조용한 통과**.

1. `>` 를 먼저 자르면 `undici@>=7.0.0` 의 `>=` 를 부모 구분자로 오인 → `js-yaml` 스코프
   override 2건이 통째로 매칭에서 빠졌다.
2. 레인지를 먼저 떼면 scope 패키지의 선두 `@` 를 버전 구분자로 물어 `@babel/core@>=7` 이
   `=7.0.0` 이 됐다.
3. 고쳐서 "`@` 이전 구간에서만 `>` 를 찾는다" 로 갔더니 `a>@scope/b>c` 의 마지막 `>` 를
   못 봤다 — 첫 `@` 가 `@scope` 의 것이라 구간이 `a>` 에서 끊긴다(2차 리뷰가 발견).

세 번째에서야 방식을 바꿨다: 구간을 나누지 말고 **앞 글자**로 구분자와 레인지를 가른다
(구분자는 패키지명 글자 뒤, 레인지의 `>` 는 `@` 나 공백 뒤). 추출이 틀리면 가드가 아무것도
안 잡으므로 회귀 테스트의 절반을 이 축에 썼다.

**"바닥을 낮추면 잡힌다" 가 아니다.** 첫 재현에서 `liquidjs ^10.27.1` → `^10.27.0` 으로
되돌렸는데 가드가 통과했다 — caret 은 범위 안 최신을 허용하므로 lockfile 재계산 시 패치
버전이 그대로 설치되고 audit 도 조용하다. 침식이 **실제 위험이 되는 시점**은 lockfile 이
취약 버전에 고정돼 있을 때다. 정확한 재현은 caret 없이 고정(`liquidjs: 10.27.0`)해야 하고,
그 상태에서 가드가 `GHSA-g357-x5c3-c72p` 를 정확히 보고했다(exit 1).

즉 **본 가드는 `pnpm audit` 의 부분집합**이다. 검출이 아니라 **분류**가 가치다.

**가드가 자기 실패 모드를 그대로 재현하고 있었다 (리뷰가 잡음).** `auditConfig.ignoreCves` 는
CVE-ID 단위로 `pnpm audit --json` 의 `advisories` 맵을 **경로·버전 무관하게 전역 억제**한다.
`brace-expansion` 은 override 3키 + `CVE-2026-14257` 수용을 동시에 갖고 있어서, 취약 버전이
**실제로 설치된 상태에서도 가드가 OK 를 냈다**(무수정 프로브로 실증). override 를
`brace-expansion@>=2.0.0 <3.0.0: 2.1.4` 로 침식시킨 뒤에도 통과 — 막으려던 바로 그 조용한
통과다. 억제돼도 `actions[]` 에는 경로가 남으므로, 수용 시점 경로를 `EXPECTED_SUPPRESSED_PATHS`
baseline 으로 고정하고 **경로가 늘어날 때만** fail 시킨다. 처음엔 "억제 항목이 있으면 fail" 로
짰다가 정상 상태가 상시 빨간불이 됐다 — 판정 기준은 존재가 아니라 **범위 확대**여야 했다.

**리뷰 조치가 새 Critical 을 만들었다 — 그것도 "조용한 통과" 클래스로.** 1차 리뷰의
Warning("unittest 잡에 PyYAML 설치 없음")을 고치려고 스텝을 넣었는데 삽입 위치가 기존 스텝의
`name:` 과 `run:` **사이**였다. YAML 은 키 중복을 오류로 보지 않고 **뒤 값을 택한다** — 그래서
`pip install` 이 통째로 사라지고, 위 스텝은 `run`/`uses` 가 하나도 없는 스키마 위반이 됐다.
로컬에서는 절대 안 드러난다: 워크플로는 개발 머신에서 실행되지 않고, `yaml.safe_load` 는
조용히 받아주며, 739건 스위트는 초록이었다. GitHub Actions 에서만, 그것도 머지 후에 터진다.
`test_workflow_yaml_structure.py` 를 신설해 (a) 중복 키 (b) 스텝의 `run`/`uses` 정확히 1개를
모든 워크플로에 대해 강제한다. 중복 키 검출에 `safe_load` 를 못 쓴다는 점이 핵심이라
`DetectorTest` 가 사고 원문을 되먹여 "safe_load 만으로는 놓쳤다" 까지 단언한다.

부수로 `.github/workflows/**` 등재가 개별 `e2e.yml` 항목을 흡수해 그 항목이 더 이상
load-bearing 이 아니게 됐는데, 기존 가드(`test_each_historical_leak_is_load_bearing`)가
그것을 잡았다 — 중복 등재를 접고 fixture 를 넓은 필터로 옮겼다.

**무효 뮤턴트가 GREEN 을 냈다.** `dependabot.yml` 의 루트 등록 테스트를 검증하려고
`directory: "/"` 를 치환했는데, 파일의 **첫** 출현은 npm 이 아니라 `github-actions` 항목
(5-6행)이었다. 테스트는 당연히 통과했고 하마터면 "vacuous" 로 오판할 뻔했다. 치환 대상이
정말 의도한 그 자리인지는 뮤턴트를 돌리기 **전에** 확인해야 한다 — `package-ecosystem: "npm"`
까지 포함한 블록 단위로 다시 잡으니 RED 가 나왔다.

## 3차 리뷰에서 미조치로 남긴 것 (근거)

3차 리뷰(`review/code/2026/08/01/02_38_45`)는 Critical 0 · Warning 6 · INFO 11. Warning 6건과
INFO 2·4·5·9·10 은 조치했다. 남긴 것과 이유:

- **INFO 1 — `EXPECTED_SUPPRESSED_PATHS` 양방향 대조 부재**: 지금은 `actual - allowed` 만 본다.
  baseline 에만 남은 낡은 경로가 누적될 수 있으나 방향이 안전한 쪽이다(탐지를 약화시키지
  않는다). 자매 스크립트와의 비대칭은 인정하되, 항목이 1건인 현 시점에 양방향을 넣으면
  `ignoreCves` 를 정리하는 흔한 편집이 곧바로 빨간불이 된다. 항목이 늘면 그때 넣는다.
- **INFO 3 — `rebase-strategy: auto` 의 실효성 미검증**: 오프라인에서 확인 불가. 근본 조치인
  `--frozen-lockfile` required check 승격은 repo Settings 소관이라 아래 잔여 항목으로 이미 추적 중.
- **INFO 6 — `eroded` 4-tuple → NamedTuple**: 생성·소비가 같은 파일 20줄 안이라 위치 의존의
  실사고 여지가 작다. 필드가 늘어나는 편집이 실제로 생길 때 함께 바꾼다.
- **INFO 7 — tempdir 셋업 중복**: `_stage_script()` 로 스크립트 배치는 공유했다. 남은 중복은
  워크스페이스 파일을 **일부러 두지 않는** 쪽이라 헬퍼에 skip 옵션을 다는 건 그 테스트의
  의도를 흐린다.
- **INFO 8 — `advisories` 이중 순회**: 입력이 수십 건 규모라 측정 가능한 비용이 없다.
- **INFO 11 — pip 해시 고정**: 저장소 전역 정책 문제다(기존 2곳도 같은 range). 이 PR 스코프 밖.

## 축 3 철회 (2026-08-01, 10차 리뷰 후 사용자 결정)

`ignoreCves` 로 억제된 CVE 를 `actions[]` 잔여 경로로 추적하던 축을 **제거했다**. 근거는 실측이다.

10차 리뷰가 "이 메커니즘은 영구히 발동 불가능한 죽은 코드" 라는 CRITICAL 을 냈다. 리뷰어 결론을
그대로 받지 않고 2×2 를 직접 돌렸다 (`brace-expansion@2.1.4` 를 lockfile 에 **실제로 고정**한
상태 포함):

| lockfile | `ignoreCves` 있음 | `ignoreCves` 없음 |
| --- | --- | --- |
| 정상 (`^5.0.9`) | 0건 | 0건 |
| 침식 (`2.1.4` 고정, 취약) | 0건 | **0건** |

`--audit-level=low` 로도 전부 0건이다. 즉 **억제가 감추는 게 아니라 그 CVE 자체가 더 이상
보고되지 않는다** — 리뷰어의 인과("억제되면 actions 에서도 사라진다")도, 내 1라운드 관측(가드가
실제 발동)도 지금은 재현되지 않는다. 두 주장 다 입증 불가다.

확정된 것만 적으면: **발동할 재료가 없다.** 검증할 수 없는 코드가 "지킨다" 고 주장하는 것보다
없는 편이 낫다고 판단해 `widened` 경로 · `EXPECTED_SUPPRESSED_PATHS` · `_report_widened` ·
관련 테스트 3클래스를 제거했다. 가드는 핵심 가치(**침식 분류**)만 남는다. `ignoreCves` 거버넌스는
`check-pnpm-security-config.py` 의 baseline 2-place 편집이 이미 담당한다(뮤턴트로 확인 — 무단
부활 시 config-guard RED).

**부수: `ignoreCves` 2건 모두 stale 이라 제거했다.**
- `CVE-2026-53550` (js-yaml) — 우리 override 가 gray-matter 경로를 3.15.0 으로 올려 **해소**됐다.
  수용이 아니라 해결이므로 목록에 있을 이유가 없다.
- `CVE-2026-14257` (brace-expansion) — 수용했던 dev 전용 1.x 경로(`@eslint/eslintrc >
  minimatch@3.1.5 > brace-expansion@1.1.18`)는 그대로 있지만 advisory 가 더 이상 그 계열을
  매칭하지 않는다. 원래 취약 범위 `<=5.0.7` 이 major 를 안 가려 1.x·2.x 까지 끌어당기던 것이
  상류에서 정정된 것으로 보인다.

비워둔 것이 fail-closed 다 — 둘 중 하나라도 다시 보고되면 audit 잡이 빨간불을 내고 §2 의 근거
3종으로 재심사하게 된다. §2(수용 근거 규약)는 목록이 비었어도 그대로 유효하다.

**교훈**: 정적 분석·mutation 으로 9라운드를 돌았는데 "실제 도구를 돌려본다" 가 10라운드째에야
나왔다. 손으로 만든 스텁만 순회하면 도구의 실제 응답 형태가 바뀐 것은 영영 안 보인다.

## Rationale

**왜 `actionlint` 대신 직접 짰나**: 2차 리뷰에서 3명(security·dependency·requirement)이
`actionlint` 도입을 대안으로 제시했다. 채택하지 않은 이유는 두 가지다. (a) 잡으려는 것이
**두 불변식**(중복 매핑 키 · 스텝의 `run`/`uses` 정확히 1개)뿐인데, actionlint 는 셸 스크립트
린트·표현식 타입체크까지 딸려 와 기존 워크플로 전반에 신규 위반을 대량 유발할 가능성이 크다 —
이 PR 스코프가 아니다. (b) 하네스 스위트는 설치 스텝 없는 파이썬이 원칙이고, 이번에 PyYAML
예외를 하나 열었는데 Go 바이너리 의존을 **같은 PR 에서** 하나 더 여는 건 과하다. 다만
actionlint 는 이 두 불변식의 상위집합이므로, 워크플로 린트를 저장소 전역 정책으로 도입할 때
`test_workflow_yaml_structure.py` 는 그 쪽으로 흡수하는 것이 맞다 — 그때 폐기 대상이다.

**왜 §2 는 기계 검사를 넣지 않았나**: 초안은 "가능하면 `check-pnpm-security-config.py` 가 신규
`ignoreCves` 항목의 주석에 `--prod` 근거 문구가 있는지 확인" 을 검토 대상으로 뒀다. 넣지 않았다 —
주석에 특정 문자열이 있는지 보는 검사는 **문구만 복사하면 통과**한다. `#1038` 의 실패는 근거를
안 쓴 게 아니라 **쓴 근거가 틀린 것**이었고(그 근거가 "dev 전용" 이라고 명시돼 있었다), 문자열
검사는 정확히 그 실패를 못 잡는다. 대신 요구 절차를 구체적 명령으로 적어 리뷰어가 재현할 수
있게 했다 — 검증 가능성을 사람 쪽에 두는 편이 정직하다.

**왜 §3 은 required check 를 못 넣었나**: `--frozen-lockfile` 검증을 required 로 승격하는 것은
repo Settings(Branch protection) 소관이라 이 저장소 파일로 표현할 수 없다. 대신 `dependabot.yml`
주석과 아래 후속에 수동 조치로 남겼다.


`spec_impact: none` — CI·스크립트·설정 변경으로 제품 명세와 무관하다.

**왜 묶었나**: 셋 다 "의존성 보안 상태가 **조용히** 나빠지는" 같은 클래스다. §1 은 바닥이 낮아지는 것,
§2 는 수용 근거가 부실해지는 것, §3 은 이미 올린 bump 가 되돌려지는 것 — 셋 다 사후에 audit 이
빨간불로 알려주지만 그때는 이미 취약 상태다. 한 PR 에서 다루면 "왜 이 셋인가" 가 서로를 설명한다.

### 후속 — lockfile `libc:` 필드가 커밋마다 진동한다 (2026-08-09 발견, P3)

`@img/sharp-libvips-linux-*`·`@css-inline/*` 의 `libc: [glibc|musl]` **57줄**이 들어왔다
나갔다 한다. dependabot 커밋 `ba3b1017d` 이 넣고, 로컬 커밋 `9e73595a4`(`#1033`) 가 지웠고,
`#1106` 이 또 지운다.

원인은 실측으로 특정했다 — npm 레지스트리의 **축약(abbreviated) packument**
(`application/vnd.npm.install-v1+json`)에는 `libc` 가 없고 full packument 에만 있다.
저장소가 핀한 `pnpm@10.23.0` 은 축약본으로 해소하므로 이 필드를 못 쓴다. `full-metadata=true`
+ `pnpm cache delete '@img/*'` 로도 재현되지 않았다 — 설정 문제가 아니라 그 버전이 안 쓰는
것이다. dependabot 은 `packageManager` 를 안 따르는 경로로 도는 것으로 보인다.

**지금 당장의 위험은 낮다**: CI 도 `packageManager` 로 같은 10.23.0 을 쓰므로 `libc` 없는
lockfile 이 **핀한 툴체인의 정본 출력**이고, `--frozen-lockfile` 검증에 `libc` 는 참여하지
않는다. 다만 그 필드는 optional native 의존을 libc 별로 거르는 정보라, 없으면 musl 이미지에
glibc 변종이 함께 설치될 수 있다(낭비 — 오선택은 sharp 로더가 런타임에 다시 판별).

- [ ] 진동을 한쪽으로 고정 — (a) dependabot 이 `packageManager` 를 따르게 하거나,
      (b) 저장소 pnpm 핀을 `libc` 를 쓰는 버전으로 올리거나, (c) 진동을 명시 수용하고
      lockfile 검토 시 무시할 노이즈로 문서화. **(b) 를 고르려면 그 버전이 실제로 쓰는지
      먼저 실증할 것** — 여기서는 "dependabot 쪽이 더 새 버전일 것" 이라고 추정만 했고
      확인하지 않았다.

### 남은 수동 조치 (repo Settings — 파일로 불가)

**파일로 처리 불가한 잔여는 이 절뿐이다.** 사용자만 할 수 있어 `complete/` 이동을 막고 있다
(위 §후속 은 파일로 처리 가능하지만 별 PR 감이라 미착수).

- [ ] **`--frozen-lockfile` 검증을 required check 로 승격** — Branch protection 설정. 이번 사고
      (`#1030` 이 `#1029` 의 보안 bump 를 되돌려 main CI failure)의 발현 지점이 정확히 그것이라
      가장 직접적인 방어다. 현재 `frontend-checks`·`packages-checks`·`web-chat-checks` 가
      `--frozen-lockfile` 로 돌고 있으므로 그중 하나를 required 로 지정하면 된다.
      > **같은 성격의 요청이 한 건 더 있다** —
      > [`pnpm-migration-followups.md`](../complete/pnpm-migration-followups.md) 의
      > `deps-security-checks`(`config-guard`/`audit`) required-check 등록.
      > **한 번에 같이 처리하는 것이 맞다**: 셋 다 같은 Settings 화면의 같은 목록이고,
      > 하나만 등록하면 나머지 두 게이트는 계속 비차단으로 남는다.
      > (그 plan 은 2026-08-09 에 `complete/` 로 종결됐고, 해당 등록 요청은 **미수행 상태로
      > 본 항목과 [`ci-required-check-skip-jobs.md`](../complete/ci-required-check-skip-jobs.md) §사용자 액션
      > 으로 이관**됐다 — 등록 자체는 여전히 안 된 상태다.)

~~**왜 P2 인가**: 현재 audit 게이트는 `#1038` 로 exit 0 이라 **지금 당장 뚫린 상태는 아니다**.~~
**2026-08-07 — 이 전제가 반증됐다.** Actions 를 켜고 실측하니 `origin/main` 에서
`pnpm audit --audit-level=moderate` 가 **exit 1, advisories 13건**이었다.
`check-override-floors.py` 도 exit 1 이다. "장치가 없으면 다음 CVE 공시 때 반복된다" 가 아니라
**이미 반복된 뒤였고, 그 사이 기간이 실제로 아무도 모르는 채 흘렀다** — Actions 가
2026-05-16 ~ 2026-08-06 꺼져 있어서 audit 게이트가 한 번도 돌지 않았기 때문이다.

침식은 두 종류였다(전부 `origin/main` 상태):

| 패키지 | 해소 | 취약 범위 | 원인 |
| --- | --- | --- | --- |
| `fast-uri` | 3.1.4 | `>=3.0.0 <3.1.5` | 값이 낡음 |
| `hono` | 4.12.32 | `<4.12.34` | 값이 낡음 |
| `js-yaml` | 4.3.0 / 3.15.0 | `<4.3.1` / `<3.15.1` | **범위 키 상한이 한 칸 어긋남** — `<4.3.0` 이라 4.3.0 자신이 구멍 |
| `undici` | 7.28.0 | `>=7.0.0 <7.29.0` | 동상 (`<7.28.0`) |
| `undici` | 6.27.0 | `<6.28.0` | **override 가 6.x 를 아예 커버 안 함** (키가 7.x 전용) |

두 번째·세 번째 유형이 이 plan 이 예상하지 못한 형태다. 이 plan 은 "이미 올린 bump 가
되돌려지는 것"(§3)을 걱정했는데, 실제로는 **처음부터 경계를 한 칸 빗나가게 적은 키**와
**메이저 하나를 통째로 빠뜨린 스코프**였다. 값 되돌림이 아니라 **키 설계**의 문제다.

처분: PR `claude/deps-override-floors-eroded` — 5건 상향 + backend 직접 의존 1건 +
신규 override 1건(`socket.io-parser`). 결과 `pnpm audit` **13 → 0건**.
**머지 완료 `#1095` (`db7766d22`)** — 위 "exit 1, advisories 13건" 은 **당시** `origin/main`
상태이며 지금은 해소된 상태다(이 문단만 읽고 main 이 현재 뚫려 있다고 오독하지 말 것).

**남은 P2 근거**: 위 "남은 수동 조치"(required check 승격)는 여전히 유효하다. 이번 건은
Actions 재활성화로 드러났을 뿐이고, 게이트가 required 가 아니면 다음에도 빨간불을 안고
머지될 수 있다.
