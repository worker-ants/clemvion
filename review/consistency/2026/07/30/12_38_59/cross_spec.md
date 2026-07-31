STATUS=success cross_spec review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `spec/data-flow/3-execution.md` §3.3 이 인접 백스톱 메커니즘의 NodeExecution 레벨 정리를 여전히 누락 서술 (target 범위 밖, 사전 존재)
  - target 위치: 해당 없음 — target 은 이 문단을 건드리지 않음
  - 충돌 대상: `spec/data-flow/3-execution.md:298`("recoverStuckExecutions" 행) 및 `:349-355`("폐기된 서술" 절, "node_execution 정리는 수행하지 않는다")
  - 상세: target 이 정정하려는 `spec/5-system/4-execution-engine.md` §7.3(줄 884)은 이미 "크래시 시점의 옛 `NodeExecution(status=running)` row 는 case B re-drive 진입 시 terminal(`failed`)로 마감한다(`failOrphanRunningNodeExecutions`)" 를 명시한다 — 이건 target 이 다루는 "2차 claim discard" 케이스와는 **다른** 케이스(크래시 re-drive 진입 시 orphan 정리)이지만, 개념적으로 인접한 "recoverStuckExecutions 주변 orphan NodeExecution 처리" 주제다. 그런데 같은 메커니즘을 별도로 서술하는 `data-flow/3-execution.md` §3.3 표(`recoverStuckExecutions` 행)는 `failOrphanRunningNodeExecutions` 호출을 언급하지 않고, 같은 문서의 "폐기된 서술" 절은 "실제 대상은 30분 stale heartbeat row 만이고 **node_execution 정리는 수행하지 않는다**" 라고 명시적으로 못박아 두었다 — 이는 PR3 도입 이전 시점 기준으로는 맞았을 수 있으나 현재 `4-execution-engine.md` §7.3 의 서술과 표면적으로 어긋난다. **이 drift 는 이번 target draft 가 만든 것이 아니라 이미 존재하던 것**이며, target 이 편집하는 문단(§7.5 대칭 Rationale, 줄 1387-1391)과는 별개 문단(§7.3, 줄 876-884)이라 target 의 책임 범위 밖이다.
  - 제안: target 자체는 수정 불요. 별도 후속으로 `data-flow/3-execution.md` §3.3 "recoverStuckExecutions" 행에 "case B re-drive 진입 시 crash-orphan `NodeExecution(running)` 도 `failOrphanRunningNodeExecutions` 로 함께 terminal 마감" 한 줄을 보강하고, "폐기된 서술" 절의 "node_execution 정리는 수행하지 않는다" 문구를 재검토하는 별도 spec-sync 항목으로 등재 권장 (target 의 `plan/in-progress/retry-turn-terminal-guard.md` #15 와는 다른 항목).

- **[INFO]** target 적용 시 `4-execution-engine.md` 절대 줄번호 이동 — 동시 진행 중인 다른 draft 의 줄번호 인용과 좌표 어긋남 위험
  - target 위치: `## 제안 변경` — Before(5줄, 줄 1387-1391) → After(약 15줄) 치환
  - 충돌 대상: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` — `4-execution-engine.md:1454`, `:114`, `:77`, `:79-92` 등 같은 파일의 절대 줄번호를 인용하는 미결 spec 갱신 제안
  - 상세: target 의 After 문단이 Before 보다 대폭 길어(5줄→약15줄) `4-execution-engine.md` 1391행 이후 전체 내용이 그만큼 아래로 밀린다. 위 다른 in-progress plan 은 같은 파일의 절대 줄번호(`:1454`, "`failed → running` 재진입 전이" 절 등)를 인용하고 있어 target 반영 후 그 줄번호가 추가로 어긋난다. 실측: 현재도 `:1454` 인용은 이미 정확한 앵커가 아니다(직접 확인 결과 1454행은 "retryable error 종결 시 `_retryState` 보존" 절의 R2 기각 사유 불릿이고, 인용이 가리키려던 "`failed → running` 재진입 전이" 절은 실제로는 1491행에서 시작 — 기존에도 소폭 drift 존재). 다만 두 draft 가 편집하는 정확한 줄 범위는 겹치지 않는다(target: 1387-1391, 타 plan 인용: 77/114/1454/1491 부근) — **텍스트 충돌은 없다**, 좌표 인용만 추가로 밀린다.
  - 제안: target 자체는 수정 불요(좌표 인용은 그 다른 plan 문서의 책임). 다만 그 다른 plan 은 현재 `worktree: (unstarted)` 로 미착수 상태이므로 실질 위험은 낮음 — 향후 그 plan 을 착수할 때 절대 줄번호 대신 인용된 원문 텍스트로 재검색(content-match)해 앵커를 갱신하도록 참고만 해두면 충분.

### 요약

target 은 `spec/5-system/4-execution-engine.md` §7.5 대칭 Rationale 의 단일 문단(줄 1387-1391)만 교체하는 매우 좁은 범위의 정정이며, "Before" 인용문은 현재 spec 파일과 바이트 단위로 일치함을 직접 대조 확인했다. `retry_last_turn`·`recoverStuckExecutions`·`failOrphanRunningNodeExecutions`·`_retryState`·`claimSpawnedRetryRow` 를 언급하는 spec/** 전 영역(같은 파일의 §1.1/§1.2/§7.3/§7.4/§7.5 상태 전이표·Rationale, `spec/1-data-model.md` Execution/NodeExecution 엔티티, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`, 그리고 `retry_last_turn` 을 언급하는 12개 파일 전체)를 교차 검색한 결과, target 의 핵심 주장 — "`recoverStuckExecutions`/`failOrphanRunningNodeExecutions` 는 stale RUNNING **Execution** 재구동 경로에서만 발동하므로 Execution 이 이미 terminal 이면 닿지 않는다" — 와 모순되는 서술은 어디에도 없었고, 오히려 같은 파일의 "짝 전이는 방향과 무관하게 no-op 이 될 수 있다 (2026-07-27)" 원자성 각주(줄 81-92)가 그 orphan 발생 메커니즘을 뒷받침한다. 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 어느 축에서도 충돌이 없다(이 파일은 요구사항 ID 를 부여하는 영역이 아니며, 이번 변경은 엔티티·엔드포인트·권한 어느 것도 건드리지 않는 순수 Rationale 서술 정정이다). 위에 기록한 2건은 모두 target 의 편집 범위 밖에서 발견된 인접·저위험 관찰(사전 존재하는 문서 간 서술 격차 1건, 다른 미착수 draft 의 줄번호 인용 drift 1건)로, target 자체를 막을 사유가 아니다.

### 위험도
LOW
