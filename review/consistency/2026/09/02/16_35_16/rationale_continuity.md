# Rationale 연속성 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 발견사항

- **[INFO]** `expiresAt` payload 필드의 wire 형식(ISO8601 vs epoch)이 draft 에 명시되지 않음
  - target 위치: `## 결정` 및 `### payload 를 { message } → { message, expiresAt } 로` 섹션
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` Rationale §"요소별 절대 발생 시각·소요시간 노출 — `startedAt`/`finishedAt` 동봉 (2026-06-03)" — 이 문서는 시간 필드를 ISO8601 로 통일하는 관례를 명시적으로 정착시켰다 (`llmCalls[]`/`toolCalls[]` 의 `startedAt`/`finishedAt`).
  - 상세: target 은 `expiresAt` 을 신설하면서 형식(ISO8601 문자열 vs epoch ms 등)을 정하지 않았다. 기존 Rationale 이 이미 "라이브 WS 이벤트와 `meta.turnDebug[]` 양쪽에 ISO8601 로 통일" 이라는 선례를 세워 둔 영역이라, 형식을 어긋나게 정하면(예: epoch 숫자) 같은 문서 안에서 시간 표현이 갈리는 재발형 drift 가 된다. 기각·번복은 아니고 단순 누락.
  - 제안: spec 본문 작성 시 `expiresAt: string` (ISO8601) 으로 명시하고, 가능하면 위 Rationale 항목을 cross-ref 해 "왜 ISO8601 인가"를 새로 쓰지 않고 인용으로 정합을 잇는다.

- **[INFO]** 신설 per-socket 타이머의 분산/재시작 내성에 대한 명시적 언급 부재
  - target 위치: `## 결정` 및 `## 구현 메모` 섹션
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` Rationale R10("다중 인스턴스 분산 fan-out 미해결"), R15("전용 outbox 미신설 — 이유는 `execution_token` 이 이미 durable 추적"), R19("blanket idle-timer 대신 sweep — 이유는 delayed job 재스케줄 비용/유실 위험")
  - 상세: 이 저장소의 인접 spec 들은 "시간에 묶인 만료·회수" 류 기능을 설계할 때마다 반복적으로 **단일 인스턴스 in-memory 메커니즘의 재시작 유실·분산 불일치**를 명시적으로 저울질하고 결론을 Rationale 에 남기는 패턴을 갖고 있다(R15 의 기각 (a) "live 경로만 유지 — process 재시작 시 누락 위험", R19 의 기각 "job-based per-execution 재스케줄"). target 의 per-socket `setTimeout` 은 그 패턴이 우려하는 것과 표면적으로 유사한 형태(연결마다 개별 타이머)이지만, 실제로는 **소켓 자체가 인스턴스-로컬**이라(재시작 시 소켓도 함께 끊기고 클라이언트가 재연결해 새 타이머를 받는다) 위 두 사례와 위험 프로파일이 다르다. 다만 target 의 Rationale 은 이 차이를 스스로 설명하지 않아, 이웃 문서들의 반복된 관심사에 답하지 않은 채로 남는다 — 실제 결함이라기보다 향후 같은 관점의 재검토를 유발할 소지가 있는 서술 공백이다.
  - 제안: "본 draft 의 결정 근거" 에 한 문장 추가 — "이 타이머는 소켓 프로세스에 로컬이라 서버 재시작 시 소켓 자체가 끊기고 클라이언트가 새 handshake 로 새 타이머를 받는다 — R10/R15/R19 가 우려하는 다중 인스턴스 분산 불일치 클래스가 아니다."

- **[INFO]** 검토 컨텍스트 한계 — `spec/5-system/4-execution-engine.md`·`spec/5-system/1-auth.md`·`spec/data-flow/2-auth.md` 의 Rationale 이 예산 초과로 이 번들에서 절단되어 확인 불가
  - target 위치: 문서 전체
  - 과거 결정 출처: 위 세 파일 (번들에서 "본문 생략됨 — 컨텍스트 예산 초과" 표시)
  - 상세: target 이 다루는 access token TTL(900초)·`jwtService.verify` 는 auth 도메인과 실행 엔진 도메인에 걸쳐 있으나, 두 spec 의 Rationale 원문을 이번 회차에서 대조하지 못했다. 지금까지 확인된 `6-websocket-protocol.md`·`14-external-interaction-api.md`·`3-error-handling.md`·`1-data-model.md` Rationale 범위 내에서는 상충이 없다.
  - 제안: 별도 회차에서 `--spec` 예산을 `spec/5-system/4-execution-engine.md`·`spec/5-system/1-auth.md` 로 좁혀 재확인(특히 access token 재발급/세션 관리 관련 invariant 유무)을 권장. BLOCK 사유는 아님.

## 요약

target 은 `R-wontdo-maintenance-appping`(2026-09-02) 이 명시적으로 "제품 결정이 선행한다"며 남겨 둔 잔여 1종(`auth.token_expired`)을 정확히 그 자리에서 해소하는 후속 planner 턴이며, 그 결정이 예고한 문서(`plan/in-progress/spec-sync-websocket-protocol-gaps.md`)를 근거로 삼고 있다. 4안 중 기각한 (b)(emit만)·(c)(명령 재검증)·(d)(won't-do)는 과거 Rationale 에 없던 새로운 대안들이라 "기각된 대안의 재도입" 문제는 발생하지 않으며, 오히려 `R-wontdo-rawws-rest`(2026-07-08)가 확정한 "in-band WS 갱신 대신 REST refresh + 재연결" 원칙을 그대로 유지·강화한다(사전 통지는 그 REST 흐름을 트리거할 뿐 새 in-band 프로토콜을 열지 않는다). `왜 lead time 값을 spec 에 박는가` 항목은 `pingInterval`/`pingTimeout` 을 본문에 상수로 고정해 온 이 문서의 기존 관례를 명시적으로 인용해 정합을 잇고 있다. `status: partial` 유지, "9곳"이 아니라 spec+plan 양쪽 전수를 센 것도 이 문서 자신의 이전 실수(직전 draft 가 checker 에 걸렸던 것)를 스스로 교정한 것으로, 오히려 연속성 관리가 양호하다는 신호다. 발견된 항목은 모두 INFO 등급의 보완 제안(시간 필드 형식 미명시, 분산 내성 서술 공백, 컨텍스트 절단으로 인한 미확인 영역)이며 CRITICAL/WARNING 급 충돌은 없다.

## 위험도
LOW
