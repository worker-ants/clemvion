# 요구사항(Requirement) 리뷰 — WebAuthn credential 동시 삭제 감사 중복 수정 (아홉 번째/마지막 자리, 리뷰 라운드 4)

## 검증 방법

`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`(전체 484~575행 재확인)·
`webauthn.service.spec.ts`(495~562행)·신규 e2e
`codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts`(전체)를 저장소에서
직접 `Read` 했다. 컨트롤러(`webauthn.controller.ts` 300~351행)·엔티티
(`entities/webauthn-credential.entity.ts`)·형제 구현(`auth-configs.service.ts`)을 대조 확인했다.
spec 은 `spec/1-data-model.md §2.1`·`spec/5-system/1-auth.md`(DELETE 라우트 행)·
`spec/5-system/3-error-handling.md §1.11`을 열어 대조했다. `plan/in-progress/webauthn-dup-delete.md`·
`plan/in-progress/spec-draft-nullable-notation-followups.md`(WebAuthn 항목 및 인접 7·8번째 항목)를
전문 확인했고, 이 세션의 git log(`15da527e7`까지 10커밋)로 이전 세 라운드 리뷰의 조치 내용을
대조했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 로 시작·종료 시 확인, 유일한
변경은 `review/code/2026/09/21/19_18_43/`(본 세션 산출물) 뿐).

## 검증한 사항 (문제 없음 확인)

- **핵심 로직**: `deleteCredential()` — 무락 `findOne` → 소유권 확인(404) → `credentialRepo.delete({ id, userId })` → `affected === 0` **명시 비교**로 404 → `countCredentials` → `remaining === 0` 시 `webauthnRecoveryCodes: null` → `{ remaining }` 반환. 형제 8건(auth-configs/model-config 등)의 `affected === 0` 명시 비교 관용구를 정확히 재현했다(직접 소스 대조). `!affected`(암묵적 falsy 비교)로 되돌리면 `null`/`undefined`(드라이버 미보고)를 0 과 동일시해 정상 삭제를 404 로 뒤집는 회귀가 나는데, 그 대조군(`it.each([[undefined],[null]])`, 550~561행)이 정확히 그 반증 형태를 잠근다.
- **404 헬퍼 추출**(`throwCredentialNotFound(): never`, 517~522행): `renameCredential` 2곳 + `deleteCredential` 2곳 총 4개 호출부가 전부 이 헬퍼를 거치는 것을 확인(495~501행, 541~543행, 565~567행). `verifyAuthentication()`의 401(`UnauthorizedException`, 402~406행)은 의도적으로 제외됐고 그 이유가 헬퍼 JSDoc(512~515행)에 명시돼 있다 — 함수명·주석·구현이 정확히 일치.
- **JSDoc `@throws`**(530~531행): 동시 삭제 진 쪽의 404 시나리오까지 명시적으로 문서화돼 있다 — 이전 라운드(18_03_54 documentation.md WARNING)가 지적한 "동시-삭제 404 미문서화" 갭이 해소됨을 확인.
- **`countCredentials`/`usersService.update` short-circuit**: 진 쪽이 `affected === 0`으로 던지면 그 아래 두 부수효과(count 재조회, 복구 코드 NULL화)에 도달하지 않는다 — 단위 테스트(529~542행)가 `not.toHaveBeenCalled()`로 명시적으로 잠근다.
- **엔티티 필드 정합**: `WebAuthnCredential.userId`(`user_id` 컬럼, UUID)가 `delete({ id, userId })` 조건절과 타입·이름 모두 일치.
- **컨트롤러 계약 불변**: `webauthnDelete`(`webauthn.controller.ts` 316~351행)는 서비스 반환 계약 `{ remaining }`을 그대로 소비하고, 서비스가 던지면 그 아래 `auditLogsService.record(...)`(338행)에 도달하지 않는다 — 이 계약은 기존 `webauthn.controller.spec.ts`("does not record an audit log when deleteCredential throws")로 이미 고정돼 있어 새 코드가 그 계약을 깨지 않는다.
- **e2e 판별력**: 첫 번째 case — `SELECT ... FOR UPDATE` 로 실제 행 락 경합을 만들고 `Promise.race`(1.5초) 공허성 가드로 "겹침이 실제로 일어났음"을 관측한 뒤 `[204, 404]` + 감사 1건(정확한 `resource_type='user'`/`action='user.2fa_disabled'`/`details->>'credentialId'`)을 단언 — 컨트롤러·감사 상수 실제 구현과 필드 단위로 일치.
- **WARNING #4(18_03_54 concurrency.md) 반증 e2e**: 서로 다른 credential 두 개를 동시 삭제할 때 `remaining` 오판(둘 다 1로 봐서 복구 코드 미NULL화) 가능성을 제기했던 지적을, "나중에 커밋하는 쪽은 항상 count=0을 본다"는 순서 논증으로 반증했다. 논증을 직접 검산: 커받 시각의 Postgres WAL 전순서 + 각 요청 내부 delete→count 프로그램 순서를 결합하면, 두 커밋 중 나중 것이 반드시 두 삭제 모두를 본 뒤 count 하므로 0을 관측한다 — 즉 최소 한쪽은 반드시 NULL화를 수행한다는 결론이 수학적으로 타당하다. e2e(150~227행)가 같은 락 기법으로 겹침을 강제한 뒤 `webauthn_recovery_codes IS NULL` 수렴을 실제 DB 조회로 검증한다.
- **TODO/FIXME/HACK/XXX**: 변경된 4개 코드/테스트 파일 전체 grep 결과 없음.
- **반환값**: `deleteCredential`의 모든 경로가 `{ remaining: number }` 반환 또는 `NotFoundException` throw로 귀결 — 반환값 누락 경로 없음.
- **spec 정합** — `spec/1-data-model.md §2.1`의 "이 NULL 화는 애플리케이션 레이어(`WebAuthnService.deleteCredential`)의 책임이며 DB 트리거가 아니다"라는 문장을 코드 인라인 주석(571행 `// 애플리케이션 레이어 책임 — DB 트리거 아님`)이 그대로 재확인하며 어긋나지 않는다.

## 발견사항

- **[INFO]** spec 본문(`spec/5-system/1-auth.md:498`, DELETE `/api/auth/2fa/webauthn/credentials/:id` 행)이 동시 삭제 진 쪽의 404·`WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드를 명시하지 않는다.
  - 위치: `spec/5-system/1-auth.md` (해당 DELETE 라우트 행)
  - 상세: 이 갭은 이번 diff 가 새로 만든 것이 아니라 형제 8건(auth-configs·model-config 등) 모두에 동일하게 존재하는 기존 문서화 공백이며, 같은 세션의 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4975행 항목, planner 소관으로 이미 등재)가 이를 실측·추적 중이다. 코드가 틀린 것이 아니라 spec 본문이 세부 상태 코드를 아직 반영하지 않은 회색지대 — SPEC-DRIFT 태그 대상 아님(이미 트래커에 planner 항목으로 등재돼 재-flag 불필요, 이전 라운드 requirement.md 도 동일 결론).
  - 제안: 조치 불요 — planner 턴에서 트래커 항목 집행 시 함께 반영.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`의 "WebAuthn credential 삭제도 동시 요청에서 `user.2fa_disabled` 감사를 두 번 남긴다 — 아홉 번째" 체크리스트 항목이 여전히 `- [ ]`(미체크)이고, 형제 항목(7·8번째, `AuthConfigsService.remove()`/`ModelConfigService.remove()`)이 갖고 있는 "**2026-09-21 해소** (`plan/complete/*.md`)" 형태의 종결 마커가 없다. 같은 문서 내 다른 자리(4955행)는 `plan/complete/webauthn-dup-delete.md`를 이미 존재하는 것처럼 인용하지만, 실제로는 `plan/in-progress/webauthn-dup-delete.md`(`status: in-progress`)로 아직 남아 있어 그 경로가 존재하지 않는다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 체크리스트 항목, "WebAuthn credential 삭제도..." 로 시작하는 불릿) / `plan/in-progress/webauthn-dup-delete.md` frontmatter (`status: in-progress`)
  - 상세: CHANGELOG.md는 이미 "이 결함 클래스는 아홉 자리로 종료됐다"고 3곳(WebAuthn 신규 섹션 46행, model_config 섹션 93~94행, auth_config 섹션 137~139행)에서 명시적으로 선언했는데, 트래커의 체크박스·plan 상태는 아직 그 선언을 반영하지 않는다. 이는 이 저장소가 스스로 문서화한 관례("체크와 `complete/` 이동은 한 동작 — 마무리 커밋은 리뷰 뒤가 정상")와 부합하는 상태일 가능성이 높다(이번 리뷰가 통과하면 종결 커밋에서 checkbox 체크 + `plan/complete/`로 이동하는 절차가 이어질 것으로 보임). 다만 CHANGELOG의 "완전 종료" 선언과 트래커의 "미해결" 표시가 현재 시점에는 서로 모순돼 있어, 이 커밋만 떼어 보는 다음 사람에게는 혼란의 소지가 있다.
  - 제안: 이번 리뷰가 clean 하게 종결되면 반드시 종결 커밋에서 (1) 해당 체크박스를 `[x]`로, (2) "**2026-09-21 해소**" 마커 + `plan/complete/webauthn-dup-delete.md` 경로를 추가(형제 7·8번째와 동일 형식), (3) `plan/in-progress/webauthn-dup-delete.md`를 `plan/complete/`로 실제 이동, (4) frontmatter `status`를 갱신할 것. 위 셋을 한 커밋에서 처리해 checkbox=실제 상태 불변식을 지킬 것.

- **[INFO]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`, 로그인 2FA 검증)과 404(`renameCredential`/`deleteCredential`, 관리 API) 두 status 로 혼용되는 기존 상태가 이번 diff로 다섯 번째 발행 지점(`deleteCredential`의 `affected===0` 분기)이 생기며 그대로 이어진다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (`verifyAuthentication()` 내부, 402~406행 부근 vs `throwCredentialNotFound()` 517~522행 및 그 4개 호출부)
  - 상세: 이 혼용 자체는 이번 PR이 새로 만든 문제가 아니라 이전부터 있던 상태이고(신규 호출부는 기존과 동일한 코드·타입을 재사용할 뿐 새로운 status 조합을 추가하지 않음), `spec/5-system/3-error-handling.md §1.11`의 "`_NOT_FOUND`≠404는 이 저장소에서 유일한 예외"라는 문장이 실제로는 거짓임을 포함해 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4975~5005행)에 planner 항목으로 이미 상세히 등재돼 있다. 코드 결함이 아니라 spec 정정 대기 상태이므로 재지적 불필요.
  - 제안: 조치 불요 — 이미 별도 planner 트랙으로 등재됨.

## 요약

핵심 변경(`WebAuthnService.deleteCredential()`의 `affected === 0` 명시 비교 도입 + DELETE 조건절 `userId` 스코프 추가 + `throwCredentialNotFound()` 헬퍼 추출)은 형제 8건(#1369~#1375)과 완전히 동일한 검증된 패턴을 정확히 재현하며, 실제 소스 대조로 반환 계약·컨트롤러 감사-스킵 계약·엔티티 필드 정합을 모두 재확인했다. 이전 세 리뷰 라운드(18_03_54/18_31_57/18_58_48)가 지적한 WARNING(CHANGELOG 누락, JSDoc `@throws` 누락, 헬퍼 미추출, 두 번째 e2e 공허성 가드 부재, 줄 번호 인용 stale) 은 모두 해당 커밋에서 조치가 확인됐고, 새로 도입된 코드 결함이나 TODO/FIXME, 반환값 누락 경로는 발견되지 않았다. WARNING #4(서로 다른 credential 동시삭제 시 `remaining` 오판 가능성) 반증 논증도 직접 검산해 타당함을 확인했다. 유일하게 남는 관찰은 (1) spec 본문의 사전 존재 문서화 공백(코드 결함 아님, 이미 planner 트랙에 등재됨)과 (2) CHANGELOG의 "완전 종료" 선언과 아직 `- [ ]`인 트래커 체크박스·`plan/in-progress/`에 남아 있는 plan 상태 사이의 시점 불일치인데, 후자는 이 저장소의 기존 관례(종결 커밋은 리뷰 통과 후)와 부합할 가능성이 높아 이번 리뷰가 clean 통과하면 뒤따를 종결 커밋에서 정리될 것으로 보인다. 둘 다 이번 PR의 기능적 정확성을 저해하지 않는 INFO 수준이다.

## 위험도

NONE
