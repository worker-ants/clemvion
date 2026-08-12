# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `catchError` 삽입 지점에 붙은 주석 블록이 다소 길다 (설계 근거 + 위치 주의 + 캐너리 안내를 한 블록에 담음)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:92`-`99` (게이트 기준, `catchError` 직전 주석)
  - 상세: `from(this.redis.get(redisKey)).pipe(` 바로 다음에 8줄짜리 주석(92-99)이 붙어 fail-open 취지·spec 근거·`switchMap` 앞에 둬야 하는 이유를 모두 설명한다. 다만 이 저장소는 로드베어링 위치 결정에 대해 "왜 여기인가"를 코드 주석으로 고정하는 것이 기존 컨벤션이고(클래스 docstring·`HttpResponseLike` 주석 등 기존 코드에도 동일 밀도의 주석이 이미 있음), 캐너리 테스트(`idempotency.interceptor.spec.ts:393`-`417` 부근)와 1:1로 대응하는 실질 내용이라 무관한 주석 추가로 보기 어렵다. 스코프 위반이라기보다 스타일 판단 사항.
  - 제안: 별도 조치 불필요. 참고로만 기록.

## 요약

세 파일 모두 하나의 의도 — "Redis `get()`이 런타임에 reject할 때 fail-open이 되지 않는(fail-closed) 결함을 고친다" — 로 수렴한다. `idempotency.interceptor.ts`는 `catchError` import 추가, `from(this.redis.get(...))` 직후·`switchMap` 앞에 `catchError` 삽입, 그리고 클래스 docstring에 "세 경로 모두 fail-open"이라는 설명 3줄 추가로 구성되며 전부 이 fix에 직결된다. 무관한 코드 정리·포맷팅·불필요한 import·설정 변경은 발견되지 않았다. `idempotency.interceptor.spec.ts`에 추가된 신규 `describe` 블록(3개 테스트: reject 시 통과, reject 시 캐시 미스로 강등해 정상 적재, `catchError` 위치가 뒤로 밀리면 기존 409 충돌 검출까지 삼켜지는 것을 잡는 캐너리)은 정확히 그 fix가 만드는 새 분기·새 위험(연산자 순서)을 검증하는 테스트로, 기존 두 `describe` 블록(W-4 provider 경로 / 캐시 히트·응답 형태 방어)의 구조·헬퍼(`makeRedis`/`makeInterceptor`/`bodyHashOf`)를 재사용해 스타일도 일관적이다. 기존 테스트를 건드리지 않고 파일 끝에 순수 추가만 한 점도 스코프를 좁게 유지한다. `plan/in-progress/backend-lint-gate-broken-on-main.md`의 변경은 이미 그 문서에 있던 미해결 체크리스트 항목(`- [ ] IdempotencyInterceptor 의 "fail-open" 주장이 런타임 reject 를 안 덮는다`)을 `- [x]`로 갱신하고 처리 근거(spec 인용·무수정 프로브 실증·뮤테이션 실측)를 추가한 것으로, 코드 변경과 1:1 대응하는 작업 추적 갱신이며 무관한 plan 내용을 함께 손대지 않았다. 세 파일 어디에서도 요청 범위를 넘는 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임은 확인되지 않았다.

## 위험도

NONE
