# RESOLUTION — review/code/2026/06/05/00_12_34

리뷰 SUMMARY 의 Critical 1건을 같은 세션에서 수정 완료했다.

## C1 (Critical, Correctness/Concurrency): dedup-drop watermark livelock
- 원인: scheduleExtraction opts 가 removeOnComplete:100 → 완료 추출 job 이 retain
  되어 같은 scope 다음 enqueue 가 그 완료 job 으로 dedup-drop(false) → M1 의
  strict-no-advance 가 watermark 를 영영 전진시키지 못함.
- 조치: codebase/backend/src/modules/agent-memory/agent-memory.service.ts 의
  removeOnComplete 를 true 로 변경(완료 job 즉시 제거). dedup 은 실제 in-flight
  (waiting/active/delayed) job 에만 발동 → M1 의 의도(저장 없이 drop 된 turn 만
  watermark 보존)와 정확히 일치. fire-and-forget producer 라 완료 job 보존 불필요.
- 테스트: agent-memory.service.spec.ts 의 removeOnComplete 단언을 true 로 갱신.
  전체 jest agent-memory ai-agent 499 passed, build exit 0 재확인.

## Warning
없음.
