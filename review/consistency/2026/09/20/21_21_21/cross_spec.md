# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-done)

## 검토 방법

target scope(`spec/2-navigation`)의 spec 파일 델타는 0(정상 — 이번 브랜치는 코드 전용 PR).
대신 실제 구현 diff(HEAD vs `origin/main`, 9 파일)를 워킹트리 절대경로로 직접 확인했다:

- `codebase/backend/src/modules/triggers/trigger-resource-release.ts` / `trigger-resource-releaser.service.ts`
  — `lockParentAndListTriggerIds` 반환 타입을 `string[]` → `{ parentPresence: 'present'|'absent'; triggerIds: string[] }` 로 변경
- `codebase/backend/src/modules/workflows/workflows.service.ts` — `parentPresence === 'absent'` 시 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 로 단락, `.catch` 에서 해당 케이스는 error 로그 생략
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` — 동일 패턴, `NotFoundException({ code: 'WORKSPACE_NOT_FOUND' })`
- 관련 unit/e2e 테스트 + `plan/in-progress/dup-delete-audit.md` + `CHANGELOG.md`

목적은 동시 DELETE 두 번째 요청이 감사 행을 중복 기록하던 결함 수정(승자 204, 패자 404).
`spec/2-navigation/2-trigger-list.md §4.4` 가 이미 트리거 삭제에 대해 이 계약("두 번째는 404
`RESOURCE_NOT_FOUND`")을 선언하고 있고, 이번 PR은 워크플로·워크스페이스 삭제를 그 선례에
맞추는 것이다(`plan` 의 `spec_impact: none` 근거).

## 발견사항

- **[WARNING]** `spec/data-flow/12-workspace.md §1.10` 이 새 동시-삭제 단락 경로를 반영하지 못해 로그 서술이 부분적으로 stale
  - target 위치: (impl-done 스코프 밖이지만 target 이 구현한 워크플로/워크스페이스 삭제 동작) `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()` 의 `.catch` 블록 — `if (err instanceof NotFoundException) throw err;` 로 로그 생략 후 재던짐
  - 충돌 대상: `spec/data-flow/12-workspace.md` §1.10 표의 `DELETE /api/workspaces/:id` 행 — "트랜잭션이 실패하면(**재검사 거부 포함**) 외부 해제가 이미 끝났다는 사실을 **서버 로그에 남긴다**" 라고 명시
  - 상세: 이번 PR 은 `assertWorkspaceDeletable` 재검사가 거부되는 경우를 두 갈래로 나눴다 — (a) `lockParentAndListTriggerIds` 의 `parentPresence === 'absent'`(동시 삭제로 부모 행이 이미 사라짐, 정상적인 승자/패자 레이스)는 `NotFoundException`으로 단락하고 **error 로그를 남기지 않는다**(거짓 "수동 정리 필요" 경보를 막기 위한 의도된 변경), (b) 그 외의 재검사 거부(예: 진짜 권한 변경·경합)만 기존처럼 `logger.error` 를 남긴다. 그런데 §1.10 은 여전히 "재검사 거부 **포함**" 모든 실패를 로그에 남긴다고 무조건적으로 서술해, (a) 케이스에서는 더 이상 사실이 아니다. `spec/2-navigation` 델타가 0이라 이 문서는 이번 PR 로 갱신되지 않았다
  - 제안: `spec/data-flow/12-workspace.md §1.10` 의 해당 문장을 "재검사 거부 중 **동시 삭제로 부모가 이미 사라진 경우(404 `WORKSPACE_NOT_FOUND`)는 예외**이며, 이 경우는 로그를 남기지 않는다"로 갱신. `project-planner` 턴에서 처리

  **참고 — 이미 백로그에 등재된 인접 발견과의 관계**: 이 문서(target) 자체에는 이번 PR 로 인한 변경이 없고,
  아래 표가 보여주듯 "동시 삭제 → 두 번째 404" 대칭 서술 누락은 이미 3라운드 연속 `/ai-review`(가장 최근
  `review/code/2026/09/20/21_07_19` api_contract/requirement INFO 8)가 포착해 `plan/in-progress/spec-draft-nullable-notation-followups.md:4761`
  에 planner 항목으로 등재돼 있다(`--impl-prep` 부터 "비차단" 처분, 급하지 않음으로 명시). 단 그 백로그 항목의
  현재 문구는 "«동시 삭제 → 두 번째 404» 서술이 없다"만 다루고 **로그 억제(위 (a)/(b) 분기) 자체는 언급하지
  않는다** — 후속 planner 턴이 §1.10을 고칠 때 이 로그-서술 정정도 함께 반영해야 완전해진다. 새로 발견된
  결함이 아니라 기존 등재 항목의 스코프를 한 단계 더 구체화하는 보강 지적이다

- **[INFO]** `spec/2-navigation/1-workflow-list.md §2.6`(삭제 액션) 도 동일한 비대칭
  - target 위치: 없음(spec/2-navigation 델타 0 — 이 항목은 코드가 앞서 나간 상태)
  - 충돌 대상: `spec/2-navigation/1-workflow-list.md §2.6` "삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거는 함께 삭제된다..." — 트리거 목록 §4.4 처럼 "동시 삭제 시 두 번째 요청은 404" 문구가 없음
  - 상세: 워크플로 삭제 API(`DELETE /api/workflows/:id`)의 응답 계약이 이번 PR 로 "둘 다 성공" → "승자 204 / 패자 404 `RESOURCE_NOT_FOUND`" 로 바뀌었으나, 이를 설명하는 대칭 서술이 §2.6 에 없다. 트리거 목록 §4.4 만 이 계약을 문서화한 비대칭 상태
  - 제안: 위 워크스페이스 건과 함께 `plan/in-progress/spec-draft-nullable-notation-followups.md:4761` 항목이 이미 커버 — 별도 조치 불필요, 그 항목 처리 시 함께 반영

## 요약

이번 PR 은 `spec/2-navigation` 자체를 건드리지 않는 코드 전용 변경(동시 DELETE 감사 중복 수정)이며,
트리거 목록 §4.4 가 이미 선언한 "동시 삭제 → 두 번째 404" 계약에 워크플로·워크스페이스 삭제를 맞추는
정합적인 변경이다. 새로 도입한 에러 코드(`RESOURCE_NOT_FOUND`/`WORKSPACE_NOT_FOUND`)는 각 모듈이 이미
쓰던 기존 컨벤션을 그대로 재사용해 에러 코드 체계(`spec/5-system/3-error-handling.md`)와 충돌하지
않는다. 유일한 실질적 갭은 `spec/data-flow/12-workspace.md §1.10`(다른 영역 문서)의 로그 서술이 새 예외
분기를 반영하지 못해 부분적으로 stale 하다는 점인데, 이는 인접한 "동시 삭제 404 대칭 서술 누락"과 함께
이미 3라운드 연속 리뷰가 포착해 planner 백로그(`spec-draft-nullable-notation-followups.md:4761`)에
낮은 우선순위·비차단으로 등재돼 있다. RBAC·데이터 모델·요구사항 ID·계층 책임 축에서는 충돌을 찾지
못했다.

## 위험도

LOW
