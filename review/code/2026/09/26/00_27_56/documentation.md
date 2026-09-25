# 문서화(Documentation) 리뷰 — integration-personal-owner (4라운드)

## 발견사항

- **[INFO]** precheck DTO 의 두 필드 설명이 "conflict=true" 조건을 두 번 반복한다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:370, 375` (`PRECHECK_IDENTITY_MASKED` 정의는 같은 파일 344~346)
  - 상세: `existingIntegrationId` / `existingName` 의 Swagger `description` 은 템플릿 리터럴로
    `` `충돌 대상 통합의 UUID. conflict=true 일 때만 채워진다 ${PRECHECK_IDENTITY_MASKED}` `` 형태로 조립되는데,
    `PRECHECK_IDENTITY_MASKED` 자체가 다시 "conflict=true 여도 생략한다" 로 조건을 반복한다. 최종 문장은
    "conflict=true 일 때만 채워진다 — 다만 … conflict=true 여도 생략한다" 가 되어 읽는 사람이 "그럼 언제 채워지는가" 를
    한 번 더 계산해야 한다. 의미는 정확하고 깨진 것은 아니다 — 문체상의 군더더기.
  - 제안: `PRECHECK_IDENTITY_MASKED` 를 "다만 충돌 대상이 다른 멤버의 개인(personal) 통합이면 생략한다" 정도로 다듬어
    선행 문장과의 중복을 줄이면 Swagger UI 에서 더 매끄럽게 읽힌다. 급하지 않음.

- **[INFO]** 이 PR 이 닫는다고 선언한 트래커 항목의 체크박스가 아직 미체크
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5760` (변경 diff 에는 포함되지 않은 파일 — `.md` 예산 제외로 프롬프트에는 없었음, `Read` 로 직접 확인)
  - 상세: `plan/in-progress/integration-personal-owner.md` 본문이 "트래커 `spec-draft-nullable-notation-followups.md`
    항목 «personal-scope 통합의 «본인 것만» 소유자 검증이 코드에 없다» 를 닫는다" 라고 명시하는데, 그 트래커의 해당 항목은
    여전히 `- [ ]` 상태다. 코드 변경 자체(오늘 리뷰 대상)는 요구사항을 충실히 구현했고, 이 결함은 아니다 — 다만 CLAUDE.md
    관례("체크와 `complete/` 이동은 한 동작") 상 머지 확정 커밋에서 이 체크박스를 `[x]` 로 바꾸고 plan 을
    `plan/complete/` 로 옮기는 절차가 남아 있다는 점을 상기시킨다. 지금 라운드에서 놓치면 다음 세션이 이미 끝난 항목을
    다시 조사하게 된다.
  - 제안: 최종 커밋(리뷰 통과 후 마무리 커밋)에서 트래커 체크박스 갱신 + `plan/in-progress/integration-personal-owner.md`
    를 `plan/complete/` 로 이동하는 작업을 빠뜨리지 말 것.

## 관찰 (참고 — 조치 불요)

- `spec/2-navigation/4-integration.md` §8·§9.2·§9.4 앵커, `CHANGELOG.md` 최상단 Unreleased 항목, 두 언어(ko/en) MDX
  문서(`integration-management.mdx`/`.en.mdx`, `workspaces-and-members.mdx`/`.en.mdx`) 모두 이번 변경(Personal 가시성 ·
  Organization Admin 요구 · precheck 마스킹 · 콜백 재판정)을 정확하고 서로 어긋남 없이 반영한다. 새 Swagger
  `@ApiForbiddenResponse`/`@ApiNotFoundResponse` 문구(`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등)도 실제 라우트 가드(`@Roles('editor')`
  유무)·서비스 판정(`assertCanModify`/`requireModifiable`)과 대조해 봤을 때 신뢰할 수 있다.
- `integration-visibility.ts` · `integrations.service.ts` 의 새 private 헬퍼(`requireVisible` · `assertCanModify` ·
  `judgedRow` · `reloadOrNotFound` · `requireModifiable`)는 각각 "왜 이렇게 했는가"(compare-and-set 이유, `save()` 대신
  `update()` 를 쓰는 이유, 락 대신 조건부 쓰기를 택한 이유)까지 JSDoc 에 남겨 다음 사람이 재발견할 필요가 없다.
  `getUsages` 의 옛 주석("duplicate findById")도 `requireVisible` 호출로 바뀐 코드에 맞춰 갱신되어 있어 스테일하지 않다.
- `integration-oauth.service.ts` 의 `assertRequesterStillAllowed` JSDoc 은 `pending_install` 행을 보지 않는 이유(설치
  흐름의 `userId` 가 요청자가 아니라 생성자)까지 설명해 인라인 주석 요건을 충분히 충족한다.
- 신규 e2e(`integration-personal-owner.e2e-spec.ts`)와 owner 판정 완결성 캐너리(`integrations.controller.owner.spec.ts`)는
  헤더 JSDoc 에 보호 대상 invariant 를 명시적으로 나열해, 실패 시 원인 추적이 쉽다.
- CHANGELOG 항목은 관례(`CHANGELOG.md` 상단 기준)에 맞게 제품 동작 변화 · 에러 코드 변경(`FORBIDDEN`→`ADMIN_REQUIRED`) ·
  아직 강제되지 않는 범위까지 명시했다.

## 요약

이번 PR(4라운드)은 문서화 관점에서 결함이라 부를 만한 것이 없다. Swagger 데코레이터, JSDoc, CHANGELOG, 이중 언어 MDX
사용자 문서, spec 앵커가 모두 실제 코드 동작(가시성 404, Organization Admin 요구, precheck 마스킹, 콜백 재판정, 조건부
쓰기)과 정확히 맞물려 있고 오래된·모순된 주석도 발견되지 않았다. 남은 두 항목은 모두 INFO 수준으로, 하나는 문체적
군더더기(Swagger 설명 중복)이고 다른 하나는 코드 diff 밖의 plan 트래커 체크박스가 이 PR 의 완료를 아직 반영하지 않았다는
절차적 리마인더다.

## 위험도

NONE
