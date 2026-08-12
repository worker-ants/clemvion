# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 캐시 히트 재현 분기에서 `JSON.parse(cached.responseJson)`이 두 개의 서로 배타적인 분기에 한 번씩 — 시각적으로는 "같은 값을 두 번 파싱"하는 모양이라 잠깐 멈추게 된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`, `:143` (`intercept()`의 `switchMap` 콜백, 캐시 히트 분기)
  - 상세: `isErrorStatusCacheable(cached.statusCode)`가 참이면 137행에서, 거짓이면 143행에서 각각 독립적으로 `JSON.parse(cached.responseJson)`을 호출한다. 실행 경로는 상호 배타적이라 런타임에 실제로 두 번 파싱되지는 않지만, 소스만 읽는 사람에게는 중복으로 보인다. 이 항목은 4~5라운드 연속 maintainability INFO로 지적·유예된 사안(`plan/in-progress/backend-lint-gate-broken-on-main.md:561-568`)이며, 같은 plan 항목이 "캐시 엔트리 내부 `responseJson` 손상 무방비"(안쪽 `JSON.parse` 실패 시 그대로 throw → 500 마스킹)와 묶어서 한 번에 닫는 편이 낫다고 이미 기록해 두었다.
  - 제안: 필수 조치 아님(선재·유예 확정). 착수 시 `const parsed = JSON.parse(cached.responseJson) as unknown;`를 두 분기 위로 한 번만 끌어올리고, 그 자리에 손상 방어(`try/catch`)를 추가하면 이번 항목과 plan의 손상-무방비 항목을 동시에 해소한다.

- **[INFO]** "닫힌 목록" 판정이 에러 쪽(`isErrorStatusCacheable`)은 named 함수, 성공 쪽(2xx)은 `cacheTapped` 내부 인라인 조건으로 비대칭 팩터링돼 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:172-177`(인라인 `if (statusCode < 200 || statusCode >= 300) return;`) vs `:255-257`(`isErrorStatusCacheable` named 함수)
  - 상세: 클래스 상단 docstring과 `cacheTapped`/`isErrorStatusCacheable` JSDoc 모두 "§R8 닫힌 목록 = 2xx + 409 + 410"을 하나의 정책으로 설명하는데, 실제 구현은 그 정책의 절반(에러 쪽)만 이름 붙은 단일 출처로 뽑혀 있다. 향후 §R8 범위가 또 바뀌면(이번 PR이 그랬듯) 수정 지점을 찾으려면 named 함수와 인라인 조건 두 곳을 모두 봐야 한다. 이전 라운드(`16_53_26` maintainability INFO)에서 이미 지적된 사안이며 이번 최종 diff에도 그대로 남아 있다.
  - 제안: 필수 아님. `isSuccessStatusCacheable(statusCode)`를 같은 방식으로 뽑으면 정책이 코드에서도 대칭적인 두 named 함수로 드러난다.

- **[INFO]** `intercept()`가 캐시 조회·손상 fallback·body 충돌·에러 재현·정상 재현·미스 위임 여섯 갈래를 한 메서드(약 63줄)에서 처리한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:88-150`
  - 상세: `switchMap` 콜백 하나가 순차 `if`/`try-catch`로 (1) 손상 JSON fallback, (2) bodyHash 불일치 시 409, (3) 캐시된 409/410을 예외로 재throw, (4) 캐시된 2xx를 정상 응답으로 재현, (5) 캐시 미스 시 downstream 위임을 처리해 중첩 깊이가 최대 4단(`switchMap → if(cachedJson) → try/if → if(isErrorStatusCacheable) → if(typeof res.status)`)에 이른다. 각 분기가 짧고 인라인 주석이 근거를 바로 옆에 남겨 두어 현재 가독성이 크게 훼손되진 않지만, 분기가 하나 더 늘면 단일 메서드로는 버거워질 수 있는 지점이다. 이전 라운드(`16_53_26` maintainability INFO)에서 이미 지적됐고 이후 라운드(에러 재현 분기 추가, `storeEntry` 직렬화 방어 추가)를 거치며 메서드가 조금 더 길어졌다.
  - 제안: 필수 아님. 캐시 히트 처리(112-144행 `if (cachedJson) { ... }` 블록)를 `private replayCached(cached, context, bodyHash): Observable<unknown>`로 추출하면 `intercept()` 자체는 "조회 → 히트/미스 위임" 한 단계로 짧아진다.

- **[INFO]** e2e 테스트가 인터셉터의 Redis 키 prefix(`interaction:idempotency:`)를 export되지 않은 내부 상수(`REDIS_KEY_PREFIX`)와 별개로 3곳에 리터럴로 하드코딩한다
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:425`, `:495`, `:538` (`redis.get(\`interaction:idempotency:${idempotencyKey}\`)`) vs `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:21`(`const REDIS_KEY_PREFIX = 'interaction:idempotency:';` — export 없음)
  - 상세: 이 e2e 블록(`IDEM-1`~`IDEM-3`) 자체가 "Redis 엔트리를 직접 조회해야 판별력이 생긴다"는 것을 스스로 증명한 계약이라(주석에 그 과정이 기록돼 있음) 리터럴 정합성이 특히 중요한 자리인데, prefix 값 자체는 단일 출처(named export)가 아니라 두 파일에 각각 하드코딩돼 있다. `REDIS_KEY_PREFIX`를 바꾸면 컴파일러는 이 drift를 잡아 주지 못하고(문자열 리터럴이라 타입 불일치가 없음), e2e가 항상 `null`을 관측해 "캐시가 안 됐다"는 거짓 실패(또는 다른 접두사로 우연히 통과하는 거짓 성공)로 이어질 수 있다. 이번 diff가 새로 만든 문제는 아니고(prefix 자체는 이번 PR 이전부터 있던 상수), e2e 블록 신설로 리터럴 하드코딩이 3곳으로 늘었다는 점만 새롭다.
  - 제안: `REDIS_KEY_PREFIX`를 인터셉터에서 `export`하고 e2e가 그 값을 import해 사용하면, 이 계약의 유일한 관측점(SoT)이 실제로 하나가 된다.

- **[INFO]** e2e `IDEM-1`~`IDEM-3` 세 테스트가 워크플로/노드/execution/node_execution 생성 셋업(각 10~15줄)을 거의 그대로 반복한다
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:376-399`(IDEM-1), `:452-477`(IDEM-2), `:519-526`(IDEM-3, 상대적으로 짧음)
  - 상세: 다만 이 패턴은 같은 파일의 기존 테스트(`G`, `G-2` 등, 271-359행)가 이미 확립한 스타일이며, `createTriggerWithInteraction` 헬퍼 외의 세부 fixture(대기 노드·execution 상태)는 테스트마다 의도적으로 달라 공유 헬퍼로 접기 어렵다. 이 저장소가 이미 "e2e 셋업 반복"을 4~5라운드째 INFO로 유예해 온 것과 동일 클래스이며, 이번 신규 3건이 그 반복을 늘렸을 뿐 새로운 패턴을 도입한 것은 아니다.
  - 제안: 조치 불요(기존 컨벤션과 일치). 다만 이런 fixture 조합이 더 늘어난다면 `createWaitingFormExecution(db, { status, ... })` 류의 공용 헬퍼로 접는 것을 고려할 수 있다.

- **[INFO]** `review/code/2026/08/12/{16_29_45,16_53_26,17_07_45,18_07_36,18_37_45}/**` 하위 신규 파일은 이전 리뷰 라운드가 생성한 산출물(기록)이며, 사람이 유지보수하는 소스가 아니라 가독성·네이밍·중첩·매직넘버 등 통상 유지보수성 기준을 적용할 대상이 아니다
  - 위치: 위 5개 세션 디렉토리 하위 전체(`RESOLUTION.md`, `SUMMARY.md`, 각 reviewer `.md`, `meta.json`, `_retry_state.json`)
  - 제안: 조치 불요.

## 요약

이번 diff의 핵심(`idempotency.interceptor.ts`의 캐시 대상 판정을 Spec EIA §R8의 닫힌 목록(`2xx`·`409`·`410`)에 맞추는 재설계, 그리고 이를 실제 RxJS error 채널·e2e 파이프라인에서 검증하는 테스트 확장)은 여러 라운드의 리뷰·재설계를 거치며 유지보수성 관점에서 잘 정리된 최종 상태에 도달했다. `isErrorStatusCacheable()`이라는 named 함수로 정책 판정을 분리했고, JSDoc이 "왜 `>= 400`·`=== 400` 두 축약이 각각 오답인지"와 "왜 error 채널을 봐야 하는지"를 코드 옆에 정확히 남겼으며, 그 각각을 잡는 회귀 테스트(단위 12건 + e2e 3건)가 뮤테이션 실측으로 판별력까지 확인됐다. 남아 있는 항목은 전부 INFO 수준의 선택적 개선 여지뿐이다 — 캐시 히트 분기의 시각적 `JSON.parse` 중복, 성공/에러 판정 팩터링 비대칭, `intercept()`의 다소 늘어난 길이(6갈래 분기), e2e의 Redis 키 prefix 리터럴 하드코딩(3곳), e2e 셋업 반복. 이 중 다수는 4~5라운드 연속 동일하게 지적·유예되어 온 항목으로 이번 diff가 새로 도입한 결함이 아니며, 지금 손대면 오히려 이미 수렴된 diff를 흐릴 수 있다는 판단(`18_37_45` RESOLUTION)과 일관된다. 즉시 조치가 필요한 CRITICAL/WARNING 성격의 유지보수성 결함은 발견되지 않았다.

## 위험도

NONE
