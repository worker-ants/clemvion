# 변경 범위(Scope) Review

## 검토 방법
- `_prompts/scope.md` 페이로드 전체(5개 파일 항목: `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`) 정독.
- `git diff --stat` 로 이번 변경이 위 5개 spec 파일 한정임을 재확인(코드 파일 diff 없음 — 순수 spec 문서 업데이트 배치).
- `plan/in-progress/spec-update-execution-engine-pr4.md` 의 `spec_impact` frontmatter 및 편집 목록(E1~)과 실제 diff 를 대조해 "의도된 범위" 기준선으로 사용.

## 발견사항

no findings

검토한 5개 파일 모두 동일한 단일 의도 — "PR4(BullMQ stalled 자동 재배달) 구현 착지에 따라 spec 의 `Planned`/`target` 마커를 `구현 완료(2026-07-04)` 로 상태 정합화"—에 정확히 대응한다. 각 파일의 diff hunk 를 개별 확인한 결과:

- `spec/1-data-model.md`: `error` 필드 설명의 `WORKER_HEARTBEAT_TIMEOUT` 주석 한 곳만 "PR4 예약" → "PR4 구현(2026-07-04)"로 갱신. 무관 필드·행 변경 없음.
- `spec/5-system/3-error-handling.md`: §1.4 에러 코드 표의 동일 `WORKER_HEARTBEAT_TIMEOUT` 행 한 곳만 문구 갱신. 다른 에러 코드·섹션 변경 없음.
- `spec/5-system/4-execution-engine.md`: §4 구현 상태 banner, §7.1 표/본문, §7.2 point 2, §7.4 rehydration case B 각주, §7.5 zombie race 각주, §9.2 Redis 키 표(`exec:run:seq`), §9.3 큐 옵션 표+DLQ 모니터 섹션+env 변수 표, §Rationale(PR3→PR4 관계, 신규 "PR4 — BullMQ stalled 자동 재배달" 절, under-count 각주) 등 다수 hunk가 있으나, 전부 "PR4 구현 완료" 사실 반영 또는 그로 인해 파생되는 인접 서술(부팅 backstop 병존, seq 불요, DLQ 모니터 env, zombie race 완화)의 정합화다. 새로운 설계 도입이 아니라 기존 계획된 항목의 상태 flip + 구현 결과와 스케치가 갈린 지점(F1: `recoverStuckExecutions` 은퇴하지 않음, F-seq: `exec:run:seq` 불요)의 사실 기록.
- `spec/conventions/error-codes.md`: §3 historical-artifact 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT` 행 한 곳만 발동 조건 문구 갱신("PR4 target" → "PR4 구현, 2026-07-04").
- `spec/data-flow/3-execution.md`: §1.1 큐 옵션 설명, §1 큐 표, 상태 다이어그램(전이 라벨 2곳), §3.2 표(`WORKER_HEARTBEAT_TIMEOUT` 행), §3.3 비정상 종료 회수 표(소스 3종으로 확장 — PR4 stalled 재배달 행 신규 추가 + `recoverStuckExecutions` 행 라벨을 "부팅 backstop"으로 정정)만 변경. 모두 동일 PR4 사실 반영.

교차 검증:
- `plan/in-progress/spec-update-execution-engine-pr4.md` frontmatter `spec_impact` 리스트(5개 파일)가 실제 `git diff --stat` 대상 5개 파일과 정확히 1:1 일치.
- 동일 plan 문서의 "편집 목록(E1~)"이 사전에 각 hunk 를 항목화해뒀고, 실제 diff 내용이 그 목록과 대응한다(before/after 서술이 diff 와 부합).
- 포맷팅만 바뀐 라인, 무관 임포트/설정 변경, 기능 확장(over-engineering), 무관 파일 수정은 발견되지 않음 — 이번 diff 는 코드 파일을 전혀 건드리지 않는 순수 spec 문서 상태 정합화 배치다.
- 각 파일 diff 는 "PR4 구현 완료" 사실과 그 직접 파생 서술(같은 hunk 내 인접 문장)만 수정했고, PR4 와 무관한 기존 서술(§8 동시성 cap, 우선순위 3-tier 등 여전히 Planned 인 항목)은 그대로 "Planned" 로 남겨둬 스코프 경계가 명확하다.

## 요약
검토 대상 5개 spec 파일의 모든 diff hunk 는 단일 의도(PR4 구현 착지에 따른 "Planned/target" → "구현 완료" 상태 정합화)에 정확히 대응하며, `plan/in-progress/spec-update-execution-engine-pr4.md` 의 `spec_impact` frontmatter·편집 목록과 실제 changeset 이 1:1 일치한다. 새로운 요구사항 도입, 무관한 리팩토링, 기능 확장, 포맷팅 노이즈, 불필요한 주석/임포트/설정 변경은 발견되지 않았다. PR4 와 무관한 기존 Planned 항목(§8 동시성 cap 등)은 손대지 않고 그대로 유지되어 스코프 경계도 명확하다.

## 위험도
NONE
