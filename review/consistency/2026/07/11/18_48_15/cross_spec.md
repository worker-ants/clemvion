# Cross-Spec 일관성 검토 결과 — `spec/7-channel-web-chat/`

검토 모드: 구현 완료 후 검토 (--impl-done). target = `spec/7-channel-web-chat/*.md` 전 영역
(0-architecture / 1-widget-app / 2-sdk / 3-auth-session / 4-security / 5-admin-console). 이번 diff 범위(origin/main 대비)는
`1-widget-app.md` §3.1 "토큰 만료/서버 타임아웃" 행 1건 + 코드(single-flight coalesce, best-effort cancel 구현, §R9)이며,
나머지 target 본문은 직전 impl-prep 교차검토(`review/consistency/2026/07/11/17_54_21/cross_spec.md`) 이후 무변경이다.
교차 검증 대상: `spec/5-system/14-external-interaction-api.md`(EIA) §5.1/§5.3/§5.4/§5.5/§5.6/§7.5.1/§8.5, EIA-IN-02/
EIA-IN-12/EIA-AU-04/EIA-NF-03/EIA-RL-07, `spec/5-system/4-execution-engine.md` §1.1/§7.4/§7.5, `spec/5-system/
12-webhook.md` §3.1/§3.2, `spec/1-data-model.md` §2.2 Workspace.settings, `spec/conventions/conversation-thread.md`,
`spec/conventions/interaction-type-registry.md`.

## 발견사항

없음.

이번 diff(1건, §3.1 상태코드 정밀화)는 직전 impl-prep 교차검토에서 지적된 WARNING(W1: "토큰 만료/서버 타임아웃" 행이
`410 Gone` 으로 뭉뚱그려져 있어 EIA §5.3/§5.5/EIA-IN-12 의 정밀한 401 vs 200+cancelled vs 410 구분과 어긋남)을 그대로
반영해 수정한 것이며, 현재 문구("per_execution 만료(재로드 시 refresh 실패)→`401`; idle-wait backstop 회수(EIA-RL-07)
후 재로드 상태조회→`200 status:cancelled`. `410 Gone` 은 *명령*(interact/cancel) 응답 전용이라 상태조회엔 안 나타남")는
EIA §5.3·§5.5·EIA-IN-12 및 동일 target 문서인 `3-auth-session.md` §3.1 과 정확히 일치한다.

이번 PR 이 새로 도입한 §R9 서버측 execution 잔존 결정(A: booting 중 host `resetSession` single-flight coalesce, B-1:
확립 세션 "새 대화" 시 이전 execution best-effort `cancel`)에 관해서도 재검증했으나, target 본문 자체는 직전
impl-prep 교차검토 시점 이후 변경이 없고 다음 대조 전부 정합했다:

- `cancel` 호출 표면 — target 이 참조하는 `EIA §5.4`(`POST /api/external/executions/:id/cancel`, `202` +
  `status: cancelled|running`)와 실제 EIA 스펙 §5.4 본문이 정확히 일치.
- `end_conversation`/`cancel` 두 명령의 구분 — target(§R7)이 서술하는 "특정 nodeId 의 AI multi-turn 대기만 graceful
  종료 vs execution 전체 중단"은 EIA-IN-02 본문("`cancel` 은 실행 중단 개념만 공유하며… 실제 처리는 REST cancel")과 정합.
  `retry_last_turn` 미지원 서술도 EIA-IN-02("`retry_last_turn` 미포함 — 내부 UI 한정")와 일치.
- `409 STATE_MISMATCH` 사용 문맥(best-effort 종료/재시작 명령이 이미 전이된 상태와 경합) — EIA §5.6("동일 execution·동일
  노드 두 inbound 명령 동시 도착 시 second-arrival 409")·§5.1 에러표와 정합.
- idle-wait backstop(EIA-RL-07) 서술 — target 이 인용하는 "토큰 영구 만료 + grace 후 `cancelled`
  (`error.code=WEBCHAT_IDLE_TIMEOUT`)"·"[4-execution-engine §7.4·§7.5] 무기한 보존 불변식이 §1.1 에 예약한 '타임아웃'
  사유의 구현" 서술은 실제 EIA §9.3 R19·execution-engine §1.1(전이표)·§7.4(`waiting_for_input` 무기한 보존 + 타임아웃
  사유 예약분)와 정확히 대응.
- `5-admin-console.md` §6 "새 세션" 버튼 서술(`wc:command resetSession` 전송)이 `2-sdk.md` §3 resetSession 정의·
  `1-widget-app.md` §R9 coalesce 서술과 상충 없이 일관(콘솔 문서는 세부 취소 시맨틱을 §2-sdk/§1-widget-app 에 위임).
- 타 target 문서(`0-architecture.md`/`2-sdk.md`/`3-auth-session.md`/`4-security.md`)에는 이번 PR 이 다루는 잔존
  execution 처리와 상충하는 서술("새 대화는 항상 즉시 새 execution" 류의 outdated 단정 등)이 없음을 grep 으로 확인.

## 요약

이번 diff 는 직전 impl-prep 교차검토가 지적한 WARNING 1건(§3.1 상태코드 표기 부정확)을 정확히 그 지적대로 수정했을 뿐이며,
새로 도입된 §R9(single-flight coalesce + best-effort cancel) 관련 서술은 이미 이전 커밋(`620151e80`)에서 spec 본문에
반영돼 직전 교차검토 시점에 함께 검증된 상태였다. 이번 impl-done 재검토에서 EIA(§5.1/§5.3/§5.4/§5.5/§5.6/§7.5.1)·
execution-engine(§1.1/§7.4/§7.5)·webhook·data-model·admin-console 등 인접 영역과 재대조했으나 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 새로운 모순을 발견하지 못했다.

## 위험도

NONE
