# Cross-Spec 일관성 검토 — `spec/2-navigation/` (재실행)

이 재실행의 핵심 과제는 직전 라운드(`review/consistency/2026/09/27/19_43_46`, BLOCK: YES, Critical 2)가 지적한
두 문장이 planner 턴(`a8bfd1492`, `spec/1-data-model.md` §1.1 신설)이후 지금 규칙과 맞는지 재판정하는 것이다.

## 재판정 — 직전 Critical 2건은 해소됨

1. **`spec/2-navigation/1-workflow-list.md` §3.1 / Rationale §3**
   - §3.1 `POST /api/folders`: "`parentId` 가 같은 워크스페이스의 폴더가 아니면 400 `VALIDATION_ERROR`(`details[].field='parentId'`)" —
     `spec/1-data-model.md` §1.1 표의 "폴더 생성·수정 `parentId` → Folder → 워크스페이스" 행 및 거부 응답 형식(400
     `VALIDATION_ERROR` + `details: [{field, message, code}]` 배열)과 **일치**.
   - §3.1 `PATCH /api/folders/:id`: "`parentId` 변경 시 create 와 동일한 계층 무결성 검증" — 동일 규칙 재사용, 일치.
   - Rationale §3 (2026-09-27 정정): "생성 경로는 깊이만 봤다 — 다른 워크스페이스의 부모를 `getDepth` 가 «없음» 으로 읽어
     깊이 1 로 통과시켰다 ... 규칙은 [데이터 모델 §1.1]" — `spec/1-data-model.md` §1.1 이 실제로 존재하고 폴더 `parentId` 를
     명시적으로 다루므로 이 정정 서술은 지금 규칙과 **모순 없음**.
   - `POST /api/workflows` / `PATCH /api/workflows/:id` 의 `folderId` 400 `VALIDATION_ERROR`(`details[].field='folderId'`) 도
     §1.1 "워크플로 생성·수정 `folderId` → Folder → 워크스페이스" 행과 **일치**.

2. **`spec/data-flow/11-workflow.md` §1.2 각주**
   - "저장 경로(`saveCanvas` · 노드 API)가 저장 시점에 보는 것은 **참조의 소속**뿐이다 — `container_id` · `tool_owner_id` 는
     같은 워크플로의 노드(캔버스 저장은 이번 페이로드의 노드)여야 하고, 아니면 400 `VALIDATION_ERROR`([데이터 모델 §1.1])" —
     §1.1 표의 "노드 생성·수정 `containerId`·`toolOwnerId`… → Node → 같은 워크플로" / "캔버스 저장 `nodes[].containerId`…→
     이번 페이로드의 노드" 행과 **일치**. §2.1 Postgres 표(`node`/`edge` 행)도 동일 문구로 동기화되어 있음을 확인.
   - `spec/3-workflow-editor/0-canvas.md` §11.2.2 "같은 워크플로의 노드만" 행, §11.2.1 저장 API 행("다른 워크플로의 노드가
     쓰는 id 면 저장이 400")도 §1.1 과 **일치** — 같은 커밋(`a8bfd1492`)이 함께 갱신.
   - `spec/data-flow/12-workspace.md` "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)" Rationale 도 같은 규칙·같은
     실측(고치기 전 e2e 18 RED)을 인용하며 **일치**.

이전 라운드가 지적한 두 문장은 **더 이상 Critical 이 아니다** — `spec/1-data-model.md` §1.1 신설과 그 파급(§2.4·§2.6·
§2.7·§2.8·§2.9·§2.25, `1-workflow-list.md`, `data-flow/11-workflow.md`, `data-flow/12-workspace.md`, `0-canvas.md`)이
서로 같은 규칙·같은 에러 형식(400 `VALIDATION_ERROR` + `details: [{field, message, code}]` 배열, 모델 설정 참조 예외
404 `MODEL_CONFIG_NOT_FOUND`, 트리거 `authConfigId` 예외 `AUTH_CONFIG_NOT_FOUND`)을 가리키고 있다. `details` 배열 형태도
[`spec/5-system/2-api-convention.md` §5.3](../../../../../spec/5-system/2-api-convention.md)의 "여러 항목이 각각 실패할 수 있을 때 배열" 규약과 부합한다.

## 발견사항 (신규)

- **[WARNING]** 같은 target 영역 안에서, §1.1 이 요구하는 검사 중 **더 심각한 두 자리**(트리거/스케줄 `workflowId` —
  plan 이 스스로 "(X) 다른 워크스페이스에 **작용**한다"로 분류한 최상위 항목)가 정작 그 API 를 설명하는 navigation 문서에는
  반영되지 않았다.
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 (`POST /api/triggers` 행), `spec/2-navigation/3-schedule.md` §4
    (`POST /api/schedules` 행)
  - 충돌 대상: `spec/1-data-model.md` §1.1 표("트리거 생성 `workflowId` · 스케줄 생성 `workflowId`… → Workflow → 워크스페이스")
    및 §2.8("`workflow_id` … 같은 워크스페이스의 워크플로만([§1.1])"), §2.9("스케줄 생성 요청의 `workflowId` 는 … §2.8 과
    같은 제약([§1.1])")
  - 상세: `1-workflow-list.md` 는 (§1.1 기준으로는 상대적으로 저위험인 "(D) 끊긴 참조" 등급의) `folderId` 검증을 §3/§3.1 에
    명시적으로 적어 두었다. 반면 같은 target 폴더의 `2-trigger-list.md`/`3-schedule.md` 는 plan 이 "다른 워크스페이스에서
    **실행이 돈다**"고 분류한 더 심각한 `workflowId` 케이스에 대해 API 표·§2.5(트리거 생성)·§2.2(스케줄 생성 다이얼로그) 어디에도
    400 `VALIDATION_ERROR` 또는 관련 소속 검사를 언급하지 않는다. `plan/in-progress/cross-workspace-refs.md` 의
    `spec_impact` 목록에도 이 두 파일이 빠져 있어, 백엔드 구현이 이 규칙대로 착지해도 두 navigation 문서만 조용히 stale 해질
    위험이 있다.
  - 제안: `2-trigger-list.md` §3 `POST /api/triggers`, §2.5 트리거 생성 표의 "연결 워크플로우" 행, `3-schedule.md` §4
    `POST /api/schedules`, §2.2 스케줄 생성 다이얼로그의 "워크플로우" 행에 `1-workflow-list.md` 의 `folderId` 서술과 동일한
    패턴("같은 워크스페이스의 워크플로만 — 아니면 400 `VALIDATION_ERROR`, [데이터 모델 §1.1]")을 추가하거나, 최소한
    `plan/in-progress/cross-workspace-refs.md` 의 `spec_impact` 에 두 파일을 올려 후속 커밋에서 함께 갱신되도록 명시할 것.

- **[INFO]** 같은 계열의 더 낮은 우선순위 자리 — `spec/2-navigation/9-user-profile.md` §알림 규칙 API 의
  `POST /api/alerts` `workflowId?` (plan 의 "(D) 끊긴 참조" 목록에 있는 `workflowId` 항목)도 §1.1 소속 검사 서술이 아직
  없다. `2-trigger-list.md`/`3-schedule.md` 항목과 같은 패턴의 후속 동기화 대상으로 묶어 처리할 것을 권장.

- **[INFO]** `spec/2-navigation/1-workflow-list.md` Rationale §3 (2026-09-27 정정) 이 인용하는 경로
  `plan/complete/cross-workspace-refs.md` 는 저장소에 **존재하지 않는다** — 실제로 이 수정을 담당하는 plan 은
  `plan/in-progress/cross-workspace-refs.md` (아직 in-progress, `구현` 체크박스 미완료)이고, 같은 PR 의 spec draft 는
  `plan/complete/spec-draft-cross-workspace-refs.md` 라는 다른 파일명이다. 두 가지 다 `plan/complete/cross-workspace-refs.md`
  와 일치하지 않는다. 순수 spec-vs-spec 충돌은 아니고(오히려 plan 참조 정확성 문제라 `plan_coherence` 축에 더 가깝다) 링크가
  깨져 있어 다음 사람이 잘못된 완료 상태를 믿을 수 있으므로 병기한다. 제안: `plan/complete/cross-workspace-refs.md` →
  `plan/in-progress/cross-workspace-refs.md` 로 정정.

## 요약

이번 재실행에서 직전 라운드의 Critical 2건(`1-workflow-list.md` §3.1/Rationale §3, `data-flow/11-workflow.md` §1.2 각주)은
`spec/1-data-model.md` §1.1 신설과 그 파급 갱신(§2.4·§2.6~§2.9·§2.25, `0-canvas.md` §11.2.1~§11.2.2,
`data-flow/12-workspace.md`)에 의해 완전히 해소되었다 — 에러 코드·`details` 배열 형태·앵커 링크 모두 서로 일치하고
`spec/5-system/2-api-convention.md` §5.3 의 일반 규약과도 부합한다. 다만 target 영역 안에서 새 규칙의 **적용 범위**가
고르지 않다: plan 이 스스로 최우선(X)으로 분류한 트리거·스케줄 `workflowId` 케이스가 정작 `2-trigger-list.md`/
`3-schedule.md` 본문에는 아직 반영되지 않아, `1-workflow-list.md` 만 선행 갱신되고 나머지 두 문서가 뒤처지는 비대칭이
남아 있다(WARNING). 이는 구현을 막을 정도는 아니지만 같은 PR 또는 즉시 후속 커밋에서 `spec_impact` 를 넓혀 동기화할
것을 권장한다. 부수적으로 `1-workflow-list.md` 의 plan 경로 인용 오류(존재하지 않는 `plan/complete/cross-workspace-refs.md`)
도 발견되어 병기한다.

## 위험도

LOW
