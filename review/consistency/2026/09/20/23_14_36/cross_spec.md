# Cross-Spec 일관성 검토 — cross_spec

- 검토 모드: `--impl-done`, scope=`spec/2-navigation`, diff-base=`origin/main`
- spec 델타: 0개 파일 (이 브랜치는 `spec/**` 을 바꾸지 않았다 — `spec_impact: none` 과 합치)
- 구현 diff (실측, `git diff origin/main...HEAD -- codebase/`): 3개 파일 / 214줄
  - `codebase/backend/src/modules/triggers/triggers.service.ts` (+14)
  - `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (+74/-1)
  - `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` (+127, 신규)

## 변경 내용 요약

`TriggersService.remove()` 가 advisory lock(`trigger-config:<id>`)을 잡은 **뒤** 행이 아직 있는지
재조회(`workspaceId` 스코프 포함)하도록 바꿨다. 없으면 `404 RESOURCE_NOT_FOUND` 로 트랜잭션을
롤백하고, `.catch` 블록에서 `NotFoundException` 을 "반쯤 삭제됨" 거짓 에러 로그와 분리했다. 동시
DELETE 두 건이 `trigger.deleted` 감사 행을 두 번 남기던 결함을 고친 것으로, **새 정책을 도입한 것이
아니라 이미 `spec/2-navigation/2-trigger-list.md` §4.4 가 선언한 "동시 삭제: 두 번째는
`404 RESOURCE_NOT_FOUND`" 를 실제 코드가 지키게 만드는 정합화**다.

## 점검 관점별 확인

1. **데이터 모델 충돌** — 없음. Trigger·audit_log 엔티티/컬럼 변경 없음.
2. **API 계약 충돌** — 없음. `DELETE /api/triggers/:id` 의 응답 shape·상태 코드는 spec §4.4 원문과
   정확히 일치(`204`/`404 RESOURCE_NOT_FOUND`). 에러 코드 `RESOURCE_NOT_FOUND` 는
   `spec/5-system/3-error-handling.md` 의 전역 코드-상태 매핑(404)과 부합.
3. **요구사항 ID 충돌** — 신규 요구사항 ID 미부여. 해당 없음.
4. **상태 전이 충돌** — 없음. Trigger 삭제는 상태 머신이 아니라 단발성 삭제이며, 자매 축인
   `spec/2-navigation/3-schedule.md` 는 스케줄 자신의 동시 DELETE 감사 중복에 대해 아무 주장도
   하지 않아(grep 0건) 이 fix 가 그 문서를 거짓으로 만들지 않는다. plan
   (`plan/in-progress/trigger-dup-delete.md`) 도 `SchedulesService.remove()` 잔여 결함을 스스로
   "이 PR 밖" 으로 명시하고 트래커에 별도 항목으로 등재했다 — 은폐가 아니라 명시적 스코프 경계.
5. **권한·RBAC 모델 충돌** — 없음. 권한 게이트·역할 매트릭스 변경 없음.
6. **계층 책임 충돌** — 없음. 삭제 직렬화(advisory lock)·외부 자원 해제(락 밖)·비밀 정리(커밋 후)
   책임 분할은 `trigger-config-lock.ts` / `trigger-resource-release.ts` 기존 경계를 그대로 따르며
   spec §3(동시 쓰기 직렬화)·§4.3(cascade)이 이미 그린 자리다.

## 참고 — 이 fix 가 참조하는 선행 PR 과의 정합

`plan/complete/dup-delete-audit.md` (workflow·workspace 동일 결함 수정) 가 트리거 축의 결함을
"발견은 했으나 스코프 밖" 으로 남기며 트래커에 등재했고, 이번 PR 이 정확히 그 항목을 닫는다. 두 PR 의
처방 형태(락 뒤 재조회 → 부재 시 404, `.catch` 에서 `NotFoundException` 분리)가 동일해 코드베이스
전역에서 "동시 삭제 처리 패턴" 이 갈라지지 않는다 — 오히려 이번 diff 가 그 패턴을 트리거 축까지
넓혀 일관성을 **강화**한다.

`plan/complete/dup-delete-audit.md` 자신의 `--impl-done` 체크리스트가 남긴 WARNING(`data-flow/12-workspace.md`
§1.10 감사 로그 서술이 404 예외를 모름)은 워크스페이스 축 전용이며 이번 diff 가 건드리는 파일·경로와
무관하다 — 재인용하지 않는다(이미 그 PR 의 트래커 항목으로 처분됨).

## 요약

이번 diff 는 `spec/2-navigation/2-trigger-list.md` §4.4·§3 이 이미 선언한 동시 삭제 계약(404 응답,
advisory lock 기반 직렬화, 락 밖 외부 해제/커밋 후 비밀 정리)을 실제 코드가 지키도록 좁게 정합화한
버그 수정이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른
spec 영역과 모순되는 지점을 발견하지 못했다. 유일하게 언급할 만한 잔여 사실(스케줄 자신의 동시
DELETE 감사 중복)은 이 PR 이 스스로 스코프 밖으로 명시하고 트래커에 등재해 은폐 위험이 없다.

## 위험도

NONE
