# 요구사항(Requirement) 리뷰

## 검증 방법
- 대상 6개 코드 spec/guard 파일을 전부 로컬 jest 로 실행 (repo 트리 뮤테이션 없음, read-only):
  - `redis-fail-open-catalog.spec.ts` — 8/8 PASS
  - `http-exception.filter.spec.ts` — 19/19 PASS (신설 9건 포함, plan 의 "10→19" 주장과 일치)
  - `expression-resolver.service.spec.ts` · `secret-resolver.service.ts`(spec) · `code.handler.spec.ts` — 합계 180/180 PASS
  - `packages/expression-engine/src/__tests__/error-shape.spec.ts` — 10/10 PASS
- `spec/5-system/_product-overview.md` §NF-OB-07, `spec/data-flow/9-observability.md`, `spec/5-system/3-error-handling.md` §6.3.1 을 코드·주석과 line-level 대조.
- `business-metrics.service.ts`(`RedisFailOpenComponent`/`RedisFailOpenReason` 유니온) · `idempotency.interceptor.ts`(실배선 호출부) 를 직접 열어 가드가 읽는 대상과 대조.
- `git status --short` 로 저장소에 부수 쓰기가 없음을 확인 (본 세션 산출물 디렉터리만 존재).

## 발견사항

- **[INFO]** `redis-fail-open-catalog.spec.ts` 의 "유니온 소스 경로가 실재한다" 케이스가 주석이 설명하는 실패 모드를 직접 검증하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts:129` (전체 파일 컨텍스트 게이트 기준)
  - 상세: 주석은 "파일이 옮겨지면 `readUnionMembers` 가 ENOENT 로 죽어야 한다 — 빈 배열로 조용히 통과하면 위 정합 단언이 `[] === []` 로 공허해진다" 고 설명하지만, 실제 단언은 `fs.existsSync(path.join(repoRoot, UNION_SOURCE))` 로 **현재 파일이 존재한다**만 확인한다. `CATALOG_SPEC` 쪽의 대칭 케이스("카탈로그 행이 사라지면 throw 한다")는 실제로 경로를 지운 뒤 함수를 호출해 throw 를 관측하는데, `UNION_SOURCE` 쪽은 그 대칭 실험을 하지 않는다. `fs.readFileSync` 가 존재하지 않는 경로에서 항상 throw 하므로 실제 위험은 낮지만, 주석이 서술하는 행동과 단언이 검증하는 것 사이에 괴리가 있다.
  - 제안: `withPatchedSpec` 과 유사하게 `UNION_SOURCE` 를 존재하지 않는 scratch 경로로 바꿔 `readUnionMembers` 가 실제로 throw 하는지 직접 단언하거나, 주석을 "존재 여부만 확인하는 precondition 가드다" 로 좁혀 서술을 실측에 맞춘다.

- **[INFO]** `readCatalogComponents` 의 두 번째 throw 분기(행은 찾았지만 `` `component` (…) `` 패턴이 안 잡히는 경우)가 테스트되지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:79` (`readCatalogComponents` 내부 두 번째 `throw`)
  - 상세: "가드 자체의 판별력" describe 는 행이 통째로 사라지는 경우(빈 문자열로 patch)만 다룬다. 행은 있지만 `` `component` `` 뒤에 괄호 목록이 없는 형태(예: 표 서식이 바뀌어 `component:` 로만 적히는 경우)로 spec 이 바뀌면 이 두 번째 throw 가 발화해야 하는데, 그 경로를 확인하는 케이스가 없다. 가드 자체가 fail-closed 로 설계돼 있어 실제 위험은 낮지만, 두 throw 경로 중 하나만 커버리지가 있다.
  - 제안: `withPatchedSpec` 으로 `` `component` `` 뒤 괄호를 제거한 변형을 만들어 두 번째 throw 를 직접 단언하는 케이스 1건 추가.

## 교차검증 결과 (문제 없음 확인)

- `RedisFailOpenComponent = 'idempotency'`(단일 값) ↔ `spec/5-system/_product-overview.md:88` 카탈로그 행 `` `component` (idempotency) `` ↔ 실제 호출부(`idempotency.interceptor.ts` 4곳, `METRICS_COMPONENT` 상수 경유 포함) — 3자 정확히 일치. 가드가 검증하는 대상과 spec·구현 실측이 모두 부합.
- `RedisFailOpenReason` 5개 값(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`) ↔ spec 카탈로그 행의 `reason (...)` 목록 — 순서·값 모두 일치.
- `spec/5-system/3-error-handling.md` §6.3.1 의 C1 AND C2 기준 ↔ `expression-resolver.service.ts`/`.spec.ts`, `code.handler.ts`/`.spec.ts`, `secret-resolver.service.ts` 5곳의 주석 — line-level 로 일치. "형제 4곳" 주장(파일 3)을 `git grep "C1 —"` 로 재확인 — 정확히 4곳(`secret-resolver.service.ts` 는 비부착 사례라 제외, `agent-memory.service.ts`/`integration-expiry-scanner.service.spec.ts` 는 다른 기준의 `C1`이라 형제 아님 — 주석의 설명과 일치).
- `.cause` 를 읽는 소비처가 저장소 전체에 `telegram-client.ts` 의 `describeFetchError` 한 곳뿐이라는 주장(파일 1 JSDoc) — `grep -rn "\.cause" codebase/backend/src` 로 재확인, 정확히 일치.
- `GlobalExceptionFilter` 의 응답 봉투가 항상 `code`/`message`/`requestId`(+선택적 `details`)만 갖고 `cause` 를 절대 포함하지 않는다는 새 닫힌-집합 단언(파일 1) — 필터 구현(`http-exception.filter.ts`)을 직접 읽어 확인: `errorResponse` 객체가 정확히 그 네 키만 조립하며 `exception` 을 스프레드하는 경로가 없음.
- `expression-resolver.service.spec.ts`/`code.handler.spec.ts` 의 "정본은 `error-shape.spec.ts`" 위임 주석 — 해당 파일이 실제로 6개 하위 클래스(`SyntaxError`/`ReferenceError`/`TypeError`/`FunctionError`/`TimeoutError`/`DepthExceededError`)를 전수 열거하고 클래스↔코드 1:1 매핑까지 검증함을 확인(10/10 PASS).
- plan(`deps-peer-gating-and-eslint10.md`) 체크리스트의 "완료" 표시 3건 — 실제 코드 diff(파일 1·3·7)와 정확히 대응, 서술과 구현이 어긋나지 않음.

TODO/FIXME/HACK/XXX 주석 없음. 반환값 누락·미처리 에러 시나리오 없음(모든 신규/변경 함수가 명시적 throw 또는 정상 반환 경로를 가짐). 비즈니스 로직(닫힌 집합 라벨, C1/C2 판정, 응답 봉투 불변식) 은 spec 과 정확히 부합.

## 요약

이번 변경은 신규 프로덕션 동작을 추가하지 않고 (1) `clemvion.redis.fail_open` 의 `component` 라벨에 대한 코드·spec·실배선 3자 정합 가드 신설, (2) `Error.cause` 비노출 불변식에 대한 회귀 테스트 보강, (3) 관련 주석의 근거 위임/중복 정리, (4) plan 문서 갱신으로 구성된다. 모든 대상 spec 파일을 직접 실행해 전수 PASS 를 확인했고, 각 파일이 인용하는 spec 본문(§NF-OB-07 카탈로그, §6.3.1 C1/C2 기준)과 line-level 로 대조해 불일치를 찾지 못했다 — 주석이 주장하는 "형제 개수", "cause 소비처 유일성", "테스트 수 증가폭" 등 정량적 진술도 전부 재실측으로 일치를 확인했다. 발견된 2건은 모두 INFO 등급으로, 가드/테스트 인프라 파일 내 부수 서술과 실제 단언 범위 사이의 사소한 비대칭(빠뜨린 에러 경로 커버리지)이며 프로덕션 동작에 영향이 없다.

## 위험도
NONE
