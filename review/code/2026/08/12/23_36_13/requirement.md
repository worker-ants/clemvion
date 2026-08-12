# 요구사항(Requirement) Review — idempotency 캐시 엔트리 내부 `responseJson` 손상 방어 + 직전 리뷰 라운드(23_24_08) RESOLUTION 반영분

## 대상
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (production)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (test)
- `CHANGELOG.md` (신규 Unreleased 항목)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (체크박스 완료 갱신)
- `review/code/2026/08/12/23_24_08/*` (직전 라운드 리뷰 산출물 — 이번 커밋에 함께 실림. RESOLUTION.md 가 WARNING 3건 전부 조치했다고 주장하는 근거를 실측으로 대조)

## 검증 방법
- spec 원문: `spec/5-system/14-external-interaction-api.md` §R8·EIA-IN-11·EIA-RL-02, `spec/data-flow/15-external-interaction.md` §2.2 Redis 표(`전 경로 fail-open (warn) — 가용성 우선`).
- 대상 테스트 직접 실행: `npx jest src/modules/external-interaction/idempotency.interceptor.spec.ts` → **33 passed, 33 total** (실측, 콘솔 로그 관찰 포함).
- `idempotency.interceptor.ts` 전체 파일을 `Read` 로 직접 열어 새 `switchMap` 분기·`discardCorruptEntry`·docstring 5-경로 표를 라인 단위로 대조.
- `common/filters/http-exception.filter.ts` 를 열어 "미매핑 Error → 500 마스킹" 주장을 대조(확인됨 — `HttpException` 이 아닌 예외는 `INTERNAL_SERVER_ERROR`/`INTERNAL_ERROR` 기본값 사용).
- `grep -n "TODO\|FIXME\|HACK\|XXX"` — 대상 두 파일 모두 0건.

## 발견사항

- **[INFO]** RESOLUTION 이 주장한 WARNING #1(자매 테스트 단언 보강)이 실제로 반영돼 있고, 뮤테이션 저항력도 주장대로 강화됨을 재확인.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:631` (`안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리 — 에러 재현 분기도 같은 방어를 받는다`)
  - 상세: `warnSpy`(`cache payload 손상` 메시지), `redis.set` 호출 횟수, 그리고 재적재된 `bodyHash`/`statusCode`/`responseJson` 값까지 형제 테스트(`:561`)와 동형으로 단언한다. 직접 실행해 33/33 GREEN 확인.

- **[INFO]** 핵심 비즈니스 규칙(순서 계약) — `bodyHash` 판정이 `responseJson` 파싱보다 먼저인 순서가 코드·주석·회귀 테스트 세 곳에서 일치.
  - 위치: `idempotency.interceptor.ts:167-186`(`switchMap` 콜백 — bodyHash 비교 → `ConflictException` throw 가 `cachedPayload` 파싱보다 앞), `idempotency.interceptor.spec.ts:598`(`안쪽이 깨졌어도 body 가 다르면 여전히 409 — 판정 순서를 고정한다`)
  - 상세: 손상된 payload 를 가진 엔트리라도 `bodyHash` 불일치는 여전히 409 를 낸다 — 캐시 손상이 `Idempotency-Key` 재사용 검출을 무력화하지 않는다. `EIA-IN-11`("같은 키 + 다른 body는 409")·`EIA-RL-02` 요구와 line-level 일치.

- **[INFO]** 두 재현 채널(에러 `HttpException` re-throw / 성공 `of()`) 모두 payload 손상 방어를 동일하게 받음 — `isErrorStatusCacheable` 분기 이전에 `cachedPayload` 파싱이 선행되므로 409/410 캐시 엔트리든 200 캐시 엔트리든 손상 시 동일하게 fail-open 강등.
  - 위치: `idempotency.interceptor.ts:181-201`

- **[INFO]** 반환값 완전성 — `switchMap` 콜백의 모든 분기(캐시 미스·엔트리 손상·payload 손상·409 충돌 throw·에러 재현 throw·정상 재현 `of()`)가 값 또는 예외를 반환한다. 누락 경로 없음. `discardCorruptEntry<T>` 제네릭 반환 타입이 두 호출부(둘 다 `Observable<unknown>`)와 일치.
  - 위치: `idempotency.interceptor.ts:149-201, 219-228`

- **[INFO]** spec fidelity — §R8 의 "닫힌 캐시 목록"(`2xx`/`409`/`410`, `isErrorStatusCacheable`)과 캐시 키 스코프(`<executionId>:<route>:<key>`)는 이번 diff 로 변경되지 않았고, 기존 값 그대로 유지됨을 확인. `spec/data-flow/15-external-interaction.md` 의 "Redis … 전 경로 fail-open (warn) — 가용성 우선" 이 요구하는 성질이 신규 두 경로(엔트리/payload 손상)에도 동일하게 구현됨. spec 본문은 "`responseJson` 파싱 실패 시 처리"를 구현 세부로 명시하지 않으므로 이 부분은 spec 침묵 영역(회색지대) — spec-drift 아님, 단순 구현 완성.
  - 위치: `idempotency.interceptor.ts:333-335`(`isErrorStatusCacheable`, 불변), `spec/5-system/14-external-interaction-api.md:1053-1066`

- **[INFO]** CHANGELOG.md 신규 항목이 실제 client-observable 변화(손상 엔트리 만난 요청: 종전 500 → 이제 정상 처리)를 정확히 서술하고, 파싱 순서가 계약이 된 이유까지 담음 — RESOLUTION WARNING #3 반영 확인.
  - 위치: `CHANGELOG.md:3-19`

- **[INFO]** 클래스 docstring 이 "세 경로" → "다섯 경로" 표로 갱신됐고 각 행이 `{@link}` 로 실제 메서드를 가리켜 개수·항목이 코드와 일치 — RESOLUTION WARNING #2 반영 확인. 단, 표 앞의 서두 문장("Redis 미가용·캐시 손상 시 fail-open **+ warn 로그**")이 5경로 전체에 획일 적용되는 것처럼 읽히는데, 실제로 경로 #1(생성자 `null`/`intercept()` 의 `!this.redis` 조기 반환)은 warn 을 남기지 않는다(표의 해당 행 자체는 "캐시 미적용 passthrough"로 정확히 적어 모순은 없음 — 서두 요약 문장만 살짝 과장). 이번 diff 이전부터 있던 같은 패턴의 서두 문장이라 새로 도입된 결함은 아니며, 이번에 표를 다시 쓰는 김에 정정할 기회였던 자리.
  - 위치: `idempotency.interceptor.ts:62-71`(서두 문장 vs 표 1행), `idempotency.interceptor.ts:106-108`(`intercept()` 의 `!this.redis` 조기 반환 — warn 없음)
  - 제안: 서두 문장을 "Redis 미가용 시 fail-open(경로에 따라 warn 로그 동반) — …" 처럼 완화하거나, 표 1행 옆에 "warn 없음" 을 명시. 낮은 우선순위.

- **[INFO]** (side_effect/testing 인접, 완전성 체크 차원에서 기록) 기존 테스트 `손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재`(이번 diff 로 수정되지 않은 pre-existing 테스트)가 신규 `discardCorruptEntry` 의 warn 호출 경로를 그대로 통과하게 됐는데 `Logger.prototype.warn` 을 mock 하지 않아, 테스트 실행 시 실제 WARN 로그가 콘솔로 샌다(직접 실행해 실측 확인 — `IdempotencyInterceptor cache 엔트리 손상 — 무시하고 신규 처리: …` 출력). RESOLUTION WARNING #1 은 `:629` 자매 테스트만 mock 을 추가했고, 같은 코드 경로를 먼저 밟는 이 구형 테스트는 그대로 남았다. 테스트 자체(단언)는 여전히 유효하고 GREEN — 기능 결함 아님, 순수 로그 노이즈.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:505-535`
  - 제안: 여유 있으면 `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 추가(다른 손상 테스트들과 동형). 우선순위 낮음 — 이 라운드 범위(payload 손상 방어) 밖의 잔여 정리.

## 엣지 케이스 점검
- `cachedJson` null/falsy → `processFresh()` (캐시 미스와 동일 취급). 정상.
- 바깥 JSON 손상(비-JSON 문자열) → `catch` → `discardCorruptEntry('엔트리', …)`. 정상, 테스트 있음.
- 안쪽 `responseJson` 손상(비-JSON 문자열) → `catch` → `discardCorruptEntry('payload', …)`. 정상, 테스트 있음(성공/에러 채널 둘 다).
- `bodyHash` 불일치 + payload 손상 동시 → 여전히 409(파싱 전에 이미 throw). 정상, 테스트 있음.
- 스키마 유효 JSON이지만 형태가 어긋난 경우(예: `cachedJson`이 `"null"`, `cached.statusCode` 필드 부재 등)는 `JSON.parse` 자체는 성공하므로 이번 diff 의 `try/catch` 로 걸러지지 않는다 — 다만 이는 이번 diff 이전부터 있던 동일 성격의 갭이고, 직전 라운드에서 이미 INFO 로 식별·유예("이 서비스 자신이 쓴 Redis 값이라 신뢰 경계 미확장")된 사항과 같은 클래스라 신규 회귀로 보지 않음.
- `MAX_KEY_LENGTH`/`readKey` 경계값 테스트 부재는 plan 에 이미 별도 항목(`12_55_52` testing INFO 10)으로 등재된 선재 갭이며 이번 PR 범위 밖.

## 요약
`IdempotencyInterceptor` 의 캐시 엔트리 내부 `responseJson` 손상 방어(신규 `discardCorruptEntry` 헬퍼, 파싱 순서를 `bodyHash` 판정 뒤로 재배치, 두 재현 채널 모두 방어 적용)는 spec §R8(닫힌 캐시 목록·`EIA-IN-11`)·`EIA-RL-02`·`spec/data-flow/15-external-interaction.md` 의 "전 경로 fail-open(warn) — 가용성 우선" 요구와 line-level 로 일치한다. 직전 리뷰 라운드(`23_24_08`)가 지적한 WARNING 3건(자매 테스트 얕은 단언·클래스 docstring stale·CHANGELOG 누락)은 실제로 조치돼 있음을 코드·테스트 직접 실행으로 재확인했다(33/33 GREEN). 반환값 누락 경로·TODO/FIXME 없음. 이번 라운드에서 새로 발견한 것은 전부 INFO 수준(경로 1의 서두 문장 과장, 구형 테스트의 잔여 warn mock 누락으로 인한 콘솔 노이즈)이며 기능·spec 준수에는 영향이 없다.

## 위험도
NONE
