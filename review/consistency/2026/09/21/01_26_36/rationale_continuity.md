# Rationale 연속성 검토

## 검토 대상

- scope: `spec/2-navigation` (diff-base `origin/main`) — spec 델타 0 (코드 전용 PR, 정상)
- 구현 diff: `codebase/backend/src/modules/schedules/schedules.service.ts`(+52/-16),
  `codebase/backend/src/modules/schedules/schedules.service.spec.ts`(+156),
  `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`(신규),
  `CHANGELOG.md`, `plan/in-progress/schedule-dup-delete.md`(신규),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신)
- 주제: `SchedulesService.remove()` 동시 DELETE 두 건이 `schedule.deleted` 감사 행을 두 번 남기던
  결함을, 트리거·워크플로·워크스페이스 삭제(#1369·#1370)와 같은 결함 클래스의 네 번째 자리로 처리.

## 발견사항

- **[INFO]** 스케줄 축의 "동시 삭제 → 두 번째 404" 계약이 `3-schedule.md` §4 본문에는 아직 없음 — 이미 자체 추적 중
  - target 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()` (신규 `affected === 0` 판정), CHANGELOG "동시 DELETE 두 건이 `schedule.deleted` 감사 행을 두 번 남기던 것" 항목
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §4.4 "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"
  - 상세: 이번 구현은 트리거 목록 §4.4 에 이미 적힌 "동시 삭제 → 두 번째 404" 원칙을 스케줄 삭제 경로(schedule → trigger cascade)에도 일관되게 적용한 것으로, 원칙과 **합치**한다(원칙 위반 아님). 다만 이 계약을 명시하는 spec 문장은 여전히 trigger-list.md §4.4 에만 있고 `3-schedule.md` §4 에는 없다. CHANGELOG 는 이를 `spec_impact: none`("기존 정책에 맞추는 것")으로 명시적으로 판단했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 "`3-schedule.md` §4 에 «동시 삭제 → 두 번째 404» 서술이 없다"는 항목을 이미 이번 diff 에서 추가해 등재했다(planner 대상, 낮은 우선순위, `--impl-prep` 세 라운드 연속 비차단 처분 이력 포함).
  - 제안: 이미 트래커에 등재돼 있어 별도 조치 불요. 추후 planner 턴에서 `3-schedule.md` §4 API 표 근처에 trigger-list.md §4.4 와 동일한 "동시 삭제 → 404" 한 문장을 추가하면 문서-구현 간극이 닫힌다.

- **[INFO]** 판정 기준(discriminator)이 형제 경로와 다른 이유가 명시적으로 정당화됨 — 원칙의 예외가 아니라 CASCADE 위상 차이에 따른 정당한 분기
  - target 위치: `schedules.service.ts` `remove()` — `m.delete(Trigger, triggerId)` 의 `affected`를 판정자로 사용 (스케줄 자신의 `scheduleRepository.remove` 결과가 아님)
  - 과거 결정 출처: `triggers.service.ts` `remove()`(형제 #1370, `m.findOne` 재조회로 판정) · `trigger-config-lock.ts`(자매 함수 `rewriteTriggerConfigLocked`, "`affected === 0` 명시 비교, `null`/`undefined`는 모른다로 취급" 관례)
  - 상세: 형제 세 경로(워크플로·워크스페이스·트리거)는 "자기 자신의 행을 지운 결과"로 판정하지만, 이번 스케줄 경로는 `schedule.trigger_id → trigger` FK 가 `onDelete: CASCADE`라 승자 쪽도 스케줄 행 자체는 0행이 되는 구조적 함정이 있어 트리거 삭제의 `affected`를 판정자로 삼았다. 코드 주석·CHANGELOG·plan 세 곳 모두 이 편차의 이유를 재현(둘 다 204/404가 아니라 둘 다 404가 되는 함정)과 함께 명시했고, "모른다(null)를 없다(0)로 읽지 않는다"는 `=== 0` 명시 비교 관례는 `rewriteTriggerConfigLocked` 선례를 그대로 계승했다. 결정 번복이 아니라 기존 관례의 정합적 확장.
  - 제안: 조치 불요. (참고로 이 근거 자체가 대조군 테스트(`affected === 0` 커밋)로 뮤테이션 검증되어 있음 — 근거 신뢰도 높음)

- **[INFO]** §4.3 "트리거 행을 없애는 모든 경로는 자원을 정리한다"(2026-09-17 결정) invariant 준수 확인
  - target 위치: `schedules.service.ts` `remove()` — `removeJob`(외부 자원, 트랜잭션·락 밖) → 락 안 `m.delete(Trigger)` → `deleteTriggerSecretsAfterCommit`(커밋 후)
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §4.3 하단 표 "외부 자원은 행 삭제 **전**·트랜잭션 **밖** / `secret_store` 비밀은 행 삭제가 **커밋된 뒤**"
  - 상세: 이번 diff 는 기존 순서(외부 해제 → 트랜잭션 내 삭제 → 커밋 후 비밀 정리)를 그대로 유지한 채 트랜잭션 내부에 `affected` 판정만 추가했다. 락 대기 상한도 동일 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5초, `trigger-config-lock.ts`)를 재사용해 §4.4 "락 대기 상한 5초" 조항과 일치한다. 위반 없음, 참고로 기록.
  - 제안: 조치 불요.

## 요약

이번 변경은 신규 대안 채택이 아니라, 이미 세 자매 PR(#1369 워크플로/워크스페이스, #1370 트리거)이 확립한 "동시 DELETE 시 진 쪽은 감사 없이 404를 받는다"는 원칙을 스케줄 경로에 마지막으로 적용한 것이다. `spec/2-navigation/2-trigger-list.md` §4.3(자원 정리 시점 invariant)·§4.4(동시 삭제 404·5초 락 상한) 어느 것도 위반하지 않았고, 판정 기준이 형제들과 다른 부분(트리거 `affected`를 판정자로 씀)도 CASCADE 구조 때문에 발생하는 함정을 코드 주석·CHANGELOG·plan 세 곳에 걸쳐 재현과 함께 명시적으로 정당화했다. `=== 0` 명시 비교 관례는 기존 `rewriteTriggerConfigLocked` 선례를 그대로 계승한 것이며, 관련 미러 문서 격차(3-schedule.md §4 에 "동시 삭제 404" 서술 부재)는 트래커에 이미 등재되어 무근거 누락이 아니라 의도적으로 유예된 낮은 우선순위 항목이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 카테고리에도 해당하는 CRITICAL/WARNING 사안을 발견하지 못했다.

## 위험도

NONE
