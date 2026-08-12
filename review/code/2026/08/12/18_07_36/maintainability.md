# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새로 추가한 e2e 테스트 ID `I-2` 가 같은 파일의 기존 테스트 ID `I-2` 와 충돌하고, 삽입 위치가 파일의 순차 ID 관행(A→B→…→J)을 깬다
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:446` (신규 `it('I-2. 400 VALIDATION_ERROR 는 캐시되지 않아…')`) vs `:617` (기존 `it('I-2. getStatus wire — buttons 노드는…')`)
  - 상세: 이 파일은 `it()` 제목 맨 앞에 `A.`·`B.`·…·`G.`·`G-2.`·`H.`·`I.`·`I-2.`·`J.` 형태의 자체 순차 ID 를 붙이고, 괄호 안에 `(§R8)`·`(F-1)`·`(I-5 e2e, spec §5.1)` 같은 외부 참조를 별도로 적는 관행을 이미 갖고 있다(예: 371번째 줄 이전의 `G-2` 는 `(F-1)` 을 괄호로 인용하지 자기 ID 로 쓰지 않는다). 이번 diff 가 새 Idempotency-Key 테스트 두 건에 `I-1`/`I-2` 를 자기 ID 로 붙였는데, `I-2` 는 617번째 줄에 위치한 기존 "getStatus wire — buttons 노드" 테스트(EIA §5.3, 이번 PR 과 무관한 기능)가 **이미 쓰고 있는 ID** 다. 그 결과 같은 파일 안에 `I-2` 라는 이름의 테스트가 의미상 전혀 다른 두 곳(409/410 idempotency 캐시 vs getStatus 마스킹)에 존재한다. `plan/in-progress/backend-lint-gate-broken-on-main.md:548` 이 이미 "`I-1`(409 캐시 적재·재현) · `I-2`(400 미적재) 2건 추가" 라고 이 ID 를 **영구 기록**으로 인용해 버려, 이후 누군가 plan·리뷰·Slack 에서 "I-2 테스트" 를 언급하면 어느 쪽을 가리키는지 전체 제목을 읽지 않고는 알 수 없다. 또한 새 두 테스트가 `G-2`(371줄 이전)와 `H`(512줄) 사이에 끼어 들어가, 소스를 위에서 아래로 훑으면 `…G, G-2, I-1, I-2, H, I, I-2, J…` 순서로 보여 기존의 알파벳 순증 관행이 중간에 깨진다.
  - 제안: 새 두 테스트를 기존 시퀀스와 겹치지 않는 자체 ID(예: 마지막 `J` 다음인 `K`/`K-2`, 혹은 `IDEM-1`/`IDEM-2` 처럼 이 파일의 단일 문자 ID 네임스페이스와 시각적으로 구분되는 접두어)로 바꾸고, plan 문서의 `I-1`/`I-2` 인용도 함께 갱신할 것을 권한다. 파일 끝(또는 관련 블록 근처)에 추가해 순서를 보존하는 편이 중간 삽입보다 향후 diff 를 더 좁게 만든다.

- **[INFO]** (이전 라운드에서 이미 평가·유예된 항목, 이번 diff 에서도 코드 변경 없음) 캐시 히트 분기에서 `JSON.parse(cached.responseJson)` 이 두 번 중복 호출된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`, `:143` (`intercept()` 의 `switchMap` 콜백, 캐시 히트 branch)
  - 상세: `isErrorStatusCacheable(cached.statusCode)` 분기의 `HttpException` 생성자 인자와 그 아래 `return of(JSON.parse(cached.responseJson) …)` 가 각각 독립적으로 같은 문자열을 파싱한다. 두 분기가 상호 배타적이라 실행 시 1회만 돌지만, 소스만 보면 같은 값을 두 번 파싱하는 모양이다. `16_53_26`/`17_07_45` 라운드에서 "선택적 개선, 지금 손대면 재설계 diff 를 흐린다" 로 이미 유예됐고 이번 라운드에서도 해당 코드는 그대로다.
  - 제안: 필수 아님. `const parsed = JSON.parse(cached.responseJson) as unknown;` 을 두 분기 위로 한 번만 끌어올리면 단일 파싱 지점이 된다.

- **[INFO]** (이전 라운드 유예 항목, 변경 없음) `intercept()` 가 캐시 조회·hash 충돌·에러 재현·정상 재현·캐시 미스 다섯 갈래를 한 메서드(약 63줄)에 담고 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:88-150`
  - 상세: 각 분기가 얕고 인라인 주석이 근거를 바로 옆에 남겨 현재 가독성이 크게 훼손되진 않지만, 분기가 하나 더 늘면 단일 메서드로는 버거워질 지점이다.
  - 제안: 필수 아님. 캐시 히트 처리 블록 전체를 `private replayCached(cached, context, bodyHash): Observable<unknown>` 로 추출하면 `intercept()` 자체는 "조회 → 히트/미스 위임" 한 단계로 짧아진다.

- **[INFO]** (신규 관찰이나 파일 전반의 기존 관행과 동일 — 조치 불요) 신규 e2e 테스트 `I-1`/`I-2` 가 대기 노드·execution·node_execution 을 만드는 ~25줄짜리 raw SQL 블록을 그대로 반복한다
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:371-444`(I-1), `:446-510`(I-2)
  - 상세: 이 파일에는 같은 `INSERT INTO node/execution/node_execution … 'waiting_for_input' …` 3줄 블록이 이미 8곳 넘게(`G`·`G-2` 등) 반복돼 있고 공유 헬퍼가 없다. 새 두 테스트도 그 기존 패턴을 그대로 따랐을 뿐이라 이번 diff 가 새로 만든 중복은 아니다.
  - 제안: 조치 불요. 다만 이런 셋업이 더 늘어난다면 `createWaitingExecution(db, workflowId, fields)` 같은 공유 헬퍼로 뽑는 편이 낫다는 정도로만 남겨 둔다.

- **[INFO]** `review/code/2026/08/12/{16_29_45,16_53_26,17_07_45}/**` 신규 파일들은 이전 리뷰 라운드가 생성한 산출물이며 사람이 유지보수하는 소스가 아니라 리뷰 시점의 이력 기록이다
  - 위치: 해당 디렉터리 하위 신규 파일 전체
  - 상세: 저장소 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)상 그대로 커밋되는 이력이라 가독성·네이밍·중첩·매직넘버 등 통상적 유지보수성 기준을 적용할 대상이 아니다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 `16_29_45`(CRITICAL: dead code)·`16_53_26`(WARNING: 400 만 옛 mock)·`17_07_45`(WARNING: storeEntry 직렬화 실패·5xx 우회 검증)를 거쳐 재설계가 끝난 `idempotency.interceptor.ts`/`.spec.ts` 위에, `storeEntry` 의 `JSON.stringify` try/catch 보강(`ac8dd03ee`)과 신규 e2e 스위트(`0f7907ec4`, `I-1`/`I-2`)를 더한 상태다. 두 신규 커밋의 실제 코드 변경은 작고 목적이 명확하며(적재 실패가 원 예외를 대체하지 못하게 막는 try/catch, 실 파이프라인 관측), 기존에 이미 INFO 로 유예된 항목들(중복 `JSON.parse`, 2xx/409·410 판정의 비대칭 팩터링, `intercept()` 길이)은 이번 diff 에서 변경되지 않았으므로 그대로 INFO 로 재확인만 한다. 유일하게 새로 발견된, 실제로 조치가 필요한 항목은 신규 e2e 테스트가 파일의 기존 순차 ID 관행을 어기고 이미 사용 중인 `I-2` 라는 테스트 ID 를 재사용해 같은 파일 안에 이름이 겹치는 두 테스트를 만든 것이다 — 기능적으로는 두 테스트 모두 정상 동작하지만, `I-2` 라는 식별자가 plan 문서에까지 영구 인용되어 있어 향후 추적성을 해친다. 그 외 코드 품질(네이밍·중첩·매직넘버·중복)은 이 코드베이스의 "근거를 코드 옆에 남기는" 컨벤션과 일관되게 양호하다.

## 위험도

LOW
