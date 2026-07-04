# 변경 범위(Scope) Review

## 발견사항

없음 (no findings)

## 분석 근거

- 이번 diff(origin/main 대비)는 PR2b "동시성 cap admission gate + 5분 queue-wait cancel" 기능 커밋 3개(009022ebb, 7f636f187, c499da0f2)와 직전 ai-review(16_58_32) 결과에 대한 조치 커밋 1개(bef981c1f)로 구성된다.
- 조치 커밋(bef981c1f)의 모든 변경은 `review/code/2026/07/04/16_58_32/RESOLUTION.md`·`SUMMARY.md` 에 기록된 9개 항목(advisory lock 직렬화, `recordRunningSegmentStart` 보정, lock key fallback, `GET /settings` + Swagger DTO 동기화, spec §8 flip, V105 인덱스, `queuedAt=null` 유닛, workflow-cap DTO 보류, raw SQL ACCEPT)과 1:1로 대응하며, 그 범위를 벗어나는 추가 수정은 없다.
  - `execution-engine.service.ts`: admission 을 `pg_advisory_xact_lock` 트랜잭션으로 재작성(#1), `admitted` 분기에 `recordRunningSegmentStart` 추가(#2), lock key workspaceId fallback(#3) — 모두 admission gate 메서드 내부에 국한.
  - `workspace-response.dto.ts` / `workspaces.service.ts`: `maxConcurrentExecutions` GET 응답·Swagger 반영(#4) — PATCH 쪽(update-workspace-settings.dto.ts, 이전 커밋)과 정확히 짝을 맞추는 최소 변경.
  - `spec/5-system/4-execution-engine.md`: "정책 정의 완료" → "구현 완료" flip + advisory lock 필수 서술 정정(#5), 그 외 표현 변경 없음.
  - `V105__execution_workflow_status_index.sql/.conf`: admission COUNT hot-path 인덱스 추가(#6), 다른 인덱스·스키마 변경 없음.
  - `execution-engine.service.spec.ts`: `queuedAt=null` 분기 유닛 1건 추가(#7)와 admission mock 을 `manager.transaction` 기반으로 갱신(선행 커밋의 admission 도입에 종속된 필수 변경, scope 이탈 아님).
  - `workflow-level cap 검증 DTO`(#8)는 RESOLUTION 에 명시적으로 "보류"로 기록되었고 실제로 diff 에 workflow DTO 변경이 없음 — 의도된 축소 스코프가 코드에도 정확히 반영됨.
  - `admitExecutionOrDefer` 의 raw SQL 유지(#9)는 "ACCEPT"(변경 안 함)로 기록되었고 실제로 캡슐화 리팩토링이 없음 — 불필요한 리팩토링을 하지 않은 것도 확인.
- `.env.example`(`EXECUTION_QUEUE_WAIT_TIMEOUT_MS`)·`Execution.queuedAt` 엔티티/V104 마이그레이션·`execution-concurrency-cap.e2e-spec.ts`·`docker-compose.e2e.yml` 의 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS=8000` 은 선행 feature 커밋(009022ebb/c499da0f2)에서 도입된 PR2b 본 기능의 필수 구성 요소로, 이번 조치 라운드와 무관하게 이미 스코프 안에 있던 변경이며 추가 확장이 아니다.
- `review/code/2026/07/04/16_58_32/*`(SUMMARY.md, RESOLUTION.md, 각 리뷰어 산출물, `_retry_state.json`, `_routing_decision.json`)는 프로젝트 규약(`review/**` 커밋 대상)에 따른 리뷰 프로세스 산출물이며 코드 스코프 이탈이 아니다.
- 포맷팅만의 변경, 무관한 파일 수정, 사용하지 않는 임포트, 불필요한 주석 정리, 요청 외 기능 확장(over-engineering) 징후는 발견되지 않았다. `execution-limits.ts` 의 새 export(`resolveConcurrencyCap`, `resolveQueueWaitTimeoutMs`, 상수들)는 모두 admission gate 가 실제로 사용하는 것이며 미사용 export 는 없다.

## 요약

이번 diff 는 PR2b 기능 구현 3개 커밋과 그에 대한 직전 ai-review(16_58_32) 조치 1개 커밋으로 구성되며, 조치 커밋의 모든 변경이 RESOLUTION.md 의 9개 항목과 정확히 1:1 대응한다. 보류로 기록된 항목(workflow-level cap DTO)은 실제로 코드에 반영되지 않았고, ACCEPT 로 기록된 항목(raw SQL 유지)도 불필요한 리팩토링 없이 그대로 유지되어 있다. 무관한 파일 수정, 포맷팅 전용 변경, 범위 밖 리팩토링·기능 확장은 발견되지 않았다.

## 위험도

NONE
