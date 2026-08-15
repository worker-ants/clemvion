# Security Review

## 변경 개요

이번 diff(38→53개 파일, `git diff origin/main...HEAD` 기준 53 파일)는 두 층으로 구성된다.

1. **코드 변경 (26개 backend 소스/spec 파일)**: `websocket.service.ts` 가 함께 export 하던
   런타임 값(enum)·타입 정의를 의존성-프리 신규 모듈
   `codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 추출하고, 25곳 이상의
   import 경로를 갱신한 **순수 리팩터**(#1174 ES-module 순환 회귀 방지). 유일하게 런타임 동작이
   바뀌는 지점은 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 를 호출-시점 파생에서
   모듈-스코프 상수로 되돌린 부분이며, 계산 결과(shape)는 동일하다.
2. **문서/프로세스 산출물 (plan/review/spec, 27개 파일)**: 직전 `/ai-review`(`19_27_37`) 및
   `consistency-check`(`18_53_27`) 산출물, plan 문서 갱신, spec frontmatter 1줄 — 코드 실행에
   영향 없는 마크다운/JSON.

직전 라운드(`19_27_37`)의 자체 security 리뷰가 이미 이 리팩터를 NONE 으로 판정했고, 그 라운드가
지적한 유일한 보안 인접 항목(WARN #10 credential 마스킹 JSDoc 이 구현 없는 신규 파일에 고아로
남음)은 RESOLUTION(`W4`)에서 처리됐다. 이번 라운드는 그 수정이 실제로 반영됐는지와 나머지
Warning 처리(특히 W1 — `websocket.gateway.ts` 의 순환 당사자 노드 누락)를 코드 레벨에서 재검증했다.

## 검증

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전체를 직접 열람 —
  WARN #10 JSDoc 블록이 더 이상 이 파일에 없음을 확인(신규 파일은 순수 값/타입 선언만 보유).
- `codebase/backend/src/modules/websocket/websocket.service.ts` 를 직접 열람 — `CREDENTIAL_KEY_PATTERN`
  (`/^(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization|cookie)$/i`),
  `sanitizePayloadForWs`/`sanitizeInner`(`MAX_SANITIZE_DEPTH=10` 초과 시 `'[REDACTED_DEPTH]'` 로
  통째 마스킹, 하위 credential 누출 차단), `SANITIZE_CACHE`(WeakMap, 참조 동일성 보장) 로직이
  리팩터 전후로 문자 그대로 보존되어 있음을 확인. WARN #10 JSDoc 은 이제 `CREDENTIAL_KEY_PATTERN`
  선언 바로 위(파일 51-60행)에 정확히 위치 — 직전 라운드가 지적한 "고아 문서" 결함 해소 확인.
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` 를 직접 열람 — `ExecutionEventType`
  import 가 `./websocket-events.types` 로 전환됨을 확인(직전 라운드 W1 이 지적한 순환 당사자 노드
  누락이 이번엔 수정 반영됨). 이 파일이 `websocket.service.ts` 와 이루는 직접 2-노드 순환의 한쪽이
  이제 의존성-프리 모듈만 참조하므로, 향후 이 값이 모듈 스코프로 승격돼도 위험이 없다.
- `execution-event-emitter.service.ts` 를 직접 열람 — `TERMINAL_SHAPE` 는 `websocket-events.types`
  값만 참조(순환 이탈 확인), `emitTerminalExecution` 의 `wire.error = payload.error` / `wire.result`
  조립 로직은 §6/§6.5 계약(닫힌 3값 union, user cancel 시 `error` 키 자체 부재)을 그대로 보존.
- `git diff origin/main...HEAD | grep -i` 로 하드코딩 시크릿 패턴(API 키·비밀번호·토큰 리터럴·
  PEM 헤더·AWS 액세스 키 형태) 전수 스캔 — 매치 0건. `CREDENTIAL_KEY_PATTERN` 자체(정규식 소스)와
  기존 `deepRedactSecrets` 참조 외 검출 없음.
- 새로 추가된 `websocket-events.types.spec.ts` 는 `fs.readFileSync`/`path.join` 을 쓰지만 인자가
  전부 `__dirname` 기반 상수 경로이고 사용자 입력·외부 데이터가 전혀 개입하지 않는 test-only
  정적 분석 스크립트라 경로 탐색 표면이 없음.

## 발견사항

없음 — Critical/Warning/INFO 대상 보안 결함을 찾지 못했다.

이번 diff 는 신규 엔드포인트·사용자 입력 처리 경로·인증/인가 로직·암호화·시크릿 관리를 전혀
건드리지 않는다. 기존 보안 통제(credential 키 패턴 마스킹, 외부 fanout 필드 strip
`stripExternalOnlyFields`, depth 상한을 통한 DoS/누출 방지, `TerminalErrorPayload` 의 닫힌 union
계약)는 리팩터 전후로 동작이 바이트 단위로 보존되어 있음을 소스 직접 대조로 확인했다. 직전
라운드(`19_27_37`)가 지적한 유일한 보안 인접 문서 결함(WARN #10 JSDoc 고아화)은 구현부 바로 위로
재배치되어 해소를 확인했고, 재발(같은 결함이 새 파일에 다시 생기는 것) 여부도 없음을 확인했다.

`payload.error`(`TerminalErrorPayload`)가 `sanitizeErrorMessage` 를 반드시 경유하는지에 대한
전수 확인은 직전 라운드에서 "기존 설계, 이번 diff 와 무관"으로 INFO 처리되었고 plan 문서
(`ws-event-types-extract.md` 후속 항목)에 별도 턴으로 등재되어 있다 — 이번 diff 범위 밖이라
재차 지적하지 않는다.

## 요약

`websocket.service.ts` 가 짊어졌던 런타임 값/타입 선언을 의존성-프리 모듈로 추출하는 순수 내부
리팩터로, ES-module 순환(#1174 회귀 원인) 해소가 목적이며 보안 관련 코드 경로(credential 마스킹,
외부 fanout strip, 에러 payload 조립)는 전혀 수정되지 않고 그대로 보존되었다. 직전 리뷰 라운드가
지적한 순환 당사자 노드 누락(W1)과 보안 JSDoc 고아화(W4)는 모두 이번 코드에서 실제로 수정 반영된
것을 직접 소스 대조로 확인했다. 새로 추가된 정적 가드 테스트(`websocket-events.types.spec.ts`)도
외부 입력이 없는 test-only 코드라 위험이 없다. 하드코딩 시크릿, 인젝션 벡터, 인증/인가 변경,
암호화 약화, 에러 메시지 정보 노출, 신규/취약 의존성 — 전 항목 해당 없음.

## 위험도

NONE
