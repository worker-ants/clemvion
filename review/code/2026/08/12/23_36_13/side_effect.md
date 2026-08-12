### 발견사항

- **[INFO]** 기존(비변경) 테스트가 이번 diff 의 새 warn 부작용을 mock 없이 실행 — 콘솔/stdout 노이즈
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:505` (`it('손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재', ...)`)
  - 상세: 이번 diff 이전에는 바깥 엔트리 JSON 파싱 실패(`엔트리` 분기)가 조용히 강등만 했다. 이번 diff 로 `discardCorruptEntry('엔트리', err, processFresh)` 를 거치며 `this.logger.warn(...)` 을 **항상** 호출하도록 바뀌었는데(`idempotency.interceptor.ts` 의 `discardCorruptEntry`), 이 diff 가 직접 건드리지 않은 기존 테스트(`:505`, `redis.get.mockResolvedValue('not-valid-json{')`)는 정확히 그 분기를 실행하면서도 `Logger.prototype.warn` 을 spy/mock 하지 않는다. 결과적으로 테스트 실행 중 실제 `Logger.warn` 호출(콘솔 출력)이 새로 발생한다. 기능·assertion 에는 영향 없다. 같은 파일의 다른 손상-엔트리 테스트 8곳(`:541,566,638,748,828,882,915,1079` 부근)은 모두 `warnSpy` 로 이를 감싸는 것과 대비된다.
  - 제안: 이 테스트에도 `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 을 추가해 형제 테스트들과 일관되게 맞출 것(직전 라운드(`23_24_08`)의 side_effect 리뷰가 이미 지적했고 WARNING 문턱 아래로 판정돼 미조치 상태로 남아 있다 — 기능 결함 아님, 낮은 우선순위).

- **[정보/참고, 액션 불요]** `res.status()` mutate 시점이 payload 파싱 성공 이후로 이동 — 부분 상태변경 제거(긍정적 부수효과)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `switchMap` 콜백, `const res = context.switchToHttp().getResponse<HttpResponseLike>(); if (typeof res.status === 'function') res.status(cached.statusCode);` 호출부(현재 파일 200번째 줄 부근)
  - 상세: 종전에는 `res.status(cached.statusCode)` 호출 뒤에 무방비 `JSON.parse(cached.responseJson)` 을 수행했다 — 파싱 실패 시 응답 객체(`res`, Nest 프레임워크가 소유한 공유 상태)는 이미 mutate 된 채로 `SyntaxError` 가 500 으로 마스킹됐다. 이번 리팩터는 `cachedPayload` 파싱을 `bodyHash` 판정 직후·`res.status()` 호출보다 **먼저**로 끌어올려, 파싱 실패 시 `res.status()` 자체가 호출되지 않고 `processFresh()` 로 깨끗하게 강등되도록 바뀌었다. 의도치 않은 부분 상태 변경(응답 mutate 후 크래시)이 부수적으로 사라진 것 — 문제가 아니라 개선.

### 요약

핵심 변경(`idempotency.interceptor.ts` 의 `discardCorruptEntry` 신설 + 파싱 순서 재배치)은 **private 메서드 추가**로, `intercept()` 의 시그니처·생성자·공개 인터페이스는 그대로다. 신규 전역 변수, 환경 변수 읽기/쓰기, 예상치 못한 파일시스템 접근, 의도치 않은 외부 네트워크 호출은 없다(Redis GET/SET 호출 패턴 자체는 불변). `this.redis` 는 생성자에서 1회 설정되는 인스턴스 필드이고 요청 간 공유되는 가변 상태를 추가로 만들지 않는다 — 각 요청은 `intercept()` 호출마다 독립된 클로저(`processFresh`)를 갖는다. 새로 추가된 `this.logger.warn` 호출은 이 PR 의 핵심 목적(침묵 실패를 관측 가능하게 만드는 것)이라 의도된 부작용이며, RxJS 파이프라인 구조(`catchError` → `switchMap` → `tap`/`catchError`)와 `bodyHash` 판정이 payload 파싱보다 먼저라는 순서도 그대로 보존된다. 클라이언트 관점의 관측 가능한 동작 변화(손상된 캐시 엔트리를 만난 요청: 종전 500 → 이제 fail-open 정상 처리)는 `CHANGELOG.md` 에 명시적으로 문서화되어 의도치 않은 부작용이 아니다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 체크박스·완료 노트 갱신뿐이고, `review/code/2026/08/12/23_24_08/**` 신규 파일들은 직전 라운드 리뷰 산출물로 이 저장소 관례(코드 리뷰 산출물은 `review/code/**`)에 부합하는 정상적인 부수 파일 생성이다. 유일하게 남는 항목은 이 diff 가 건드리지 않은 기존 테스트 1곳이 새로 추가된 warn 부작용을 mock 없이 실행해 테스트 실행 중 실제 로그를 콘솔로 흘리는 것 — 기능·계약에는 영향 없는 테스트 위생 수준 INFO이며, 직전 라운드에서 이미 식별되고 WARNING 문턱 아래로 판정돼 의도적으로 미조치 상태다.

### 위험도
LOW
