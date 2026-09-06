# Rationale 연속성 검토 — spec/2-navigation (--impl-done)

## 검토 방법 메모

- 대상 scope(`spec/2-navigation/`) 의 spec 델타는 0개 파일 — 이번 브랜치는 그 영역의 spec 본문을 바꾸지 않았다.
- 실제 구현 diff(21파일/2671줄, `git -C <worktree> diff origin/main...HEAD`)를 절대경로로 직접 열어 확인했다. 핵심 변경은 `codebase/backend/src/common/db/pg-error.ts`, `modules/triggers/triggers.service.ts`, `modules/workflow-versions/workflow-versions.service.ts`, `modules/workspaces/dto/responses/workspace-response.dto.ts`, `repo-guards/__tests__/user-entity-exposure-guard.ts`, `shared/testing/user-secret-absence.ts`, `repo-guards/__tests__/dto-jsdoc-citation-guard.ts` 및 그 fixture/spec 들이다. spec 쪽 변경은 `spec/conventions/review-citations.md`·`spec/conventions/spec-impl-evidence.md` 두 파일뿐이며, 둘 다 `spec/2-navigation/` 밖의 프로세스/규약 문서다.
- 즉 target(`spec/2-navigation/`) 자체에는 이번 PR 로 인한 신규 서술도, Rationale 갱신도 없다. 검토는 "구현이 2-navigation 의 기존 R-1~R-16 및 §3/§4 서술을 위반하거나, 번들에 실린 타 spec Rationale(1-data-model, 3-workflow-editor/3-execution, 5-system/1-auth·2-api-convention·3-error-handling·6-websocket-protocol)의 기각된 결정을 재도입하는가" 를 기준으로 수행했다.

## 발견사항

- **[INFO]** Trigger 엔드포인트 충돌 코드의 위치가 기존 선례(top-level `code` 교체)와 다른 경로(`details.code`)를 택함 — 근거는 있으나 정식화 대기 중
  - target 위치: (구현) `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict()` — spec 위치는 `spec/2-navigation/2-trigger-list.md §3`("409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)")
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.3 행("`DUPLICATE_NODE_LABEL` — `RESOURCE_CONFLICT` 의 노드 라벨 특화 코드") 및 `spec/conventions/error-codes.md` §4.2("도메인 세부 사유 → 봉투 `error.details[].code`")가 공존하는 두 개의 선례
  - 상세: 이 리포지토리에는 도메인 특화 충돌을 표현하는 두 가지 기존 패턴이 있다 — (a) top-level `code` 자체를 특화 코드로 교체(예 `DUPLICATE_NODE_LABEL`, 7건 선례), (b) top-level `code`=`RESOURCE_CONFLICT` 유지 + `details.code` 로 세분화(§4.2 패턴). 이번 구현은 (b)를 택했는데, 코드 주석이 이를 "spec(`2-navigation/2-trigger-list.md §3`)이 이미 두 층으로 나눠 적어 두었기 때문" 이라고 명시적으로 근거를 대고, "표현 방식의 정식화는 planner 항목으로 등재했다" 고 적어 두었다. 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md:544` 에 "도메인 세부 에러 코드의 표현 방식을 정식화한다 (planner, 2026-09-06 등재)" 항목이 존재함을 확인했다 — 주장이 스테일하지 않다.
  - 이것은 "결정의 무근거 번복" 이 아니다: 기존 spec 서술을 그대로 구현했고, 두 선례 사이의 긴장을 인지·기록했으며, 정식화를 별도 planner 트랙으로 명시적으로 미뤘다. 다만 아직 **닫히지 않은 결정 축**이므로, 다음에 유사 케이스가 생길 때 이 두 패턴 중 하나를 다시 임의로 고르지 않도록 위 planner 항목이 실제로 처리될 때까지 추적 대상으로 남겨 둘 가치가 있다.
  - 제안: 별도 조치 불필요(이미 planner backlog 에 등재됨). 후속 세션에서 `spec-draft-nullable-notation-followups.md` 의 해당 체크박스가 처리될 때 `error-codes.md` 또는 `2-api-convention.md` 의 정식 원칙으로 승격되었는지 확인.

- **[INFO]** `select:false` 회피 결정은 기존 Rationale 과 정합 — 위반 아님(양성 확인)
  - target 위치: (구현) `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`CREATOR_PROJECTION`, `ProjectedCreator` 관련 주석)
  - 과거 결정 출처: `spec/conventions/secret-store.md` §1.1 ("컬럼 수준(`select: false`)은 그 컬럼을 읽는 내부 경로가 예외 없이 `undefined` 를 받아 조용히 오작동하므로 쓰지 않는다")
  - 상세: `workflow-versions.service.ts` 의 신규 주석은 "이 PR 이 `select:false` 를 기각한 이유(*"undefined 를 받고 조용히 실패"*)" 라고 명시하며, `secret-store.md` §1.1 이 이미 기각한 대안(`select:false`)을 재도입하지 않고 명시적 컬럼 projection(`CREATOR_PROJECTION`)으로 우회했다. 기존 Rationale 을 정확히 인지·계승한 사례로, 위반이 아니라 오히려 연속성이 지켜진 근거로 기록해 둔다.
  - 제안: 없음(정상).

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드 — 2-navigation 기존 Rationale 과 충돌 없음
  - target 위치: (구현) `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 원칙(기본형 vs present-when-available 구분)
  - 상세: 신규 필드는 "무조건 값을 채워 보내는 §5.4 기본형" 이라고 스스로 근거를 밝히고 있고(`WorkspacesService.listMembers` 가 항상 `joinedAt`을 채움을 실측으로 확인했다고 기술), `spec/2-navigation/6-config.md`·`spec/2-navigation/9-user-profile.md` 어디에도 이 필드를 배제하기로 한 기존 Rationale 이 없다(grep 0건). `spec/2-navigation/` 델타 자체가 0이라 이 필드가 그 문서들에 아직 반영되지 않은 것은 문서 동기화 이슈일 수 있으나, 본 검토(Rationale 연속성)의 범위인 "기각된 결정 재도입" 에는 해당하지 않는다.
  - 제안: 없음(Rationale 관점에서는 이슈 아님). 문서 동기화(§2-navigation/6-config.md 에 `joinedAt` 반영 여부)는 cross_spec/naming_collision 등 다른 축의 관할.

## 요약

이번 diff 는 `spec/2-navigation/` 본문·Rationale 을 전혀 건드리지 않았고(델타 0), 실제 코드 변경도 2-navigation 도메인(트리거/스케줄 화면)이 아니라 `User` 엔티티 시크릿 컬럼 노출 방어(triggers/workflow-versions/workspaces 서비스 계층)와 리뷰 인용 규약 강제화(review-citations.md)에 집중돼 있다. 확인한 세 지점(트리거 엔드포인트 충돌 코드의 위치 선택, `select:false` 기각 계승, `joinedAt` 신규 필드) 모두 기존 spec Rationale(`secret-store.md` §1.1, `error-codes.md` §4.2, `2-api-convention.md` §5.4, `2-trigger-list.md` §3)을 위반하거나 기각된 대안을 무단 재도입하지 않았다 — 오히려 기존 결정을 명시적으로 인용·계승하는 방향으로 일관됐다. 유일하게 열린 축(에러 코드 표현 방식의 두 선례 공존)은 이미 자체적으로 근거를 남기고 planner backlog(`spec-draft-nullable-notation-followups.md`)에 등재돼 있어 즉각적인 조치는 불필요하다.

## 위험도

NONE
