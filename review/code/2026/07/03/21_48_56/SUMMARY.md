# Code Review 통합 보고서

## 전체 위험도
**LOW** — 06-concurrency 잔여 배치(M-3/M-6/m-3/m-5, WebSocket join/leave await+롤백, 프런트 리스너 이중 등록 방어, connect churn 가드, dismiss hysteresis)로 Critical/Warning 은 없음. plan 체크박스 미갱신(프로세스 이슈)과 사소한 유지보수성 개선 여지만 발견.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation | plan 체크박스 4건(M-3/M-6/m-3/m-5)이 구현 완료됐음에도 `- [ ] 미착수`로 stale — 프로젝트 규약(plan 체크박스=실제 상태) 위반 소지 | `plan/in-progress/refactor/06-concurrency.md:146,222,289,321` | 같은 PR/커밋에서 4개 항목을 `- [x]`로 갱신하고 완료 근거(커밋 해시·검증 결과) 기록 |
| 2 | maintainability | `handleSubscribe` 가 인가·구독한도·join 원자성·rollback 까지 8단계 이상 순차 분기를 한 함수에서 처리, cyclomatic complexity 높음. "Maximum subscriptions" 에러 응답 리터럴이 3곳에서 중복 | `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubscribe` (약 156~280행대) | 필수 아님. 여유 있을 때 `reserveSubscriptionSlot`/`joinChannelOrRollback` 같은 private helper 로 추출, `subscribeFail(error)` 헬퍼로 에러 응답 조립 통일 고려 |
| 3 | maintainability | dismiss hysteresis 타이머 값(`1000`ms)이 매직 넘버로 인라인 | `codebase/frontend/src/lib/websocket/use-execution-events.ts:2655` | `WS_WARNING_DISMISS_HYSTERESIS_MS = 1000` 같은 이름있는 상수로 추출 (사소, 선택) |
| 4 | api_contract | 신규 join 실패 ack(`success:false`)를 frontend `WsClient.subscribe()` 가 ack 콜백 없이 fire-and-forget 으로 보내 실제로 소비하지 않음 (pre-existing 패턴, 이번 diff 의 회귀 아님) | `codebase/backend/.../websocket.gateway.ts:264-278`, `codebase/frontend/.../ws-client.ts:87-89` | 필수 아님. join 실패를 UX 신호로 활용하려면 후속 작업으로 ack 콜백 추가 또는 REST fallback 즉시 트리거 연결 고려 |
| 5 | architecture | `handleSubscribe`(join 원자성) vs `handleDisconnect`(leave fire-and-forget) 의 leave 실패 처리 정책이 비대칭 — 의도된 설계 차이나 주석 없이 보면 비일관으로 오인 가능 | `websocket.gateway.ts:1441-1454`(disconnect) vs `1637-1665`(unsubscribe) | 현재 주석으로 근거 충분, 조치 불필요. 향후 두 경로가 더 벌어지면 정책 재검토 |
| 6 | security / performance | join/leave await 전환은 in-memory adapter 하에서 무해하나, 향후 Redis adapter 도입 시 latency·credential 노출 가능성 존재(이미 코드 주석으로 인지·문서화됨) | `websocket.gateway.ts` `handleSubscribe`/`handleUnsubscribe` | Redis adapter 도입 시 join 호출에 타임아웃(Promise.race) 및 `err.message` 내 credential 포함 여부 별도 점검 권장 |
| 7 | maintainability | `off-before-on` 카운트(`connectOffCalls.length===4` 등)를 그대로 assert 하는 테스트가 `bind()` 내부 구현에 결합 | `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2296,2304` | 필수 아님. 원한다면 "off 최소 1회 호출+ 최종 리스너 미잔존" 방향으로 완화해 구현 결합도 낮추기 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | join/leave 실패 로그, 롤백 동시성, unsubscribe success:true 반환 모두 검증됨 — 실질 결함 없음 |
| performance | NONE | join/leave await 오버헤드 무시 가능, frontend bind()/active 가드는 오히려 성능 개선 |
| architecture | NONE | 4개 계층 방어 로직이 책임 분리 잘 유지, handleSubscribe 응집도만 경미하게 아쉬움 |
| requirement | NONE | plan 4항목(M-3/M-6/m-3/m-5) 모두 정확히 구현·테스트 일치. plan 체크박스만 stale |
| scope | 재시도 필요 | 출력 파일 없음 |
| side_effect | 재시도 필요 | 출력 파일 없음 |
| maintainability | LOW | handleSubscribe 비대화, 에러 응답 리터럴 중복, 매직넘버, 테스트 구현 결합 |
| testing | 재시도 필요 | 출력 파일 없음 |
| documentation | LOW | plan 체크박스 stale (requirement 과 중복 지적), spec 갱신 불요 확인, 주석 품질 우수 |
| dependency | NONE | 신규 외부/내부 의존성 없음, 기존 pin 버전 내 공개 API만 사용 |
| database | NONE | DB 접근 계층 변경 없음, 해당 없음 |
| concurrency | NONE | TOCTOU 가드·원자성·리스너 dedup·churn 방지 모두 설계·구현·테스트 일치 |
| api_contract | LOW | join 실패 ack 를 frontend 가 소비하지 않는 pre-existing 갭(회귀 아님), 그 외 wire 계약 완전 하위 호환 |
| user_guide_sync | NONE | doc-sync-matrix 18개 트리거 전부 불일치, 유저 가이드 갱신 불요 |

## 발견 없는 에이전트

security, performance, architecture, requirement, dependency, database, concurrency, user_guide_sync — 실질적 결함 없음(NONE), INFO 성 확인 사항만 존재.

## 권장 조치사항

1. `plan/in-progress/refactor/06-concurrency.md` 의 M-3/M-6/m-3/m-5 체크박스 4건을 `- [x]` 로 갱신하고 완료 근거를 기록 (같은 PR/커밋 범위, requirement+documentation 중복 지적).
2. (선택, 저우선순위) `handleSubscribe` 의 롤백/한도검사 블록을 private helper 로 추출해 가독성 개선 — 즉시 조치 불필요.
3. (선택, 저우선순위) dismiss hysteresis `1000`ms 매직 넘버를 이름있는 상수로 추출.
4. scope / side_effect / testing reviewer 결과 파일이 생성되지 않아 재시도 필요 — 호출자가 재실행 여부 판단.

## 라우터 결정

- `routing=fallback-all` (router 미사용, 전체 reviewer 실행):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |

라우터 미사용 — 전체 14개 reviewer 를 fallback 으로 실행. 이 중 scope/side_effect/testing 3개는 `ran` 목록에 success 로 기록되어 있으나 출력 파일(`scope.md`, `side_effect.md`, `testing.md`)이 디스크에 존재하지 않아 통합 보고서에서 "재시도 필요"로 처리함.
