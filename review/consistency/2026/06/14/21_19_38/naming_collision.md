# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/16-system-status-api.md` (worktree: eia-followup-spec-nits-6e8ef5)

이번 변경의 실질적 diff는 다음 두 가지다:
1. `§1 QueueRegistry` 표에 `terminal-revoke-reconcile` 행 추가
2. `⚠ 구현 갭` 노트 갱신: `makeshop-token-refresh`·`terminal-revoke-reconcile` 등재 완료, `agent-memory-extraction` 미등재 잔여로 업데이트

---

## 발견사항

충돌로 분류할 항목이 없다. 아래는 각 검토 관점의 분석 결과다.

### 1. 요구사항 ID 충돌 — 해당 없음

target 문서는 새 요구사항 ID를 부여하지 않는다. `EIA-RL-06` 참조는 기존 `spec/5-system/14-external-interaction-api.md`의 식별자를 cross-reference 할 뿐이며, 신규 부여가 아니다.

### 2. 엔티티/타입명 충돌 — 해당 없음

이번 변경이 도입하는 신규 식별자는 없다. `SystemStatusOverviewDto`, `QueueStatusDto`, `QueueRegistry`, `recentFailed`, `recentFailedCapped`, `failedWindowMinutes` 등은 모두 기존 target 파일에 이미 존재하는 식별자이며, 이번 diff는 큐 목록 표의 행 추가와 노트 문구 갱신만 수행한다.

`terminal-revoke-reconcile` 이라는 큐 이름은 `spec/data-flow/0-overview.md §4`(SoT), `spec/data-flow/15-external-interaction.md §2.2`, `spec/5-system/14-external-interaction-api.md §9.3` 등 기존 다수 문서에서 동일 의미로 일관되게 사용된다. 식별자 충돌 없음.

### 3. API endpoint 충돌 — 해당 없음

새 endpoint 도입 없음. `GET /api/system-status/overview`는 기존 target 파일 및 `spec/data-flow/9-observability.md`, `spec/5-system/3-error-handling.md`에 이미 동일 의미로 정의되어 있다.

### 4. 이벤트/메시지명 충돌 — 해당 없음

새 이벤트/메시지명 도입 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음

새 ENV var 도입 없음. `SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD`, `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, `SYSTEM_STATUS_FAILED_SCAN_CAP` 은 모두 기존 target 파일에 이미 정의된 키다.

### 6. 파일 경로 충돌 — 해당 없음

기존 파일(`spec/5-system/16-system-status-api.md`) 수정이며 신규 파일 생성이 아니다.

---

## 요약

이번 target 변경은 `spec/5-system/16-system-status-api.md` 의 `§1 QueueRegistry` 표에 `terminal-revoke-reconcile` 행을 추가하고 구현 갭 노트를 갱신하는 최소 변경이다. 추가된 큐 이름 `terminal-revoke-reconcile`은 큐 목록 SoT(`spec/data-flow/0-overview.md §4`)를 비롯해 EIA spec(`spec/5-system/14-external-interaction-api.md`), data-flow(`spec/data-flow/15-external-interaction.md`) 등 기존 문서들과 완전히 동일한 의미와 표기로 일관되게 사용되고 있으며, 식별자 충돌이 발생하지 않는다. 신규 DTO·타입명·엔드포인트·이벤트명·환경변수·파일 경로 중 어떤 것도 새로 도입되지 않아 명명 충돌 위험이 없다.

## 위험도

NONE
