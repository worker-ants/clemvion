# 정식 규약 준수 검토 — auth-reauth-spec-accuracy

target: `plan/in-progress/auth-reauth-spec-accuracy.md` (spec draft, `spec/5-system/1-auth.md` §2.3 + `spec/5-system/3-error-handling.md` §1.2.1 변경안)

## 발견사항

- **[WARNING]** `PASSWORD_INVALID`(신규 등재) vs 기존 `INVALID_PASSWORD` 워드오더-치환 네이밍 충돌 미고지
  - target 위치: 변경 2a(§1.2.1 표에 3행 추가) · 변경 2b(하단 주석 교체)
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명" 및 §3 "Historical-artifact 예외 레지스트리"가 세워둔 선례 — 이미 유사한 근접 명명 코드 쌍(예: `workspace_not_found` vs `WORKSPACE_NOT_FOUND`, `already_a_member` vs `ALREADY_A_MEMBER`)마다 "다른 모듈·다른 케이스 컨벤션·별개 코드" 임을 명시적으로 disambiguate 하는 패턴이 정착돼 있음
  - 상세: 이번에 `3-error-handling.md §1.2.1` 카탈로그에 신규 등재되는 `PASSWORD_INVALID`(재인증·로그인 공용, `sessions.service.ts:266`·`auth.service.ts:80`)와, 같은 문서 §2b 주석이 "후속으로 남긴다" 고 언급하는 `INVALID_PASSWORD`(비밀번호 변경, `users.service.ts:76/84`)는 단어 순서만 바뀐 사실상 근접 명명이다. 실제로 코드베이스에는 `PASSWORD_REQUIRED`(`auth.service.ts:74`, `AuthService.verifyPasswordForUser` — 2FA 비활성화/WebAuthn 관리용 별도 재확인 헬퍼)까지 더해 `PASSWORD_*`/`*_PASSWORD` 계열 코드가 이미 3종 존재한다. target 의 2b 교체문은 `PASSWORD_INVALID` 를 "재인증·로그인 공용" 으로만 서술하고 `INVALID_PASSWORD`·`PASSWORD_REQUIRED` 와의 구분을 전혀 언급하지 않아, 향후 `INVALID_PASSWORD` 가 별도 후속 PR 로 카탈로그에 오를 때 두 코드가 오·탈자 관계로 오인되거나 클라이언트 구현자가 혼동할 위험이 있다.
  - 제안: 2b 주석(또는 §1.2.1 신규 행의 "설명" 컬럼)에 "`PASSWORD_INVALID`(재인증/로그인 자격 불일치)는 비밀번호 변경 검증 실패 코드 `INVALID_PASSWORD`(§1.3, 별도 등재 예정)와 다른 코드다" 한 문장을 추가해 `error-codes.md §3` 스타일의 명시적 disambiguation 을 갖출 것을 권장. 규약 자체를 바꿀 필요는 없음(§1 원칙은 이미 이 케이스를 "의미가 다르면 신설" 로 정당화하므로) — 다만 카탈로그 가독성 보강 차원의 문서 갱신 제안.

- **[WARNING]** 신규 `PASSWORD_INVALID` 카탈로그 행의 "공용" 범위 서술이 실제 발행처보다 좁음
  - target 위치: 변경 2b (교체 후 주석) · 변경 2a 신규 행 "설명" 컬럼
  - 위반 규약: `spec/conventions/error-codes.md` §1 "코드의 *정의(spec 본문)*가 진실이고 이름은 그 정의를 읽히게 하는 라벨" — 정의(도메인 SoT 서술)가 실제 발행 지점을 빠짐없이 반영해야 한다는 원칙, 및 `3-error-handling.md` 도입부가 표방하는 "공용 카탈로그 가시성"의 완결성 취지
  - 상세: target 의 2b 는 `PASSWORD_INVALID` 를 "재인증(§2.3 `verifyReauth`)·로그인 공용" 으로만 규정한다. 그러나 실제로는 `AuthService.verifyPasswordForUser`(`auth.service.ts:80`, `data-flow/2-auth.md §1.2` 가 SoT — 2FA 비활성화 `auth.controller.ts:342` · WebAuthn credential 삭제 `webauthn.controller.ts:372` 에서 호출)도 동일 문자열 `PASSWORD_INVALID` 를 발행한다. 즉 실제로는 3-way 공용(로그인/§2.3 재인증/2FA·WebAuthn 관리 재확인)인데 카탈로그·§2.3 신규 note 어디에도 세 번째 발행처가 언급되지 않아, "정의가 진실" 원칙 대비 서술 범위가 축소돼 있다.
  - 제안: §1.2.1 신규 `PASSWORD_INVALID` 행 설명 또는 2b 주석에 "2FA 비활성화·WebAuthn 관리 재확인(`AuthService.verifyPasswordForUser`, [data-flow/2-auth.md §1.2](../data-flow/2-auth.md#12-비밀번호-재확인)) 에서도 동일 코드 발행" 한 구절을 추가. 본 PR 범위가 §2.3 한정이라면 최소한 "본 표는 §2.3 발행처만 서술하며 2FA/WebAuthn 관리 재확인 경로는 별도"라는 스코프 한정 문구라도 남겨 완결성 오인을 방지할 것.

## 규약 준수로 확인된 사항 (참고)

다음은 정식 규약 위반이 아님을 명시적으로 확인했다 — 향후 재검토 시 중복 조사 불필요:

- §1.2.1 신규 3행의 컬럼 순서(`코드 | status | 설명 | 도메인 SoT`)·`UPPER_SNAKE_CASE` 표기·prefix-less 표기(다른 generic auth 코드 `AUTH_REQUIRED`/`TOKEN_EXPIRED`/`REAUTH_NOT_AVAILABLE` 와 동일 그룹) 모두 `error-codes.md` §1·`node-output.md` §3.2 와 일치.
- HTTP status 매핑(`REAUTH_REQUIRED`=400, `PASSWORD_INVALID`/`TOTP_INVALID`=401)은 `api-convention.md §6` 의 400=검증 실패/401=인증 실패 기준과 일치하며, 실제 코드(`sessions.service.ts:257-290`)의 예외 타입과도 일치함을 직접 확인.
- `[1-auth.md §2.3](./1-auth.md#23-세션-정책)` 앵커는 실제 heading(`### 2.3 세션 정책`, line 314)의 github-slugger 결과와 일치 — `spec-link-integrity` 가드 위반 없음.
- 두 대상 spec 파일(`1-auth.md`: `status: partial`, `3-error-handling.md`: `status: implemented`) frontmatter 는 target 변경으로 건드리지 않으며, 이번 변경이 새 미구현 surface 를 만들지 않으므로(이미 구현된 코드에 문서를 정합화) `pending_plans:` 갱신 의무도 발생하지 않음(`spec-impl-evidence.md` §3).
- plan frontmatter(`worktree`/`started`/`owner`/`spec_impact`)는 `spec-impl-evidence.md §4.2`(plan-frontmatter.test.ts, Gate C) 요건을 모두 충족.
- swagger 데코레이터(`sessions.controller.ts` `revokeSession`/`revokeOtherSessions`) 이미 `@ApiBadRequestResponse`/`@ApiUnauthorizedResponse`/`@ApiForbiddenResponse` 로 이 4개 코드를 사실상 문서화하고 있어 `swagger.md` 규약과 충돌 없음(target 은 코드 변경이 없는 spec-only PR).
- "revoke-others" 용어는 실제 엔드포인트 `POST sessions/revoke-others`(`sessions.controller.ts:123`) 및 기존 `9-user-profile.md:342` 서술과 부합 — 신조어·비표준 용어 아님.

## 요약

target 은 이미 구현된 코드(`SessionsService.verifyReauth`)에 맞춰 §2.3 서술을 정정하고 그 세부 에러 코드 3종을 `3-error-handling.md §1.2.1` 공용 카탈로그에 등재하는 순수 문서 정합화 작업이다. 표 컬럼 형식·`UPPER_SNAKE_CASE` 표기·prefix 관례·HTTP status 매핑·앵커 슬러그·plan frontmatter 등 `spec/conventions/**` 의 형식적 규칙은 모두 정확히 준수한다. 다만 신규 등재되는 `PASSWORD_INVALID` 가 기존 `INVALID_PASSWORD`(비밀번호 변경 검증) 및 `PASSWORD_REQUIRED`(2FA/WebAuthn 관리 재확인)와 근접 명명·부분 중복 발행처 관계에 있음에도 target 의 카탈로그 서술이 이를 명시적으로 disambiguate 하지 않아, `error-codes.md` 가 다른 근접 코드 쌍마다 지켜온 "명시적 구분 주석" 관행에서 벗어난다. 두 건 모두 CRITICAL 급 invariant 파괴는 아니며 카탈로그 완결성·가독성 보강 수준의 WARNING이다.

## 위험도

LOW
