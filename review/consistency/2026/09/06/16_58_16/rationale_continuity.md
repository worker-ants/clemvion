# Rationale 연속성 검토 — spec/2-navigation/

## 검토 방법

- scope(`spec/2-navigation/`) 델타는 0개 파일(정상 — 코드 전용 PR). 따라서 "target 문서의 신규 서술이 과거 Rationale 을 번복하는가"를 직접 물을 대상이 없다.
- 대신 실제 구현 diff(22파일/2699줄, 프롬프트 예산상 절단됨) 중 `spec/2-navigation/2-trigger-list.md` / `3-schedule.md` frontmatter `code:` 글로브에 걸리는 파일을 HEAD 워크트리에서 절대경로로 직접 diff 하여, 그 변경이 두 문서의 `## Rationale`(R-1~R-16) 및 함께 번들된 인접 spec(`1-data-model.md`, `5-system/1-auth.md`, `5-system/2-api-convention.md`, `5-system/3-error-handling.md`, `5-system/6-websocket-protocol.md`)의 Rationale 과 충돌하는지 대조했다.
  - `git -C <worktree> diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts`
  - `git -C <worktree> diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.spec.ts`
  - `git -C <worktree> diff origin/main...HEAD --stat` (전체 22파일 목록 확인)

## 발견사항

이 브랜치가 `spec/2-navigation/` 코드 글로브에서 건드린 유일한 파일은 `triggers.service.ts`(+`*.spec.ts`)이며, 변경 내용은 **`2-trigger-list.md §3`이 이미 문서화해 둔 계약**(`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT`, 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)을 **처음으로 실제 구현**한 것이다. 커밋 메시지·인라인 주석 스스로 "문서한 보장이 구현보다 넓었다"(`review/consistency/2026/09/06/14_26_32` Critical 1)는 선행 발견을 인용하며 그 갭을 닫는 형태로, spec 서술을 뒤집는 것이 아니라 **spec 서술 쪽으로 코드를 맞춘 사례**다. 신규 `isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict`도 다른 UNIQUE 위반은 그대로 흘려보내(전역 매핑에 위임) §5.3(api-convention.md)의 "일반 신규 코드는 전역 코드, 도메인 특화 한도만 별도 코드" 원칙과 정합적이다.

- **기각된 대안의 재도입**: 없음. 관련 스코프에 `/toggle` 서브경로 신설(R-4 기각 대안), inline 인증 필드 부활(R-14 기각 대안), `workflowId` 편집 허용(R-1) 등 이미 기각된 결정을 되살리는 변경이 diff 안에 없다.
- **합의된 원칙 위반**: 없음. `USER_SECRET_KEYS` 신규 가드(`user-secret-absence.ts`)는 스스로 "`select: false` 도 `@Exclude()` 도 없으므로 이 목록이 유일한 그물"이라고 명시해, `select:false`가 fail-silent라 기각됐던 과거 결정(메모리 `feedback_...`)을 되살리지 않고 오히려 그 결정과 정합적인 이름-기반 전수 검사 방식을 채택했다.
- **결정의 무근거 번복**: 없음. 이번 diff는 새로운 제품 결정을 내리는 것이 아니라 이미 spec에 적힌 계약을 코드로 실현한 것이라 "번복"에 해당하는 변화 자체가 없다.
- **암묵적 가정 충돌**: 없음. `endpoint_path` UNIQUE 제약을 인덱스 이름(`idx_trigger_workspace_endpoint`)으로 좁혀 판별하고, 이름이 바뀌면 조용히 전역 매핑으로 폴백하도록 만들어(fail-safe) 좁은 정의로 인한 회귀에 대비했다(단위 테스트 두 방향 모두 포함) — invariant 우회가 아니라 안전한 축소 방향.

스코프 밖에서 함께 변경된 `workflow-versions.service.ts`(User `creator` 관계 투영)·`workspace-response.dto.ts`(`joinedAt` 필드 추가)·`user-entity-exposure-guard.ts` 등은 `spec/2-navigation/`의 `code:` 글로브에 없고, `spec/2-navigation/` 어느 문서도 이 필드들을 언급하지 않아(`grep joinedAt spec/2-navigation/` 0건) 본 스코프의 Rationale 연속성 판단 대상이 아니다.

## 요약

`spec/2-navigation/` 스코프 델타는 0이었고, 그 영역의 `code:` 글로브에 걸리는 유일한 실제 변경(`triggers.service.ts`의 endpoint_path UNIQUE 충돌 처리)은 `2-trigger-list.md §3`이 이미 서술해 둔 계약을 처음 구현한 것으로, 기존 Rationale(R-1~R-16)이 기각한 대안을 되살리거나 합의된 원칙(단일 편집 경로, inline 인증 필드 제거 등)을 위반하는 지점이 없다. 새로 추가된 `User` 비밀 컬럼 부재 가드도 `select:false` 기각 이력과 정합적으로 설계됐다. Rationale 연속성 관점에서 이번 변경은 문제가 없다.

## 위험도

NONE
