# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** "쌍둥이" 테스트 키 헬퍼 두 개가 인자 순서는 통일됐지만 `route` 파라미터의 타입 엄격도가 다르다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:81-87` (`scopedKey(executionId: string, rawKey: string, route: string = DEFAULT_ROUTE)`) vs `codebase/backend/test/external-interaction.e2e-spec.ts:129-135` (`idempotencyCacheKey(executionId: string, rawKey: string, route: 'interact' | 'cancel' = 'interact')`)
  - 상세: 직전 라운드(`review/code/2026/08/12/21_02_30/RESOLUTION.md` WARNING #1)에서 두 헬퍼의 **인자 순서**가 반대였던 문제는 고쳤고, `scopedKey` 의 docstring(76-79행)도 "인자 순서는 e2e 의 `idempotencyCacheKey` 와 같다"고 명시해 두 헬퍼가 거울상으로 유지돼야 한다는 의도를 분명히 밝혔다. 다만 그 거울상 통일이 순서에만 적용됐고 **타입**에는 적용되지 않았다 — unit 쪽 `route` 는 임의의 `string` 을 받고, e2e 쪽은 `'interact' | 'cancel'` 리터럴 유니온으로 제한한다. 현재는 두 헬퍼 모두 호출부가 `'interact'`/`'cancel'`/`DEFAULT_ROUTE` 리터럴만 넘겨 실질 위험은 없지만, "두 헬퍼는 하나의 계약을 거울처럼 반영해야 한다"는 명시된 의도 자체가 리뷰가 이미 한 번 잡았던 종류의 drift(조용히 어긋나는 쌍둥이 헬퍼)를 다시 열어 둔다 — 누군가 unit 쪽에 오타 route 문자열을 넘겨도 컴파일 타임에 잡히지 않는다.
  - 제안: `scopedKey` 의 `route` 파라미터도 `'interact' | 'cancel'` 유니온으로 좁히거나, 두 헬퍼가 공유하는 타입 별칭(`type IdempotencyRoute = 'interact' | 'cancel'`)을 두는 정도로 충분하다. 급하지 않음 — 다음에 이 헬퍼들을 만질 때 반영해도 됨.

- **[INFO]** `IdempotencyInterceptor.intercept()` 가 이번 diff로 스코프 계산 로직(약 23줄)이 더해져 함수 하나가 여러 책임(헤더 파싱 · ctx 검증 · route 결정 · 키 조립 · Redis GET 파이프라인 · 캐시 hit/miss 분기)을 계속 넓혀가고 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 의 `intercept()` (91-176행, 이번 diff 는 그중 97-121행을 추가)
  - 상세: 이미 직전 라운드에서 INFO로 인지되고 "축이 하나 더 생기면 `resolveScopedKey()` 분리"라는 조건부로 유예된 항목이다(RESOLUTION INFO #4). early-return 가드 덕에 중첩 깊이 자체는 얕게 유지되고 있어 즉각적인 가독성 문제는 아니지만, 이번 diff로 이미 두 축(execution+route)이 이 메서드 안에 들어왔고 유예 조건("한 축 더")에 한 걸음 더 가까워졌다는 점만 재확인해 둔다. 액션 불요 — 참고용 재확인.
  - 제안: 조치 불필요. 세 번째 축(예: tokenFamily)이 추가되는 시점에 스코프 키 조립부를 `resolveScopedKey(req, context): string | null` 형태의 private 헬퍼로 분리 검토.

## 확인한 항목 (문제 없음)

- 직전 라운드(`21_02_30`) WARNING 3건이 diff에 모두 반영돼 있음을 직접 대조 확인했다:
  - WARNING #1(인자 순서 불일치) → `scopedKey(executionId, rawKey, route)` 로 통일, 호출부 6자리 갱신됨 (`idempotency.interceptor.spec.ts:81-87, 837-851, 875-887`).
  - WARNING #2(route 축 테스트가 SET 미검증) → `setKeys` 단언 추가됨 (`idempotency.interceptor.spec.ts:883-887`), 뮤테이션으로 사살 확인됨(RESOLUTION 기록).
  - WARNING #3(모듈 top docstring 이 4번째 describe 미색인) → 상단 docstring 27-32행에 4번째 describe 문단 추가 + 이 블록의 한계(mock `getHandler()` 로는 실 route 이름 미검증, e2e `IDEM-5` 가 그 자리)까지 명시됨.
- `makeContext()` 의 `executionId: null`(ctx 미설정) vs `undefined`(기본값 사용) 구분, `getHandler()` 가 실제 이름 있는 함수를 반환하도록 만든 mock(`{ [routeName]: () => undefined }[routeName]`)은 다소 영리한 기법이지만 그 이유를 docstring(96-100행)에서 바로 설명해 두어 다음 편집자가 의도를 놓치지 않게 했다.
- 신규 `describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)')` 블록(unit)과 `IDEM-4`/`IDEM-5`(e2e)는 각 `it` 마다 판별력(discriminating power)·단언 순서의 이유를 인라인 주석으로 남겨 향후 회귀 시 "왜 이 순서인가"를 재추론할 필요가 없게 했다 — 이 저장소가 반복 겪은 "단언 순서가 잘못돼 뮤턴트가 앞에서 죽는" 실패 패턴에 대한 문서화가 특히 좋다.
- e2e `IDEM-4`/`IDEM-5` 의 DB 직접 INSERT 방식(트리거/노드/execution/node_execution)은 이 파일의 기존 관례(G, G-2, IDEM-1~3 등)와 동일한 패턴을 그대로 따른 것이라 이번 diff가 새로 만든 중복이 아니다 — 파일 전체가 헬퍼화 없이 각 테스트가 자기 완결적으로 DB를 세팅하는 기존 스타일을 유지.
- 캐시 키 포맷 문자열이 프로덕션 1곳 + 테스트 2곳에 독립 하드코딩된 점(`REDIS_KEY_PREFIX` 조립부 · `scopedKey` · `idempotencyCacheKey`)은 직전 라운드에서 이미 "블랙박스 회귀 테스트로서 의도된 재구현"으로 유예됐고, 이번 diff가 그 형태를 유지만 했을 뿐 새로 악화시키지 않았다.
- CHANGELOG.md 신규 항목은 인접 항목들과 문체·구조(변경 요약 → 영향 → 배포 전환기 노트)가 일관되며, 새 매직 넘버·이례적 네이밍 없음.
- `plan/complete/spec-draft-eia-idempotency-key-scope.md`(신규) / `plan/in-progress/...`(삭제)는 완료된 plan 을 `in-progress` → `complete` 로 옮기는 저장소 라이프사이클 규약을 그대로 따른 이동이며 본문 내용은 동일 + 완료 노트만 덧붙었다.
- `review/code/2026/08/12/21_02_30/*` 신규 파일들은 이전 라운드 리뷰 산출물이 저장소 규약(`review/code/<날짜>/<시각>/`)대로 커밋된 것으로, 코드가 아닌 리포트 문서라 유지보수성 관점의 코드 품질 이슈는 해당 없음.

## 요약
이번 diff는 직전 리뷰 라운드(`21_02_30`)의 WARNING 3건(테스트 헬퍼 인자 순서·route 축 SET 미검증·모듈 docstring stale)을 정확히 겨냥해 전부 반영했고, 프로덕션 코드(`idempotency.interceptor.ts`)는 이번 라운드에서 추가 변경 없이 이전 상태를 유지한다. 새로 발견된 사항은 두 건 모두 INFO 수준으로, (1) 쌍둥이 테스트 헬퍼의 `route` 파라미터 타입 엄격도가 인자 순서만큼 통일되지 않은 점, (2) `intercept()` 메서드 길이가 이미 인지된 유예 조건에 한 걸음 더 가까워진 점을 재확인하는 수준이며 둘 다 즉각 조치가 필요하지 않다. 테스트·주석·CHANGELOG 전반의 문서화 밀도와 "왜"를 남기는 습관이 일관되게 유지되고 있어 유지보수성 관점에서 우려할 사항은 없다.

## 위험도
LOW
