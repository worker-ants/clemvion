# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일: `codebase/backend/src/bootstrap/hooks-body-parser.ts`

- **[INFO]** `createHooksBodyParsers` 와 `createGlobalBodyParsers` 함수 본체가 거의 동일
  - 위치: 두 함수 전체 (L78–85, L95–102)
  - 상세: 두 함수 내부가 `limit` 값만 다를 뿐 구조가 동일한 `[json(...), urlencoded(...)]` 배열을 반환한다. 기능 확장(예: `rawBody` 보존 방식 변경, 미들웨어 추가)이 생기면 두 곳을 함께 수정해야 한다.
  - 제안: 공통 팩토리 `buildBodyParsers(maxBytes: number): RequestHandler[]` 를 추출하고, 두 함수가 이를 호출하는 구조로 리팩터링. 단, 현재 파일 크기(85줄)가 작고 JSDoc 이 각 함수의 의도 차이를 명확히 설명하므로 즉각 수정 필요성은 낮음(INFO).

- **[INFO]** `captureRawBody` 의 `if (buf && buf.length)` 이중 조건
  - 위치: `captureRawBody` 함수 내 (L464)
  - 상세: `buf` 가 `Buffer` 타입으로 선언되어 있으므로 `buf &&` 의 falsy 체크는 TypeScript 타입 시스템 관점에서 불필요하다. `buf.length > 0` 만으로 의미가 명확.
  - 제안: `if (buf.length > 0)` 으로 단순화.

- **[INFO]** `main.ts` 의 body-parser 등록 블록 주석이 `hooks-body-parser.ts` JSDoc 과 상당 부분 중복
  - 위치: `main.ts` L982–996 (diff 기준)
  - 상세: 동일한 "함정 회피" 설명이 두 파일에 존재해 한쪽이 변경될 때 다른 쪽이 stale 이 될 수 있다.
  - 제안: `main.ts` 주석을 "상세: `hooks-body-parser.ts` JSDoc 참조" 한 줄로 축약.

---

### 파일: `codebase/backend/src/common/filters/http-exception.filter.ts`

- **[WARNING]** `catch` 메서드의 `else if (exception instanceof Error)` 블록 내부에 중첩 조건 추가로 중첩 깊이 3단 도달
  - 위치: `catch` 메서드 내 `else if (exception instanceof Error)` 블록 (L887–912, 전체 파일 기준)
  - 상세: 신규 `errStatus >= 400 && errStatus < 500` 분기가 기존 `else if` 블록 안에 중첩되어 `HttpException` → `isUniqueViolation` → `Error` → `errStatus` 체크 → 내부 분기를 모두 추적해야 한다. 추후 5xx 특수 처리나 추가 에러 타입이 생기면 중첩이 더 깊어질 수 있다.
  - 제안: `errStatus` 처리를 private 헬퍼 `handleHttpErrorLike(exception: Error)` 로 추출하면 `catch` 의 최상위 흐름이 평탄해진다.

- **[INFO]** `(exception as { status?: number }).status ?? (exception as { statusCode?: number }).statusCode` 이중 캐스팅
  - 위치: `errStatus` 대입부 (L894–896)
  - 상세: 표현식이 길고 캐스팅이 두 번 나와 읽기 불편하다.
  - 제안:
    ```typescript
    type HttpErrorLike = { status?: number; statusCode?: number };
    const errStatus = (exception as HttpErrorLike).status ?? (exception as HttpErrorLike).statusCode;
    ```
    로 정리하면 가독성이 향상된다.

- **[INFO]** `getCodeFromStatus` 의 `switch` 에 `case 413` 추가는 기존 패턴과 일관적
  - 위치: `getCodeFromStatus` private 메서드 (L926–946)
  - 상세: 기존 패턴(숫자 case → string 반환)을 그대로 따라 413 을 추가한 변경은 일관성 측면에서 양호.
  - 제안: 없음.

---

### 파일: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`

- **[INFO]** `select: { authConfigId: true }` 옵션 제거라는 단순하고 명확한 버그픽스
  - 위치: `triggerRepository.findOne(...)` 호출부 (L1342–1344)
  - 상세: partial projection 제거가 full entity 로드로 전환되면서 Guard 가 HooksService 에 재사용할 수 있는 완전한 엔티티를 `req.__publicWebhookTrigger` 에 첨부(W14 패턴)하게 된다. 명명(`__publicWebhookTrigger`)은 런타임 request 확장 필드 관례를 따르며 기존 코드베이스와 일관적.
  - 제안: 없음. 변경이 명확하고 인라인 주석에 버그 근거가 잘 기술되어 있음.

---

### 파일: `codebase/backend/src/bootstrap/hooks-body-parser.spec.ts`

- **[INFO]** `createHooksBodyParsers` / `createGlobalBodyParsers` 테스트가 반환 길이·타입만 검증
  - 위치: 두 `describe` 블록의 it 케이스들
  - 상세: 현재 테스트는 미들웨어가 함수이고 2개인지만 확인한다. `limit` 값이 실제로 파서에 반영되는지 검증하지 않아, `HOOKS_MAX_BODY_BYTES` 상수를 무시하는 구현 버그가 이 테스트를 통과할 수 있다. 단, e2e(J/K 케이스)가 실 파싱 한도를 검증하므로 전체 보호망에 공백은 없다.
  - 제안: `resolveHooksMaxBodyBytes` 처럼 limit 설정을 파서에서 추출하거나, 간단한 mock HTTP 요청으로 413 을 유발하는 단위 테스트를 추가하는 것을 고려.

---

### 파일: `codebase/backend/test/webhook-trigger.e2e-spec.ts`

- **[WARNING]** 테스트 케이스 알파벳 레이블과 파일 내 배치 순서 불일치 (J, K, L 이 F 앞에 삽입)
  - 위치: J(L1464), K(L1492), L(L1505) — diff 기준
  - 상세: 기존 파일에서 F 케이스 앞에 J/K/L 이 삽입되어 파일 내 케이스 순서가 A→B→B2→B3→C→D→E→**J→K→L**→F→G→H→I 가 되었다. 알파벳 레이블을 정렬 기준으로 사용한다면 순서 이탈이 탐색을 방해하며, 이후 M, N 등 케이스 추가 시 혼란이 가중된다.
  - 제안: 새 케이스를 알파벳 순 위치(I 이후)에 배치하거나, 레이블 체계 대신 케이스 이름 설명에만 의존하는 방식으로 전환.

- **[INFO]** 테스트 J 케이스 내 `100 * 1024` 매직 넘버
  - 위치: L1479
  - 상세: 의미는 전역 100KB 한도 검증이며, `GLOBAL_MAX_BODY_BYTES` 상수를 import 해 참조하면 상수 변경 시 자동으로 추적된다.
  - 제안: `GLOBAL_MAX_BODY_BYTES` import 후 `expect(Buffer.byteLength(payload)).toBeGreaterThan(GLOBAL_MAX_BODY_BYTES)` 로 교체.

---

### 파일: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`

- **[INFO]** 타임아웃 `30_000` 에 이유를 설명하는 주석 추가 — 좋은 패턴
  - 위치: `it("has no broken in-repo links ...")` 상단 주석 블록
  - 상세: 단순 숫자가 아닌 "왜 30초가 필요한가"를 명시한 주석이 추가되어 유지보수성이 향상되었다. 변경 자체가 명확한 의도 문서화를 포함한다.

---

### 파일: `plan/in-progress/spec-sync-webhook-gaps.md`

- **[INFO]** 미구현 항목을 상세 구현 결과로 갱신한 것은 단일 진실 원칙 준수이며 적절함
  - 상세: 긴 인라인 텍스트(배경·구현·부수 발견·테스트 요약이 한 줄 문단)가 향후 읽기 불편할 수 있으나, plan 파일의 이력 기술 밀도로서 허용 범위.

---

## 요약

이번 변경은 webhook body-parser 분리 임계(`hooks-body-parser.ts`), `GlobalExceptionFilter` 의 413 매핑(`http-exception.filter.ts`), `PublicWebhookThrottleGuard` 보안 버그 수정, 관련 테스트 및 스펙 동기화를 포함하는 집중된 기능 묶음이다. 새로 추가된 `hooks-body-parser.ts` 는 상수·함수·JSDoc 이 명확히 분리돼 있고, 필터 변경은 기존 `if-else if` 체인에 조건 블록을 추가하는 방식으로 일관성을 유지한다. 주요 개선 여지는 두 가지다: (1) `catch` 메서드 내 중첩 깊이가 3단으로 증가해 향후 추가 예외 타입 처리 시 가독성이 저하될 수 있으며(WARNING), (2) e2e 테스트 케이스의 알파벳 레이블 삽입 위치가 파일 내 순서를 어긋나게 만들어 탐색 불편을 유발한다(WARNING). 나머지 항목들은 INFO 수준의 소수 개선사항으로, 전반적인 코드 품질과 유지보수성은 양호하다.

## 위험도

LOW

STATUS: SUCCESS
