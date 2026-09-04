# RESOLUTION — `19_43_18`

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| W4 (문서/계획) | 내 실측 서술("불일치 **59**")과 분류 표 합(46+6+4+**1**=57)이 어긋난다 — 최대 2건의 미발견 계약 거짓을 가릴 수 있다 | **재측정했다.** 원 59 는 맞았고 **표의 마지막 행이 틀렸다** — 다른 행은 버킷 크기인데 그 행만 판정 결과(1)를 적었다. 실제 버킷은 3이고 나머지 2는 무해함을 확인해 표에 명시 |
| W1 (테스트) | 이 결함을 되잡을 회귀 테스트가 없다 — 기존 가드는 presence/null 두 축뿐이라 **원시 타입 불일치를 구조적으로 못 본다** | 가드에 **세 번째 축**을 세웠다: `numeric`/`decimal` 컬럼을 엔티티 그대로 내보내는 응답 DTO 가 `number` 라 하면 잡는다. 대조군 3방향 |
| W2 (문서) | 서술이 `list()` 만 말하는데 `create`/`update` 도 같은 상태 | 실측 확인 후 "세 응답 모두" 로 정정 |
| W3 (문서) | 형제 항목들이 모두 넣는 **코드젠 영향** 문단이 빠졌다 | `number` → `string` 영향 문단 추가 |

## W4 — 표의 한 행만 다른 것을 세고 있었다

재측정: **58건** (46 `Date`→`string` · 6 enum→`string` · 4 관계 축소 · 2 그 밖).
`AlertRuleDto.threshold` 를 이미 고쳤으므로 하나 줄었다 — **원래 59 는 정확했다.**

틀린 것은 표였다. 다른 행은 **버킷 크기**인데 마지막 행만 **판정 결과**(진짜 거짓 1건)를
적어, 합이 57로 보였다. 버킷 크기(3)를 적고 그 3건의 판정을 별도 표로 갈랐다.

**리뷰어의 우려("미발견 계약 거짓이 최대 2건 더 있을 수 있다")는 정당했고, 확인 결과
그 2건은 무해했다** — JSONB blob 형태 문서화와 리터럴 유니온 vs enum.

## W1 — 기존 두 축이 못 보는 자리였다

`swagger-dto-contract` 가드는 presence(`required` vs `?`)와 null(`nullable` vs `| null`) 만
본다. **원시 타입 차이는 어느 축에도 안 걸린다.** 그래서 `number` vs `string` 이 통과했다.

세 번째 술어 `findNumericAsNumber` 를 추가했다. 전수 대조가 아니라 **정밀도 손실로 이어지는
한 축**만 좁게 겨눈다 — 전수는 오탐 46건(`Date`→`string`)을 낳기 때문이다.

**저장소의 `numeric` 컬럼은 둘뿐이다**(`alert_rule.threshold`, `llm_usage_log.cost_usd`).
후자는 statistics 가 `SUM(u.cost_usd)::float` + `Number(...)` 로 처리해 DTO 의 `number` 가
정확하다 — 즉 `threshold` 가 유일한 인스턴스였다.

대조군 3방향: 잡는다 · DTO 가 `string` 이면 안 잡는다 · `numeric` 이 아닌 컬럼은 안 잡는다.

> **첫 대조군은 공허했다.** 평평한 tmpdir 픽스처를 썼는데 이 술어는 `/entities/` 와
> `/dto/responses/` **경로로 역할을 가르므로** 분류가 성립하지 않았고, 단언이
> `Array.isArray(...)` 로 무너져 있었다. 중첩 경로 픽스처로 다시 썼다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest 445스위트 **9,328건** (직전 9,324 + 가드 4)
- build: **PASS**
- e2e: **PASS** — 292건

## 보류·후속 항목

- INFO#6 — `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 라벨링. **planner 트랙**
  이고 이 PR 범위 밖이다. 이번 정정으로 그 라벨이 틀렸음이 분명해졌으므로 등재한다.
- INFO#5 — 2단계 대표 엔드포인트 후보에 `GET /api/alerts/rules` 추가. plan 에 반영.
