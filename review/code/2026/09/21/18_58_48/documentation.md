# 문서화(Documentation) 리뷰 — WebAuthn 동시삭제 (아홉 번째/마지막 자리, 열 번째 리뷰 라운드)

## 사전 확인

이 diff 는 이미 두 차례 `/ai-review` 문서화 라운드를 거쳤다:

- `review/code/2026/09/21/18_03_54/documentation.md` — WARNING 2건(CHANGELOG 항목 부재,
  `deleteCredential()` JSDoc `@throws` 미기재) → `a20455447`·`d3127c8a6` 로 조치.
- `review/code/2026/09/21/18_31_57/documentation.md` — WARNING 2건(plan 트래커의 stale 줄 번호
  인용, CHANGELOG 취소선 절반 적용) → `ee6fd5d56`·`7b71e9a4a` 로 조치.

`CHANGELOG.md`·`webauthn.service.ts`·`webauthn.service.spec.ts`·
`spec-draft-nullable-notation-followups.md` 의 현재 HEAD 상태를 직접 열어 위 4건이 실제로
해소됐음을 확인했다(아래 "검증한 사항" 참고). 이번 라운드는 그 위에서 **새로 남은 것**만
찾는다.

## 발견사항

- **[WARNING]** 방금 고친 것과 같은 계열의 stale 줄 번호 인용이, 코드 자체의 JSDoc 에 **새로**
  남았다 — `plan/` 문서만 고치고 소스 주석은 놓쳤다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:512`
    (`throwCredentialNotFound()` 의 JSDoc, `` * **`verifyAuthentication`(:403)의 `UnauthorizedException`(401)과는 다른 자리다.** ``)
  - 상세: 커밋 `ee6fd5d56` 은 정확히 이 문제("편집 대상 파일을 줄 번호로 인용하지 말 것", 이
    저장소가 반복해 밟은 함정)를 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에서 고치면서 커밋 메시지에 "이 저장소가 반복해 밟은 함정의 재발이다" 라고 명시했다. 그런데
    같은 함정이 **바로 그 리팩터를 수행한 커밋(`d3127c8a6`)이 새로 써 넣은 JSDoc 자체**에도
    있다 — `throwCredentialNotFound()` 헬퍼의 JSDoc 이 `verifyAuthentication` 의 위치를
    `:403` 이라는 하드코딩된 줄 번호로 지목한다. 현재(`git grep -n` 확인 결과) `:403` 은 실제로
    `verifyAuthentication` 안의 `WEBAUTHN_CREDENTIAL_NOT_FOUND` `UnauthorizedException` throw
    문과 일치해 **지금은 정확**하다. 하지만 이 코드는 `plan/` 문서와 달리 `plan/complete/` 로
    아카이브되어 박제되는 게 아니라 계속 편집될 살아있는 소스 파일이다 — `verifyAuthentication`
    보다 앞쪽(예: 317번째 줄 이전)에 단 한 줄이라도 추가/삭제되면 이 JSDoc 의 `:403` 은 조용히
    틀린 줄(다른 throw 문이나 무관한 코드)을 가리키게 되고, 다음 사람은 이 PR 이 방금 고친 것과
    동일한 방식으로 오도된다. 메서드가 유일하므로 줄 번호 없이 메서드명만으로도 이미 충분히
    특정된다.
  - 제안: `` `verifyAuthentication`(:403) `` → `` `verifyAuthentication()` `` 로 줄 번호를
    제거한다(같은 파일 안에 동명 메서드가 없어 명확성 손실 없음). `plan/` 문서에 적용한 것과
    동일한 정정을 소스 JSDoc 에도 적용하는 것을 권장.

- **[WARNING]** 동일한 stale 인용 문구가 자매 plan 문서에는 그대로 남아 있다 — 한쪽만
  고쳐 저장소 내 같은 사실에 대한 서술이 서로 다른 신뢰도를 갖게 됐다.
  - 위치: `plan/in-progress/webauthn-dup-delete.md` — 체크리스트 항목
    `` `/consistency-check --impl-prep spec/5-system` `` 아래
    (`` `webauthn.service.ts:403` 이 `UnauthorizedException`(**401**), `:497`·`:504`·`:527` 이 **404**(직접 실측). ``)
  - 상세: 이 문장은 `spec-draft-nullable-notation-followups.md` 에서 `ee6fd5d56` 이 정정하기
    **전**과 글자 그대로 같은 인용(`:403`·`:497`·`:504`·`:527`)을 담고 있는데, 이 파일은 고쳐지지
    않았다. 다만 이 자리는 followups.md 의 그것과 성격이 다르다 — followups.md 쪽은 다음 사람이
    실제로 그 줄을 열어 조치하도록 유도하는 **실행 항목**(planner 후속 조치 대상)이라 stale
    인용이 곧바로 헛수고로 이어지지만, 여기(`webauthn-dup-delete.md`)는 `/consistency-check
    --impl-prep` 가 그 시점에 무엇을 실측했는지 기록한 **완료된 체크리스트 항목**(이미 `[x]`)이라
    CHANGELOG 의 "판별력 실측" 문단들과 같은 성격의 시점 고정 기록으로 볼 여지도 있다. 그럼에도
    같은 세션이 같은 문장을 두 곳에 복제해 두고 한쪽만 "저장소가 반복해 밟은 함정" 이라며
    고치고 다른 쪽은 그대로 둔 것은 비일관적이다 — 이 plan 문서는 체크리스트 마지막 항목대로
    곧 `plan/complete/` 로 이동될 예정이라 완료 문서가 되면 더더욱 손댈 유인이 사라진다.
  - 제안: 필수는 아니나(historical 기록으로 방어 가능), 일관성을 위해 이 문장 뒤에도
    "(리팩터 전 기준, 커밋 `d3127c8a6` 이후 줄 배치 변경됨)" 같은 시점 명시를 짧게 추가하거나,
    `plan/complete/` 이관 시 함께 정정할 것.

- **[없음]** 핵심 문서화 변경(CHANGELOG 신규 항목, `deleteCredential()`/`throwCredentialNotFound()`
  JSDoc, 인라인 주석, 신규 단위·e2e 테스트 docblock)은 실제 구현·실측과 정확히 일치함을
  직접 대조로 확인했다.
  - 상세:
    - `CHANGELOG.md:3-47` 신규 WebAuthn 항목의 "판별력 실측"(둘 다 204→감사 2건, 고친 후
      `[204,404]`→감사 1건) 서술은 `RESOLUTION.md`·e2e 테스트 내용과 일치.
    - `CHANGELOG.md:90-94`(`model_config` 섹션)·`:133-139`(`auth_config` 섹션)의 "남는 것"
      전방 참조 두 곳 모두 이제 완전히 취소선 처리되고 "해소" 각주가 붙어, 이전 라운드
      WARNING(절반만 취소선)이 실제로 해소됐다.
    - `webauthn.service.ts:517-522`(`throwCredentialNotFound()`)는 `renameCredential` 2곳+
      `deleteCredential` 2곳, 총 네 호출부를 정확히 서술("네 곳이 공유한다") — `grep -n
      this.throwCredentialNotFound` 로 4건 확인.
    - `webauthn.service.ts:524-532`(`deleteCredential()` JSDoc)의 `@throws` 태그와 "동시 삭제
      두 건이 겹쳐 진 쪽이 이미 지워진 행을 찾을 때(404)" 서술은 바로 아래 구현(`affected===0`
      분기)과 일치.
    - `webauthn.service.spec.ts:509-561`(`describe('동시 삭제')`)의 docblock은 형제
      회귀(#1369~#1375)와 이 자리가 다른 두 축(이미 `.delete()` 사용, 감사가 컨트롤러 소재)을
      정확히 서술하고, `webauthn.controller.spec.ts` 의 실제 테스트 제목("does not record an
      audit log when deleteCredential throws")을 정확히 인용함을 확인.
    - `webauthn-credential-delete-concurrency.e2e-spec.ts:9-26`·`:120-149` 의 두 docblock은
      각각 결함 재현 시나리오와 WARNING #4 반증 순서 논증을 정확히 서술하며, 후자는 "공허성
      가드 없이는 우연한 순차 실행도 초록이 될 수 있다"(18_31_57 testing WARNING)는 지적까지
      본문에 반영해 자기 완결적이다.
  - 새 환경변수·설정·API 엔드포인트·README 대상 변경은 없음(순수 서비스 내부 로직 + 테스트 +
    문서 커밋).

## 요약

핵심 코드 변경(`deleteCredential()` 의 `affected===0` 판정, `throwCredentialNotFound()` 헬퍼
추출)과 이를 뒷받침하는 문서(CHANGELOG, JSDoc, 테스트 docblock)는 이전 두 라운드가 지적한
WARNING 4건(CHANGELOG 누락, `@throws` 미기재, 취소선 절반 적용, plan 트래커 stale 줄 번호)을
모두 정확히 해소했음을 직접 대조로 확인했다. 다만 정정 작업 자체가 새로운 문서 불일치를
하나 남겼다 — "줄 번호로 편집 대상 파일을 인용하지 말라" 는 교훈을 `plan/` 문서 한 곳에는
적용했지만, 같은 리팩터 커밋(`d3127c8a6`)이 직접 써 넣은 소스 JSDoc(`webauthn.service.ts:512`)
자체와 자매 plan 문서(`webauthn-dup-delete.md`)에는 적용하지 않아 같은 함정이 두 곳에 남았다.
둘 다 기능에는 영향이 없고 현재 시점 기준으로는 사실관계가 틀리지 않았지만, 소스 JSDoc 쪽은
향후 편집으로 조용히 stale 해질 실질적 위험이 있어 WARNING 으로 표기한다.

## 위험도

LOW
