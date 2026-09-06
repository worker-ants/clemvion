# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 새 e2e 테스트가 같은 파일 안에서 이미 쓰인 레터 `F.` 를 재사용한다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 신규 `it('F. GET /:id/members — 멤버 목록에 \`User\` 비밀 컬럼이 실리지 않는다', ...)` (게이트 287) vs 기존(변경 없음) `it('F. sole owner 는 leave 불가 — 403 SOLE_OWNER_CANNOT_LEAVE', ...)` (전체 파일 컨텍스트 382)
  - 상세: 이 파일은 각 `it()` 제목을 `A.`~`I.`, `S.` 레터로 시작해 "보호 대상 invariant" 를 식별하는 관례를 쓴다(파일 헤더 docstring "보호 대상 invariants" 참조, 실제로 케이스 A 의 주석이 "위 테스트 A는…" 식으로 자기 참조한다). 신규 케이스가 `E`(변경 없음, 아래에 위치) 바로 앞에 삽입되며 이미 뒤쪽에서 쓰이고 있는 `F` 를 그대로 재사용해, 파일 안에 `F.` 로 시작하는 `it()` 가 **두 개** 존재한다(`grep -n "it('[A-Z]\." workspace-rbac.e2e-spec.ts` 로 확인: 287·382 두 곳). 테스트 실행 자체는 깨지지 않지만, 이 레터가 코멘트·리뷰·plan 문서에서 "테스트 F" 같은 식으로 참조되는 식별자 역할을 하므로 혼동을 만든다.
  - 제안: 신규 테스트 레터를 다음 미사용 레터(`J.`)로 바꾼다.

- **[WARNING]** 신규 검출 가드 2쌍이 어떤 spec 의 `code:` frontmatter 에도 등재되지 않았다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` / `user-entity-exposure.spec.ts` / `codebase/backend/src/shared/testing/user-secret-absence.ts` / `user-secret-absence.spec.ts` (전부 신규 파일 — 함수명: `findUserRelationLoads`, `findUserSecretLeaks`)
  - 상세: 같은 세션의 직전 커밋(`21182db02`, 이 PR 이 기반한 브랜치)이 정확히 같은 이유로 형제 검증자 `swagger-dto-contract-guard.ts`·`response-contract.ts`·`swagger-probe.ts` 를 `spec/5-system/2-api-convention.md` frontmatter `code:` 에 등재했다(§5.4 "검증 층" 소절 신설과 함께) — 그래야 이 파일들을 고쳐도 `--impl-done` SPEC-CONSISTENCY 게이트가 문다는 것이 그 등재의 명시적 근거였다. 이번에 추가된 `user-entity-exposure-guard.ts`/`user-secret-absence.ts` 는 성격상 완전히 같은 부류(감사 로그 26키 유출을 계기로 세운 회귀 방지 검출기)인데, `grep -rln "^code:" spec | xargs grep -l "user-entity-exposure\|user-secret-absence"` 결과 0건이다. 두 파일을 덮는 기존 glob 도 없다(`swagger-dto-contract*.ts`/`response-contract*.ts`/`swagger-probe*.ts` 는 파일명이 다르다). 또한 이 검출 전략("구조는 AST 로, 결과는 이름으로") 자체를 설명하는 `spec/conventions/` 문서 항목도 없다 — 현재 근거는 CHANGELOG.md·plan/in-progress·인라인 JSDoc 세 곳뿐이고 전부 `spec/` 밖이다. 결과적으로 이 두 가드를 앞으로 무르게 고쳐도(예: `USER_SECRET_KEYS` 축소, AST 술어 완화) 어떤 spec 게이트도 걸리지 않는다.
  - 제안: `secret-store.md` 또는 `spec/5-system/2-api-convention.md` §5.4 "검증 층" 표에 이 두 가드를 나란히 등재하고, 대응 spec 파일 frontmatter `code:` 에 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts` · `codebase/backend/src/shared/testing/user-secret-absence*.ts` 를 추가한다. (등재 자체는 CLAUDE.md 상 `spec/` 쓰기이므로 planner 턴 — 이 PR 범위 밖이면 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 후속 체크리스트에 새 항목으로만 남겨도 된다.)

- **[INFO]** 같은 실측 수치가 4곳에 그대로 복제돼 있다
  - 위치: `CHANGELOG.md`(§"전수 열거가 두 선택지를 다시 그렸다" 표) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(완료 노트 표) · `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`(파일 헤더 docstring) · `codebase/backend/src/shared/testing/user-secret-absence.ts`(파일 헤더 docstring) — "19곳" · "46곳" · "3곳" · "0건" 등 동일 표가 4번 반복
  - 상세: 오늘 시점(2026-09-06)엔 4곳 모두 서로 일치함을 확인했다(`relations:['user']` 실측 3곳·`leftJoinAndSelect`/`innerJoinAndSelect` 0곳을 grep 으로 재검증, `audit-logs.service.ts` 가 `leftJoin`+`addSelect` 준수 형태로 이미 고쳐져 있음도 확인). 다만 이 수치들이 향후 바뀌면(예: 서비스 파일이 늘거나 깔때기 호출 지점이 늘면) 4곳을 전부 손으로 갱신해야 하는데, 이 PR 의 plan 문서 자체가 다른 항목에서 "숫자를 지금 갱신하면 또 낡는다" 는 교훈을 반복해서 남기고 있다(§후속 "find → toBeDefined → assert" 항목).
  - 제안: 정정이 필요한 시점이 오면 4곳 전부를 갱신 대상으로 인지하도록, 가드 파일 docstring에 "이 수치가 바뀌면 CHANGELOG.md 의 동일 표도 갱신" 같은 상호 참조를 남기는 정도로 충분 — 지금 당장 구조를 바꿀 필요는 없다.

## 요약

이번 변경은 문서화 품질이 전반적으로 높다 — CHANGELOG 항목, plan 완료 노트, 신규 가드/헬퍼의 JSDoc 모두 "왜 이 방법을 택했는가" 를 실측치와 함께 촘촘히 남겼고, 교차 검증한 결과(`relations:['user']` 3곳·`leftJoinAndSelect` 0곳·`audit-logs.service.ts` 의 준수 형태·`joinedAt` 상시 실림·`nullable-type-lie-cast-guard.ts`/`swagger-dto-contract-guard.ts` 형제 참조 등) 서술이 코드와 정확히 일치했다. 다만 두 가지는 짚어야 한다: (1) 새 e2e 케이스가 이 파일의 레터 식별 관례를 깨고 기존 `F.` 를 재사용해 두 케이스가 같은 레터를 공유하게 됐고, (2) 신규 검출 가드 2쌍이 바로 직전 커밋이 세운 "§5.4 검증자는 spec `code:` 에 등재한다" 선례를 따르지 않아, 이 가드들이 앞으로 무르게 바뀌어도 spec 게이트가 잡아내지 못하는 사각지대가 생겼다. 둘 다 이 PR 의 정확성을 해치지는 않지만 후속 유지보수성에 영향을 준다.

## 위험도
LOW
