# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (line 155-225) 을 Read 했다.

## 변경 파일 식별

리뷰 대상(orchestrator 제공):

- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` (수정)
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (수정)
- `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` (신규)
- `plan/in-progress/authconfig-dup-delete.md` (신규 plan)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 갱신)
- `review/consistency/2026/09/21/14_41_01/*` (consistency-check 산출물, 코드 아님)

## trigger 매칭 판단

변경 내용은 `AuthConfigsService.remove()` 의 동시 DELETE 경합 수정이다 — 형제 서비스(#1369~#1373)와 같은 클래스의 결함으로, `remove(entity)` → 원자적 `delete(criteria)` 전환 + `affected===0` 판정으로 "동시 삭제 두 건이 감사 로그를 두 번 남기던 것"을 고쳤다. 각 trigger 후보를 확인했다:

1. **새 노드 추가 / 노드 schema 변경** — `codebase/backend/src/nodes/**` 글롭에 매칭 안 됨 (`auth-configs` 는 별도 모듈). 해당 없음.
2. **신규 UI 문자열 (TSX)** — 변경 set 에 `.tsx` 파일 없음. 해당 없음.
3. **통합/제공자 변경** — provider(webhook 외부 연동) 추가·변경 아님, 내부 서비스 로직 수정. 해당 없음.
4. **신규 섹션 디렉토리** — `codebase/frontend/src/content/docs/**` 변경 없음. 해당 없음.
5. **인증·권한·세션 흐름 변경** — trigger glob 은 `codebase/backend/src/modules/auth/**` 다. 이 PR 이 건드린 경로는 `codebase/backend/src/modules/auth-configs/**` 로, 저장소에 `auth/`(로그인·세션·OAuth·TOTP·webauthn)와 `auth-configs/`(webhook 인증 설정 CRUD)가 **별도 sibling 모듈**로 존재함을 `ls` 로 확인했다. `AuthConfig` 는 워크플로 웹훅 트리거의 인증 수단(api_key/bearer_token/basic_auth/hmac)이지 사용자 로그인·워크스페이스 세션이 아니다. glob 불일치 + 의미상으로도 "인증·권한·세션 흐름"(로그인/RBAC/세션)이 아니라 "인증 설정 리소스의 삭제 경합 수정"이므로 **매칭 안 됨**.
6. **AuthConfig type enum 변경** — `api_key`/`bearer_token`/`basic_auth`/`hmac` 리터럴은 기존 분기 로직에서 읽히기만 할 뿐, 이 PR 에서 enum 값 추가·삭제·라벨 변경이 없다. 매칭 안 됨.
7. **표현식 언어 변경** — `codebase/packages/expression-engine/**` 무관. 해당 없음.
8. **실행·디버깅 흐름 변경** — 실행 엔진·디버그 로깅 무관. 해당 없음.
9. **신규 warningCode/errorCode 발행** — 새 에러 코드 발행 없음. `RESOURCE_NOT_FOUND` 는 기존에 `findById()` 가 이미 쓰던 코드이고, 이번 PR 은 그 예외 발화를 `throwAuthConfigNotFound()` 헬퍼로 추출해 `remove()` 의 새 404 분기(경합 진 쪽)에도 **같은 기존 코드**를 재사용한 것뿐이다. `error-codes.ts`(`ErrorCode` enum)·`warningRules` 변경 없음. 매칭 안 됨.
10. **spec 신규/대규모 변경** — `spec/2-*/3-*/4-*/5-*/conventions/**` 글롭에 해당하는 파일 변경 없음 (plan 파일만 변경, plan `spec_impact: none` 명시). 매칭 안 됨.
11. **백엔드 API 추가·변경** — controller·DTO 변경 없음 (service 내부 로직 + 헬퍼 추출만). 응답 계약(204 성공 / 404 `RESOURCE_NOT_FOUND`)도 기존 그대로 — 경합 상황에서의 판정 정확도만 개선됐다. swagger jsdoc 갱신 대상 아님.

plan 파일(`authconfig-dup-delete.md`) 자체도 착수 전 `/consistency-check --impl-prep spec/2-navigation` 을 이미 돌려 BLOCK:NO(Critical 0)를 받았고, `spec_impact: none` 으로 명시했으며, `5-system/12-webhook.md`·`1-auth.md` 를 손으로 읽고 "삭제 계약을 서술하지 않으므로 이번 변경의 대상이 아니다"라고 판단한 근거가 plan 체크리스트에 남아 있다 — 이는 이번 reviewer 의 결론과 일치한다.

## 결론

이 변경 set 이 매칭하는 doc-sync-matrix trigger가 없다. 사용자 가시 동작(DELETE 성공 시 204, 대상 없음/경합 패자는 404 `RESOURCE_NOT_FOUND`)은 이전과 동일하며, 이번 수정은 동시성 경합 시의 내부 판정 정확도(중복 감사 로그 방지)만 고친 순수 버그 픽스다. 노드/스키마/UI 문자열/통합/섹션/enum/에러코드/세션흐름/표현식/실행-디버깅 어느 trigger 에도 해당하지 않는다.

## 발견사항

없음.

## 요약

매트릭스 trigger 21개 중 이번 변경 set 에 매칭되는 항목 0건 — `codebase/backend/src/modules/auth-configs/` 의 동시 DELETE 경합 수정은 `codebase/backend/src/modules/auth/**` (세션/로그인) trigger 와 별개 모듈이며, API 계약·enum·에러코드·UI 문자열 변경이 없는 순수 내부 버그 픽스라 유저 가이드 동반 갱신 대상이 아니다("해당 없음").

## 위험도

NONE
