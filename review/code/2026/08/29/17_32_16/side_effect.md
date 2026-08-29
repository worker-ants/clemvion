# 부작용(Side Effect) Review

## 검토 대상
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `switchMap` 콜백(87줄)을 `resolveCacheHit()` private 메서드로 추출, 호출부 인자 4개(`redisKey`·`bodyHash`·`context`·`next`)를 신규 `CacheLookup` 인터페이스로 묶음.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — plan frontmatter(`worktree:`) 갱신 + 체크박스 완료 기록.
- `review/consistency/2026/08/29/17_23_43/*` — consistency-checker 가 생성한 신규 산출물(리뷰 아티팩트).

## 발견사항

- **[INFO]** 리팩터가 "순수 구조 변경" 을 자처하나, 검증용 뮤테이션(임시로 `redisKey`↔`bodyHash` 를 바꿔 넣었다가 원복)이 이 리뷰 라운드와 동시에 진행되어 병렬 consistency-checker 두 개(`convention_compliance`, `rationale_continuity`)가 그 과도 상태를 관측했다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `resolveCacheHit` 호출부(현재 190번째 줄 부근, `switchMap((cachedJson) => this.resolveCacheHit(cachedJson, { redisKey, bodyHash, context, next })),`)
  - 상세: `git log`/`git show HEAD` 로 확인한 결과 최종 커밋(`49b9f92b5`)의 호출부는 `{ redisKey, bodyHash, context, next }` 로 정상이고, `git status --short` 도 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/08/29/17_32_16/`)를 제외하면 clean 하다. 즉 **현재 트리에는 잔여 부작용이 없다** — 문제가 된 것은 "다른 병렬 에이전트가 뮤테이션 중인 워크트리를 읽어 오염된 판정을 낼 수 있다"는 과정상의 위험이었고, `review/consistency/.../SUMMARY.md` 의 "INFO #4 정정" 절이 이를 이미 자체 보고·정정했다.
  - 제안: 이번 건은 이미 자체 정정되어 후속 조치가 필요 없다. 다만 "구현자가 코드를 임시로 뮤테이션하는 시점"과 "병렬 리뷰/체커가 같은 워크트리를 읽는 시점"이 겹치지 않도록 배치하는 절차적 습관을 유지할 것(SUMMARY.md 자체가 이미 이 교훈을 기록함).

- **[INFO]** `CacheLookup` 은 객체 리터럴 프로퍼티명 매칭(`{ redisKey, bodyHash, context, next }`)이라 인터페이스 필드 선언 순서(`redisKey, bodyHash, context, next`)와 호출부 리터럴 순서가 우연히 일치하지만, TypeScript 구조적 타이핑상 순서 자체는 정합성에 영향을 주지 않는다(이름 기반 매칭). docstring 이 "위치 인자였다면 순서가 뒤바뀌어도 타입이 못 잡는다"고 명시적으로 인지하고 있어 오인 소지는 낮다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:72`(`interface CacheLookup`), `:190`(호출부)
  - 상세: 참고용 관찰이며 결함 아님.
  - 제안: 조치 불필요.

## 부작용 관점 점검 요약 (관점별)

1. **의도치 않은 상태 변경**: 없음. `resolveCacheHit()` 은 `intercept()` 의 `switchMap` 프로젝션 함수 본문을 그대로 옮긴 것이고, `processFresh`/`discardCorruptEntry`/`cacheTapped`/`storeEntry` 등 기존 헬퍼 호출 순서·조건 분기가 diff 상 1:1로 보존됨(신규 로직 없음). Redis GET/SET, 로거 warn, 메트릭 호출 지점 모두 이전과 동일.
2. **전역 변수**: 없음. 새 모듈 스코프 `const`/전역 도입 없음(`CacheLookup` 은 타입 선언일 뿐).
3. **파일시스템 부작용**: 코드 변경 자체는 파일시스템 접근 없음. `review/consistency/**` 신규 파일 10개는 `/consistency-check` 실행의 정상 산출물로 프로젝트 컨벤션(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이 지정한 위치와 정확히 일치 — 예상치 못한 생성이 아님.
4. **시그니처 변경**: `intercept(context, next)` 공개 시그니처는 불변. 신규 `private resolveCacheHit(cachedJson, lookup)` 은 클래스 내부 전용이라 외부 호출자 영향 없음. `cacheTapped(redisKey, bodyHash, context)` 시그니처도 그대로.
5. **인터페이스 변경**: `CacheLookup` 은 `export` 없는 파일-로컬 interface — 공개 API 표면 변화 없음. consistency-checker(`naming_collision`)도 "신규 식별자 모두 단일 파일 private 스코프"로 동일 판정.
6. **환경 변수**: 읽기/쓰기 변경 없음.
7. **네트워크 호출**: `this.redis.get`/`this.redis.set` 호출 지점·인자·타이밍 불변. 신규 외부 호출 없음.
8. **이벤트/콜백**: `switchMap`/`catchError`/`tap` 파이프라인 배선 불변 — `resolveCacheHit` 은 여전히 `switchMap` 의 project 함수 *안에서* 호출되어(`throw` 가 RxJS error 채널로 변환되는 위치) `intercept()` 본문으로 끌어올려지지 않았음을 코드로 확인. docstring 이 명시한 "여기서 호출해야 하는 이유"와 실제 배치가 일치.
9. **plan 파일**: frontmatter `worktree:` 필드 갱신, 체크박스 `[ ]→[x]` 전환은 이 프로젝트의 plan 라이프사이클 컨벤션에 부합하는 메타데이터 갱신이며 애플리케이션 동작에 영향 없음.

## 요약
핵심 변경은 `IdempotencyInterceptor` 내부의 순수 구조적 리팩터(콜백 추출 + 인자 4개를 객체로 묶음)로, 공개 시그니처·전역 상태·파일시스템·환경변수·네트워크 호출·이벤트 배선 어느 것도 실질적으로 바뀌지 않았다. diff 를 라인 단위로 대조한 결과 로직은 이동만 됐을 뿐 동일하며, 커밋 메시지의 "동작 변경 없음/기존 spec 63건 GREEN" 주장과 부합한다. 유일하게 눈에 띄는 항목은 개발자가 검증용으로 주입했던 필드-스왑 뮤턴트를 병렬 consistency-checker 두 개가 과도 상태에서 관측한 것인데, 최종 커밋(`49b9f92b5`)과 현재 워크트리 상태를 직접 확인한 결과 정상 복원되어 잔여 부작용은 없다. `review/consistency/**` 신규 파일들은 프로젝트 컨벤션이 지정한 정상 산출물이다.

## 위험도
NONE
