# Code Review 통합 보고서

## 전체 위험도
**LOW** — 10개 reviewer(전원 forced 포함) 전부 결과 확보, CRITICAL 0건 · WARNING 0건. 5라운드 누적 diff(feat + 1R~4R fix)에서 이전 라운드가 발견한 CRITICAL 2건(소켓 no-op 재연결, typecheck ratchet 파괴)과 WARNING 다수는 모두 해소 재확인됨. 이번 라운드의 실질 코드 변경(4R fix 커밋)은 JSDoc 정정 1건 + 중복 빈 줄 삭제 1건뿐이라 새 표면이 거의 없고, 남은 것은 전부 INFO(대부분 4~5라운드 연속 이월된 저위험 관찰). Forced whitelist 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 이 `auth.token_expired` 서버발신 이벤트를 여전히 `_(계획·미구현)_`(Planned) 배지로 표기하나, 구현은 이번 diff 로 완전히 완료됨(코드가 맞고 spec 이 낡음) | `spec/5-system/6-websocket-protocol.md:52,876,1100,1133` (Planned 배지) vs `codebase/backend/src/modules/websocket/websocket.gateway.ts`(`armExpiryTimers`, 170-210행) + `websocket-events.types.ts:283-305` + `codebase/frontend/src/lib/websocket/ws-client.ts:111-143` (구현 완료) | 코드 조치 불요. `spec_impact: none`(developer 권한 밖, 문구 원저자 아님)이므로 자기-반증형 소정정 예외 대상 아님 — 머지 후 별도 planner 턴에서 spec 배지를 구현 완료로 flip 하고 `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23` 체크박스도 함께 닫을 것. 이미 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:84-86`에 등재됨 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency/security | `armExpiryTimers`가 동일 `client.id` 재진입 시 이전 notice/cutoff 타이머를 `clearTimeout` 없이 무조건 덮어씀. 현재 `connectionStateRecovery` 미사용이라 신규 연결마다 고유 id 가 발급돼 실사용 도달 불가 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:209`(`this.expiryTimers.set(client.id, timers)`) | 조치 불요(도달 불가 경로). `armExpiryTimers` 진입 시 기존 항목 선제 clear 하면 향후 `connectionStateRecovery` 도입 시에도 안전 |
| 2 | architecture/maintainability | `expiryTimers` 값 타입이 `{ notice?, cutoff? }`로 둘 다 optional — "항상 쌍으로 존재" 불변식이 타입에 드러나지 않음. 4~5라운드 연속 이월, 의도적 보류 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153`(필드 선언), `:192`(`armExpiryTimers` 내 `timers` 지역변수), 소비부 `:287-289` | 착수 우선순위 낮음. non-optional 화 고려(동작 영향 없음) |
| 3 | security/requirement/testing | frontend cross-generation 가드 테스트가 리뷰어 환경에서 76회 중 1회 flaky 관측(4R). 이번 라운드 25회 추가 반복 실행 포함 재현 안 됨 — 재현 실패가 부재의 증거는 아님, plan 에 watch 항목 등재 | `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:287`("옛 세대의 재발급은 새 소켓을 건드리지 않는다"), 추적: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:98-109` | 조치 불요(추적 중). 재발 시 근본 원인 끝까지 조사(재개 신호가 plan에 명시됨) |
| 4 | architecture | `AuthTokenExpiredPayload`의 "진단·로깅용" JSDoc(4R 정정본)조차 실제로는 어느 소비자도 payload 를 읽지 않음(핸들러가 인자 자체를 받지 않음) — wire 계약에 미사용 필드가 실려 있다는 신호 | `codebase/backend/src/modules/websocket/websocket-events.types.ts`(`AuthTokenExpiredPayload` JSDoc) vs `codebase/frontend/src/lib/websocket/ws-client.ts:133-135` | 조치 불요. 실제 진단 로깅 필요 시점에 채우거나 JSDoc을 "현재 소비자 없음 — 예약" 으로 한 번 더 낮추면 더 정확 |
| 5 | architecture/documentation/maintainability | wire 메시지 문자열이 파일 내 기존 상수화 관례(`MSG_NOT_AUTHENTICATED` 등)를 따르지 않고 인라인 리터럴 — 4~5라운드 연속 이월 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:195`(`message: 'Access token expires soon — refresh and reconnect.'`) | 선택적. `MSG_AUTH_TOKEN_EXPIRING` 류 상수로 승격, 병합 차단 아님 |
| 6 | scope | 실패/빈 `--impl-prep` 재시도 consistency 세션 6개(12파일)가 diff 에 5라운드째 그대로 잔존(94개 파일 중 ~13%) | `review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34}/` | 차단 아님. 최종 PR 정리 시 성공 세션(`17_13_02/`)만 남기고 걷어내거나, 재시도 잔재 gitignore 관례화 검토 |
| 7 | side_effect | 그레이스풀 셧다운(SIGTERM) 경로와 신규 `setTimeout`(notice/cutoff, `.unref()` 없음)의 상호작용 — 이 코드베이스에 명시적 `process.exit()` 없음을 확인, socket.io `Server.close()`가 연결 소켓을 능동 종료할 가능성이 높아 실질 블로킹 근거는 못 찾음(신규 관찰, 미검증 가정) | `codebase/backend/src/modules/websocket/websocket.gateway.ts`(`armExpiryTimers` 내 `timers.notice`/`timers.cutoff` setTimeout), 대조: `main.ts:254`, `shutdown-state.service.ts`, `instrumentation.ts:104` | 확정 결함 아님. `.unref()` 추가 시 비용 0에 가깝게 이 가정 자체를 제거 가능(선택) |
| 8 | side_effect | frontend `connect()`의 리스너가 3개→5개로 늘었는데 구세대 소켓에 대한 `removeAllListeners()`/`off()` 미호출 여전 — 실제 위험은 세대 비교 가드가 방어함을 코드로 재확인(3라운드 이월) | `codebase/frontend/src/lib/websocket/ws-client.ts`(`connect` 진입부, `socket.disconnect()` 직후 재등록 지점) | 지금 결함 아님. 리스너가 더 늘어나면 `socket.removeAllListeners()` 명시 호출 고려 |
| 9 | maintainability | `connect()` 함수가 123줄까지 커지며 재진입가드·소켓생성·재발급헬퍼정의·3개 이벤트핸들러 등록 4가지 책임을 한 함수에 흡수, 중첩 4~5단 | `codebase/frontend/src/lib/websocket/ws-client.ts:22-144`(`connect`), 특히 `:60-98`(`refreshAndReconnect`) | 지금 결함 아님. 다음 접촉 시 `refreshAndReconnect`를 모듈 스코프로 승격해 독립 단위테스트 가능하게 하는 것 고려 |
| 10 | maintainability | `ws-client.test.ts` 신규 테스트에서 동일 타입 캐스팅+페이로드 리터럴이 6회 반복 | `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:159,161,198-199,237,239,252,254,269,271,299-300` | `fireTokenExpired(payload?)` 로컬 헬퍼로 통합 고려 |
| 11 | maintainability | 백엔드 신규 테스트에서 `900`(TTL초)·`60`(lead time초) 매직넘버가 7회 이상 반복 | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:745,747,758,768,770,774,780,784` | `describe` 블록 상단에 로컬 상수 선언 후 치환 고려 |
| 12 | testing | 로그아웃 등으로 `disconnect()`가 in-flight 토큰 재발급 도중 발생하는 경로가 직접 테스트되지 않음(신규 관찰) — 세대 비교 가드(`socket !== mySocket`, `null !== mySocket`)가 구조적으로 이미 방어하는 것으로 보임 | `codebase/frontend/src/lib/websocket/ws-client.ts:68,74,146-151` | 필수 아님. 추가 시 "재발급 pending 중 disconnect 호출 → 재연결 안 됨" 1건으로 실측 뒷받침 가능 |
| 13 | testing | `armExpiryTimers`의 "이미 과거인 `exp`"(cutoff 즉시발화) 경로가 5라운드째 직접 테스트되지 않음 — `jwtService.verify`가 핸드셰이크 단계에서 이미 거부해 현재 도달 불가로 재확인 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207`, 근접 테스트 `websocket.gateway.spec.ts:793-805` | 필수 아님. 추가 시 `connectWithExp(id, -10)` 1건으로 보강 가능 |
| 14 | testing | 사전 통지 payload의 `message` 필드가 `expect.any(String)`로만 검증(4R부터 이월) — 같은 파일 다른 wire 문자열은 정확한 리터럴 단언 관례 | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:755` vs 소스 `websocket.gateway.ts:195` | 선택적. 상수 승격(INFO #5) 후 테스트에서 그 상수 참조 시 자동 동기화 |
| 15 | testing | WS 만료→재연결 종단 간 e2e 부재 — e2e 하네스가 boot-only 게이트라 런타임 토큰 TTL 주입 표면이 없다는 판단과 재개 신호가 plan(SoT)에 명시돼 유예 확정 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(e2e 유예 체크리스트) | 조치 불요(추적 중) |
| 16 | documentation | `cutoff` 타이머의 `Math.max(0, untilCutoff)` 클램프에 개별 근거 주석 없음(인접 `untilNotice`엔 있음) — 5라운드 연속 동일 지적, 동작 영향 없음 | `codebase/backend/src/modules/websocket/websocket.gateway.ts`(`armExpiryTimers` 내 `timers.cutoff` 대입부) | 차단 아님. 다음 접촉 시 "notice 와 같은 이유" 한 줄 추가로 5라운드 루프 종결 권장 |
| 17 | api_contract | 배포 전환 창 — 이 재연결 로직을 모르는 구버전 프론트 번들(배포 시점 열려있던 탭)은 서버 cutoff 시 무통지·복구 불가로 끊김. 1R부터 등재된 배포 런북 판단 대상, 코드 결함 아님 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(배포 전환 창 체크리스트) | 조치 불요(배포 런북 판단 대상, 코드 변경 아님) |
| 18 | scope | 4R fix 커밋(`a18376f0c`)이 3R 이 "정리했다"고 거짓 주장했던 이중 빈 줄을 이번에 실제로 제거 — 직전 라운드의 거짓 "조치 완료" 주장을 바로잡는 정상적 사후 조치(긍정적 기록) | `codebase/frontend/src/lib/websocket/ws-client.ts:131` | 조치 불요(정정 확인됨) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CRITICAL/WARNING 0. 이번 diff는 CWE-613급 세션만료 취약점을 닫는 개선. INFO 4건(타이머 덮어쓰기, exp 상한 미검증, flaky 관측, revoke 카브아웃 유예창 문서화) |
| architecture | LOW | CRITICAL/WARNING 0, SOLID·결합도·순환의존 이상 없음. INFO 3건 전부 4라운드 연속 이월(미사용 필드 JSDoc, 타이머 optional 타입, 문자열 미상수화) |
| requirement | LOW | CRITICAL/WARNING 0. spec §1.2/§1.3/§4.6/§6.1/§9.2 line-level 정확 구현 재확인(3개 테스트 스위트 재실행 통과). SPEC-DRIFT 1건(Planned 배지), flaky 관측 1건 |
| scope | NONE | 5라운드 누적 diff가 plan·spec Rationale 정의 범위와 정확히 일치, 요청 이상 수정 없음. INFO 2건(빈 재시도 세션 잔존, 3R 거짓주장 정정 확인) |
| side_effect | LOW | 전역변수·시그니처 파괴·의도치 않은 FS/env/네트워크 접근 없음. INFO 6건(신규 타이머 상태, 네트워크 트리거 확장, 그레이스풀 셧다운 상호작용(신규 관찰), 리스너 미정리, emit 네임스페이스, review 산출물) |
| maintainability | LOW | CRITICAL/WARNING 0, 기존 컨벤션 일관 준수. INFO 4건(connect() 책임 누적, 테스트 반복 캐스팅, 매직넘버, 타이머 optional 타입) |
| testing | NONE | backend 79/79, frontend 26/26 PASS 재실행 확인. flaky 25회 추가 반복도 재현 안 됨. INFO 5건(대부분 저위험 이월, 로그아웃 중 재발급 미검증 1건 신규) |
| documentation | NONE | 4R WARNING 3건 전부 소스 대조로 해소 재확인. INFO 1건(cutoff 클램프 주석 부재, 5라운드 연속) |
| concurrency | LOW | 4라운드에 걸쳐 재현·격리된 레이스(no-op 재연결, 재진입, 세대 불일치) 전부 mutation 검증 포함 해소 확인. INFO 1건(타이머 Map 덮어쓰기, security와 중복) |
| api_contract | NONE | wire 스키마·엔드포인트·인증 흐름 영향 없음(JSDoc 정정+공백정리뿐). emit-only 순수 additive. INFO 2건(SPEC-DRIFT 배지, 배포 전환창) |

## 발견 없는 에이전트

없음 — 전 10개 reviewer 가 최소 1건 이상의 INFO/SPEC-DRIFT 관찰을 보고했으나, CRITICAL/WARNING 은 전원 0건.

## 권장 조치사항

1. **머지 후 planner 턴**: `spec/5-system/6-websocket-protocol.md`의 `_(계획·미구현)_`(Planned) 배지(§1.2:52, §4.6:876, Rationale:1100,1133)를 구현 완료로 flip하고 `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23` 체크박스를 닫는다 (SPEC-DRIFT #1, developer 권한 밖).
2. PR 최종 정리 시 빈 `--impl-prep` 재시도 consistency 세션 6개(`review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34}/`)를 별도 커밋으로 정리하거나 재시도 잔재 gitignore 관례화를 검토한다 (INFO #6, 5라운드 연속).
3. 나머지 INFO 항목(타이머 optional 타입, 메시지 문자열 상수화, cutoff 클램프 주석, connect() 책임 분리, 테스트 반복 축소, `.unref()` 추가 등)은 모두 병합 차단 사유가 아니며, 다음에 해당 파일을 접촉하는 시점에 함께 정리해도 무방하다.
4. cross-generation 가드의 flaky 관측(1/76 + 이번 라운드 25회 추가 반복 0실패)은 plan에 이미 등재된 watch 항목의 재개 신호(한 번이라도 더 실패하면 끝까지 판다)를 그대로 유지한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract` (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨, 누락 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세 미제공 — diff 성격상 성능 영향 표면 낮음으로 router 가 판단) |
  | dependency | 라우터 판단(신규 의존성 추가 없음) |
  | database | 라우터 판단(DB 스키마/쿼리 변경 없음) |
  | user_guide_sync | 라우터 판단(유저 가이드 doc 변경은 이전 라운드에서 이미 반영·검증됨) |