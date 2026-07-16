# RESOLUTION — 항목 B fix 검증 (12_23_46)

직전 ai-review(11_49_26)의 concurrency CRITICAL fix(204b9aed6)를 concurrency·side_effect 로 재검증. 원래 CRITICAL 해소 확인 + 검증 중 신규 WARNING 1건 발견·조치.

## 조치 항목

| # | 카테고리 | 처분 | 조치 내용 |
|---|---|---|---|
| 원 CRITICAL 재검증 | 동시성 | **확인(해소)** | fix(204b9aed6)가 withTimeout 콜백 signal 을 SDK 로 병합 전달(+Google chat signal) → 타임아웃 시 실제 요청 취소. concurrency 재검증 CRITICAL=0. |
| 신규 W (concurrency) | 테스트 | **fix** | fix 가 추가한 `'merges opts.signal...'` 회귀 테스트의 mock 이 abort 비반응이라 withTimeout 60s setTimeout 이 clearTimeout 안 됨 → open handle 누수(jest "zero open handle" 위반, 프로세스 60.69s 종료). mock 이 abort 시 reject 하도록 수정(race settle→clearTimeout). `--detectOpenHandles` 재실행 누수 없음, 3.93s 종료 확인. |
| INFO (concurrency) | — | **후속 위임** | `LlmService.embed()` 도 동일 withTimeout 버그 + `embedding.service` 상시 사용 → 별도 task `task_07c120ce` spawn(client.embed signal 지원 선행 필요, item B 스코프 밖). |
| side_effect | — | **확인** | no-timeout 분기 미변경·google optional param 하위호환·embed/stream/listModels 미변경 — CRITICAL 0, WARNING 0. |

## TEST 결과 (조치 후)
- lint / unit: 통과 (테스트 수정 후 재실행). llm.service.spec 55 tests, open-handle 누수 없음(3.93s 종료).
- build / e2e: 직전 fix(204b9aed6) 기준 통과 — 본 조치는 테스트 mock 만 변경(프로덕션 무영향).

## 관련 impl-done (12_22_49)
`/consistency-check --impl-done`: BLOCK NO (5/5 CRITICAL 0). WARNING(§12.16 이 `LLM_TIMEOUT` 을 "Workflow AI Assistant 전용" 으로 부정확 서술 — 실제 양쪽 미발행 enum) → §12.16 을 "ai_agent timeout ⇒ LLM_CALL_FAILED, LLM_TIMEOUT 은 별개 미발행 enum" 으로 정정. error-handling.md §2.2 placeholder 정리 등 INFO 는 spec-drift planner task 소관.
