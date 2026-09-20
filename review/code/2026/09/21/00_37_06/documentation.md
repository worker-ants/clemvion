# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 기존(트리거) 항목이 이번 PR 로 반증된 "남는 것" 서술을 그대로 두고 있다 — 두 항목이 인접해 있어 바로 위아래로 모순된다
  - 위치: `CHANGELOG.md:63-66` (기존 `## Unreleased — 동시 DELETE 두 건이 \`trigger.deleted\` 감사 행을 두 번 남기던 것` 항목의 "남는 것" 문단, 이번 diff 로 수정되지 않은 컨텍스트)
  - 상세: 이 문단은 "네 삭제 경로(트리거·워크플로·워크스페이스·스케줄) 중 `SchedulesService.remove()` 자신의 스케줄 행 삭제는 **아직 같은 결함을 갖고 있다**(락·재조회 밖에서 `scheduleRepository.remove` 호출)" 라고 적고 있다. 그런데 바로 위(`CHANGELOG.md:3-37`, 이번 diff 로 새로 추가된 항목)가 정확히 그 결함을 닫았다고 기록한다. 같은 파일 안에서 최신 항목이 "고쳤다" 고 말하는 것을, 그 바로 아래 더 오래된 항목이 "아직 결함이 있다" 고 계속 말하는 형태로 남는다 — 날짜가 없는 append-only 로그라 순서만으로 최신/과거를 구분해야 하는데, 이 리포에서는 실제로 이런 반증을 그때그때 인라인 각주로 정리하는 관례가 있다(`plan/in-progress/spec-draft-nullable-notation-followups.md:4767`의 "**2026-09-20 해소**" 각주, `plan/in-progress/spec-draft-nullable-notation-followups.md:4806`의 "**2026-09-20 처분: caveat 불요**" 각주 등). CHANGELOG 에는 그 관례가 적용되지 않았다.
  - 제안: 트리거 항목의 "남는 것" 문단 끝에 한 줄 각주를 추가한다 — 예: "**2026-09-21 해소**: 위 스케줄 항목이 이 잔여를 닫았다." 원문은 지우지 말고(히스토리 보존) 각주만 덧붙이는 편이 이 저장소의 다른 문서(tracker)가 쓰는 형태와 일치한다.

- **[INFO]** 공유 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:4773`)의 `SchedulesService.remove()` 항목이 여전히 `- [ ]`(미해소)로 남아 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4773-4783`
  - 상세: 이 PR(`plan/in-progress/schedule-dup-delete.md`)의 도입부는 이 트래커 항목을 "닫는다" 고 명시하지만, 이번 diff(파일 6)는 그 항목을 건드리지 않고 그 아래 다른 두 항목(`IntegrationsService.remove()` 신규 등재, 문서 격차 항목의 스코프 확장)만 편집했다. 다만 `plan/in-progress/schedule-dup-delete.md` 자신의 체크리스트에도 "`[ ]` 트래커 항목 해소 + 이 plan `plan/complete/` 로" 가 미체크로 남아 있어, 이 리뷰 시점에는 **의도된 미완료 상태**(세션 마무리 단계에서 처리 예정)로 보인다. 형제 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:4760`, `TriggersService.remove()`)이 해소될 때 `[x]` + "**2026-09-20 해소**" 각주 + `plan/complete/...` 링크로 정리된 선례가 있으므로, 이 PR 마무리 커밋에서도 같은 형태로 트래커 4773 줄을 갱신해야 한다.
  - 제안: 세션 마무리 시 `plan/in-progress/schedule-dup-delete.md` 체크리스트의 미체크 항목(`/ai-review` 수렴, `--impl-done`, 트래커 해소+이동)을 완료하면서, 트래커 4773 줄을 `[x]` + 해소 각주로 갱신할 것. 지금 단계에서는 차단 사유 아님.

- **[INFO]** 신규 CHANGELOG 항목·소스 코드 주석·plan 문서·e2e 테스트 JSDoc 전반의 상호 참조를 실제 코드/스펙에 대조 검증함 — 모두 정확함
  - 위치: `CHANGELOG.md:3-37`, `codebase/backend/src/modules/schedules/schedules.service.ts:145-156, 308-383`, `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts:9-23`, `plan/in-progress/schedule-dup-delete.md`
  - 상세: 확인한 항목 — (1) `throwScheduleNotFound()` JSDoc 이 인용하는 형제 헬퍼 `triggers.service.ts` 의 `throwTriggerNotFound()` 가 실제로 존재(5개 호출부); (2) 신규 e2e 스펙의 JSDoc 이 "네 번째 짝" 이라 부르는 `trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts` 세 파일이 모두 실존; (3) `triggerConfigLockKey` 함수가 `trigger-config-lock.ts:25`에 실존하고 시그니처가 import 와 일치; (4) `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`(5초) — e2e 주석의 "대기 상한 5초" 서술과 일치; (5) `CHANGELOG.md` 신규 항목이 인용하는 "트리거 목록 §4.4" 가 `spec/2-navigation/2-trigger-list.md:315`에 실존; (6) `spec/2-navigation/3-schedule.md` §4(API 표, 133-142행)가 실제로 동시-삭제→404 서술을 담고 있지 않음(트래커의 문서 격차 주장과 일치, 조작된 근거 아님). 새로 추가된 코드 주석(트리거 `affected` 판정자 선택 이유, CASCADE 설명, `.catch` 에서 `NotFoundException` 분리 이유, 방어 분기의 판정 대상이 다른 이유)은 인라인 설명으로 충분히 상세하고 실제 로직과 일치한다.
  - 제안: 없음(정보성 확인).

## 요약

이번 PR 은 스스로 CHANGELOG·plan·tracker·spec 문서화 규약을 매우 충실히 지켰다 — 신규 CHANGELOG 항목은 형제 항목(#1369·#1370)과 동일한 4단 구성(문제 → 고친 것 → 판별력 실측 → 남는 것)을 정확히 따르고, 코드 주석은 판정자 선택 근거(CASCADE)와 방어 분기의 차이를 명확히 설명하며, 모든 상호 참조(형제 헬퍼·spec 섹션·상수 값·e2e 파일 존재)가 실측으로 검증된다. 유일하게 남는 흠은 CHANGELOG 안에서 발생한 문서 간 모순이다 — 이번 PR 이 새로 추가한 최상단 항목이 "스케줄 경로를 고쳤다" 고 말하는 반면, 바로 아래 기존 트리거 항목의 "남는 것" 문단은 그 결함이 "아직" 있다고 계속 말하는 상태로 남는다. 이 저장소가 이미 tracker 문서에서 쓰고 있는 "해소 각주" 관례를 CHANGELOG 에도 한 줄 적용하면 해결된다. 공유 트래커의 해당 체크박스 미해소는 plan 자신의 체크리스트에 이미 남은 작업으로 명시돼 있어 차단 사유가 아니다.

## 위험도
LOW
