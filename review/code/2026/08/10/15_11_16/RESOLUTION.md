# RESOLUTION — `15_11_16` 라운드

forced 7명 전원 리포트 확보. **Critical 1 · WARNING 4 전부 조치.**

## 1. 게이트가 install 호출부 한 곳에만 있었다 (requirement CRITICAL, HIGH)

**지적**: `--strict-peer-dependencies` 가 `.github/actions/pnpm-workspace` 에만 들어갔고,
`.claude/test-stages.sh:20` · `codebase/backend/Dockerfile:41` ·
`codebase/frontend/Dockerfile:38` · `Dockerfile.playwright-e2e:52` 는 미적용이다. 그중 3곳은
지금도 CI(e2e 이미지 빌드, TEST WORKFLOW)에서 돈다. "한 줄이 전부를 덮는다" 는 과장이다.

**판정: 유효.** grep 으로 직접 확인했고 4곳 전부 실재한다. 그리고 plan 자신이 조치 후보를
**"CI/로컬 게이트에 도입"** 이라 적어 뒀다 — 내가 CI 의 절반만 보고 범위를 좁혔다.

**조치**: 다섯 곳 전부에 적용. plan 체크리스트의 과장 문구도 실제 소재지 열거로 교체하고,
**처음에 한 곳만 고쳤다는 사실을 남겼다** — 다음 사람이 "한 줄" 로 오해하지 않도록.

## 2. 게이트 소재지 오지목 (requirement · documentation · testing 3명 수렴)

`pnpm-workspace.yaml` 의 새 주석이 시행 위치를 `.github/workflows/deps-security-checks.yml`
로 적었는데, 그 워크플로는 `pnpm install` 을 실행하지 않는다. 세 reviewer 가 독립적으로
잡았다. 실제 소재지로 정정.

## 3. 소비자 수를 세지 않고 썼다 (testing)

"8개 워크플로" → 실측 **9개 잡 / 5개 워크플로 파일**(`ConsumerBindingTest.consumers()`
직접 호출). 세 곳 전부 정정. **이 세션에서 반복된 형태다** — 세지 않은 수를 단정.

## 4. 이번 변경으로 거짓이 된 기존 주석 (documentation)

`eslint-unicorn-peer.spec.ts:199` 가 "`--strict-peer-dependencies` 미도입" 을 전제로 그
테스트의 존재 이유를 설명한다. 정정하면서 **그 테스트를 남기는 이유**를 함께 적었다 —
게이트는 *설치 시점*의 미충족을, 그 테스트는 *매니페스트 floor 대 설치본*의 어긋남을 본다.
축이 달라 대체 관계가 아니다. (`tests/README.md` 카탈로그 행도 동반 갱신.)

## 5. 테스트 이름 drift — 그리고 그걸 고치다 vacuous 를 만들었다 (maintainability INFO)

이름을 `..._both_gate_flags_...` 로 바꿨다. 같이 지적된 매직넘버 `ARGC=5` 를
`len(argv(proc))` 로 유도했다가 **즉시 되돌렸다** — `argv()` 도 같은 stdout 을 파싱하므로
자기 자신과 비교하는 꼴이고, 인자가 갈려도 통과한다. **그 단언의 존재 이유가 정확히
"필터가 한 인자로 도착했는가"** 인데 그걸 없앨 뻔했다. 리터럴로 되돌리고 근거를 주석에 남겼다.

> INFO 를 처리하다 더 나쁜 결함을 만드는 형태다. 지적된 것이 "매직넘버" 라고 해서 그 숫자가
> 무엇을 지키는지 안 보고 유도식으로 바꾸면, 리팩터가 아니라 가드 제거가 된다.

## 채택하지 않은 것

| reviewer | 내용 | 판단 |
|---|---|---|
| scope | "§1 이 §2 의 안전망" 은 **선병합 순서**를 정당화할 뿐 PR 분리까지 강제하지 않는다 | **근거 정정으로 수용.** 분리를 실제로 뒷받침하는 건 §2 의 배치 크기(10 워크스페이스 + config 검증)다. 결론은 같고 이유가 다르다 — PR 본문에 그렇게 적었다 |
| testing | `check-pnpm-security-config.py` 가 `peerDependencyRules` 를 baseline 대조 안 함 | 현재 그 키가 **부재**라 대조할 대상이 없다. 예외를 처음 넣는 시점에 함께 다룰 것 — plan 에 등재 |

## 검증

- **side_effect 가 10개 filter 스코프 전부 + 전체 workspace 를 격리 사본에서 실행** — 11회
  exit 0, unmet peer 0건. 게이트가 어느 잡도 새로 깨지 않는다.
- **testing 이 뮤테이션을 직접 재현** — 추출 문자열에서 플래그를 빼면 `assertEqual` 실패.
  즉 갱신이 단순 기대값 맞추기가 아니다.
- 내 뮤테이션: action 에서 플래그 제거 → **RED 2건**.
- harness **1032 tests / OK**, 문서 가드 2872 passed.
