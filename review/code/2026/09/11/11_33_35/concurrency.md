# 동시성(Concurrency) 코드 리뷰

## 발견사항

없음.

이번 PR 의 변경 본질은 (A) `BadRequestException` `details[]` 원소에 `code: 'INVALID_FIELD'` 를 15개 자리(`triggers.service.ts` 13곳, `password.util.ts` 2곳)에 배선, (B) 중복된 거부 메시지 리터럴을 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 상수(module-scope, `as const`, 불변)로 단일화, (C) `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 추가, (D) 이를 뒷받침하는 unit/e2e 테스트 보강이다. 모두 이미 존재하던 동기(synchronous) 검증 경로 내부에서 에러 객체 리터럴의 필드 구성을 바꾸는 것뿐이며, 다음 항목 중 어느 것도 새로 도입되지 않았다:

- 공유 가변 상태(mutable shared state) — 신규 상수는 전부 `const … as const` 로 재할당 지점이 없다.
- 락/뮤텍스/세마포어, DB 트랜잭션/advisory lock
- 새로운 `async`/`await` 경로 또는 `Promise` 조합(`Promise.all`/`Promise.race` 등) — 기존 `async` 메서드(`service.update`, `setup` 등) 안에서 던지는 예외 객체의 필드만 늘었다
- 스레드 풀/커넥션 풀 크기 변경
- 이벤트 루프를 블로킹할 수 있는 동기 연산(대량 루프·정규식 등) 신설 — 신규 루프는 테스트 코드의 `for (const field of CHAT_CHANNEL_BLOCKED_FIELDS)` 5회 반복(순차 `await run(...)`)뿐이며 프로덕션 경로가 아니고 CI 실행 시간에 미치는 영향도 무시할 수준이다(다른 reviewer 도 동일하게 INFO 로 확인).

router 도 이번 diff 를 "동시성 로직 변경 없음"으로 판단해 concurrency reviewer 를 강제 화이트리스트에서 제외했으며(`_retry_state.json`/`SUMMARY.md` 라우터 결정 표), 실측 결과도 이와 일치한다.

## 요약

이번 변경은 에러 응답 payload 의 `details[].code` 필드 배선과 메시지 문자열 상수화, DTO 검증 강화(`@MinLength(1)`)로 전부 동기적 검증 로직과 그 값(리터럴) 수준의 수정이며, 공유 자원에 대한 동시 접근·락·비동기 제어 흐름·리소스 풀과 관련된 코드는 diff 어디에도 없다. 동시성 관점에서는 해당 없음으로 판단한다.

## 위험도

NONE
