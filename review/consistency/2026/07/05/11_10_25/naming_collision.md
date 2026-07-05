# 신규 식별자 충돌 검토 — spec-draft-g1-withdraw-ws-start-gate

## 검토 개요

target(`plan/in-progress/spec-draft-g1-withdraw-ws-start-gate.md`)은 **G1(WS `execution.start` graceful-shutdown gate)을 WITHDRAWN 처리**하고, `4-execution-engine.md §11`의 stale 서술(WS `execution.start`가 이미 503 gate 대상인 것처럼, 그리고 "Phase 2에서 WS handler 신설 예정"인 것처럼 기술된 부분)을 실제 상태(REST 전용 시작, WS 시작은 Planned-미구현)와 정합화하는 **순수 문서 정정/철회** 작업이다. 신규 requirement ID, 엔티티/DTO, API endpoint, 이벤트명, 환경변수, spec 파일 경로 중 어느 것도 새로 도입하지 않는다 — 오히려 기존 문서 간 잘못된 cross-ref를 제거·수정한다. 따라서 "신규 식별자 충돌" 관점에서는 대체로 안전하나, 다음 두 가지를 확인 관점에서 짚는다.

## 검증 사실관계 (target 근거 교차확인)

target이 인용하는 현재 spec 상태를 실제 파일에서 확인했다 — 모두 target 서술과 일치:

- `spec/5-system/6-websocket-protocol.md §4.2`(line 197-217): `execution.start`가 `_(계획·미구현 WS 경로)_`로 명시, ack도 미구현으로 명시. Rationale(line 955-958)도 "삭제 대신 계획·미구현 표기 분리"를 기록.
- `spec/3-workflow-editor/3-execution.md §8.2`(line 309-311): "실행 **시작**은 WS 명령이 아니라 REST"로 확정, 명령 표에 `execution.start` 없음(line 40 근방 `input.fromNodeId`로 부분실행 확인).
- `spec/5-system/4-execution-engine.md §11`(line 1226, 1228): 현재 WS `execution.start`를 503 gate 대상으로 나열하고 "Phase 2에서 WS handler 신설 시 동일 gate 추가 예정"이라는 stale forward-ref가 실제로 존재.
- `spec/5-system/2-api-convention.md §10.3`(line 278): `execution.start/stop/continue`를 live 명령처럼 나열, Planned 표기 없음 — target 서술과 일치.
- `plan/in-progress/execution-engine-residual-gaps.md`: G1 헤딩이 현재 `⛔ BLOCKED`(line 31)로 실재, target이 이를 WITHDRAWN으로 바꾸려는 대상과 정확히 일치.

target의 spec_impact(`4-execution-engine.md`, `2-api-convention.md`) 경로 모두 실재 파일과 일치.

## 발견사항

- **[INFO]** `[~]` 체크박스 마커·`WITHDRAWN` 상태어는 `plan-lifecycle.md`에 미정의된 신규 어휘
  - target 신규 식별자: plan 체크박스 상태 `[~]`(철회), 헤딩 배지 `🚫 WITHDRAWN (2026-07-05)`
  - 기존 사용처: `.claude/docs/plan-lifecycle.md`는 체크박스 상태로 `[ ]`/`[x]` 두 가지만 정의(line 15, 21, 68-74). "완료 이동" 게이트는 "모든 체크박스가 `[x]`"만 검사한다. `[~]` 상태는 이 문서 어디에도 없다.
  - 상세: 충돌이라기보다 **미정의 신규 관용구 도입**이다. `[~]`가 영구히 `[x]`가 되지 않는 항목이므로 plan-lifecycle의 "체크박스 all-`[x]`" 판정에서는 `execution-engine-residual-gaps.md`가 계속 in-progress로 남는다(target 의도와 일치 — G2가 pending으로 남으므로 실제로도 그래야 함). 다만 향후 다른 plan에서 "철회" 표현을 할 때 `[~]` 대신 다른 표기(예: `[x] (WITHDRAWN, 작업 안 함)`)를 쓰면 동일 개념에 서로 다른 마커가 혼재할 위험이 있다.
  - 제안: 문제 삼을 정도는 아니나, 향후 재사용 시 `plan-lifecycle.md`에 "철회/WITHDRAWN" 상태 표기 관용구를 정식 등록하는 것을 고려. 이번 단일 target 실행을 막을 필요는 없음(WARNING 아님).

- **[INFO]** `🚫` 이모지가 plan 상태 배지·spec UI 패턴(403/커서 아이콘)·완료 plan 비목표 마커 3곳에서 서로 다른 의미로 사용
  - target 신규 식별자: G1 헤딩의 `🚫 WITHDRAWN` 배지
  - 기존 사용처: `spec/2-navigation/11-error-empty-states.md:53`("🚫 차단" = 403 권한 없음 UI 상태), `spec/3-workflow-editor/2-edge.md:63`("커서 금지 아이콘(🚫)" = 자기 참조 엣지 금지 UI), `plan/complete/channel-web-chat-followups.md:31`("🚫 비목표 확정" = 스코프 제외 마커).
  - 상세: 세 사용처 모두 문서 도메인이 다르다(UI 스펙 vs 완료 plan 비목표 마커 vs 신규 target의 in-progress plan 상태 배지) — 실질적 혼선 가능성은 낮음. `channel-web-chat-followups.md`의 "🚫 비목표"와 target의 "🚫 WITHDRAWN"은 의미상 유사(둘 다 "하지 않기로 함")해 이모지 관용구 자체는 이미 프로젝트 내 선례가 있다.
  - 제안: 변경 불필요. 참고 사항으로만 기록.

## 요약

target은 신규 requirement ID·엔티티/DTO·API endpoint·이벤트명·환경변수·spec 파일 경로 중 어느 것도 새로 도입하지 않는 순수 문서 정정(stale cross-ref 제거 + G1 WITHDRAWN 마킹)이다. target이 인용한 모든 근거 파일 라인(`6-websocket-protocol.md §4.2`, `3-execution.md §8.2`, `4-execution-engine.md §11` line 1226/1228, `2-api-convention.md §10.3` line 278, `execution-engine-residual-gaps.md` G1 헤딩)을 실제 코퍼스와 대조한 결과 전부 정확했다. 유일하게 짚을 점은 plan 철회를 표기하는 `[~]` 체크박스 마커와 `WITHDRAWN` 상태어가 `plan-lifecycle.md`에 아직 정식 등록되지 않은 신규 관용구라는 것인데, 이는 충돌이라기보다 향후 확장 여지가 있는 INFO 수준 사항이며 target 진행을 막을 이유가 되지 않는다.

## 위험도

NONE
