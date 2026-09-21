# Cross-Spec 일관성 검토 — `spec/5-system` (impl-done, WebAuthn credential 동시삭제 아홉 번째 자리)

## 검토 맥락

diff-base `origin/main` 대비 코드 변경은 `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`(+62/-16)·`webauthn.service.spec.ts`(신규 테스트 55줄)·신규 e2e
`webauthn-credential-delete-concurrency.e2e-spec.ts`(228줄) 3개 파일이며, `spec/5-system` 자체의
델타는 0(계획대로 `spec_impact: none`). 변경 내용은 `WebAuthnService.deleteCredential()` 이
동시 DELETE 두 건에서 `user.2fa_disabled` 감사를 두 번 남기던 결함을 `credentialRepo.delete({ id,
userId })` 의 `affected === 0` 명시 판정으로 고치고, 4개 404 발행 지점을
`throwCredentialNotFound()` 헬퍼로 통합한 것 — 동일 결함 클래스의 형제 8건(workflow·workspace·
trigger·schedule·integration·member·auth_config·model_config)과 동형의 아홉 번째이자 마지막
자리다. `spec/1-data-model.md §2.21`·`spec/data-flow/1-audit.md`·`spec/5-system/1-auth.md`
전문·`3-error-handling.md` 전문·`2-api-convention.md`·`2-navigation/9-user-profile.md` 를 직접
열어 이번 diff 와 교차 검증했다. 착수 전 `--impl-prep`(`review/consistency/2026/09/21/17_39_06`)
이 이미 같은 영역을 검토했으므로, 이번 검토는 **그 사이 diff 가 새 충돌을 만들지 않았는지**와
**그때 발견된 갭이 여전히 유효한지**에 집중했다.

## 발견사항

- **[WARNING]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 에러 코드 카탈로그 미등재 + 동일 코드가
  401/404 두 status 를 오가 `3-error-handling.md` §1.11 의 "유일한 예외" 서술이 거짓이 됨 (기존
  갭 — 이번 diff 가 심화, 신규 발생 아님)
  - target 위치: `spec/5-system/3-error-handling.md` §1.11 — "이름은 `_NOT_FOUND` 지만 404 가
    아니다 — **이 저장소에서 유일한 예외다**." (해당 예외는 `AUTH_CONFIG_NOT_FOUND` 하나만
    가리킴). 같은 §1.2.1/§1.3 WebAuthn 코드 카탈로그에는 `WEBAUTHN_DISABLED`·
    `WEBAUTHN_VERIFY_FAILED`·`RECOVERY_CODE_INVALID` 등은 등재돼 있으나
    `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 빠져 있다. `1-auth.md` §5 API 표에도 이 코드명이
    어디에도 등장하지 않는다(DELETE/PATCH 행은 "404" 서술만 있고 코드명 미명시).
  - 충돌 대상: 코드 실측 — `webauthn.service.ts:404`(`verifyAuthentication()`,
    `UnauthorizedException` → **401**) vs `:497`·`:500`·`:542`·`:566`(이번 diff 가 추출한
    `throwCredentialNotFound()`, `NotFoundException` → **404**)이 **같은 코드 문자열**을 공유.
    `AUTH_CONFIG_NOT_FOUND`(§1.11 이 유일한 예외라 명명한 대상)는 **항상** 400 이라 "이름과
    다르되 일관"하지만, `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 **한 코드가 401 과 404 사이를
    오간다** — 클라이언트가 코드값만으로 분기할 수 없는 더 나쁜 사례다.
  - 상세: 이번 diff 자체는 이 불일치를 만들지 않았다 — 401 지점(`verifyAuthentication`,
    로그인 2FA 검증 단계, 존재 노출 차단 목적으로 보임)은 diff 가 건드리지 않은 기존 코드다.
    다만 diff 가 404 쪽 네 지점을 `throwCredentialNotFound()` 공유 헬퍼로 **통합**하면서
    그 JSDoc 이 스스로 "`verifyAuthentication()` 의 `UnauthorizedException`(401)과는 다른
    자리다... 하나로 합치지 않는다" 라고 명시해, 코드 차원에서 이 이원화를 **의도적 설계로
    고정**시켰다. spec `3-error-handling.md` §1.11 은 여전히 이 사례를 모르는 채로 "유일한
    예외" 를 주장하므로, spec(§1.11)과 코드(현재 상태) 사이 모순이 이번 diff 이후에도 남는다.
  - 이미 추적 중: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "planner,
    중간" 항목으로 2026-09-21 등재됨(집행 항목: (1) 코드를 §1.2.1 에 등재 (2) §1.11 "유일한
    예외" 문장 정정 (3) `1-auth.md` §5 코드명 명시 (4) 401/404 분리 여부 결정). developer 는
    `spec/` 쓰기 권한이 없어 이 diff 에서 직접 고치지 않은 것이 맞는 처리다. 다만 이 항목은
    아직 `[ ]`(미해소) 상태이므로, 이번 impl-done 시점에도 spec 텍스트 자체는 여전히 실제
    코드와 모순 상태임을 재확인해 둔다 — planner 턴에서 반드시 반영 필요.
  - 제안: 별도 조치 불요(이미 planner 트래커에 등재·developer 권한 밖). 다음 spec 쓰기
    세션(project-planner)이 이 항목을 처리할 때 `1-auth.md` §5 의 `DELETE
    /api/auth/2fa/webauthn/credentials/:id` 행에도 코드명을 명시해야 한다(트래커 항목의
    "집행 시 할 일 (3)"과 일치).

## 검토했으나 충돌 없음을 확인한 항목 (이번 diff 기준 재확인)

- **데이터 모델**: `credentialRepo.delete({ id, userId })` 의 `userId` 조건 추가는
  `spec/1-data-model.md §2.21 WebAuthnCredential` 의 `user_id` FK 정의와 모순 없음 — 새 필드·
  엔티티 정의 변경 없음.
- **API 계약(shape)**: `deleteCredential()` 반환 계약 `{ remaining }` 은 그대로이고, 진 쪽만
  404 로 분기한다. `1-auth.md §5` 의 `DELETE .../webauthn/credentials/:id` 행(204) 서술과
  충돌 없음 — 동시 삭제 시 진 쪽 응답은 spec 에 명문화돼 있지 않지만, 이는 형제 8건 전부와
  동일하게 `spec_impact: none` 처리된 기존 패턴(trigger-list 만 예외적으로 명시)이라 새로운
  불일치가 아님(§1.4.4 는 정상 흐름만 서술).
  - 다만 감사 쿼리는 `resource_type = 'user'`·`resource_id = userId`(credential 이 아님)로
    확인해야 한다는 점을 e2e 자체가 주석으로 강조 — `data-flow/1-audit.md §1.1` 의
    `user.2fa_disabled` 서술(`details.credentialId` 필드 포함)과 diff 의 감사 조회 쿼리가
    일치함을 확인했다.
- **감사 계약**: 판정 위치를 서비스 delete 직후로 당겼지만, 감사 자체는 여전히
  `webauthn.controller.ts` 가 남긴다(diff 는 컨트롤러를 건드리지 않음) — `1.4.H`/`4.1.B`
  Rationale 의 계층 분리(서비스=도메인 로직, 컨트롤러=감사 기록)와 충돌 없음.
- **RBAC**: `deleteCredential`은 본인 세션(JWT) 스코프이며 워크스페이스 RBAC 매트리스(§3.2)와
  무관 — 새 권한 구조 도입 없음.
- **요구사항 ID**: 이번 diff 는 spec 요구사항 ID 를 신규 부여하지 않음.
- **상태 전이**: WebAuthn credential 라이프사이클(등록→사용→counter 갱신/역행 삭제→복구 코드
  NULL화)에 새 상태나 전이를 추가하지 않음 — 동시 요청 중 진 쪽을 "이미 없음(404)" 으로
  처리하는 것은 기존 상태 모델 밖의 새 상태가 아니라 판정 시점의 race 해소일 뿐.
- **계층 책임**: `throwCredentialNotFound()` 추출은 `auth-configs.service.ts` 의
  `throwAuthConfigNotFound()`·`model-config` 의 `notFound()` 형제 선례와 동형이며, 서비스/
  컨트롤러 책임 분할(0.md/§Rationale 1.4.H WebAuthn 도메인 모듈 분리)과 일치.

## 요약

이번 diff(WebAuthn credential 동시삭제 아홉 번째 자리)는 데이터 모델·API 응답 형태·RBAC·감사
계약·계층 책임 어느 면에서도 `spec/5-system` 밖 다른 영역과 새로운 모순을 만들지 않는다. 유일한
실질 발견은 `--impl-prep` 단계에서 이미 표면화된 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드
카탈로그 미등재 + 401/404 이원화(→`3-error-handling.md §1.11` "유일한 예외" 서술 실효화)이며,
이번 diff 는 그 원인(401 지점)을 만들지 않았지만 404 쪽 네 지점을 공유 헬퍼로 통합해 그 이원화를
코드 차원에서 의도적 설계로 재확인·고정시켰다. 이 항목은 이미 planner 트래커에 등재돼 developer
권한 밖으로 명시적으로 분류돼 있으나, spec 텍스트(§1.11) 자체는 아직 실제와 불일치 상태로 남아
있어 WARNING 으로 재보고한다 — impl-done 게이트를 막을 사유는 아니다.

## 위험도

LOW
