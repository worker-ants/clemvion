# RESOLUTION — `21_45_58`

전체 위험도 **LOW** · Critical **0** · WARNING **1**. **조치 완료** (등재 유예 없음).

## 조치 항목

| # | 카테고리 | 지적 | 조치 | commit |
|---|---|---|---|---|
| 1 | testing | `readOption` 은 제네릭이고 두 인스턴스의 `pick` 이 **다르다**(boolean 은 `TrueKeyword`/`FalseKeyword`, string 은 `isStringLiteralLike`). 직전 라운드에 세운 "리터럴을 만날 때까지 훑는다" 캐너리는 **boolean 인스턴스만** 고정하고 있어 `readStringOption`→`readColumnType` 경로의 회귀를 담보하지 못한다 | `@Column({ type: dynamicType, type: 'numeric' })` 픽스처로 string 인스턴스 캐너리 추가. 기존 캐너리 이름도 `boolean 리더 —` 로 바꿔 어느 인스턴스를 무는지 이름에서 드러나게 했다 | `5076b7e81` |

### 왜 "이미 공유 분기를 물고 있다" 로 닫지 않았나

boolean 캐너리 하나만으로도 `readOption` 의 **공유 코드**를 겨눈 뮤턴트는 죽는다 — 그
사실만 보면 이 지적을 "중복" 으로 닫을 수 있었다. 닫지 않은 이유는 두 가지다.

1. 리뷰가 지적한 것은 공유 코드가 아니라 **인스턴스별 계약**이다. 누군가 나중에
   `readStringOption` 을 제네릭에서 떼어내 인라인하면, boolean 캐너리는 그 회귀를 보지
   못한 채 초록으로 남는다.
2. **이 PR 이 고친 결함이 두 번 다 "가드가 한 칸 좁았다"** 였다 (`20_16_17` 정규식 위음성,
   `20_39_25` 포지셔널 `@Column`). 그것을 고치면서 캐너리 쪽에 같은 형태를 남기는 것은
   앞뒤가 맞지 않는다.

### 뮤테이션 실측 — 예측 / 실측

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| (원본, 캐너리 2개) | GREEN 34 | **GREEN 34** |
| M5 `if (picked !== undefined) return picked;` → `return picked;` | RED **2** — 인스턴스당 1개 | **RED 2 — boolean·string 캐너리 각각** |

직전 라운드에는 같은 뮤턴트가 **RED 1** 이었다. 개수만 세지 않고 실패한 **테스트 이름**을
확인해 두 인스턴스가 각각 죽었음을 확정했다. 원복은 `cp` + 절대경로, 앵커 존재 `assert`
선검증, `git diff --quiet` 확인.

## 나머지 INFO 처분

| # | 처분 |
|---|---|
| 1 (`spec/1-data-model.md:873` Float 라벨) | `spec/` 쓰기라 developer 권한 밖. plan 에 planner 항목으로 기등재 — 리뷰도 "경계를 올바르게 지킨 상태" 로 확인 |
| 2 (changeset 크기) · 3 (하네스 경합 윈도우) · 4 (공개 타입 변경 고지) · 5 (e2e 델타 성격) · 6 (가드 읽기 전용) · 12 (CHANGELOG 영향 고지) · 13 (가드로 못 닫는 잔여 갭은 plan 에 반영됨) | 조치 불요 — 확인 보고 |
| 7 (`collectNumericFields`/`collectDtoFieldTypes` 순회 골격 중복) | **미조치.** 리뷰 스스로 "같은 형태의 스캐너가 하나 더 추가되면" 을 조건으로 달았다. 지금 둘뿐인 상태에서 `walkClasses` 를 뽑으면 추상화가 사례보다 앞선다 |
| 8 (`@ApiProperty({ type: String })` 스타일) | **미조치.** 이 필드는 방금 `number → string` 으로 정정한 자리라 리플렉션 추론에 기대지 않고 명시한 것이 의도다. 다만 그 의도가 코드에 안 적혀 있다는 지적은 맞다 — 다음에 같은 자리를 건드릴 때 한 줄 남긴다 |
| 9 (`[전제]` 가 실제 컬럼명에 결속) | **의도된 설계.** 결속을 끊으면 그 테스트의 존재 이유(공허한 단언 방지)가 사라진다. 리뷰의 권고대로 "실패 시 스키마 변경을 먼저 의심" 을 테스트 docstring 이 이미 함의한다 |
| 10 (`DELETE` 미포함) | 조치 불요 — 204 No Content 라 `threshold` wire 타입 축과 무관 |
| 11 (초기 라운드 산출물의 낡은 서술) | 조치 불요 — 리뷰 산출물은 **시점 스냅샷**이라는 이 저장소 관례. 현재 상태는 CHANGELOG·plan 최신본이 SoT |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`_test_logs/lint-20260904-215633.log`) |
| unit | **PASS** — backend jest **9339 passed / 9340 total** (직전 9,338 → **+1**, 신규 캐너리 1건) (`_test_logs/unit-20260904-215738.log`) |
| build | **PASS** (`_test_logs/build-20260904-215920.log`) |
| e2e | **통과** — **51 suites / 293 passed** (변동 없음. 이번 편집은 unit 캐너리 1건이라 e2e 수가 늘 이유가 없다) (`_test_logs/e2e-20260904-220231.log`) |

## 보류·후속 항목

없음.
