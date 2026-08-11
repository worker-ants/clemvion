# ai-review SUMMARY — `14_11_34` (forced 7 전원 실행) — 확인 라운드

새 델타 = 커밋 `bafa7c007`(직전 라운드 6건 처분) + `5c5bd8c40`(리뷰 산출물).

## 집계 — 7/7 착지

| reviewer | Critical | Warning | 위험도 |
|---|---|---|---|
| security | 0 | 0 | **NONE** |
| scope | 0 | 0 | **NONE** — "수렴했다 · 이번이 마지막이어도 무방" |
| side_effect | 0 | 0 | **NONE** |
| testing | 0 | 0 | **NONE** |
| maintainability | 0 | 0 | LOW (INFO 1) |
| documentation | 0 | 1 | LOW |
| requirement | 0 | 1 | LOW |
| **합계** | **0** | **2** | LOW |

## 직전 6건이 전부 닫혔다 — 제기자들이 재현 확인

- **maintainability**(WARNING 3건 제기자): 셋 다 해소 확인. **주석 축약이 정보를 잃지
  않았다** — "이 호출부에서 필요한 행동 사실" 은 남고 "왜 다른가" 만 SoT 로 위임됐다.
- **testing**: `path.isAbsolute` 제거가 5개 호출부 무변경임을 전수 확인. 그리고
  **2893 → 2892 감소를 산술로 설명** — living plan 검사 `-4`(describe 당 4 it) + Gate C
  enforced `+3`(describe 당 3 it) = `-1`. **커버리지 축소가 아니라 라이프사이클 전환의
  파생 결과**임을 실측 재현.
- **side_effect**: plan 이동이 가드 밖으로 아무것도 빠뜨리지 않음 — `findBrokenPlanLinks`
  는 애초에 `plan/complete/**` 제외 설계, `plan-frontmatter.test.ts` 는 하한만 검사.
- **security**: `makeSpecExists` 의 `spec/` 경계를 `node -e` 로 직접 재현 —
  `spec/../CLAUDE.md`·`CLAUDE.md`·`spec`(디렉터리)·`""` 전부 정상 거부.
- **scope**: 8개 파일 diff 를 개별로 열어 처분과 1:1 대응 확인. `spec/` 편집의 role 경계도
  검토해 "Gate C 의 존재 이유 자체가 이 패턴을 예정한다" 로 판정.

## Warning (2건) — **전부 고침**

| # | reviewer | 내용 |
|---|---|---|
| W1 | documentation | 코드는 `11.9%` 로 고쳤는데 **plan 의 같은 숫자가 `11.8%` 로 남았다** — 정정의 자매를 놓쳤다 |
| W2 | requirement | plan 의 **"원리상 불가능"** 이 과장이다 — 방법은 있다(옛 구현 fixture 박제 / `git show` 추출). 실제로 리뷰어가 그 방법으로 증명했다 |

W2 는 특히 정확한 지적이다. 안 한 진짜 이유는 "불가능" 이 아니라 **트레이드오프**다 —
옛 구현을 테스트용으로 영구 보존하면 이 PR 이 없애려던 중복이 **일곱 번째로 되살아나고**,
`git show` 추출은 rebase/squash 로 깨지는 fragile SoT 가 된다. 그 근거를 plan 에 적었다.

## INFO 처분

| 출처 | 내용 | 처분 |
|---|---|---|
| maintainability | 제거 자리 주석의 "리뷰어 셋이 독립 지적" 은 계약이 아니라 이력 | 유지 — 재도입 방지 근거로 읽힌다 |
| requirement | `tree-walk.test.ts` 등재가 목록 내 **다수** 패턴과 다르다(자매 `.test.ts` 미등재가 다수) | 유지 — 회색지대. 소수 선례(`spec-frontmatter-parse` 쌍)도 실재 |
| security | `walkTree` 의 `bases` 에 `..` 가드 없음 | 무조치 — 5곳 전부 리터럴 상수. 비-리터럴 호출부가 생기면 그때 |

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 2
