# Security Review — `21_49_51`

## 변경 개요

이번 diff(`origin/main...HEAD`, 112개 파일)는 6라운드째 이어지는 `ws-event-types-extract` 작업의
최신 스냅샷이다. 실제 코드 변경은 여전히 `websocket.service.ts` 가 함께 export 하던 런타임
값(enum)·타입 정의를 의존성-프리 신규 모듈 `codebase/backend/src/modules/websocket/websocket-events.types.ts`
로 추출하고, 27개 backend 소스/spec 파일의 import 경로를 재배선한 **순수 리팩터**다(#1174 ES-module
순환 회귀 방지 목적). 유일하게 런타임 동작이 바뀌는 지점은 `execution-event-emitter.service.ts` 의
`TERMINAL_SHAPE` 를 호출-시점 파생에서 모듈-스코프 상수로 되돌린 부분이며, 계산 결과(shape)는 동일하다.
나머지 파일 대부분(85개)은 앞선 5라운드(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`→`21_14_51`)의
`/ai-review`·`consistency-check` 산출물과 plan 문서 갱신으로, 코드 실행에 영향이 없는 마크다운/JSON이다.

## 독립 검증 (프롬프트 게이트 대신 실제 소스를 직접 대조)

- `websocket-events.types.ts` 전문(`Read`) — import 0줄, `export interface`/`export enum`/`export type`
  선언만 존재. 함수·I/O·외부 입력 처리 없음. 시크릿·자격증명 리터럴 없음.
- `websocket.service.ts` 를 직접 열람 — `CREDENTIAL_KEY_PATTERN`(password/passwd/pwd/api[_-]?key/secret/
  token/access[_-]?token/refresh[_-]?token/private[_-]?key/client[_-]?secret/authorization/cookie 매칭),
  `sanitizePayloadForWs`(`MAX_SANITIZE_DEPTH=10` 초과 시 `'[REDACTED_DEPTH]'` 로 서브트리 전체 마스킹),
  `stripExternalOnlyFields` 호출부(`emitExecutionEvent`/`emitNodeEvent` 양쪽) 등 기존 보안 통제가
  리팩터 전후로 로직 변경 없이 그대로 남아 있음을 확인.
- `websocket.gateway.ts:23` — `ExecutionEventType` import 가 `./websocket-events.types` 로 전환됨을
  확인. 인증/인가 관련 파일(`interaction.guard.ts` 등)은 이번 diff 에 전혀 등장하지 않는다
  (`git diff origin/main...HEAD --stat -- codebase/` 로 guard/auth 파일명 매치 0건 확인).
- `execution-event-emitter.service.ts:139-157`(`emitTerminalExecution`) — `wire.error = payload.error`
  로 에러 객체를 그대로 얹는 조립 로직은 이전 라운드부터 변경 없는 기존 설계다(이번 diff 는
  `TERMINAL_SHAPE` 참조 방식만 리터럴→상수로 바꿨을 뿐 조립 결과는 동일). 이후 `emitExecutionEvent`
  경로가 `sanitizePayloadForWs`+`stripExternalOnlyFields` 를 적용하므로 credential-key 패턴 매칭
  키는 마스킹되고 depth 상한도 걸린다. `payload.error` 원본이 `sanitizeErrorMessage` 계열을 항상
  거치는지는 이번 diff 의 신규 결함이 아니라 기존 설계이며, 이미 `plan/in-progress/ws-event-types-extract.md`
  후속 항목으로 등재되어 있다(범위 밖).
- `git diff origin/main...HEAD -- codebase/` 를 하드코딩 시크릿 패턴(API 키·비밀번호·토큰 리터럴·
  PEM 헤더·AWS 액세스 키 형태)으로 grep — 매치 0건.
- 신규 회귀 가드 `websocket-events.types.spec.ts` — `fs.readFileSync`/`fs.readdirSync` 를 쓰지만
  인자가 전부 `__dirname` 기반 상수 경로(`SRC_ROOT` 하위)이고 사용자 입력·외부 데이터가 전혀
  개입하지 않는 test-only 정적 분석 스크립트라 경로 탐색(path traversal) 표면이 없다.
- `package.json`/lockfile 변경 없음 — 신규 외부 의존성·버전 변경·라이선스 이슈 없음.

## 발견사항

없음 — Critical/Warning/INFO 급 신규 보안 결함을 찾지 못했다.

이번 라운드가 처음 보는 델타(`fa1bca013`→`b5ef57c3a`, 가드 테스트의 `moduleRefs()` 단일화·오탐 수정)는
전부 test-only 정적 분석 코드(`websocket-events.types.spec.ts`)에 국한되며, 사용자 입력 처리·엔드포인트·
인증/인가·암호화·시크릿 관리 경로를 전혀 건드리지 않는다. 프로덕션 코드(27개 backend 소스 파일)는
기계적 import 경로 치환과 `TERMINAL_SHAPE` 모듈-스코프 승격(참조하는 값의 출처가 이제 순환 밖 모듈이라
안전) 뿐이며, 기존 보안 통제(credential 키 패턴 마스킹, 외부 fanout 필드 strip, depth 상한을 통한
누출/DoS 방지)는 소스 직접 대조로 바이트 단위 보존을 확인했다. 앞선 5라운드가 이미 동일한 결론(NONE)에
도달했고, 이번 라운드의 독립 재검증도 그 결론을 뒤집을 근거를 찾지 못했다.

## 요약

`websocket.service.ts` 가 안고 있던 ES-module 순환 위 값 평가 순서 문제(#1174 회귀 원인)를
import-0줄 전용 타입/enum 모듈로 물리적으로 분리하는 순수 리팩터이며, 신규 엔드포인트·사용자 입력
처리 경로·인증/인가 로직·암호화·시크릿 관리 변경이 전혀 없다. 프로덕션 파일 27개 중 26개는 import
경로 재배선뿐이고, 유일한 실행 순서 의존 변경(`TERMINAL_SHAPE` 모듈 스코프 상수화)도 값의 출처가
순환에서 이탈했다는 사실에 근거해 안전하다. 신규 회귀 가드(`websocket-events.types.spec.ts`)는
외부 입력이 없는 test-only 정적 분석 코드다. 하드코딩 시크릿, 인젝션 벡터, 인증/인가 변경, 암호화
약화, 에러 메시지 정보 노출(기존 설계 그대로), 신규/취약 의존성 — 전 항목 해당 없음. 6라운드
연속으로 이 결론이 유지되고 있다.

## 위험도

NONE
