# 신규 식별자 충돌 검토 — spec/5-system (--impl-prep)

## 검토 배경

`plan/in-progress/webauthn-dup-delete.md` (spec_impact: `none`)는 `WebAuthnService.deleteCredential()`
의 동시 DELETE 두 건이 `user.2fa_disabled` 감사 행을 두 번 남기는 결함을 고치는 **코드 전용
수정**이다. target 은 `spec/5-system` 현재 상태(`1-auth.md`·`2-api-convention.md`·
`3-error-handling.md` 전문 + 나머지 15개 파일은 컨텍스트 예산 초과로 절단)이며, 이 라운드에서
spec 문서 자체에 **신규로 추가되는 내용은 없다**(diff 없음, `spec_impact: none`). 따라서 본
리뷰의 핵심 질문은 "이 수정이 건드리는 기존 식별자들이 spec 에 이미 있는 것과 다른 의미로
새로 부여되는가" 이다.

## 확인한 식별자와 대조 결과

| 식별자 | plan 이 참조하는 용도 | spec/코드 기존 사용처 | 판정 |
|---|---|---|---|
| `WEBAUTHN_CREDENTIAL_NOT_FOUND` (404 에러 코드) | 동시 DELETE 의 진 쪽이 받아야 할 코드 (plan §B) | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:404,498,504,528` 에 이미 4곳에서 사용 중. 조회 실패(`findOne` 없음/소유자 불일치) 시 동일 코드 | 기존 식별자 재사용, 신규 아님 — 충돌 없음 |
| `DELETE /api/auth/2fa/webauthn/credentials/:id` | 수정 대상 엔드포인트 | `spec/5-system/1-auth.md` §5 (프롬프트 526행)에 이미 정의: "credential 삭제. **인증 필수**(JWT). 마지막 credential 삭제 시 `user.webauthn_recovery_codes` 를 NULL 화. 204" — 코드도 `webauthn.controller.ts:316 @Delete('credentials/:id')` | 기존 endpoint, 신규 아님 — 충돌 없음 |
| `user.2fa_disabled` (감사 액션) | 동시 요청이 이 액션을 두 번 남기는 결함의 대상 | `spec/5-system/1-auth.md` §4.1 (456행)·§Rationale(874·905행)에 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 3종으로 이미 확정 등재 | 기존 액션, 신규 아님 — 충돌 없음 |
| `isDeleteMiss()` 류 판별자 헬퍼 | 결정 2 — **추출하지 않기로 결정**했으므로 이번 PR 에서 도입되지 않음 | 코드베이스 전체 grep 0건 (미도입 확정) | 신규 식별자 자체가 생성되지 않음 — 검토 대상 아님 |
| `raceUnderHeldLock()` 공용 e2e 헬퍼 | 결정 1 — **별도 PR 에서** 추출하기로 결정, 이번 PR 범위 아님 | 코드베이스 전체 grep 0건 (미도입 확정) | 이번 target 범위 밖 — 별도 PR 착수 시 재검토 필요(그 PR 의 naming-collision 몫) |

## 발견사항

없음 — 이번 target(spec/5-system 현재 상태)이 새로 도입하는 요구사항 ID·엔티티/타입명·API
endpoint·이벤트/메시지명·환경변수/설정키·spec 파일 경로가 **전혀 없다**(spec_impact: none,
파일 diff 없음). plan 이 언급하는 모든 식별자(`WEBAUTHN_CREDENTIAL_NOT_FOUND`, DELETE
credentials/:id, `user.2fa_disabled`)는 spec 과 코드 양쪽에 이미 존재하는 것을 그대로
재사용하며, 다른 의미로 재정의하지도 않는다.

참고(비-차단, 발견사항 항목으로는 올리지 않음): `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 코드에는
있으나 `spec/5-system/1-auth.md` §5 의 GET/PATCH/DELETE `credentials/:id` 행과
`3-error-handling.md` 의 WebAuthn 에러 카탈로그(`WEBAUTHN_DISABLED`·`WEBAUTHN_VERIFY_FAILED`·
`WEBAUTHN_INVALID` 만 등재) 어디에도 명시적으로 표기돼 있지 않다. 이는 **기존부터 있던
문서화 공백**이며 이번 PR 이 만든 신규 충돌이 아니고, 이름 자체도 `WEBAUTHN_*` 접두 규약과
일치해 다른 식별자와 혼동될 소지도 없다. spec 완결성 이슈로 다룰 사안이면 spec-coverage 축이
적합하다.

## 요약

`webauthn-dup-delete` PR 은 spec 을 변경하지 않는 순수 버그 수정이며, 대상 식별자
(`WEBAUTHN_CREDENTIAL_NOT_FOUND`, `DELETE /api/auth/2fa/webauthn/credentials/:id`,
`user.2fa_disabled`)는 모두 spec/5-system 과 코드에 이미 일관되게 정의돼 있는 기존 식별자의
재사용이다. 결정 1(`raceUnderHeldLock`)·결정 2(`isDeleteMiss` 미추출)는 신규 식별자를
이번 PR 범위에서 만들지 않기로 한 결정이므로 현재는 충돌 검토 대상이 아니며, `raceUnderHeldLock`
은 트래커에 등재된 별도 PR 에서 착수 시점에 재검토가 필요하다. 신규 식별자 충돌 관점에서
이번 target 은 위험이 없다.

## 위험도

NONE
