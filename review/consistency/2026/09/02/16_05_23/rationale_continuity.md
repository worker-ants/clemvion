# Rationale 연속성 검토 — `spec-draft-ws-wontdo-maintenance-appping.md`

## 검토 대상
- target: `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md`
- 관련 spec: `spec/5-system/6-websocket-protocol.md` (`## Rationale` 중 `R-wontdo-rawws-rest`(2026-07-08) 및 "전송 계층 정정" 항목)
- 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md`

## 사실관계 검증 (실측)
target 의 핵심 주장을 실제 저장소에 대조했다 — 전부 일치했다.

- `spec/` 내 `system.maintenance` 등장 5곳(:28, :872, :1086, :1089, :1104) — target 표의 인용과 정확히 일치.
- `codebase/backend/src` 내 `system.maintenance` 등장 **0건** — 확인.
- §5.1 이 전송계층 heartbeat 를 Socket.IO 내장(`pingInterval` 25s/`pingTimeout` 20s)으로 확정, §5.2 가 client→server `handlePing` 만 구현 — 확인. :945 인용문 "서버가 주기적으로 app `ping` 을 push 하는 경로는 미구현 (Planned)" 원문과 정확히 일치.
- `ShutdownStateService.onApplicationShutdown(signal)`(SIGTERM 처리)가 `execution-engine/shutdown/` 에 실재 — target 이 "기각" 하는 대안(SIGTERM 배선)의 실존 후보가 맞다. `spec/5-system/4-execution-engine.md §11 Graceful Shutdown` 은 SIGTERM 이 503 즉시-거부 모델(사전 예고 없음)임을 확인해, target 의 "SIGTERM 은 사전 예고가 없어 `scheduledAt` 과 다른 사건" 이라는 근거를 뒷받침한다.
- `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 의 2026-08-31 실측 등재(개발자) 내용이 target 의 §배경 서술과 정확히 일치 — 지어낸 이력이 아니다.
- `spec/5-system/16-system-status-api.md`·`spec/2-navigation/15-system-status.md` (큐 모니터링 "시스템 상태" 화면)를 확인 — 유지보수 예고·`scheduledAt` 성격의 기능이 이 영역에도 없다. "발화 주체 부재" 주장을 뒤집을 숨은 기능이 없음을 확인.

## 발견사항

### [WARNING] 병행 tracker plan (`spec-sync-websocket-protocol-gaps.md`)의 동기 갱신이 "9개 자리 전수" 목록에서 빠져 있다
- target 위치: `## 변경안 — 9개 자리 전수` 표 전체 (target :60-75). 이 표는 스스로 "한 곳씩 고치다 놓치는 것이 이 저장소가 반복해 겪은 실패라, 편집 전에 목록을 고정한다" 고 선언하지만, grep 범위가 `spec/5-system/6-websocket-protocol.md` 한 파일로 좁혀져 있고 `plan/` 은 포함하지 않는다.
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → `R-wontdo-rawws-rest`(2026-07-08)의 "폐기 대안" 항 — *"'Planned' 로 계속 두는 안 → … 잘못된 기대(언젠가 구현)를 남긴다"*. 이 원칙이 실제로 어떻게 이행됐는지는 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 에 남아 있다 — 2026-07-08 종결 4종은 spec 본문 flip 뿐 아니라, 그 tracker plan 에도 `## 비채택 (won't-do) — 종결 2026-07-08` 섹션을 **신설**해 4개 항목을 `[x]` 로 옮기고 `R-wontdo-rawws-rest` 를 가리키는 실제 동반 갱신이 이뤄졌다(현재 그 파일 하단에 그대로 남아 있음).
- 상세: target 이 제안하는 이번 결정(2026-09-02, `system.maintenance`·app ping 2종 won't-do)도 같은 성격의 종결이다. 그런데 target 의 "9개 자리 전수" 는 spec 파일 내부만 다루고, 같은 tracker plan 파일의 다음 두 위치를 언급하지 않는다:
  - `- [ ] `system.maintenance` 시스템 이벤트 emit (§4.6 …)` 블록 (2026-08-31 실측 등재, "설계가 필요" 서술) — 여전히 미해결 backlog 처럼 `[ ]` 로 남는다.
  - `- [ ] 서버발신 application-level ping (…)` 블록 — 동일.
  - 하단 "비고" 의 *"잔여 3종(auth.token_expired·system.maintenance·server ping)만 실 backlog"* 문장도 이제 사실이 아니게 된다(잔여는 1종으로 줄어듦).
  이 tracker 를 그대로 두면 R-wontdo-rawws-rest 가 막으려던 바로 그 증상 — "Planned 로 남아 잘못된 기대를 준다" — 이 spec 쪽에서만 해소되고 plan 쪽에서는 재발한다. target 자신이 인용하는 사용자 메모리 교훈("won't-do 종결은 dangling Planned 참조 전수 동기 필수", 2026-07-08 grooming 선례)과도 정면으로 부합하는 gap 이다.
- 제안: target 의 "9개 자리 전수" 표에 10번째 행을 추가 — `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 의 두 `[ ]` 블록을 `[x] [won't-do]` 로 전환하고, 4종 선례와 동형으로 `## 비채택 (won't-do)` 섹션에 편입(또는 기존 섹션에 2종 추가)하며 `R-wontdo-maintenance-appping` 을 가리키게 한다. "비고" 의 "잔여 3종" 문장도 "잔여 1종(`auth.token_expired`)" 으로 갱신한다.

## 발견 없음 (검토했으나 이상 없음)
- **기각된 대안 재도입**: 없음. `system.maintenance`/app ping 은 2026-07-08 결정에서 "범위 밖(잔여 유지)" 으로 명시적으로 유보됐던 항목이지 기각된 적이 없다 — 이번 target 은 그 유보 상태에 대한 **최초의** 처분(신규 결정)이지, 이미 내려진 결정의 번복이 아니다.
- **합의된 원칙 위반**: 없음. 오히려 target 은 이 문서가 이미 정립한 두 원칙 — (1) "삭제 대신 본문 표기 분리"(2026-06-03), (2) "선례에 없는 근거를 소급 부여하지 않는다"(`:1104` 원문을 고치지 않고 후속 갱신 주석만 붙임, `llmCalls` 항목의 "(2026-08-14 갱신)" 패턴을 명시적으로 재사용) — 를 정확히 따른다.
- **결정의 무근거 번복**: 없음. 새 Rationale 항목(`R-wontdo-maintenance-appping`)을 정식으로 작성하며, 기존 `R-wontdo-rawws-rest` 항목 본문은 훼손하지 않고 그 아래 "잔여" 요약만 별도 하위 불릿으로 갱신하는 방식(2026-07-07/2026-07-08 sibling 불릿과 동형)을 택했다 — 이 문서의 기존 편집 관례와 일치한다.
- **암묵적 가정 충돌**: 없음. §5.1 heartbeat 확정·§11 Graceful Shutdown(SIGTERM 즉시 거부, 사전예고 없음) 등 인접 invariant 와 실측 대조 결과 target 의 주장(발화 주체 부재·SIGTERM 부적합)이 모두 사실과 부합했다.

## 요약
target 은 2026-07-08 `R-wontdo-rawws-rest` 가 명시적으로 "범위 밖" 으로 유보해 둔 잔여 항목에 대한 **신규** 처분이며, 과거에 기각된 대안을 되살리거나 원칙을 어기지 않는다. 오히려 "삭제 대신 표기 분리", "소급 근거 부여 금지" 등 이 문서가 이미 정립한 관례를 의식적으로 재사용하고, 실측(코드 0건, §5.1 확정, `onApplicationShutdown` 존재)까지 전부 대조 확인돼 근거가 견고하다. 유일한 결함은 spec 파일 내부로 좁혀진 "9개 자리 전수" 목록이 짝을 이루는 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 의 동일 항목 갱신을 빠뜨린 것으로, 이는 2026-07-08 선례 자신이 실천했던 "dangling Planned 참조 동기화" 관행에서 벗어난다.

## 위험도
LOW
