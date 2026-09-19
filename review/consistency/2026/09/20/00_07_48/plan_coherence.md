# Plan 정합성 검토 — spec/2-navigation/ (--impl-done)

## 발견사항

- **[INFO]** 완료 표시가 실제 이동보다 앞서 있다 (진행 중, 자연 해소 예상)
  - target 위치: 해당 없음 (target `spec/2-navigation/` 자체는 이 항목과 무관 — plan 상호간 정합)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (라인 ~4853, ~4862) vs `plan/in-progress/connection-test-codes-and-gaps.md` (체크리스트)
  - 상세: 트래커 문서가 두 원 항목("연결 테스트 결과 코드가 원시 문자열로 흩어져 있다", "연결 테스트 spec 의 빈칸 셋")을 이미 `[x]` **해소** 로 표시하고 `plan/complete/connection-test-codes-and-gaps.md` 를 인용한다. 그러나 실제 작업 plan 은 아직 `plan/in-progress/connection-test-codes-and-gaps.md` 에 있고, 그 plan 자신의 체크리스트도 `[ ] --impl-done` · `[ ] 트래커 두 항목 해소 · 이 plan plan/complete/ 로` 가 아직 미체크다 (본 검토가 그 `--impl-done` 게이트다). 즉 "완료" 표시와 인용 경로가 실제 파일 위치보다 한 걸음 앞서 있다.
  - 제안: 이 CRITICAL/WARNING 이 아닌 이유는 — (1) 두 파일 모두 같은 세션의 미커밋 작업 범위 안에 있어 마무리 커밋에서 실제 이동과 함께 정합해질 가능성이 높고, (2) CLAUDE.md 규약상 "체크와 `complete/` 이동은 한 동작" 이 관례이므로 이번 finalize 커밋에서 `connection-test-codes-and-gaps.md` 를 실제로 `plan/complete/` 로 옮기는 것을 빠뜨리지 않도록 확인 필요. 옮기지 않고 커밋하면 트래커의 링크가 깨진 경로를 가리키게 된다.

- **[INFO]** spec 문서화 갭은 발견 즉시 별도 트래커로 정상 이관됨 (정합 확인, 조치 불필요)
  - target 위치: `spec/2-navigation/4-integration.md` §5.3 "HTTP/REST" 결과 목록(라인 476-483), §14.1 에러 코드 vocabulary 표(라인 1100-1122)
  - 관련 plan: `plan/in-progress/connection-test-codes-and-gaps.md` 체크리스트의 `--impl-prep` WARNING 1, 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4933-4936 (2026-09-20 신규 등재)
  - 상세: 이번 diff (`connection-test-codes.ts`)는 HTTP 연결 테스트가 `resolveHttpCredentials` 실패 시 `INTEGRATION_INCOMPLETE` / `INTEGRATION_AUTH_UNSUPPORTED` 를 낼 수 있음을 타입으로 명시했는데, 대조해 보면 §5.3 의 "결과:" 목록과 §14.1 표 어디에도 이 두 코드가 없다(직접 확인 — 코드에서 wire 값을 바꾼 것이 아니라 기존에도 나던 값이 spec 에 처음부터 누락돼 있었다). 이 gap 은 developer 가 직접 spec 을 고치지 않고(코드 plan `spec_impact: none` 이 맞다 — wire 값 불변) planner 몫으로 `spec-draft-nullable-notation-followups.md` 에 새 후속 항목으로 등재했다. 미해결 결정 우회도, 후속 누락도 아니다 — 정확히 의도된 절차(§자기-반증형 소정정 예외에 해당하지 않는 일반 케이스이므로 planner 턴 필요, 실제로 넘겼다).
  - 제안: 조치 불필요. 다음 planner 턴에서 이 신규 항목을 반영하면 된다.

## 요약

target `spec/2-navigation/` 자체는 이번 diff 로 변경되지 않으며(파일 delta 0, 예상대로), 진행 중인 plan `connection-test-codes-and-gaps.md` (`spec_impact: none`) 은 wire 값을 바꾸지 않는 순수 타입 좁히기·테스트 보강이라 target 문서가 "결정 필요" 로 남긴 어떤 항목과도 충돌하지 않는다. diff 가 드러낸 유일한 spec 갭(§5.3/§14.1 이 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 를 누락)은 developer 가 스스로 고치지 않고 `spec-draft-nullable-notation-followups.md` 에 planner 몫 후속 항목으로 정상 등재했다 — 후속 항목 누락에 해당하지 않는다. 유일하게 짚을 점은 그 트래커 문서가 완료 표시(`[x]` 해소)와 `plan/complete/...` 경로 인용을 이 plan 의 실제 이동보다 먼저 적어 두었다는 점으로, finalize 커밋에서 실제 파일 이동이 누락되지 않도록 확인이 필요한 INFO 수준 메모다. 다른 in-progress plan(예: `ai-agent-tool-connection-rewrite.md`, `cafe24-backlog-residual.md`)과의 식별자·자원 충돌은 발견되지 않았다.

## 위험도
LOW
