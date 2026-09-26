---
title: "워크플로 버전 응답의 §5.4 금지 조합(`creator` · `changeSummary`)을 갚고, 두 조회의 공유 `select` 를 상수로"
status: in-progress
owner: developer
worktree: workflow-version-creator
spec_impact: none
started: 2026-09-26
---

# 워크플로 버전 응답 — `creator` · `changeSummary` 선언과 공유 `select`

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 인접한 두 항목을 한 PR 로 닫는다. 둘 다
`workflow-versions` 서비스 · DTO 의 같은 두 조회(`findByWorkflow` · `findOne`)를 다룬다.

- «`WorkflowVersion*Dto.creator` 의 §5.4 금지 조합을 갚는다»
- «`workflow-versions.service.ts` 의 공유 `select` 6키를 상수로»

## 실측 (2026-09-26, origin/main `daff47a6b`)

- **`creator` 는 항상 존재한다.**
  - `workflow_version.created_by` 는 `UUID NOT NULL REFERENCES "user"(id)`(`V001__initial_schema.sql`, `ON DELETE` 없음 = NO
    ACTION)이다. 버전을 만든 사용자는 지울 수 없으니 관계 로드가 항상 행을 찾는다. 이후 마이그레이션에서 이 FK 를 바꾼 것은 없다.
  - 두 조회 모두 `relations: { creator: true }` + `select.creator: CREATOR_PROJECTION`(`id` · `name` · `email`)이다.
  - `User.name` · `User.email` 은 NOT NULL 이다 → `WorkflowVersionCreatorDto` 의 세 필드 required 선언도 맞다.
- **`changeSummary` 는 키가 항상 실리고 값이 `null` 일 수 있다** — 두 조회의 `select` 에 있고 컬럼이 nullable 이다.
- **선언은 둘 다 §5.4 금지 조합이다**: `@ApiPropertyOptional({ nullable: true })` + `?: T | null`. `swagger-dto-contract.spec.ts`
  의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에 **4행**으로 동결돼 있다(두 DTO × 두 필드). 트래커 항목은 `creator` 2행만 적었지만 나머지
  2행(`changeSummary`)도 같은 DTO · 같은 형태라 함께 갚는다.
- spec `spec/3-workflow-editor/5-version-history.md` §7.1 표는 두 엔드포인트 모두 `changeSummary` · `creator` 를 «포함» 으로 적는다
  → required 선언과 맞는다. `spec_impact: none`.
- **공유 `select`**: `findByWorkflow` · `findOne` 이 메타 6키(`id` · `workflowId` · `version` · `changeSummary` · `createdBy` ·
  `createdAt`)를 손으로 두 번 적는다. 단위 테스트가 두 `select` 를 **리터럴 전체**로 고정하므로 상수 추출은 그 테스트가 지키는
  순수 리팩터다.
- e2e: 상세(`GET …/versions/:versionId`)는 `workflow-crud` H 가 `WorkflowVersionDto` 와 대조한다. **목록(`GET …/versions`)은 계약
  대조가 없다**(H · I 가 호출만 한다).
- 프런트엔드 미러(`codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionSummary.creator?: {…} | null`)는 백엔드보다
  **넓다**. 소비처 `version-history-panel.tsx` 는 `creator` 가 없으면 `createdBy` 로 떨어지는 방어 코드와 그 테스트(`creator: null`)를
  갖는다. → **바꾸지 않는다.** 좁히면 프런트엔드 동작(방어 분기)과 테스트까지 바뀌는데, 넓은 쪽은 런타임에 안전하다. 그 파일의
  JSDoc(«백엔드가 더 좁으므로 런타임 오류는 안 난다»)도 여전히 맞다.

## 방향

1. **DTO** — 두 DTO 의 `creator` → `@ApiProperty({ type: () => WorkflowVersionCreatorDto })` + `creator: WorkflowVersionCreatorDto`.
   `changeSummary` → `@ApiProperty({ type: String, nullable: true })` + `changeSummary: string | null`(§5.4 기본형. `type` 명시는
   `string | null` 이 테스트 쪽 스키마에서 `type: object` 가 되는 것을 막는다 — #1412 에서 실측).
2. **래칫** — `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에서 4행을 뺀다(래칫은 감소도 실패시키므로 빼지 않으면 RED).
3. **서비스** — 메타 6키를 `VERSION_METADATA_SELECT`(frozen)로 뽑고 두 조회가 펼쳐 쓴다. 두 조회를 설명하는 주석 중 6키를
   서술하는 자리를 맞춘다.
4. **단위** — «목록과 상세의 `select` 는 `snapshot` 하나만 다르다» 대칭 단언. 기존 리터럴 단언은 둘 다 그대로 둔다.
5. **선언 캐너리** — `workflow-version-response.dto.spec.ts`(신규, DTO 옆 관례): 두 DTO 에서 `creator` 가 required 이고
   `WorkflowVersionCreatorDto` 참조인지, `changeSummary` 가 required 이고 `{ type: 'string', nullable: true }` 인지. 래칫은 «optional
   + nullable» 로의 회귀만 잡고 «optional 로만» 되돌리는 회귀는 못 잡으며, e2e 대조도 optional 선언을 통과시킨다.
6. **e2e** — `workflow-crud` H 의 목록 응답 각 항목을 `WorkflowVersionListItemDto` 와 대조한다. 이제 `creator` required 라 부재 ·
   `null` 이 위반이 되고, 중첩 `$ref` 라 `User` 비밀 키가 실리면 미선언으로 잡힌다.
7. **CHANGELOG** — 항목 1(OpenAPI): 두 엔드포인트가 `creator` 를 항상 실리는 필드로, `changeSummary` 를 항상 실리고 null 일 수 있는
   필드로 광고한다.

## 뮤턴트 (저장소 파일 제자리 치환 → 실행 → `shutil.copy` 복원. 커밋 `f35fedaac` 위. M1~M4 는 단위 330건, M5 는 e2e 413건 1회)

| # | 뮤턴트 | 예측 | 실측 · 죽인 케이스 |
|---|---|---|---|
| M1 | `WorkflowVersionDto.creator` 를 `@ApiPropertyOptional({ nullable: true })` 로 되돌림 | 래칫 RED · 캐너리 RED | KILLED — 래칫 · 캐너리(상세) |
| M2 | `WorkflowVersionListItemDto.creator` 를 `@ApiPropertyOptional()`(nullable 없이)로 | 캐너리 RED · 래칫 GREEN | KILLED — 캐너리(목록) 한 건만. 래칫은 예측대로 통과 — 캐너리를 둔 이유 |
| M3 | `changeSummary` 의 `type: String` 제거(한 DTO) | 캐너리 RED | KILLED — 캐너리(상세) 한 건만 |
| M4 | `findOne` 이 `VERSION_METADATA_SELECT` 대신 5키만 적음 | 기존 리터럴 단언 · 대칭 단언 RED | KILLED — `findOne` 리터럴 단언 · 대칭 단언 |
| M5 | 목록 `select` 의 `creator` 투영 제거(`User` 전 컬럼) | e2e H RED(미선언 키) — e2e 1회 | KILLED — e2e H 한 건(1 failed / 413). **죽인 것은 새 목록 이름 축**(`expectNoUserSecrets(list.body)` — `data[0].creator.passwordHash` 등 7건)이고, 그 뒤의 계약 대조는 도달하지 않았다. 예측(«미선언 키»)과 축이 다르다. `select` 에서 관계 투영이 빠지면 TypeORM 이 `User` 전 컬럼을 싣는다는 것도 이걸로 확인됐다 |

## `--impl-prep` 처분 (`review/consistency/2026/09/26/23_55_27` BLOCK: NO)

- **WARNING 1 · 2** — `5-version-history.md` §7.2 의 응답 타입명(`WorkflowVersion`) · `## Rationale` 부재. 실측으로 맞다. 이 PR 과
  무관한 기존 spec 이격이고 spec 쓰기라 planner 몫 → 트래커에 planner 항목으로 등재(INFO 1 · 3 곁가지 포함).
- **INFO 2** — 프런트엔드 미러를 좁히지 않는 근거가 plan 에만 있다 → `workflow-versions.service.ts` 의
  `WorkflowVersionDetailProjection` JSDoc(프런트엔드 미러를 이미 다루는 자리)에 한 문단 남겼다.
- **INFO 4** — 트래커 항목을 닫을 때 프런트엔드 미러 미변경 결정을 완료 각주로 적는다 → 마무리 커밋에서.

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/26/23_55_27` BLOCK: NO(W1 · W2 는 무관한 기존 spec 이격 · planner 항목 등재)
- [x] DTO · 래칫 · 서비스 · 단위 · 캐너리 · e2e · CHANGELOG
- [x] 뮤턴트 표 실측 — 5개 전부 KILLED(M5 는 예측과 다른 축이 죽였다)
- [x] TEST WORKFLOW (lint · unit · build · e2e 413)
- [ ] `/ai-review`
      - 1R `review/code/2026/09/27/00_20_58` — Critical 0 · Warning 1(`changeSummary` null 값 wire 대조 부재) → `69b1afca0` 로
        조치(e2e I 에 `toBeNull()` + 목록 계약 대조), TEST WORKFLOW 재통과(e2e 413). RESOLUTION 작성.
- [ ] `--impl-done`
- [ ] 트래커 두 항목 닫기
