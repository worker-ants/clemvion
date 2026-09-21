# 정식 규약 준수 검토 — spec/5-system (--impl-done, diff-base=origin/main)

## 검토 범위 메모

- scope(`spec/5-system`) 델타는 **0개 파일** — 이 PR 은 spec 을 고치지 않는다
  (`plan/in-progress/webauthn-dup-delete.md` frontmatter `spec_impact: none`, bare 값으로
  정상 형태). 실제 구현 diff 는 3개 파일·393줄
  (`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` ·
  `webauthn.service.spec.ts` · `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts`,
  신규)이며, 아래 발견사항은 이 워킹트리를 절대경로로 직접 읽어 확인했다
  (`git diff origin/main...HEAD -- <path>`).
- 번들 프롬프트는 컨텍스트 예산 초과로 `spec/conventions/**` 대부분과 `3-error-handling.md` 등
  다수 `spec/5-system/*.md` 를 절단했다(`error-codes.md`·`swagger.md`·`node-output.md`·
  `redis-keys.md` 등 본문 생략). 절단분 중 이번 변경과 관련 있는 `error-codes.md`·
  `audit-actions.md`·`review-citations.md`·`3-error-handling.md`(관련 절)는 `Read`/`grep` 으로
  직접 열어 전문 대조했다.
- 동일 세션의 이전 라운드(`--impl-prep`, `review/consistency/2026/09/21/17_39_06/convention_compliance.md`)가
  이미 아래 WARNING 을 선제 발견했고, 이번 `--impl-done` 재검토에서 그 결론이 그대로 유효함을
  최종 diff·후속 트래커 갱신으로 재확인했다.

## 발견사항

- **[WARNING]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 에러 코드 카탈로그에 여전히 미등재 — "`_NOT_FOUND`≠404 는 이 저장소에서 유일한 예외" 라는 spec 문장이 실제로는 거짓인 **두 번째** 사례 (사전 존재, 이번 PR 이 신설하지 않음)
  - target 위치: `spec/5-system/3-error-handling.md` §1.3(약 254행) "이름은 `_NOT_FOUND` 지만
    404 가 아니다 — 이 저장소에서 유일한 예외다" (지목 대상 `AUTH_CONFIG_NOT_FOUND`, 400) ·
    `spec/5-system/1-auth.md` §5 API 엔드포인트 표(`PATCH`/`DELETE
    .../2fa/webauthn/credentials/:id` 행 — 코드명 미기재).
  - 위반 규약: `spec/conventions/error-codes.md` §1(도메인 코드는 도메인 spec 카탈로그에
    등재) 및 `spec/5-system/3-error-handling.md` §1.2.1·§1.3 의 카탈로그 완결성 관례.
  - 상세: `webauthn.service.ts` 는 이번 PR 이 새로 추출한 공용 헬퍼
    `throwCredentialNotFound()`(리팩터 커밋 `d3127c8a6`) 를 통해 `renameCredential()` ·
    `deleteCredential()`(둘 다 **404** `NotFoundException`) 두 자리가 `WEBAUTHN_CREDENTIAL_NOT_FOUND`
    를 던지고, 별도로 `verifyAuthentication()`(로그인 2FA 검증 단계, **401**
    `UnauthorizedException`)이 **같은 코드 문자열**을 던진다 — 직접 실측(diff + `grep -n
    "WEBAUTHN_CREDENTIAL_NOT_FOUND" codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
    로 4개 발행 지점 확인). 카탈로그 어디에도 이 코드가 등재돼 있지 않아 §1.3 의 "유일한
    예외는 AUTH_CONFIG_NOT_FOUND 하나" 라는 명시적 불변식이 실제로는 깨져 있다.
  - **이번 PR 이 만든 결함이 아니다** — 이 헬퍼 추출은 기존에 중복돼 있던 동일한 두 개의
    404 throw 문을 하나로 묶은 리팩터일 뿐이고, 401/404 이원화는 그 이전부터 프로덕션에
    존재했다. 다만 헬퍼의 새 JSDoc 이 그 이원성을 명시적으로 문서화해 코드 층에서는 오히려
    투명해졌다(§Rationale 참고 — 아래 "그 외 확인한 항목" 참조).
  - 처리 상태: `developer` 는 spec 쓰기 권한 밖이라 직접 고치지 않았고, 대신
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로
    신규 등재했다(근거 인용은 `review-citations.md` §2 를 따라 전체 경로
    `review/consistency/2026/09/21/17_39_06` W1 형태 — 준수). 이 항목은 (1) 카탈로그 등재
    (2) §1.3 문장을 "예외 최소 2건" 으로 정정 (3) `auth-configs.service.ts:148` 의
    `throwAuthConfigNotFound()` JSDoc 이 인용한 "유일한 예외" 문구 동시 정정을 요구한다 — 세
    갈래 모두 같은 턴에 묶여 있어 spec 정정과 코드 주석 정정이 따로 놀 위험을 스스로
    차단했다. **--impl-done 게이트는 BLOCK:NO 로 통과할 사안**(spec 미변경 PR 이 spec 결함을
    새로 만들지 않았고, 수정 권한도 developer 밖) — 다음 spec-sync 턴에서 집행 필요.

- **[INFO]** 동시 삭제 시 "두 번째 요청은 404" 관례가 `1-auth.md` §5 DELETE 행에 아직
  명문화되지 않음 — 의도적 유예, 이번 PR 범위 밖
  - target 위치: `spec/5-system/1-auth.md` §5 `DELETE .../credentials/:id` 행.
  - 위반 규약(대비 선례): `spec/2-navigation/2-trigger-list.md` 의 "동시 삭제: … 두 번째는
    `404 RESOURCE_NOT_FOUND`" 명시 패턴.
  - 상세: `spec-draft-nullable-notation-followups.md` 가 이 동시-삭제-9자리 계열 전체를
    "집행 시 그 시점의 해소된 코드 경로 기준으로 재열거" 하기로 이미 유예해 뒀고, 이번 PR 로
    9번째(마지막) 자리가 구현됨에 따라 트래커의 완결성 pass 항목에
    `5-system/1-auth.md §5(DELETE .../credentials/:id)` 가 실제로 추가됐다(diff 확인) — 형제
    8건과 동일한 처리로 일관성 있음.
  - 제안: 조치 불요 — 이미 정해진 재열거 절차를 그대로 따른다.

## 그 외 확인한 항목 (위반 없음)

- **명명 규약**: 신규 e2e 파일명 `webauthn-credential-delete-concurrency.e2e-spec.ts` 는 기존
  형제 8파일(`auth-config-delete-concurrency.e2e-spec.ts` 등)과 동일한
  `<domain>-delete-concurrency.e2e-spec.ts` 패턴을 따른다. 신규 private 헬퍼
  `throwCredentialNotFound(): never` 는 `workspaces.service.ts` 의 `throwMemberNotFound()`,
  `auth-configs.service.ts` 의 `throwAuthConfigNotFound()` 와 동일한 형태(grep 으로 실재 확인)
  — 코드베이스 관행과 일관.
- **출력 포맷 규약**: 신규 헬퍼가 던지는 `NotFoundException({ code, message })` 는
  `api-convention.md §5.3` 의 top-level `code` 교체 패턴(사유가 엔드포인트 결과 그 자체이고
  단일 사유)을 그대로 따르고, `details` 를 얹지 않아 "둘을 겹쳐 쓰지 않는다" 규칙과도 충돌
  없음. `affected === 0` 명시 비교로의 전환은 응답 바디 포맷에 영향 없음(내부 판정 로직).
- **명명 규약(감사)**: 이 diff 가 건드리는 흐름이 남기는 감사 액션 `user.2fa_disabled` 는
  `conventions/audit-actions.md` §2.1(과거분사)·§1(언더스코어 토큰) 과 일치하며 이미
  "구현" 상태로 레지스트리에 등재돼 있다(신규 액션 아님).
- **API 문서 규약(swagger.md)**: 이번 diff 는 컨트롤러·DTO·Swagger 데코레이터를 건드리지
  않는다(서비스 내부 private 메서드·판정 로직만 변경) — 데코레이터·JSDoc-공개 규칙 위반 표면
  자체가 없다. 신규 JSDoc(`throwCredentialNotFound`, `deleteCredential` 의 `@throws`)은
  DTO/컨트롤러가 아니라 서비스 private 메서드에 붙어 있어 `swagger.md §3`(응답 DTO JSDoc→
  OpenAPI description 대상) 범위 밖이다.
- **금지 항목(review-citations.md)**: 신규/변경 코드 주석이 인용하는 리뷰 산출물은 전부
  `review/code/2026/09/21/18_03_54` 류 전체 경로 또는 PR 번호(`#1369~#1375`) 형태로, §2 가
  금지하는 bare `hh_mm_ss` 형태가 없다. `plan/in-progress/...followups.md` 에 추가된
  `:498` 줄번호 인용은 `plan/**` 이 이 규약의 적용 대상이 아니므로(§3 표) 위반 아님.
- **문서 구조 규약**: 이번 PR 은 신규 spec 문서를 만들지 않았고 기존 `spec/5-system/1-auth.md`
  구조(Overview/본문/Rationale)에도 변경이 없다 — 3섹션 규칙·`0-`/`_product-overview.md`
  명명 규칙 대상 사건 없음.

## 요약

`webauthn-dup-delete` PR(3파일·393줄, 동시 WebAuthn credential 삭제 시 감사 로그 중복 기록
결함 수정)은 정식 규약(spec/conventions/**) 관점에서 신규 위반을 만들지 않았다. 유일한 실질
발견은 사전에 존재하던 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드 미등재·"유일한 `_NOT_FOUND`
예외" 불변식 위반이며, 이는 이번 PR 이 새로 만든 문제가 아니고(코드 추출 이전부터 프로덕션에
존재), developer 가 spec 쓰기 권한이 없어 직접 고칠 수 없는 사안이다. 처리는 규약이 요구하는
대로 이루어졌다 — planner 항목으로 정확한 근거(전체 경로 인용)와 함께 트래커에 등재했고,
동시-삭제 계열 완결성 pass 항목도 형제 8건과 동일하게 갱신했다. 명명(감사 액션·에러 코드
표기·e2e 파일명·private throw 헬퍼)·출력 포맷(에러 봉투 top-level code)·API 문서(Swagger 미접촉)
·인용 규약(review-citations.md) 은 전부 준수 상태다.

## 위험도

LOW
