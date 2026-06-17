# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-17

---

## 전체 위험도
**LOW** — Warning 2건(에러 코드 미등재, dead-link plan 참조), PR3 미래 충돌 예고 1건. Critical 없음.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | ConventionCompliance | `EXECUTION_INTERNAL_ERROR` / `EXECUTION_MESSAGE_TOO_LONG` 에러 코드가 `spec/conventions/error-codes.md` 및 `3-error-handling.md §1.4` 카탈로그에 미등재 — 단일 진실 원칙 위배 | `spec/5-system/4-execution-engine.md §7.5.2` | `spec/conventions/error-codes.md §1`, `spec/5-system/3-error-handling.md §1.4` | 두 코드를 `spec/conventions/error-codes.md §3` 또는 `3-error-handling.md §1.4` 에 등재 (project-planner 영역) |
| W-2 | PlanCoherence | `pending_plans:` 에 `plan/in-progress/spec-sync-execution-engine-gaps.md` dead-link 잔존 — 해당 파일은 `plan/complete/` 로 이동 완료. spec-frontmatter 검증 가드(`spec-pending-plan-existence.test.ts`) 실패 유발 가능 | `spec/5-system/4-execution-engine.md` frontmatter | `plan/complete/spec-sync-execution-engine-gaps.md` | frontmatter `pending_plans:` 에서 해당 항목 제거 (project-planner 영역) |
| W-3 | NamingCollision | PR3 에서 execution-engine 내부 서비스에 `InteractionService` 사용 시 기존 `external-interaction/interaction.service.ts` 의 `InteractionService` 와 동명 충돌 발생 예고. 현재 PR1 단계에서는 즉각 차단 아님 | plan PR3 항목 (미착수) | `codebase/backend/src/modules/external-interaction/interaction.service.ts:57` — spec 6개소 인용 | PR3 착수 시 `FormButtonInteractionService` 또는 `BlockingInputService` 등 역할 명시 이름으로 구분 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | CrossSpec | frontmatter `pending_plans` 에 dead-link 2건: `spec-sync-execution-engine-gaps.md`(complete 이동), `exec-park-durable-resume.md`(구현 완료, in-progress 잔존) | `spec/5-system/4-execution-engine.md` frontmatter | dead-link 제거; `exec-park-durable-resume.md` 는 `plan/complete/` 이동 후 frontmatter 참조 삭제 |
| I-2 | ConventionCompliance | `§4.x waiting_for_input park` 플레이스홀더 절 번호 — 정식 절 번호 아님, cross-reference 불명확 | `spec/5-system/4-execution-engine.md` 줄 422 | `§4.4` 로 공식 번호 부여 또는 annotation box 처리 |
| I-3 | ConventionCompliance | `§7.1` 표 내 `§2.13` 참조 — 해당 절 번호 문서 내 미존재 | `spec/5-system/4-execution-engine.md §7.1` | 올바른 절 또는 규약 파일 참조로 교체 |
| I-4 | ConventionCompliance | frontmatter `pending_plans:` 실존 여부 — `spec-pending-plan-existence.test.ts` 실행으로 확인 권장 | frontmatter 줄 10–13 | `npm test -- spec-pending-plan-existence` 실행 후 실패 경로 갱신 |
| I-5 | ConventionCompliance | 전역 Redis 키 3종(`exec:recover:lock`, `exec:cont:seq:<id>`, `exec:seq:<id>`)의 패턴 예외 근거가 §9.1 footnote 에만 산문 기술, `spec/conventions/` 규약 문서 없음 | `spec/5-system/4-execution-engine.md §9.1·§9.2` | 향후 Redis 키 패턴을 `spec/conventions/` 수준으로 승격 고려 (즉각 수정 불필요) |
| I-6 | ConventionCompliance | frontmatter `id: execution-engine` 이 파일 basename `4-execution-engine` 과 불일치 (숫자 prefix 제외) | frontmatter 줄 2 | 관행이 광범위하여 즉각 수정 불필요. 규약 문서에 prefix 제외 명시적 허용 추가 고려 |
| I-7 | PlanCoherence | PR2b(`maxConcurrentExecutions`) 미착수 — spec §8 이 `Workspace.settings`/`Workflow.settings` 참조하나 해당 키가 spec §2.2/§2.4 에 미정의 상태 | `spec/5-system/4-execution-engine.md §8` | PR2b 착수 전 project-planner 가 관련 data-model spec 에 키 등재 필요 |
| I-8 | PlanCoherence | PR3/PR4(stalled-job 일원화) 미착수 — spec §7.1/§9.3 "Planned" 표식과 일치하는 정상 상태 | `spec/5-system/4-execution-engine.md §7.1`, §9.3 | 착수 시 `exec-intake-queue-impl.md` 결정 준수 |
| I-9 | NamingCollision | `EngineDriver`(PR2) — codebase 전체 0건, 충돌 없음 | plan PR2 항목 | 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| CrossSpec | LOW | 핵심 데이터 모델·상태 머신·BullMQ 큐 정합. frontmatter dead-link 2건(INFO) |
| RationaleContinuity | NONE | 14개 기각 결정 전부 준수. 재도입 사례 없음 |
| ConventionCompliance | LOW | 에러 코드 2종 미등재(WARNING). §4.x 절 번호·§2.13 참조 오류(INFO) |
| PlanCoherence | LOW | dead-link pending_plans 항목(WARNING). PR2b/PR3/PR4 미착수 정상 상태(INFO) |
| NamingCollision | LOW | PR1 식별자 충돌 없음. PR3 `InteractionService` 미래 충돌 예고(WARNING) |

---

## 권장 조치사항

1. **(W-2 우선)** `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 제거 — spec-frontmatter 가드 실패 방지 (project-planner).
2. **(W-1)** `EXECUTION_INTERNAL_ERROR` / `EXECUTION_MESSAGE_TOO_LONG` 을 `spec/5-system/3-error-handling.md §1.4` 또는 `spec/conventions/error-codes.md §3` 에 등재 (project-planner).
3. **(W-3 예고 조치)** PR3 설계 시 execution-engine 내부 입력 대기 서비스에 `InteractionService` 이름 사용 금지 — `FormButtonInteractionService` 또는 `BlockingInputService` 사용.
4. **(I-1 연계)** `exec-park-durable-resume.md` 를 `plan/complete/` 로 이동 후 frontmatter 참조 삭제 (plan lifecycle 규칙 준수).
5. **(I-2)** `§4.x waiting_for_input park` 절에 정식 번호(`§4.4`) 부여 및 기존 §4.4 renumber.
6. **(I-3)** `§7.1` 내 `§2.13` 참조를 올바른 대상으로 교체.
7. **(I-7)** PR2b 착수 전 `maxConcurrentExecutions` 설정 키를 data-model spec 에 등재.
