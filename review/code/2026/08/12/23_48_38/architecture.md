# Architecture Review — `IdempotencyInterceptor` responseJson 손상 방어 (2026-08-12 23:48)

## 범위

실질 구조 변경은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 1개 파일에 국한된다. 나머지 diff(`CHANGELOG.md`, `idempotency.interceptor.spec.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `review/code/2026/08/12/{23_24_08,23_36_13}/**`)는 문서·테스트·이전 두 라운드 리뷰 산출물로, 아키텍처 관점에서 검토할 구조가 없다. 이전 두 라운드 모두 router 가 architecture 를 "구조 변경 없음, private 메서드 추가만" 이유로 제외했는데, 소스를 직접 읽고 그 판단에 동의한다.

## 발견사항

- **[INFO]** `discardCorruptEntry` 로의 통합은 정석적인 Extract Method + 얕은 decorator 패턴이다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `discardCorruptEntry` (219행), 호출부 161행·185행
  - 상세: 종전에는 "손상된 캐시 → 무시하고 신규 처리" 로직이 바깥 엔트리 파싱 실패 자리 하나에만 있었고, 안쪽 `responseJson` 파싱은 두 재현 분기에서 무방비로 노출돼 있었다(원 결함). 이번 변경은 그 처리를 `discardCorruptEntry(what, err, processFresh)` 한 곳으로 모으고, "무엇이 깨졌는지"(`엔트리`/`payload`)만 파라미터로 갈랐다. warn 로깅(횡단 관심사)과 폴백 실행(`processFresh` thunk)을 분리해 얹는 형태라 AOP 스타일의 얇은 wrapper로 봐도 되고, 두 호출부의 "신규 처리로 강등 + warn" 동작이 한 곳에서만 바뀌므로 향후 세 번째 손상 지점이 생겨도 확장 지점이 이미 마련돼 있다(OCP 측면에서 유리).
  - 제안: 없음 — 조치 불요, 긍정적 관찰.

- **[INFO]** `discardCorruptEntry<T>` 제네릭이 현재 두 호출부 모두 `T = Observable<unknown>` 로만 인스턴스화된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:219-228`
  - 상세: 제네릭이 실질적 다형성 이득 없이 선언돼 있다(추상화가 아주 약간 과함). 다만 직전 두 라운드(`review/code/2026/08/12/23_24_08/RESOLUTION.md` INFO #13, `23_36_13/SUMMARY.md` INFO #10)에서 이미 같은 지점을 확인하고 "세 번째 호출부 생기면 재평가" 로 명시적으로 유예했다 — 이번 라운드에서 새로 뒤집을 근거는 없다.
  - 제안: 조치 불요(기존 유예 유지). 세 번째 호출부(예: 향후 다른 파싱 실패 지점)가 추가되면 그때 `T` 제거 여부를 재검토.

- **[INFO]** `switchMap` 콜백 하나가 캐시 미스 · 엔트리 손상 · bodyHash 불일치(409) · payload 손상 · 에러 재현(409/410) · 성공 재현 6갈래를 조기 반환으로 처리한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 내 `switchMap((cachedJson) => {...})`, 대략 149-202행
  - 상세: 순환 복잡도가 파일 내 다른 메서드보다 높지만 조기 반환으로 중첩은 1단계로 유지되고, 각 분기의 의도가 인접 주석으로 명확히 설명돼 있다. 직전 라운드 maintainability 리뷰(`23_36_13/SUMMARY.md` INFO #9)가 이미 같은 지점을 짚고 "6번째 분기 추가 시 private 메서드 추출 재고" 로 처분했다. 아키텍처 관점에서도 동의 — 지금 시점에 강제 분리하면 오히려 각 분기가 공유하는 지역 변수(`cached`, `cachedPayload`, `bodyHash`)를 메서드 인자로 흩뿌려야 해서 응집도가 떨어질 수 있다.
  - 제안: 조치 불요. 분기가 하나 더 늘어나는 시점에 "손상 판정"과 "재현 판정" 두 책임으로 메서드 분리를 재검토.

## 요약

이번 diff 의 실질 구조 변경은 `IdempotencyInterceptor.intercept()` 안에서 중복돼 있던 두 곳의 "손상된 캐시 → 신규 처리" 로직을 `discardCorruptEntry()` 사설 메서드 하나로 통합한 것이 전부다. SRP·응집도·레이어 경계·순환 의존성 모두 이번 변경으로 악화되지 않았고, 오히려 두 호출부의 동작(신규 처리)과 가시성(warn)을 한 곳에서 통제하게 되어 개방-폐쇄 원칙 측면에서 향후 확장(세 번째 손상 지점)에 유리해졌다. `discardCorruptEntry<T>` 의 단형성 제네릭과 `switchMap` 콜백의 분기 수는 이미 직전 두 라운드가 식별·유예한 항목으로, 이번 diff 가 그 폭을 넓히지 않았으므로 재상정할 근거가 없다. NestJS 인터셉터 계층(cross-cutting)과 서비스 계층(`interaction.service.ts` 가 던지는 409/410) 사이의 암묵적 결합은 기존 설계 그대로이며 이번 변경이 그 경계를 흐리지 않는다.

## 위험도
NONE
