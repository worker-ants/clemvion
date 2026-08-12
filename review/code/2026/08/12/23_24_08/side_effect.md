### 발견사항

- **[INFO]** 기존(비변경) 테스트가 새 로깅 부작용을 mock 없이 그대로 실행 — 콘솔 노이즈 발생
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:503` (`it('손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재', ...)` — 이 diff 가 건드리지 않은 기존 테스트)
  - 상세: 프로덕션 코드(`idempotency.interceptor.ts`)의 바깥 JSON 파싱 실패 분기가 종전에는 아무 로그도 남기지 않았으나, 이번 변경으로 `discardCorruptEntry('엔트리', err, processFresh)` 를 거쳐 `this.logger.warn(...)` 을 항상 호출하도록 바뀌었다. 이 테스트는 정확히 그 분기(`redis.get.mockResolvedValue('not-valid-json{')`)를 실행하지만 `Logger.prototype.warn` 을 mock/spy 하지 않으므로, 변경 후에는 이 테스트가 (침묵하던 과거와 달리) **실제 `Logger.warn` 호출 — 즉 실제 콘솔/stdout 출력**을 유발한다. 기능적으로는 문제없고 assertion 도 영향받지 않지만, 이 diff 가 직접 건드리지 않은 코드에 side effect(로그 출력)를 새로 주입한 사례이며 CI 로그를 오염시킨다.
  - 제안: 이 기존 테스트에도 `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 을 추가해 다른 손상-엔트리 테스트들과 일관되게 만들 것(선택 사항 — 기능 결함은 아님).

- **[INFO]** 신규 테스트 1건도 같은 이유로 `Logger.warn` 을 mock 없이 실행
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:629` (`it('안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리 — 에러 재현 분기도 같은 방어를 받는다', ...)`)
  - 상세: 같은 diff 안의 형제 테스트 3건(`535`, `559`, 그리고 `Redis 런타임 장애` describe 의 형제 테스트들)은 모두 `warnSpy` 로 `Logger.prototype.warn` 을 mock 하는데, 이 테스트만 `discardCorruptEntry('payload', ...)` 경로(즉 `statusCode: 409` + 손상된 `responseJson`)를 실행하면서 warn mock 을 두지 않았다. 실제 `Logger.warn` 이 호출돼 테스트 실행 중 콘솔에 로그가 찍힌다 — 기능 결함은 아니고 assertion 도 안 걸리지만, 같은 파일의 다른 자리와 일관성이 없고 관측되지 않은 부작용(로그 출력)이 그대로 샌다.
  - 제안: 다른 손상-엔트리 테스트와 동일하게 `warnSpy` 를 추가(어차피 `expect(warnSpy).toHaveBeenCalledWith(...)` 로 "payload 손상" 로그까지 함께 고정하면 회귀 방지 가치도 생긴다).

- **[정보/참고, 액션 불요]** 응답 객체 mutate 시점이 payload 파싱 성공 이후로 옮겨져 부분 상태 변경이 사라짐 (긍정적 부수효과)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `switchMap` 콜백, `res.status(cached.statusCode)` 호출 지점(라인 188 부근)
  - 상세: 종전 코드는 `res.status(cached.statusCode)` 를 먼저 호출한 뒤 `JSON.parse(cached.responseJson)` 을 무방비로 수행했다 — 파싱이 실패하면 응답 객체(`res`, 공유 상태)는 이미 mutate 된 채로 예외가 500 으로 마스킹됐다. 이번 리팩터는 `cachedPayload` 를 `bodyHash` 판정 직후, `res.status()` 호출보다 **먼저** 파싱하도록 끌어올려서, 파싱 실패 시 `res.status()` 자체가 아예 호출되지 않고 `processFresh()` 로 깨끗하게 강등된다. 의도치 않은 부분 상태 변경(응답 객체 mutate 후 크래시)이 부수적으로 사라진 것으로, 문제가 아니라 개선이다.

### 요약

두 파일(`idempotency.interceptor.ts`, `.spec.ts`)의 변경은 손상된 캐시 `responseJson` 을 무방비 파싱하던 선재 결함을 닫고, 그 결과를 `discardCorruptEntry` 라는 새 private 헬퍼로 일원화한 리팩터다. 공개 시그니처(`intercept()`, 생성자)는 변경 없고, 신규 전역 변수·환경 변수 읽기/쓰기·파일시스템 접근·의도치 않은 네트워크 호출은 없다. 새로 추가된 `this.logger.warn` 호출은 이 PR 의 핵심 목적(침묵 실패를 관측 가능하게 만드는 것)이므로 의도된 부작용이며, RxJS 파이프라인 구조(`catchError` → `switchMap` → `tap`/`catchError`)도 그대로 보존된다. 유일하게 눈에 띄는 항목은 테스트 위생 수준의 것으로, 손상-엔트리 경로를 실행하는 테스트 2곳(기존 1 · 신규 1)이 `Logger.prototype.warn` 을 mock 하지 않아 실제 로그 출력이 테스트 실행 중 새어 나가는데, 기능·계약에는 영향이 없다. 부수적으로 `res.status()` 호출이 payload 파싱 성공 이후로 옮겨져 파싱 실패 시 응답 객체의 부분 mutate 가 사라진 점은 긍정적인 부작용이다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 체크박스·완료 노트 갱신뿐으로 코드 부작용과 무관하다.

### 위험도
LOW
