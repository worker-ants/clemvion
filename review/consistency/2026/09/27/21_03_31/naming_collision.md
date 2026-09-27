# 신규 식별자 충돌 검토 — `spec/2-navigation/` (cross-workspace-refs, `--impl-prep`)

## 검토 범위 및 방법

target 은 `spec/2-navigation/` (특히 `1-workflow-list.md` · `2-trigger-list.md`)과, 이를 낳은
`plan/in-progress/cross-workspace-refs.md`, 그리고 그 결과 이미 착지한 `spec/1-data-model.md §1.1
참조의 소속` · `spec/data-flow/12-workspace.md` Rationale 절이다. 신규로 도입되는 식별자 후보를
전수 추출해(에러 코드, section 제목, API 엔드포인트, 파일 경로, 테스트 파일명) 저장소 전체에서
grep 하여 기존 사용처와의 의미 충돌 여부를 확인했다.

## 발견사항

- **[INFO]** "cross-workspace" 어휘가 이미 두 개의 다른 방어선을 가리키고 있어 동명이의 혼동 여지가 있다
  - target 신규 식별자: `spec/1-data-model.md §1.1 참조의 소속`(저장 전 소속 검사) + 신규
    `codebase/backend/test/cross-workspace-references.e2e-spec.ts` — "쓰기 요청 본문의 참조 id 가
    다른 워크스페이스/워크플로를 가리키는 것을 저장 전에 차단"하는 새 계층
  - 기존 사용처: `spec/4-nodes/2-flow/1-workflow.md:75,273` · `spec/5-system/3-error-handling.md:149` 의
    `assertSameWorkspace` / `WORKFLOW_FORBIDDEN_WORKSPACE` (W-6) — sub-workflow **실행 시점** 호출자·대상
    워크스페이스 불일치를 막는 기존 guard. 두 곳 모두 "cross-workspace" 라는 표현을 그대로 쓴다
    (`error-handling.md:149` "cross-workspace(또는 호출자 컨텍스트 누락) sub-workflow 호출 차단").
  - 상세: 식별자 자체(에러 코드·함수명)는 겹치지 않는다 — 신규 검사는 `VALIDATION_ERROR`/
    `INVALID_FIELD`(또는 `MODEL_CONFIG_NOT_FOUND`/`AUTH_CONFIG_NOT_FOUND`, 둘 다 기존 코드 재사용)를
    쓰고, 기존 W-6 guard 는 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 쓴다. 다만 두 방어선이 "저장 전 참조
    소속 검사"(신규, §1.1) vs "실행 시점 워크스페이스 격리"(기존, W-6)로 계층이 다른데도 spec 상
    별도 상호 참조가 없어, 향후 구현자가 신규 검사 헬퍼를 `assertSameWorkspace` 라는 기존 이름으로
    다시 명명하거나 두 개념을 하나의 가드로 오인해 합칠 위험이 있다(실제로 새 검사 대상 중 캔버스
    노드/엣지는 "같은 워크플로" 범위라 W-6 의 "같은 워크스페이스" 범위와도 다르다 — §1.1 표 참고).
  - 제안: 크리티컬은 아니므로 즉시 변경을 요구하지 않되, 구현 단계(`developer`)에서 신규 저장-전
    검사 헬퍼를 명명할 때 `assertSameWorkspace`(sub-workflow 실행 guard, 기존)와 구분되는 이름
    (예: `assertRequestRefBelongsToWorkspace` 류)을 쓰도록 impl-prep 인수인계에 남겨 두면 좋다.

## 확인 완료 — 충돌 없음 (참고용 negative 기록)

- `MODEL_CONFIG_NOT_FOUND` / `AUTH_CONFIG_NOT_FOUND` — `spec/1-data-model.md:76-77` 이 재사용을
  명시한 대로, `spec/5-system/3-error-handling.md:87-88,254` · `spec/conventions/error-codes.md:173` ·
  `codebase/backend/src/modules/model-config/model-config.service.ts` 등 기존 카탈로그에 이미
  등재된 코드이며 의미도 동일(모델 설정/AuthConfig 미존재 또는 타 워크스페이스 소속 차단)하다 —
  target 이 새 의미를 얹지 않는다.
- `details: [{ field, message, code: 'INVALID_FIELD' }]` (배열 형태) — `spec/5-system/2-api-
  convention.md §5.3` 이 배열/객체 두 형태 모두 기존에 유효하다고 이미 규정하고 있어(§5.3 "details
  의 형태는 두 가지이고 둘 다 유효하다"), target 이 folder POST 등에서 배열형으로 통일하는 것은
  기존 규약 재사용이지 신규/충돌 형태가 아니다.
- `spec/1-data-model.md §1.1 참조의 소속` — 문서 내 유일한 절 번호이며, 다른 spec 문서에 동일 번호
  · 동일 제목의 절이 없다(anchor 충돌 없음).
- `spec/data-flow/12-workspace.md` Rationale "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)" —
  동일 제목의 기존 절 없음.
- `codebase/backend/test/cross-workspace-references.e2e-spec.ts` — 기존 테스트 파일명과 겹치지 않음
  (`ls codebase/backend/test/` 확인, 유일 파일).
- 신규 엔드포인트·엔티티·ENV var·webhook/queue 이벤트명은 도입되지 않았다 — target 은 기존
  `POST /api/workflows` · `POST/PATCH /api/folders` · `POST/PATCH /api/workflow-assistant/sessions` ·
  `POST/PATCH /api/knowledge-bases` · 캔버스 저장 · 엣지 생성 엔드포인트에 **저장 전 검증 강화**만
  추가한다(신규 route 없음).

## 요약

target 이 새로 도입하는 식별자는 `spec/1-data-model.md §1.1`(신규 절)과 신규 e2e 파일명뿐이며,
둘 다 grep 전수 확인 결과 기존 사용처와 이름·의미 충돌이 없다. 에러 코드(`MODEL_CONFIG_NOT_FOUND` ·
`AUTH_CONFIG_NOT_FOUND` · `VALIDATION_ERROR`/`INVALID_FIELD`)와 `details` 배열 형태는 모두 기존에
이미 등재·규정된 것을 그대로 재사용하는 것으로 확인했다. 유일한 주목할 지점은 "cross-workspace"
라는 어휘가 기존 W-6 sub-workflow 실행 격리 guard(`assertSameWorkspace` / `WORKFLOW_FORBIDDEN_
WORKSPACE`)와 개념적으로 인접해 있다는 점인데, 식별자 자체는 겹치지 않으므로 INFO 수준의 명명
유의 권고로 충분하다.

## 위험도

LOW
