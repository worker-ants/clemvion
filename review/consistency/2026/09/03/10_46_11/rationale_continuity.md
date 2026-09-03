# Rationale 연속성 검토 — spec/5-system/ (change-password 실패 코드 정렬)

## 검토 범위

- target: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` (impl-done, diff-base `origin/main`)
- 구현 diff: `codebase/backend/src/common/utils/password.util.ts` · `auth.service.ts` ·
  `sessions.service.ts`(+spec) · `users.service.ts`(+spec) · `users.controller.spec.ts` ·
  `users-change-password.e2e-spec.ts` · frontend user-docs mdx 2종 (10파일/417줄)
- 결정 문서: `spec/conventions/error-codes.md` §5(Rename 이력) · `plan/in-progress/auth-change-password-oauth-only-code-split.md`
- 실측: `git log`(관련 커밋 이력) · `codebase/backend/src/modules/{auth,users}/**` 실제 소스(module wiring)

## 발견사항

### [WARNING] "UsersService 는 AuthService 를 주입할 수 없다(순환)" — 검증 없이 세 곳에 박힌 근거

- target 위치:
  - `spec/5-system/1-auth.md` §5 "민감 동작 비밀번호 재확인 코드" note (`## 5. API 엔드포인트` 하단):
    *"헬퍼는 다르지만(순환 의존으로 재사용 불가) 코드는 공유한다."*
  - `codebase/backend/src/common/utils/password.util.ts` 신규 `PASSWORD_VERIFY_CODES` JSDoc:
    *"헬퍼 자체를 공유하지 않는 이유는 `UsersService` 가 `AuthService` 를 주입할 수 없기 때문이다(역방향 의존 = 순환)."*
  - `plan/in-progress/auth-change-password-oauth-only-code-split.md` 106~110행: 동일 주장.
- 과거 결정 출처: 이 PR 자체가 신설한 근거라 "기각된 대안 재도입"은 아니지만, **동일 저장소가 이미
  확립해 둔 반증 가능한 패턴**과 충돌한다 — Rationale 연속성 관점 4("암묵적 가정 충돌")에 해당.
- 상세: 실측 결과 이 "불가능" 주장은 사실과 다르다.
  - `UsersController`(같은 `UsersModule`)는 **이미** `@Inject(forwardRef(() => AuthService))` 로
    `AuthService` 를 정상 주입하고 있다 (`users.controller.ts:74`, refactor 04 A-1 — 세션 회전용).
  - `AuthModule`/`UsersModule` 양쪽 모두 `forwardRef(() => ...)` 로 서로를 import 해 모듈 레벨 순환은
    이미 해소돼 있다 (`auth.module.ts`, `users.module.ts` 각 주석).
  - `@Inject(forwardRef(() => X))` 를 이용한 provider 간 순환 주입은 이 코드베이스에서
    `websocket.gateway.ts`·`execution-engine.service.ts`·`retry-turn.service.ts`·
    `embedding.service.ts`·`graph-extraction.service.ts` 등 **12곳 이상**에서 이미 쓰는 표준 패턴이다.
  - 즉 `UsersService` 가 `AuthService` 를 주입하는 것이 기술적으로 "불가능"한 게 아니라,
    (a) `AuthService` 가 이미 `UsersService` 를 **forwardRef 없이 직접** 주입하고 있어 양방향 provider
    순환을 만들려면 **양쪽 모두** forwardRef 가 필요해지고, (b) 그렇게 하면 `UsersService`(도메인 로직
    전용, refactor 04 B-2 SRP 결정 — "changePassword 도메인 로직은 UsersService, 오케스트레이션은
    controller")의 경계를 흐린다는 **설계상 바람직하지 않음**이 진짜 이유에 가깝다.
  - 즉 이 노트가 인용해야 할 진짜 근거는 "불가능"이 아니라 이미 spec 에 있는 **B-2 SRP 경계**
    (`UsersController` 가 오케스트레이션, `UsersService` 는 도메인 로직만)다. 지금 문구는 검증되지
    않은(그리고 반증 가능한) "불가능" 주장을 세 문서(spec 본문·code JSDoc·plan)에 동시에 박아 넣어,
    이후 누군가 이 두 서비스를 더 통합하려 할 때 "예전에 불가능하다고 결론 낸 적이 있다"는 잘못된
    선례로 오독될 위험이 있다.
- 제안: 세 곳의 문구를 "순환이라 불가능"에서 "가능하지만 refactor 04 B-2 의 SRP 경계(컨트롤러=오케스트
  레이션, 서비스=도메인 로직)를 지키기 위해 코드 상수만 공유하고 헬퍼는 공유하지 않는다"로 교체 권장.
  spec 쪽은 `1-auth.md §5` note 1곳만 고치면 되고, 코드 쪽은 `password.util.ts` JSDoc 갱신.
  (CRITICAL 아님 — 최종 설계 결정 자체는 바뀌지 않고, wire 계약·동작에도 영향 없음. 향후 판단을
  오도할 수 있는 근거 서술의 정확성 문제.)

## 그 외 확인 사항 (문제 없음 — 참고)

- `INVALID_PASSWORD`(비밀번호 변경, 401) wire 은퇴는 `spec/conventions/error-codes.md §5` Rename 이력
  표에 **등급 B(잔여 위험 인수)**로 정식 등재되어 있고, 선례(`INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`,
  #1193)와 동일한 기준(자사 client 전수 grep 0건 + 사용자 결정 2026-09-02)을 따른다 — 새 Rationale 없이
  결정을 번복한 사례가 아니다.
- 대체안 `PASSWORD_NOT_SET` 신설을 검토했다가 기각한 근거(`login_history.failure_reason` 감사값과
  동명 충돌 재생산)는 `git log -S PASSWORD_NOT_SET` 로 실측 확인됨(`auth.service.ts:331`) — 지어낸
  근거 아님.
- `1-auth.md §2.3 Rationale 2.3.C` 의 OAuth-only 차단 코드 서술은 `INVALID_PASSWORD` → `PASSWORD_REQUIRED`
  로 이미 갱신돼 있어 stale 참조가 남지 않았다.
- `3-error-handling.md §1.2.1` 의 "근접 명명 주의" 블록은 (2026-09-02 갱신) 표기로 종전 서술을 취소선
  없이 텍스트로 자연스럽게 대체했고, §1.2 표에서 `~~INVALID_PASSWORD~~` 취소선 + "제거됨" 문구로 이력을
  남겨 묘비 관례를 지켰다.
- `refactor 04 B-2`(#578, changePassword SRP), `#882`/`#887`/`#893`(카탈로그 완결성 pass), `2026-08-31`
  (`ACCOUNT_LOCKED` 423→401 정정) 등 인접 Rationale 과 이번 PR 의 서술이 상호 참조·모순 없이 정합한다.

## 요약

이번 변경(`change-password` 실패 코드를 형제 흐름 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정렬하고
`INVALID_PASSWORD` 를 wire 에서 은퇴)은 Rationale 연속성 관점에서 이례적으로 잘 관리되어 있다 —
과거 결정(#578 B-2, #882/#887/#893, 2026-08-31 정정)을 정확히 인용하고, rename 안정성 정책(§2)의
예외 조건(등급 B)을 선례(#1193)와 동일 기준으로 명시적으로 충족시키며, stale 참조를 모두 갱신했다.
유일한 흠은 "헬퍼를 공유하지 않는 이유"로 제시한 "순환 의존이라 주입이 불가능하다"는 근거가 이
저장소에 이미 확립된 `@Inject(forwardRef(...))` 패턴(같은 `UsersController`가 같은 `AuthService`를
이미 그 방식으로 주입 중)과 배치되는, 검증되지 않은 주장이라는 점이다 — 실제 설계 선택 자체는
타당하나(SRP 경계 보존), 근거 서술이 부정확해 향후 판단을 오도할 수 있다.

## 위험도

LOW
