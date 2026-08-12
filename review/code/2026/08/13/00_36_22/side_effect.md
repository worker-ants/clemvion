# 부작용(Side Effect) 리뷰 — `00_36_22`

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (프로덕션)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (테스트)
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서, 부작용 관점 대상 아님
- `review/code/2026/08/12/{23_24_08,23_36_13,23_48_38}/**`, `review/code/2026/08/13/00_20_20/**`,
  `review/consistency/**` — 이전 라운드 리뷰 파이프라인의 정상 산출물(신규 파일). 이 저장소 관례상
  `review/code/<날짜>/<시각>/` 에 커밋되며, 이번 라운드가 만든 부작용이 아니다.

이번 라운드는 `origin/main..HEAD` 누적 diff 를 다시 검토했다. 프로덕션 코드
(`idempotency.interceptor.ts`)는 커밋 `86de12278` 이후 변경이 없고, 직전 라운드(`00_20_20`)가
이미 이 파일을 상세히 검토했다. 이번에 추가된 커밋 `c51809a0b` 은 테스트 docstring 보강과
`it.each` fixture 에 `expectedShape` 인자를 추가해 `warnSpy` 단언을 값 단위로 좁힌 것뿐이라
(`git show c51809a0b -- .../idempotency.interceptor.ts` 결과 빈 diff로 확인) 프로덕션 부작용
표면에 변화가 없다.

## 발견사항

- **[INFO]** 캐시 손상 시 상태코드가 `500 → 정상 처리`로 바뀌는 client-observable 변화 — 의도됐고 `CHANGELOG.md` 에 공시됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`switchMap` 콜백의 payload 파싱 실패 분기, `discardCorruptEntry('payload', err, processFresh)` 호출부 — 200번째 줄 부근), `CHANGELOG.md:3-25`
  - 상세: 종전에는 `cached.responseJson` 파싱이 재현 분기 두 곳에서 방어 없이 실행돼 손상 시 `SyntaxError` 가 `GlobalExceptionFilter` 까지 올라가 `500` 이 됐다. 이번 diff 는 그 파싱을 한 곳으로 모으고 `try/catch` 로 감싸 `discardCorruptEntry` 로 강등한다 — 동일 요청이 이제 원 상태코드로 신규 처리된다. 이 인터셉터를 통과하는 모든 클라이언트에 영향을 미칠 수 있는 변화이지만 (1) `CHANGELOG.md` 신규 섹션이 정확히 "클라이언트 영향" 으로 명시하고, (2) fail-open 설계 원칙과 부합하는 의도된 방향 전환이며, (3) 회귀 테스트(`idempotency.interceptor.spec.ts:650`, `:720`)로 고정돼 있다. 숨겨진 부작용이 아니라 이 PR 의 목적 그 자체다.
  - 제안: 없음 — 이미 문서화·테스트로 계약화됨.

- **[INFO]** 종전에 조용히 넘어가던 "바깥 엔트리 손상" 경로가 이제 `Logger.warn` 을 남긴다 — 새 로그 부작용, 의도됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:234-243`(`discardCorruptEntry`), 호출부 `:161`, `:171-175`
  - 상세: `this.logger`(`:89`)는 기존 인스턴스 필드이고 새 전역 상태를 도입하지 않는다. 바깥 JSON 파싱 실패(`엔트리` 케이스)는 이전에는 `catch { return next.handle()... }` 로 가시성 없이 강등됐는데, 이제 `discardCorruptEntry` 를 거치며 매 발생마다 warn 로그를 남긴다. 캐시가 자주 손상되는 환경이라면 로그 볼륨이 늘 수 있으나 이는 `CHANGELOG.md:21-24` 가 명시적으로 의도한 변화이고, 값 자체는 로그에 안 찍힌다(`describeShape`, `:381-385` — 타입/형태만 문자열화해 캐시 payload 누출을 방지).
  - 제안: 없음 — 조치 불요. 확인 목적 기록.

- **[INFO]** `discardCorruptEntry<T>` 사설 헬퍼·`isIdempotencyEntry`/`describeShape` 모듈 헬퍼 — 전부 non-export, 공개 시그니처 무변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:234`(`discardCorruptEntry`), `:370`(`isIdempotencyEntry`), `:381`(`describeShape`)
  - 상세: `intercept(context, next): Observable<unknown>` (NestInterceptor 계약)과 생성자 시그니처는 변경되지 않았다. 신설된 세 헬퍼는 모두 `private` 이거나 파일 스코프 함수라 클래스 외부 호출자·다른 모듈에 영향이 없다. 환경 변수 읽기/쓰기, 신규 네트워크 호출(Redis 호출부는 기존과 동일한 `redis.get`/`redis.set` 패턴 유지), 새 전역 변수 도입 모두 없다.
  - 제안: 없음.

- **[INFO]** 테스트의 `Logger.prototype.warn` 전역 mock — 이번 라운드 기준 모든 warn 유발 경로가 `try/finally` 로 스코프를 지킴(직전 라운드 지적이 이번 diff 로 해소됨)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:515`(`손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재`, 이 diff 이전엔 mock 없이 warn 을 그대로 실행하던 자리였음), `:594`(`it.each` 형태 검증 8케이스), `:626`, `:650`, `:720`, `:834`, `:909` — 전부 `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 뒤 `try { … } finally { warnSpy.mockRestore(); }` 패턴
  - 상세: `Logger.prototype.warn` 패치는 그 시점 동안 프로세스의 모든 `Logger` 인스턴스에 영향을 주는 전역 패치라 테스트 간 격리가 중요한데, `jest.config.ts` 에 `restoreMocks` 안전망이 없어 이 파일이 스스로 지켜야 한다. `:515` 테스트(diff 범위 밖 기존 테스트)는 이전 라운드(`review/code/2026/08/12/23_24_08/side_effect.md`, `23_36_13/side_effect.md`)에서 "warn mock 없이 실제 로그가 샌다" 는 INFO 로 두 차례 지적됐던 자리인데, 현재 상태를 직접 읽어 확인한 결과 `warnSpy`/`try-finally` 로 이미 감싸져 있다 — 해당 지적은 해소됐다. `bodyHash` 불일치로 409 를 던지는 테스트(`:687`)는 payload 파싱 이전에 반환되므로 warn 경로에 도달하지 않아 mock 이 없어도 정합하다.
  - 제안: 없음 — 확인 목적 기록. 향후 이 파일에 테스트를 추가할 때도 같은 `try/finally` 규율을 유지할 것.

## 요약

이번 diff 의 핵심(`discardCorruptEntry` 신설 + 파싱 순서 재배치 + 형태 검증)은 부작용 관점에서
의도된 두 가지 변화만 갖는다 — (1) 손상된 캐시 payload 를 만난 요청의 응답이 `500` 에서
fail-open 신규 처리로 바뀌는 client-observable 변화, (2) 바깥 엔트리 손상 경로가 이제 warn
로그를 남기는 변화. 둘 다 `CHANGELOG.md` 에 공시되고 회귀 테스트로 고정돼 "숨은" 부작용이
아니다. 공개 시그니처·인터페이스·환경 변수·네트워크 호출·신규 전역 변수는 변경되지 않았고,
신설 헬퍼(`discardCorruptEntry`, `isIdempotencyEntry`, `describeShape`)는 전부 private/모듈
스코프다. 테스트 쪽 `Logger.prototype.warn` 전역 mock 은 이번 라운드 기준 모든 warn 유발
경로가 `try/finally` 로 스코프를 지켜, 직전 두 라운드가 지적했던 "mock 없이 로그가 새는" 자리도
해소된 상태를 확인했다. 이번에 새로 추가된 커밋(`c51809a0b`)은 테스트 문서·단언 강화뿐이라
프로덕션 부작용 표면에 변화가 없다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
