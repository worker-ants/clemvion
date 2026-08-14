STATUS=success rationale_continuity review complete — 0 CRITICAL, 1 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** §6.4 의 stale caveat 이 같은 문서 §6 필드표의 방금 정정된 결론과 모순
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 `execution.failed` 페이로드 블록 바로 아래, "> **`error` 는 현행 일부 경로에서 string 이다** — 위 객체 형태가 목표이고, 수신자는 당분간 양쪽을 방어해야 한다. 필드 집합 표의 `error` 행 참조." (라인 792-793)
  - 과거 결정 출처: 같은 문서 §6 "종결 이벤트의 필드 집합 (normative)" 표의 `error` 행 (라인 572) — 이번 diff 가 "구현됨 — **형태 불일치**" 를 "구현됨"(형태 불일치 캐비엇 삭제) 으로 바꾸고 "`failed` 는 **전 경로 object** 다 (2026-08-14, `toTerminalErrorPayload` 로 일원화 — 종전의 '일부 경로는 string' 캐비엇 해소)" 라고 명시적으로 결론지었다.
  - 상세: 같은 diff 가 §6 필드표의 결론은 "전 경로 object 로 통일됨" 으로 정정했는데, 20여 줄 아래 §6.4 의 blockquote 는 갱신되지 않은 채 "현행 일부 경로에서 string" · "당분간 양쪽을 방어해야 한다" 를 그대로 남겨 **같은 문서 안에서 서로 반대되는 두 문장**이 공존한다. `terminal-error-payload.ts` 의 실제 구현(레거시 string 은 배포 경계에 남을 수 있는 값에 대한 **방어적 fallback**이지 "일부 경로가 아직 string 을 emit 한다" 는 뜻이 아님)과도 미묘하게 다른 의미로 읽힌다. 이 자체가 `## Rationale` 항목을 직접 뒤집는 것은 아니지만(두 문장 다 `## Rationale` 밖의 normative 서술), 방치하면 다음 사람이 stale 문장(§6.4)을 근거로 "아직 string 경로가 있다" 고 오판해 이미 정리된 back-compat 스캐폴딩(chat-channel dispatcher 의 `'INTERNAL_ERROR'` fabrication, 프런트 `{error?: string}` 캐스팅 등, 이번 PR 이 방금 걷어낸 것들)을 근거 없이 되살릴 위험이 있다 — "결정의 무근거 번복"(관점 3)을 유발하는 씨앗이 된다. 참고: 같은 이슈가 병행 중인 코드리뷰 세션(`review/code/2026/08/14/23_17_57/_prompts/scope.md`)에서도 documentation 관점으로 독립 포착됨 — 두 세션이 서로 다른 관점에서 동일 라인을 지목한 것은 신호가 강함을 뒷받침.
  - 제안: §6.4 라인 792-793 blockquote 를 §6 필드표와 정합하도록 정정 — 예: "`failed` 의 `error` 는 이제 전 경로 object 다(`toTerminalErrorPayload`, 2026-08-14). 배포 경계에서 재생되는 레거시 이벤트에 한해 dispatcher/프런트가 string 을 방어적으로 흡수한다" 로 캐비엇의 성격을 "현재진행형 미구현" 에서 "레거시 흡수 전용" 으로 바꿔 §6 필드표·`terminal-error-payload.ts`·CHANGELOG 항목과 동일한 결론을 말하게 한다.

- **[INFO]** `code` nullable 근거 정정은 사실 검증 통과 — Rationale 번복 아님 (직전 라운드 판정 유지 확인)
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4, "`code` 는 `null` 일 수 있다" 콜아웃 (라인 782-790)
  - 과거 결정 출처: 없음 — 해당 문장은 `## Rationale` 항목이 아니라 §6.4 본문의 서술적 각주. 직전 라운드(`22_29_16` rationale_continuity)가 이미 "결론은 번복되지 않고 근거만 정정" 으로 판정.
  - 상세: 이번 라운드에서 `plan/in-progress/eia-terminal-payload.md` "재판정 ③-b" 의 근거(`WORKER_HEARTBEAT_TIMEOUT` 무조건 부여, `RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 취소 계열 코드 존재)를 코드베이스에서 직접 재검증(`ai-conversation-helpers.ts`/`ai-turn-orchestrator.service.ts` grep)했고, 인용된 코드들이 실제로 존재함을 확인했다 — 정정 근거가 지어낸 것이 아니라 실측에 기반한다. "`code` 는 `null` 일 수 있다" 는 최종 결론 자체는 여전히 유지되어 R8·R10·R14 등 인접 `## Rationale` 항목과도 충돌하지 않는다.
  - 제안: 현 상태로 문제 없음. 위 WARNING 정리 시 같은 편집 단위로 §6.4 caveat 도 함께 손보면 두 번 diff 를 만들지 않아도 된다.

### 요약
이번 target diff(`spec/5-system/14-external-interaction-api.md` §6 필드표·§6.4, + 대응 구현 `terminal-error-payload.ts`/`execution-engine.service.ts`/`retry-turn.service.ts`/chat-channel dispatcher·types/프런트 `use-execution-events.ts`)는 `## Rationale` 의 어느 항목(R1~R19, R-outbound-flood, R-replay-unavailable)도 기각·재도입하거나 번복하지 않았다. `code`/`nodeId` 명시적 `null` 원칙([API 규약 §5.4](spec/5-system/2-api-convention.md) 아래 근거)·CCH-ERR-04 unknown-code fallback·R10 단일 sink/facade 원칙·"삭제된 약속"(finalNodeId/finalPort) 모두 준수하며, 오히려 §6.4 "code nullable" 근거의 사실관계 오류를 실측 후 명시적으로 정정(plan "재판정 ③-b")한 모범 사례다. 유일한 흠은 §6 필드표(라인 572)가 "failed 는 전 경로 object" 로 결론을 갱신했는데 바로 아래 §6.4 블록쿼트(라인 792-793)가 "일부 경로는 아직 string" 이라는 이전 상태를 그대로 남겨 같은 문서 내에서 자기모순을 일으키는 것 — Rationale 자체를 뒤집지는 않지만 향후 판단자가 stale 문장을 근거로 이미 정리된 back-compat 스캐폴딩을 무근거로 되살릴 소지가 있어 WARNING 으로 등재한다.

### 위험도
LOW
