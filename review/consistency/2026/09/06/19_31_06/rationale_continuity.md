# Rationale 연속성 검토

## 검토 범위 메모

- scope(`spec/2-navigation/`) 델타: 0개 파일 — 이 브랜치는 해당 spec 영역 문서를 바꾸지 않았다 (정상, 코드 전용 PR).
- 구현 diff 23개 파일 중 `spec/2-navigation/`의 frontmatter `code:` 목록과 실제로 겹치는 것은 `codebase/backend/src/modules/triggers/triggers.controller.ts` / `triggers.service.ts` (→ `2-trigger-list.md`) 뿐이다. `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`(`joinedAt` 필드 추가)는 `9-user-profile.md`/`6-config.md`의 `code:` 목록에 없고, 두 문서 본문에서도 `joinedAt`을 서술하지 않아 이 영역의 Rationale 대조 대상이 아니다(cross-spec/문서-동기화 관점의 별건).
- `workflow-versions.service.ts`, `workspace-rbac.e2e-spec.ts`, `pg-error.ts`, `user-entity-exposure-guard` 등 나머지 diff는 `spec/2-navigation/`과 코드 매핑이 없어(3-workflow-editor·5-system 영역) 본 검토 대상 밖으로 제외했다.

## 발견사항

### [INFO] TRIGGER_ENDPOINT_PATH_CONFLICT 의 `details.code` 표현이 `2-api-convention.md` 의 기존 원칙과 결이 다를 수 있음 — 단, 이미 planner 항목으로 등재됨

- target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표 (`PATCH`/`POST /api/triggers` 행의 "409 `RESOURCE_CONFLICT`(세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)") + 구현 `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict()`
- 과거 결정 출처: `spec/5-system/2-api-convention.md` `## Rationale` "413 PAYLOAD_TOO_LARGE 를 전역 표준 코드로 등재" 항 — *"일반 신규 코드는 전역 코드를 쓰고 도메인 특화 한도가 있을 때만 별도 코드를 신설하는 원칙"* (도메인 특화 상황에는 **top-level `code` 자체를 새 값으로 교체**하는 사례, 예: `PUBLIC_WEBHOOK_BODY_TOO_LARGE`)
- 상세: 이번 diff 는 `(workspace_id, endpoint_path)` UNIQUE 충돌을 top-level `code: 'RESOURCE_CONFLICT'`(불변) + `details: { code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`(신설) 2계층으로 구현했다. 이는 `2-trigger-list.md` §3 자체가 이미 문서화해 둔 문구("409 `RESOURCE_CONFLICT` (세부 코드 …)")를 문자 그대로 실현한 것이라 **target 문서 자신의 서술을 뒤집은 것은 아니다.** 다만 `413` 선례처럼 "도메인 특화 케이스는 top-level `code` 를 교체"하는 원칙과는 결이 다르고, 저장소에는 이미 top-level `code` 교체 선례가 7건 있어(리뷰 코멘트 자체가 이를 인지) 두 관례가 공존한다. `2-api-convention.md §5.3` 은 어느 쪽이 기본인지 명문화하지 않은 상태다.
- 이것이 CRITICAL/WARNING이 아닌 이유: (a) `2-trigger-list.md`가 과거에 다른 표현 방식을 채택했다가 이번에 무근거로 뒤집은 사례가 아니다(기존 문구를 그대로 구현) (b) 개발자가 이 tension을 코드 주석 + `plan/in-progress/spec-draft-nullable-notation-followups.md`(라인 631~643, "도메인 세부 에러 코드의 표현 방식을 정식화한다", planner 항목, 2026-09-06 등재)에 **은폐하지 않고 명시적으로 등재**했다.
- 제안: 별도 조치 불요 — 이미 등재된 planner 항목(`2-api-convention.md §5.3`에 택일 기준 명문화 + `3-error-handling.md §1` 카탈로그 등재)이 이 tension을 해소할 예정이다. 이번 rationale_continuity 검토는 그 항목이 실제로 plan에 존재함을 재확인했다는 점만 기록한다.

## 확인했으나 문제 없음으로 판정한 항목 (참고)

- `triggers.controller.ts`/`triggers.service.ts`의 409 `RESOURCE_CONFLICT` 구현은 `2-trigger-list.md`의 R-1~R-16 어느 항목과도 충돌하지 않는다. 오히려 §3가 이미 문서화했던("문서한 보장이 구현보다 넓었다" — 코드 주석이 자인) 계약을 뒤늦게 코드로 메운 것으로, "과거 Rationale이 기각한 대안의 재도입"이 아니라 "spec-vs-code 갭 해소"에 해당한다.
- `workspace-response.dto.ts`의 `joinedAt` 필드 추가(`nullable: true`)는 `spec/1-data-model.md` §2.3의 `joined_at: Timestamp?`(nullable) 정의와 정합하며, `spec/2-navigation/` 어느 Rationale과도 충돌하지 않는다.
- R-14(inline 인증 필드 제거), R-15(무인증 경고), R-CC-10(bot token single-path rotate) 등 트리거 인증/Chat Channel 관련 Rationale에 영향을 주는 코드 변경은 이번 diff에 없다.

## 요약

이번 diff가 `spec/2-navigation/` 코드 매핑에 실제로 접촉하는 지점은 트리거 `endpointPath` UNIQUE 충돌 처리 신설(`triggers.controller.ts`/`triggers.service.ts`)뿐이며, 이는 `2-trigger-list.md` §3이 이미 서술해 둔 409 계약을 그대로 실현한 것이라 과거 결정의 재도입·번복·원칙 위반에 해당하지 않는다. 유일한 잔여 이슈는 세부 에러 코드 표현 방식(`details.code` 중첩 vs top-level `code` 교체)이 저장소 내 다른 선례·`2-api-convention.md`의 413 원칙과 결이 다를 수 있다는 점인데, 이는 이미 개발자 스스로 planner 항목으로 투명하게 등재해 두었으므로 은폐된 결정 번복이 아니다. 그 외 diff의 나머지 부분(workflow-versions, workspace-rbac, user-entity-exposure-guard 등)은 `spec/2-navigation/`과 코드 매핑이 없어 본 영역 Rationale 연속성과 무관하다.

## 위험도

LOW
