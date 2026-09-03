# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음, WARNING 2건(테스트 순서 계약 미검증, plan 문서 내 라벨 충돌). 강제(router_safety) reviewer 7명 전원 결과 확보 확인됨(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | "이미 만료된 exp로 연결하면 즉시 끊는다" 테스트가 "통지(notice)가 종료(cutoff)보다 먼저 발생한다"는 순서 계약을 검증하지 않는다. `exp`가 완전히 과거라 두 타이머 지연이 모두 `Math.max(0,…)`로 0에 클램프되는 tie 상태에서는 Node가 **등록 순서**로 실행 순서를 결정하는데, 현재 테스트는 emit·disconnect가 각각 호출됐다는 사실만 단언하고 순서는 단언하지 않는다. 두 `setTimeout` 블록의 등록 순서를 통째로 교환하는 뮤테이션을 필터 없는 전체 스위트(72개, 3회 반복)로 실행해 **생존**을 실측 확인했다. | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:859-874` (테스트); `codebase/backend/src/modules/websocket/websocket.gateway.ts:203-220` (notice/cutoff 타이머 생성부) | `emit`·`disconnect` mock 호출을 공유 배열에 push하거나 `mock.invocationCallOrder`를 비교해 `['emit','disconnect']` 순서를 직접 단언하는 코드를 추가한다. |
| 2 | documentation | plan 트래커 안에서 `리뷰 2R W1` 라벨이 서로 다른 두 리뷰 사이클(원 PR #1266의 5라운드 리뷰 vs "이월 INFO 5건" 서브사이클 2라운드)의 서로 무관한 두 발견(성능 지터 vs 셧다운 중 콜백 미실행)에 동일 문자열로 중복 사용되어, 같은 문서 안에서 11줄 간격으로 다른 대상을 가리킨다. 직전 라운드가 커밋 메시지 수준에서 지적한 것과 같은 병(라벨 재사용→`git log -S` 추적 혼동)의 재발이며, 이번엔 plan 본문 안에서 더 좁은 간격으로 발생했다. | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:158` (`리뷰 2R W1`, performance/지터) vs `:169` (`리뷰 2R W1`, side_effect/셧다운 콜백 미실행) | 서브사이클 라운드 표기를 원 PR 5라운드와 구분되는 별도 라벨(예: `서브 1R`/`서브 2R` 또는 세션 타임스탬프 `11_57_58`/`12_16_24` 자체)로 정정하고, plan 상단에 두 라벨 체계가 다르다는 범례를 추가한다. `12_16_24` 서브라운드는 `11_57_58`처럼 SUMMARY.md 마크다운 링크도 없어 함께 보강 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / concurrency / api_contract | `setTimeout(...).unref()` 도입으로 그레이스풀 셧다운 중 이벤트 루프가 비었다고 판단되면 대기 중이던 `notice`/`cutoff` 콜백(사전 통지·강제 종료)이 발화 전에 프로세스가 먼저 종료될 수 있다. 정상 종료 시 소켓 자체가 소멸하므로 인가 우회는 아니며, 4개 reviewer가 독립적으로 확인한 결과 `plan` 문서에 이미 신규 이월 항목(재개 조건 포함)으로 등재돼 은폐되지 않았다. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:224-225` (`notice.unref(); cutoff.unref();`); 추적: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:169-180` | 조치 불요 — plan 항목 유지, 실제 배포 런북 문서에도 반영할 것(문서 INFO#3과 연계). |
| 2 | security / concurrency | `armExpiryTimers` 선제 `clearExpiryTimers(client.id)`는 `client.id` 문자열만으로 타이머 쌍을 식별한다. 현재 Socket.IO는 연결마다 새 id를 발급해 도달 불가하지만, 향후 `connectionStateRecovery`를 켜 같은 id가 재사용되면 지연된 구 소켓의 `handleDisconnect`가 방금 재연결로 새로 무장된 타이머 쌍을 잘못 지울 잠재력이 있다(재연결 소켓이 만료 강제종료 없이 무기한 생존). | `codebase/backend/src/modules/websocket/websocket.gateway.ts:183` | 조치 불요(현재 도달 불가). `connectionStateRecovery` 도입 시 세대 토큰/소켓 참조 동일성 가드 추가 검토. |
| 3 | requirement | 핵심 기능(§1.2 만료 60초 전 1회 emit 후 `exp` 도달 시 disconnect)이 spec `6-websocket-protocol.md` §1.2·§4.6과 line-level 일치. `npx jest websocket.gateway.spec.ts` 72/72 통과를 독립 재현하고, 선제 해제 호출(W3 회귀 수정)을 직접 뮤테이션(주석 처리)해 2개 테스트가 RED로 떨어짐을 확인 — plan/RESOLUTION 주장이 vacuous 아님을 검증. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers`/`clearExpiryTimers`/`handleDisconnect` | 없음(확인 목적 기록). |
| 4 | requirement | JSDoc 오귀속(1R 지적)이 2R 수정에서 실제로 복원됐음을 재확인 — 새 심볼과 대상 사이 빈 줄·오귀속 없음. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:161-176,230-234`; `websocket-events.types.ts:287-305` | 없음. |
| 5 | requirement | 남은 미해결 plan 항목(타이머 지터·unref 셧다운 트레이드오프·배포 전환 창)은 TODO성 누락이 아니라 근거·재개 신호가 명시된 의도적 유예. | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:159-183` | 없음. |
| 6 | scope | review 산출물(33개 중 29개)이 실제 코드 diff(4개 파일, +207/-23) 대비 압도적으로 큰 비중이나, 저장소 관례(`review/code/**`)와 developer SKILL의 상시 승인된 리뷰 의무에 부합하는 정상 산출물. | `review/code/2026/09/03/{11_57_58,12_16_24}/**` | 조치 불요. |
| 7 | scope | `websocket.gateway.ts` import 재정렬은 `MSG_AUTH_TOKEN_EXPIRING` 추가에 종속된 최소 포맷 변경. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:23-28` | 조치 불요. |
| 8 | side_effect / api_contract | `MSG_AUTH_TOKEN_EXPIRING` 상수 승격은 순수 additive — wire 전송 값이 리터럴 시점과 문자 그대로 동일함을 직접 대조 확인. 이름 충돌 없음. | `codebase/backend/src/modules/websocket/websocket-events.types.ts:314-315` | 없음. |
| 9 | side_effect | `expiryTimers` 타입 non-optional화·`clearExpiryTimers` 추출은 모두 `private` 표면 안이라 호출자·공개 API 영향 없음. 기존 `if(timers.notice)` 방어 가드는 원래도 도달 불가능한 죽은 코드였음을 확인. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-159,235-241` | 조치 불요. |
| 10 | maintainability | `Math.max(0,…)` 클램프 설명 주석이 notice/cutoff 두 지점에 거의 동일한 문장으로 중복(교차 참조는 있으나 단일 SoT 없음) — 근거가 바뀌면 한쪽만 고쳐질 위험. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` 194-197줄 대역, 211-213줄 대역 | 근거 문단을 notice 쪽 한 곳에만 두고 cutoff 쪽은 짧은 교차참조로 축소, 또는 JSDoc에 한 번만 기술. |
| 11 | maintainability | 신규 테스트 1건(`exp` 없는 토큰 재무장)이 `connectWithExp` 헬퍼가 지원 못하는 조합이라 헬퍼 내부 로직을 손으로 재조립(1회성, rule-of-three 미달). | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:833-857` | `connectWithExp`의 두 번째 인자를 optional화해 `exp` 클레임 생략을 지원하도록 확장(지금 강제 아님). |
| 12 | maintainability | 상수 시제 불일치(`MSG_AUTH_TOKEN_EXPIRING` 진행형 vs `AUTH_TOKEN_EXPIRED`/`AuthTokenExpiredPayload` 완료형) — 라운드1에서 이미 검토·기각(현행 유지가 의미상 더 정확하다는 근거). | `codebase/backend/src/modules/websocket/websocket-events.types.ts:283-314` | 없음(현행 유지). |
| 13 | testing | `expSeconds`가 `NaN`/`Infinity`인 경로는 여전히 명시 테스트 없음 — 3라운드째 이월, 팀이 "undefined와 동일 조기 return 경로라 우선순위 낮음"으로 판단 유지 중. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:185` | 조치 불요(기존 판단 유지). 필요 시 `exp: NaN` 1케이스만 추가. |
| 14 | documentation | plan의 "이월 INFO 5건" 항목이 서브사이클(`11_57_58`) 마크다운 링크로 보강됐고 뮤테이션 축 수(4축)도 전체 통일됨을 확인. 다만 `12_16_24` 서브라운드는 동일한 링크가 없어(위 WARNING#2와 연계) 두 서브라운드 문서화 수준이 비대칭. | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:93-113,169-179` | `12_16_24/SUMMARY.md` 링크 추가 권장(WARNING#2 수정과 함께 처리 시 효율적). |
| 15 | concurrency | Node 단일 스레드 event loop + 전 경로 `await` 없음을 확인 — `expiryTimers` Map에 대한 경쟁 조건·데드락 여지 없음. 선제 해제 위치(조기 return 앞)가 "해제됐지만 신규 타이머 없음" 관측 가능 중간 상태를 만들지 않음. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` (전 경로) | 없음(확인 목적 기록). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가/암호화/입력검증 로직 변경 없음. unref 셧다운 트레이드오프·재사용-id 이론적 경쟁은 INFO(이미 추적/도달불가). |
| requirement | NONE | spec §1.2·§4.6과 line-level 일치, 72/72 테스트 독립 재현 + 뮤테이션으로 W3 수정 유효성 검증. |
| scope | NONE | 3커밋 모두 plan이 선언한 단일 작업 범위 안. review 산출물 비중이 크나 정상 관행. |
| side_effect | NONE | 실질 런타임 변화는 `.unref()`(의도적, 문서화됨)와 no-op 선제 해제 호출 두 가지뿐, 나머지는 private 표면/순수 additive. |
| maintainability | NONE | 주석 경미한 중복, 테스트 헬퍼 재사용 여지 정도의 INFO만. 순환 복잡도는 오히려 개선. |
| testing | LOW | 순서 계약(notice→cutoff) 미검증을 뮤테이션으로 실측 확인(WARNING). NaN/Infinity 갭은 기존 판단 유지. |
| documentation | LOW | plan 내 `리뷰 2R W1` 라벨 충돌(WARNING). JSDoc 오귀속 등 기존 결함은 전부 해소 확인. |
| concurrency | NONE | 단일 스레드 이벤트 루프 전제 하 경쟁 조건 없음. unref 트레이드오프는 이미 추적 중인 INFO. |
| api_contract | NONE | REST/WS wire 계약(엔드포인트·스키마·이벤트명·페이로드) 변경 없음, 순수 additive export. |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 기록, security/requirement/scope/side_effect/maintainability/concurrency/api_contract는 CRITICAL·WARNING 없이 NONE 판정).

## 권장 조치사항

1. (WARNING #1) `websocket.gateway.spec.ts`의 "이미 만료된 exp로 연결하면 즉시 끊는다" 테스트에 notice→cutoff 호출 순서 단언을 추가한다 — 현재 존재-단언만으로는 향후 리팩터가 순서를 조용히 뒤집어도 잡지 못한다.
2. (WARNING #2) `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`의 `리뷰 2R W1` 라벨 충돌(:158 vs :169)을 서브사이클 전용 라벨로 정정하고, `12_16_24/SUMMARY.md` 링크를 함께 보강한다.
3. (INFO, 선택) `.unref()` 셧다운 트레이드오프는 실제 배포 런북 문서에도 반영 — 현재는 plan 파일에만 기록됨.
4. (INFO, 선택) `Math.max(0,…)` 클램프 설명 주석 중복을 한 곳으로 정리(다음 이 파일을 만질 때).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨(누락 없음).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이 diff(타이머 하드닝·private 리팩터·상수 승격) 범위에서 성능 특성 변경 없음으로 라우터 판단(상세 사유는 라우터 출력에 미제공) |
  | architecture | 구조적 재설계 없는 로컬 하드닝으로 라우터 판단 |
  | dependency | 의존성 변경 없음 |
  | database | DB 접근 코드 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음(WS 내부 하드닝) |

---