STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 리뷰 범위

이 PR 은 `execution.completed`/`failed`/`cancelled` (webhook/SSE/WS 종결 이벤트, EIA §6)
payload 에 `durationMs` 필드를 새로 채운다. 관련 타입(`chat-channel/types.ts`,
`chat-channel-adapter.md`), dispatcher 변환 로직, 신규 헬퍼(`terminal-duration.ts`), spec
문서(`14-external-interaction-api.md`)를 대조했다. 이 세션은 이미 8라운드째 `ai-review` /
`consistency-check` 를 거쳤고(`review/code/2026/08/15/{09_58_24..11_59_09}` — 프롬프트에
diff 로 포함), API 계약 관점에서 실질적인 발견은 대부분 이미 트래커
(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 등재돼 있다. 아래는
현재 diff 기준 재확인 + 신규 관점만 정리한다.

## 발견사항

- **[WARNING]** REST 재조회(`GET /api/external/executions/:id`)와 push 계열(webhook/SSE/WS)
  간 `durationMs` 응답 형식 비대칭 — 이벤트로 받으면 있는데 재조회하면 사라진다
  - 위치: `spec/5-system/14-external-interaction-api.md:575` (필드 집합 표), 관련 트래커
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:245` (W4, `09_58_24` 등재)
  - 상세: 이번 PR 이 종결 3종 push 이벤트엔 `durationMs`(`number | null`)를 싣기 시작했지만,
    같은 리소스를 REST 로 재조회하는 `ExecutionStatusDto`(`execution-status-response.dto.ts`,
    이번 diff 밖 — 미변경 확인함)에는 여전히 이 필드가 없다. 같은 execution 리소스에 대해
    접근 경로(push vs pull)에 따라 응답 스키마가 달라지는 것은 API 계약 관점에서 일관성
    결함이다 — 클라이언트가 이벤트 유실 후 재조회로 상태를 복구하는 흔한 패턴에서 필드가
    사라진다. CHANGELOG 에 "재조회 시 사라지는 비대칭" 으로 명시 고지돼 있고 트래커에도
    W4 로 등재돼 있어 **은폐된 결함은 아니다** — 다만 API 계약 리뷰 관점에서 별도 표면
    변경(`ExecutionStatusDto` + projection 확장)이 필요하므로 재확인 차원에서 다시 표기한다.
  - 제안: 트래커 항목대로 `ExecutionStatusDto`/`STATUS_PROJECTION_COLUMNS` 에 `durationMs`
    를 추가하는 후속 PR 을 우선순위에 두거나, 의도적으로 제외한다면 §5.3 에 사유를 명문화.

- **[WARNING]** `execution.cancelled` 의 `durationMs` 가 retry-turn 재진입 시 DB 영속값과
  emit 값이 어긋나는 알려진 경로 — 같은 리소스에 대해 DB 조회와 emit 이 다른 값을 준다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:206` (W1, `10_34_51`
    등재), `spec/5-system/14-external-interaction-api.md:806` ("알려진 예외 1건" 문단)
  - 상세: retry-turn 처리 중 사용자가 Stop 하면 `finalizeGuarded` 의 CANCELLED 분기가
    `COALESCE(duration_ms, :new)` 로 **`stop()` 이 커밋한 T1 값을 DB 에 보존**하는데,
    in-memory `execution.durationMs` 는 갱신되지 않아 **emit 은 재진입 시점 T2(더 큰 값)를
    싣는다**. 이는 희귀 레이스가 아니라 "retry-turn 처리 중 Stop" 이라는 일반 흐름에서
    결정적으로 재현된다 — 같은 execution 에 대해 emit 이 준 `durationMs` 와 이후 DB 를
    다시 읽었을 때의 값이 다를 수 있다는 뜻이라, 응답 스키마 일관성(관점 3)에 해당하는
    실질적 결함이다. spec §6.5 에 이미 "알려진 예외" 로 명문화돼 있고 트래커에도 등재돼
    있어 은폐된 결함은 아니며, 이번 라운드가 "DB write 경로를 또 바꾸는 변경이라 서두르면
    과잉 스코프를 반복한다" 는 근거로 의도적으로 이 PR 범위 밖으로 미룬 것도 타당하다.
  - 제안: 트래커 항목대로 CANCELLED 분기에 `.returning(['duration_ms'])` 를 추가해 emit
    직전 실제 persist 값을 되읽는 후속 PR. 회귀 테스트는 emit 값 자체를 단언할 것.

- **[INFO]** `durationMs` 가 경로에 따라 "실행 시간" 과 "대기 시간" 두 가지 의미를 담는다 —
  문서화는 됐으나 필드명이 그 구분을 드러내지 않는다
  - 위치: `spec/5-system/14-external-interaction-api.md:575`, `:806`
  - 상세: `EXECUTION_QUEUE_WAIT_TIMEOUT`·park 취소·공개 위젯 idle 회수 경로의 `durationMs`
    는 `started_at`(admission 이전, 생성 시각)부터의 **대기 경과**이지 실행 소요 시간이
    아니다(park 는 최대 24.8일). spec 이 "종결까지의 경과" 로 정의를 넓혀 문서상 계약은
    지키지만, 필드명이 `durationMs` 하나로 통일돼 있어 외부 수신자가 실행 소요 시간으로
    오독할 여지가 있다. CHANGELOG/spec 캐비엇으로 이미 고지돼 defect 는 아니다.
  - 제안: 현행 유지(문서 고지로 충분). 다음에 대대적 필드 재설계 기회가 있으면 `waitMs`
    등으로 분리하는 안을 검토.

## 확인된 양호 사항 (Critical/Warning 아님)

- **하위 호환성**: `durationMs` 는 종결 3종 payload 에 필드를 추가하는 것뿐 — 기존 필드
  제거·이름 변경·타입 좁힘 없음. dispatcher 는 배포 경계에서 재생되는 레거시(키 부재)
  이벤트도 `undefined` 로 안전 통과시키도록 회귀 테스트로 고정돼 있다
  (`chat-channel.dispatcher.spec.ts` — `'레거시(키 부재) 이벤트도 깨지지 않는다'`).
- **응답 형식(타입 계약)**: `chat-channel/types.ts` 의 `EiaCompletedEvent`/`EiaFailedEvent`/
  `EiaCancelledEvent` 세 타입이 전부 `durationMs?: number | null` 로 동일하게 갱신돼 종결
  3종 간 필드 표현이 일관된다(`types.ts:397,420,438`). `?`(optional) 유지는 "producer 는
  항상 키를 싣지만 이 타입은 consumer 계약이라 레거시 이벤트를 흡수해야 한다" 는 근거가
  타입 옆 주석에 명시돼 있어 임의 결정이 아니다.
  `spec/conventions/chat-channel-adapter.md` 의 `EiaEvent` union 도 동일하게 갱신돼
  spec-to-convention 간 drift 가 없다.
  값이 `null`(알 수 없음)과 키 부재(레거시)를 구분하는 설계는 §6.4 의 기존 `error.code`
  null 표현 관례와 일치한다.
  값 알 수 없음일 때도 payload 에 항상 `null` 키를 명시적으로 싣도록(`?? null`) 구현돼,
  JSON 직렬화 시 `undefined` 필드 소실로 "값 없음" 과 "필드 없음" 이 뒤섞이는 문제를
  방지했다.
- **버전 관리**: 새 필드 추가는 API 버전 증가 없이도 안전한 additive 변경. 별도로 포함된
  `spec/5-system/14-external-interaction-api.md` 의 `/v1/` 오탈자 정정(Re-run 경로 문서
  표기)은 실제 라우트에 `/v1/` 세그먼트가 존재한 적이 없어 순수 문서 정정이며, 실제 URL
  경로 설계에 영향 없다(과거 라운드가 별도 커밋 격리·정당성을 이미 확인).
  `execution.completed`/`failed`/`cancelled` 세 이벤트에 동일한 필드명·nullable 규약을
  적용해 버전 없이도 일관된 확장 패턴을 유지했다.
- **에러 응답/요청 검증/URL 설계/페이지네이션**: 이번 diff 범위에 새 엔드포인트·요청
  파라미터·에러 코드·목록 API 변경이 없어 해당 없음.
- **인증/인가**: 종결 이벤트 emit 경로(`cancelParkedExecution`/`markWebChatIdleTimeout`/
  `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`)의 `WHERE`/
  `AND WHERE` 상태 가드는 이번 PR 에서 그대로 보존되고 `SET`/`RETURNING` 절만 확장됐다 —
  인가 경계 변경 없음(보안 리뷰 라운드가 이미 NONE 으로 확인, 재확인 결과 일치).

## 요약

이번 변경은 종결 이벤트 3종(`completed`/`failed`/`cancelled`)에 `durationMs` 필드를
추가하는 순수 additive 변경으로, 하위 호환성·타입 일관성·null vs 키부재 표현 규약을
모두 준수하며 레거시 이벤트 흡수도 회귀 테스트로 고정돼 있어 API 계약 설계 자체는
견고하다. 다만 API 계약 관점에서 실질적인 잔여 리스크 두 가지가 있다 — (1) REST 재조회와
push 이벤트 간 `durationMs` 응답 스키마 비대칭, (2) retry-turn 재진입 시 emit 값이 DB
영속값과 어긋나는 알려진 경로. 둘 다 이 PR 이 CHANGELOG·spec·트래커에 명시적으로 고지·
등재했고 "DB write 경로를 또 바꾸는 변경이라 서두르지 않는다" 는 타당한 근거로 범위 밖에
뒀으므로 이번 PR 을 차단할 사유는 아니지만, 다음 반복에서 반드시 닫아야 할 API 계약
결함으로 재확인해 WARNING 으로 기록한다.

## 위험도

LOW
