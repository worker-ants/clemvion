# 요구사항(Requirement) 리뷰 결과

## 발견사항

### - [INFO] TOTP 비활성화 시 비밀번호 재확인 요구사항 — 구현 정확히 일치
- 위치: `auth.service.ts` `verifyPasswordForUser`, `auth.controller.ts` `disable2fa`
- 상세: spec/5-system/1-auth.md §1.4 표 "비활성화 시 비밀번호 재확인 + 코드 입력", §5 API 표 `POST /api/auth/2fa/disable` "TOTP 비활성 (인증 + 비밀번호 재확인)"의 요구사항이 구현에 완전히 반영되어 있다. `verifyPasswordForUser` 호출 후 `totpService.disable` → `auditLogsService.record` 순서도 올바르다.
- 제안: 없음.

### - [INFO] 에러 코드 보존 — 기존 동작 정확 유지
- 위치: `auth.service.ts` lines 66-76
- 상세: `PASSWORD_REQUIRED`(401) / `PASSWORD_INVALID`(401) 에러 코드·메시지·HTTP shape 이 이전 컨트롤러 구현과 정확히 동일하게 보존된다. 이는 behavior-preserving 리팩터 목적에 부합한다. `comparePassword` 헬퍼(`password.util.ts`)는 내부적으로 `bcrypt.compare` 를 그대로 호출하므로 동작이 동등하다.
- 제안: 없음.

### - [INFO] [SPEC-DRIFT] data-flow/2-auth.md §1.2 에 verifyPasswordForUser 흐름 미반영
- 위치: `/Volumes/project/private/clemvion/spec/data-flow/2-auth.md` §1.2 "로그인 (Local + 2FA)" 시퀀스
- 상세: `data-flow/2-auth.md §1.2` 의 시퀀스 다이어그램은 `bcrypt.compare` 를 `AuthService(Svc)` 에 배치한다(line 43). 이 변경은 그 모델을 더 충실히 구현하는 방향이지만, TOTP 비활성화 비밀번호 재확인 전용 메서드 `verifyPasswordForUser` 의 흐름(findById → passwordHash 검사 → comparePassword → UnauthorizedException 2종)은 §1.2 시퀀스 다이어그램에 표현되지 않는다. 코드가 올바르고 spec 의 레이어 모델에 정합하는 구현이며, spec 에 추가되지 않은 것은 spec 갱신 누락이다.
- 제안: 코드 유지 + spec 반영. 갱신 대상: `spec/data-flow/2-auth.md` 에 TOTP disable 비밀번호 재확인 흐름(`verifyPasswordForUser`: findById → !user||!passwordHash → PASSWORD_REQUIRED, comparePassword 불일치 → PASSWORD_INVALID) 을 별도 시퀀스 또는 §1.2 주석으로 추가. `spec/conventions/error-codes.md §3` 또는 별도 레지스트리에 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 코드 및 사용 컨텍스트 등재 (현재 spec 어디에도 이 코드 문자열이 정의되어 있지 않음). 반영 주체: project-planner.

### - [INFO] 엣지 케이스 — OAuth-only 계정 처리 명시
- 위치: `auth.service.ts` line 64-69
- 상세: `!user`(미존재)와 `!user.passwordHash`(OAuth-only, password_hash NULL) 두 경우를 단일 `PASSWORD_REQUIRED` 로 처리한다. spec/5-system/1-auth.md §1.1 표 "비밀번호 저장 — bcrypt (cost factor ≥ 12). user.password_hash 는 nullable — OAuth 단독 가입 사용자는 NULL"과 일치한다. OAuth-only 사용자는 2FA disable 시 비밀번호 재확인 경로를 통과할 수 없으나, spec §4.1.B Rationale 에도 "OAuth-only 사용자의 마지막 2FA 비활성화는 별개 결정(현재 별도 차단 로직 없음)"으로 명시되어 있어 현재 동작이 의도적임.
- 제안: 없음(현재 동작은 spec 의 "별개 결정" 선언과 일치).

### - [INFO] 반환값 — 모든 경로 정상
- 위치: `auth.service.ts` `verifyPasswordForUser` (Promise<void>), `auth.controller.ts` `disable2fa`
- 상세: `verifyPasswordForUser` 는 성공 시 `undefined` resolve, 실패 시 `UnauthorizedException` throw 로 모든 경로가 정의되어 있다. `disable2fa` 는 `{ data: { ok: true } }` 를 반환하며, 검증 실패 시 예외가 전파된다. 컨트롤러 테스트도 실패 경로에서 `totpService.disable` 및 `auditLogsService.record` 가 호출되지 않음을 확인한다.
- 제안: 없음.

### - [INFO] 테스트 커버리지 — 4케이스 완전
- 위치: `auth.service.spec.ts` describe('verifyPasswordForUser')
- 상세: (1) 사용자 미존재 → PASSWORD_REQUIRED 401, (2) passwordHash 부재(OAuth-only) → PASSWORD_REQUIRED 401, (3) 비밀번호 불일치 → PASSWORD_INVALID 401, (4) 일치 → resolve undefined. 4케이스 모두 `.rejects.toMatchObject` 패턴으로 status·response.code 까지 검증한다. 컨트롤러 테스트도 `verifyPasswordForUser` mock 을 통해 성공/실패 양 경로를 커버한다.
- 제안: 없음.

### - [INFO] 함수명·주석과 구현 일치
- 위치: `auth.service.ts` JSDoc, `auth.controller.ts` 주석
- 상세: JSDoc 에 "비밀번호를 재확인한다", "2FA 비활성화 등 민감 작업의 재인증용", "에러 코드·메시지·401 shape 은 옛 컨트롤러 동작 그대로 보존한다" 라는 의도가 명시되어 있으며 구현이 이를 정확히 따른다. 컨트롤러 주석 `[refactor 02 C-3]` 도 구현 의도와 일치한다.
- 제안: 없음.

### - [INFO] 미완성 작업(TODO/FIXME/HACK/XXX) 없음
- 위치: 변경된 파일 전체
- 상세: 변경된 `auth.service.ts`, `auth.controller.ts`, `auth.service.spec.ts`, `auth.controller.spec.ts` 어디에도 TODO, FIXME, HACK, XXX 주석이 없다. plan 문서의 "범위 밖/후속" 항목은 코드 미완성이 아닌 의식적 defer 이다.
- 제안: 없음.

## 요약

C-3 변경은 `AuthController.disable2fa` 의 인라인 bcrypt 검증 블록을 `AuthService.verifyPasswordForUser` 로 이관하는 순수 레이어 정렬 리팩터링이다. spec/5-system/1-auth.md §1.4 표("TOTP 비활성화 시 비밀번호 재확인")와 §5 API 표(`POST /api/auth/2fa/disable`)의 요구사항을 완전히 충족하며, 에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)·HTTP 상태·에러 메시지가 이전 구현과 정확히 동일하게 보존된다. `comparePassword` 헬퍼 단일 진입점 사용, OAuth-only 계정 엣지 케이스 처리, 4케이스 단위 테스트 모두 적절하다. 유일한 지적은 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 에러 코드와 `verifyPasswordForUser` 흐름이 spec 문서(`data-flow/2-auth.md`, `error-codes.md`)에 아직 반영되지 않은 SPEC-DRIFT(INFO)이며, 이는 코드 결함이 아니라 spec 갱신 누락이다. Critical·Warning 발견사항 없음.

## 위험도

NONE

---

STATUS=success ISSUES=0
