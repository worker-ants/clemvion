# 요구사항(Requirement) 리뷰 — webhook 인증 1MB 게이트 + 공개 webhook 보호 fix

## 발견사항

### [INFO] 기능 완전성 — 모든 핵심 요구사항 구현 확인

- 위치: 전체 변경셋
- 상세: WH-NF-02 옵션 C(인증 webhook 1MB / 공개 webhook 32KB / non-hooks 100KB 삼중 분리), WH-EP-04(JSON + form-urlencoded), 413 표준 봉투(`PAYLOAD_TOO_LARGE`), 공개 webhook 보호 우회 버그 수정, rawBody 보존(HMAC 호환), W14 DB 왕복 제거, `HOOKS_MAX_BODY_BYTES` env override, 16MB 상한 클램프 — 모두 코드에 존재하고 e2e J/K/L/M 으로 검증됨.
- 제안: 없음.

### [INFO] 엣지 케이스 — 빈 본문 rawBody 처리 적절

- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L61
- 상세: `captureRawBody` 의 `if (buf)` 조건은 빈 Buffer(`length === 0`)를 falsy 로 처리하지 않는다 — JS 에서 빈 Buffer 객체는 truthy 이므로 `if (buf)`는 빈 Buffer 도 세팅한다. 의도와 구현이 일치. 이전 RESOLUTION W3 수정 결과가 정확함.
- 제안: 없음.

### [INFO] 엣지 케이스 — `resolveHooksMaxBodyBytes` 부동소수 처리

- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L43-44
- 상세: `Math.floor` 로 소수 내림 처리, `0` 및 음수는 기본값 반환, `Infinity` / `NaN` / 빈 문자열 모두 `Number.isFinite` 실패로 기본값 반환. spec 에 override 세부 규칙은 기술되지 않으나 구현이 안전 방향.
- 제안: 없음.

### [INFO] 엣지 케이스 — W14 `preloadedTrigger` null/undefined 구분

- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` L104-109
- 상세: `preloadedTrigger !== undefined` 로 `null`(미존재 trigger)과 `undefined`(파라미터 미전달, 폴백 조회)를 명확히 구분. Guard 가 trigger 를 찾지 못한 경우 `null` 을 첨부하고, 컨트롤러가 그대로 서비스에 전달하면 폴백 DB 조회 없이 `null` 사용 후 NotFoundException 을 올바르게 발생시킴.
- 제안: 없음.

### [INFO] 비즈니스 로직 — 공개 webhook 32KB 이중 게이트 순서 정확

- 위치: `public-webhook-throttle.guard.ts` L92-100, `hooks-body-parser.ts` L82-86
- 상세: spec WH-NF-02 의 "공개 webhook 은 그 위에서 `PublicWebhookThrottleGuard` 가 32KB 추가 제한"이 코드에 정확히 구현됨. 라우트 스코프 1MB 파서가 먼저 파싱하고(`rawBody` 세팅), Guard 가 `rawBody.length` 를 사용해 32KB 체크. Guard 가 `rawBody` 가 없으면 `JSON.stringify` 추정으로 폴백하는 보수적 처리도 구현됨.
- 제안: 없음.

### [INFO] 반환값 — mapHttpErrorLike 모든 경로 처리 완전

- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L104-117
- 상세: 4xx (400-499) 는 `getCodeFromStatus` 매핑, 나머지(5xx·상태 없음) 는 `null` 반환으로 호출부가 generic 500 처리. `getCodeFromStatus` 의 413 case(`PAYLOAD_TOO_LARGE`) 추가됨. spec 2-api-convention.md §5.3 의 상태코드별 기본값(`413=PAYLOAD_TOO_LARGE`) 과 정확히 일치.
- 제안: 없음.

### [INFO] spec fidelity — `HOOKS_MAX_BODY_BYTES_CEILING`(16MB) spec 미기재

- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L22-23
- 상세: env override 상한 16MB 클램프는 코드에만 존재하며 spec/5-system/12-webhook.md WH-NF-02 본문에 명시되지 않음. spec WH-NF-02 는 "`HOOKS_MAX_BODY_BYTES` env 로 override 가능"까지만 기술하고 상한은 언급하지 않는다. 구현이 합리적이고 의도적인 보호(OOM 방지)이므로 코드 버그가 아니라 spec 에 반영해야 할 사항이다.
- 제안: [SPEC-DRIFT] 코드 유지 + spec/5-system/12-webhook.md WH-NF-02 본문에 "`HOOKS_MAX_BODY_BYTES` env override 상한 `HOOKS_MAX_BODY_BYTES_CEILING`(기본 16MiB — OOM 방지 클램프)" 항목 추가.

### [INFO] spec fidelity — `HOOKS_ROUTE_PREFIX` 상수 export spec 미기재

- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L4-5
- 상세: `HOOKS_ROUTE_PREFIX = '/api/hooks'` 상수가 명시적으로 export 되어 `main.ts` 가 사용하는 것은 코드 품질 향상(하드코딩 제거)이나 spec 에 언급 없음. 의도적 개선이므로 spec 갱신 대상.
- 제안: [SPEC-DRIFT] 코드 유지 + spec/5-system/12-webhook.md §6 구현 파일 구조에 `hooks-body-parser.ts` 의 `HOOKS_ROUTE_PREFIX` export 언급 추가 또는 WH-NF-02 구현 설명에 통합.

### [INFO] TODO/FIXME 부재 확인

- 위치: 전체 변경셋
- 상세: 모든 TODO/FIXME/HACK/XXX 주석 부재. 미완성 작업 없음.
- 제안: 없음.

### [INFO] 에러 시나리오 — Guard DB 조회 실패 시 fail-open 정책 유지

- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L75-81
- 상세: trigger 조회 실패 시 `logger.warn` 후 `true` 반환(통과). spec 에서 명시적으로 정의되지 않은 에러 시나리오이나 구현이 방어적으로 처리됨. Guard 의 목적이 선택적 보호(throttle)이므로 fail-open 이 적절하며, 후속 HooksService 가 정식 처리.
- 제안: 없음.

### [INFO] 데이터 유효성 — `mapHttpErrorLike` 4xx 범위 메시지 노출

- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L113
- 상세: 4xx http-error 의 `exception.message` 를 응답 body 에 직접 포함. 현재 발행처는 body-parser 뿐이고 메시지는 표준 문자열(무해)이나, 향후 다른 http-errors 발행처가 추가될 경우 내부 정보 노출 가능성 있음. RESOLUTION W5 에서 `logger.warn` 은 추가됐으나 응답 메시지 sanitize 는 의도적으로 INFO 로 남겨짐.
- 제안: 향후 http-errors 의존 추가 시 메시지 허용 목록 검토.

---

## 요약

WH-NF-02 옵션 C(인증 webhook 1MB / 공개 32KB / non-hooks 100KB 삼중 분리 임계) 구현, 공개 webhook 보호 전량 우회 버그 수정(TypeORM partial projection null 오동작 교정), 413 표준 봉투 매핑(`PAYLOAD_TOO_LARGE`) — 세 가지 핵심 목표가 모두 완전히 구현되었다. spec WH-NF-02 / WH-EP-04 / WH-SC-02(rawBody HMAC 호환) / WH-RS-02(404) / WH-EP-07 등 관련 요구사항 ID 와 line-level 로 일치하며, api-convention §5.3 의 413=`PAYLOAD_TOO_LARGE` 매핑도 정확히 반영됐다. RESOLUTION 에서 수정된 W1(W14 DB 왕복 제거), W2(rawBody 주석 명문화), W3(빈 본문 rawBody 세팅), W5(warn 로깅), W6(헬퍼 추출) 등도 코드에 모두 반영되어 있다. 발견된 SPEC-DRIFT 2건(env 상한 16MB·HOOKS_ROUTE_PREFIX)은 코드 버그가 아니라 spec 갱신 누락이며, 코드 변경 없이 spec 에만 반영하면 된다. 요구사항 미충족 또는 누락 항목 없음.

## 위험도

NONE
