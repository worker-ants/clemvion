# Plan 정합성 검토 결과

검토 일시: 2026-05-19
대상 plan: `plan/in-progress/cafe24-bg-refresh-tuning.md` (worktree: `cafe24-bg-refresh-tuning-fb72d5`)
검토 범위: 구현 착수 전 (--impl-prep)

---

## 발견사항

### 발견사항 1

- **[INFO]** `0-unimplemented-overview.md` plan 목록에 본 plan 미등재
  - target 위치: `plan/in-progress/cafe24-bg-refresh-tuning.md` (신규 plan)
  - 관련 plan: `plan/in-progress/0-unimplemented-overview.md` §"plan 문서 목록" 코드블록 (follow-up 묶음 섹션)
  - 상세: `0-unimplemented-overview.md` 의 `plan/in-progress/` 목록에 `cafe24-bg-refresh-tuning.md` 항목이 없다. 인덱스 문서가 현재 진행 중인 plan 전체를 추적하는 단일 인덱스 역할을 하므로, 신규 plan 이 미등재 상태이면 인덱스와 실제 plan 목록 사이에 불일치가 발생한다.
  - 제안: `0-unimplemented-overview.md` 의 "follow-up · 정합화 묶음" 블록에 `cafe24-bg-refresh-tuning.md` 한 줄을 추가한다. 본 plan 착수 후 또는 PR merge 시점에 반영 가능 (CRITICAL은 아님).

---

### 발견사항 2

- **[INFO]** 후속 spec 갱신 항목이 plan 에 "별도 PR" 로만 표기되고 담당 plan 미지정
  - target 위치: `plan/in-progress/cafe24-bg-refresh-tuning.md` §"후속 (별도 PR — 본 plan 범위 외)"
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` (해당 spec 파일 `spec/2-navigation/4-integration.md` 를 이미 F-2 항목에서 미해소 상태로 추적 중)
  - 상세: bg-refresh-tuning plan 의 후속 항목 "spec/2-navigation/4-integration.md / spec/data-flow/integration.md 의 cafe24 background refresh 주기 / cutoff 마진 명시 갱신" 은 본 plan 에서 "project-planner 위임" 으로만 언급되고, 어느 plan 에서 추적할지 지정되지 않았다. `cafe24-backlog-residual.md` 는 동일 파일(spec/2-navigation/4-integration.md §6 mermaid)을 이미 F-2 항목으로 추적하고 있지만, 추가할 내용(background refresh 주기 갱신)은 §6 이 아닌 다른 절에 해당하므로 별개 항목이다. 추적 계획이 없으면 이 spec 갱신이 누락될 수 있다.
  - 제안: `cafe24-bg-refresh-tuning.md` 후속 섹션에 "spec 갱신은 `cafe24-backlog-residual.md` 또는 신규 follow-up plan 에 항목 추가" 라는 귀속 표기를 남긴다. 또는 `cafe24-backlog-residual.md` 에 직접 항목을 추가한다 (project-planner 권한으로 spec 파일 갱신 수행 시).

---

### 발견사항 3

- **[INFO]** `redis-bullmq-env-hardening` worktree 가 동일 모듈 레이어 파일에 접근하나 실제 수정 파일은 분리됨 (경합 위험 낮음)
  - target 위치: `plan/in-progress/cafe24-bg-refresh-tuning.md` §"변경 범위"
  - 관련 plan: `plan/in-progress/redis-bullmq-env-hardening.md` (worktree: `redis-bullmq-env-hardening-7a47dc`)
  - 상세: `redis-bullmq-env-hardening` plan 은 `app.module.ts`(BullModule.forRootAsync) 와 `health.service.ts` 를 수정한다. 본 plan 은 `integration-expiry-scanner.service.ts` 와 `cafe24-token-refresh.constants.ts` 를 수정한다. 두 worktree 의 실제 수정 파일 집합은 겹치지 않는다. 다만 두 plan 모두 BullMQ 스케줄러 동작에 간접 영향을 주는 변경을 가져서, PR merge 순서에 따라 통합 테스트 결과가 달라질 수 있다는 점을 인지해 둘 필요가 있다. git worktree 레벨 파일 충돌은 없다.
  - redis-bullmq 변경(AUTH 옵션 전달)이 완료되지 않으면 bg-refresh-tuning 이 6h 주기로 분리해도 BullMQ Worker 가 인증 실패로 job 을 실행 못 할 수 있다. bg-refresh-tuning plan 배경절에도 "BullMQ Redis AUTH 결함 — 동시 PR 에서 별도 해소" 라고 명시하고 있으나 merge 순서 권장을 별도로 기술하지 않았다.
  - 제안: `cafe24-bg-refresh-tuning.md` 의 "결정 사항" 또는 "의존성" 절에 "redis-bullmq-env-hardening PR 이 선행 merge 되거나 동시 배포되어야 6h cron 이 실제 AUTH 환경에서 정상 fire 됨" 을 INFO 메모로 추가한다. CRITICAL 은 아니고 두 PR 이 같은 sprint 에 처리될 예정이므로 실용적 위험은 낮다.

---

## 요약

`plan/in-progress/cafe24-bg-refresh-tuning.md` 는 scope 가 명확하게 두 파일(`cafe24-token-refresh.constants.ts`, `integration-expiry-scanner.service.ts`)에 한정되어 있고, 미해결 결정 사항이 없으며(6h/7일 결정 완료), 다른 진행 중 plan 과 파일 레벨 worktree 충돌도 없다. 중복 작업도 식별되지 않는다. 발견사항은 모두 INFO 등급으로, (1) 인덱스 문서 미등재, (2) 후속 spec 갱신 귀속 미지정, (3) redis-bullmq-env-hardening 과의 merge 순서 메모 권장이다. 어느 항목도 구현 착수를 차단하는 수준이 아니다.

## 위험도

LOW
