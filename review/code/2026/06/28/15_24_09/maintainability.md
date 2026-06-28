# 유지보수성(Maintainability) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 fix (RESOLUTION 후)

## 발견사항

### **[INFO]** `hooks-body-parser.ts` — 상수·순수함수·팩토리 분리 패턴 우수
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING`, `GLOBAL_MAX_BODY_BYTES` 를 named export 상수로 선언해 매직 넘버를 완전히 제거했다. `resolveHooksMaxBodyBytes` 는 env 를 인자로 받는 순수 함수라 테스트 용이성이 높다. `buildBodyParsers` 공통 팩토리가 이전 리뷰의 INFO 19(중복 구조) 를 해소했다. `captureRawBody` 비공개 함수 네이밍이 책임을 명확히 표현한다. JSDoc 이 상수별 설계 근거(spec 참조 포함)를 상세히 설명한다.
- 제안: 현행 유지.

### **[INFO]** `resolveHooksMaxBodyBytes` — 방어 로직 가독성 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` L236–243
- 상세: `const raw = ...`, `const n = ...`, 조건 분기, `Math.min(Math.floor(n), ...)` 3단계로 명확히 분리돼 있다. 각 단계 의도가 명확하고 중첩이 없다.
- 제안: 현행 유지.

### **[INFO]** `captureRawBody` — `if (buf)` 단순화로 빈 버퍼 케이스 해소
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` L258–262
- 상세: 이전 `if (buf && buf.length)` 조건이 `if (buf)` 로 단순화됐다(W3 조치). TypeScript 타입 기준 `buf` 는 `Buffer` 로 항상 truthy 이므로 `if (buf)` 조건 자체가 사실상 항상 참인 방어 코드이기는 하나, body-parser `verify` 콜백의 공식 시그니처와 런타임 보장을 신뢰하지 못하는 방어 목적이 JSDoc 에 명시돼 있어 허용 가능한 수준이다.
- 제안: 현행 유지.

### **[INFO]** `HttpErrorLike` 타입 추출 — 이중 캐스팅 해소
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts`
- 상세: 이전 리뷰 INFO 22(이중 캐스팅)가 `type HttpErrorLike = { status?: number; statusCode?: number }` 추출로 해소됐다. 타입 정의가 모듈 상단 근처에 JSDoc 과 함께 배치돼 있어 발견성이 높다.
- 제안: 현행 유지.

### **[INFO]** `mapHttpErrorLike` 헬퍼 추출 — 중첩 깊이 해소
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` L578–591
- 상세: 이전 리뷰 W6(중첩 깊이 3단)가 private 헬퍼 `mapHttpErrorLike` 추출로 해소됐다. `catch` 메서드 최상위 흐름이 평탄화됐고 헬퍼가 단일 책임을 가진다. 반환 타입 `{ status, code, message } | null` 이 명시적으로 선언돼 가독성이 높다.
- 제안: 현행 유지.

### **[INFO]** `HOOKS_ROUTE_PREFIX` 상수 export — 하드코딩 제거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` L203
- 상세: 이전 리뷰 INFO 17(`/api/hooks` 하드코딩)이 `HOOKS_ROUTE_PREFIX` export 로 해소됐다. `main.ts` 가 해당 상수를 import 해 사용한다.
- 제안: 현행 유지.

### **[INFO]** e2e 테스트 케이스 J/K/L/M — 주제 그룹 주석으로 의도 명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/test/webhook-trigger.e2e-spec.ts` L851–854
- 상세: 이전 리뷰 W7(알파벳 순서 불일치)에 대해 "본문 크기 경계" 주제 그룹으로 의도적 인접 배치임을 주석으로 명시했다. 레이블이 파일 내 순서와 일치하지 않는 점(J/K/L/M이 F 앞에 위치)은 여전히 존재하나, 주석이 의도를 명확히 설명하므로 유지보수자가 혼란을 겪을 가능성이 낮아졌다.
- 제안: 현행 유지. 다만 향후 케이스 추가 시 레이블 체계 대신 케이스 이름 설명 의존 방식으로 전환하면 순서 충돌이 원천 방지된다.

### **[INFO]** e2e 테스트 J 케이스 — `100 * 1024` 매직 넘버 잔존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/test/webhook-trigger.e2e-spec.ts` (J 케이스 내 `100 * 1024` assertion)
- 상세: 이전 리뷰 INFO 23에서 `GLOBAL_MAX_BODY_BYTES` import 로 대체할 것을 권고했으나, 현재 changeset 에서 수정되지 않았다. `100 * 1024` 자체는 수식 표현으로 의미를 짐작할 수 있지만, `GLOBAL_MAX_BODY_BYTES` 상수가 변경될 경우 테스트만 누락 갱신될 수 있는 드리프트 위험이 있다.
- 제안: `GLOBAL_MAX_BODY_BYTES` 를 `hooks-body-parser.ts` 에서 import 해 교체. 비차단.

### **[INFO]** `main.ts` ↔ `hooks-body-parser.ts` JSDoc 일부 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/main.ts` 부트스트랩 주석, `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` JSDoc
- 상세: 이전 리뷰 INFO 21이 보류됐다. `main.ts` 주석과 `hooks-body-parser.ts` JSDoc 이 `bodyParser: false` 이유, `req._body` idempotency 가드, rawBody 보존 방식을 겹쳐 설명한다. 중복이 경미하고 현행 유지가 결정됐으나, 장기적으로 두 설명 중 하나가 업데이트되지 않으면 오해를 유발할 수 있다.
- 제안: 현행 유지(경미). `hooks-body-parser.ts` JSDoc 을 SoT 로 두고 `main.ts` 주석을 간략 참조로 축약하면 이상적.

### **[INFO]** `PublicWebhookThrottleGuard` 단위 테스트 — `select` 부재 단언 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`
- 상세: 이전 리뷰 INFO 13/24가 `findOne` 이 `select` 없이 호출됨을 단언하는 테스트 추가로 해소됐다. `expect.not.objectContaining({ select: expect.anything() })` 패턴으로 partial projection 재도입을 구조적으로 차단한다. 테스트 설명("보안 회귀 가드")이 목적을 명확히 전달한다.
- 제안: 현행 유지.

### **[INFO]** `hooks-body-parser.spec.ts` — 서술적 테스트 케이스 이름
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.spec.ts`
- 상세: `it.each` 로 경계값(`'0'`, `'-1'`, `'abc'`, `''`, `'NaN'`, `'Infinity'`)을 일괄 검증하는 패턴이 적절하다. 테스트 설명이 기대 동작을 명확히 서술한다. `createHooksBodyParsers`·`createGlobalBodyParsers` 테스트가 함수 반환값 타입(함수 배열, 길이 2)만 검증하는 점은 구현 의존성을 최소화한 좋은 패턴이다.
- 제안: 현행 유지.

### **[INFO]** `http-exception.filter.spec.ts` — `mockHost`·`bodyOf` 헬퍼 추출로 중복 제거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts`
- 상세: `mockHost()` 와 `bodyOf()` 두 헬퍼 함수가 모의 객체 생성과 응답 접근 로직을 중앙화해 각 테스트 케이스가 단언 로직에 집중할 수 있다. 반환 타입이 명시적으로 선언돼 있어 헬퍼 시그니처가 자기 문서화된다.
- 제안: 현행 유지.

### **[INFO]** `hooks.service.ts` — `preloadedTrigger` 파라미터 인라인 삼항 표현
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` L756–761
- 상세: `preloadedTrigger !== undefined ? preloadedTrigger : await this.triggerRepository.findOne(...)` 삼항 표현이 `const trigger = ...` 단일 선언문으로 작성됐다. 중첩이 없고 의도가 명확하다. JSDoc 주석이 파라미터 목적(Guard 재사용, 폴백 조회)을 설명한다.
- 제안: `null` 공여 케이스(guard 가 trigger 를 못 찾은 경우)에 대해 `preloadedTrigger !== undefined` 판별이 올바른지 명확하나, 조건식이 처음 읽으면 `null` 을 "존재"로 허용한다는 의미가 직관에 반할 수 있다. JSDoc 에 `null` 전달 시 동작(trigger 없음으로 처리됨)을 한 줄 추가하면 더 명확해진다. 비차단.

## 요약

이번 변경은 이전 리뷰(15_00_36)의 유지보수성 관련 WARNING 2건(W6 중첩 깊이·W7 알파벳 순서)과 주요 INFO 항목(INFO 17 하드코딩·INFO 19 중복 팩토리·INFO 20 조건 단순화·INFO 22 이중 캐스팅)을 모두 해소했다. `hooks-body-parser.ts` 는 상수·순수 함수·팩토리 3계층으로 책임이 명확히 분리됐고, `GlobalExceptionFilter` 는 `mapHttpErrorLike` 헬퍼와 `HttpErrorLike` 타입 추출로 복잡도가 낮아졌다. 신규 단위 테스트(`hooks-body-parser.spec.ts`, `http-exception.filter.spec.ts`) 모두 헬퍼 추출·서술적 케이스명으로 유지보수 가능성이 높다. 잔존 이슈는 e2e 테스트 J의 `100 * 1024` 매직 넘버(`GLOBAL_MAX_BODY_BYTES` import 로 대체 권장)와 `main.ts`·`hooks-body-parser.ts` 간 JSDoc 경미 중복뿐이며, 둘 다 비차단 INFO 수준이다.

## 위험도

NONE
