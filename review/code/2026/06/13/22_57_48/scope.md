# 변경 범위(Scope) Review

대상 작업: refactor 04 후속 — A-1(비밀번호 변경 시 전 세션 revoke + 현재 디바이스 재발급) · B-1(user.* 감사 ipAddress 동반) · B-2(changePassword SRP) · C(auth-context DRY · e2e). plan: `plan/in-progress/refactor-04-followup-pwchange-userip.md`.

## 발견사항

- **[INFO]** 무관한 plan 파일이 동일 spec 커밋에 동봉됨
  - 위치: 파일 21 `plan/in-progress/execution-engine-typed-errors.md` (신규, 40줄). 커밋 dcd225b8 에 포함.
  - 상세: 본 작업(A-1/B-1/B-2/C)과 무관한 execution-engine client-safe typed error 체계(A-2) plan 이다. 파일 자체가 "**별도 작업으로 분리** — 본 항목은 등록만, 구현은 본 plan 으로 독립 진행" 이라고 명시한다. 즉 A-2 는 이번 변경 범위에서 의도적으로 제외된 항목인데, 그 등록 문서가 본 작업 커밋에 섞여 들어왔다. 코드/spec 변경은 전혀 동반하지 않는 순수 등록(registration-only) 문서라 기능 영향은 없으나, 변경 단위(commit/PR) 응집도 관점에서 별개 작업의 산출물이다.
  - 제안: 무해하므로 차단 사유 아님. 엄밀히는 별도 커밋/PR 로 분리하는 것이 변경 단위 응집에 맞다. 다만 "후속 작업 backlog 등록" 성격이고 사용자 결정(2026-06-13)에 따른 의도된 분리 기록이므로 현행 유지도 허용 가능.

- **[INFO]** `users.controller.ts` 의 import/구조 정리는 범위 내 부수 효과
  - 위치: 파일 14 — `bcrypt`·`validatePasswordStrength`·`BCRYPT_ROUNDS`·`UnauthorizedException`(미사용화) 제거, `Inject`/`Req`/`Res`/`forwardRef`/`ConfigService`/`AuthService`/`authContextFromRequest`/`setRefreshTokenCookie` 추가.
  - 상세: 도메인 로직을 UsersService 로 이전(B-2)하면서 controller 에서 더 이상 쓰지 않게 된 import 제거 + 신규 위임에 필요한 import 추가다. 모두 B-2/A-1 변경의 직접 결과이며 무관한 정리가 아니다. 사용하지 않는 import 추가나 무의미한 재배열은 없다.

- **[INFO]** 주석 변경은 모두 변경 동작 설명에 귀속
  - 위치: 파일 2/11/14(controller record 직전 `ipAddress 동반(포렌식)` 주석), 파일 3/15(forwardRef 사유), 파일 5/7/17(신규 메서드 JSDoc).
  - 상세: 추가된 주석은 모두 이번에 도입한 동작(ipAddress 동반·forwardRef 순환 해소·세션 회전 위임·SRP 이전)을 설명한다. 불필요하거나 무관한 주석 추가/삭제 없음.

- **[INFO]** spec 변경(파일 39/40/41)은 plan 의 변경 1~6 과 1:1 대응
  - 위치: `spec/2-navigation/9-user-profile.md`(응답 계약), `spec/5-system/1-auth.md`(§2.3 표·§4.3 session_revoked·Rationale §2.3.C), `spec/data-flow/1-audit.md`(§1.1 user.* ipAddress·§1.2 session_revoked).
  - 상세: 모든 spec hunk 가 A-1/B-1 의 명세 반영이다. 범위 외 섹션(예: §3.2 RBAC, §5 API 무관 행) 수정 없음. session_revoked 는 enum 신설 없이 설명만 확장(스키마/마이그레이션 불요 명시) — over-reach 아님.

- **[INFO]** consistency 리뷰 산출물(파일 24~38)은 SDD 프로세스 정상 출력
  - 위치: `review/consistency/2026/06/13/{22_13_35,22_23_29}/**`.
  - 상세: `--spec` 게이트의 의무 산출물로, plan-lifecycle 규약에 따라 커밋에 포함되는 정상 범위다. 기능 코드와 무관한 리팩토링/설정 변경 아님.

## 요약

코드(파일 1~20)·spec(파일 39~41)·리뷰 산출물(파일 22~38) 변경은 모두 A-1/B-1/B-2/C 의도 범위 안에 정확히 들어맞으며, 불필요한 리팩토링·기능 확장·무관 파일 수정·포맷팅 노이즈·미사용 import 는 발견되지 않았다. import 정리는 B-2 도메인 로직 이전의 직접 결과이고, 주석은 전부 신규 동작 설명에 귀속된다. 유일한 범위 이탈은 파일 21 `execution-engine-typed-errors.md` — 이번 작업과 무관한 A-2(별도 작업) backlog 등록 문서가 동일 spec 커밋에 동봉된 점이나, 코드/spec 영향 없는 순수 등록 문서이고 사용자가 분리하기로 명시한 결정의 기록이라 무해하다.

## 위험도

LOW
