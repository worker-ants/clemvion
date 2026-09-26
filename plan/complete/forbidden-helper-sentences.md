---
title: 403 설명의 가드 문장을 공용 헬퍼로 — 손으로 쓴 3곳 · 서비스 문장을 잇는 구두점 한 곳에서
status: complete
owner: developer
worktree: forbidden-helper-sentences
spec_impact: none
started: 2026-09-26
---

# 403 설명 — 손으로 쓴 가드 문장과 서비스 문장의 이음

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «403 설명 3곳이 공용 헬퍼를 거치지 않고 코드를 손으로
보간한다» 를 닫는다. `spec/conventions/swagger.md` §5-4 는 «문장은 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)` 로
만들고, 서비스가 내는 403 은 그 뒤에 덧붙인다» 고 적는다. 규칙은 이미 있고, 이 PR 은 어긋난 자리를 맞춘다 — spec 변경 없음.

## 실측 (2026-09-26, `src/**` 의 `@ApiForbiddenResponse` 164곳, AST)

| 분류 | 라우트 | 처분 |
| --- | --- | --- |
| 헬퍼만(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(…)`) | 140 | 없음 |
| 헬퍼 + 서비스 문장 — `, 또는` 으로 이음 | 14 | 서비스 문장을 잇는 헬퍼로. 편집 자리 8 — 인라인 3(`integrations` `oauthBegin` · `workspaces` `leave` · `removeMember`) + 모듈 상수 5(`integrations` 3 · `workspaces` 1 · `workflow-test-datasets` 1 — 쓰는 라우트 11) |
| 가드 문장을 손으로 보간 | 3 | 헬퍼로. `auth` `switchWorkspace`(`@WorkspaceParam('id')` — 가드가 `NOT_A_MEMBER` 를 낸다) · `executions` `reRun`(`@Roles('editor')`) · `getChain` |
| 가드 문장을 손으로 — 코드 없음, `@ApiExcludeEndpoint()` 테스트 훅 | 2 | 헬퍼로(`forbiddenForRole('owner')`). OpenAPI 밖이라 문서에는 안 실리지만 같은 형태의 결함이다 |
| 워크스페이스와 무관한 서비스 403(재인증 수단 부재 · HMAC) | 5 | 없음 — 가드 거부가 아니다 |

**구두점**: 헬퍼 `forbiddenForRole` 은 두 거부를 ` 또는 ` 으로 잇는다. 서비스 문장을 덧붙인 8곳은 전부 `, 또는` 이라 한 문장 안에서
«A 또는 B, 또는 C» 로 갈린다(`/ai-review` `review/code/2026/09/26/12_20_03` INFO15). 헬퍼와 같은 ` 또는 ` 으로 맞추고, 그 이음을
헬퍼 하나(`forbiddenWithService(guard, service)`)가 정한다 — 문자열만 고치면 다음 자리가 다시 `, 또는` 을 쓴다.

## 방향

- `common/swagger/forbidden-descriptions.ts` 에 `forbiddenWithService(guard, service)` — `${guard} 또는 ${service}`. 단위 테스트.
- 위 13 자리(8 + 3 + 2)를 헬퍼로. 재실행 두 곳의 서비스 문장은 저장소의 다른 서비스 문장 표기(`(<코드> — 서비스 판정)`)로 —
  종전 «— RolesGuard / … — 서비스» 는 이 두 곳만의 형식이다.
- CHANGELOG — OpenAPI 403 설명 문장이 바뀐다(응답은 그대로).

## 안 하는 것

- **형식 가드** — `forbidden-response-codes` 는 **빠진 코드**를 잡는다(동작상 해로운 쪽). 설명이 헬퍼 문장으로 **시작하는지**까지 보게
  하면 가드의 판정 대상이 바뀌어 §5-4 규칙 문단과 Rationale(«서비스 거부는 세지 않는다 — 안내만 한다»)을 고쳐야 한다(planner 턴).
  이번 결함은 코드가 실린 채 형식만 어긋난 것이라 그 비용을 들이지 않는다.
- **서비스 문장 표기(«— 서비스 판정» 표지)의 전면 통일** — 8곳 중 표지를 단 곳과 안 단 곳이 섞여 있다. 이음만 맞춘다.

## 검토 경고 처리

| 출처 | 지적 | 처분 |
| --- | --- | --- |
| `--impl-prep` `15_08_57` W1 | `swagger.md` §2-4 상태 코드 표에 202 · 410 · 429 행이 없다 — 이 PR 이전부터의 spec 표 갭 | 사실 확인(표 9행) · 트래커 등재(planner) |
| `--impl-prep` `15_08_57` INFO2 | 이음 구두점 결정의 근거가 spec Rationale 에 없다 | `forbiddenWithService` JSDoc 에 이음 규칙과 근거를 싣는다(헬퍼를 쓰는 사람이 읽는 자리) |
| `--impl-prep` `15_08_57` INFO4 | `integration-personal-owner-followup.md` Viewer 항목이 같은 상수를 손으로 고칠 예정 | 그 항목에 «상수가 `forbiddenWithService(...)` 형태로 바뀌었다» 한 줄 |

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/26/15_08_57` BLOCK: NO(Warning 1 — 위 표)
- [x] 헬퍼 + 단위 테스트
- [x] 13 자리 치환 — 평가된 메타데이터로 확인: 바뀐 19 라우트(게시 17 · 테스트 훅 2) 모두 헬퍼 문장으로 시작하고 `, 또는` 이음 0
- [x] CHANGELOG
- [x] 뮤턴트 — 둘 다 예측대로

  | # | 뮤턴트 | 예측 / 실측 | 죽인 케이스 |
  | --- | --- | --- | --- |
  | M1 | 헬퍼의 이음을 `, 또는` 으로 | KILLED / KILLED | 헬퍼 단위 테스트(서비스 문장 이음) |
  | M2 | 재실행 설명을 손 문장으로(코드는 실음) | SURVIVED / SURVIVED | — «안 하는 것 — 형식 가드» 가 받아들인 한계. 가드 `forbidden-response-codes` 는 빠진 코드만 잡는다 |
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 전부 PASS(e2e 412)
- [x] `/ai-review` — 1R `review/code/2026/09/26/15_36_42`(라우터 선별 9명 · forced 7명 전원): Critical 0 · Warning 1(이 plan 을 옮길
      경로의 선행 인용 — 마무리 커밋의 이동으로 참이 된다). codebase 수정 0건으로 정지 규칙을 1R 에서 충족
- [x] `--impl-done` — `review/consistency/2026/09/26/15_45_47` BLOCK: NO(Critical · Warning 0). scope 는 바꾼 코드의 spec 소유 문서 9개 + `data-flow/12-workspace.md`
- [x] 트래커 항목 닫기 — 종결 노트에 전수 · 헬퍼 · 리뷰 · 게이트 세션
