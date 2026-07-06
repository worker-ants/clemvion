# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** review payload 에 무관 커밋(`712bba43a` plan 완료 마킹)이 diff 범위에 포함됨
  - 위치: `plan/complete/spec-sync-structural-followups.md` (파일 6, 263줄 신규 파일 diff 전체)
  - 상세: 이 브랜치의 실제 작업 커밋은 `origin/main..HEAD` 기준 5개(`02c9a0827`~`14b3c9bab`)이며 전부 알림 파이프라인 PR1 범위다. `plan/complete/spec-sync-structural-followups.md` 는 그 이전 커밋 `712bba43a`("mark spec-sync-structural-followups complete", PR #835)에 속하고, `notif-firing-pipeline-65d7e1` 워크트리 작업과 무관한 별도 완료 plan 문서다. diff base(`--branch main`)가 로컬 `main` ref 기준으로 이미 머지된 stale 커밋까지 포함한 것으로 보인다(MEMORY 의 기존 교훈: "리뷰 diff base: stale 로컬 main 주의" 와 동일 패턴).
  - 제안: 실제 코드 리뷰어 관점에서는 이 파일을 스코프 위반으로 취급하지 않는다 — developer 가 이번 세션에 작성/수정한 내용이 아니라 diff-base 선택의 부작용이다. 후속 리뷰에서는 `--branch origin/main` 사용 권장(이미 MEMORY 에 기록된 교훈).

- **[NONE]** file 1~5 (핵심 구현)는 커밋 메시지·plan 목표(PR1: `notify()` 단일 적재 표면 + `emitNotificationEvent` WS emit)와 1:1 대응
  - 위치: `notifications.module.ts`, `notifications.service.ts`(+spec), `websocket.service.ts`(+spec)
  - 상세: 순환참조 회피를 위한 ModuleRef 지연 해석은 별도 목적처럼 보이지만 실제로는 `notify()`/`createMany()` 가 `WebsocketService` 를 참조하기 위해 필요해진 직접적 부작용이며, 커밋(`2039e341d`)이 원인을 명확히 밝히고 있다. scope creep 이 아니라 구현에 내재된 필수 변경.
  - 제안: 없음.

- **[NONE]** `createMany()` 기존 4개 배치 호출자에 emit 추가는 plan(PR1 목표)에 명시된 의도된 확장
  - 위치: `notifications.service.ts` `createMany()` — 저장 후 per-row `emitNew()` 호출 추가
  - 상세: `spec-sync-data-flow-8-notifications-gaps.md` PR1 설명에 "기존 4개 호출자(background/alerts/integration×2)의 `createMany` 도 emit 경유 → 실시간 전달 확보"라고 명시돼 있어, 요청 범위 내 의도된 변경.
  - 제안: 없음.

- **[NONE]** 리뷰/컨시스턴시 산출물(파일 10~21, `review/code/**`, `review/consistency/**`)은 프로젝트 표준 워크플로 산출물
  - 위치: `review/code/2026/07/06/15_05_41/*`, `review/consistency/2026/07/06/14_38_56/*`, `review/consistency/2026/07/06/15_24_54/*`
  - 상세: CLAUDE.md 규약상 impl-prep consistency-check, ai-review, impl-done 산출물은 커밋에 포함되는 것이 정상 절차(plan-lifecycle, review 산출물 위치 규약과 일치). 코드 변경 자체가 아니라 프로세스 증적이므로 "무관한 수정"에 해당하지 않는다.
  - 제안: 없음.

- **[NONE]** spec 배지 flip(Planned→구현됨)을 developer 가 직접 수정하지 않고 planner 위임 문서(`spec-update-notifications-ws-emit.md`)로 분리
  - 위치: `plan/in-progress/spec-update-notifications-ws-emit.md` (신규), `plan/in-progress/spec-sync-*-gaps.md` 체크박스만 갱신
  - 상세: developer 는 `spec/` read-only 권한이라 CLAUDE.md 규약을 정확히 따른 것 — spec 본문은 건드리지 않고 위임 노트만 작성. 오히려 모범적인 스코프 경계 준수.
  - 제안: 없음.

- **[NONE]** payload shape 축소(`timestamp` 필드 제거, 파일 5 마지막 커밋)는 리뷰 피드백에 대한 정확한 최소 대응
  - 위치: `websocket.service.ts` `emitNotificationEvent()`
  - 상세: `/consistency-check --impl-done` WARNING 조치로 spec §4.4 선언 shape 과 정확히 맞추기 위해 필드 하나만 제거한 것으로, over-engineering 이 아니라 오히려 wire 계약을 spec 밖으로 확장하지 않으려는 축소 방향의 수정.
  - 제안: 없음.

## 요약

핵심 diff(notifications/websocket 모듈 5개 파일)는 PR1 목표("notify() 단일 적재 표면 + notification.new WS emit")에서 벗어나지 않으며, ModuleRef 지연 해석 도입도 순환참조라는 실제 필요에서 파생된 필수 변경이다. 기존 `createMany` 4개 호출자에 emit을 추가한 것도 plan에 명시된 PR1 범위다. plan/review 부속 문서(파일 7~21)는 프로젝트 표준 워크플로(impl-prep/ai-review/impl-done 산출물, spec read-only 위임 노트) 산출물로 스코프 위반이 아니다. 유일하게 눈에 띄는 항목은 review payload 자체에 이 브랜치와 무관한 완료 plan 파일(파일 6, PR #835 소속)이 diff 로 섞여 들어온 것인데, 이는 developer 작업의 스코프 이탈이 아니라 diff-base(로컬 stale main) 선택의 부산물로 판단된다. 전반적으로 변경 범위는 매우 타이트하고 절제돼 있다.

## 위험도
NONE
