# Rationale 연속성 검토 — spec/2-navigation/

## 검토 범위 요약

- `spec/2-navigation/` 자체 델타: **0개 파일** (이 브랜치는 그 spec 영역을 편집하지 않았다 — 정상).
- 구현 diff(20개 파일, 2584줄) 중 `spec/2-navigation/*.md` 의 `code:` frontmatter 가 지목하는 실제
  코드 경로와 교집합을 실측(`git diff origin/main...HEAD --stat`)으로 좁혔다:
  - `spec/2-navigation/2-trigger-list.md` → `codebase/backend/src/modules/triggers/triggers.service.ts`
    (+`.spec.ts`) **만 변경됨**. 같은 문서가 지목하는 controller/module/dto/frontend/
    `chat-channel-validation` 패키지는 **diff 0**.
  - `spec/2-navigation/3-schedule.md` → 지목 코드(schedules.*, workspaces.service.ts,
    update-workspace-settings.dto.ts, timezone.ts) **diff 0**.
  - 나머지 15개 `2-navigation/*.md` 파일 → 관련 코드 diff 0.
- 이 PR 의 실질 내용(`user-entity-column-defense`)은 `User` 엔티티 전 컬럼 노출 방어
  (`workflow-versions.service.ts`, `workspace-response.dto.ts` 등)로, 대부분
  `spec/3-workflow-editor/`·`spec/5-system/1-auth.md` 영역이며 `spec/2-navigation/` 범위 밖이다.

따라서 본 checker 의 실질 대상은 `triggers.service.ts` 1건으로 좁혀진다.

## 발견사항

검토 결과 `spec/2-navigation/` 의 `## Rationale`(R-1~R-16, schedule.md 의 3개 Rationale 항목)과
충돌하는 항목은 **없다**.

- **[없음] `triggers.service.ts` 의 `endpoint_path` UNIQUE 충돌 처리 — spec 과 정합**
  - target 위치: 구현 diff `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`rethrowEndpointPathConflict` 신설, `save()` 호출부 2곳에 `.catch()` 연결)
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §2.3.1 Webhook Configuration
    `endpointPath` 행 + §3 API 표 하단 note ("`(workspace_id, endpoint_path)` UNIQUE 위반 시
    409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)")
  - 상세: 신설 코드는 `code: 'RESOURCE_CONFLICT'` + `details: { field: 'endpoint_path', code:
    'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 정확히 이 문구 그대로 구현한다. 코드 주석은 "이 문자열이
    저장소 어디에도 없었다"(문서한 계약이 구현보다 넓었던 상태)를 스스로 밝히고, "top-level `code`
    를 특화 코드로 교체하는 선례도 있으나 이 자리는 spec 이 이미 두 층(status code + 세부 코드)으로
    나눠 적었으므로 그 서술을 그대로 실현한다"고 명시해 — `error-codes.md §4.2`(details 세부 코드
    파이프라인)·`api-convention.md §5.3`(details 는 선택 필드) 두 기존 규약과도 정합한다. 표현 방식
    자체를 표준화할지는 "planner 항목으로 등재"라고 이 PR 이 스스로 범위를 밝혀, 새 결정을 developer
    권한으로 슬쩍 확정하지 않았다.
  - 제안: 없음. rejected-alternative 재도입·원칙 위반·무근거 번복·invariant 우회 어느 것도 해당하지
    않는다.

- **[INFO] §5.4(부재 표현) 신규 필드 관련 spec 동기화는 이미 별도 plan 으로 추적 중 — 재등재 불필요**
  - target 위치: (참고) `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    의 `WorkspaceMemberDto.joinedAt` 신설. `spec/2-navigation/` 범위 밖 파일이라 본 checker 의
    직접 대상은 아니나, 인접 사례로 확인차 짚는다.
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4` ("기본은 `null`", 상시 존재 필드는
    `@ApiProperty({ nullable: true })`).
  - 상세: `joinedAt` 은 §5.4 의 "기본형"(null 허용·상시 존재) 을 정확히 따랐고 소스 주석에도 근거
    (모든 멤버 생성 경로가 `joinedAt: new Date()` 를 즉시 채움)를 실측으로 남겼다 — 위반 없음.
    `spec/2-navigation/3-schedule.md §4`/`2-trigger-list.md` 의 `trigger`/`workflow` 키-생략 필드
    사유를 spec 본문에 옮기는 작업은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (planner, 후속 체크박스로 이미 열려 있음)가 추적 중이라 이 PR 이 새로 만든 갭이 아니다.
  - 제안: 없음 (이미 추적됨). 참고용 기록.

## 요약

`spec/2-navigation/` 은 이번 PR 에서 편집되지 않았고(델타 0), 이 spec 영역이 지목하는 코드 중
실제로 변경된 것은 `triggers.service.ts` 의 `(workspace_id, endpoint_path)` UNIQUE 충돌 처리
뿐이다. 그 변경은 `2-trigger-list.md` §2.3.1/§3 이 이미 명문화한 409 `RESOURCE_CONFLICT` +
`details.field='endpoint_path'` + `TRIGGER_ENDPOINT_PATH_CONFLICT` 계약을 문자 그대로 실현한
것이며, R-1~R-16 어느 항목이 기각한 대안을 되살리거나 합의된 원칙(단일 편집 경로, authConfigId
단일 SoT, 호출 이력 분리 등)을 우회하지 않는다. 이 PR 의 본체(User 엔티티 컬럼 노출 방어)는
`spec/2-navigation/` 밖 영역(workflow-versions, workspace RBAC, auth)에 집중돼 있어 본 검토
범위와 교집합이 작다. Rationale 연속성 관점에서 위험 요소를 찾지 못했다.

## 위험도

NONE
