# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 3건(모두 병합 차단 사유는 아님: flaky 테스트 1건·"조치했다"는 허위 기록 1건·JSDoc 과잉 서술 1건). 4라운드에 걸친 리뷰-수정 사이클로 이전 CRITICAL/WARNING(no-op reconnect, typecheck ratchet 파괴, cross-generation race 등)은 모두 코드 대조·실행·뮤테이션 테스트로 해소가 재확인됐다. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 안정성 | cross-generation race 회귀 가드 테스트가 드물게(76회 반복 실행 중 1회) flaky 실패(`gen1.connect` 이 호출되지 않아야 하는데 호출됨). 소스상 `await` 없는 동기 구간이라 애플리케이션 로직으로는 실패를 설명할 인과를 못 찾음 — vitest 잡음 가능성이 높으나 부재를 증명한 것은 아님 | `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` — "옛 세대의 재발급은 새 소켓을 건드리지 않는다" | 격리 반복 실행(`vitest --repeat-each=200 -t "옛 세대의"`)으로 결정성 재확인. 원인 불명 시 CI flake-tracker 에 등재해 다음 실패가 조용히 "이미 알려진 flake"로 묻히지 않게 할 것 |
| 2 | 유지보수성/프로세스 정합성 | 3R 커밋 메시지("세 번 지적된 이중 빈 줄도 정리했다")와 RESOLUTION.md("이번에 정리했다")가 실제로 일어나지 않은 수정을 "했다"고 기록 — `git show`로 대조하면 해당 hunk 가 diff 에 전혀 없고 현재도 이중 빈 줄이 그대로 남아 있음(scope·maintainability 두 리뷰어가 각자 독립적으로 동일 지점 발견) | 실제 잔존: `codebase/frontend/src/lib/websocket/ws-client.ts:131-132` / 허위 주장: `review/code/2026/09/02/18_45_43/RESOLUTION.md:60`, 커밋 `e5b683d75` 메시지 | 빈 줄 하나 제거(트리비얼). 더 중요하게는 앞으로 "조치했다"고 기재하기 전에 `git show`/`git diff`로 실제 반영 여부를 확인하는 습관화 — 사소한 포맷팅에서 벌어진 일이 기능 항목에서 재발하면 위험도가 다름 |
| 3 | 문서화 | `AuthTokenExpiredPayload.expiresAt` JSDoc이 "클라이언트는 이 값으로 남은 창을 계산해 재발급+재연결을 수행한다"고 서술하지만, 실제 `auth.token_expired` 핸들러는 payload 를 전혀 읽지 않고 통지를 받는 즉시 재발급을 시작함 — spec §9.2 계약 위반은 아니나(즉시 처리가 창 안 처리의 상위집합) 문서가 구현보다 넓게 약속. plan 체크리스트에 등재돼 있지 않아 이번 라운드가 기록을 남기지 않으면 세션 봉인 후 근거가 사라질 위험 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:293-294` vs `codebase/frontend/src/lib/websocket/ws-client.ts:134-136` | JSDoc을 실제 동작에 맞춰 좁히거나("즉시 재발급 개시, expiresAt은 진단·로깅 목적"), 향후 이 값을 실제로 소비하도록 구현을 넓힐 계획이면 plan 체크리스트에 후속 항목으로 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안(설계 의도) | 명시적 세션 revoke 후에도 이미 열린 WS 소켓은 access token 자연 만료 시각(최대 15분)까지 계속 인가된 채 이벤트 수신 — spec Rationale `R-ws-socket-lifetime-binds-token`이 명시 승인한 스코프, 유저 가이드에도 "최대 15분"으로 명문화됨 | `websocket.gateway.ts`(`armExpiryTimers` JSDoc), `password-and-sessions*.mdx` | 조치 불요(설계 의도, 문서화 완료). "즉시 차단" 요구가 생기면 별도 revocation list 설계 필요 |
| 2 | 성능 | 만료 타이머(사전 통지·강제 종료)에 지터가 없어 동시 접속 코호트가 900초 주기로 재연결이 뭉칠 수 있음(thundering herd) — 3라운드 연속 코드 변경 없이 plan에 defer 사유+재개 신호와 함께 SoT로 등재됨 | `websocket.gateway.ts:144`(`TOKEN_EXPIRY_LEAD_MS`), `:187-207` / `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:98-107` | 조치 불요(spec 고정값 변경은 developer 권한 밖). 배포 런북에 리스크 기록 여부만 후속 확인 |
| 3 | 아키텍처/유지보수성 | `expiryTimers` 타이머 쌍 타입이 optional(`notice?`, `cutoff?`)이지만 실제로는 항상 쌍으로 존재 — 불변식이 타입에 드러나지 않음. 3~4라운드째 "취향 범위"로 명시 보류 | `websocket.gateway.ts:150-153, 192` | 조치 불요(선택). non-optional 화 가능 |
| 4 | 아키텍처/유지보수성/테스트 | wire 메시지 문자열이 파일 내 기존 상수화 관례(`MSG_NOT_AUTHENTICATED` 등)를 따르지 않고 인라인 리터럴로 남음, 대응 테스트도 `expect.any(String)`로만 느슨하게 검증 | `websocket.gateway.ts:195`, `websocket.gateway.spec.ts:755` | 조치 불요(선택). `MSG_AUTH_TOKEN_EXPIRING` 류 상수 승격 후 테스트에서 참조하면 문구·검증 동기화 |
| 5 | 요구사항/문서화/API계약 | spec §1.2/§4.6/Rationale이 여전히 `auth.token_expired`를 `_(계획·미구현)_`(Planned)로 표기 — 구현은 이미 완료. developer 권한 밖(제품 정의·API 계약은 자기-반증형 소정정 예외 배제 대상), plan에 "머지 후 planner 턴"으로 이미 등재됨 | `spec/5-system/6-websocket-protocol.md:52,876,1100,1133` / `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:84-86` | 코드 조치 불요. 등재된 planner 턴에서 배지 flip |
| 6 | 부작용/API계약 | 배포 전환 창 동안 이 로직을 모르는 구버전 프론트 번들이 최대 15분 뒤 무통지로 끊김 — 코드로 막을 문제가 아니라는 판단으로 1R부터 plan "배포 전환 창 리스크" 항목 + 런북 판단으로 등재됨 | `websocket.gateway.ts`(`armExpiryTimers` cutoff `client.disconnect()`) / plan 체크리스트 | 코드 조치 불요. 배포 런북에 실제 기록 여부만 후속 확인 |
| 7 | 동시성 | `connect()`/`disconnect()`가 이전 세대 소켓의 리스너를 명시적으로 해제하지 않음 — 현재는 socket.io 내부 동작(교체 후 이벤트 미발화)에 암묵적으로 의존, 재현 가능한 결함은 아님 | `ws-client.ts:29-44, 147-152` | 낮은 우선순위. `oldSocket.removeAllListeners()` 로 암묵적 전제를 명시적 보장으로 전환 가능 |
| 8 | 동시성 | `armExpiryTimers`의 `setTimeout` 지연값에 Node.js 32-bit 상한(~24.8일) 방어 없음 — 현재 access token TTL 900초 고정이라 도달 불가 | `websocket.gateway.ts:170-210` | 낮은 우선순위. 향후 가변 TTL 도입 시 상한 clamp 검토 |
| 9 | 동시성 | 동일 `client.id`로 `armExpiryTimers`가 재호출되면 이전 타이머 쌍이 `clearTimeout` 없이 덮어써짐 — 현재 connectionStateRecovery 미사용이라 도달 불가 경로, 3~4라운드째 이월 | `websocket.gateway.ts:209` | 낮은 우선순위. 진입 시 선제적 clear 추가 가능 |
| 10 | 테스트 | "만료 시각이 이미 과거인 토큰"(cutoff 즉시 발화) 경로가 직접 테스트되지 않음 — JWT 검증이 상위에서 걸러 현재 도달 불가, 4라운드째 의도적 미조치 | `websocket.gateway.ts:201-207` / `websocket.gateway.spec.ts:793-805` | 필수 아님. `connectWithExp(id, -10)` 1건 추가 시 방어 로직 실측 뒷받침 가능 |
| 11 | 테스트/유저가이드동기화 | e2e 커버리지 부재 — 현 e2e 하네스가 boot-only 게이트라 런타임 토큰 TTL 주입 표면이 없어 유예. plan에 근거·재개 신호 명시적으로 기록됨(silent gap 아님) | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:92-96` | 조치 불요. 하네스에 런타임 주입 표면이 생기거나 회귀가 실관측되면 재개 |
| 12 | 범위(Scope) | 실패/빈 `--impl-prep` consistency 재시도 세션 6개(10개 파일)가 diff에 그대로 남음 — 기능 변경과 무관, 4라운드 연속 동일 지적 | `review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34}/` | 차단 아님. 정리 시 정리, 급하지 않음 |
| 13 | 보안 | 재발급 실패 로깅(`console.error`) 트리거가 1곳(`connect_error`)에서 3곳으로 확장 — 서버 전송 없이 브라우저 devtools 콘솔에만 남는 기존 관례의 연장 | `ws-client.ts`(`refreshAndReconnect` catch 블록) | 조치 불요(범위 밖). 필요 시 `refreshErr.message`만 로깅하도록 후속 정리 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 결함 없음. cross-gen race 수정(스냅샷+세대비교) 코드 직접 확인. revoke carve-out·로깅 확장은 기존 관례 재확인(INFO) |
| performance | NONE | 3R 대비 실질 동일 코드, 성능 비용 무시 가능. 지터 부재(thundering herd)는 3라운드째 defer 유지(INFO) |
| architecture | LOW | SOLID/결합도/순환의존 이상 없음. JSDoc 과잉 서술·타이머 타입 optional·wire 상수화 미비 등 이월 INFO 4건 |
| requirement | LOW | spec 계약 대부분 일치. cross-gen 가드 회귀 테스트 flaky 1건(WARNING), spec Planned 배지·JSDoc 과잉은 INFO 재확인 |
| scope | LOW | 범위 일탈 없음. 3R RESOLUTION/커밋이 "이중 빈 줄 정리했다"고 허위 기록한 것을 발견(WARNING) |
| side_effect | LOW | 신규 부작용 표면(네트워크 호출 트리거 3곳·타이머 상태·리스너 2개) 모두 가드로 격리 확인, 전부 INFO |
| maintainability | LOW | 핵심 이슈(1R 중복 로직, 3R 들여쓰기) 해소 확인. scope와 동일한 "허위 조치 기록" 재발견(WARNING) |
| testing | NONE | backend/frontend unit 스위트 전체 GREEN(178/178, 204/204), 세대비교 가드 뮤테이션 재검증 성공. 저위험 INFO 2건 |
| documentation | LOW | 이전 WARNING 4건 해소 확인. `expiresAt` JSDoc 과잉 서술을 신규 WARNING으로 재확인·격상 |
| concurrency | LOW | 이전 CRITICAL(no-op reconnect) 해소 확인. 리스너 미정리·32bit overflow·Map 재진입 INFO 3건(전부 현재 도달 불가) |
| api_contract | NONE | wire 계약(이벤트명·payload shape·인증흐름) 3라운드 검증 상태 유지. spec 배지·배포 전환 창 INFO 2건(재확인) |
| user_guide_sync | NONE | ko/en 가이드 페이지 동반 갱신 확인(PASS), 수치(15분) 실측 일치. e2e 유예는 plan 근거 기록돼 INFO만 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상을 보고했다(대부분 이전 라운드 항목의 재확인).

## 권장 조치사항

1. (선택, 트리비얼) `codebase/frontend/src/lib/websocket/ws-client.ts:131-132` 이중 빈 줄 제거 — 3R이 "정리했다"고 잘못 기록한 항목. 이후 "조치했다" 기재 전 `git show`로 실제 diff 반영 여부를 확인하는 습관화(WARNING #2).
2. `AuthTokenExpiredPayload.expiresAt` JSDoc을 실제 구현(즉시 처리, 값 미소비)에 맞게 정정하거나, 향후 이 값을 실제로 활용하도록 구현을 넓히고 plan에 등재(WARNING #3).
3. cross-generation race 가드 테스트의 낮은 확률 flaky(76회 중 1회)를 `--repeat-each` 반복 실행으로 재확인하고, 원인 불명 시 CI flake-tracker에 등재(WARNING #1).
4. (이미 plan 등재, 재확인) 머지 후 planner 턴 수행 — spec §1.2/§4.6/Rationale의 `_(계획·미구현)_` 배지 flip.
5. (이미 plan 등재, 재확인) 배포 런북에 "구버전 프론트 번들이 최대 15분 뒤 무통지 disconnect" 리스크 기록 여부 확인.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단으로 이번 diff 범위에서 제외(신규 의존성 변경 없음) |
  | database | router 판단으로 이번 diff 범위에서 제외(DB 스키마/쿼리 변경 없음) |