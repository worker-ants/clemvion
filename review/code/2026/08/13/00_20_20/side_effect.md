# 부작용(Side Effect) 리뷰

## 대상
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (프로덕션)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (테스트)
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` (문서 — 부작용 관점 대상 아님)
- `review/code/2026/08/12/{23_24_08,23_36_13,23_48_38}/**`, `review/consistency/2026/08/12/**` — 이전 라운드 리뷰 산출물(신규 파일). 프로젝트 컨벤션(`review/code/<날짜>/<시각>/`)이 정한 자리에 정확히 생성됐고, 이번 diff 가 새로 만든 부작용이 아니라 리뷰 파이프라인 자체의 정상 출력이다.

## 발견사항

- **[INFO]** 캐시 손상 시 상태코드가 `500 → 정상 처리`로 바뀌는 client-observable 변화 — 의도됐고 `CHANGELOG.md` 에 공시됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:196-201` (payload 파싱 실패 분기), `CHANGELOG.md:3-25`
  - 상세: 종전에는 `cached.responseJson` 파싱이 재현 분기 두 곳에서 방어 없이 실행돼, 손상 시 `SyntaxError` 가 `GlobalExceptionFilter` 까지 올라가 `500` 이 됐다. 이번 diff 는 그 파싱을 `try/catch` 로 감싸 `discardCorruptEntry('payload', …)` 로 강등한다 — 동일 요청이 이제 `200`/원 상태코드로 신규 처리된다. API 응답 코드가 바뀌는 것은 이 인터셉터를 통과하는 모든 클라이언트에 영향을 미칠 수 있는 부작용이지만, (1) `CHANGELOG.md` 신규 섹션이 정확히 이 변화를 "클라이언트 영향" 항목으로 명시하고, (2) 이 인터셉터의 fail-open 설계 원칙과 부합하는 **의도된** 방향 전환이며, (3) 회귀 테스트(`idempotency.interceptor.spec.ts:559-594`, `:629-653`)로 고정돼 있다. 숨겨진 부작용이 아니라 이 PR 의 목적 그 자체다.
  - 제안: 없음 — 이미 문서화·테스트로 계약화됨. 향후 유사 변경 시에도 이 패턴(CHANGELOG 공시 + 회귀 테스트)을 유지할 것.

- **[INFO]** 종전에 조용히 넘어가던 "바깥 엔트리 손상" 경로가 이제 `Logger.warn` 을 남긴다 — 새 로그 부작용, 의도됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:234-243` (`discardCorruptEntry`), 호출부 `:161`, `:171-175`
  - 상세: `this.logger` 는 기존 필드(`:89`)이고 새 전역 상태를 도입하지 않는다. 다만 바깥 JSON 파싱 실패(`엔트리` 케이스)는 이전 코드에서 `catch { return next.handle()... }` 로 가시성 없이 강등됐는데, 이제 `discardCorruptEntry` 를 거치며 매 발생마다 warn 로그를 남긴다. 캐시가 자주 손상되는 환경(예: Redis 데이터 마이그레이션 사고)이라면 로그 볼륨이 늘 수 있다 — 그러나 이는 CHANGELOG(`:21-24`)가 명시적으로 의도한 변화("바깥 엔트리 손상도 이제 warn 을 남긴다")이고, 값 자체는 로그에 안 찍힌다(`describeShape`, `:381-385`, 타입/형태만 문자열화).
  - 제안: 없음 — 조치 불요. 운영 알림 임계값을 설정한다면 이 신규 로그 소스를 반영할 것(범위 밖 권고).

- **[INFO]** 테스트의 `Logger.prototype.warn` 전역 mock — 클래스 프로토타입 레벨 패치이지만 모든 신규 테스트가 `try/finally` 로 스코프를 지켜 누수 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:559-594`(엔트리 손상), `:596-627`(형태 불일치 `it.each` 8케이스), `:629-653`(payload 손상), `:...`(에러 채널 자매) — 4개 신규 테스트 전부 `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 뒤 `try { … } finally { warnSpy.mockRestore(); }` 패턴
  - 상세: `Logger.prototype.warn` 을 패치하면 그 시점 동안 해당 프로세스의 **모든** `Logger` 인스턴스(다른 서비스 포함)의 `warn` 이 영향받는다. 테스트 간 격리가 깨지면 뒤 테스트의 warn 단언이 조용히 실패/통과가 뒤바뀔 수 있는 위험한 패턴인데, 이번에 추가된 5개 테스트 블록(4개 단일 테스트 + `it.each` 8케이스) 전부 `try/finally` 로 복원을 보장한다. `jest.config.ts` 에 `restoreMocks` 안전망이 없다는 점(diff 주석에도 명시)을 감안하면 이 규율이 유일한 방어선인데, 검토 범위 내 신규 테스트는 전부 지키고 있다.
  - 제안: 없음 — 확인 목적 기록. 향후 이 파일에 테스트를 추가할 때도 같은 `try/finally` 규율을 유지할 것.

- **[INFO]** 공개 인터페이스·시그니처 변경 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 전체
  - 상세: `intercept(context, next): Observable<unknown>` (NestInterceptor 계약)은 변경되지 않았다. 신설된 `discardCorruptEntry<T>(what, detail, processFresh): T` (`:234-238`)는 `private` 메서드라 클래스 외부 호출자에 영향이 없다. 모듈 스코프 신설 함수 `isIdempotencyEntry`(`:370-379`)·`describeShape`(`:381-385`)도 export 되지 않은 내부 헬퍼다. 환경 변수 읽기/쓰기, 신규 네트워크 호출(Redis 클라이언트 호출부는 기존과 동일한 `redis.get`/`redis.set`), 새 전역 변수 도입 모두 없음.
  - 제안: 없음.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 캐시 엔트리 안쪽(`responseJson`) 파싱을 방어 없는 두 자리의 중복 호출에서 단일 지점의 `try/catch` + `discardCorruptEntry` 헬퍼로 통합한 리팩터다. 부작용 관점에서 유일하게 실재하는 영향은 **의도된 두 가지**뿐이다 — (1) 손상된 캐시 payload 를 만난 요청의 응답이 `500` 에서 신규 처리(fail-open)로 바뀌는 client-observable 변화, (2) 종전에 조용했던 바깥 엔트리 손상 경로가 이제 warn 로그를 남기는 변화. 둘 다 `CHANGELOG.md` 에 공시되고 회귀 테스트로 고정돼 있어 "숨은" 부작용이 아니다. 공개 시그니처·인터페이스·환경 변수·네트워크 호출·전역 변수는 변경되지 않았고, 신설 헬퍼는 전부 private/모듈 스코프다. 테스트 쪽의 `Logger.prototype.warn` 전역 mock 도 모든 신규 테스트에서 `try/finally` 로 스코프가 지켜져 교차 오염 위험이 없다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도
LOW
