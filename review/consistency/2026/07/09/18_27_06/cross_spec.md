# Cross-Spec 일관성 검토 결과

> 대상: 작업트리 미커밋 변경분(diff) — `spec/5-system/14-external-interaction-api.md`(§5.3/R17 `conversationThread` REST 노출),
> `spec/7-channel-web-chat/1-widget-app.md`(헤더 세션 컨트롤·재로드 히스토리 복원), `spec/7-channel-web-chat/3-auth-session.md`(재로드 시퀀스).
> 검토 범위는 diff 델타 중심이며, 델타가 참조하는 인접 spec(`4-execution-engine.md`, `conventions/conversation-thread.md`,
> `6-websocket-protocol.md`, `2-sdk.md`, `5-admin-console.md`)과의 정합성을 함께 확인했다.

## 발견사항

- **[WARNING]** "이전 execution 은 TTL/idle 만료" 문구가 실행 엔진의 "waiting_for_input 무기한 보존" 불변식과 문면상 충돌
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화 (restart)" 행 — `(이전 execution 은 별도 종료 명령 없이 TTL/idle 만료)`
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §7.4 (`status='waiting_for_input' 은 무기한 보존` — 사용자 입력은 며칠 후 도착할 수도 있음), §7.5 Rationale (`waiting Execution 은 무기한 보존되므로 대화는 장시간 idle 후에도 재개 가능해야 한다. 시간 경과 자체가 만료 요인이 되면 본 결함의 원형이 재현된다`)
  - 상세: 이번 diff 로 "새 대화"(헤더 버튼·host `resetSession`)가 처음으로 **진행 중(booting/streaming/awaiting_user_message) 대화에서도** 옛 execution 을 명시 종료 없이 버릴 수 있게 됐다. 이때 옛 execution 이 "TTL/idle 만료"로 정리된다고 서술하지만, 실행 엔진 spec 은 `waiting_for_input` 상태의 Execution 을 **DB 에 무기한 보존**하며 admission gate 도 `RUNNING` 만 카운트하므로(§8, `COUNT(status='running')`) 이 orphan 은 concurrency cap 에는 걸리지 않되 **row 자체가 영구 잔존**한다. 실제로 만료되는 것은 `iext_*` 토큰의 JWT `exp`(기본 1h, EIA-AU-02/03)뿐이며, 이는 같은 파일의 기존(비변경) Rationale R6 문구("방치 세션은 **토큰** TTL/idle 만료로 정리된다", 42행 근방)가 이미 명확히 "토큰" 을 명시해온 것과 비교해도 이번 diff 문구만 "토큰" 한정어가 빠져 있다. 문면 그대로 읽으면 "실행(execution) 자체가 TTL/idle 로 자동 정리된다"는 뜻이 되어 실행 엔진의 명시적 no-TTL 불변식과 정면 충돌한다.
  - 제안: `spec/7-channel-web-chat/1-widget-app.md` 의 해당 문구를 R6 와 동일하게 "**토큰** TTL/idle 만료"로 명시하고, Execution row 자체는 실행 엔진 불변식대로 **종료되지 않고 waiting_for_input 상태로 무기한 잔존**함을 병기할 것을 권장. 반복적인 "새 대화" 사용이 orphan `waiting_for_input` Execution 을 계속 쌓이게 하는 운영 트레이드오프(자동 GC 없음)를 인지한 의도적 결정인지 `spec/7-channel-web-chat/1-widget-app.md` 의 Rationale 에 명문화하거나, `spec/5-system/4-execution-engine.md` 쪽에 이 신규 orphan 유입 경로를 backlog 로 남길지 project-planner 결정 필요.

- **[INFO]** 재로드 히스토리 복원 요약 문구가 `waiting_for_input` 한정 조건을 생략해 과잉 일반화
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "페이지 새로고침/이동" 행 — `GET /:id`(**durable conversationThread 동봉 — 5분 SSE buffer 무관·서버 재시작 무관하게 전체 히스토리 복원**, ...)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.3 구현 상태 배너("**`waiting_for_input` 상태에서는** `currentNode`/`context`도 채워진다") 및 §R17, `spec/7-channel-web-chat/3-auth-session.md` §3.1(동일 diff 에서 "`waiting_for_input` 이면 그 `context` 로 ... 시드한다"로 정확히 스코프)
  - 상세: EIA `GET /api/external/executions/:id` 는 `status ∈ {running, pending, completed, failed, cancelled}` 일 때 `context`(따라서 `conversationThread`)를 채우지 않는다(§5.3 구현 상태 배너). 즉 재로드 시점에 execution 이 마침 `waiting_for_input` 파킹 상태가 아니라 `running`(예: AI 응답 생성 중인 짧은 구간)이면 REST 단발 조회로는 히스토리가 오지 않고 SSE 5분 buffer 재생에만 의존한다. `3-auth-session.md` 는 이 조건을 정확히 "`waiting_for_input` 이면" 으로 스코프했지만, `1-widget-app.md` 요약 행은 이 한정어 없이 "buffer 무관·재시작 무관하게 전체 히스토리 복원"이라고 표현해, 같은 diff 내 두 문서 간 정밀도 비대칭이 있다.
  - 제안: `1-widget-app.md` 의 해당 행에 `3-auth-session.md`/EIA §R17 과 동일하게 "`waiting_for_input` 상태일 때" 한정어를 추가해 표현 정밀도를 맞출 것.

## 요약

이번 diff(EIA `getStatus` 의 `conversationThread` durable 노출 + 웹채팅 헤더 세션 컨트롤/재로드 히스토리 복원)는 명령 라우팅(§5.1 `end_conversation`/`cancel` 적용 범위), `ConversationTurnSource` 5값→UI role 매핑, `resetSession` SDK 커맨드, admission gate 카운팅 방식 등 인접 spec 과 대부분 정합했다. 다만 신규로 도입된 "진행 중 대화를 명시 종료 없이 버리는" 새 대화 흐름의 뒷정리 서술("TTL/idle 만료")이 실행 엔진의 "waiting_for_input 무기한 보존" 불변식과 문면상 어긋나 명확화가 필요하고, 재로드 히스토리 복원 범위 서술도 한 파일에서만 정밀 조건이 누락돼 있다. 두 건 모두 기능 자체의 파괴적 충돌이 아니라 표현 정밀도·전제 명시 수준의 이슈다.

## 위험도

MEDIUM
