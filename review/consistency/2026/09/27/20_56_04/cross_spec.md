# Cross-Spec 일관성 검토 — spec-draft-cross-workspace-refs-2

## 검토 범위

target(`plan/in-progress/spec-draft-cross-workspace-refs-2.md`)의 변경안은 3개뿐이다:

1. `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 추가
2. `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans:` 에 같은 경로 추가 (status: partial 유지)
3. `1-workflow-list.md` `## Rationale` §3 "(2026-09-27 정정)" 단락의 마지막 문장 — 경로를 `plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md` 로, 시제를 완료형("더했다") → 현재형("더한다")으로 정정

즉 신규 엔티티·API·상태 머신·RBAC 를 정의하지 않는 **메타데이터(추적) + 시제 정정** 범위다. 아래는 이 세 항목이 실제로 `spec/**` 다른 영역·컨벤션과 어긋나지 않는지를 실측으로 확인한 결과다.

## 확인한 사실관계

- `spec/conventions/spec-impl-evidence.md` §4 `spec-pending-plan-existence.test.ts` — `pending_plans:` 항목은 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존해야 함. `plan/in-progress/cross-workspace-refs.md` 는 실제로 존재한다(Read 로 확인) — 가드를 통과한다.
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` `EXCLUDE_BASENAMES = {0-overview.md, 1-data-model.md, 6-brand.md}` — target 이 인용한 "`1-data-model.md` 는 frontmatter-evidence 가드 네 개 모두의 대상이 아니다" 라는 전제가 코드로 확인됨. 직전 `--spec`(`20_45_35`) Critical 을 이 draft 가 정확히 되짚어 회피하고 있다.
- `spec/data-flow/11-workflow.md`, `spec/data-flow/12-workspace.md` — 실제로 frontmatter 자체가 없음(확인). `spec-impl-evidence.md §1` 의 "`spec/data-flow/**` 는 frontmatter 의무 대상 아님" 서술과 일치 — target 이 이 둘을 "라이프사이클 비추적 범주"로 건드리지 않기로 한 판단과 모순 없음.
- `spec/data-flow/12-workspace.md` §"본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)" 섹션이 실재하고 `spec/1-data-model.md §1.1` 을 가리킴 — target 의 §1.1 인용 체인이 끊기지 않음.
- `spec/1-data-model.md §1.1` 표는 "노드 생성·수정 `containerId`·`toolOwnerId`, 엣지 끝점 → 같은 워크플로" 로 정의하고, `spec/3-workflow-editor/0-canvas.md §11.2.2` (기존 문구, 이번 draft 가 건드리지 않음)는 동일하게 "이 워크플로의 노드만 가리킨다" 로 서술 — 두 문서가 이미 정합. target 은 이 절의 본문을 바꾸지 않고 frontmatter 만 건드리므로 새 불일치를 만들지 않는다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커) 1488~1494행에 target Rationale 이 인용하는 "교차 워크스페이스 참조 후속" 항목이 실재하고, 그 안에 "구현이 착지한 뒤 API 문서 셋(`2-trigger-list.md`·`3-schedule.md`·`9-user-profile.md`)에 §1.1 한 줄 미러" 가 명시돼 있다 — target 이 W3·INFO1 을 "지금 넣지 않는다" 로 defer 한 근거가 실측과 일치한다(지어낸 인용이 아님).
- 직전 `--spec`(`20_35_40`) BLOCK 사유였던 "plan 경로를 마크다운 링크로 걸면 `complete/` 이동 시 `spec-link-integrity` 가 깨진다" 는 지적을, target 은 두 pending_plans 항목·Rationale 문장 모두 백틱 plain text 로 유지해 재발시키지 않는다.
- `plan/in-progress/cross-workspace-refs.md`(구현 plan) §처방에 "폴더 PATCH `parentId` 의 기존 거부도 같은 배열 `details` 를 싣는다" 라는 문장이 실제로 있어, target Rationale 의 W2 해소 근거(스펙은 목표 상태, 구현 plan 이 갭을 메운다)가 확인된다.

## 발견사항

없음 — CRITICAL·WARNING 급 충돌을 찾지 못했다. target 은 이미 두 차례 BLOCK 된 동일 결함(구현 전 완료형 서술·`pending_plans` 미추적·존재하지 않는 경로 인용)을 좁게 정정하며, 인용하는 모든 근거(가드 구현·트래커 항목·인접 spec 문서 상태)가 실측으로 확인됐다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 target 이 다른 `spec/**` 영역과 새로 모순되는 지점은 없다.

- **[INFO]** Rationale 정정 문장의 마크다운 링크 보존 여부가 불명확
  - target 위치: `## 변경안` 3번 — "«…규칙은 데이터 모델 §1.1.» 로 바꾼다"
  - 충돌 대상: 없음(잠재적 실수 예방 차원)
  - 상세: 현재 `1-workflow-list.md` §3 원문은 "규칙은 [데이터 모델 §1.1](../1-data-model.md#11-참조의-소속)" 로 실제 마크다운 링크다. 변경안 문구는 이 링크를 유지하라는 말인지 plain text 로 바꾸라는 말인지 명시하지 않는다.
  - 제안: 적용 시 기존 링크 형태(`[데이터 모델 §1.1](../1-data-model.md#11-참조의-소속)`)를 그대로 보존할 것 — `spec-link-integrity.test.ts` 가 spec 본문 내 링크를 검증하므로, 실수로 plain text 로 낮추면 무해하지만 일관성이 떨어진다.

## 요약

target 은 신규 엔티티·API·상태 머신·RBAC 를 정의하지 않고, 두 spec 문서의 `pending_plans:` frontmatter 추가와 이미 있는 Rationale 문장 하나의 경로·시제 정정에 국한된 좁은 수정이다. 인용하는 모든 근거(가드 대상 제외 목록, 트래커 항목, 인접 data-flow 문서의 무-frontmatter 상태, 구현 plan 의 처방 문구)를 직접 Read 로 대조한 결과 전부 사실과 일치했고, 다른 `spec/**` 영역의 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 정의와 새로 충돌하는 지점은 발견되지 않았다.

## 위험도
NONE
