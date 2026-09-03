# 정식 규약 준수 검토 — `spec/5-system/` (change-password 실패 코드 정렬)

## 검토 대상

- `spec/5-system/1-auth.md` §2.3 note·§5 note (재인증/비밀번호 재확인 코드)
- `spec/5-system/3-error-handling.md` §1.2 / §1.2.1 (에러 카탈로그)
- `spec/conventions/error-codes.md` §3 / §5 (historical-artifact 레지스트리 / rename 이력)
- 연동 diff: `codebase/backend/src/common/utils/password.util.ts`(`PASSWORD_VERIFY_CODES` 신설),
  `auth.service.ts`·`sessions.service.ts`·`users.service.ts`(상수 참조로 치환),
  `spec/2-navigation/9-user-profile.md`, `CHANGELOG.md`, user-guide mdx(ko/en)

배경: `POST /users/me/change-password` 가 "비밀번호 미설정(OAuth-only)"과 "불일치" 두 조건에
같은 `INVALID_PASSWORD` 를 던지던 것을, 형제 흐름(`verifyPasswordForUser`)이 이미 쓰던
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 갈랐다(신규 코드 신설이 아니라 재사용 + rename 흡수).

## 발견사항

- **[INFO]** §5 rename 이력 표의 `PR` 컬럼이 티켓 식별자 대신 plan 문서 링크
  - target 위치: `spec/conventions/error-codes.md` §5, `INVALID_PASSWORD` 행 (`PR` 열)
  - 위반 규약: 동일 표의 기존 관행(암묵) — `PR4b`·`#1193`·`#566` 처럼 짧은 PR/이슈 식별자
  - 상세: 신규 행만 `[\`auth-change-password-oauth-only-code-split.md\`](../../plan/complete/auth-change-password-oauth-only-code-split.md)` 형태의 markdown 링크를 넣어 컬럼 내용 형식이 형제 행들과 다르다. 파싱을 깨거나 규약을 명시적으로 위반하는 것은 아니며(오히려 결정 근거를 더 잘 추적 가능하게 함), 표 형식 일관성 차원의 사소한 편차다.
  - 제안: 이슈/PR 번호가 없다면 현행 유지도 무방. 표기 일관성을 원하면 `PR` 컬럼은 식별자만 남기고 plan 링크는 `비고` 셀로 옮기는 방안 고려.

- **[INFO]** §2 "새 코드를 신설한다" 문면과 실제 처리(코드 재사용)의 자구 간 긴장
  - target 위치: `spec/conventions/error-codes.md` §2(안정성/rename 정책) vs §5 `INVALID_PASSWORD` 행
  - 위반 규약: `error-codes.md` §2 — "의미가 분기되거나 새 조건이 생기면 **새 코드를 신설한다**"
  - 상세: 이번 변경은 문자 그대로의 "신설"이 아니라 **형제 흐름이 이미 쓰던 기존 코드 재사용**이다. 다만 이는 회피가 아니라 §5 흡수 메커니즘(Grade B)을 통해 명시적으로 처리됐고, 같은 PR 이 §5 서문에 "구 코드가 조건별 복수 코드로 갈릴 수 있다"는 문장을 **직접 추가**해 이 패턴을 규약 레벨로 승격시켰다. `PASSWORD_NOT_SET` 신설안을 검토했다가 근접 명명 3→4종 확대와 `login_history.failure_reason` 감사값과의 wire/audit 동명 충돌을 이유로 명시적으로 기각한 근거도 §5 행에 남아 있다. 즉 이것은 규약 위반이 아니라 **규약을 함께 갱신하며 진행한 정당한 예외 처리**다.
  - 제안: 조치 불요. 향후 §2 본문에 "단, §5 흡수 조건을 충족하면 기존 코드 재사용도 가능(1:N 매핑)"이라는 짧은 상호참조를 추가하면 §2 만 읽는 다음 사람의 오해를 줄일 수 있다(선택 사항).

## 준수 확인 사항 (참고용 — 위반 아님)

교차검증 결과 아래 항목들은 모두 규약과 정확히 일치한다:

- **명명**: `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 `UPPER_SNAKE_CASE`·의미 기반 명명(§1) 준수. `PASSWORD_VERIFY_CODES` 상수 위치(`password.util.ts`)는 `error-codes.md` 가 스스로 선언한 "적용 범위: `ErrorCode` enum 뿐 아니라 프로젝트 전체 에러 코드 문자열" 조항과 부합하며 `nodes/core/error-codes.ts` 의 `ErrorCode`/`EngineErrorCode` 와 충돌(중복 키)하지 않음을 grep 으로 확인.
- **§3→§5 이관**: `INVALID_PASSWORD` 의 §3(historical-artifact, 유지 예외) 등재가 정확히 제거되고 §5(rename 이력, 은퇴)로 이관됨 — "§3 은 유지되는 active 코드, §5 는 교체·은퇴된 코드" 라는 문서 자신의 구분과 일치.
- **Grade B 절차**: 저장소 밖 호출자 배제 불가(워크스페이스 JWT 호출 가능한 내부 REST) → Grade B 분류, "관측 범위에서 미발견 + 사용자 결정 인수" 근거 명시, `plan/complete/auth-change-password-oauth-only-code-split.md`(spec_impact 리스트 정상) 로 결정 추적 — §5 가 요구하는 절차를 그대로 따름.
- **북키핑 카운터 정확성**: 새로 추가된 "현재 B 등급 행은 2건이다" 문장과 실제 `grep -c '등급 B'` 결과(2건: `INVALID_TRIGGER_PARAMETERS`, `INVALID_PASSWORD`)가 일치.
- **레이어 분리 서술의 실측 일치**: "`INVALID_PASSWORD` 문자열은 `login_history.failure_reason` 감사값으로만 남는다(로그인 실패, `users` 모듈은 미사용)"는 서술을 코드에서 grep 으로 확인 — `auth.service.ts:348` 의 `failureReason: 'INVALID_PASSWORD'` 1곳만 남고 `users.service.ts` 에서는 완전히 제거됨.
- **문서 구조**: `1-auth.md`/`3-error-handling.md`/`error-codes.md` 편집은 기존 3섹션(Overview/본문/Rationale) 구조를 깨지 않는 국소 수정이며, Rationale 은 기존 서술을 삭제하지 않고 취소선(`~~INVALID_PASSWORD~~`) + "2026-09-02 후속" 갱신으로 이력을 보존.
- **i18n-userguide 규약 (Principle 5·6·6-B·7)**: `password-and-sessions.mdx`/`.en.mdx` 가 **같은 PR 안에서 동시 갱신**(P7 stale 방지) · ko 본문이 해요체 유지(P6) · `spec/`·`plan/` 경로나 내부 anchor id 노출 없음(P6-B) · 두 로케일 문단 구조가 1:1 대응(P5 parity 취지) — 전부 확인.
- **Swagger**: `users.controller.ts` 의 `changePassword` 엔드포인트 데코레이터는 이번 PR 에서 변경되지 않았고, 기존 `@ApiUnauthorizedResponse({ description: '현재 비밀번호 불일치 또는 인증 실패' })` 는 `swagger.md` §2-4 의 "보호된 엔드포인트는 기본 `@ApiUnauthorizedResponse` 포함" 원칙과 일치하는 범용 설명이라 위반 아님(코드별 세부 열거는 규약이 요구하지 않음).

## 요약

이번 델타(`spec/5-system/1-auth.md`·`3-error-handling.md` + 연동된 `spec/conventions/error-codes.md`·코드·user-guide)는 `spec/conventions/error-codes.md` 의 명명·rename·historical-artifact 정책을 매우 정밀하게 따르고 있다. §3→§5 이관, Grade B 리스크 인수 절차, 북키핑 카운터, 감사값-레이어 분리 서술이 전부 실측과 일치하며, i18n-userguide 규약(ko/en parity·동일 PR 갱신·내부 SoT 비노출)도 충족한다. 유일하게 눈에 띄는 것은 §5 표의 `PR` 컬럼 형식 편차와 §2 "신설" 문구 대비 재사용 처리라는 두 개의 INFO 수준 관찰뿐이며, 후자는 같은 PR 이 §5 서문을 갱신해 스스로 정당화한 의도적 예외로 실질적 위반이 아니다. CRITICAL·WARNING 은 발견되지 않았다.

## 위험도

NONE
