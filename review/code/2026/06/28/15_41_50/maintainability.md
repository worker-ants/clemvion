# 유지보수성(Maintainability) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[INFO]** `hooks-body-parser.ts` — 상수·함수 네이밍 일관성 우수
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING`, `GLOBAL_MAX_BODY_BYTES` 등 모든 상수가 동일 네이밍 패턴(`SCREAMING_SNAKE_CASE`, 도메인 prefix)을 따른다. `resolveHooksMaxBodyBytes`, `createHooksBodyParsers`, `createGlobalBodyParsers` 함수명은 각각 "해석", "생성" 의도를 명확히 드러낸다. `buildBodyParsers` 내부 헬퍼 분리로 중복 코드가 제거됐다.
- 제안: 현행 유지.

### **[INFO]** `buildBodyParsers` 헬퍼 추출 — 중복 제거 패턴 적절
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L224–229
- 상세: `createHooksBodyParsers`와 `createGlobalBodyParsers` 둘 다 `[json(...), urlencoded(...)]` 쌍을 반환하는 구조였을 때의 중복을 `buildBodyParsers(maxBytes)` 로 단일화했다. 추후 파서 쌍 구성이 바뀔 때 한 곳만 수정하면 된다.
- 제안: 현행 유지.

### **[INFO]** `resolveHooksMaxBodyBytes` — 순수 함수 + env injection 패턴, 단위 테스트 용이
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L186–202
- 상세: `env: NodeJS.ProcessEnv = process.env` 기본값으로 외부 env를 주입 가능하게 해 테스트에서 `process.env` 조작 없이 다양한 케이스를 검증할 수 있다. `hooks-body-parser.spec.ts`가 이를 활용해 6개 경계 케이스를 깔끔하게 커버한다.
- 제안: 현행 유지.

### **[INFO]** `captureRawBody` 함수 — `if (buf)` 조건 의도 불명확
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L218
- 상세: `if (buf)` 단순 truthy 체크인데, 빈 `Buffer`(`length === 0`)는 truthy 이므로 빈 본문도 세팅된다. JSDoc에 "빈 Buffer도 그대로 세팅해 빈 본문 서명 검증이 깨지지 않게 한다"고 설명돼 있어 의도는 명확하나, 함수 본문 안에 그 이유를 인라인 주석으로 보완하면 미래 독자가 `if (buf)` 를 "빈 버퍼 방어"로 오해하거나 조건을 `if (buf && buf.length)` 로 "개선"하려는 실수를 막을 수 있다.
- 제안: `if (buf) {` 라인에 `// 빈 Buffer(length===0)도 포함 — 빈 본문 HMAC 검증 보존` 인라인 주석 추가.

### **[INFO]** `HttpErrorLike` 타입 — 파일 내 타입 위치 적절
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L394
- 상세: `type HttpErrorLike = { status?: number; statusCode?: number }` 를 파일 상단에 선언해 `mapHttpErrorLike` 메서드의 캐스팅 의도가 타입으로 문서화됐다. `Error & HttpErrorLike` 캐스팅이 `mapHttpErrorLike` 메서드 안에서만 쓰이므로 범위가 적절히 제한돼 있다.
- 제안: 현행 유지.

### **[INFO]** `mapHttpErrorLike` private 헬퍼 — 중첩 깊이 감소, 책임 분리 적절
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L433–446
- 상세: 이전에 `exception instanceof Error` 분기 안에 인라인으로 있었을 http-errors 처리 로직을 `mapHttpErrorLike` 로 추출해 `catch()` 메서드의 중첩 깊이를 줄였다. 반환 타입 `{ status: number; code: string; message: string } | null` 이 명시적이어서 호출부에서 타입 narrowing이 자연스럽다.
- 제안: 현행 유지.

### **[INFO]** `getCodeFromStatus` — `case 413` 추가 위치 순서 일관
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L455–456
- 상세: `switch` 문의 HTTP 상태 코드 순서(400→401→403→404→409→413→422→429)에 맞게 413 case가 409와 422 사이에 삽입됐다. 숫자 정렬 순서 유지로 가독성 일관.
- 제안: 현행 유지.

### **[INFO]** `main.ts` body-parser 등록 — 주석 과다 여부
- 위치: `/codebase/backend/src/main.ts` L503–521
- 상세: 부트스트랩 블록에 `bodyParser: false` 이유·rawBody 대체·idempotency 가드·hooks vs 전역 순서를 설명하는 주석이 상세하다. 이 복잡한 미들웨어 순서 의존성은 추후 실수가 발생하기 쉬운 지점이므로 주석 수준이 과하다기보다 적절하다. 다만 `// (Spec 12-webhook §6·§8.)` 처럼 spec 참조가 주석 말미에 압축돼 있어 위치 기반으로 따라가기 쉽다.
- 제안: 현행 유지.

### **[INFO]** `PublicWebhookReqExtension` 인터페이스 export — 암묵적 req 변이 타입 계약 명시
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (import 추가)
- 상세: Guard가 `req.__publicWebhookTrigger` 에 trigger를 첨부하는 패턴(W14)이 `PublicWebhookReqExtension` 인터페이스로 타입화돼 있고, `HooksController`가 이를 import해 req 타입에 교차(`&`)한다. 암묵적 req 변이 채널임에도 타입 계약이 명시적이어서 유지보수 시 추적 가능하다.
- 제안: 현행 유지.

### **[INFO]** `HooksService.handleWebhook` — 선택적 파라미터 `preloadedTrigger?` 추가 방식
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` L597
- 상세: `preloadedTrigger?: Trigger | null` 을 함수 마지막 파라미터로 추가해 기존 호출부(다른 경로가 있다면)가 영향받지 않는다. `preloadedTrigger !== undefined ? preloadedTrigger : await this.triggerRepository.findOne(...)` 패턴은 `null` 을 "trigger 없음(공개 webhook이 아님)"과 `undefined`("Guard가 첨부 안 함, 직접 조회 필요")를 구분하는 의도가 명확하다. 단, `null`과 `undefined`의 의미 구분이 미묘해 주석 없이는 독자가 혼동할 수 있다.
- 제안: 함수 파라미터 JSDoc 주석(이미 존재)이 이 구분을 설명하고 있어 현행 수준으로 충분. 현행 유지.

### **[INFO]** e2e 케이스 레이블(`J`, `K`, `L`, `M`, `N`) — 알파벳 순서와 주제 그룹 혼용
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` L717–800
- 상세: 기존 케이스(`A`~`I`)는 알파벳 순서이나, `J`/`K`/`L`/`M`은 "본문 크기 경계" 주제로 묶여 있고 `N`이 그 뒤에 삽입됐다. 주석으로 "주제 그룹으로 의도적 인접 배치"를 명시해 의도는 전달됐다. 그러나 `F`가 `N` 이후에 위치(`L` 다음이 `F`)하는 구조는 파일을 처음 읽는 독자에게 혼란을 줄 수 있다.
- 제안: 현행 구조와 주석 유지. 향후 케이스 추가 시 이 파일의 레이블 부여 정책을 팀 내에서 합의하면 좋다.

### **[INFO]** `spec-link-integrity.test.ts` — 매직 넘버 `30_000`
- 위치: `/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` L831`
- 상세: `}, 30_000)` 타임아웃이 숫자 리터럴로 하드코딩돼 있다. 값 자체(`30s`)의 의도는 이전 줄 주석에서 설명되므로 이해에는 문제없다. `_` 구분자(숫자 가독성) 사용은 기존 코드(`1100 * 1024` 같은 연산식)보다 나은 선택이다.
- 제안: 의도 설명 주석이 충분하므로 현행 유지. 상수화(`const SPEC_LINK_INTEGRITY_TIMEOUT_MS = 30_000`)는 선택적 개선.

### **[INFO]** `hooks-body-parser.spec.ts` — 테스트 설명 언어 일관성
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts`
- 상세: 테스트 설명이 영어로 작성돼 있는 반면, e2e 파일(`webhook-trigger.e2e-spec.ts`)의 새 케이스와 `public-webhook-throttle.guard.spec.ts` 추가 케이스는 한국어 설명을 사용한다. 프로젝트 내 테스트 설명 언어가 혼재한다.
- 제안: 동일 파일 내 일관성은 유지돼 있어 큰 문제는 아니나, 향후 신규 테스트 파일 작성 시 언어 기준을 통일하면 일관성이 향상된다.

### **[INFO]** CHANGELOG.md — 항목 설명 길이 적절성
- 위치: `/CHANGELOG.md` L38–43
- 상세: 각 항목 설명이 기술 맥락을 풍부하게 담고 있으나 한 문장이 매우 길다(특히 "변경 사항 1" 항목). CHANGELOG는 향후 릴리스 노트로도 활용되므로, 독자(비개발자 포함)가 핵심만 빠르게 파악하기 어려울 수 있다.
- 제안: 현재 프로젝트 컨텍스트에서는 상세 내용이 내부 추적에 유용하므로 허용 수준. 외부 릴리스 시 요약본 별도 작성 권장.

---

## 요약

이번 변경은 유지보수성 측면에서 전반적으로 우수한 수준이다. `hooks-body-parser.ts`는 상수·순수 함수·팩토리 함수가 명확히 분리되고 네이밍이 일관적이며, 단위 테스트가 env injection 패턴으로 깔끔하게 작성됐다. `GlobalExceptionFilter`의 `mapHttpErrorLike` 헬퍼 추출은 중첩 깊이를 낮추고 책임을 분리해 가독성을 높였다. `PublicWebhookReqExtension` 인터페이스 export와 `preloadedTrigger` 파라미터 설계는 암묵적 의존성을 타입으로 명시화해 코드 추적을 용이하게 한다. `captureRawBody`의 `if (buf)` 의도를 인라인 주석으로 보완하고, e2e 케이스 레이블 정책을 명시하는 것이 잠재적 혼란을 추가로 줄일 수 있는 유일한 개선 포인트이나, 모두 INFO 수준의 경미한 사항이다.

---

## 위험도

NONE
