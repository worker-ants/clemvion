# Cross-Spec 일관성 검토 — `spec/5-system` (impl-prep, WebAuthn credential 동시 삭제 대응)

## 검토 맥락

`plan/in-progress/webauthn-dup-delete.md` — `WebAuthnService.deleteCredential()` 이 동시 DELETE
두 건에서 `user.2fa_disabled` 감사 행을 두 번 남기는 결함을 고치는 착수 전 게이트. 형제 8건
(auth-configs·model-config·workspaces·integrations 등)과 동일하게 `affected` 판별로 두 번째
요청을 404 로 되돌리는 접근을 예고하고 있다. 이 관점에서 `spec/5-system` 번들(`1-auth.md`
전문·`2-api-convention.md`·`3-error-handling.md` 전문, 그 외 15개 파일은 예산 초과로 생략)과
`spec/1-data-model.md §2.21`·`spec/data-flow/1-audit.md`·`spec/data-flow/2-auth.md`·
`spec/2-navigation/9-user-profile.md`·`spec/conventions/audit-actions.md` 를 직접 열어 교차
검증했다.

## 발견사항

- **[WARNING]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 에러 코드 카탈로그에 미등재 — 이번 수정이 그
  코드에 새로 의존한다
  - target 위치: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 — `DELETE
    /api/auth/2fa/webauthn/credentials/:id` 행(204만 서술, 실패 케이스 없음). 바로 위 `PATCH`
    행은 "본인 소유 아니면 404 (enumeration 방지)" 를 명시하면서도 코드명은 적지 않는다.
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.2.1 "2FA / WebAuthn / 재인증·비밀번호
    재확인 코드" 카탈로그. 이 표는 `WEBAUTHN_DISABLED`·`WEBAUTHN_VERIFY_FAILED`·
    `INVALID_OPTIONS_TOKEN`·`CHALLENGE_INVALID`·`WEBAUTHN_INVALID`·`RECOVERY_CODE_INVALID` 등
    WebAuthn 코드를 전부 등재하면서 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 만 빠져 있다. 같은 §1.3 은
    `MODEL_CONFIG_NOT_FOUND`·`AUTH_CONFIG_NOT_FOUND`·`ALERT_RULE_NOT_FOUND` 처럼 리소스별 404
    특화 코드를 빠짐없이 도메인 SoT 포인터와 함께 등재하는 관례를 유지한다.
  - 상세: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 의 4개 지점(404·498·
    504·528줄)이 실제로 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 를 발행한다 — PATCH 의 소유권 실패,
    그리고 이번 PR 이 강화하려는 DELETE 의 not-found/소유권 실패 모두 이 코드를 쓴다. §1.2.1 은
    스스로 "이 표는 도메인 spec(`1-auth.md`) 본문에 문서화된 코드만 등재한다" 고 선언하는데,
    `1-auth.md` 자신이 이 코드명을 어디에도 적지 않아 카탈로그 등재의 전제 자체가 막혀 있다.
    이번 수정은 동시 삭제의 진 쪽이 "조회 실패와 같은 코드" 를 받아야 한다는 것을 명시적
    불변식으로 세우므로(§B 표), 그 코드가 spec 어디에도 이름으로 등장하지 않는 상태로
    구현을 진행하면 카탈로그 완결성 갭이 한 자리 더 늘어난다(`#893`/`#887` 이 닫았던 것과
    동종의 패턴).
  - 제안: 이 PR 자체가 spec 변경 권한 밖(developer)이므로, `1-auth.md` §5 DELETE/PATCH 행에
    코드명 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 를 명시하고 `3-error-handling.md` §1.2.1 에 404 로
    등재하는 것은 planner 트래커 항목으로 남긴다(선례: `dup-delete-audit.md` 가 유사 갭을
    developer 권한 밖으로 분류해 트래커에 등재한 방식과 동형). 이번 PR 의 착수를 막을 필요는
    없다 — 코드 자체는 이미 프로덕션에 존재하고 이번 수정은 그 기존 코드의 **판정 경로**만
    바꾼다.

- **[INFO]** 동시 DELETE 404 관례가 `2-trigger-list.md` 처럼 명문화돼 있지 않음 (정보 제공,
  비차단)
  - target 위치: `spec/5-system/1-auth.md` §5 DELETE 행 — 동시 삭제 시나리오 언급 없음.
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` "동시 삭제: 두 클라이언트가 동시에 같은
    트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 처럼 명시적으로 문서화한 선례가
    존재.
  - 상세: 이것은 모순이 아니라 **부재**다 — 형제 PR 8건(`plan/complete/*-dup-delete.md`)이 전부
    `spec_impact: none` 으로 처리됐고, trigger-list 를 제외한 나머지 리소스(workflow·
    auth_config·model_config·workspace·integration·schedule)도 이 세부를 spec 에 적지 않는
    것이 이미 이 저장소의 확립된 패턴이다. WebAuthn credential 도 그 다수 패턴을 따르는 것이지
    소수 의견(trigger-list)과 불일치하는 새로운 사례가 아니다. 우선순위 결정이 필요한 항목은
    아니며, 동기화하고 싶다면 카탈로그 정비(위 WARNING) 때 함께 적어도 된다는 점만 남긴다.

## 검토했으나 충돌 없음을 확인한 항목

- `spec/1-data-model.md §2.21 WebAuthnCredential` — 필드(`user_id` cascade FK·`counter`·
  suspend 컬럼 부재)가 `1-auth.md §1.4.4`·Rationale 1.4.E 와 정확히 일치.
- `spec/data-flow/1-audit.md` §1.1 표 — `webauthn.controller.ts` 가 `user.2fa_disabled` 을
  `details.method='webauthn'`·`credentialId`·`remainingCredentials` 로 기록한다는 서술이
  plan 의 "감사는 컨트롤러(:338) 담당, 서비스가 던지면 도달 안 함" 전제와 일치 — 동시성
  수정으로 감사 계약(위치·payload)이 바뀌지 않는다.
- `spec/5-system/2-api-convention.md §5.2`·Rationale "비-페이징 고정 컬렉션" — `GET
  .../webauthn/credentials` 의 `{data:{items}}` 형태가 `1-auth.md` §5 서술과 일치.
- `spec/conventions/audit-actions.md` — `user.2fa_disabled` 과거분사 명명이 규약과 일치.
- RBAC 매트릭스(§3.2) — WebAuthn credential CRUD 는 워크스페이스 스코프가 아닌 본인 세션
  기준(JWT 인증)이라 §3.2 매트릭스·`X-Workspace-Id` 흐름과 무관 — 충돌 표면 자체가 없음.
- `spec/2-navigation/9-user-profile.md` — Passkey 카드 서술은 `1-auth.md §5` 를 canonical 로
  포인터만 두고 있어 중복 정의가 없음.

## 요약

이번 impl-prep 대상(`spec/5-system`, WebAuthn credential 동시 삭제 대응)에서 데이터 모델·API
응답 형태·RBAC·감사 계약은 관련 spec 전 영역(`1-data-model.md`·`data-flow/1-audit.md`·
`data-flow/2-auth.md`·`2-navigation/9-user-profile.md`·`conventions/audit-actions.md`)과
모순 없이 일치한다. 유일하게 실질적인 발견은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드가
프로덕션에 이미 존재함에도 `1-auth.md`·`3-error-handling.md` 어디에도 이름으로 등재돼 있지
않다는 카탈로그 완결성 갭이며, 이번 PR 이 그 코드의 사용 빈도(동시 삭제 판정)를 늘리므로
지금 표면화할 가치가 있다 — 다만 이는 기존 코드의 기존 갭이고 developer 권한 밖(spec 수정)이라
착수를 막을 이유는 아니다. 나머지 한 건은 정보성으로, trigger-list 의 명시적 동시-삭제
문구가 다수 형제 리소스(WebAuthn 포함)에는 애초에 적용된 적 없는 기존 패턴임을 확인한 것뿐이다.

## 위험도

LOW
