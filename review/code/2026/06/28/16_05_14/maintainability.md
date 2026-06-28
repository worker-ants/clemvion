# 유지보수성(Maintainability) 리뷰 — 이전 리뷰 산출물 changeset

## 발견사항

이번 changeset 의 실질적 코드 변경 대상 파일은 다음과 같다.

- `/codebase/backend/src/bootstrap/hooks-body-parser.ts` (신규)
- `/codebase/backend/src/common/filters/http-exception.filter.ts` (수정)
- `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (수정)
- `/codebase/backend/src/modules/hooks/hooks.service.ts` (수정)

나머지(review/, consistency/ 산출물, spec 문서, plan 파일)는 마크다운/JSON 비코드 파일로 유지보수성 코드 분석 대상 외이므로 코드 파일 중심으로 분석한다.

---

### **[INFO]** `hooks-body-parser.ts` — 상수·순수 함수·팩토리 계층 분리 우수
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING`, `GLOBAL_MAX_BODY_BYTES` 세 상수가 `SCREAMING_SNAKE_CASE` + 도메인 prefix 를 일관되게 따르고, 각 상수에 JSDoc 이 의도(spec 참조, env override 범위, 다른 레이어와의 관계)를 설명한다. `resolveHooksMaxBodyBytes` → `buildBodyParsers` → `createHooksBodyParsers` / `createGlobalBodyParsers` 의 3계층 분리가 명확하고, 각 함수 이름이 "해석", "생성" 의도를 직접 표현한다.
- 제안: 현행 유지.

### **[INFO]** `buildBodyParsers` 내부 헬퍼 — 중복 제거 적절
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L80–85
- 상세: `createHooksBodyParsers` 와 `createGlobalBodyParsers` 가 공통으로 필요한 `[json(...), urlencoded(...)]` 쌍 생성 로직을 `buildBodyParsers` 로 단일화해 중복을 제거했다. 추후 파서 쌍 구성이 변경될 때 한 곳만 수정하면 된다.
- 제안: 현행 유지.

### **[INFO]** `captureRawBody` — `if (buf)` 의도를 인라인 주석으로 보강
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L73–74
- 상세: `if (buf)` 에 "빈 Buffer(length===0)도 세팅 — 빈 본문 서명 검증을 위해. `buf.length` 체크 재도입 금지." 인라인 주석이 추가되어 있어 의도가 코드 위치에 명시적으로 보존된다. JSDoc 과 인라인 주석이 모두 이 의도를 설명하므로 독자가 방어 조건을 "개선"하려는 실수를 막기에 충분하다.
- 제안: 현행 유지.

### **[INFO]** `resolveHooksMaxBodyBytes` — env injection 패턴, 단위 테스트 용이
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L41–57
- 상세: `env: NodeJS.ProcessEnv = process.env` 기본값으로 외부 env 를 주입 가능하게 해 테스트에서 `process.env` 조작 없이 다양한 케이스를 검증할 수 있다. 함수 내 제어 흐름(NaN 체크 → 음수/0 체크 → 분수 처리 → ceiling 클램프)이 평탄하고 각 분기에 주석 또는 JSDoc 이 의도를 설명한다.
- 제안: 현행 유지.

### **[INFO]** `GlobalExceptionFilter` — `HttpErrorLike` 타입 alias 위치 적절
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L14
- 상세: `type HttpErrorLike = { status?: number; statusCode?: number }` 를 파일 상단에 선언해 `mapHttpErrorLike` 메서드의 캐스팅 의도가 타입으로 문서화됐다. 이 타입이 파일 외부로 export 되지 않고 filter 내부에서만 사용되므로 범위가 적절히 제한돼 있다.
- 제안: 현행 유지.

### **[INFO]** `mapHttpErrorLike` private 헬퍼 추출 — 중첩 깊이 감소
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L104–117
- 상세: http-errors 처리 로직을 `mapHttpErrorLike` 로 추출해 `catch()` 최상위의 if-else 중첩 깊이를 줄였다. 반환 타입 `{ status: number; code: string; message: string } | null` 이 명시적이어서 호출부에서 null 체크로 자연스럽게 분기된다.
- 제안: 현행 유지.

### **[INFO]** `getCodeFromStatus` — `case 413` 삽입 위치 순서 일관
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L131–132
- 상세: switch 문의 HTTP 상태 코드 순서(400→401→403→404→409→413→422→429)에 따라 413 case 가 409 와 422 사이에 삽입됐다. 숫자 정렬 순서 유지로 신규 case 를 추가할 때 위치를 찾기 쉽다.
- 제안: 현행 유지.

### **[INFO]** `PublicWebhookThrottleGuard` — SRP 관점 세 책임 혼재, 단기 허용
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: Guard 가 (1) trigger 조회 + 공개 여부 판정, (2) body 크기 제한(32KB), (3) IP 단위 rate-limit 세 책임을 가진다. 세 관심사가 "공개 webhook 남용 방어"라는 단일 도메인에 속해 현재 범위에서는 합리적이나, `extractClientIp` 함수가 guard 파일에 export 돼 있어 모듈 경계가 약간 모호하다. 파일 하단 JSDoc 에 "04 후속: `auth/utils/client-ip` 단일 구현으로 통합" 기술 부채가 명시 추적 중이다.
- 제안: 현행 단기 허용. `extractClientIp` 를 `auth/utils/client-ip` 로 이동하는 중기 리팩토링으로 모듈 경계 명확화 권장.

### **[INFO]** `req.__publicWebhookTrigger` — 암묵적 req 변이를 타입으로 계약 명시
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L152–155
- 상세: `PublicWebhookReqExtension` 인터페이스를 export 해 Guard 가 req 를 변이시키는 채널의 타입 계약을 명시했다. 이 인터페이스가 없으면 암묵적 채널이 될 요소를 타입 계약으로 끌어올려 유지보수 시 추적 가능하다. 다만 인터페이스 필드명 `__publicWebhookTrigger` 의 `__` prefix 가 Node.js 내부 관례와 유사해 혼동 여지가 있는데, 이는 기존 코드베이스 관행 내의 선택이다.
- 제안: 현행 유지. 향후 Guard 에서 req 에 첨부하는 패턴이 늘어나면 공통 req 확장 타입 집계 모듈(예: `request-extensions.d.ts`) 도입 검토.

### **[INFO]** `HooksService.handleWebhook` — `preloadedTrigger?` 파라미터 설계
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` L85–86
- 상세: `preloadedTrigger?: Trigger | null` 을 마지막 파라미터로 추가해 기존 호출부가 영향받지 않는다. `preloadedTrigger !== undefined ? preloadedTrigger : await findOne(...)` 패턴이 `null`(trigger 미존재)과 `undefined`(Guard 미전달 — 직접 조회 필요)를 명시적으로 구분한다. 파라미터 바로 위 JSDoc 주석이 이 구분("W14 — 중복 DB 왕복 제거", "가드의 조회 쿼리와 동일") 을 설명하므로 독자가 의도를 오해할 여지가 낮다.
- 제안: 현행 유지.

### **[INFO]** `canActivate` 메서드 — 제어 흐름이 평탄, 중첩 깊이 적절
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L53–124
- 상세: early return 패턴을 사용해 각 분기 후 즉시 반환하거나 throw 해 중첩 깊이가 최대 2수준이다. 1~4 주제 블록 주석으로 각 절이 무엇을 하는지 명확히 구획됐다. 70줄 분량의 메서드이나 각 블록이 독립적 관심사를 담고 있어 복잡도가 실제보다 높게 느껴지지 않는다.
- 제안: 현행 유지.

### **[WARNING]** `canActivate` 내 `extractClientIp` 호출 — Guard 파일 내 유틸 함수 위치
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L105
- 상세: `extractClientIp` 가 Guard 파일 하단에 export 함수로 정의돼 있다. 이 함수는 Guard 의 핵심 책임(공개 webhook 남용 방어)과 관련이 있으나, `extractClientIpFromHeaders` 의 래퍼 역할만 한다. 현재 파일에서만 소비되는 것이 아니라 export 돼 있어 다른 파일이 이 유틸을 guard 파일에서 import 하는 상황이 발생하면 의존 방향이 부적절해진다. 파일 JSDoc 에 이동 계획이 명시되어 있다.
- 제안: `auth/utils/client-ip` 로 이동 리팩토링 시 이 export 를 제거해 Guard 파일의 공개 API 를 `PublicWebhookThrottleGuard` 클래스와 `PublicWebhookReqExtension` 인터페이스로 제한하는 것을 권장.

---

## 요약

이번 변경은 유지보수성 측면에서 전반적으로 높은 수준이다. `hooks-body-parser.ts` 는 상수·순수 함수·팩토리 함수가 명확히 분리되고 네이밍이 일관적이며, JSDoc 과 인라인 주석이 설계 의도를 코드 위치에 충분히 보존한다. `GlobalExceptionFilter` 의 `mapHttpErrorLike` 헬퍼 추출은 중첩 깊이를 낮추고 책임을 분리해 가독성을 높였으며, `getCodeFromStatus` 의 switch case 순서 유지가 새로운 case 추가 시 유지보수를 용이하게 한다. `HooksService` 의 `preloadedTrigger` 파라미터 설계는 null/undefined 의미 구분을 주석으로 명시해 미래 독자의 혼동을 예방한다. 유일한 WARNING 은 `PublicWebhookThrottleGuard` 파일에 `extractClientIp` 유틸이 export 돼 있어 모듈 경계가 약간 열려 있는 점이며, 이는 파일 내 JSDoc 에 이미 이동 계획이 기술 부채로 명시 추적 중이다. 중복 코드, 과도한 중첩, 매직 넘버, 순환 복잡도 상승 측면에서 신규 도입 문제는 없다.

---

## 위험도

LOW

STATUS: SUCCESS
