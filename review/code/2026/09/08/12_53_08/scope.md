# 변경 범위(Scope) 리뷰

## 사전 확인

`git diff --stat 03f665c63~1 03f665c63` 로 실제 커밋 diff(25개 파일, +1141/-64)를 prompt 번들의 20개 코드/plan 파일 + 8개 `review/consistency/**` 산출물과 대조 — **완전히 일치**한다. 프롬프트 크기 제한으로 일부 파일(`production-build-devdep.spec.ts` 등)의 unified diff 가 잘려 있었으나, `git diff --stat` 로 라인 수(+19/-0)를 재확인해 잘린 부분에 숨은 변경이 없음을 확인했다.

`plan/in-progress/spec-followups-batch-b.md` 가 이 PR 의 전체 스코프를 B-1~B-8 여덟 항목으로 명시적으로 선언하고 있고, 실제 커밋의 25개 파일 각각이 그중 정확히 하나의 항목에 1:1 대응한다:

| 파일 | 대응 항목 |
|---|---|
| `.claude/test-stages.sh`, `PROJECT.md` | B-1 (typecheck ratchet 을 build 단계로) |
| `codebase/backend/tsconfig.build.json`, `production-build-devdep.spec.ts` | B-2 (`__test-utils__` dist 유출 차단) |
| `http-exception.filter.ts`, `http-exception.filter.spec.ts` | B-3 (`pg-error.ts` SoT 전환) |
| `workspaces.service.ts`, `workspaces.service.spec.ts`, `user-entity-exposure.spec.ts` | B-4 (`listMembers` DB 투영) |
| `integration-oauth.service.ts` | B-5 (`pgErrorConstraint()` 치환) |
| `endpoint-path-conflict-wrap-guard.ts`, `endpoint-path-conflict-wrap.spec.ts`, `endpoint-path-save.fixture.ts` | B-6 (AST 래칫) |
| `webhook-trigger.e2e-spec.ts` | B-7 (트리거 409 e2e) |
| `workflow-versions.service.ts`, `frontend/src/lib/api/workflows.ts` | B-8 (타입 개명) |
| `plan/in-progress/spec-followups-batch-b.md` | plan 자체 |
| `review/consistency/2026/09/08/12_21_11/**` | `--impl-prep` 게이트 산출물(CLAUDE.md 의무 절차) |

25개 파일 중 이 매핑 밖에 있는 파일이 **하나도 없다** — 즉 plan 에 없는 파일 수정, 계획 외 리팩토링, 무관한 설정 변경이 관찰되지 않았다.

## 발견사항

- **[INFO]** `review/consistency/2026/09/08/12_21_11/**` (8개 파일)이 코드 변경과 같은 커밋에 함께 실렸다.
  - 위치: `review/consistency/2026/09/08/12_21_11/SUMMARY.md` 외 7개
  - 상세: 이는 CLAUDE.md 가 명시한 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무"의 산출물이며, 프로젝트 관례상 `review/**` 는 gitignore 대상이 아니라 커밋되는 성격의 디렉터리다. 코드 스코프 자체를 넓히는 변경은 아니지만, 순수 코드 리뷰 관점에서는 "코드 변경"과 "프로세스 증빙 산출물"이 섞여 있다는 점만 기록해 둔다. 내용 확인 결과 이 산출물들의 판정(`BLOCK: NO`, CRITICAL/WARNING 0건)도 B-1~B-8 범위와 정확히 일치해 실질적 문제는 없다.
  - 제안: 조치 불요 — 프로젝트 관례에 부합하는 정상적인 워크플로 산출물.

- **[INFO]** B-1(`PROJECT.md`)·B-8(`workflow-versions.service.ts`/`frontend/.../workflows.ts`) 변경에 상당한 분량의 JSDoc/문서 재작성이 동반된다.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 상단 JSDoc(구 8줄 → 신 20줄), `PROJECT.md` 게이트 표 재구성
  - 상세: 코드 로직 변경(`export type` 개명, exclude 항목 추가)에 비해 주석 볼륨이 크지만, `plan/in-progress/spec-followups-batch-b.md` 의 B-1/B-8 항목이 "PROJECT.md 동반 갱신"·"양쪽 JSDoc 갱신"을 **명시적으로 요구**하고 있고, 이 저장소는 회고형 rationale 주석을 전반에 걸쳐 관례로 쓰고 있다(기존 인접 주석들과 문체·인용 방식이 동일). 계획에 없는 임의 주석 추가가 아니다.
  - 제안: 조치 불요.

- **[INFO]** `integration-oauth.service.ts`(B-5)의 import 문이 한 줄에서 여러 줄로 개행됐다.
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 상단 import 블록 (`isPostgresUniqueViolation` → `isPostgresUniqueViolation, pgErrorConstraint`)
  - 상세: 새 심볼 `pgErrorConstraint` 를 같은 import 문에 추가하면서 prettier 규칙에 의해 자연스럽게 멀티라인으로 개행된 것으로, 논리와 무관한 드라이브바이 포맷팅이 아니라 새 import 추가의 필연적 결과다.
  - 제안: 조치 불요.

그 외 8개 항목(B-1~B-8) 전체를 개별 diff 로 대조했을 때, 계획에 없는 추가 기능·불필요한 리팩토링·무관한 파일 수정·의미 없는 포맷팅·미사용 임포트·의도치 않은 설정 변경은 발견되지 않았다. `tsconfig.build.json`(B-2)·`PROJECT.md`(B-1) 변경은 각각 plan 이 요구한 정확한 범위(디렉터리 이름 규약 1줄 추가, 표 2행 이동)에 그친다. `http-exception.filter.ts`(B-3)는 로컬 `isUniqueViolation` 헬퍼 제거와 `QueryFailedError` import 제거가 정확히 대체 대상만큼만 이뤄졌다.

## 요약

`plan/in-progress/spec-followups-batch-b.md` 가 사전에 선언한 B-1~B-8 여덟 항목과 실제 커밋(25개 파일)이 1:1 로 정확히 대응하며, 그 매핑 밖의 파일·코드 영역은 존재하지 않는다. 각 항목 내부의 diff 도 plan 이 지시한 범위(예: "PROJECT.md 두 행만 이동", "import 한 줄 + 표현 2개 치환", "화이트리스트에서 항목 제거")를 정확히 지켰다. 확인된 사항은 모두 INFO 등급 참고 메모(`review/consistency/**` 동반 커밋, 계획에 명시된 JSDoc 갱신 볼륨, import 개행)이며 실질적인 스코프 이탈은 발견되지 않았다.

## 위험도

NONE
