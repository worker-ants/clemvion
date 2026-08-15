# Security Review — `21_14_51`

## 검토 방법

프롬프트에 실린 unified diff(38개 파일 중 실제 코드 27개)에 더해 `git diff origin/main...HEAD --stat -- codebase/`
로 코드 변경 전체(27개 backend 파일, 705 insertions / 313 deletions)를 실측했다. 핵심 파일은 전체 소스를
직접 `Read`:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (신설, 전체 265줄 — 값/타입 선언만)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (`CREDENTIAL_KEY_PATTERN` 마스킹,
  `sanitizePayloadForWs`/`sanitizeInner`, `stripExternalOnlyFields` 호출부 — 구현부 원문 대조)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (이전 라운드가 지적했던 잔여 순환
  edge — `import { ExecutionEventType } from './websocket-events.types'` 로 이미 전환 확인)
- `git diff dc565afbf..HEAD -- codebase/` 로 직전 리뷰 라운드(`20_50_49`) 이후 새로 추가된 변경만
  분리 확인 — `websocket-events.types.spec.ts` 의 module-edge enumeration 통합(`moduleRefs` 헬퍼)과
  나머지 파일의 `import { X }` → `import { type X }` 전환 5건뿐, 프로덕션 런타임 로직 변경 없음.
- `package.json`/`package-lock.json`/`pnpm-lock.yaml` diff 없음 확인, 하드코딩 시크릿 패턴
  (password/token/BEGIN …KEY 등) grep — 매칭은 전부 `CREDENTIAL_KEY_PATTERN` 정규식 소스 자체 또는
  변수/함수명(`deepRedactSecrets`, `InteractionTokenService`)뿐, 실제 시크릿 리터럴 없음.

이번 diff 는 동일 세션의 4차 연속 리뷰 라운드(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`)를 거친
PR 로, 각 라운드 security.md 가 모두 위험도 NONE 으로 결론냈다. 이번 라운드는 그 이후 변경분만
증분 검증했다.

## 변경 개요

`websocket.service.ts` 가 함께 export 하던 enum/interface/type 15종을 의존성-프리 신규 모듈
`websocket-events.types.ts` 로 추출하고, 22개 소비 지점의 import 경로를 갱신하는 **순수 리팩터**다
(#1174 — ES-module 순환 위 모듈 스코프 enum 평가가 `undefined` 로 터지는 버그의 근본 해소). 유일하게
런타임 동작이 바뀌는 지점은 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 를 호출-시점
인라인 파생에서 모듈-스코프 상수로 되돌린 부분인데, 산출 값 자체는 리터럴이 상수 참조로 바뀌었을
뿐 동일하다. 나머지는 순환 재편입을 막는 정적 가드 테스트(`websocket-events.types.spec.ts`)의
판별 로직 강화(직전 3라운드에 걸쳐 놓친 module-edge 형태를 `moduleRefs` 단일 헬퍼로 통합)와
`import type` 표기 정리다.

## 발견사항

- **[INFO]** 보안 통제(credential 마스킹·외부 fanout strip) 로직은 원 파일에 그대로 남아 무결
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `CREDENTIAL_KEY_PATTERN`
    선언부, `sanitizePayloadForWs`/`sanitizeInner` 재귀 마스킹, `stripExternalOnlyFields` 호출부
  - 상세: `websocket-events.types.ts` 로 옮겨간 것은 값(enum)·타입(interface/type) 선언뿐이다.
    `CREDENTIAL_KEY_PATTERN` 정규식, depth 상한(`MAX_SANITIZE_DEPTH`)·캐시 로직, strip 호출은
    문자 단위로 원문 그대로다. 클래스 구현부(`WebsocketService`)는 import/export 선언 블록 외에
    변경되지 않았다.
  - 제안: 조치 불필요 — 확인용 기록.

- **[INFO]** 순환의 두 핵심 노드 중 하나였던 `websocket.gateway.ts` 도 이제 신규 모듈로 전환 완료 —
  직전 라운드(`19_27_37`) architecture WARNING 이 지적했던 갭이 해소됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `import { ExecutionEventType }
    from './websocket-events.types'`
  - 상세: 초기 라운드에서는 이 파일이 옛 경로(`./websocket.service`)로 값 import 를 유지해, 향후
    같은 파일 쌍에서 #1174 급 재발이 가능하다는 지적이 있었다. 현재 코드는 이미 신규 모듈을 직접
    가리키고 있어 그 잔여 리스크가 닫혔다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** `TERMINAL_SHAPE` 모듈 스코프 부활은 안전 — export 되지 않는 module-private 상수이며
  파생 값이 동일
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (`TERMINAL_SHAPE` 상수, `emitTerminalExecution` 메서드)
  - 상세: 새 상수는 `export` 되지 않아 외부에서 직접 참조·뮤테이션할 표면이 없고, `{eventType,
    status}` 매핑 값 자체는 이전 호출-시점 인라인 리터럴과 동일하다. 안전성의 전제("의존성-프리
    모듈은 import 0줄")를 `websocket-events.types.spec.ts` 가 TS AST 로 정적 강제한다(이번 라운드에서
    `moduleRefs` 단일 헬퍼로 통합되며 eager/lazy 구분·`export … from`·`import x = require()`·
    별칭(`as`) 오판정까지 커버하도록 강화됨).
  - 제안: 조치 불필요.

- **[INFO]** (범위 밖, 기존 설계 — 참고용, 3라운드 연속 등재된 항목과 동일) 종결 이벤트의 `error`
  필드는 credential-key 패턴 마스킹만 거치고 `sanitizeErrorMessage` 계열의 메시지 새니타이징은
  거치지 않는다
  - 위치: `execution-event-emitter.service.ts` `emitTerminalExecution` (`wire.error = payload.error`)
  - 상세: 이번 diff 이전부터 존재하던 기존 설계이며 이번 라운드가 로직을 건드리지 않았다.
    `sanitizePayloadForWs` 는 키 이름 매칭 시에만 값을 통째로 마스킹하므로 `error.message` 같은
    자유 텍스트 필드는 이 경로에서 걸러지지 않는다. 직전 세 라운드가 이미 동일 항목을 "새로 도입된
    결함 아님"으로 기재·무조치 처분했다.
  - 제안: (범위 밖) `TerminalErrorPayload` 를 채우는 모든 호출부가 `sanitizeErrorMessage` 계열
    유틸을 거치는지는 별도 turn에서 전수 확인할 사항 — 이번 PR을 막을 사유 아님.

- **[INFO]** 신설/강화된 정적 가드(`websocket-events.types.spec.ts`)는 CI 전용 AST 분석이라 공격
  표면 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (전체)
  - 상세: `fs.readFileSync`/TypeScript compiler API 로 저장소 자신의 `.ts` 파일을 순회하는 테스트
    전용 코드다. 외부 입력·네트워크·DB·사용자 데이터를 다루지 않는다. 이번 라운드에서 판별 로직이
    `originalName`(별칭이 아닌 원 식별자 기준 판정)·`insideFunction`(eager/lazy 구분)·
    `moduleRefs`(import/export-from/import=require/require/dynamic-import 5개 형태 단일 열거)로
    통합되어, 직전 라운드들이 지적했던 "한 칸 좁게 잡은 판정"류 회귀를 구조적으로 막도록 개선됐다 —
    보안 결함이 아니라 가드 정확성 개선.
  - 제안: 조치 불필요.

- **[INFO]** 새 외부 의존성/버전/라이선스 변경 없음
  - 위치: `package.json`/`package-lock.json`/`pnpm-lock.yaml` — diff 없음 확인
  - 제안: 해당 없음.

## 요약

이번 diff 는 `websocket.service.ts` 가 겸하던 런타임 값(enum)·타입 선언을 의존성-프리 모듈로 추출해
ES-module 순환 위 모듈-스코프 평가가 `undefined` 로 터지던 버그(#1174)를 근본 해소하는 순수 내부
리팩터이며, 신규 엔드포인트·사용자 입력 처리 경로·인증/인가 로직·암호화·시크릿 관리 변경이 전혀
없다. 기존 보안 통제(`CREDENTIAL_KEY_PATTERN` 키 마스킹, `stripExternalOnlyFields` 외부 fanout
strip, depth 상한)는 원본 `websocket.service.ts`에 문자 단위로 그대로 남아 있음을 직접 소스 대조로
확인했고, 이전 라운드가 지적했던 잔여 순환 노드(`websocket.gateway.ts`)도 현재는 신규 모듈로
전환 완료된 상태다. 유일한 런타임 동작 변경(`TERMINAL_SHAPE` 모듈 스코프화)은 값이 동일하고
export 되지 않는 module-private 상수이며, 그 안전성의 전제를 신설 정적 가드가 TS AST 로 강제한다.
직전 4개 라운드의 security 리뷰가 이미 이 리팩터 전체를 NONE 위험으로 결론냈고, 이번 라운드에
추가된 변경(가드 판정 로직 통합, `import type` 표기 정리 5건)도 프로덕션 요청 경로가 아닌 테스트
전용 코드/타입 주석뿐이라 신규 보안 위험을 도입하지 않는다. 하드코딩된 시크릿, 인젝션 벡터, 인증/
인가 우회, 안전하지 않은 암호화, 신규 의존성 취약점은 발견되지 않았다.

## 위험도

NONE
