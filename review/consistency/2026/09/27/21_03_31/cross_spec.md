# Cross-Spec 일관성 검토 — `spec/2-navigation/` (cross-workspace-refs, `--impl-prep` 재실행)

## 컨텍스트

이 재실행은 `plan/in-progress/cross-workspace-refs.md` 의 두 이전 Critical(1회차 폴더 생성·캔버스 저장
계약 / 2회차 `1-workflow-list.md` §3.1·Rationale §3 의 구현-전 현재형 서술 + `pending_plans` 미추적)이
`a8bfd1492`→`18f235a81` 두 planner 턴으로 해소됐는지 재판정하고, 그 위에서 `spec/2-navigation/`
전체와 다른 영역의 신규 충돌을 찾는 것이다.

**두 Critical 문장 재판정 — 둘 다 지금 규칙과 맞다.**
- `spec/2-navigation/1-workflow-list.md` §3.1 (`POST /api/folders` 의 `parentId` 워크스페이스 검사)과
  Rationale §3 의 "(2026-09-27 정정)" 단락은 `spec/1-data-model.md#11-참조의-소속` 을 정확히 가리키고,
  frontmatter `pending_plans` 에 `plan/in-progress/cross-workspace-refs.md` 가 등재돼 있다(라인 39-42).
  Rationale 정정 단락도 `plan/in-progress/...`(완료 전 경로)와 현재형("더한다")으로 시제가 맞다.
- `spec/3-workflow-editor/0-canvas.md` §11.2.2 "같은 워크플로의 노드만" 행(§634)과 저장 API 행(§514)도
  같은 규칙을 정확히 인용하고, frontmatter `pending_plans` 에 같은 plan 이 등재돼 있다(라인 15).
- `spec/data-flow/11-workflow.md` §1.2 각주(라인 81-85)도 "저장 시점엔 참조의 소속만 본다"로 갱신되어
  `1-data-model.md#11-참조의-소속` 을 가리킨다 — data-flow 문서는 frontmatter 자체가 없는 계열(전
  16개 파일 확인)이라 `pending_plans` 규약이 적용되지 않는다(기존 관행, 이 PR 이 만든 예외 아님).

이 세 곳은 Critical 이 아니다. 아래는 이번 재실행에서 **새로 발견한** 항목이다.

---

## 발견사항

### [WARNING] `spec/1-data-model.md` §1.1 의 `status: implemented` 서술이 아직 구현되지 않은 4개 영역까지 "이미 거부한다"로 단언 — 두 자매 Critical 과 같은 결함 모양이 세 곳 더 남아 있다

- **target 위치**: `spec/1-data-model.md` §1.1 "참조의 소속" (라인 57-78, 특히 라인 59-61 "서버는 이것을
  저장 전에 거부한다"), 표의 1행("트리거 생성 `workflowId` · 스케줄 생성 `workflowId` · 알림 규칙 생성
  `workflowId`")과 5행("노드 생성·수정 `containerId`·`toolOwnerId`·엣지 생성 `sourceNodeId`·`targetNodeId`
  | Node | **같은 워크플로**" — 캔버스 저장 행과 별개의, API 레벨 행).
- **충돌 대상**:
  - `spec/2-navigation/2-trigger-list.md` §3 (`POST /api/triggers` — `workflowId`)
  - `spec/2-navigation/3-schedule.md` §4 (`POST /api/schedules` — `workflowId`)
  - `spec/2-navigation/9-user-profile.md` §6.3 (`POST /api/alerts` — `workflowId?`, 라인 406)
  - `spec/3-workflow-editor/1-node-common.md` / `2-edge.md` (API 엔드포인트 `POST
    /api/workflows/:workflowId/nodes` · `PATCH /api/nodes/:id` · `POST /api/workflows/:workflowId/edges` —
    이 두 문서엔 API 섹션 자체가 없다)
  - `spec/2-navigation/5-knowledge-base.md` (`extractionLlmConfigId` / `rerankConfigId` /
    `rerankLlmConfigId`)
- **상세**: `plan/in-progress/cross-workspace-refs.md` 자신의 전수 조사(§전수, §실측)가 위 필드들을
  "(D) 끊긴 참조로 남는다"(아직 저장 전 거부 없음, 읽는 쪽이 걸러줄 뿐) 또는 "(X) 다른 워크스페이스에
  작용한다"(트리거/스케줄 `workflowId`)로 분류하고, 고치기 전 e2e 18건 RED 로 직접 실측했다. 즉 이
  필드들은 **아직 저장 전에 거부되지 않는다**. 그런데 `1-data-model.md` 는 `status: implemented` 이고
  §1.1 본문이 현재형("거부한다")으로 표 전체(위 필드 포함)를 감싸, 이 문서만 보면 이미 전부 강제되는
  것처럼 읽힌다. 이는 이번 PR 에서 **두 차례** Critical 로 잡혔던 것과 정확히 같은 결함 모양이다
  ("구현 전 서술을 현재형으로 적고 추적하지 않음") — 다만 그 두 건은 frontmatter-evidence 가드가
  추적하는 `1-workflow-list.md`/`0-canvas.md` 였기에 걸렸고, 이번 세 영역은 (a) `1-data-model.md` 자체가
  `EXCLUDE_BASENAMES` 로 가드 순회 밖이거나(`f8fc56687` 의 명시적 결정 — data-flow 문서와 같은 취급),
  (b) 소유 문서(`2-trigger-list.md`/`3-schedule.md`/`9-user-profile.md`/`5-knowledge-base.md`)가 이
  검사에 대해 **아무 말도 하지 않아**(직접 모순 문장이 없어) 가드가 볼 "구현 전 현재형 문장" 자체가
  없기 때문에 걸리지 않는다. 즉 가드의 사각지대이지, 실제로 정합하다는 뜻은 아니다.
  - KB 세 필드는 한 겹 더 있다: 처방(§처방)이 이 셋을 "기존 검증기 `findEntity` 재사용"으로 **새로
    바꾸겠다**고 명시한다 — 지금은 `resolveConfig` 를 써서 실패 시 조용히 강등(rerank) 하거나 그래프
    추출이 실패할 뿐 400/404 로 거부하지 않는다. `1-data-model.md` 표는 이 셋을 `embeddingModelConfigId`
    (이미 `findEntity` 로 검사되는 대조군)와 같은 행에 묶어 동일하게 "워크스페이스" 스코프로 단언하는데,
    현재 코드 동작은 셋이 다르다.
- **제안**: 다음 중 하나로 닫는다.
  1. (권장) `plan/in-progress/cross-workspace-refs.md` 의 `spec_impact` 에 `2-navigation/2-trigger-list.md`
     · `3-schedule.md` · `9-user-profile.md` · `5-knowledge-base.md` 를 추가하지 않더라도, 최소
     `1-data-model.md` §1.1 서두에 "이 표의 각 행은 구현 상태가 다를 수 있다 — 현재 저장 전에 거부하지
     않는 행은 `plan/in-progress/cross-workspace-refs.md` 참조" 같은 한 문장을 더해, `status: implemented`
     가 표 전체의 즉시 강제를 뜻하지 않음을 문서 안에서 스스로 밝힌다(가드가 못 보는 문서이니 텍스트로
     방어).
  2. 또는 이 PR 의 완료 시점(`--impl-done`)에 위 네 파일도 함께 갱신 대상으로 명시하고, 지금은
     `f8fc56687` 의 논리(가드 추적 대상만 우선 처리)를 그대로 받아들이는 대신 그 논리가 "가드가 보는
     문서" 한정임을 plan 에 한 줄 남긴다 — 다음 사람이 "1-data-model 은 예외니 전부 안전하다"로
     과잉 일반화하지 않도록.

### [INFO] `2-trigger-list.md` §3 의 `authConfigId` 오류 코드 표현이 이중적("400 `VALIDATION_ERROR` 또는 `AUTH_CONFIG_NOT_FOUND`")

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §3, `PATCH /api/triggers/:id` 본문 설명
  ("소속 검증은 backend `triggers.service` 가 `authConfigsService.findById(id, workspaceId)` 로 수행,
  미스매치 시 400 `VALIDATION_ERROR` 또는 `AUTH_CONFIG_NOT_FOUND`").
- **충돌 대상**: `spec/1-data-model.md` §1.1 거부 응답 문단("트리거 `authConfigId` 는 400
  `AUTH_CONFIG_NOT_FOUND`" — 단일 코드) · `spec/5-system/3-error-handling.md` §1.11 표(`AUTH_CONFIG_NOT_FOUND`
  하나만 등재, `details: { field: 'authConfigId', code: 'INVALID_FIELD' }` 단일 객체) ·
  `spec/5-system/2-api-convention.md` §5.3 실례(`AUTH_CONFIG_NOT_FOUND` + 객체 `details`).
- **상세**: 셋 다 `authConfigId` 미스매치의 top-level 코드를 `AUTH_CONFIG_NOT_FOUND` 하나로 단정하는데,
  `2-trigger-list.md` 만 "`VALIDATION_ERROR` 또는" 을 병기해 두 코드가 갈릴 수 있는 것처럼 읽힌다.
  `git log -S` 로 확인한 결과 이 문구는 2026-05-28 (`54fcc827a`, webhook 인증 AuthConfig 전환) 부터
  있던 표현으로 **이번 PR 이 새로 만든 문장이 아니다** — 새 결함이 아니라 기존 표현의 잔존 모호성이라
  INFO 로 낮춘다. `status` 코드는 둘 다 400 이라 실제 동작 충돌은 아니고 코드명 표기의 모호함뿐이다.
- **제안**: 이번 PR 범위는 아니지만, 다음에 `2-trigger-list.md` 를 만질 때 "또는" 을 지우고
  `AUTH_CONFIG_NOT_FOUND` 단일로 정리해 세 문서와 표현을 맞춘다.

---

## 요약

이번 재실행이 재판정 대상으로 지정한 두 Critical(`1-workflow-list.md` §3.1·Rationale §3,
`data-flow/11-workflow.md` §1.2 각주)은 두 차례의 planner 턴을 거쳐 지금 규칙(`1-data-model.md#11-참조의-소속`)과
정합하고 `pending_plans` 로 올바르게 추적된다 — 재-flag 대상 아니다. 다만 그 두 건을 고치는 과정에서
드러난 근본 패턴("구현 전 상태를 현재형으로 단언 + 미추적")이, 가드가 순회하지 않는 `1-data-model.md`
자체와 이 검사 대상 필드를 소유하지만 침묵하는 4개 문서(트리거·스케줄·알림 규칙·지식 베이스)에는
그대로 남아 있다. 직접적인 상호 모순(두 문서가 서로 다른 주장을 하는 것)은 아니고 SoT 문서
(`1-data-model.md`, `status: implemented`)의 단언이 실제 구현·자매 문서의 침묵보다 앞서 있는
"documented guarantee wider than built" 유형이라 WARNING 으로 판정한다. 그 외에는 요구사항 ID·RBAC·
계층 책임·상태 전이 축에서 새로 발견된 충돌이 없다.

## 위험도

LOW
