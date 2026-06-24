## 발견사항

### [INFO] data-flow/15-external-interaction.md §1.2 — getStatus 반환 범위 기술 구식
- target 위치: `interaction.service.ts` `getStatus()` — `waiting_for_input` 시 `currentNode`/`context` 채움
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/spec/data-flow/15-external-interaction.md` 123~124행
- 상세: 해당 행은 `GET /:id` 가 `execution row 의 status/result/error **만** 반환하는 SSE 보정용 read-only 경로` 라고 기술한다. 구현은 이제 `waiting_for_input` 상태에서 `NodeExecution.outputData` 로부터 `currentNode`/`context` 도 함께 채워 반환한다. EIA spec §5.3 은 이미 최신 동작을 기술하고 있으나 data-flow 요약행만 "만" 표현이 남아 있다.
- 제안: `spec/data-flow/15-external-interaction.md` §1.2 단발 상태 조회 행에서 "만 반환" 을 `waiting_for_input` 시 `currentNode`/`context` 도 동봉된다는 설명으로 보완한다. EIA spec §5.3 의 구현 상태 note 가 SoT 이므로 cross-link 로 대체해도 무방.

### [INFO] spec/7-channel-web-chat/1-widget-app.md — race 보정(seedWaitingFromStatus + openStream "0") 미기술
- target 위치: `use-widget.ts` `seedWaitingFromStatus` + `openStream(session, "0")` 추가 (start 및 applyConfig 복원 경로 둘 다)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/spec/7-channel-web-chat/1-widget-app.md` §3 상태기계 / §3.1
- 상세: 위젯 SPA spec `1-widget-app.md` 은 `spec/7-channel-web-chat/5-admin-console.md` §5(미리보기 섹션, 179~184행)에서만 race 보정(getStatus 시드 + `lastEventId=0` replay)을 기술한다. `1-widget-app.md` §3 상태기계에는 start 직후 / 세션 복원 직후 두 경로 모두에서 `getStatus` 시드 → `openStream("0")` 순서가 명시되어 있지 않다. 두 spec 파일이 직접 모순하지는 않으나 `1-widget-app.md` 의 상태기계 기술이 race 보정 동작을 침묵하고 있어 독자가 `start` 완료 후 곧바로 SSE 가 열린다고 오해할 수 있다.
- 제안: `1-widget-app.md` §3 상태기계(또는 §R6) 에 "start 완료 후 getStatus 1회 시드 → `openStream(lastEventId=0)`" 순서를 짧게 추가한다. `5-admin-console.md §5` 와의 내용 중복은 cross-link 로 최소화.

### [INFO] spec/5-system/14-external-interaction-api.md §10 — external-interaction.module 의 NodeExecution 의존 미기재
- target 위치: `external-interaction.module.ts` diff — `TypeOrmModule.forFeature([..., NodeExecution])` 추가, JSDoc 의존성 목록 갱신
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/spec/5-system/14-external-interaction-api.md` §10 구현 파일 구조
- 상세: §10 의 모듈 파일 목록 주석(모듈 prefix·의존성 etc.)은 코드 설명 수준의 나열로, NodeExecution 엔티티를 `external-interaction.module` 이 직접 소유(TypeORM forFeature)하게 된 사실이 spec 텍스트에 명시되지 않는다. 실제 모순이 아니라 동기화 누락이며, spec §10 은 파일 구조 설명이라 TypeORM 의존 목록까지 강제하지 않는다.
- 제안: 선택적 동기화 — `interaction.service.ts` 항목 주석에 "(NodeExecution 직접 조회 — getStatus waiting 표면 복원)" 정도를 추가해 역할 맥락을 명시한다.

---

## 요약

구현 diff 는 EIA spec 이 기술하는 세 가지 변경(getStatus `waiting_for_input` 표면 복원, EIA-IN-07 `?lastEventId=0` race 보정, NodeExecution 복합 인덱스 @Index 데코레이터 선언)과 완전히 정합한다. 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 충돌·계층 책임 충돌은 없다. 발견된 세 항목은 모두 INFO 등급의 동기화 누락으로, `data-flow/15-external-interaction.md` 의 "만 반환" 문구가 EIA §5.3 최신 기술과 어긋나는 점이 가장 명시적인 drift 이고, `1-widget-app.md` 상태기계에 race 보정 흐름이 미기술된 점이 독자 혼동 위험의 INFO 로 뒤를 잇는다.

## 위험도
LOW
