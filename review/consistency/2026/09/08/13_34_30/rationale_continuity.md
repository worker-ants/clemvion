# Rationale 연속성 검토 보고서 (--impl-done)

## 검토 개요

- 대상 spec 영역: `spec/5-system/` — scope 델타 **0개 파일** (이 브랜치는 spec 본문을 바꾸지 않음. 코드 전용 PR 이므로 정상, CRITICAL 근거 아님)
- 실제 구현 diff: `git diff origin/main...HEAD -- codebase/` 로 절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/spec-followups-batch-b-7c31ad`)에서 직접 재확인 — 16개 파일(1042줄): `http-exception.filter.ts`(+spec) · `integration-oauth.service{,.cafe24,.makeshop}.spec.ts` · `workflow-versions.service.ts` · `workspaces.service.{ts,spec.ts}` · 신규 가드 3파일(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture) · `production-build-devdep.spec.ts` · `user-entity-exposure.spec.ts` · `webhook-trigger.e2e-spec.ts` · `tsconfig.build.json` · frontend `workflows.ts`
- 대조 대상 Rationale: `spec/1-data-model.md`(User 민감 컬럼 방어), `spec/5-system/2-api-convention.md`(§5.3/§5.4 에러 형태, 검증 층 표), `spec/5-system/3-error-handling.md`(§1.10, §6.3.1)
- 참고: 동일 diff에 대한 선행 라운드 검토가 이미 두 건 존재한다 — `review/consistency/2026/09/08/12_21_11/rationale_continuity.md`(--impl-prep, 위험도 NONE), `review/consistency/2026/09/08/13_22_38/rationale_continuity.md`(--impl-done, 위험도 LOW). 본 라운드는 그 이후 커밋(`05b899d1f` plan/docs만 수정, spec 무영향)까지 포함해 코드 diff 가 실질적으로 변하지 않았음을 확인하고 독립 재검증했다.

## 항목별 대조

### 1. `WorkspacesService.listMembers` 쿼리 레벨 `select` 투영 — `spec/1-data-model.md` Rationale 대조

`spec/1-data-model.md`의 "`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계에 둔 이유 (2026-09-06)"는 세 안을 놓고 **엔티티 전역 `@Column({select:false})`를 명시적으로 기각**했다(내부 소비 경로가 값을 직접 읽으면 fail-silent). 이번 diff 는 `workspaces.service.ts`에 `memberRepository.find({ select: { id, userId, role, joinedAt, user: {id,email,name} } } })`를 추가했는데, 이는 **엔티티 레벨이 아니라 단일 쿼리 범위의 관계 select 투영**이다. 코드 주석 자체가 "엔티티 전역 `select: false` 와는 다른 것이다 … 이것은 이 쿼리 하나의 투영이라 다른 경로를 건드리지 않는다"고 그 구분을 명시하고, 실측(`user.entity.ts`에 `select:false`/`@Exclude()` 0건)도 유효하다. 오히려 같은 Rationale 문서가 "`WorkflowVersionsService.findOne` 이 그 목록(로드 형태 축이 못 잡는 사례)의 항목들이 지향할 형태"라고 이미 명시해 둔 방향과 정확히 같은 패턴이다. **기각된 대안의 재도입이 아니라 채택된 원칙("응답 경계 투영 + 검출 2축")의 연장.**

### 2. 트리거 `endpointPath` 409 응답 형태(`webhook-trigger.e2e-spec.ts` B4, `endpoint-path-conflict-wrap` 가드) — `3-error-handling.md §1.10` / `2-api-convention.md §5.3` 대조

새 e2e(B4)는 `error.code = RESOURCE_CONFLICT`(top-level 상태 기본값 유지) + `error.details = { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`(객체 형태)를 단언한다. 이는 `2-api-convention.md`의 "top-level `code` 교체 vs `details[].code`" 결정표가 `TRIGGER_ENDPOINT_PATH_CONFLICT`를 **`details[].code`(top-level 상태 기본값 유지)** 선례로 정확히 등재해 둔 것과 일치한다. `endpoint-path-conflict-wrap` AST 래칫(모든 `triggerRepository.save()`가 래핑됐거나 명시적으로 예외 목록에 있어야 함)도 같은 계약의 커버리지 보강이지 새 계약이 아니다. `JSON.stringify(dup.body)).not.toContain('duplicate key')` 단언은 `3-error-handling.md §6.3.1`이 REST 봉투 경로에 "내부 구현 원문 echo 조건 없이 금지"라고 못박은 것과 부합한다. **충돌 없음.**

### 3. `http-exception.filter.ts` → `isPostgresUniqueViolation`/`pgErrorConstraint` SoT 전환

기존 로컬 `isUniqueViolation`은 `QueryFailedError`로 감싼 표면만 검사해 raw `err.code==='23505'` 표면을 놓치고 있었다(500 오분류). `pg-error.ts` SoT(이미 origin/main에 존재, 이 브랜치가 신설한 것 아님)로 교체해 두 표면을 모두 커버한다. 이 지점을 명시적으로 다루는 선행 Rationale은 존재하지 않는다 — 즉 "뒤집는 대상이 되는 과거 결정"이 없으므로 무근거 번복에 해당하지 않는다(단순 누락 fallback 수정). CHANGELOG 항목이 실측 blast radius(0)까지 기록해 근거를 남겼다.

### 4. `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명(backend) / frontend 미러 갱신

`spec/1-data-model.md` Rationale 은 `WorkflowVersion.snapshot` 구성만 다루고 이 DTO 명명·공유 타입 승격 정책과는 무관하다. 코드 주석 자체가 "왜 공유 패키지화 대신 개명만 했는가"(wire 계약 차이 — `creator` nullability, `createdAt` 타입)를 논증하고 있어, 결정 번복이 아니라 신규 결정에 대한 자체 근거(코드 JSDoc)를 갖췄다. spec Rationale 과 접점이 없어 위반 소지 없음.

### 5. 그 외 (`production-build-devdep.spec.ts`, `tsconfig.build.json` exclude, `.claude/test-stages.sh`/`PROJECT.md`)

harness/빌드 설정 변경으로 `spec/5-system/` Rationale 을 참조·번복하지 않는다. 대상 외.

## 발견사항

- **[INFO]** 쿼리 범위 DB-레벨 `select` 투영 패턴이 두 번째 사례로 굳어졌는데도 `spec/1-data-model.md` Rationale 표에 아직 정식 등재되지 않음 (선행 두 라운드에서도 동일 지적, 미반영 상태 유지)
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`, `select:{...}` 투영) / `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` (표 갱신 주석)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계에 둔 이유 (2026-09-06)" 결정표(① 컬럼 `select:false` 기각 / ② DTO 단독 손좁힘 기각 / ③ 응답 경계 투영+검출 2축 채택)
  - 상세: 이번 변경은 ①의 재도입이 **아니며**, 코드 주석이 그 구분을 스스로 논증하고 실측도 뒷받침한다(따라서 CRITICAL/WARNING 대상 아님). 다만 "단일 쿼리 범위 DB-레벨 `select` 투영"이 `WorkflowVersionsService.findOne`에 이어 `listMembers`까지 **두 번째** 적용 사례가 되었고, 가드 주석(`user-entity-exposure.spec.ts`)은 이를 "목록 항목이 지향할 형태"라고 사실상 공식화했다. 그런데 이 패턴 자체는 `spec/1-data-model.md` 결정표 3항 어디에도 이름 붙여 등재돼 있지 않다 — 근거가 코드 주석에만 흩어져 있다. 표 문구("컬럼을 값 소비 경로에서 좁힌다")만 읽는 미래 검토자는 이를 ①(기각)의 재도입으로 오판할 위험이 여전하다. 이 지적은 `12_21_11`·`13_22_38` 두 선행 라운드에서 이미 제기됐으나 이후 커밋(`05b899d1f`)이 다룬 것은 별개 항목(`spec_impact` 오기·bare 인용)이라 이 INFO는 아직 미반영 상태다.
  - 제안: `spec/1-data-model.md` `## Rationale`의 해당 항목에 "쿼리 범위 DB-레벨 `select` 투영(엔티티 전역 `select:false`와 구분)"을 4번째 채택 옵션 또는 ③의 명시적 하위 각주로 등재하고 `WorkflowVersionsService.findOne`·`WorkspacesService.listMembers` 두 사례를 근거로 인용. `spec/` 쓰기 권한은 `project-planner` 소관이므로, 이 배치의 developer 턴 자체를 막을 필요는 없고 후속 spec 정리 턴에서 반영하면 된다.

## 요약

이번 --impl-done 대상 diff(16개 파일/1042줄)를 `spec/1-data-model.md`·`spec/5-system/2-api-convention.md`·`spec/5-system/3-error-handling.md`의 `## Rationale`과 전수 대조한 결과, 기각된 대안의 무단 재도입, 합의된 설계 원칙 위반, 근거 없는 결정 번복, 시스템 invariant 우회는 발견되지 않았다. `listMembers` 투영과 트리거 409 응답 형태는 오히려 기존 Rationale 이 이미 확정한 방향(응답 경계 투영+검출 2축, `details[].code` 하위 세부 코드)을 코드 레벨에서 완결시키는 성격이며, 각 변경의 코드 주석이 스스로 과거 Rationale을 인용하며 구분을 논증하고 있다. 유일한 잔여 사항은 두 번째 사례로 굳어진 "쿼리 범위 DB-레벨 select 투영" 기법이 아직 spec Rationale 표에 정식 등재되지 않은 문서 정합 갭(INFO, 3라운드 연속 동일 지적)이며, 이는 병합을 막을 사안이 아니다.

## 위험도

LOW
