# Cross-Spec 일관성 검토 — `spec-draft-ws-wontdo-maintenance-appping.md`

## 검토 범위 및 방법

target 은 `spec/5-system/6-websocket-protocol.md` 중 `system.maintenance` emit(§4.6)과 서버발신
app ping(§5) 을 Planned → 비채택(won't-do) 로 전환하는 spec draft. 프롬프트가 컨텍스트 예산으로
관련 spec 본문을 생략했으므로, 아래를 직접 `Read`/`grep` 하여 대조했다:

- `spec/5-system/6-websocket-protocol.md` 전체(특히 §1 안내, §4.6, §4.7 외부 표면 매핑, §5, §Rationale)
- `spec/5-system/14-external-interaction-api.md` (외부 표면 매핑 상대편, heartbeat/maintenance 키워드)
- `spec/5-system/4-execution-engine.md` §11 Graceful Shutdown, `spec/data-flow/3-execution.md` (SIGTERM/shutdown 경로 — target 이 기각한 대안의 근거)
- `spec/2-navigation/15-system-status.md`, `spec/5-system/16-system-status-api.md` (시스템 상태 화면이 WS `system.maintenance` 를 소비하는지)
- `spec/1-data-model.md`, `spec/data-flow/8-notifications.md` (`auth.token_expired`/`token_expired` 네임스페이스 중복 여부)
- `spec/5-system/11-mcp-client.md` (`R-wontdo-*` 표기 선례), spec 전역 `R-wontdo` grep (ID 충돌 여부)
- `spec/**` 전역 `system.maintenance`/"유지보수"/"점검 모드" grep
- `codebase/` 전역 `system.maintenance` grep (target 의 "0건" 실측 재검증)
- `plan/in-progress/spec-sync-websocket-protocol-gaps.md`, `spec-sync-external-interaction-api-gaps.md` (target 이 인용하는 근거 문서의 정합성)

## 발견사항

### INFO — `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 체크리스트가 target 편집 이후 갱신 대상에서 빠져 있음
- target 위치: target 문서 전체(변경안 표 9개 자리) — 이 plan 파일에 대한 언급이 없음
- 충돌 대상: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 의 "미구현 항목 (잔여 — 실 기능 backlog)" 절 — `system.maintenance`·서버발신 app ping 두 항목이 현재 미체크(`- [ ]`) 상태로 남아 있고, 그 인라인 블록이 "着수 전 판정: won't-do 로 종결하는 것이 맞는지 먼저 물을 것" 이라고 정확히 이번 결정을 예고해 두었다.
- 상세: target 이 spec 본문을 "Planned → 비채택" 으로 갱신해도, 이 tracker 파일이 그대로면 두 항목이 여전히 "실 기능 backlog" 절 아래 미체크 상태로 남아 spec(비채택 확정)과 plan tracker(진행 중 backlog) 가 서로 다른 상태를 주장하게 된다. 기존 2026-07-08 4종 won't-do 결정 때는 이 tracker 에 "## 비채택 (won't-do)" 절을 새로 만들어 `[x] **[won't-do]**` 형태로 옮겨 적는 선례가 이미 있다(현재 파일에 남아 있음).
- 제안: target 실행(구현) 시 이 plan tracker 의 두 항목도 함께 "비채택(won't-do)" 절로 이동/체크하도록 변경안 표에 10번째 자리로 추가하는 것을 권한다. spec/** 자체에는 영향 없는 사항이라 CRITICAL/WARNING 은 아니다.

## 교차 검증으로 확인된, 충돌 아님(참고)

- **요구사항 ID 충돌 없음**: `R-wontdo-maintenance-appping` 은 spec/** 전역에 기존 사용례가 없다(`grep -rn "R-wontdo" spec/`로 전수 확인). 명명 패턴(`R-wontdo-<slug>`)도 `R-wontdo-rawws-rest`(6-websocket-protocol.md)·`R-wontdo-cached-capabilities`(11-mcp-client.md)·`R-wontdo-async-fanin`(1-logic/11-merge.md) 선례와 일치.
- **데이터 모델 충돌 없음**: `auth.token_expired` (WS 이벤트, 미채택 대상 아님) 와 `Integration.status_reason` 의 `token_expired` 슬러그(`spec/1-data-model.md:300`)는 이미 spec 이 "별개 네임스페이스" 로 명시 분리해 뒀고, target 은 이 필드를 건드리지 않는다.
- **`system.maintenance` 발화 주체 부재 실측 재검증**: `codebase/` 전역 grep 0건 — target 의 실측표와 일치. `spec/5-system/4-execution-engine.md §11`·`spec/data-flow/3-execution.md` 의 SIGTERM graceful shutdown 경로 어디에도 WS emit 이 없어 target 의 "유일한 기존 후보는 `onApplicationShutdown`" 진단과 "SIGTERM 은 사전 예고가 없다" 근거가 다른 spec 서술과 모순되지 않는다(오히려 `SIGTERM_GRACE_MS` 기본 30초라는 짧은 grace 만 있고 `scheduledAt` 이 요구하는 사전 예고 개념이 없음을 뒷받침).
- **app ping 관련 API 계약 충돌 없음**: `spec/5-system/6-websocket-protocol.md §5.1` 이 이미 Socket.IO 내장 heartbeat(`pingInterval` 25s/`pingTimeout` 20s) 를 "구현 현실" 로 확정해 뒀고, target 은 이 결론을 그대로 인용할 뿐 새 계약을 만들지 않는다. `§4.7 외부 표면 매핑` 표(EIA 상대편)에도 시스템 레벨 ping/maintenance 행이 없어 EIA 쪽에 별도 반영이 필요하지 않다.
- **시스템 상태 화면과의 충돌 없음**: `spec/2-navigation/15-system-status.md`/`spec/5-system/16-system-status-api.md` 의 "시스템 상태" 화면은 BullMQ 큐 지표를 5초 REST 폴링으로 보여주는 별개 기능이며 WS `system.maintenance` 를 소비하지 않는다 — won't-do 전환이 이 화면의 기능을 축소하지 않는다.
- **line anchor 정확성**: target 이 인용한 `:28`·`:872`·`:945`·`:1086`·`:1089`·`:1104` 모두 현재 `spec/5-system/6-websocket-protocol.md` 실제 내용과 정확히 일치(오탈자·드리프트 없음).
- **§4.4/§4.6 절번호 이력과 충돌 없음**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 기록된 2026-08-31 절번호 재정리(§4.5→§4.6 등)는 앵커 위치 이동일 뿐 내용 상태(Planned)는 바꾸지 않았고, target 이 인용하는 §4.6 은 그 재정리 이후의 최종 번호와 일치한다.

## 요약

target 은 `spec/5-system/6-websocket-protocol.md` 단일 문서 내 두 항목(`system.maintenance` emit, 서버발신 app ping)의 상태 표기를 Planned → 비채택(won't-do) 으로 좁히는 draft로, 새 엔티티·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 어느 것도 신설하지 않는다. 인용한 라인 앵커는 현재 spec 본문과 정확히 일치하며, 실측(코드 0건, §5.1 heartbeat 기확정)도 관련 spec(execution-engine §11, data-flow/3-execution.md, system-status 화면) 과 상충 없이 뒷받침된다. 새로 붙이는 `R-wontdo-maintenance-appping` ID 도 기존 `R-wontdo-*` 패턴·spec 전역과 충돌하지 않는다. 유일한 참고 사항은 spec 밖(plan tracker) 의 후속 동기화 권고이며 CRITICAL/WARNING 급 충돌은 발견되지 않았다.

## 위험도

NONE
