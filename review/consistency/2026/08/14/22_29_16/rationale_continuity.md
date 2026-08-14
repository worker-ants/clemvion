STATUS=success rationale_continuity review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `code` nullable 근거 정정에 §1.4/§1.5 카탈로그로의 명시적 상호참조 보강 여지
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 (`execution.failed` 페이로드), "`code` 는 `null` 일 수 있다" 콜아웃
  - 과거 결정 출처: 없음 (해당 문장은 `## Rationale` 항목이 아니라 §6.4 본문의 서술적 각주였음 — R1~R19/`R-outbound-flood`/`R-replay-unavailable` 어디에도 "sentinel 경로만 code 를 만든다" 는 별도 채택 결정이 존재하지 않았다)
  - 상세: 이번 target diff 는 "종결 `error` 를 싣는 4개 지점 중 실제로 코드를 만드는 것은 sentinel 경로(`ErrorPortFallbackError`/`ExecutionTimeLimitError`)뿐" 이라는 기존 서술을, "코드를 만드는 경로는 여럿이다(sentinel · 무조건 붙는 `WORKER_HEARTBEAT_TIMEOUT` · 취소 계열 `RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`)" 로 교체했다. `plan/in-progress/eia-terminal-payload.md` §"재판정 ③-b" 가 이 정정의 근거를 명시적으로 기록한다 — 기존 문장이 `spec/5-system/3-error-handling.md` §1.4/§1.5 가 이미 카탈로그화한 `WORKER_HEARTBEAT_TIMEOUT`/`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 존재와 사실관계가 어긋나 있었다는 것. **최종 결론("`code` 는 `null` 일 수 있다", null 을 부재 표현으로 쓴다)은 번복되지 않고 그대로 유지**되며, 바뀐 것은 그 결론을 뒷받침하는 근거 문장뿐이다 — 이는 "결정의 무근거 번복"(관점 3)이 아니라 반대로 **사실과 어긋난 근거를 실측 후 명시적으로 정정한 사례**다. `durationMs` 행 편집(§6.3/§6.4 인근 필드 집합 표) 역시 기존 "미구현 (Planned)" 상태를 뒤집지 않고 `completed` vs `cancelled` 경로 간 구현 비용 차이를 추가 설명한 것뿐이라 Rationale 연속성 관점에서 문제 없음.
  - 제안: 현 상태로 병합 가능. 선택적으로, 정정된 콜아웃에 `3-error-handling.md#14-워크플로우-실행-에러` 로의 명시적 링크를 추가하면(§6.3 필드 집합 표의 `error` 행처럼) 향후 두 문서가 다시 벌어지는 것을 grep 없이도 눈으로 확인하기 쉬워진다.

### 요약
target diff 는 `spec/5-system/14-external-interaction-api.md` §6.3/§6.4 두 곳(필드 집합 표의 `durationMs` 행, `execution.failed` 의 `code` nullable 콜아웃)에 국한된 좁은 변경이며, 둘 다 기존 결론(각각 "Planned", "code 는 null 일 수 있다")을 유지한 채 서술의 정확도만 높였다. 특히 `code` 관련 정정은 `plan/in-progress/eia-terminal-payload.md` 재판정 ③-b 에 실측 근거가 명시돼 있고, 정정된 내용은 이미 같은 spec 번들 안의 `3-error-handling.md` §1.4/§1.5 카탈로그(`WORKER_HEARTBEAT_TIMEOUT`/`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`)와 정합한다. `## Rationale` 절(R1~R19, R-outbound-flood, R-replay-unavailable)의 어느 항목도 기각·번복되지 않았고, R8 "캐시 키 스코프"·R10 단일 sink 정책·R14 401 통일 등 인접 Rationale 과의 충돌도 발견되지 않았다.

### 위험도
NONE
