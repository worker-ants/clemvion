# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 요약

- diff-base: `origin/main...HEAD` (현재 브랜치 `claude/entity-nullable-batch2`, HEAD `a7b9667bc`)
- 실제 코드 delta: 엔티티 nullable 타입 정합화 "배치 2" — `execution`·`knowledge-base`·
  `node-execution`·`node`·`notification`·`schedule`·`trigger`·`user`·`workflow` 9개 엔티티의
  30필드 + `shared/utils/redact-stored-error.{ts,spec.ts}` (총 11파일/361줄). 순수 TS 타입
  정합화(`nullable: true` DB 컬럼에 `| null` 부여 + TypeORM `type:` 명시)이며 **동작 변경은 없다**.
  근거 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` (배치 1·2 모두 완료 표기).
- target `spec/5-system/**` 자체의 delta: **0 파일** — 이 브랜치는 그 영역을 건드리지 않았다.
  이는 정상이다(코드 전용 PR).

## 발견사항

- **[INFO]** `spec/5-system/2-api-convention.md §2.2` `/api/auth/*` 네임스페이스 예외 미반영 — 여전히 열려 있음
  - target 위치: `spec/5-system/2-api-convention.md` §2.2 "명명 규칙" (현재 예외 행 2종만 등재:
    RPC-style sub-channel action · `/api/external/*` 인증 family. `/api/auth/{verb}` 계열
    예외는 없음 — 현재 파일 직접 확인, 워킹트리 절대경로 기준)
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` §할 일
    "**후속(planner 턴, 이 작업과 무관) — `2-api-convention.md §2.2` 에 `/api/auth/*` 액션
    네임스페이스 예외 조항**" (미체크 `- [ ]`)
  - 상세: 이전 `--impl-done` 라운드(W2)에서 `/api/auth/{verb}` 15개 이상이 §2.2 의 명시된
    두 예외(RPC-style `{id}` 필수 / `/api/external/*`) 어디에도 포섭되지 않는다고 기록됐고,
    developer 권한 밖이라 planner 턴으로 위임된 상태다. 이번 라운드(엔티티 nullable 배치 2)
    diff 로는 손대지 않았으므로 이 gap 은 **여전히 미해소**다 — target 이 plan 의 결정을
    우회하거나 새로 만든 것은 아니고, plan 도 정확히 "이 작업과 무관" 이라 명시해 두어
    스코프 혼선은 없다. 다만 아직 planner 턴이 실행되지 않았다는 사실 자체는 추적 유지가
    필요하다.
  - 제안: plan 갱신 불요(이미 정확히 기록돼 있음). spec 갱신은 별도 planner 턴에서 §2.2 에
    예외 행을 추가하는 것으로 해소. 우선순위상 이번 세션 범위 밖이라 액션 아이템으로만 남긴다.

- **[INFO]** 자기-반증형 소정정 이력 정합성 확인 — 문제 없음 (참고용)
  - target 위치: `spec/5-system/1-auth.md` L1419 부근 ("~~헬퍼는 다르지만…~~ — 이 근거는
    틀렸다 (`--impl-done` WARNING, 2026-09-03)")
  - 관련 plan: `plan/complete/auth-change-password-oauth-only-code-split.md` (spec 이 이 경로를
    참조)
  - 상세: 검증 결과 해당 plan 파일은 실제로 `plan/complete/` 로 이동 완료된 상태였다
    (`plan/in-progress/` 에는 더 이상 존재하지 않음, `git log` 상 `af41a3c6e` 커밋으로 이동·
    이미 `origin/main` 에 병합됨). spec 의 상대경로 참조가 가리키는 파일이 실제로 그 위치에
    존재해 broken link 가 아니다. 이번 세션(엔티티 nullable 배치 2)이 만든 diff 와는 무관하며,
    별도 조치 불필요 — 정합성 이상 없음을 확인한 기록으로만 남긴다.

## 요약

이번 검토 대상 diff(엔티티 nullable 타입 정합화 배치 2, 11파일/361줄)는 `spec/5-system/` 을
전혀 건드리지 않는 순수 코드 타입 정합화이며, 변경된 필드(`Execution.triggerId`·
`Trigger.endpointPath`·`Notification.resourceType/resourceId` 등)에 대해 `spec/5-system/` 이
이미 문서화해 둔 nullable 동작(예: schedule/manual 트리거의 `trigger_id` NULL, §12-webhook.md·
§4-execution-engine.md)과 **정합**한다 — 오히려 코드가 spec 이 이미 서술하던 사실을
뒤늦게 타입으로 반영한 방향이다. `plan/in-progress/entity-nullable-column-type-mismatch.md` 는
자신의 범위(배치 1·2)를 완료로 마감했고, 그 과정에서 발견한 두 개의 planner 턴 후속
항목(§`1-data-model.md` §2.9, §`2-api-convention.md` §2.2)을 정확히 "이 작업과 무관"·
"developer 권한 밖" 으로 표시해 스코프 경계를 지켰다 — 이 중 `2-api-convention.md §2.2` 만
target 스코프(`spec/5-system/`) 안에 있으며 여전히 미해소 상태임을 확인했다(위 INFO). 미해결
결정을 우회하는 CRITICAL 급 충돌이나, 선행 plan 미해소로 인해 target 이 잘못된 가정 위에
서 있는 WARNING 급 문제는 발견되지 않았다.

## 위험도

LOW
