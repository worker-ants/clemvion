# RESOLUTION — 8R (harness-block-backstop)

리뷰어 14/14 성공. **CRITICAL 3 / WARNING 11.** RISK=CRITICAL.

CRITICAL 3건 중 2건은 같은 결함이고(performance·requirement 가 독립 재현), 나머지 1건은
security 가 다른 함수에서 찾은 별개다. **셋 다 main 이 직접 재현해 확인했다.**

## CRITICAL 1 — 7R 이 못 닫은 두 번째 이차 (performance + requirement)

7R 은 `_BLOCK_AT_LINE_START` 의 **선두** 문자 클래스만 고쳤다. `BLOCK:` 리터럴 **바로 뒤**의
`\s*\**\s*` 는 그대로 남았고, 이건 별개의 이차다 — 무제한 quantifier 두 개가 보통 비는
quantifier 하나를 사이에 두고 붙어 있어, alternation 이 끝내 실패하면 엔진이 같은 구간을
둘 사이에서 계속 다시 나눈다.

**직접 재현** (7R 수정 적용 상태, `"BLOCK:" + " "*n`, 개행 없음 · 한 줄):

| n | 400 | 800 | 1600 | 3200 | 6400 | 12800 |
|---|---|---|---|---|---|---|
| `\s*\**\s*` | 0.002s | 0.009s | 0.037s | 0.147s | 0.589s | **2.354s** |
| `[ \t*]*` | 0.000s | 0.000s | 0.000s | 0.000s | 0.000s | 0.000s |

**왜 7R 이 놓쳤나 — 두 겹의 착오:**

1. **원인을 하나로 특정했다.** 7R 은 "`\s` 가 개행을 넘는다 + `MULTILINE`" 으로 메커니즘을
   설명했다. 그건 첫 결함엔 맞지만, 이 두 번째는 **개행이 하나도 없는 한 줄**에서도 난다.
   메커니즘 서사가 맞아떨어지자 같은 패턴의 나머지를 안 봤다.
2. **회귀 테스트가 한 배치만 고정했다.** 7R 테스트 입력은 `("> "*3+"\n")*n` 으로 `BLOCK:` 이
   **아예 없다** — 스캔이 리터럴 앞에서 실패하므로 패턴의 이 부분에 도달조차 못 한다.
   "이차를 고쳤다" 는 라운드와 "그걸 막으려고 쓴 회귀 테스트" 를 둘 다 통과했다.

**처분: 수정.** 두 정규식의 간극을 단일 quantifier `[ \t*]*` 로. 거동 검증: 커밋된 SUMMARY
**1,507개 전수, 판정 변화 0건**. (`[ \t*]*` 는 개행도 배제해 오히려 엄격해진다 — 판정과
`BLOCK:` 은 한 줄에 있어야 한다.)

**테스트도 배치별로 나눴다** — `BLOCK:` 없음 / `BLOCK:` 있고 뒤에 긴 런 / 판정 뒤 긴 런.

> **크기 상수도 실측으로 다시 잡았다.** 처음엔 7R 의 `_LINES=20_000` 을 그대로 썼는데, 옛
> 패턴이 그 크기에서 2.9초라 5초 타임아웃을 통과했다 — **뮤턴트가 GREEN**. 45,000자에서
> 14.5s vs 0.001s 임을 재고 `_RUN` 상수를 따로 뒀다. 한 결함에 맞춘 크기를 다른 결함에
> 재사용하면 그대로 vacuous 해진다.

## CRITICAL 2 — `_glob_to_regex` 지수 백트래킹 (security)

spec frontmatter 의 `code:` glob 이 한 세그먼트에 `*` 를 여러 개 담으면 지수다.
**직접 재현** (`"a*"*k + "!"` vs `"a"*2k`):

| k | 8 | 10 | 12 | 14 | 16 |
|---|---|---|---|---|---|
| 시간 | 0.0002s | 0.0026s | 0.0406s | 0.6500s | **10.26s** |

입력이 spec 파일에서 오므로 `spec/**` 을 쓸 수 있으면 누구나 심을 수 있고, 그 파일을 받은
모든 사람의 이후 모든 push·턴종료가 멈춘다.

**처분: 와일드카드 상한 6.** 실측 근거 — 실제 glob **633개 중 528개가 `*` 0개**, 한 세그먼트
최대 **1개**. 상한 초과는 **모든 것에 매치**시킨다(초과 시 매치 실패로 두면 Gate 2 가 꺼진다 —
길이 제한이 탐지를 무력화하는 그 실패다). 실제 633개 중 상한에 걸리는 것 0개.

## WARNING — 처분: `--files` 침묵 폐기 (3명 지적)

`collect_change_infos` 의 `if/elif` 때문에 scope 플래그가 있으면 `--files` 가 죽은 분기다.
**defer 하지 않고 지금 닫았다** — 이게 6R 한 라운드를 통째로 무의미하게 만든 원인이고,
리뷰어가 changeset 을 눈치채서 잡았지 도구는 한마디도 안 했다.

선행 관계(scope 플래그 우선)는 그대로 두고 — 다른 호출자가 의존한다 — **폐기를 못 보고
지나칠 수 없게** stderr 경고를 냈다. 6R 을 망친 그 명령으로 발화 확인:

```
!! --files IGNORED (2 path(s)) — --branch takes precedence and defines the changeset by itself.
```

부수 관측: 그 실행이 `Batch 1/3 (50 files)` 를 찍었다 — **6R 이 마지막 배치(리뷰 산출물)만
받은 이유가 배치 분할이었음이 추측이 아니라 관측으로 확정됐다.**

`consistency_orchestrator` 는 같은 문제를 `add_mutually_exclusive_group` 으로 구조적으로
막고 있다 — 더 나은 형태이고 후속으로 남긴다.

## WARNING — 기등재/후속

lost update(§10) · merge_coordinator reconcile 미위임(§9) · `review_guard.py` 1,017줄 3관심사 ·
orchestrator CLI 보일러플레이트 · `build_files_section` 3전략(§3) · merge_coordinator 의
`-` 시작 ref argument-injection(리스트 인자라 셸 인젝션 아님, 위생) — 전부 plan 등재 또는
별도 범위.

## 검증

- harness 스위트 **762 tests OK** (8R 착수 시 758 → 신규 4).
- mutation 4종 전부 RED:
  - `[M1 START 내부 \s*\**\s* 회귀]` FAILED — *1차 시도 GREEN, 크기 재산정 후 RED*
  - `[M2 END 옛 패턴 회귀]` FAILED — 동상
  - `[M3 glob 상한 제거]` FAILED (failures=2)
  - `[M 경고 블록 제거]` FAILED (failures=3)
