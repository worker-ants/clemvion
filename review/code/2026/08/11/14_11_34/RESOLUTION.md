# RESOLUTION — `14_11_34`

Critical 0 / Warning 2 **전부 처분**. 둘 다 `plan/**` 이라 코드 게이트를 재무장시키지 않는다.

## W1 (documentation) — 정정의 자매를 놓쳤다

직전 라운드에서 사전 필터 수치를 `11.8%` → `11.9%` 로 고쳤는데, **plan 에 있던 같은 숫자를
안 고쳤다**. 코드만 맞고 문서가 stale — 이 PR 이 내내 경계한 형태를 정정 작업에서 또 냈다.
plan 의 그 한 줄을 고쳤다.

## W2 (requirement) — "원리상 불가능" 은 과장이었다

리뷰어 말이 맞다. 옛 구현을 fixture 로 박제하거나 `git show <pre>:<path>` 로 추출해 CI 에서
대조하는 방법이 **있고**, 실제로 리뷰어 자신이 그 방법으로 7/7 byte-identical 을 증명했다.

**안 한 진짜 이유는 트레이드오프다**:

- 옛 구현을 테스트용으로 영구 보존하면 이 PR 이 없애려던 중복이 **일곱 번째로 되살아난다**.
- `git show` 추출은 rebase/squash 로 이력이 바뀌면 깨지는 **fragile SoT** 다.

결론(안 하기로 한 것)은 그대로 두되 **근거를 정확한 것으로 교체**했다. "불가능하다" 와
"가능하지만 비용이 이득보다 크다" 는 다른 문장이고, 앞의 것을 쓰면 다음 사람이 대안을
검토할 기회를 잃는다.

## consistency `14_11_28` 처분 — Critical 0, WARNING 2건

| 출처 | 내용 | 처분 |
|---|---|---|
| convention_compliance · cross_spec (**2명 수렴**) | `tree-walk.ts` 가 이제 `impl-anchor-parse.ts`(=`user-guide-evidence.md` 소관)의 의존성인데 **그쪽 `code:` 만 갱신 안 됨** | **고침** — 양쪽에 등재 + 공유 인프라임을 주석으로 명시 |
| plan_coherence | 조건부 후속("`plan-scan.ts` 449줄 — 다음 확장 시 재검토")이 **timestamped review 산출물에만** 있다. plan 이 닫히면 조건이 도래해도 재발견 불가 | **고침** — 살아있는 자매 plan 으로 이관 |

두 번째가 특히 아프다 — **`review/**` 는 SoT 가 아니다**. 완료 plan 에 적는 것도 같은 이유로
죽은 기록이라, 같은 "DRY vs 안전성" 축의 **살아있는** plan(`harness-env-value-subpattern-dedup.md`)
으로 옮겼다. 완료 plan 자체를 다시 열지는 않았다 — 체크리스트는 13/13 으로 정당하게 닫혔고,
누락된 것은 재작업이 아니라 새 기록이다.

## 검증

- docs 가드 **2892 passed**(불변), 타입 오류 0, lint 신규 0.
- `user-guide-evidence.md` 에 YAML 주석을 넣었는데 `spec-code-paths` 가드가 그대로 통과함을
  확인(주석은 `code:` 배열 원소가 아니다).

## 수렴 — 종결

7명 중 **4명 NONE**, scope 는 독립적으로 **"수렴했다 · 이번이 마지막이어도 무방"**.
남은 두 WARNING 은 `plan/**` 문서 문구뿐이었고 이 문서로 닫혔다.

발견의 성격이 **구조(라운드1) → 문서 정확성(라운드2)** 으로 얕아졌다. 이번 fix 는
`codebase/**` 를 건드리지 않으므로 리뷰 게이트가 재무장되지 않는다 — spec 을 건드린
쪽만 consistency 를 한 번 더 돈다.
