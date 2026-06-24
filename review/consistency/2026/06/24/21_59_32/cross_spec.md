### 발견사항

- **[INFO]** `§7.5.2` "4종 continuation 핸들러" 서술과 신규 §7.4 bullet 의 잠재적 혼선
  - target 위치: plan draft `## 비편집` 절 — "§7.5.2 '4종 continuation 핸들러'는 WS ack 핸들러 전용" 명시
  - 충돌 대상: `spec/5-system/4-execution-engine.md §7.5.2` line 1017 — "§7.4 의 4종 continuation 핸들러(`execution.submit_form` / `click_button` / `submit_message` / `end_conversation`)"
  - 상세: draft `## 편집 4` 는 §7.4 line 894 bullet 직후에 `cancelWaitingExecution` publish 실패 surface 설명 bullet 을 추가한다. 현 §7.5.2 는 "4종 continuation 핸들러" 라 명시해 cancel 을 명시적으로 제외한 열거다. draft 가 §7.5.2 를 건드리지 않고 §7.4 line 894 에만 새 bullet 을 추가하므로 직접 모순은 없다. 그러나 향후 §7.5.2 를 읽는 독자가 "4종" 이 "cancel 제외" 결정인지 단순 열거인지 모호해질 수 있다.
  - 제안: target 의 새 §7.4 bullet 에 "§7.5.2 의 4종 WS ack 핸들러와 달리 cancel 은 REST stop() 경로" 임을 1문장 보조 설명으로 남기면 미래 독자 혼선 방지에 도움. 필수 수정은 아님.

- **[INFO]** `3-error-handling.md §1.5` intro 정정 범위와 기존 표 내용의 기존 내부 불일치 확인
  - target 위치: plan draft `## 편집 2(a)` — §1.5 intro "WebSocket ack 응답 전용이며 REST API 에는 적용되지 않는다" 정정
  - 충돌 대상: `spec/5-system/3-error-handling.md §1.5` line 97 vs line 105 — intro 는 "REST API 에는 적용되지 않는다" 고 단정하나, 같은 §1.5 표 본문에서 이미 `SERVER_SHUTTING_DOWN` 에 "HTTP 진입점은 503 으로 표기" 를 명시해 intro 와 내부 모순 상태
  - 상세: draft 가 intro 를 정정하는 목적이 정확히 이 기존 내부 불일치 해소다. draft 적용 후 intro 가 "주로 WebSocket ack 응답 전용이다. 일부 코드(SERVER_SHUTTING_DOWN·EXECUTION_ENQUEUE_FAILED)는 REST 실행 제어 진입점에서 HTTP 503 으로도 표기된다" 로 교체되면 표 본문과 정합성이 회복된다. 이 편집은 기존 충돌을 해소하는 방향이며 새 모순을 도입하지 않는다.
  - 제안: 변경 의도가 올바름. 추가 수정 불필요.

- **[INFO]** `2-api-convention.md §6` HTTP 상태 코드 표에 503 부재
  - target 위치: plan draft `## 편집 1` — §6 표에 503 행 추가
  - 충돌 대상: `spec/5-system/2-api-convention.md §6` — 현재 표에 200/201/204/400/401/403/404/409/422/429/500 만 열거, 503 행 없음. 한편 `spec/5-system/4-execution-engine.md §11` line 1190 및 `spec/5-system/3-error-handling.md §1.5` 표는 각각 503 을 구현 완료 사항으로 서술
  - 상세: API 규약 레이어에 503 사용 근거가 빠져 세 문서 간 불일치가 있었다. draft 편집은 이 누락을 채우는 additive 추가다.
  - 제안: draft 편집 적용 후 세 문서 간 503 사용 근거가 일관해짐. 충돌 없음.

- **[INFO]** 신규 에러 코드 `EXECUTION_ENQUEUE_FAILED` — `conventions/error-codes.md` 명명 원칙 적합성 확인
  - target 위치: plan draft `## 편집 2(b)` — 신규 에러 코드 `EXECUTION_ENQUEUE_FAILED` 도입
  - 충돌 대상: `spec/conventions/error-codes.md §1` — 의미 기반 명명 원칙, `UPPER_SNAKE_CASE`, `EXECUTION_*` 네임스페이스
  - 상세: `EXECUTION_ENQUEUE_FAILED` 는 "enqueue(BullMQ publish) 실패" 라는 조건을 기술하므로 의미 기반 명명 원칙을 충족한다. `UPPER_SNAKE_CASE`, `EXECUTION_*` 네임스페이스(`§7.5.2` 의 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 선례)와 일관한다. 기존 코드와 이름 충돌 없음. Historical-artifact 예외 등재도 불필요하다.
  - 제안: 추가 조치 불필요.

- **[INFO]** `exec:cont:seq` M-7 fail-fast 추가 서술과 `exec:seq` in-memory fallback 의도적 비대칭 동기화
  - target 위치: plan draft `## 편집 3` — §9.2 `exec:cont:seq:<executionId>` 행 끝 "INCR 실패 시 random fallback 없이 publish null(fail-fast, M-7)" 추가, `exec:seq` in-memory fallback 과의 의도적 비대칭 명시
  - 충돌 대상: `spec/5-system/4-execution-engine.md §9.2` line 1092 — `exec:seq:<executionId>` 는 "Redis 미가용 시 in-memory per-instance degraded fallback (분산 monotonic 미보장 — 수용된 trade-off)"
  - 상세: 두 키의 현재 서술은 비대칭을 암묵적으로 내포하나 명시적 대조가 없다. draft 추가로 비대칭이 문서화되면 spec 내부 정합성이 높아진다. 현 spec 과의 직접 모순은 없음.
  - 제안: 변경 적절. 추가 수정 불필요.

### 요약

Target draft 는 이미 머지된 PR #693 의 동작을 spec 에 반영하는 additive spec-sync 로, 새로운 크로스-스펙 모순을 도입하지 않는다. 가장 중요한 두 편집(`2-api-convention.md §6` 503 행 추가 / `3-error-handling.md §1.5` intro 정정)은 각각 현존하는 서술 누락과 내부 모순을 해소하는 방향이며, 신규 에러 코드 `EXECUTION_ENQUEUE_FAILED` 는 기존 `EXECUTION_*` 네임스페이스·명명 원칙과 일치한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 차원에서도 다른 spec 영역과의 직접 모순이 확인되지 않았다. 발견된 사항은 전부 INFO 수준(동기화 권장 또는 확인 사항)이며 draft 채택을 차단하는 CRITICAL/WARNING 이 없다.

### 위험도

NONE
