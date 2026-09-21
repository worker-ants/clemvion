# Cross-Spec 일관성 검토 — cross_spec

검토 모드: `--impl-done`, scope=`spec/2-navigation`, diff-base=`origin/main`.
scope 자체의 spec 델타는 0 파일(정상 — 코드 전용 PR). 실 구현 diff 는
`codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (+ 대응 unit/e2e 테스트),
그리고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 백로그 갱신 3파일/308줄이다.
프롬프트 번들이 예산 절단으로 실제 diff 와 `spec/2-navigation/6-config.md` 본문을 누락해,
아래는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/authconfig-dup-delete-7e3a1c`)를
절대경로로 직접 읽어 재확인한 결과다.

## 발견사항

- **[INFO]** `DELETE /api/auth-configs/:id` 의 "동시 삭제 → 두 번째 404" 계약이 `6-config.md` §3 에 미기재 — 단, 이미 추적 중인 백로그
  - target 위치: 코드 diff `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (`remove()` — `findById` 로 존재 확인 후 원자적 `delete({id, workspaceId})`, `affected === 0` 시 404 `RESOURCE_NOT_FOUND`)
  - 충돌 대상: `spec/2-navigation/6-config.md` §3 "Authentication API" 표 — `DELETE /api/auth-configs/:id | 삭제 (Admin+)` 한 줄뿐, 동시 삭제 시 두 번째 요청이 404 가 된다는 서술이 없다
  - 상세: 형제 엔드포인트인 `2-trigger-list.md §4.4` ("동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`")는 이미 이 계약을 명시하는데, `6-config.md` 의 AuthConfig 삭제는 아직 없다. 다만 이는 새로 발견된 갭이 아니다 — 이 PR 이 포함한 `plan/in-progress/spec-draft-nullable-notation-followups.md` diff 가 바로 이 목록을 갱신해 `6-config.md §A(DELETE /api/auth-configs/:id)`를 2026-09-21 기준 아홉 자리 스냅샷에 추가했고, 세 라운드 연속 "비차단(낮음)"으로 처분된 이력이 있다(동일 파일에서 `1-workflow-list.md §2.6` · `data-flow/12-workspace.md §1.10/§1.6` · `3-schedule.md §4` · `4-integration.md §9` · `9-user-profile.md §6.1` 도 같은 미기재 상태로 나열됨). `5-system/12-webhook.md`/`5-system/1-auth.md` 는 이 파일을 `code:` 로 지목하지만 삭제 계약을 서술하지 않아 대상 아님이 같은 diff 에서 확인됐다.
  - 제안: 별도 조치 불요 — 기존 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 이미 이 자리를 포함해 추적 중이며, 집행 시점에 재열거하기로 명시돼 있다. 재-flag 하지 말 것.

## 검증한 항목 (충돌 없음)

- **에러 코드 네임스페이스**: 새 `throwAuthConfigNotFound()` 가 던지는 `RESOURCE_NOT_FOUND`(404)는 `spec/5-system/3-error-handling.md §1.11`이 "이 저장소의 유일한 `_NOT_FOUND`≠404 예외"로 명시한 `AUTH_CONFIG_NOT_FOUND`(400, 트리거→AuthConfig 참조 검증 실패)와 코드 문자열·상태 코드가 다르며, 코드 주석도 이 구분을 정확히 인용한다. 혼용 없음.
- **FK/cascade 방향**: 이번 변경은 "AuthConfig 를 지울 때" 경로다. `2-trigger-list.md §4.3` 의 `auth_config_id` 행("trigger 측 FK 만 끊김 — auth_config row 자체는 삭제 안 됨")은 반대 방향("Trigger 를 지울 때")을 서술하므로 겹치지 않는다.
- **감사 로그 계약**: `spec/data-flow/1-audit.md` 는 `auth_config.delete` 액션을 "삭제" 로만 서술하고 동시성/카운트 불변식을 규정하지 않는다. 새 동작(진 쪽 요청은 감사 미기록)이 이를 위반하지 않는다.
- **동시성 처방의 계열 일관성**: `remove()` 원자적 `delete()` + `affected===0` 판정은 plan(`authconfig-dup-delete.md`)이 명시하듯 형제 PR #1369~#1373(트리거·스케줄·통합·멤버 등)과 동일한 처방 형태로, 새로운 패턴이 아니라 기존에 리뷰·채택된 패턴의 7번째 적용이다. RBAC·계층 책임 변경 없음(Admin+ 권한 그대로, 서비스 계층 내부 구현만 교체).
- **API 계약 자체는 불변**: 요청/응답 shape, HTTP 메서드, 상태 코드 후보(`204`/`404`)가 이전과 동일하다 — 다만 이전엔 두 번째 동시 삭제가 (버그로) 조용히 204 를 반환하며 감사 중복을 남겼고, 지금은 정상적으로 404 를 반환한다. 이는 버그 수정이지 계약 변경이 아니다.

## 요약

target(`spec/2-navigation`)은 이번 PR 에서 spec 델타가 없고, 실제 변경은 `auth-configs.service.ts` 의 동시 삭제 중복 감사 버그 수정(원자적 `DELETE` + `affected===0` 판정)이다. 이 처방은 이미 여섯 개 형제 자리에서 채택된 동일 패턴의 반복이며, 에러 코드 네임스페이스(`RESOURCE_NOT_FOUND` vs `AUTH_CONFIG_NOT_FOUND`)·FK 방향·감사 로그 계약 어느 것과도 충돌하지 않는다. 유일하게 걸리는 문서 갭("동시 삭제 → 두 번째 404"가 `6-config.md` Authentication API 표에 없음)은 이 PR 자신이 포함한 백로그 plan 이 이미 등재·추적 중이며 세 라운드 연속 비차단으로 처분된 항목이라 재차단 사유가 되지 않는다.

## 위험도

NONE
