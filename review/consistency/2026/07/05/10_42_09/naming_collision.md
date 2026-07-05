# 신규 식별자 충돌 검토 — spec-draft-auth-webauthn-list-format

## 검토 대상
- target: `plan/in-progress/spec-draft-auth-webauthn-list-format.md`
- 검토 모드: spec draft 검토 (--spec)
- spec_impact: `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md`, `spec/2-navigation/9-user-profile.md`

## 요약 (draft 의 성격)

본 draft 는 **새 식별자를 도입하지 않는다**. 5개 변경 전부 다음 중 하나다:

1. 기존 endpoint(`GET /api/auth/2fa/webauthn/credentials`, `GET /api/users/me/sessions`)의 **응답 포맷 서술 문구 정정** (bare array → 실제 wire 계약 `{data:{items}}`)
2. 기존 §(api-convention §5.2, swagger §2-5/§5/§6)에 **설명 문단·각주 추가**
3. 신규 서술 용어 "비-페이징 고정 컬렉션"(non-paginated fixed collection) 도입 — 이는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV 키·파일 경로 어느 범주에도 속하지 않는 순수 설명적 문구

따라서 통상적 의미의 "신규 식별자 충돌" 대상(ID, DTO/엔티티명, endpoint, 이벤트명, ENV var, 파일 경로)이 존재하지 않는다. 아래는 각 관점별 점검 결과다.

## 관점별 점검

### 1. 요구사항 ID 충돌
- 대상 아님. `spec/5-system/1-auth.md` 는 `_product-overview.md` 류가 아닌 기술 spec 본문이라 자체 요구사항 ID 네임스페이스(`NAV-*`, `ED-*`, `ND-*` 류)를 쓰지 않는다. draft 는 어떤 ID 도 신설하지 않는다.
- `spec/5-system/1-auth.md`, `spec/2-navigation/9-user-profile.md` 전체를 확인했으나 `AUTH-*` / `WA-*` / `SESS-*` 형태의 ID 스킴 자체가 없음 — 충돌 표면 없음.

### 2. 엔티티/타입명 충돌
- draft 는 `WebAuthnCredentialListDto`, `SessionListDto` 등 기존 타입명을 **그대로 인용**만 한다(신규 타입 미도입).
- 코드 확인 결과 draft 의 서술이 실제와 일치함을 재확인:
  - `codebase/backend/src/modules/auth/sessions.controller.ts:74,120,164` → `return { data: { items: sessions } };`
  - `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:277,285` → `WebAuthnCredentialListDto` + `items: credentials.map(...)`
- 새로 도입되는 것은 서술적 용어 "비-페이징 고정 컬렉션" 뿐이며, `spec/` 전체를 grep 한 결과(`고정 컬렉션`, `non-paginated`, `비페이징`, `비-페이징`) 기존에 이 표현이 전혀 쓰인 적이 없어 **다른 의미로 이미 사용 중인 용어와의 충돌 없음** (완전 신규 조어, 재사용 아님).

### 3. API endpoint 충돌
- 새 endpoint 없음. 기존 `GET /api/auth/2fa/webauthn/credentials`(1-auth.md line 469), `GET /api/users/me/sessions`(9-user-profile.md line 329) 두 endpoint 의 **응답 body 서술**만 정정한다. method+path 변경 없음, 신규 endpoint 추가 없음 — 충돌 대상 자체가 없다.

### 4. 이벤트/메시지명 충돌
- 대상 아님. webhook·queue·SSE 이벤트명 신설 없음.

### 5. 환경변수·설정키 충돌
- 대상 아님. 신규 ENV var·config key 없음.

### 6. 파일 경로 충돌
- draft 는 신규 spec 파일을 만들지 않는다 — 기존 4개 파일(`1-auth.md`, `2-api-convention.md`, `swagger.md`, `9-user-profile.md`) 에 대한 인라인 편집뿐. 파일 경로 신설·명명 컨벤션 이슈 없음.
- 앵커(anchor) 참조 정합성도 확인: draft 가 참조하는 `#52-목록-응답`(`spec/5-system/2-api-convention.md:122` `### 5.2 목록 응답`), `#2-5-응답-wrapping`(`spec/conventions/swagger.md:204` `### 2-5. 응답 wrapping`) 모두 실제 heading 과 정확히 일치하며, 동일 anchor 를 가리키는 다른 heading 이 없어 anchor 충돌 없음.
- 동시 진행 중인 plan 중 동일 spec 파일을 건드리는 `plan/in-progress/spec-sync-auth-gaps.md`(LDAP/SAML 미구현 추적), `plan/in-progress/spec-sync-user-profile-gaps.md`(avatar 업로드·알림 설정 미구현 추적)를 확인했으나, 두 plan 모두 **완전히 다른 섹션**(§1.3, §6.1/§6.2)을 다루고 있어 라인/식별자 겹침 없음.

## 발견사항

특기할 CRITICAL/WARNING/INFO 없음. (draft 자체가 명시한 대로, 이전 라운드 CRITICAL 은 swagger.md "유일한 예외" 문구와의 **모순**(cross-spec 정합성 이슈)이었으며 변경 4 로 이미 해소됨 — 이는 신규 식별자 충돌이 아니라 "동일 사실에 대한 서로 다른 단정" 문제라 본 checker 의 관점(신규 식별자 도입 vs 기존 사용처)과는 범주가 다르다. 참고로만 기록.)

## 위험도

NONE
