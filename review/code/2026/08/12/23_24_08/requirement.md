# 요구사항(Requirement) Review — idempotency 캐시 엔트리 내부 `responseJson` 손상 방어

## 대상
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (체크박스/기록 갱신)

## 검증 방법
- 관련 spec 원문 확인: `spec/5-system/14-external-interaction-api.md` §R8 (닫힌 캐시 목록·캐시 키 스코프), `spec/data-flow/15-external-interaction.md` (fail-open 요구).
- 대상 테스트 실행: `npx jest src/modules/external-interaction/idempotency.interceptor.spec.ts` → **33 passed, 33 total**.
- `npx tsc --noEmit -p tsconfig.json` → 해당 파일 관련 에러 없음.
- `git log` 로 커밋 `22e68459d` 확인 — plan 체크박스 갱신과 실제 코드 변경이 같은 커밋.

## 발견사항

- **[INFO]** 새 방어 로직과 두 신규 테스트가 spec §R8 본문·`EIA-RL-02`·클래스 docstring 이 요구하는 "fail-open(요청을 살린다 + 장애를 보이게 한다)" 원칙과 line-level 로 일치한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:145-174` (`discardCorruptEntry` 호출 두 자리), `:202-211` (`discardCorruptEntry` 정의)
  - 상세: `cached.responseJson` 파싱을 종전 재현 분기 두 곳(성공 채널 `of()`, 에러 채널 `HttpException` 재throw)의 맨몸 `JSON.parse` 에서 단일 지점(`switchMap` 콜백 초입)으로 끌어올리고 `try/catch` 로 감쌌다. 실패 시 `discardCorruptEntry('payload', err, processFresh)` 가 `logger.warn('… cache payload 손상 …')` 을 남긴 뒤 `processFresh()`(= `next.handle().pipe(cacheTapped)`)로 강등한다. 이로써 안쪽 JSON 손상이 `SyntaxError` → `GlobalExceptionFilter` 500 마스킹으로 이어지던 선재 결함(plan `18_07_36` INFO 1)이 닫혔다. 바깥 JSON 손상 경로(`cached = JSON.parse(cachedJson)`)도 동일 헬퍼로 통일되어 이제 **양쪽 다 warn 을 남긴다** — 종전에는 바깥 손상이 조용히 넘어갔다는 점(클래스의 다른 세 fail-open 경로는 이미 warn 하는데 이 자리만 빠져 있었다는 diff 주석)까지 코드·테스트가 함께 고정한다.
  - 근거: 테스트 `엔트리 손상은 조용히 넘어가지 않는다 — warn 을 남긴다` (spec.ts:535-557), `엔트리는 멀쩡한데 안쪽 responseJson 이 깨진 경우 → 500 이 아니라 신규 처리` (spec.ts:559-594), 둘 다 실행 결과 GREEN.

- **[INFO]** `bodyHash` 판정이 payload 파싱보다 앞선 순서가 코드·주석·테스트 세 곳에서 일관된다.
  - 위치: `idempotency.interceptor.ts:152-174` (bodyHash 비교 → `ConflictException` throw 가 `cachedPayload` 파싱보다 먼저)
  - 상세: 코드 주석("payload 가 깨졌든 아니든 이 키가 이미 다른 body 로 쓰였다는 사실은 그대로")과 정확히 일치하는 회귀 테스트 `안쪽이 깨졌어도 body 가 다르면 여전히 409 — 판정 순서를 고정한다` (spec.ts:596-627)가 이 순서를 캐너리로 고정한다. 순서를 뒤집으면(payload 파싱을 bodyHash 비교보다 앞에 두면) 손상된 엔트리에서 409 충돌 검출이 조용히 사라지는데, 이 시나리오를 테스트가 정확히 재현한다. plan 기록(`backend-lint-gate-broken-on-main.md:628-631`)에 남긴 "뮤턴트가 처음엔 무효였다(블록 이동만으로 순서 불변)" 교훈도 실측과 부합.

- **[INFO]** 재현 분기 두 채널(에러 `HttpException` 재throw / 성공 `of()`) 모두에 손상 방어가 적용됨을 자매 테스트로 확인.
  - 위치: `idempotency.interceptor.spec.ts:629-653` (`안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리`)
  - 상세: `isErrorStatusCacheable(cached.statusCode)` 분기(에러 채널, `:181-186`)와 그 아래 성공 채널(`:187-189`) 양쪽 다 `cachedPayload` 파싱이 선행되므로 동일 방어를 받는다. `discardCorruptEntry` 가 파싱 단계에서 이미 개입해 `isErrorStatusCacheable` 분기 진입 전에 강등되므로, statusCode 가 409/410 이어도 500 마스킹 없이 fresh 처리된다 — 테스트가 이를 정확히 검증(`statusCode: 409` fixture, `result` 는 fresh 값, `handleSpy` 호출 확인).

- **[INFO]** `discardCorruptEntry<T>` 의 제네릭 반환 타입이 두 호출 지점의 반환 타입(둘 다 `Observable<unknown>`)과 일치하고, `switchMap` 콜백의 모든 코드 경로(캐시 미스 · 엔트리 손상 · payload 손상 · 409 충돌 throw · 에러 재현 throw · 정상 재현 `of()`)가 값 또는 예외를 반환한다 — 반환값 누락 경로 없음.
  - 위치: `idempotency.interceptor.ts:143-190`, `:202-211`

- **[INFO]** `discardCorruptEntry` 의 `what` 파라미터가 리터럴 유니온 `'엔트리' | 'payload'` 로 닫혀 있어 두 호출부 문자열이 warn 메시지("cache 엔트리 손상"/"cache payload 손상")와 테스트의 `stringContaining` 단언이 정확히 대응한다. 임의 문자열이 들어갈 여지가 타입 레벨에서 차단됨.
  - 위치: `idempotency.interceptor.ts:202-206`

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 체크박스(`- [x] 캐시 엔트리 내부 responseJson 손상은 무방비 …`)와 완료 기록 문단이 실제 커밋(`22e68459d`)의 변경 내용과 부합 — "한 번만 파싱" · "두 자리 모두 warn" · "파싱 순서가 bodyHash 판정 뒤" · "뮤턴트 선검증 실패 경위" 네 진술 모두 코드·테스트로 확인됨. 과장이나 미이행 기록 없음.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:619-631`

- **[INFO]** spec fidelity — 이번 diff 는 §R8 의 "닫힌 캐시 목록"(`2xx`/`409`/`410`) 자체나 캐시 키 스코프 로직을 변경하지 않는다(그 부분은 선행 커밋 `a80599700`·`8a2d13031`에서 이미 반영·검증 완료). 본 diff 는 그 뒤에 남아 있던 별도 선재 결함(캐시 엔트리 내부 JSON 파싱 미방어)만 닫는다. spec 본문에는 "responseJson 파싱 실패 시 동작"을 명시한 문장이 없으나(구현 세부), 코드 주석이 "바깥 JSON 손상과 같은 처리(무시+신규 처리)"로 통일한다고 명시하고 실제로 그렇게 구현됐으므로 spec 과 충돌하는 지점은 없음. spec 문서 자체 결함 아님.

엣지 케이스 관련 특이사항 없음 — `cachedJson` null/falsy, 바깥 JSON 손상, 안쪽 JSON 손상, bodyHash 불일치(손상 엔트리 포함), 409/410 재현, 200 재현 모두 테스트로 커버되고 코드 경로와 1:1 대응. TODO/FIXME/HACK/XXX 주석 없음(grep 확인). `Logger.prototype.warn` spy 는 모든 신규 테스트에서 `try/finally` 로 `mockRestore()` 되어 테스트 간 오염 없음.

## 요약
diff 는 선재 결함(캐시 엔트리 내부 `responseJson` 손상 시 `SyntaxError` 가 그대로 올라가 500 으로 마스킹되던 문제, plan `18_07_36` INFO 1)을 닫기 위해 파싱을 단일 지점으로 끌어올리고 `discardCorruptEntry` 헬퍼로 warn+fail-open 처리를 통일했다. bodyHash 판정을 payload 파싱보다 먼저 두는 순서가 코드 주석·회귀 테스트·plan 기록 세 곳에서 일관되고, 에러/성공 두 재현 채널 모두 동일 방어를 받는 것이 자매 테스트로 확인됐다. 33개 테스트 전량 통과, `tsc` 무오류, spec §R8·fail-open 요구와 충돌 없음. Critical/Warning 급 발견사항 없음 — 전부 INFO(구현 완전성 확인).

## 위험도
NONE
