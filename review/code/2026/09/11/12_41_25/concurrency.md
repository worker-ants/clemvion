# 동시성(Concurrency) 코드 리뷰

## 검토 범위

애플리케이션 코드 변경(`origin/main...HEAD` 기준)은 다음 세 종류로 구성된다.

1. `BadRequestException` 페이로드의 `details[]`(객체/배열 양쪽)에 `code: 'INVALID_FIELD'`
   또는 `code: ErrorCode.INVALID_FIELD` 를 추가 — `triggers.service.ts` 13곳,
   `password.util.ts` 2곳 (`chat-channel-config.dto.ts` 는 DTO pipe 층이라 별도).
2. `chatChannel` 차단 5필드 거부 메시지를 `chat-channel-rejection-messages.const.ts`
   신규 module-level `as const` 상수로 통합, DTO 데코레이터·서비스 가드 양쪽이 참조.
3. `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 검증 데코레이터 1개 추가.

나머지(테스트 파일들·e2e·문서·CHANGELOG·plan·리뷰 산출물)는 위 세 변경에 대한 단언 추가이거나
비실행 문서다.

## 발견사항

동시성 관점(경쟁 조건·데드락·동기화·스레드 안전성·async/await·원자성·이벤트 루프·리소스 풀링)에서
검토한 결과, 이번 diff 가 새로 도입한 비동기 제어 흐름·공유 가변 상태·락·풀은 없다. 모든 변경은
요청 스코프 동기 검증 로직(예외 payload 리터럴 추가, 검증 데코레이터 1개 추가)이며, 동시 요청 간
공유되는 자원에 대한 접근 패턴을 바꾸지 않는다.

- **[INFO]** 진단 목적 참고 — `botToken` 이 빈 문자열일 때 "시크릿을 먼저 쓰고 provider 검증은
  나중에 실패하는" 순서 문제(원자성 관련 사안)가 diff 주석에 명시돼 있으나, **이번 diff 가
  만들거나 고친 것이 아니다.**
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:187` (`@MinLength(1)` 상단 주석) — `setupChatChannel` 의 `[쓰기 ①]`/`SecretResolver.rotate` 자체는 이번 diff 범위 밖이라 손대지 않았다(`Read`/`grep` 대조: `triggers.service.ts` diff 에 `rotate(` 호출부 변경 없음).
  - 상세: `@ApiProperty` 가 광고하던 `minLength: 1` 을 검증 체인(`@MinLength(1)`)에 이제 반영해, `botToken: ''` 요청이 DTO 단계에서 조기 차단되므로 이 write-before-validate 경로로 **더 이상 도달하지 않는 케이스가 늘었다** — 즉 이번 diff 는 그 원자성 갭의 노출을 축소하는 방향이지 악화가 아니다. 다만 공백 전용 문자열(`'   '`)이나 `rotate` 자체의 빈 값 가드는 여전히 닫히지 않았고, `plan/in-progress/impl-details-code-wiring.md` (I1/I2)에 이미 후속 트래커로 등재돼 있다. 이 write 자체가 트랜잭션 없이 "저장 성공 → provider 호출 실패 → 롤백 없음" 순서라는 점은 사실이지만, **경쟁 조건(레이스)이 아니라 단일 요청 내 순서/원자성 이슈**이고 코드 변경 없이 유지되는 pre-existing 사안이므로 이번 diff 를 막을 사유는 아니다.
  - 제안: 조치 불필요(이번 PR 스코프 밖, 이미 트래커 등재 확인). 후속 PR 에서 `rotate`/write 실패 시 보상 삭제(compensating delete) 또는 트랜잭션 경계 재검토를 권장.

- **[INFO]** 신규 테스트의 `for (const field of CHAT_CHANNEL_BLOCKED_FIELDS) { await run(...) }` 및 두 `it.each(BLOCKED_FIELD_CASES)` 블록은 모두 **순차 await** 이며 병렬 실행·공유 mutable 상태 접근이 없다.
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` (`'[등가성] 차단 5필드의 message 는 공유 상수에서 온다 (D)'` 테스트) · `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`BLOCKED_FIELD_CASES` 를 쓰는 두 `it.each`)
  - 상세: 각 반복이 독립적인 `run()`/`service.update()` 호출이고 테스트 간 상태 공유가 없어(각 케이스가 자신의 mock 응답을 그때그때 세팅) 경쟁 조건 여지가 없다. 순차 실행이라 async 오더링 버그(await 누락 등)도 관찰되지 않는다.
  - 제안: 조치 불필요.

CRITICAL/WARNING 급 동시성 결함은 없다.

## 요약

이번 변경은 에러 응답 `details[].code` 배선(15자리), 거부 메시지 상수 통합, `botToken` 빈 문자열
검증 데코레이터 추가로 구성된 동기 검증/페이로드 레이어의 국소 수정이며, 새로운 비동기 제어
흐름·공유 자원 접근·락·스레드/커넥션 풀 변경이 없다. diff 자체 주석이 지목한 "빈 시크릿 먼저 저장"
순서 문제는 원자성 관점에서 실재하는 pre-existing 갭이지만 이번 diff 가 만든 것이 아니고 오히려
노출을 줄이는 방향이며, 이미 별도 트래커(I1/I2)에 등재돼 있어 이 리뷰의 차단 사유가 아니다. 신규
테스트의 반복문·`it.each` 도 순차 await 이라 경쟁 조건 여지가 없다.

## 위험도

NONE
