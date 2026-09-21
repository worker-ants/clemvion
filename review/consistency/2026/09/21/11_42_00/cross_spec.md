# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-done)

## 실측 메모 (판정 근거)

- `--impl-prep`/`--impl-done` 프롬프트 번들에는 예산 절단으로 `## 구현 변경 사항`(diff) 이 아예 실리지 않았다 (파일 끝은 "컨텍스트 예산 초과로 생략된 파일 94개" 목록으로 종료). 프롬프트 지시에 따라 diff 유무를 프롬프트만으로 판정하지 않고, HEAD 워킹트리에서 직접 `git diff origin/main...HEAD` 를 실행해 실제 변경분을 확인했다.
- 실제 코드 diff (`codebase/` 한정) 는 3개 파일:
  - `codebase/backend/src/modules/integrations/integrations.service.ts` (82줄)
  - `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (50줄)
  - `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` (신규, 117줄)
  변경 내용: `IntegrationsService.remove()` 의 동시 DELETE 중복 감사 로그 결함 수정 — 무락 `findOne` + `repository.remove(entity)` (0행이어도 예외 없음) 를 원자적 `repository.delete({id, workspaceId})` + `affected === 0` 판정으로 교체, 진 쪽은 `404 RESOURCE_NOT_FOUND` (감사·broadcast 생략). 부수로 `RESOURCE_NOT_FOUND` 리터럴 7곳을 `throwIntegrationNotFound()` 헬퍼로 통합.
- `spec/2-navigation` 자체 델타는 0 파일 — 이 PR 은 spec 을 변경하지 않았다. 이는 정상이며(코드 전용 PR), 그 자체로 결함이 아니다.

## 발견사항

### [INFO] `4-integration.md` 가 신규 확정된 "동시 삭제 → 두 번째 404" 계약을 아직 기술하지 않음 (이미 추적 중)

- target 위치: `spec/2-navigation/4-integration.md` §9.1 (`DELETE /api/integrations/:id` 행) · §9.4 (에러 코드 목록)
- 충돌 대상: `spec/2-navigation/2-trigger-list.md` §4.4 — "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 라고 명시적으로 기술
- 상세: 이번 PR 로 `IntegrationsService.remove()` 도 트리거·스케줄과 동일하게 "동시 삭제 시 진 쪽은 `404 RESOURCE_NOT_FOUND`, 감사 없음" 을 실제로 보장하게 됐다(e2e `integration-delete-concurrency.e2e-spec.ts` 로 `[204, 404]` 고정). 그런데 `4-integration.md` §9.1/§9.4 는 이 동작을 여전히 서술하지 않는다 (§9.1 은 "삭제 (사용처 있으면 409)" 만 언급). sibling 인 `2-trigger-list.md` 는 이미 이 문장을 갖고 있어 같은 `spec/2-navigation` 영역 안에서 문서화 밀도가 트리거만 다르다. 다만 이것은 **모순이 아니라 침묵**(4-integration.md 가 반대로 서술하는 것이 아니라 언급이 없는 것)이라 CRITICAL/WARNING 요건(직접 모순)에 해당하지 않는다.
- 이미 추적됨: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10 · `3-schedule.md` §4 · `4-integration.md` §9 에 «동시 삭제 → 두 번째 404» 서술이 없다" 항목이 2026-09-21 자로 `4-integration.md` §9 를 명시적으로 추가 등재했고 (근거: 이번 PR 의 `--impl-prep review/consistency/2026/09/21/10_27_27` W3), planner 소유로 넘겨져 있다. 이 항목은 이미 3라운드 연속 "비차단(INFO)" 으로 처분된 이력이 있다 — 재차 WARNING 으로 올릴 근거(모순 발생·범위 확대)가 이번 diff 에는 없다.
- 제안: 신규 조치 불요. 트래커 항목이 planner 턴에서 `4-integration.md` §9.1/§9.4 에 한 문장을 추가할 때 함께 닫힌다.

### [정보용 확인 — 결론 NONE] 형제 서비스와 처방이 다른 이유는 코드 주석·plan 에 이미 근거가 있음

- target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` (diff)
- 충돌 대상: `4-integration.md` `## Rationale` (advisory lock 기각 사유), `2-trigger-list.md` §3 "동시 쓰기 직렬화"(advisory lock 기반)
- 상세: diff 의 주석은 "`4-integration.md` Rationale 이 기각한 advisory lock 의 재도입이 아니다: 그 기각 사유는 «lock 보유 중 HTTP 요청» 이고 여기엔 외부 호출이 없으며, 애초에 락을 쓰지 않는다" 라고 스스로 경계를 긋는다. `4-integration.md` 를 직접 확인한 결과 해당 Rationale 은 `pg_advisory_xact_lock` 를 "lock 보유 중 HTTP 요청(Cafe24 endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고…" 라는 이유로 기각한 것이 맞고(OAuth/토큰 갱신류 자리 한정), 이번 delete 경로는 외부 호출이 없는 별개 자리라 그 기각 논리와 배치되지 않는다. 트리거·스케줄이 advisory lock 을 쓰는 이유(§3 "동시 쓰기 직렬화" — PATCH 등 부분 갱신 경합)와 통합 DELETE 가 원자적 `DELETE` 문 하나로 처리 가능한 이유도 서로 다른 문제(부분 갱신 vs 단순 삭제)라 처방 차이는 실제 설계 근거가 있다. 충돌 아님, 별도 조치 불요.

## 요약

이번 diff 는 `spec/2-navigation/4-integration.md` 가 `code:` frontmatter 로 소유하는 `IntegrationsService.remove()` 내부의 동시성 버그 수정(비원자적 `remove()` → 원자적 `delete()` + `affected` 판정)에 한정되며, 엔티티 필드·API shape·요구사항 ID·상태 머신·RBAC·계층 책임 중 어느 것도 새로 정의하거나 바꾸지 않는다. `spec/2-navigation` 델타 0 은 코드 전용 PR 로서 정상이다. 유일하게 짚을 만한 지점은 `4-integration.md` 가 트리거 목록(`2-trigger-list.md` §4.4)과 달리 "동시 삭제 → 두 번째 404" 계약을 아직 명문화하지 않은 비대칭인데, 이는 이번 diff 가 만든 신규 결함이 아니라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 등재되어 있고 3라운드 연속 비차단으로 처분된 사안이다. 코드 주석이 인용하는 `4-integration.md` Rationale(advisory lock 기각 사유)도 실제 spec 문구와 대조해 정합함을 확인했다. Cross-spec 관점에서 이 PR 을 막을 근거는 없다.

## 위험도

NONE
