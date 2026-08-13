# 부작용(Side Effect) 리뷰

## 검토 범위

`git diff origin/main...HEAD` 기준 실제 코드/문서 변경은 3개 파일뿐이다(나머지 61개는
`review/**` 하위에 이전 라운드가 이미 만들어 둔 리뷰 산출물이 이번 커밋에 함께 실리는 것으로,
실행 코드가 아니다):

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (+40/-3)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (+267/-1, 테스트 전용)
- `CHANGELOG.md` (+17)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (+41/-1, 문서)

## 발견사항

- **[INFO]** `intercept()` 의 키 판정이 `!rawKey` truthiness → `rawKey === null` 명시 비교로 변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:113`, 관련 헬퍼 `readKey()`:423-428
  - 상세: `readKey()` 를 직접 열어 확인한 결과, 반환값은 항상 `null` 이거나 "trim 후 길이 1~200인 비어있지 않은 문자열"(`:426` `trimmed.length === 0 || trimmed.length > MAX_KEY_LENGTH` → `null`)뿐이라 falsy 이면서 `null` 이 아닌 값(빈 문자열 등)은 애초에 발생하지 않는다. 따라서 이 변경은 관측 가능한 분기 결과를 바꾸지 않는 순수 리팩터(뮤테이션 관측성 개선 목적)이며 호출자·응답 동작에 부작용이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 캐시 엔트리 형태 검사가 좁아져(`typeof === 'number'` → `isHttpStatusCode()`) "손상 엔트리"로 분류되는 값의 범위가 넓어짐 — 의도된 동작 변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:377`(`isIdempotencyEntry`), `:397-403`(신설 `isHttpStatusCode`), 신규 상수 `:25-26`
  - 상세: 이전에는 `-1`/`0`/`600`/`200.5` 같은 `statusCode` 를 가진 캐시 엔트리도 "유효"로 판정해 `res.status(...)`/`HttpException(_, statusCode)` 로 그대로 흘려보냈다(런타임 `RangeError`→500 경로). 이제는 그런 값을 가진 엔트리가 `discardCorruptEntry()`(`:241-250`) 경로로 빠진다. 이 함수는 `logger.warn` 한 줄만 찍고 `processFresh()` 를 호출할 뿐 Redis 에 대한 추가 쓰기·삭제를 하지 않으므로(`isIdempotencyEntry` 판정이 좁아진 것 자체가 새 side effect 를 만들지 않음), 관측되는 부작용은 "동일 캐시 엔트리에 대해 로그 한 줄이 더 찍히고 응답이 재생성된다" 는 것뿐이다. 이 인터셉터 자신이 `storeEntry()` 에서 2xx/409/410 만 적재하므로(`isErrorStatusCacheable` 이 닫힌 목록을 별도로 담당) 정상 운영 경로에서 100~599 범위 밖 값이 캐시에 쓰일 수 없어, 실무 영향은 CHANGELOG 가 명시한 대로 "관측되지 않음"이 맞다.
  - 제안: 조치 불필요 — 의도된 버그 수정.

- **[INFO]** 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경(`opts.body ?? {}` → `'body' in opts ? opts.body : {}`) — 파일 내 모든 호출부가 공유하는 헬퍼라 전수 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:137`
  - 상세: `makeContext()` 는 이 파일의 5개 `describe` 블록 전체가 공유한다. 직접 `grep -n "makeContext("` 로 전체 49회 호출부를 확인하고, `grep -n "body: undefined\|body: null"` 로 대조한 결과 `body: undefined`/`body: null` 을 **명시**하는 호출부는 이번 diff 가 새로 추가한 2곳(`:1363`, `:1370`)뿐이었다. 나머지 47개 호출부는 `body` 키를 아예 생략하거나(`'body' in opts` = false → 이전과 동일하게 `{}`) 리터럴 객체/사전 초기화된 변수만 넘기므로, 이 헬퍼 시그니처의 동작 변경이 기존 47개 호출부의 결과를 조용히 바꾸는 사례는 없음을 소스에서 직접 재확인했다. 테스트 전용 코드라 프로덕션 영향은 없다.
  - 제안: 조치 불필요 — 이미 소스로 재검증됨.

- **[INFO]** `Logger.prototype.warn` mock 이 `try/finally { warnSpy.mockRestore() }` 패턴을 유지 — 전역 prototype mock 누수 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 신규 `it.each` 블록(경계 statusCode 손상 케이스, `describe('IdempotencyInterceptor — readKey / hashBody 경계값', ...)` 내부)
  - 상세: `jest.spyOn(Logger.prototype, 'warn')` 은 클래스 prototype 을 직접 모킹하는, 파일 전역에 영향을 줄 수 있는 조작이다. 신규 블록도 기존 파일의 10개 자리와 동일하게 `try { ... } finally { warnSpy.mockRestore(); }` 로 감싸 단언 실패 시에도 mock 이 뒤 테스트로 새지 않도록 했다.
  - 제안: 조치 불필요.

## 점검 관점별 요약

1. **의도치 않은 상태 변경**: 없음 — Redis I/O(`get`/`set`)는 기존 호출 지점 그대로이고 새 호출 지점은 추가되지 않았다.
2. **전역 변수**: 신규 도입은 `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 뿐이며 모듈-스코프 `const`(기존 `MAX_KEY_LENGTH`/`TTL_SEC` 와 동일 패턴)로, 가변 전역 상태가 아니다.
3. **파일시스템 부작용**: 프로덕션 코드에 파일 I/O 없음. `review/**`/`plan/**` 파일 추가는 이 저장소의 문서화 관행에 따른 의도된 것으로 런타임 부작용이 아니다.
4. **시그니처 변경**: `readKey`(내부 전용, 반환 타입 `string | null` 불변) · `isIdempotencyEntry`(내부 전용, 타입 가드 시그니처 불변, 판정 로직만 강화) 모두 module-private. 공개 클래스 `IdempotencyInterceptor` 의 생성자·`intercept()` 시그니처는 변경 없음.
5. **인터페이스 변경**: `NestInterceptor` 구현 표면 불변. 외부 소비자(다른 모듈이 이 인터셉터를 참조하는 지점)에 영향 없음.
6. **환경 변수**: 읽기/쓰기 없음.
7. **네트워크 호출**: 없음 — Redis 호출 패턴 불변, 신규 외부 서비스 호출 없음.
8. **이벤트/콜백**: `Observable`/`tap`/`catchError` 파이프라인 구조 불변. `logger.warn` 호출 빈도만 손상 판정 범위 확장에 따라 늘어날 수 있으나 이는 §4-5 항목에서 다룬 의도된 동작이다.

## 요약

실행 코드에 실질적인 side effect 는 없다. `rawKey === null` 전환은 `readKey()` 소스를 직접 대조해 순수 리팩터임을 재확인했고, `isHttpStatusCode()` 도입으로 좁아진 캐시 엔트리 유효성 판정은 `discardCorruptEntry()` 가 로그+재처리만 수행할 뿐 추가 I/O를 만들지 않아 새로운 부작용 표면이 아니다. 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경은 공유 헬퍼라는 점에서 잠재적 파급력이 있었지만, 파일 내 49개 호출부 전수 조사 결과 신규 2곳 외에는 영향이 없음을 직접 확인했다. 전역 변수·환경 변수·파일시스템·네트워크·이벤트/콜백 표면에서 도입되거나 변경된 부작용은 없으며, `review/**` 하위 다수 신규 파일은 런타임과 무관한 문서 산출물이다.

## 위험도

NONE
