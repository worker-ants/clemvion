# Rationale 연속성 검토 결과

> 대상: `spec/7-channel-web-chat/` (impl-done, diff-base `origin/main`, 구동 plan
> `plan/complete/webchat-session-controls-history-restore.md`). 실제 diff 는
> `spec/7-channel-web-chat/1-widget-app.md`·`2-sdk.md`·`3-auth-session.md` +
> `spec/5-system/14-external-interaction-api.md`(§5.3·R17)에 걸쳐 있다. 기능: 위젯 헤더
> 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원.

## 발견사항

- **[WARNING]** `conversation-thread.md §8.4` 의 "durable 컬럼은 park resume 만을 목적으로" 배타적 서술이 EIA R17 의 신규 소비처(공개 REST `getStatus`)로 갱신되지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 콜아웃 + `### R17`(2026-07-09 갱신분) — `getStatus` 가 `waiting_for_input` 시 `Execution.conversation_thread` durable 컬럼을 `context.conversationThread` 로 공개 REST 응답에 동봉
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` `### 8.4 Execution.conversation_thread 컬럼 채택 — durable park resume` — "이 컬럼은 park 중 in-flight thread 의 **무손실 재개만을 목적으로 하며**, 실행 이력 화면의 thread view(NodeExecution 분산 저장의 derived view)를 대체하지 않는다 — 둘은 소비처(live resume vs 사후 이력)가 분리된 별도 SoT 다."
  - 상세: `conversation-thread.md §8.4` 는 이 durable 컬럼의 소비처를 **엔진 내부 rehydration(park→재시작/인스턴스 재개) 한 곳**으로 명시적으로 한정했다("만을 목적으로"). 이번 PR 은 같은 컬럼을 **EIA 공개 REST 표면(`GET /api/external/executions/:id`)** 이라는 제3의 소비처(외부 브라우저 클라이언트의 새로고침 복구)에 노출하도록 확장한다. 기능적으로는 "실행 이력 화면 대체" 가 아니라 여전히 `waiting_for_input` in-flight 상태 한정이라 §8.4 가 명시적으로 배제한 대상("실행 이력 화면")과 겹치지는 않으며, EIA R17 자신도 "이미 SSE `waiting_for_input` 으로 공개 중인 `conversationThread` 를 REST 단발 응답에도 read-only 로 노출하는 것뿐이라 신규 민감 데이터 표면이 아니다" 라고 정당화해 뒷받침은 충분하다. 다만 **원 소유 문서(`conversation-thread.md §8.4`)의 "만을 목적으로" 문구 자체는 갱신되지 않아**, 그 문서만 읽는 향후 독자는 이 컬럼이 여전히 엔진 내부 전용이라고 오인할 수 있다 — 결정 자체의 근거는 있으나(EIA R17 에 기록) 근거가 컬럼의 원 소유 문서로 역-동기화되지 않은 상태다.
  - 제안: `conversation-thread.md §8.4` 에 한 줄 추가 — "(2026-07-09) 이 컬럼은 EIA `getStatus`(`waiting_for_input` 한정) 를 통해 공개 REST 표면에도 read-only 로 노출된다 — 소비처 3번째 항목, 근거는 [EIA §R17](../5-system/14-external-interaction-api.md#r17)" 정도로 교차 링크해 "만을 목적으로" 배타적 서술과의 문면 긴장을 해소할 것을 권장. (BLOCK 사유는 아님 — 결정 근거 자체는 이미 EIA R17 에 충분히 기록됨.)

- **[INFO]** 헤더 세션 컨트롤(새 대화/대화 종료) 신규 기능에 대응하는 전용 `## Rationale` 항목 부재
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 헤더 행, §3 신규 문단("헤더 세션 컨트롤"), §3.1 표(대화 종료/새 대화 행)
  - 관련: 같은 문서의 기존 R1~R6 패턴(예: R6 eager start)은 "기각한 대안 → 재평가 → 채택" 구조의 전용 Rationale 항목을 둔다
  - 상세: 이번 기능은 `booting` 구간을 컨트롤 노출에서 제외한 이유, "대화 종료"의 graceful(`end_conversation`) vs 범용(`cancel`) 분기 기준, SSE 선차단 + optimistic 종료 순서 등 설계 판단이 모두 §2/§3.1 표·본문 안에 산문으로 잘 설명돼 있다(내용 자체는 충실). 다만 이 판단들을 요약하는 전용 `### R7.` 항목이 없어, "왜 이렇게 설계했는가"를 찾으려면 표 셀 산문을 훑어야 한다 — 결정 자체가 무근거 번복은 아니고 이유는 충분히 기록돼 있으나, 이 문서의 기존 관례(전용 R 항목)와의 형식적 일관성 관점에서 보완 여지가 있다.
  - 제안: 필수는 아니나, 후속 편집 시 §2/§3.1 산문의 핵심 판단(부팅 구간 제외 사유, graceful/cancel 분기 기준, optimistic teardown 순서)을 요약하는 `### R7. 헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기` 항목을 Rationale 절에 추가하면 탐색성이 개선된다.

## 정합성 확인 (문제 없음, 참고용)

- **EIA `### R17` 갱신은 Rationale 연속성의 모범 사례다.** 기존 결정("`conversationThread` 는 SSE 전용 권위, `getStatus` 는 생략")을 뒤집으면서 (a) 뒤집는 배경("웹채팅 §3.1 이 이미 `getStatus` snapshot 폴백을 계약으로 두어 본 생략과 모순"), (b) 기각한 대안 2건("SSE 전용 유지 + 위젯 재조회" / "`NodeExecution.output_data` 에서 재구성")과 기각 사유, (c) 신규 채택 근거를 모두 명문화했다 — "결정의 무근거 번복" 에 해당하지 않는다.
- 직전 `--spec` 단계 cross-spec 검토(`review/consistency/2026/07/09/18_27_06/cross_spec.md`)가 지적한 두 항목 — ① "새 대화" 시 이전 execution 이 "TTL/idle 만료"된다는 표현이 실행 엔진 §7.4·§7.5 의 "`waiting_for_input` 무기한 보존" 불변식과 문면 충돌할 수 있다는 WARNING, ② 새로고침 히스토리 복원 요약 문구가 `waiting_for_input` 한정 조건 없이 과잉 일반화됐다는 INFO — 는 현재 target 텍스트에서 모두 해소돼 있다. 현재 `1-widget-app.md` §3.1 은 "이전 execution 은 명시 종료 명령을 보내지 않으므로 서버에선 `waiting_for_input` 로 잔존하며([4-execution-engine §7.4·§7.5] 무기한 보존 불변식), 위젯 측 **토큰만** TTL/idle 로 만료된다" 로 명확화했고, 새로고침 행도 "`waiting_for_input` 상태면" 한정어를 붙여 정밀화했다 — 불변식과의 충돌이 실제로는 남아있지 않다.
- `graceful end_conversation`(nodeId 필수) vs 범용 `cancel` 분기는 EIA §5.1 표(`end_conversation`: nodeId 필수, `cancel`: 전체 execution 대상)와 정합하며 새 커맨드·신규 표면을 도입하지 않는다.
- 위젯의 `turn.source`(백엔드 5값) → user/assistant 축약 매핑은 `conversation-thread.md §1.1`(backend 5값 enum)과 정합하는 방향으로 정정된 것이며, 종전 `TurnSource = "live" | "injected"` 타입이 실제 wire 형식과 어긋났던 기존 drift 를 바로잡은 것이다(하위호환을 위해 `"live"/"injected"` 는 union 에 유지) — 기각된 결정의 재도입이 아니라 drift 수정.
- "새 대화" 반복 사용 시 이전 execution 이 orphan `waiting_for_input` 상태로 무기한 누적되는 운영 트레이드오프는 구동 plan(`plan/complete/webchat-session-controls-history-restore.md` §잔여/후속 — "durable thread REST redaction·새 대화 orphan GC — 방어심화 backlog")에 명시적으로 후속 backlog 로 이연돼 있다. 침묵 누락이 아니라 의도적 defer이므로 위반으로 보지 않는다.

## 요약

핵심 diff(EIA `getStatus`/`R17` durable thread 노출 + 웹채팅 헤더 세션 컨트롤/새로고침 히스토리 복원)는 과거 Rationale 을 무단으로 뒤집거나 기각된 대안을 재도입하지 않는다. 오히려 EIA `R17` 갱신은 이전 결정을 뒤집으면서 배경·기각 대안·근거를 모두 새로 기록한 모범 사례이며, 직전 `--spec` 단계에서 지적된 실행 엔진 불변식(`waiting_for_input` 무기한 보존)과의 문면 충돌 소지도 최종 target 에서 이미 해소돼 있다. 유일한 보완 여지는 durable `conversation_thread` 컬럼의 원 소유 문서(`conversation-thread.md §8.4`)가 이번에 추가된 제3의 소비처(EIA 공개 REST 노출)를 반영하도록 갱신되지 않은 점(WARNING)과, 신규 세션 컨트롤 기능의 설계 판단이 전용 Rationale 항목 없이 본문 산문에만 흩어져 있는 점(INFO)이다. 둘 다 차단 사유는 아니다.

## 위험도
LOW
