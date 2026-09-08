# Rationale 연속성 검토 — spec/5-system/ (--impl-done, 6회차)

## 검토 개요

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 자체의 파일 델타: **0** — `git diff origin/main...HEAD --stat -- spec/` 무출력.
  developer/harness 전용 배치이므로 정상, CRITICAL 근거 아님.
- 본 라운드는 **동일 diff 계열에 대한 6번째 연속 검토**다(`12_21_11`→NONE, `13_22_38`→LOW,
  `13_34_30`→LOW, `14_01_57`→NONE, `14_29_13`→NONE). 직전 라운드(`14_29_13`, 14:29) 이후
  신규 커밋은 `76bd51aab`(14:49) **1건뿐**이다.
- 실측(`git show 76bd51aab --stat`): 건드린 파일은 `source-scan.spec.ts`(신규 테스트
  4건 — `enclosingScopeName` 세 갈래 직접 관측), `workspace-rbac.e2e-spec.ts`(JSDoc 정정),
  `tsconfig.build.json`(exclude 주석 정정), `plan/in-progress/spec-followups-batch-b.md`,
  나머지는 `review/code/2026/09/08/14_29_12/**`(직전 코드 리뷰 산출물). **프로덕션 코드
  변경 0줄** — 커밋 메시지 자체가 "프로덕션 코드 0줄" 이라 명시하고, 실측 diff 로도 확인됨.

## 항목별 대조 (신규 확인분)

### 신규 커밋 = 문서/주석 정정, Rationale 접점 없음 또는 정합 보강

`76bd51aab` 은 코드 리뷰 4라운드(`14_29_12`, Critical 0 · Warning 3)가 지적한 "주석·JSDoc
의 근거 서술이 실측과 어긋난다" 류 세 건을 처리한다.

1. **`tsconfig.build.json` exclude 주석 정정** — "devDependency 를 끌어오지 않는다" 는
   기존 사유를 같은 배치의 이전 커밋(`source-scan.ts` 의 `import * as ts from 'typescript'`
   승격)이 반증했으므로, 원문을 취소선으로 남기고 정정문을 추가했다. 빌드 안전성 자체는
   `production-build-devdep-guard.ts` 의 디렉터리 단위 차단이 계속 담당한다는 것도 함께
   적었다 — CLAUDE.md 의 "자기-반증형 소정정" 5조건과 유사한 정정 패턴(단, 여기는 `spec/`
   이 아니라 `codebase/` 내부 주석이라 그 조항 자체의 적용 대상은 아님). `spec/5-system/`
   Rationale 과 직접 접점 없음 — **대상 외**.
2. **`workspace-rbac.e2e-spec.ts` JSDoc 정정** — "`listMembers` 가 `relations:['user']`
   로 전부 싣는다" 는 옛 서술을 취소선으로 남기고, "DB 레벨 `select` 투영으로 전환되었고
   이 e2e 는 2차 방어선으로 역할이 바뀐다" 는 정정을 추가했다. **실측 확인**:
   `workspaces.service.ts` 의 `listMembers` 쿼리에 `select: { ..., user: { id, email,
   name } }` 가 실제로 있고(선행 라운드부터 존재), `user-entity-exposure-guard.ts` 의
   화이트리스트 주석에도 "`listMembers` 는 2026-09-08 에 DB 레벨 `select` 투영으로 옮겨져
   이 목록에서 빠졌다" 는 기계적 증거가 있다. 정정 내용이 코드 실태와 일치 — `spec/1-
   data-model.md` Rationale("응답 경계 투영 + 검출 2축")과 어긋나지 않고, 오히려 그
   원칙을 쿼리 레벨까지 강화한 것을 문서가 뒤늦게 따라잡은 것이다. **정합 보강, 위반
   없음**.
3. **`enclosingScopeName` 신규 테스트 4건** — 순수 테스트 추가(behavior 불변, assertion
   보강). Rationale 접점 없음.

## 기존 라운드 항목 재확인 (변경 없음)

- `WorkspacesService.listMembers` 쿼리 레벨 `select` 투영, 트리거 `endpointPath` 409
  응답 형태(§1.10/§5.3), `http-exception.filter.ts` → `isPostgresUniqueViolation` 전환,
  `WorkflowVersionDetail` → `…Projection` 개명 — 선행 5라운드에서 전수 대조 완료, 이번
  라운드까지 코드 실질 변경 없음(신규 diff 는 문서/테스트에 한정). 결론 동일: 기각된
  대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 없음.
- 쿼리 범위 `select` 투영 패턴을 `spec/1-data-model.md` Rationale 표에 정식 등재하는
  안건은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner
  담당 오픈 항목으로 등재돼 있음(선행 라운드 확인). 이번 라운드도 같은 상태 — 재기표하지
  않음.

## 발견사항

없음 — 이번 라운드에 새로 열 항목이 없다. 유일한 변경(`76bd51aab`)은 프로덕션 코드 0줄의
문서/테스트 정정이며, 정정 내용 자체가 기존 Rationale 원칙(응답 경계 투영 + 검출 2축)과
일치함을 실측으로 확인했다.

## 요약

6번째 연속 검토에서도 결론은 변하지 않는다. 이번 라운드가 다루는 유일한 신규 변경(`76bd51aab`)
은 코드 리뷰 4라운드가 지적한 "주석 근거가 실측과 어긋난다" 류 세 건을 정정한 문서/테스트
커밋으로, 프로덕션 코드는 한 줄도 바뀌지 않았다. 정정된 서술(특히 `listMembers` 의 DB 레벨
투영 전환)은 `spec/1-data-model.md` `## Rationale` 이 채택한 "응답 경계 투영 + 검출 2축"
원칙과 충돌하지 않고 오히려 그 원칙이 실제로 쿼리 레벨까지 확장 적용됐음을 뒤늦게 문서에
반영한 것이다. `spec/5-system/`(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)
및 교차 인용 spec(`1-data-model.md`·`2-trigger-list.md`)의 기존 Rationale 이 확정한 결정·
원칙 중 어느 것도 기각된 대안으로 되돌리거나, 원칙을 위반하거나, 새 근거 없이 번복하지
않는다.

## 위험도

NONE
