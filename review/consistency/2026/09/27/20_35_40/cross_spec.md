# Cross-Spec 일관성 검토 — spec draft 2 (`1-workflow-list.md` 소정정)

target 은 `spec/2-navigation/1-workflow-list.md` 의 frontmatter `pending_plans:` 와 `## Rationale` §3 정정 단락 한 문장만 고치는
좁은 범위의 패치다 (직전 `--impl-prep` `20_21_21` 의 Critical 1 — `pending_plans` 미등재 + 존재하지 않는
`plan/complete/cross-workspace-refs.md` 를 완료형으로 인용 — 을 해소하려는 것).

## 재판정 — target 자체의 변경은 다른 영역과 충돌 없음

1. `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 를 추가 — `spec/conventions/spec-impl-evidence.md` §2.1/§3
   (`status: partial` 은 `pending_plans` 의무, 경로는 `plan/in-progress/` 또는 `plan/complete/`(치환) 실존)과 **일치**. 해당 plan 이
   `status: in-progress` 로 실제 존재함을 확인했다.
2. Rationale §3 문장을 `plan/complete/cross-workspace-refs.md`(존재하지 않음) → `plan/in-progress/cross-workspace-refs.md`(실존) +
   완료형 "더했다" → 현재형 "더한다" 로 낮추는 것도 실제 plan 상태(구현 미완료, 체크리스트 진행 중)와 **일치**.
3. 새로 인용하는 "규칙은 데이터 모델 §1.1" 은 `spec/1-data-model.md#11-참조의-소속` 의 실제 표 내용(폴더 생성·수정 `parentId` →
   Folder → 워크스페이스)과 **일치**.

target 자체가 새로 만드는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 없다.

## 발견사항 (신규 — target 이 남기는 비대칭)

- **[CRITICAL]** 같은 근본 결함이 사실상 동일한 형태로 `spec/3-workflow-editor/0-canvas.md` 에도 남아 있는데 target 은 그것을 고치지 않는다
  - target 위치: (target 자체는 이 파일을 건드리지 않음 — target 의 좁은 스코프가 남기는 사각지대)
  - 충돌 대상: `spec/3-workflow-editor/0-canvas.md` §11.2.2 "같은 워크플로의 노드만" 행(633번째 줄) + frontmatter
    `pending_plans:`(`plan/in-progress/ai-agent-tool-connection-rewrite.md`, `plan/complete/spec-sync-canvas-gaps.md` — 둘 다 이 결함과
    무관)
  - 상세: `git blame` 확인 결과 canvas.md §11.2.2 의 해당 행은 **1-workflow-list.md 의 문제 문장과 같은 커밋(`a8bfd1492`)**이 넣었다.
    문구는 "캔버스 저장은 이번 페이로드에 없는 노드를 가리키면 400 `VALIDATION_ERROR`([데이터 모델 §1.1])" 로, `containerId`·`toolOwnerId`
    참조가 이미 저장 전 거부되는 것처럼 현재형으로 단언한다. 그런데 이 draft 가 fix 대상으로 삼는 바로 그 plan
    (`plan/in-progress/cross-workspace-refs.md` 71~95행)이 이미 실측했다 — "거부를 기대한 18케이스 — 전부 RED"(고치기 전 e2e,
    `_test_logs/e2e-20260927-195807.log`)이고, 그 18건에는 `containerId`·`toolOwnerId`·엣지 끝점 캔버스 케이스가 포함된다(94행:
    "이어진 `containerId`·`toolOwnerId`·엣지 끝점 캔버스 케이스가 FK 위반"). 즉 canvas.md §11.2.2 의 단언은 **실측으로 반증된 상태**이고,
    `status: partial` 문서인데도 `pending_plans:` 에 이 결함을 책임지는 plan 이 없다 — target 이 `1-workflow-list.md` 에서 막 고친 것과
    **정확히 같은 결함 패턴**(허위 완료 단언 + `pending_plans` 미추적, build 가드로는 검출 불가 — `spec-status-lifecycle.test.ts` 는
    `pending_plans` 가 비어 있지 않으면 통과하므로 canvas.md 는 이미 통과 상태다). target 의 Rationale W3 는 트리거·스케줄·알림 규칙
    API 문서의 "§1.1 한 줄 미러 누락"(더 경미한 유형 — 아직 아무 단언도 없는 상태)만 후속 트래커로 넘긴다고 적는데, canvas.md 는 그
    범주가 아니라 **워크플로 목록과 동급의 허위 단언**이라 같은 트래커·같은 기준으로도 다뤄지지 않고 있다(트래커
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 1488~1493행의 "교차 워크스페이스 참조 후속" 항목도 트리거·스케줄·
    user-profile 세 문서의 미러만 나열하고 `0-canvas.md` 는 언급하지 않음 — grep 확인).
  - 제안: 같은 planner 턴(또는 즉시 후속)에 `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans:` 에도
    `plan/in-progress/cross-workspace-refs.md` 를 추가할 것. target 이 이미 확립한 패턴(§1.1 인용 유지 + `pending_plans` 로 미구현
    추적, "(Planned)" 라벨 미부기)을 그대로 적용하면 되므로 처방 비용은 낮다. 미루면 이 PR 의 `--impl-done` 재실행 시 canvas.md 가
    독립적으로 새 Critical 로 재발할 가능성이 높다(정확히 같은 검사 로직이 이미 이 세션에서 한 번 이 문제를 잡았다).

## 참고 (INFO — 이미 알려진 비대칭, target 스코프 밖이라 재차단하지 않음)

- 트리거·스케줄·알림 규칙 API 문서(`2-trigger-list.md`/`3-schedule.md`/`9-user-profile.md`)의 §1.1 한 줄 미러 누락은 직전 라운드
  WARNING #3/INFO #1 로 이미 추적 중이고, target Rationale W3 가 후속 트래커 등재를 명시한다 — 이번 draft 가 다루지 않아도 새로 막을
  사유는 없음. 다만 canvas.md 건과 성격이 다르다는 점(단순 미러 누락 vs 반증된 단언 + 미추적)을 위 CRITICAL 항목에서 구분해 뒀다.

## 요약

target 자체(frontmatter `pending_plans` 정정 + Rationale 시제·경로 정정)는 `spec/1-data-model.md` §1.1, `spec/conventions/spec-impl-evidence.md`
§2.1/§3 과 정합하며 새로운 충돌을 만들지 않는다. 그러나 target 이 고치는 문제와 **완전히 동일한 결함**(허위 현재형 단언 + `status: partial`
인데 책임 plan 미등재, build 가드로는 검출 불가)이 같은 원인 커밋(`a8bfd1492`)이 건드린 자매 문서 `spec/3-workflow-editor/0-canvas.md`
§11.2.2 에도 남아 있고, 이 반증은 이번 세션이 이미 확보한 e2e 실측(18 RED, containerId/toolOwnerId 케이스 포함)으로 뒷받침된다. target 이
이 파일을 스코프에 넣지 않은 채 착지하면, 다음 `--impl-done`/`--spec` 재실행에서 같은 등급의 Critical 이 canvas.md 를 대상으로 재발할
개연성이 높다.

## 위험도
HIGH
