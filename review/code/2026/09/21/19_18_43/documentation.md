# 문서화(Documentation) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리, 4차 라운드)

## 사전 확인

이 diff 는 이미 세 차례 `/ai-review` 문서화 라운드를 거쳤다:

- `review/code/2026/09/21/18_03_54/documentation.md` — WARNING 2건(CHANGELOG 항목 부재,
  `deleteCredential()` JSDoc `@throws` 미기재) → `a20455447`·`d3127c8a6` 로 조치.
- `review/code/2026/09/21/18_31_57/documentation.md` — WARNING 2건(plan 트래커 stale 줄 번호
  인용, CHANGELOG 취소선 절반 적용) → `ee6fd5d56`·`7b71e9a4a` 로 조치.
- `review/code/2026/09/21/18_58_48/documentation.md` — WARNING 2건(`throwCredentialNotFound()`
  JSDoc 자체에 새로 박힌 stale `verifyAuthentication(:403)` 인용, 자매 plan 문서
  `webauthn-dup-delete.md` 의 동일 stale 인용 잔존) → `15da527e7` 로 조치.

이번 라운드는 `15da527e7`(가장 최근 fix 커밋)가 실제로 그 2건을 해소했는지, 그리고 그 해소
작업 자체가 또 같은 함정을 반복했는지를 직접 소스 대조로 확인하고, 그 위에서 **새로 남은 것**만
찾는다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 로 확인 완료 — 변경 없음).

## 검증한 사항

- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:512`
  (`throwCredentialNotFound()` JSDoc) — `` `verifyAuthentication()` 의 `UnauthorizedException`(401)과는
  다른 자리다. `` 로 줄 번호가 제거되어 있음을 직접 확인. 메서드가 파일 내 유일해 줄 번호 없이도
  특정에 문제없다.
- `plan/in-progress/webauthn-dup-delete.md` 체크리스트 항목(`--impl-prep` 결과 기록)도
  `` `webauthn.service.ts` 의 `verifyAuthentication()` 이 `UnauthorizedException`(401),
  `renameCredential()`·`deleteCredential()` 이 `NotFoundException`(404) `` 로 메서드명 기반
  서술로 교체되어 있고, "왜 줄 번호로 적지 않는지"까지 한 줄 남겨 재발 방지 근거를 명시함을 확인.
- `CHANGELOG.md`(1~145행 전체) — WebAuthn(아홉 번째) 신규 항목, `model_config`/`auth_config`
  두 "남는 것" 전방 참조의 취소선 처리가 모두 "아홉 자리로 종료" 결론과 모순 없이 일관됨을
  재확인(직전 라운드 WARNING#2 완전 해소).
- `webauthn.service.spec.ts:509-561`(`describe('동시 삭제')`)·
  `webauthn-credential-delete-concurrency.e2e-spec.ts`(전체 228줄) — docblock 서술이 실제
  구현·단언과 정확히 일치. `webauthn.controller.spec.ts` 의 테스트 제목 인용
  (`does not record an audit log when deleteCredential throws`, 258행)도 `grep` 으로 재확인.
  e2e 두 번째 `it` 의 `resourceType: 'user'`/`resourceId: user.sub` 서술도
  `webauthn.controller.ts:342-343` 실제 코드와 일치.

## 발견사항

- **[INFO]** 열린(미해소) 트래커 항목이 이 PR 자신의 리팩터로 stale 해진 줄 번호를 인용하지만,
  이는 이 저장소의 확립된 "발견 시점 동결" 관례와 일치해 새 결함으로 보기 어렵다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (체크리스트 항목
    `**WebAuthn credential 삭제도 동시 요청에서 \`user.2fa_disabled\` 감사를 두 번 남긴다 —
    아홉 번째**`, 현재도 `[ ]` 미해소) 안의 `` `webauthn.service.ts:532` 는 이미
    `credentialRepo.delete({ id })` 를 쓰지만 **`affected` 를 버린다** `` 문장.
  - 상세: `git show origin/main:codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
    로 확인하면 이 PR 시작 시점엔 `:532` 가 정확히 `credentialRepo.delete({ id: credentialUuid })`
    호출이었다(여덟 번째 PR `#1375` 가 등재할 때 정확했던 값). 그런데 이 PR 자신의 커밋들
    (JSDoc·인라인 주석 추가)이 그 호출을 `:561` 로 밀어냈다 — 지금 `:532` 를 열면 JSDoc 주석
    한 줄만 보인다. 형태만 보면 직전 라운드(`18_58_48`) WARNING 과 같은 클래스(같은 PR 이
    자신의 편집으로 자신의 줄 번호 인용을 무너뜨림)다.
    다만 결정적 차이가 있다 — 직전 라운드 WARNING 은 **이 PR 안에서 새로 작성된 문장**이
    커밋되는 순간 이미 stale 했던 경우("실행 항목"이 실제로 다음 사람을 오도할 위험이 있었다).
    이번 `:532` 는 **이전 PR(#1375)이 그 시점 기준으로 정확하게 남긴 발견 기록**이고, 같은
    문서 안에 이미 동일한 관례가 여러 곳 있다 — 이미 `[x]` 로 닫힌 형제 항목들
    (`auth-configs.service.ts:287`, `model-config.service.ts:404`, 4925·4936행)도 그 발견
    PR 시점 줄 번호를 해소 이후에도 갱신하지 않고 "역사적 기록"으로 그대로 둔다. 이미
    archive 된 `plan/complete/member-dup-remove.md:41` 도 같은 `:532` 를 동일한 방식으로
    동결해 두고 있다. 즉 "닫히는 항목의 발견 시점 줄 번호는 갱신하지 않는다" 는 이 트래커의
    광범위하고 일관된 기존 관례이며, 이번 항목만 예외적으로 문제인 것이 아니다.
  - 제안: 필수 조치 아님. 다만 `plan/in-progress/webauthn-dup-delete.md` 체크리스트의
    마지막 미완료 항목("트래커 항목 해소 + `plan/complete/` 로 이동")을 수행할 때, 형제
    일곱 건과 같은 방식으로 `[x]` + "**해소 (날짜)**" 각주만 붙이면 충분하다 — 줄 번호
    자체를 갱신할 필요는 없다(오히려 갱신하면 "발견 시점 기록" 이라는 관례와 어긋난다).

- **[없음]** 핵심 문서화 변경 4건(CHANGELOG 신규 항목, `deleteCredential()` JSDoc `@throws`,
  `throwCredentialNotFound()` 헬퍼 JSDoc, 신규 단위·e2e 테스트 docblock)이 모두 최종 구현·
  실측과 정확히 일치함을 직접 대조로 재확인. 이전 세 라운드가 지적한 WARNING 6건(1·2차 각
  2건 + 3차 2건) 전부 해소 상태가 이번 라운드 diff(`15da527e7`)에서도 퇴행 없이 유지된다.
  - 새 환경변수·설정·API 엔드포인트·README 대상 변경은 없음(순수 서비스 내부 로직 + 테스트 +
    문서 커밋). Swagger `@ApiNotFoundResponse` 미기재·`WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러
    코드 카탈로그 미등재는 1차 라운드가 이미 "사전 존재 갭, 이번 PR 을 막을 사유 아님"으로
    판정했고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로
    등재돼 있다 — 재지적하지 않는다.

## 요약

`15da527e7` 는 직전 라운드(`18_58_48`)가 지적한 WARNING 2건(소스 JSDoc·자매 plan 문서의 stale
`verifyAuthentication(:403)` 인용)을 정확히 해소했고, 이전 두 라운드의 WARNING 4건도 여전히
해소 상태로 유지됨을 소스 직접 대조로 확인했다. 이번 라운드에서 새로 지적할 WARNING/CRITICAL은
없다. 유일한 관찰은 아직 열려 있는 트래커 항목(`spec-draft-nullable-notation-followups.md`)의
`webauthn.service.ts:532` 인용이 이 PR 자신의 편집으로 stale 해졌다는 점인데, 이는 직전
라운드가 잡아낸 "같은 PR 안에서 즉시 무너지는 신규 인용" 패턴과는 달리 이 트래커 문서 전반에
걸쳐 이미 확립된 "발견 시점 줄 번호 동결" 관례(다른 닫힌 형제 항목들도 동일)와 일치해 INFO 로
남긴다 — 곧 있을 "트래커 항목 해소" 단계에서 형제들과 같은 방식으로 닫으면 충분하다.

## 위험도

NONE
