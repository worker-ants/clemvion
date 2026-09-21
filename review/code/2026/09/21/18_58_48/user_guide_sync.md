# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 22행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑을 SoT 로 적재했다.

## 변경 파일 요약 (meta.json 기준)

실질 코드 변경은 3개 파일뿐이다:
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts`
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts`

나머지(`CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/09/21/18_03_54/**`)는 문서/plan/이전 리뷰 산출물이며 매트릭스 trigger 대상(`codebase/frontend/**`, `codebase/backend/src/nodes/**`, `codebase/packages/expression-engine/**` 등)이 아니다.

## trigger 매칭 및 판단

`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 는 매트릭스 `auth-session-flow-change` 행의 glob(`codebase/backend/src/modules/auth/**`) 에 매칭된다. 이 행은 `match: "semantic"` — glob 이 걸려도 실제로 "인증·권한·세션 흐름 변경"인지는 reviewer 판단이 필요하다.

판단 결과: **동반 갱신 불요**, 다음 근거로 확인했다.

1. **변경 범위가 사용자 가시 흐름을 바꾸지 않는다** — `deleteCredential()` 내부에서 이미 원자적이던 `credentialRepo.delete()` 의 반환값(`affected`)을 판정에 쓰도록 좁힌 것뿐이다. 정상 경로(단일 요청으로 Passkey 삭제)의 요청/응답/화면 동작은 그대로다. 관측 가능한 유일한 변화는 **동시 DELETE 레이스**(같은 credential 을 겨냥한 두 요청이 동시에 옴)에서 패자가 204 대신 404 를 받는 것뿐이다.
2. **그 레이스는 문서화된 정상 UI 흐름으로는 도달 불가능하다** — `codebase/frontend/src/app/(main)/w/[slug]/profile/security/passkey-card.tsx:375` 의 삭제 버튼이 `disabled={pendingDelete}` 로 뮤테이션 진행 중 비활성화된다. 즉 표준 UI 경로의 더블클릭으로는 이 레이스에 도달할 수 없고, 서로 다른 탭/기기/스크립트로 동시에 같은 credential 을 지워야만 관측된다 — `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx` 의 "삭제: 휴지통 아이콘 → 확인" 서술이 이 변경으로 부정확해지지 않는다.
3. **새 에러 메시지·에러 코드가 아니다** — `WEBAUTHN_CREDENTIAL_NOT_FOUND` 와 한국어 메시지 `'인증기를 찾을 수 없어요.'` 는 이 diff 이전부터 같은 파일의 `renameCredential`/`deleteCredential` 조회 실패 분기에 이미 존재했다(재사용, 신규 아님). `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑 대상(workflow 노드 실행 warning/error) 체계와도 무관 — 컨트롤러 레벨 `NotFoundException` 이 자체 한국어 `message` 를 갖고 그대로 HTTP 응답 바디로 나가는 방식이라 프런트 i18n dict 경유가 아니다. 실제로 `grep WEBAUTHN_CREDENTIAL_NOT_FOUND backend-labels.ts` 결과 0건이며, 그건 이 diff 이전에도 그랬다.
4. **프런트엔드가 이미 일반 에러 토스트로 처리한다** — `passkey-card.tsx:100` `onError: () => toast.error(t("profile.security.webauthn.deleteFailed"))` 가 코드별 분기 없이 모든 삭제 실패를 동일한 기존 i18n 키로 덮는다. 새 UI 문자열도, dict 갱신 필요도 없다.
5. **e2e 보강은 이미 같은 diff 안에서 수행됐다** — 매트릭스 `auth-session-flow-change` 행의 `verify` 는 `make e2e-test` 이고 target 후반부가 "흐름 변경 시 e2e 보강 점검"을 요구하는데, `webauthn-credential-delete-concurrency.e2e-spec.ts` 가 정확히 이 레이스를 `SELECT ... FOR UPDATE` 로 재현하는 신규 e2e 를 추가했다(concurrency.md/database.md 리뷰가 이미 확인).
6. **선례와 일치** — 같은 결함 클래스의 형제 8건(#1369~#1375: workflow·workspace·trigger·schedule·integration·member-remove·auth_config·model_config)도 전부 내부 동시성 정합성 수정이며, 그중 어느 것도 `07-workspace-and-team/` 이하 문서·i18n dict 갱신을 동반하지 않았다 — 이 결함 클래스 자체가 "사용자 가이드가 서술하는 흐름"을 바꾸지 않는다는 일관된 판단이다.

## 발견사항

- **[INFO]** `auth-session-flow-change` 행의 glob 이 형식적으로 매칭되나, 위 6가지 근거로 실제 동반 갱신 대상 아님을 확인함 — 그레이존 후보를 정밀 판단으로 배제.
  - 변경 파일: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
  - 매트릭스 항목: `auth-session-flow-change` — targets: "codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"
  - 상세: 위 판단 섹션 참조. 사용자 가시 흐름·에러 메시지·i18n 키 변경 없음, e2e 보강은 이미 diff 에 포함.
  - 제안: 조치 불요. 다만 향후 이 종류의 concurrency-fix PR 을 리뷰할 때 "disabled 버튼이 정상 UI 레이스를 막는가"를 확인하는 체크포인트로 재사용 가능.

이 외 매트릭스의 다른 trigger(신규 노드, 노드 schema 변경, 신규 UI 문자열, 통합/제공자 변경, 신규 섹션 디렉토리, 표현식 언어 변경, 실행·디버깅 흐름 변경, 신규 warning/error code)에 매칭되는 변경 파일은 없다 — 이번 diff 는 `codebase/frontend/**` 파일을 전혀 포함하지 않는다.

## 요약

매트릭스 22행 중 glob 상 매칭 후보는 `auth-session-flow-change` 1건뿐이었고(`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`), semantic 판단 결과 사용자 가시 흐름 변경이 아니며(레이스는 UI 의 `disabled` 가드로 도달 불가) 신규 에러 메시지·i18n 키도 없어 `07-workspace-and-team/security-2fa.mdx` 등 유저 가이드 동반 갱신이 필요하지 않다. e2e 보강은 이미 같은 diff 에 포함돼 있다. 나머지 21개 trigger 는 매칭되는 변경 파일이 없다(frontend 코드 변경 0건). 동반 갱신 누락 없음.

## 위험도

NONE
