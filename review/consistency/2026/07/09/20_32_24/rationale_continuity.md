# Rationale 연속성 검토 결과

> 대상: `spec/7-channel-web-chat/`(impl-done, diff-base `origin/main`, 구동 plan
> `plan/complete/webchat-session-controls-history-restore.md`). 실제 diff:
> `spec/7-channel-web-chat/1-widget-app.md`·`2-sdk.md`·`3-auth-session.md` +
> `spec/5-system/14-external-interaction-api.md`(§5.3·R17) + `spec/conventions/conversation-thread.md`(§8.4).
> 기능: 위젯 헤더 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원(durable `conversationThread` 를
> `getStatus` REST 로 노출). 최신 커밋(`e3357d518`, 20:32:14)이 직전 회차 검토(20:19:59)의 WARNING 을 직접 반영.

## 발견사항

- **[INFO]** 헤더 세션 컨트롤(새 대화/대화 종료) 신규 기능에 대응하는 전용 `## Rationale` 항목 부재 (직전 회차와 동일, 미반영 유지)
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 헤더 행, §3 "헤더 세션 컨트롤" 문단, §3.1 표(대화 종료/새 대화 행)
  - 관련: 같은 문서의 기존 R1~R6 패턴(예: R6 eager start)은 "기각한 대안 → 재평가 → 채택" 구조의 전용 Rationale 항목을 둔다
  - 상세: `booting` 구간을 컨트롤 노출에서 제외한 이유, "대화 종료"의 graceful(`end_conversation`, waiting nodeId 확정) vs 범용(`cancel`) 분기 기준, SSE 선차단 + optimistic 종료 순서 등의 설계 판단은 §2/§3.1 표·본문 산문에 이미 충실히 기록돼 있어 "무근거 번복"은 아니다. 다만 이 문서의 기존 관례(전용 `### R7.` 류 항목)와 형식적으로 맞추면 탐색성이 개선된다. 결정 자체는 정당화돼 있으므로 차단 사유 아님.
  - 제안: 후속 편집에서 §2/§3.1 핵심 판단을 요약하는 `### R7. 헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기` 항목을 Rationale 절에 추가.

## 정합성 확인 (문제 없음 — 특히 직전 회차 WARNING 반영 여부 재검증)

- **직전 회차(20:19:59)의 유일한 WARNING 은 이번 커밋으로 해소됨.** 그 WARNING 은 `conversation-thread.md §8.4`(원 소유 문서)의 "이 컬럼은 park 중 in-flight thread 의 **무손실 재개만을 목적으로** 하며 … 대체하지 않는다" 라는 배타적 서술이, 같은 회차에 EIA `R17` 이 추가한 신규 소비처(공개 REST `getStatus`)를 반영하지 못했다는 지적이었다. 현재 target 은 `§8.4` 에 "**소비처 갱신 (2026-07-09)**" 단락을 추가해 — (a) 왜 확장했는지(웹채팅 새로고침 복원, buffer/재시작 무관화), (b) 신규 민감 표면이 아닌 근거(이미 SSE 로 공개 중인 데이터의 REST 재노출), (c) "park resume 전용"을 **저장 목적**의 서술로 재정의하고 소비처를 (rehydration·SSE·getStatus REST) 3가지로 명시 — 를 모두 기록했다. 직전 WARNING 이 제안한 교차 링크 방식과 실질적으로 동일한 해소다.
- `§4`(영속화 표) 및 `§4` 말미의 "이 컬럼은 … 무손실 재개만을 목적으로 하며 실행 이력 화면의 thread view 를 대체하지 않는다" 문구는 **"실행 이력 화면" 한정 배제**이지 전체 소비처 배타 선언이 아니므로, `§8.4` 신규 단락(공개 REST `getStatus`, 실행 이력 화면과 무관)과 상충하지 않는다.
- `spec/1-data-model.md` §2.x `conversation_thread` 컬럼 설명 등 이 컬럼을 참조하는 타 문서도 "durable resume 매체"로만 서술하고 소비처 배타성을 주장하지 않아 갱신 불요.
- EIA `### R17` 은 기존 결정("`conversationThread` 는 SSE 전용 권위, `getStatus` 는 생략")을 뒤집으면서 (a) 뒤집는 배경(웹채팅 §3.1 이 이미 `getStatus` snapshot 폴백을 계약으로 두어 구 R17 과 모순), (b) 기각한 대안 2건("SSE 전용 유지 + 위젯 재조회" — 순환이라 문제 미해결/ "`NodeExecution.output_data` 에서 재구성" — `conversation-thread §8.4` 가 이미 동일 사유로 기각한 대안 재인용)과 기각 사유, (c) 신규 채택 근거(보안 판단 포함)를 모두 명문화 — "결정의 무근거 번복" 에 해당하지 않는다.
- `TurnSource` 유니온을 백엔드 5-source 로 확장하면서 기존 `"live"/"injected"` 를 하위호환용으로 유지한 것은 기각된 결정의 재도입이 아니라 실제 wire 형식과의 drift 수정이다(`conversation-thread §1.1` 의 backend 5값 enum과 정합).
- `graceful end_conversation`(nodeId 필수) vs 범용 `cancel` 분기는 EIA §5.1 커맨드 표(`end_conversation`: nodeId 필수, `cancel`: 전체 execution 대상)와 정합하며 신규 커맨드·신규 표면을 도입하지 않는다.
- "새 대화" 반복 시 이전 execution 이 `waiting_for_input` 로 무기한 잔존하는 운영 트레이드오프는 구동 plan(§잔여/후속 "durable thread REST redaction·새 대화 orphan GC — 방어심화 backlog")에 명시적으로 이연돼 있다 — 침묵 누락이 아닌 의도적 defer.
- 실행 엔진 §7.4·§7.5 의 "`waiting_for_input` 무기한 보존" 불변식과 새로고침/세션 컨트롤 서술 간 문면 충돌 소지(직전 `--spec` 단계 cross-spec WARNING)도 현재 target 에서 "위젯 측 **토큰만** TTL/idle 만료"로 명확화돼 이미 해소 상태 유지.

## 요약

이번 target 은 두 축(EIA `getStatus` durable thread 노출 + 웹채팅 헤더 세션 컨트롤/새로고침 복원)에서 과거 Rationale 을 무단으로 뒤집거나 기각된 대안을 재도입하지 않는다. 핵심 결정 번복(EIA R17 의 SSE-전용→REST 동시 노출 전환)은 배경·기각 대안·근거를 모두 갖춘 모범적 Rationale 갱신이며, 직전 검토 회차(20:19:59)에서 지적된 유일한 WARNING(`conversation-thread.md §8.4` 원 소유 문서가 신규 소비처를 반영하지 못한 문제)은 이번 커밋(`e3357d518`)이 "소비처 갱신 (2026-07-09)" 단락 추가로 명시적으로 해소했다. 남은 항목은 세션 컨트롤 기능의 설계 판단을 요약하는 전용 Rationale 항목(R7) 부재뿐이며, 내용 자체는 본문에 충분히 근거가 있어 INFO 수준에 그친다.

## 위험도
NONE
