# Resolution — review/code/2026/07/23/17_26_20

대상 커밋: `bef1c4efa` (e2e 면제 화이트리스트 ↔ e2e.yml paths-ignore drift 가드, §F W3)
SUMMARY 위험도: **HIGH** / CRITICAL 1 / WARNING 0 / INFO 6
forced reviewer 7명 전원 결과 확보 (`forced_missing: []`).

## CRITICAL 1 — 가드가 자기 보호 대상을 지키지 못했다 → **반영**

`harness-checks.yml` 의 `paths:` 에 `.github/workflows/e2e.yml` 이 없어서, **e2e.yml 만
수정하는 PR 에서는 방금 만든 가드가 아예 실행되지 않았다.** 하필 그게 가드가 막으려는
위험 방향(= `paths-ignore` 를 넓혀 CI 가 e2e 를 건너뛰게 만드는 변경)의 전형적인 diff 다.

documentation·requirement 두 reviewer 가 독립적으로 지적했고, 실측 확인했다.

**이건 이 저장소가 이미 4번 겪고 그때마다 주석으로 남긴 실패 클래스의 5번째 재발이다** —
`.githooks/**` · `.claude/_shared/**` · `.claude/workflows/**` · `.github/dependabot.yml`.
같은 파일 안에 "paths 에 없으면 정작 자신을 지키는 테스트가 트리거되지 않았다" 는 문장이
네 번 적혀 있는데 그걸 읽고도 반복했다.

조치: `paths:` 에 `.github/workflows/e2e.yml` 등재 + 기존 항목들과 같은 형식의 사유 주석.
**추가로 plan 에 §I 항목 신설** — 5회 재발한 클래스를 개별 대응 말고 체계 가드로 닫는 방향
(`.claude/tests/*.py` 의 모듈 레벨 `REPO_ROOT / ...` 상수 ↔ harness-checks `paths:` 대조).
다만 일부 테스트는 의도적으로 `codebase/**`·`spec/**` 를 참조하므로 **등재 대상 경계 정의가
선행**이라고 기록했다 — 경계 없이 만들면 오탐으로 무력화된다.

## INFO — 4건 반영, 2건 사유 기록

### INFO 2 (doubled-quote escape 미지원인데 "every quote style" 표방) → **반영**

**이번 세션에서 세 번째로 나온 "커버리지보다 넓게 주장" 이다.** 독스트링만 좁히는 대신
**침묵 오파싱을 실패로 바꿨다**: `'it''s/**'` 는 종전 `it` 으로 잘려 *틀린 패턴을 확신을
갖고 읽는* 상태가 됐는데, 그게 정확히 이 파일이 막으려는 실패 모드다. doubled-quote ·
backslash · trailing junk 세 형태를 각각 `ValueError` 로 거절하고, 독스트링도 실제 지원
3종으로 정정했다.

### INFO 1 (`!` negation 미커버) → **반영**

`ParserBoundaryTest` 에 pin 추가. 현재 미사용이며(e2e.yml 주석이 대안으로 검토했다가
`workflow_dispatch` 를 택함), 등장하면 `!keep/**` 라는 **별개 토큰**으로 읽혀
whitelist-subset 검사에서 매칭 실패 → 요란하게 깨진다. "un-exclusion 을 exemption 으로
조용히 동일시" 하지 않는다는 것이 pin 의 요지.

### INFO 4 (매직 넘버 5) · INFO 5 (`set(self.blocks[0])` 3중 계산) → **반영**

`_MIN_EXPECTED_WHITELIST_PATTERNS` 상수 + 근거 주석 / `setUpClass` 에서 `cls.mirrored`
1회 계산.

### INFO 3 (plan 에 뮤턴트 실측 미기록) → **반영**

인접 W5 항목처럼 실측 결과를 plan 에 한 줄 기록.

### INFO 6 (§E 결정 기록이 같은 diff 에 혼입) → **미조치 (사유 기록)**

리뷰어도 "코드 영향 없음, 강제 아님" 으로 분류했다. §E 결정은 이번 턴에 사용자가 직접
내려준 것이라 그 자리에서 plan 에 남기는 게 유실 위험이 없다. 분리 커밋의 이득보다
"결정을 받은 턴에 기록" 이 크다고 판단.

### INFO (기타) — `runpy`/보안/부작용 확인 성격

리뷰어가 "문제 없음 확인" 으로 분류. 조치 대상 없음.

## 검증

- harness suite **486 green** (반영 전 483 → 신규 테스트 3건).
- mutation: 1차 7/7 killed(M1 = 원 결함 I3 재현). INFO 반영 후 재실행에서 **M8·M10 이
  SURVIVED** 로 나와 추가 교정:
  - **M8** — doubled-quote 검사를 꺼도 trailing-junk 검사가 같은 `ValueError` 를 내
    타입만 보는 단언으로는 두 분기 어느 쪽을 지워도 통과했다 → `assertRaisesRegex` 로
    **메시지별** 단언으로 교체.
  - **M10** — 하한을 `0` 으로 낮춰도 실파일이 13개라 통과했다. 하한 0 은 파서가 아무리
    망가져도 통과시키는, 이 상수가 막으려던 바로 그 상태 → `> 0` 을 직접 pin.
  - 재실행 **M8·M9·M10·M11 전부 killed**.
- M9 는 1차에서 escaping 문제로 치환 실패("INVALID") → 유효 형태로 재적용해 killed 확인.

## 잔여

없음 (CRITICAL 1 + INFO 4건 반영, INFO 2건은 위 사유로 미조치). 5회 재발 클래스의 체계
가드는 plan §I 로 신규 등재.
