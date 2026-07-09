# Rationale 연속성 검토 결과

> 대상: `spec/7-channel-web-chat/`(impl-done, diff-base `origin/main`, 구동 plan
> `plan/complete/webchat-session-controls-history-restore.md`). 실제 diff 범위(origin/main..HEAD):
> `spec/7-channel-web-chat/1-widget-app.md`·`2-sdk.md`·`3-auth-session.md` +
> `spec/5-system/14-external-interaction-api.md`(§5.3·R17) + `spec/conventions/conversation-thread.md`(§8.4).
> 기능: 위젯 헤더 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원(durable `conversationThread` 를
> `getStatus` REST 로 노출). 본 회차는 직전 두 회차(20:19:59 WARNING 1건 → 20:32:24 로 해소, INFO 1건 잔존)
> 이후 최신 커밋(`382e3a89d`, 20:46:11 — "consistency R2 반영: 잔여/후속 3건 spec Planned 명문화 + dangling
> §4 정정")까지의 누적 target 을 재검증한다.

## 발견사항

- **[INFO]** 헤더 세션 컨트롤(새 대화/대화 종료) 신규 기능에 대응하는 전용 `## Rationale` 항목 부재 (2회차 연속 동일, 미반영 유지)
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 헤더 행, §3 "헤더 세션 컨트롤" 문단, §3.1 표(대화 종료/새 대화 행)
  - 관련: 같은 문서의 기존 R1~R6 패턴(예: R6 eager start)은 "기각한 대안 → 재평가 → 채택" 구조의 전용 Rationale 항목을 둔다
  - 상세: `booting` 구간을 컨트롤 노출에서 제외한 이유, "대화 종료"의 graceful(`end_conversation`, waiting nodeId 확정) vs 범용(`cancel`) 분기 기준, SSE 선차단 + optimistic 종료 순서, 그리고 이번 회차에 추가된 두 "알려진 제약(Planned)" 캡션(복원 thread presentation shape 미매핑·host `resetSession`-during-booting 중복 webhook edge)까지 — 설계 판단은 §2/§3.1 표·본문 산문에 이미 충실히 기록돼 있어 "무근거 번복"에 해당하지 않는다. 다만 이 문서의 기존 관례(전용 `### R7.` 류 항목)와 형식적으로 맞추면 향후 독자가 "왜 이렇게 설계했는가"를 표 셀 산문 대신 Rationale 절에서 바로 찾을 수 있다. 결정 자체는 정당화돼 있으므로 차단 사유 아님.
  - 제안: 후속 편집에서 §2/§3.1 핵심 판단(booting 게이팅 사유, graceful/cancel 분기 기준, optimistic teardown 순서, 두 Planned 캡션의 배경)을 요약하는 `### R7. 헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기` 항목을 Rationale 절에 추가.

## 정합성 확인 (문제 없음 — 직전 회차 이후 신규 diff 포함 재검증)

- **최신 커밋(`382e3a89d`)의 diff 는 순수 명문화 추가**(plan_coherence WARNING 대응)일 뿐 새 결정을 도입하지 않는다 — (a) §2 presentation 행에 "복원 thread presentation shape 는 위젯 렌더러가 graceful 하게 무시" 캡션 추가, (b) §3.1 새 대화 행에 "host `resetSession`-during-booting 은 in-flight `start()` 와 겹쳐 중복 webhook 가능(pre-existing) — host-API 가드는 backlog" 캡션 추가, (c) §2 메시지 리스트의 dangling `(§4)` self-reference 를 `conversation-thread §9.5` 로 정정. 셋 다 기존에 이미 산문으로 암시돼 있던 pre-existing 한계를 명시적으로 문서화한 것이라 신규 Rationale 위반·번복이 아니다.
- **직전 회차(20:19:59)의 유일한 WARNING**(`conversation-thread.md §8.4` 원 소유 문서가 EIA `R17` 신규 소비처(공개 REST `getStatus`)를 반영 못함)은 커밋 `e3357d518` 로 이미 해소됐고 이번 재검증에서도 §8.4 "소비처 갱신 (2026-07-09)" 단락이 유지돼 있음을 재확인했다.
- **EIA `### R17`** 은 기존 결정("`conversationThread` 는 SSE 전용 권위, `getStatus` 는 생략")을 뒤집으면서 (a) 뒤집는 배경(웹채팅 §3.1 이 이미 `getStatus` snapshot 폴백을 계약으로 둬 구 R17 과 모순), (b) 기각한 대안 2건("SSE 전용 유지 + 재조회" — 순환 / "`NodeExecution.output_data` 에서 재구성" — `conversation-thread §8.4` 가 이미 동일 사유로 기각한 대안 재인용)과 기각 사유, (c) 신규 채택 근거(민감 표면 아님 판단 포함)를 모두 명문화 — "결정의 무근거 번복"에 해당하지 않는 모범 사례로 재확인.
- **graceful `end_conversation`(nodeId 필수) vs 범용 `cancel` 분기**를 EIA §5.1 커맨드 표·EIA-IN-02 로 직접 재대조: `end_conversation | nodeId, reason? | AI Agent/Information Extractor(multi turn)`, `cancel` 은 별도 REST(`POST /api/external/executions/:id/cancel`)로 이미 정의된 기존 커맨드 두 개다. 위젯이 상태에 따라 둘 중 하나를 선택하는 것뿐이며 신규 커맨드·신규 EIA 표면을 도입하지 않는다 — `0-architecture §R2`("EIA·신규 트리거 유형·facade 미신설")·EIA `§R10`(단일 sink 정책)과 정합.
- **"새 대화" 시 이전 execution 이 `waiting_for_input` 로 무기한 잔존**한다는 §3.1 서술을 `spec/5-system/4-execution-engine.md` L929("`status='waiting_for_input'` 은 무기한 보존")와 직접 원문 대조 — 정확히 일치. 직전 `--spec` 단계에서 지적됐던 문면 충돌 소지(TTL 표현 모호)는 "위젯 측 **토큰만** TTL/idle 로 만료"로 명확히 분리돼 불변식과 충돌하지 않는다.
- `TurnSource` 위젯측 5값 확장은 `conversation-thread §1.1` 백엔드 5값 enum 과 값·매핑이 정확히 일치하며, 기각된 결정의 재도입이 아니라 실제 wire 형식과의 drift 수정이다(하위호환용 `"live"/"injected"` 는 union 에 유지).
- `spec/7-channel-web-chat/1-widget-app.md` 원본(`origin/main`)의 헤더 행("현재 닫기(✕)만 렌더")은 "아바타·뒤로 버튼은 차기 phase"만 명시적으로 유예했을 뿐, 세션 컨트롤(새 대화/종료) 자체를 검토 후 기각했다는 Rationale 기술은 없다 — 이번 추가는 기각된 대안의 재도입이 아니라 당시 unspecified 였던 여백을 채운 것.
- "새 대화" 반복 시 이전 execution 이 orphan `waiting_for_input` 으로 무기한 누적되는 운영 트레이드오프, presentation shape 미매핑, host `resetSession` booting 중복 webhook 엣지 — 세 잔여 항목 모두 구동 plan(`plan/complete/webchat-session-controls-history-restore.md` §잔여/후속)에서 spec 본문 "알려진 제약(Planned)" 위치로 정확히 이관 완료됐음을 대조 확인(침묵 누락이 아닌 추적 가능한 의도적 defer).

## 요약

이번 target(위젯 헤더 세션 컨트롤 + `getStatus` REST 새로고침 히스토리 복원, 최신 커밋 `382e3a89d` 포함)은 과거 Rationale 을 무단으로 뒤집거나 기각된 대안을 재도입하지 않는다. 핵심 결정 번복(EIA R17 의 SSE-전용→REST 동시 노출 전환)은 배경·기각 대안·근거를 모두 갖춘 모범적 Rationale 갱신이며, `end_conversation`/`cancel` 분기와 "새 대화" 시 이전 execution `waiting_for_input` 무기한 보존 서술은 EIA §5.1·실행 엔진 §7.4/§7.5 원문과 대조해도 정확히 일치한다. 최신 커밋은 두 개의 pre-existing 알려진 제약을 "Planned" 로 명문화하고 dangling 참조를 정정한 순수 문서화 개선으로, 신규 Rationale 충돌을 만들지 않는다. 유일하게 남은 항목은 2회차 연속 동일하게 지적된 INFO — 세션 컨트롤 기능의 설계 판단이 전용 Rationale 항목(R7) 없이 본문 표 산문에만 흩어져 있는 점(내용 자체는 이미 충분히 근거화돼 있어 탐색성 개선 제안에 그침)이다.

## 위험도
NONE
