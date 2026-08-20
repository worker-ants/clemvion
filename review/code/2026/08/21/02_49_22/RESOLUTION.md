# RESOLUTION — 02_49_22

대상 SUMMARY: `review/code/2026/08/21/02_49_22/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **1**, INFO 15)

**처분: WARNING 1건 수정.** INFO 15건은 전부 이월·확인 목적이라 미조치(아래 근거).

---

## WARNING 1 — 가드가 **우회 가능**했다 (security) — **수정**

`importsBaseFn` 이 named import 형태만 봤다. 무수정 프로브로 실측:

```
NAMED   = true
NS      = false   ← import * as base + base.resolveTriggerParameters(…)
REQUIRE = false   ← const { resolveTriggerParameters } = require(…)
```

새 Manual 경로가 저 두 형태로 base 를 쓰면 **마커 재제출이 다시 열린다**. 가드가 있는데
우회 가능하면 없느니만 못하다 — 있다고 믿게 만든다.

세 형태를 전부 보게 넓혔고, **형태별로 나눈 캐너리**로 고정했다(`it.each` — 어느 형태가
깨졌는지 실패 메시지에 드러난다). namespace 확장이 wrapper 멤버 접근까지 잡으면 접두 겹침
오탐이 되므로 그 반대 캐너리도 함께 뒀다.

전체 스위트(429 suites)가 통과해 **기존 코드에 오탐이 없음**도 확인했다.

> **이 가드는 세 라운드 연속으로 자기 결함을 드러냈다** — 언급/import 혼동(`02_04_38` W1),
> 탐지 능력 무보증(`02_04_38` W2), 그리고 이번 우회 형태. 정적 스캔 가드는 **자기가 못 보는
> 형태가 곧 구멍**이라, 형태를 하나씩 캐너리로 못박는 것 외에 방법이 없었다.

## 미조치 INFO (15건)

전부 **이월·확인 목적**이며 리뷰어 스스로 "조치 불요"·"필수 아님"·"다음 편집 기회" 로
판정했다. 대표적인 것:

| # | 항목 | 사유 |
|---|---|---|
| 1 | 한/영 주석 혼재 | 이 diff 가 만든 문제 아님(4라운드 이월) |
| 4 | e2e 왕복 스모크 부재 | unit 이 응답 바디까지 검증. 이전 라운드 동일 판정 |
| 5 | Swagger description 예약어 미명시 | 외부 소비자 부재 확인됨 |
| 6 | 트래커 plan 이동 여부 | 다른 미체크 항목 다수 존재(상시 트래커라 완료 대상 아님) |
| 7 | 7라운드째 fix→review 루프 | 리뷰어도 "CLAUDE.md 표준 fix loop 범위 안" 으로 명시 |
| 15 | 최상위 `error.code` drift | 선존 + spec 이 rename-stability 로 정당화 |

**INFO-6 은 실측했다** — `spec-sync-external-interaction-api-gaps.md` 는 상시 트래커이고
미체크 항목이 다수 남아 있어 `complete/` 이동 대상이 아니다(이 PR 이 닫은 W5·W6 두 항목만
`[x]`).

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (47s) |
| unit | PASS — backend jest **429 suites / 8,870**(직전 8,866 대비 +4, 우회 형태 캐너리) |
| build | PASS (140s) + 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (239s) — backend supertest **276** · playwright **51** |

> lint 가 한 번 실패했는데 원인이 **삭제했다고 생각한 프로브 파일**이었다 — `rm` 이 잘못된
> CWD 에서 돌아 실제로는 남아 있었다. 게이트가 잡았고 제거 후 통과.
