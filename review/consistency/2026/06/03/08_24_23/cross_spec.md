# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-system-status-recent-failed.md`
변경 대상 spec: `spec/5-system/16-system-status-api.md`, `spec/2-navigation/15-system-status.md`
검토 일시: 2026-06-03

---

## 발견사항

### [WARNING] health 파생 규칙 §3 Rule 3 의 env 변수명 중복 사용

- **target 위치**: Draft §§3 health 파생 규칙 변경 — "임계 env `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1) 재사용"
- **충돌 대상**: `spec/5-system/16-system-status-api.md §3` — 현행 Rule 3 에서 `failed >= FAILED_DEGRADED_THRESHOLD` 와 함께 "환경변수 `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1)" 이라고 이미 명시
- **상세**: draft 의 변경안은 Rule 3 의 조건을 `recentFailed >= FAILED_DEGRADED_THRESHOLD` 로 교체하면서 동일 env `SYSTEM_STATUS_FAILED_THRESHOLD` 를 그대로 "재사용" 한다고 명시하고 있다. 이는 기술적으로 일관되지만, 기존 spec 은 이 env 를 "failed(보관 중 누적)" 기준으로 정의했다는 암묵적 의미가 있다. 변경 후에는 동일 env 가 "recentFailed(최근 윈도우)" 기준으로 의미가 바뀐다. 운영자가 기존 env 설정값을 그대로 유지한 채 배포하면 동작이 묵시적으로 달라진다(배포 전: 보관 중 1건이면 degraded → 배포 후: 최근 60분 내 1건이면 degraded). 이 의미 변화가 spec 에서 명확히 기술되어야 한다.
- **제안**: `16-system-status-api.md §3` 의 env 설명 행에 "(v2 이후: recentFailed 기준으로 의미 변경 — 배포 후 기존 설정값 재검토 권장)" 노트를 추가하거나, Rationale R-5 에 env 의미 변화 주의사항을 명시한다.

---

### [WARNING] `spec/5-system/_product-overview.md §5 NF-OB-06` 요구사항 기술과의 불일치

- **target 위치**: Draft 전반 — `totalRecentFailed`, `recentFailed` 신규 필드 도입
- **충돌 대상**: `spec/5-system/_product-overview.md §5 NF-OB-06` — "큐 적체/실패/포화도를 집계 UI 로 노출" 요구사항 설명
- **상세**: NF-OB-06 의 현행 기술은 단순히 "실패/포화도를 집계 UI 로 노출" 이라고만 기술되어 있다. draft 가 확정되면 "실패" 지표가 "최근 윈도우 실패(주) + 누적 보관 실패(부)" 두 개로 세분화된다. NF-OB-06 설명이 이 분화를 반영하지 않으면 개요 레벨 요구사항이 구현과 어긋난다. 단, NF-OB-06 이 매우 추상적으로 기술된 권장 사항이라 직접 충돌이라기보다는 동기화가 권장되는 수준이다.
- **제안**: draft 확정 시 `spec/5-system/_product-overview.md §5 NF-OB-06` 의 설명을 "큐 적체/실패(최근 윈도우 기준 주 지표, 누적 보관 부 지표)/포화도를 집계 UI 로 노출" 수준으로 동기화한다.

---

### [WARNING] `spec/2-navigation/_product-overview.md` NAV-SS 요구사항 ID 의 불완전 커버

- **target 위치**: Draft §B 전반 — 화면 변경안(헤더·카드 병기)
- **충돌 대상**: `spec/2-navigation/_product-overview.md` `NAV-SS-01` ~ `NAV-SS-06` 요구사항 목록 (현행 구현 상태 ✅ 표기)
- **상세**: draft 는 `15-system-status.md` 를 변경하지만, `_product-overview.md` 의 NAV-SS 요구사항 목록은 현행 API 형태(단일 `totalFailed` + `counts.failed`)를 전제로 구현 완료(✅) 로 표기된 상태다. 특히 NAV-SS-01("전체 시스템(큐) 상태를 집계 카운트로 표시") 과 NAV-SS-02("큐별 health(정상/지연/점검) 신호등 + 종합 상태") 는 동작 의미가 draft 적용 후에도 여전히 맞지만, "실패 카운트" 가 이중 병기로 변경되었다는 사실이 NAV-SS 목록 어디에도 나타나지 않는다. draft 를 적용하려면 NAV-SS-07 등 신규 ID 를 추가하거나 NAV-SS-01 설명을 확장해야 한다.
- **제안**: `spec/2-navigation/_product-overview.md §3.9 System Status` 에 신규 요구사항 ID를 추가한다 (예: `NAV-SS-07` — "최근 윈도우 실패 주 지표 + 누적 보관 실패 부 지표 병기" / `NAV-SS-08` — "윈도우 길이를 라벨에 반영"). draft 변경안이 이 ID 들을 참조하도록 한다.

---

### [INFO] `spec/5-system/16-system-status-api.md §2` DTO 명세와 `spec/2-navigation/15-system-status.md §2.2` 간 `totalFailed` 라벨 동기화

- **target 위치**: Draft §A §2 DTO — `totalFailed`(보관 중 누적) + `totalRecentFailed`(최근 윈도우) 신규 추가 / Draft §B §2.2 — 주 배지를 `totalRecentFailed`, 부를 `totalFailed` 로 병기
- **충돌 대상**: `spec/2-navigation/15-system-status.md §2.2` 현행 — "`totalFailed`(전 큐 실패 합계) 배지. 0 초과 시 강조."
- **상세**: 현행 15-system-status.md §2.2 는 `totalFailed` 를 단독 주 배지로 다루고 있다. draft 가 채택되면 이 문장은 "부 배지" 로 격하된다. 두 문서가 동일 DTO 필드 `totalFailed` 의 UI 노출 우선순위를 다르게 기술하게 되어 불일치가 발생한다. 두 spec 을 동시에 갱신하므로 자체 처리되어야 할 사항이나, 실수로 한쪽만 갱신될 경우 불일치가 남는다.
- **제안**: draft §B §2.2 변경안을 15-system-status.md 에 적용 시, 기존 §2.2 의 `totalFailed` 배지 문장을 명시적으로 교체(두 필드 모두 서술)하는 형태로 작성하고, `totalFailed`가 더 이상 주 배지가 아님을 명확히 한다.

---

### [INFO] `spec/2-navigation/15-system-status.md §1 ASCII 다이어그램` 갱신 필요

- **target 위치**: Draft §B §1 — "카드/배너 갱신" 지시
- **충돌 대상**: `spec/2-navigation/15-system-status.md §1` 현행 ASCII 다이어그램 — "실패 작업 합계: 0" 단일 표기
- **상세**: 현행 §1 ASCII 다이어그램의 헤더 배너에는 "실패 작업 합계: 0" 만 있고 큐 카드에도 "실패 N" 단일 셀만 있다. draft 는 이 텍스트를 변경한다고 명시하고 있으나, ASCII 다이어그램 자체의 교체 예시가 없다. spec 변경 시 다이어그램이 누락되면 산문과 시각 명세가 어긋난다.
- **제안**: draft 최종안에 §1 ASCII 다이어그램 교체안을 명시한다 ("실패(최근 60분): 0 · 누적 보관: 0" 헤더 + 카드 셀 "실패(최근) N / 보관 M" 반영).

---

### [INFO] `spec/5-system/16-system-status-api.md §2` 구현 노트의 "상수 비용" 기술이 무효화

- **target 위치**: Draft §A §2 구현/비용 노트 변경
- **충돌 대상**: `spec/5-system/16-system-status-api.md §2` 현행 구현 노트 — "추가 Redis 비용은 **큐 수에 비례하는 상수** (job 처리량과 무관 — getJobCounts 는 카운터 조회)"
- **상세**: 현행 spec 의 이 문장은 draft 적용 후 명시적으로 틀린 기술이 된다. draft 는 "더 이상 상수 비용이 아니라 윈도우 내 실패 수 + 스캔 캡에 비례한다" 고 명시하고 있으므로, 현행 §2 의 해당 문장은 삭제하거나 교체해야 한다. 두 기술이 공존하면 spec 읽는 사람이 혼동할 수 있다.
- **제안**: draft §A §2 구현/비용 노트 변경안이 현행 spec 의 "상수 비용" 문장을 명시적으로 삭제·대체하는 형태로 작성한다.

---

## 요약

draft 가 변경하는 `spec/5-system/16-system-status-api.md` 와 `spec/2-navigation/15-system-status.md` 는 서로 자기 참조하는 쌍 문서이므로, 두 문서를 동시에 갱신하면 상호 간의 직접 충돌은 없다. 그러나 두 가지 WARNING 이 주의를 요구한다. 첫째, `SYSTEM_STATUS_FAILED_THRESHOLD` env 변수의 의미가 "보관 중 누적" 에서 "최근 윈도우" 로 묵시적으로 바뀌어 기존 운영 설정의 행동이 달라지는 문제가 spec 에 명시되어야 한다. 둘째, `_product-overview.md` 의 NAV-SS 요구사항 목록이 변경된 기능(병기 UI)을 커버하지 못하므로 신규 NAV-SS ID 추가가 필요하다. INFO 항목들은 draft 적용 시 함께 처리하지 않으면 spec 내 ASCII 다이어그램·배지 우선순위 기술·구현 비용 노트가 산문과 어긋나게 된다. CRITICAL 수준의 직접 모순은 없다.

---

## 위험도

LOW
