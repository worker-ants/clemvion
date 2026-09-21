# 요구사항(Requirement) 리뷰 — WebAuthn 동시 삭제 중복 감사 수정 (아홉 번째/마지막 자리, 리뷰 후속 재검증)

## 검증 방법

이 세션은 이미 두 라운드(`review/code/2026/09/21/18_03_54`, `review/code/2026/09/21/18_31_57`)의
requirement/documentation/maintainability/testing 리뷰와 그 조치(RESOLUTION, 커밋
`a20455447`·`d3127c8a6`·`69bd6ea84`·`89566e3d5`·`ee6fd5d56`·`7b71e9a4a`)를 거친 뒤의 재검토다.
과거 발견사항을 반복 나열하지 않고, (1) 조치가 실제로 반영됐는지 소스 대조로 재확인하고
(2) 그 조치들이 새로 만든 회귀나 아직 아무도 못 본 갭이 있는지에 집중했다.

직접 확인한 것:
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 전문 — `throwCredentialNotFound()`
  헬퍼(4개 호출부: 497·500·542·566행), `deleteCredential()` 의 `affected === 0` 판정, `userId` 조건절.
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts` 의 신규 `describe('동시 삭제')` 및
  기존 `deleteCredential` 테스트 3건과의 mock 기본값(`delete: {affected:1}`) 상호작용.
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 두 `it` 모두 — 두 번째
  `it`(WARNING#4 반증)에 공허성 가드(`raced` 단언)가 첫 번째와 동일하게 추가돼 있음을 확인.
- `codebase/backend/src/modules/auth/webauthn/webauthn-credential.entity.ts` — `userId`→`user_id` 컬럼
  매핑이 `delete({ id, userId })` 호출과 일치.
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` `webauthnDelete` — 감사 기록이
  `deleteCredential()` resolve 이후에만 실행됨(서비스가 throw 하면 도달 불가)을 재확인.
- `CHANGELOG.md` 1~139행 — WebAuthn 신규 섹션 + `auth_config`/`model_config` 두 전방 참조의 취소선
  정정(WARNING#1/#3 조치)이 완전한 형태로 반영됐는지 재확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 4977~4995행 — 줄 번호 대신 메서드명으로
  재인용됐는지(WARNING#2 조치) 확인.
- `spec/1-data-model.md:88`, `spec/5-system/1-auth.md:498`, `spec/5-system/3-error-handling.md`
  §1.2.1·§1.11 — 코드 주석·plan 서술과 spec 본문을 line-level 로 대조.

## 발견사항

- **[INFO]** `deleteCredential()` JSDoc 헬퍼 주석이 자기 파일 내부의 하드코딩 줄 번호(`:403`)를
  인용한다 — 바로 이 PR 이 몇 시간 전에 정확히 같은 유형의 문제(하드코딩 줄 번호가 리팩터 커밋
  한 번에 stale 이 된 것)를 WARNING#2 로 지적받아 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에서 메서드명 인용으로 바꿨다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:512`
    (`throwCredentialNotFound()` JSDoc — `**\`verifyAuthentication\`(:403)의 \`UnauthorizedException\`(401)과는 다른 자리다.**`)
  - 상세: 현재는 512행의 `:403` 인용이 실제로 401 을 던지는 `throw new UnauthorizedException({` 줄(403행)을
    정확히 가리킨다(`grep -n "UnauthorizedException" webauthn.service.ts` 로 직접 확인). 즉 지금은 틀리지
    않았다. 다만 이 파일 자체가 이번 PR 에서 이미 한 번 리팩터(`d3127c8a6`, `throwCredentialNotFound()` 추출)를
    거치며 줄 배치가 바뀌었고, `verifyAuthentication()` 위쪽 로직이 다음에 편집되면 이 하드코딩된 `:403`
    도 같은 방식으로 조용히 stale 해질 수 있다 — 바로 옆 줄(513~515행)의 산문 설명("그쪽은 로그인 2FA
    인증 단계에서...")만으로도 어떤 자리인지 특정 가능하므로, 줄 번호 자체는 정보 손실 없이 제거 가능하다.
    이번 PR 을 막을 사유는 아니며(현재는 정확함), plan 문서에서 막 학습한 교훈("줄 번호 대신 메서드명"이
    stale-safe 하다)을 같은 PR 의 소스 코드 주석에는 아직 적용하지 않았다는 점만 기록한다.
  - 제안: 급하지 않음. 다음에 이 파일을 편집할 때 `:403` 을 `verifyAuthentication()` 같은 메서드명
    지목으로 바꾸는 것을 고려.

## 검증한 사항 (문제 없음, 재확인)

- **핵심 로직**: `findOne`(무락) → 소유권 비교 → `throwCredentialNotFound()` → `delete({ id, userId })`
  → `affected === 0` 명시 비교 → `throwCredentialNotFound()` → `countCredentials` → `remaining===0`
  시 `usersService.update(..., { webauthnRecoveryCodes: null })` → `{ remaining }` 반환. 모든 경로에서
  반환값 또는 예외로 귀결되며 반환값 누락 경로 없음.
- **엣지 케이스**: `affected` 가 `0`(진 쪽) vs `undefined`/`null`(드라이버 미보고, 정상 삭제로 취급)을
  `=== 0` 명시 비교로 정확히 구분 — `it.each([[undefined],[null]])` 대조군 테스트로 고정. 마지막
  credential 삭제(`remaining===0`) vs 잔여 존재(`remaining>0`) 분기도 기존 테스트가 계속 커버.
- **TODO/FIXME/HACK/XXX**: 3개 변경 파일(service.ts, service.spec.ts, e2e-spec.ts) 전체 grep 결과
  없음.
- **의도-구현 일치**: `throwCredentialNotFound(): never` 헬퍼명·JSDoc(4곳 공유, `verifyAuthentication`
  의 401 자리와는 명시적으로 구분)과 실제 호출 4곳(497·500·542·566행)이 정확히 일치. 함수 상단
  JSDoc 의 `@throws` 서술("동시 삭제 두 건이 겹쳐 진 쪽이 이미 지워진 행을 찾을 때(404)")도 실제
  구현과 부합.
- **에러 시나리오**: 소유권 불일치·존재하지 않음·동시 삭제 진 쪽 세 경로 모두 같은 404
  `WEBAUTHN_CREDENTIAL_NOT_FOUND` 로 수렴 — enumeration 방지 의도와 일치.
- **데이터 유효성**: `userId` 를 DELETE 조건절에 추가해 엔티티 컬럼(`user_id`)과 타입·매핑이
  정확히 일치함을 엔티티 정의로 직접 확인. `ParseUUIDPipe` 는 컨트롤러 레벨에서 불변.
- **비즈니스 로직**: "동시 삭제 진 쪽은 404, 이긴 쪽만 감사·복구코드 NULL화 경로 도달" 이라는
  의도된 규칙이 서비스·컨트롤러 양쪽 실제 코드 경로와 일치(`webauthn.controller.ts` 의 감사
  호출이 서비스 resolve 후에만 실행됨을 재확인, `webauthn.controller.spec.ts:258` 기존 테스트로
  뒷받침).
- **반환값**: 모든 분기(성공/두 종류의 404)에서 값 반환 또는 명시적 예외 — 누락 경로 없음.
- **spec 본문 일치**: `spec/1-data-model.md:88` 의 "이 NULL 화는 애플리케이션 레이어
  (`WebAuthnService.deleteCredential`) 의 책임이며 DB 트리거가 아니다" 문구가 코드 주석
  ("애플리케이션 레이어 책임 — DB 트리거 아님", `webauthn.service.ts:570` 부근)과 정확히 일치.
  `spec/5-system/1-auth.md:498` DELETE 행과 `spec/5-system/3-error-handling.md` §1.2.1·§1.11 의
  기존 갭(코드 미등재, `_NOT_FOUND`≠404 "유일한 예외" 문구 오류)은 이번 diff 가 만든 것이 아니라
  사전 존재하며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner
  후속 항목으로 등재돼 있음을 재확인 — SPEC-DRIFT 아님(회색지대, 재조치 불요).
- **이전 라운드 WARNING 조치 검증**: (1) CHANGELOG 신규 섹션 + 두 전방 참조 취소선 정정 —
  `CHANGELOG.md` 1~139행에서 완전한 형태로 확인. (2) plan 문서의 stale 줄 번호 인용 →
  메서드명 인용 교체 — `spec-draft-nullable-notation-followups.md:4979-4984` 확인. (3) 두 번째
  e2e(WARNING#4 반증)에 공허성 가드 추가 — `webauthn-credential-delete-concurrency.e2e-spec.ts:201-210`
  에서 첫 번째 `it` 과 동일한 `raced` 단언 확인. 세 조치 모두 회귀 없이 반영됨.
- 작업 트리는 리뷰 시작·종료 시 `git status --short` 로 확인 — 이 세션이 저장소에 쓴 파일은 자신의
  출력 디렉터리(`review/code/2026/09/21/18_58_48/`)뿐이며 뮤테이션 없음(원복 불요).

## 요약

핵심 변경(`WebAuthnService.deleteCredential()` 의 `affected===0` 명시 비교 + DELETE 조건절 `userId`
추가)과 두 차례 리뷰 라운드에서 지적된 7건의 WARNING(CHANGELOG 누락, JSDoc `@throws` 미기재, 헬퍼
미추출, 이종 credential 동시삭제 `remaining` 경합 주장에 대한 반증·e2e 캐너리, 두 번째 e2e 공허성
가드 누락, plan 문서 stale 줄 번호, CHANGELOG 취소선 절반 적용)이 모두 소스 대조로 정확히 해소됐음을
확인했다. 새로운 CRITICAL/WARNING 은 발견하지 못했다. 유일하게 남기는 관찰은 `throwCredentialNotFound()`
JSDoc 의 `(:403)` 하드코딩 줄 인용인데, 현재 값은 정확하지만 이 PR 자신이 방금 학습한 "줄 번호는
stale 해진다" 교훈이 소스 코드 주석에는 아직 적용되지 않았다는 점을 INFO 로 기록한다(현재는 결함
아님, 차단 사유 아님). 모든 코드 경로에서 반환값·예외가 명확하고, spec 본문(§2.1 recovery-code
NULL화 책임 소재, DELETE 라우트 표)과 line-level 로 일치하며, 사전 존재 spec 갭(에러 코드 카탈로그
미등재, §1.11 오류 문장)은 이미 별도 트래커에 등재돼 이 PR 의 착수·병합을 막을 사유가 아니다.

## 위험도

NONE
