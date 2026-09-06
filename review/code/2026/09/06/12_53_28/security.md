# 보안(Security) 리뷰

## 개요

이 diff 는 `User` 엔티티 민감 컬럼(비밀번호 해시·2FA secret·복구 코드·계정 탈취용 토큰 등 7종)이
투영 없이 응답에 실리는 것을 잡는 **검출 인프라**(구조 축 `user-entity-exposure-guard.ts`,
값/이름 축 `user-secret-absence.ts`, JSDoc 정보 유출 축 `dto-jsdoc-citation-guard.ts`)와 그
소비 e2e, 그리고 이 검출망이 실제로 찾아낸 살아있는 유출(`WorkflowVersionsService.findOne` 이
`creator: User` 를 투영 없이 반환 — `GET /api/workflows/:wfId/versions/:versionId`)의 수정으로
구성된다. 이미 5차례의 `/ai-review` + `/consistency-check` 라운드를 거쳐 Critical 1건이
발견·수정됐고, 이번은 그 최종 누적 diff에 대한 리뷰다.

## 검증 방법

- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 를 직접 열어
  Critical 수정(`findOne` 에 `CREATOR_PROJECTION`(`{id,name,email}` 고정 상수) `select` 투영이
  적용됨)이 실제로 반영돼 있음을 확인. `findByWorkflow`/`findOne` 양쪽이 같은 상수를 공유한다.
- 컨트롤러(`workflow-versions.controller.ts`)가 두 엔드포인트 모두
  `assertWorkspaceOwnership` 를 조회 전에 호출함을 확인 — 인가 우회 없음.
- `user-entity-exposure-guard.ts`/`.spec.ts` 를 직접 읽고 양성/음성 fixture 가 모두 존재함을
  확인 — 이전 라운드에서 리뷰어가 술어를 무력화(`hasEagerDecorator → false`)했을 때 대조군이
  실패로 잡았다는 이력(RESOLUTION.md)과 현재 fixture 구성이 일치한다. 래칫이 vacuous 하지 않다.
- `USER_SECRET_KEYS` 7개를 `user.entity.ts` 실제 컬럼과 대조. `twoFactorSecret` 은 원문 저장(해시
  불가 — TOTP 검증에 원문 필요, `totp.service.ts` 로 확인), `emailVerifyToken`/
  `passwordResetToken`/`emailChangeToken` 은 SHA-256 해시로 저장(`auth.service.ts` 의
  `hashToken(...)` 사용처로 확인) — 목록 대상 선정이 실제 민감도와 부합한다.
- `WorkspacesService.listMembers` 를 확인 — `relations: ['user']` 로 `User` 전체를 메모리에
  로드하지만 반환 전 `email`/`name` 만 뽑아 새 객체로 매핑한다. wire 로는 새지 않는다(DB
  오버페치는 남아 있으나 응답 노출은 아님 — 이 PR 의 래칫이 이 자리를 "알려진 상태"로 동결).
- `git diff origin/main...HEAD -- codebase/` 전체에서 하드코딩된 API 키·패스워드·토큰 리터럴
  패턴을 grep — 0건. 새 fixture 는 전부 `'x'`/`'a@b.c'` 류 합성 값이다.
- `auth.service.ts` 의 `logout`/`refresh` 가 `relations: ['user']` 로 `User` 를 로드하는
  자리(가드의 `EXPECTED_USER_RELATION_LOADS` 화이트리스트에 있음)를 직접 열어, `stored.user.id`/
  `stored.user.email` 만 로그인 이력 기록에 쓰이고 응답으로 반환되지 않음을 확인.

## 발견사항

- **[INFO]** 신규 검출 가드 2종이 spec `§5.4` 「검증 층」`code:` 에 아직 등재되지 않아, 이 보안
  탐지 인프라 자체가 향후 약화돼도 `--impl-done` 재검토 게이트가 걸리지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `codebase/backend/src/shared/testing/user-secret-absence.ts` (기능 파일명으로 특정 — 두
    파일 모두 신규, spec 델타 없음)
  - 상세: 이 두 가드는 `User` 민감 컬럼 노출을 막는 사실상의 보안 회귀 방지선인데,
    `spec/5-system/2-api-convention.md` §5.4 표나 `spec/conventions/swagger.md`/
    `spec/5-system/1-auth.md` 의 frontmatter `code:` 어디에도 매칭되지 않는다. 이미
    `review/consistency/2026/09/06/10_13_23` 가 독립적으로 같은 것을 지적했고 developer 권한
    밖(`spec/` 쓰기)이라 `plan/in-progress/spec-draft-nullable-notation-followups.md:375`
    (`- [ ] **신규 검출 2축을 §5.4 「검증 층」과 code: 에 등재**`)에 planner 후속 항목으로
    정확히 등재돼 있고 이번 diff 에서도 그 상태(미체크)가 유지된다. 새로운 결함이 아니라
    이미 올바른 경로로 추적 중인 항목이므로 조치 요구는 아니지만, 보안 리뷰 관점에서
    "이 방어선의 존재를 보장하는 상위 계약이 아직 없다"는 사실 자체는 기록해 둔다.
  - 제안: 조치 불요(이미 planner 후속 등재됨). 해당 planner 턴에서 §5.4 표 + 두 spec 문서
    `code:` 갱신.

- **[INFO]** 이름 기반 시크릿 목록(`USER_SECRET_KEYS`, 7컬럼)이 자격증명·토큰류만 다루고,
  같은 엔티티의 계정 탈취 보조 정보(대기 중인 이메일 변경 요청, OAuth 연동 식별자)는 대상 밖이다
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` (`USER_SECRET_KEYS`
    상수) vs `codebase/backend/src/modules/users/entities/user.entity.ts` 의 `pendingEmail`·
    `oauthProviderId`·`emailVerifyExpiresAt`/`passwordResetExpiresAt`/`emailChangeExpiresAt`
  - 상세: 이 PR 이 스스로 "민감 **7컬럼**"으로 범위를 명시하고 실측(select:false/@Exclude/
    @Expose 0건)에 근거해 그 7개를 골랐다는 점에서 임의 누락은 아니다. 다만 `pendingEmail`(이메일
    변경 진행 중임을 드러내 계정 열거·소셜 엔지니어링에 쓰일 수 있음)이나 `oauthProviderId`(외부
    OAuth 계정 식별자, 연동 계정 하이재킹 시나리오의 보조 정보)는 자격증명 자체는 아니지만 계정
    보안과 무관하지 않다. 이 가드가 "마지막 방어선"으로 스스로를 소개하는 만큼, 향후 이 필드들이
    실수로 응답에 노출되는 경로가 생겨도 `expectNoUserSecrets` 는 잡지 않는다.
  - 제안: 조치 불요(현재 스코프의 의도적 결정으로 판단). 다만 이 필드들이 실제로 어느
    엔드포인트에서 응답에 노출되는지 향후 전수 열거할 기회가 있으면, 7컬럼 목록에 추가할지
    별도로 재검토할 가치는 있다.

## 요약

핵심 보안 결함(투영 없는 `User` 관계 로드로 인한 비밀번호 해시·2FA secret·복구 코드·탈취용
토큰 유출)은 이전 라운드에서 발견돼 이번 최종 diff 에 반영된 `CREATOR_PROJECTION` 투영으로
닫혀 있음을 코드를 직접 열어 확인했다. 이번 PR 자체는 런타임 동작을 바꾸지 않는 검출/테스트
인프라(AST 정적 가드 2종 + 응답 본문 이름 스캔 헬퍼 + e2e 배선)이고, 인젝션·인증 우회·하드코딩된
시크릿·안전하지 않은 암호화 패턴은 발견되지 않았다. 새 가드들은 양성/음성 fixture 를 갖추고
있어 vacuous 하지 않음을 이전 라운드의 뮤테이션 검증 이력과 대조해 확인했다. 유일한 잔여
사항은 이 새 방어선 자체가 spec `code:` 로 아직 등재되지 않아 미래의 약화를 재검토 게이트가
못 잡는다는 점인데, 이는 developer 권한 밖이라 이미 planner 후속으로 올바르게 위임돼 있다.

## 위험도

LOW
