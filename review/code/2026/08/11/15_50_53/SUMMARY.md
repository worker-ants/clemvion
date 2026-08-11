# ai-review SUMMARY — `15_50_53` (forced 7) + consistency `15_50_56`

델타 = 커밋 `99d3e9000`.

## 집계 — 12/12 착지, **CRITICAL 0**

| reviewer | Critical | Warning | 위험도 |
|---|---|---|---|
| security · testing · maintainability | 0 | 0 | **NONE** |
| scope · side_effect · documentation | 0 | 1~2 | LOW |
| requirement | 0 | 3 | LOW |
| **consistency** naming · convention · cross_spec · plan_coherence | 0 | 1~2 | LOW |
| **consistency** rationale_continuity | 0 | 1 | LOW |

## 직전 CRITICAL 이 닫혔다 — 제기자가 실측

**testing** 이 폴백 제거 뮤턴트를 다시 심어 **정확히 4건 RED**(그중 신규 e2e 포함)를 확인했고,
나아가 **첫 판 형태(`&trigger=t1`)로 되돌리면 그 e2e 가 GREEN 이 되는 것까지 재현**해 내
자체 진단("직접 로드 폴백이 관측을 가린다")이 정확했음을 입증했다. 그리고 신규 e2e 가 **세 축**
(검증 로직 무력화 · warn 제거 · 병합 우선순위 역전)에서 독립으로 RED 임을 확인 — 단일 뮤턴트만
잡는 vacuous 형태가 아니다.

## **6명이 같은 자리를 짚었다** — `use-widget.ts:197` 의 죽은 `§R0`

`R0 → R7` 재번호와 **같은 커밋**에서 새로 쓴 JSDoc 이 `spec §R0` 를 인용했다. scope ·
rationale_continuity · naming_collision · convention · documentation · side_effect **여섯**이
독립으로 잡았다. 하필 그 주석이 "한 사실을 두 곳에 복제해 놓고 한 곳만 고친다" 를 설명하는
자리다 — 같은 커밋의 plan 은 `§R7(당시 §R0)` 로 갱신했는데 코드만 놓쳤다.

## cross_spec WARNING — spec 이 실제 동작을 잘못 서술하고 있었다

`§1` 표가 쿼리 경로와 boot 경로를 **상호배타적**으로 서술했으나, 실제로는 SDK 가 모든 임베드에서
iframe src 쿼리에 `apiBase` 를 싣고 위젯이 그 값으로 **먼저** 부팅을 시도한 뒤 `wc:boot` 이
세대 판정으로 대체한다 — **둘 다 순차 발동**. 이 오서술을 믿고 쿼리 폴백을 제거하면 모든 정상
임베드가 깨진다. 이번 라운드에서 **새로 드러난 사실**이다.

## Warning — 전부 고침

| 출처 | 내용 |
|---|---|
| 6명 수렴 | 죽은 `§R0` 참조 → `§R7` + 축약(중복 4곳 → SoT 하나) |
| cross_spec | `§1` 상호배타 오서술 → "둘 다 순차 발동" 정정 + 제거 위험 명시 |
| scope · plan_coherence · requirement (**3명**) | `spec_impact` 에 `2-sdk.md` 누락 |
| requirement · documentation | plan "450 passed(신규 8)" → **451(신규 9)** |
| documentation | 같은 거짓 문장의 **네 번째 복제본**(테스트 주석) |
| convention | `2-sdk.md` 주석이 코드펜스 안 마크다운 → 리터럴 렌더 |
| side_effect | e2e 가 `search` 만 캡처(pathname 유실 소지) → `href` 전체 |

## INFO (무조치)

`configFromQuery()` 자체를 악성 쿼리로 태우는 e2e 부재(선행 PR 소관, 로직은 단위로 방어) ·
`mergeBootConfig` 가 이미 오염된 `fromQuery` 를 받는 이론적 경우(프로덕션 도달 불가) ·
`use-widget.ts` 분리 시점(다음 헬퍼 추가 때).

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 7 (중복 제거 후 7, 전부 처분)
