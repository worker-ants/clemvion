# 보안(Security) 코드 리뷰

## 리뷰 범위 판단

이번 diff(`origin/main` 대비)는 54개 파일, 3619줄 추가지만 그중 실제 코드/설계 변경은 4개뿐이다:

1. `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` wire 문구 상수 신설
2. `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `expiryTimers` 타이머 쌍 non-optional 화, `clearExpiryTimers` 헬퍼 추출(재무장 시 선제 해제), `setTimeout(...).unref()` 추가
3. `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 변경에 대응하는 회귀 테스트 5종 추가
4. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 진행 기록(체크리스트) 문서

나머지 50개 파일(`review/code/2026/09/03/{11_57_58,12_16_24,12_40_10}/**`, `review/consistency/2026/09/03/12_40_11/**`)은 직전 리뷰 라운드들이 생성한 산출물(markdown 리포트·meta.json·재시도 상태 json)이 저장소에 커밋된 것으로, 코드가 아니라 리뷰 이력 문서다. 하드코딩 시크릿·인젝션 표면 여부만 훑었고(발견 없음), 나머지 관점(인증/인가·암호화 등)은 해당 없음으로 판단했다.

실제 소스는 `Read` 로 원본 파일(`websocket.gateway.ts`, `websocket-events.types.ts`)을 직접 열어 diff 와 대조 확인했다.

## 발견사항

없음 — CRITICAL/WARNING 급 취약점 미발견.

- **[INFO]** `armExpiryTimers` 재무장 시 선제 `clearExpiryTimers` 호출은 인가 우회 경로가 아니다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:183` (`this.clearExpiryTimers(client.id);` in `armExpiryTimers`)
  - 상세: `client.id` 는 Socket.IO 가 서버에서 생성하는 값이라 공격자가 임의로 지정해 타 세션의 타이머를 조기 해제시킬 수 없다. 재무장은 항상 `handleConnection`(`:243`)에서 `jwtService.verify(token)`(`:267`)를 통과한 새 `exp` 클레임으로만 일어나므로, 이번 변경이 인증/인가 경계를 약화시키지 않는다. 오히려 옛 타이머 쌍이 남아 `auth.token_expired` 가 중복 emit 되거나 이미 대체된 소켓에 `disconnect()`가 걸리는 잠재적 결함을 닫는 방향이다.
  - 제안: 조치 불요. 향후 `connectionStateRecovery` 를 켜는 시점에 재무장이 항상 새로 검증된 `exp` 기반이라는 이 가정이 유지되는지만 재확인.

- **[INFO]** `notice`/`cutoff` 타이머 `.unref()` — 그레이스풀 셧다운과의 트레이드오프는 새 취약점이 아니라 이미 추적 중인 가용성 리스크
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:224-225` (`notice.unref(); cutoff.unref();`)
  - 상세: `.unref()` 는 이 타이머들이 이벤트 루프를 붙잡아 프로세스 종료를 지연시키지 않게 하는 가용성 하드닝이다. 다만 그레이스풀 셧다운 도중 프로세스가 먼저 종료되면 대기 중이던 `notice`(사전 통지)·`cutoff`(강제 종료) 콜백이 발화하지 못할 수 있다 — 그 경우 실질 위험은 소켓 자체가 프로세스와 함께 소멸하므로 "만료된 토큰으로 계속 연결이 살아있는" 인가 우회가 아니라, 단지 사전 통지를 못 받는 UX 창이다. 이 트레이드오프는 코드 자체 주석(`:222-223`)과 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의 명시적 항목("셧다운 중 만료 콜백 미실행")으로 이미 추적되고 있어 새로 발견한 결함이 아니다.
  - 제안: 조치 불요(문서화된 의도, 재개 신호도 plan 에 명시됨).

- **[INFO]** wire 문구 리터럴 → 상수 승격은 신규 정보 노출이 아니다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:314-315` (`export const MSG_AUTH_TOKEN_EXPIRING = 'Access token expires soon — refresh and reconnect.';`)
  - 상세: 이 값은 이전에도 리터럴로 이미 소켓을 통해 클라이언트에 평문 전송되던 문구다(`git diff` 상 구 리터럴과 신 상수값이 바이트 단위로 동일). 심볼을 export 상수로 옮긴 것은 추가적(additive) 변경이며 새로운 정보 노출·시크릿 하드코딩이 아니다.
  - 제안: 없음.

- **[INFO]** JWT 페이로드 예외 처리는 민감정보를 노출하지 않는다 (diff 범위 밖 기존 코드, 회귀 없음 확인용)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:294-298` (`handleConnection` catch 블록)
  - 상세: 이번 diff 는 `handleConnection`/`catch` 블록 자체를 수정하지 않았다. `jwtService.verify` 실패 시 `catch {}` 로 예외 상세(스택트레이스·시크릿·클레임 내용)를 클라이언트에 보내지 않고 `'Invalid token'` 이라는 일반 메시지만 emit 하는 기존 패턴이 그대로 유지된다 — 에러 처리 관점에서 회귀 없음을 확인했다.
  - 제안: 없음.

## 점검 관점별 요약

1. **인젝션**: 해당 없음 — 사용자 입력이 SQL/커맨드/경로에 직접 결합되는 지점 없음. `expSeconds` 는 서버가 서명 검증한 JWT 의 `exp` 클레임에서 나온 숫자값으로만 사용된다.
2. **하드코딩 시크릿**: 없음 — `MSG_AUTH_TOKEN_EXPIRING` 은 UI/로그 표시 문구이지 자격증명이 아니다. 테스트 파일의 `'valid-jwt'` 는 `jwtService.verify` 모킹용 더미 토큰 문자열이며 실제 시크릿이 아니다.
3. **인증/인가**: 이번 diff 는 `handleConnection` 의 JWT 검증 로직·`channelAuthorizers`·명령 핸들러 소유권 검사(diff 밖)를 변경하지 않는다. 변경된 타이머 무장/해제 로직은 `client.id`(서버 생성값) 만을 키로 쓰고 재무장은 항상 새로 검증된 클레임 기반이라 인가 우회 경로가 생기지 않는다.
4. **입력 검증**: `expSeconds` 에 대한 `typeof`/`Number.isFinite` 가드는 diff 이전과 동일하게 유지된다(로직 변경 없음, 호출 위치만 조정).
5. **OWASP Top 10**: 해당 사항 없음.
6. **암호화**: 변경 없음(JWT 서명 검증 로직은 diff 밖).
7. **에러 처리**: 변경 없음 — 기존 일반화된 에러 메시지 패턴 유지.
8. **의존성 보안**: 신규 의존성·버전 변경 없음.

## 요약

이번 변경은 이미 보안 검토를 마친 WS `auth.token_expired` 기능(#1266)의 후속 하드닝/리팩터로, 타이머 쌍 관리를 단일 헬퍼로 통합하고 타입을 non-optional 화하며 `.unref()` 를 추가하고 wire 문구를 상수로 승격한 것이 전부다. 인증(JWT 검증)·인가(채널/명령 소유권 검사)·에러 새니타이징 로직 자체는 diff 범위 밖에서 변경되지 않았고, 재무장 로직도 서버 생성 `client.id` 와 매 순간 새로 검증된 JWT 클레임에만 의존하므로 인가 우회·정보 노출 경로를 만들지 않는다. `.unref()` 트레이드오프는 이미 plan 문서에 추적 항목으로 명시돼 있어 새 미해결 리스크가 아니다. 하드코딩된 시크릿, 인젝션, 안전하지 않은 암호화, 민감정보 노출 등 CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
