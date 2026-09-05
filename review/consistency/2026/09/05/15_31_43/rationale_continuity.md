# Rationale 연속성 검토 — `spec/5-system/` (impl-done, 2026-09-05 15:31:43)

## 조사 방법

이 검토는 `--impl-done` 모드이고 scope(`spec/5-system/`)의 spec 델타는 0개다. 프롬프트에
번들된 diff 섹션(`## 구현 변경 사항`)이 컨텍스트 예산으로 완전히 잘려 있어(헤더 자체가
프롬프트에 없음), 워킹트리에서 직접 diff 를 재취득했다:

```
git diff origin/main -- codebase/   # 8 files changed, 945 insertions(+), 6 deletions(-) — 1129줄, 프롬프트가 예고한 수치와 일치
```

대조 대상은 프롬프트에 번들된 `spec/5-system/1-auth.md`·`2-api-convention.md`·
`3-error-handling.md` 의 `## Rationale` 전문 + 관련 발췌 9개 문서, 그리고 예산 밖에 있던
`spec/data-flow/1-audit.md`·`spec/conventions/swagger.md` 를 직접 열어 보강했다. `plan/`
디렉터리의 관련 변경(`spec-conventions-engine-error-code-surface.md`,
`spec-draft-nullable-notation-followups.md`)과 `CHANGELOG.md` 항목도 배경으로 확인했다.

## 변경 내역 요약

1. `audit-logs.service.ts` — `findAll` 의 `leftJoinAndSelect('al.user','user')` (User 엔티티
   전 26컬럼 select) → `leftJoin` + `addSelect(['user.id','user.name','user.email'])` (광고된
   3필드만). 반환 타입도 `AuditLogListItem` 으로 좁힘. 실제로 `passwordHash`·
   `twoFactorSecret`·복구 코드·재설정/변경 토큰이 응답에 새고 있었다는 실측(CHANGELOG 항목)에
   대한 수정이다.
2. `src/shared/testing/response-contract.ts` (+spec) — "실제 응답 1건 vs 선언된 OpenAPI DTO
   스키마" 를 일반적으로 대조하는 신규 테스트 헬퍼. `$ref`/`allOf`/`oneOf`/`anyOf` 를 따라
   중첩 DTO 로 내려간다.
3. 4개 e2e 스펙(`audit-logs`·`session-revocation`·`workflow-crud`·`workflow-execution`)에
   `assertMatchesContract` 배선.

## 발견사항

검토 관점 4가지(기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 전부에
대해 대조한 결과, **spec Rationale 과 충돌하는 항목을 찾지 못했다.**

- **기각된 대안의 재도입 — 해당 없음.** 오히려 반대 방향이다. `response-contract.ts` 최상단
  주석은 "반환 타입을 DTO 로 명시하는 안은 실측으로 반증됐다"고 적는데, 이는
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 2026-09-04자로 이미 확정한
  결정(엔티티↔DTO 전수 대조 59건 중 46건이 `Date→string` 무해 오탐)을 **그대로 승계**한
  것이지, 그 결정을 재론하며 되돌리는 것이 아니다.
- **합의된 원칙 위반 — 해당 없음.** `spec/conventions/swagger.md` §"§1-6 numeric 와이어 타입 —
  가드와 규약의 책임 분리" Rationale 이 세운 "정적으로 판별 가능한 갈래는 가드, 사람 판단이
  필요한 갈래는 별도 도구" 분업 원칙과 이 신규 헬퍼의 위치(런타임 응답 대조, 기존
  `swagger-dto-contract.spec.ts` 정적 가드와 공존)가 정확히 부합한다. `2-api-convention.md`
  §5.4 의 "요청 tri-state 는 소급 대상 아님", "옵셔널+nullable 조합은 응답 계약이 아니다"
  같은 예외도 `response-contract.ts` 주석에 그대로 반영돼 있다(표 넷째 행 — "그 조합은 이
  도구가 판정할 대상이 아니다").
- **결정의 무근거 번복 — 해당 없음.** `audit-logs.service.ts` 의 `leftJoinAndSelect` 제거는
  spec 문서가 컬럼 단위 join 형태를 규정한 적이 없어(§data-flow/1-audit.md §2.1 은 "응답에
  actor `user` join 포함"만 서술, 필드 목록 없음) 뒤집을 기존 결정 자체가 없다. 오히려 진단
  주석이 `workspaces.service.ts` 의 기존 명시 매핑 선례를 인용해 정합성을 높이는 방향이다.
- **암묵적 가정 충돌 — 해당 없음.** `visitUnion`(oneOf/anyOf 아래 required 미강제)은
  `swagger.md` "`discriminator` 는 판별자가 sound 할 때만" Rationale 이 세운 "판별 불가능한
  union 은 약한 판정만" 원칙과 일치한다.

발견된 것은 CRITICAL/WARNING 이 아니라 **INFO 성격의 확인 사항**뿐이다:

- **[INFO]** `response-contract.ts` 가 아직 `spec/2-api-convention.md` frontmatter `code:`
  glob 에 등재되지 않은 것은 diff 자체가 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에 developer 권한 밖(planner 대상) 항목으로 등재해 뒀다 — 별도 지적 불필요, 정상 처리 경로.

## 요약

이 PR 은 spec Rationale 을 재도입·번복·우회하지 않는다. 오히려 이전 라운드
(`review/code/2026/09/05/14_39_31`, `15_12_02`)에서 이미 검토·확정된 방향("반환 타입 명시
방식은 반증됨 → 응답 대 DTO 선언 일반 대조 헬퍼로 대체")을 그대로 완결하는 작업이며,
`spec/2-api-convention.md` §5.4·`spec/conventions/swagger.md` 의 정적/런타임 책임 분리
Rationale 과 정합한다. `audit-logs.service.ts` 의 필드 축소도 기존 spec 이 규정한 바 없는
버그 수정으로, 유사 선례(`workspaces.service.ts`)와 일치하는 방향이다. Rationale 연속성
관점에서 문제 삼을 지점이 없다.

## 위험도

NONE
