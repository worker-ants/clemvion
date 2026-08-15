# Security Review — `20_50_49`

## 검토 방법

프롬프트에 실린 unified diff(약 53개 파일)에 더해 `git diff origin/main...HEAD --stat -- codebase/`
로 코드 변경 전체 목록(27개 backend 파일, 672 insertions / 313 deletions)을 실측했고, 보안 통제가
실제로 들어있는 핵심 파일은 diff 조각이 아니라 전체 소스를 직접 `Read`했다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (신설, 전체 265줄)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (전체 436줄) — `CREDENTIAL_KEY_PATTERN`
  마스킹, `sanitizePayloadForWs`, `stripExternalOnlyFields`, `attachRoutingContext`
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
  (`TERMINAL_SHAPE` 모듈 스코프화, `emitTerminalExecution`)
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (신설, 전체 285줄) — 순환
  재편입 정적 가드
- `git diff origin/main...HEAD` 로 `ai-turn-executor.ts` / `execution-engine.service.ts` 등 나머지
  import-only 파일이 실제로 import 문 교체 외 변경이 없음을 확인

`plan/**`·`review/**` 하위 문서 diff(직전 두 라운드 `19_27_37`/`20_05_17` 및 그 RESOLUTION)는 이번
라운드가 이미 반영한 fix 이력 — 각 라운드의 `security.md` 가 모두 위험도 NONE 으로 결론냈고, 이번
diff 는 그 결론을 뒤집을 새 코드 변경을 포함하지 않는다.

## 변경 개요

이번 diff 는 `websocket.service.ts` 가 함께 export 하던 enum/interface/type 15종을 의존성-프리
신규 모듈 `websocket-events.types.ts` 로 추출하고, 22개 소비 지점의 import 경로를 갱신하는 **순수
리팩터**다(#1174 — ES-module 순환 위 모듈 스코프 enum 평가가 `undefined` 로 터지는 버그의 근본
해소). 유일하게 런타임 동작이 바뀌는 지점은 `execution-event-emitter.service.ts` 의
`TERMINAL_SHAPE` 를 호출-시점 인라인 파생에서 모듈-스코프 상수로 되돌린 부분인데, 산출되는 `{
eventType, status }` 값 자체는 리터럴이 상수 참조로 바뀌었을 뿐 동일하다. 나머지는 신설된 정적
가드 테스트(`websocket-events.types.spec.ts`, TS AST 로 순환 재편입을 검출)와 plan/review 문서
갱신이다.

## 발견사항

- **[INFO]** 보안 통제(credential 마스킹·외부 fanout strip) 로직은 원 파일에 그대로 남아 무결
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (`CREDENTIAL_KEY_PATTERN`
    선언부·`sanitizePayloadForWs`·`stripExternalOnlyFields` 호출부, `attachRoutingContext`)
  - 상세: `websocket-events.types.ts` 로 옮겨간 것은 값(enum)·타입(interface/type) 선언뿐이다.
    `CREDENTIAL_KEY_PATTERN` 정규식, `sanitizePayloadForWs`/`sanitizeInner`의 재귀 마스킹·depth
    상한(`MAX_SANITIZE_DEPTH`)·캐시 로직, `stripExternalOnlyFields` 호출, `NotificationsChannelAuthorizer`
    가드에 대한 참조 주석은 전부 `websocket.service.ts`에 원문 그대로 남아 있다. `git diff`로 확인한
    결과 이 파일의 구현부(클래스 본문)는 import/export 선언 블록 외에 문자 단위로 변경되지 않았다.
    타입 전용 모듈로 선언을 옮기는 리팩터가 보안 검증 로직 자체를 우회하거나 약화시키지 않았음을
    직접 소스 대조로 확인했다.
  - 제안: 조치 불필요 — 확인용 기록.

- **[INFO]** `TERMINAL_SHAPE` 모듈 스코프 부활은 안전 — export 되지 않는 module-private 상수이며
  파생 값이 동일
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (`TERMINAL_SHAPE` 선언, `emitTerminalExecution` 메서드)
  - 상세: 새 상수는 `export` 되지 않아 외부에서 직접 참조·뮤테이션할 표면이 없고, `{eventType,
    status}` 매핑 값 자체는 이전 호출-시점 인라인 리터럴과 동일하다(구조·값 불변, 조회 시점만
    변경). 안전성의 근거인 "`websocket-events.types.ts` 는 import 0줄이라 순환에 참여하지 않는다"는
    전제를 `websocket-events.types.spec.ts` 첫 테스트(`moduleSpecifiersOf(sf)` 가 `[]`)가 정적으로
    강제하며, 직접 확인 결과 실제로 import 문이 없다. `wire.error = payload.error` /
    `wire.result = { cancelledBy }` 조립 로직은 이번 diff 로 변경되지 않았다(리터럴 인라인 객체 →
    상수 참조로 껍데기만 바뀜).
  - 제안: 조치 불필요.

- **[INFO]** (범위 밖, 기존 설계 — 참고용) 종결 이벤트의 `error` 필드는 credential-key 패턴 마스킹만
  거치고 `sanitizeErrorMessage` 계열의 메시지 새니타이징은 거치지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    의 `emitTerminalExecution`(`wire.error = payload.error`) → 이후 `WebsocketService.emitExecutionEvent`
    의 `sanitizePayloadForWs(payload)`
  - 상세: 이 흐름은 이번 diff 이전부터 존재하던 기존 설계이며, 이번 라운드가 로직을 건드리지
    않았다. `sanitizePayloadForWs` 는 키 이름이 `CREDENTIAL_KEY_PATTERN` 에 매칭될 때만 값을
    통째로 `[REDACTED]` 로 바꾸므로, `error.message` 같은 자유 텍스트 필드에 스택트레이스·내부
    경로 등이 섞여 있어도 이 경로에서 걸러지지 않는다. 직전 라운드(`19_27_37`) 의 security 리뷰가
    이미 동일 항목을 "새로 도입된 결함이 아니라 기존 설계이므로 참고용" 으로 명시 기재했고, 그
    RESOLUTION 에서도 "별도 turn" 으로 무조치 처분됐다. 이번 diff 의 changeset 범위(순수 import
    경로 교체 + `TERMINAL_SHAPE` 껍데기 변경)에는 해당하지 않아 이번 판정에 영향 없음.
  - 제안: (범위 밖 참고) `TerminalErrorPayload` 를 채우는 모든 호출부가 `sanitizeErrorMessage`
    계열 유틸을 거치는지는 별도 턴에서 전수 확인할 사항 — 이번 PR 을 막을 사유 아님.

- **[INFO]** 신설 정적 가드(`websocket-events.types.spec.ts`)는 프로덕션 요청 경로가 아니라
  테스트 시점 로컬 파일 AST 분석이라 공격 표면 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (전체)
  - 상세: `fs.readFileSync`/`ts.createSourceFile` 로 저장소 자신의 `.ts` 파일을 순회해 import
    그래프를 정적으로 검사하는 CI 전용 테스트다. 외부 입력을 받지 않고 네트워크·DB·사용자 데이터를
    다루지 않으므로 인젝션/인증/암호화 관점의 취약점 표면이 없다. 로컬 별칭(`as`) 을 이용한 가드
    우회 버그(`el.name` vs `el.propertyName ?? el.name`)가 있었으나 이번 diff(마지막 커밋
    `e8585b574`)로 이미 교정되어 `originalName` 헬퍼가 원 export 식별자 기준으로 판정한다 — 가드
    자체의 정확성 문제이지 런타임 보안 취약점은 아니다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `websocket.service.ts` 가 겸하던 "런타임 값(enum)·타입 선언"을 의존성-프리 모듈
(`websocket-events.types.ts`)로 추출해 ES-module 순환 위 모듈-스코프 평가가 `undefined` 로
터지던 버그(#1174)를 근본 해소하는 순수 내부 리팩터다. 새 엔드포인트·사용자 입력 처리 경로·인증
/인가 로직·암호화·시크릿 관리 변경이 전혀 없으며, 기존 보안 통제(`CREDENTIAL_KEY_PATTERN` 키
마스킹, `stripExternalOnlyFields` 외부 fanout strip, `NotificationsChannelAuthorizer` 채널
인가)는 원본 `websocket.service.ts`에 문자 단위로 그대로 남아 있음을 직접 소스 대조로 확인했다.
유일한 런타임 동작 변경(`TERMINAL_SHAPE` 모듈 스코프화)은 값이 동일하고 export 되지 않는
module-private 상수이며, 그 안전성의 전제(신규 모듈의 import 0줄)를 신설 정적 가드가 강제한다.
직전 두 라운드(`19_27_37`, `20_05_17`) 의 security 리뷰가 이미 이 리팩터 전체를 NONE 위험으로
결론 냈고, 이번 라운드에 추가된 코드(가드 alias 판정 버그 수정 등)는 프로덕션 요청 경로가 아닌
테스트-전용 정적 분석 코드라 신규 보안 위험을 도입하지 않는다. 하드코딩된 시크릿, 인젝션 벡터,
인증/인가 우회, 안전하지 않은 암호화, 신규 의존성 취약점은 발견되지 않았다.

## 위험도

NONE
