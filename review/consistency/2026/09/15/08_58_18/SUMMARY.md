# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance /
plan_coherence / naming_collision) 전체에서 `[CRITICAL]` 판정은 없었다. 전문 확보 실패
checker 없음(5/5 전문 인라인 확보, 파일도 사전에 이미 존재함 — 별도 영속화 불요).

## 전체 위험도
**MEDIUM** — BLOCK 대상 결함은 없으나, 서로 다른 checker(cross_spec·plan_coherence)가
같은 근본 원인(트리거 lock 관련 코드/코멘트가 `spec/` 어디에도 걸리지 않음 — CASCADE 상류
경로 미문서화 + `code:` frontmatter glob 미매칭)을 다른 각도로 지적하고 있어 구조적 gap 이
누적되는 중이다. 착수를 막을 필요는 없지만 이번 세션 내 plan 갱신이 필요하다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 없음)

## planner 인계 (권한 밖 Critical)

> Critical 이 없으므로 해당 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Workflow/Workspace 삭제 FK `ON DELETE CASCADE` 가 `trigger` 행까지 지우는데, 상태 다이어그램의 CASCADE 열거에서 `trigger` 가 빠져 있다 (V001 스키마부터 존재하던 누락, 이번 plan 의 실측이 처음 드러냄) | `spec/data-flow/11-workflow.md` §3.1 상태 다이어그램 | `trigger.entity.ts:39,46`(`onDelete:'CASCADE'`) / `migrations/V001__initial_schema.sql:146` / `spec/2-navigation/2-trigger-list.md` §4.3(반대 방향만 서술) | developer 가 원저작자가 아니므로(자기-반증형 소정정 조건1 불충족) **project-planner 턴**으로 (a) §3.1 CASCADE 목록에 `trigger`(+2차 `schedule`) 추가, (b) `2-trigger-list.md` §4.3 에 상류 방향(워크플로우/워크스페이스 삭제→트리거 CASCADE) 행 추가 |
| 2 | plan_coherence | `trigger-config-lock.ts`(항목②③④가 수정)와 `schedules.service.ts`(항목⑤)가 `spec/5-system/` 어떤 `code:` glob 에도 안 걸림 — `plan/in-progress/spec-draft-nullable-notation-followups.md:4454-4471` 항목1 이 이미 등재해 둔 미해소 planner gap 과 정확히 겹침 | `spec/5-system/15-chat-channel.md` frontmatter `code:` (및 `12-webhook.md`·`14-external-interaction-api.md` 동일) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목1(미해소, `- [ ]`) | `trigger-lock-followups.md` 체크리스트에 "`--impl-done` 이 이 구간에서 spec 번들 0건이면 known bug 로 BYPASS+근거 기록" 명시, 또는 planner 항목1 처리를 이번 세션과 시간적으로 묶을지 사용자 확인 |
| 3 | plan_coherence | 이번 plan 이 실측으로 반증한 옛 전제("삭제 경로 2곳이 같은 advisory lock 을 공유해 실무적으로 닫혀 있다")가, 정정 대상으로 선언되지 않은 **살아있는** 트래커 한 줄에 그대로 남아 있음(봉인된 `complete/` 쪽은 이력이라 정합적, 문제는 이 트래커) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4487` | `plan/in-progress/trigger-lock-followups.md` §④ 반증 선언(정정 대상으로 CHANGELOG·`codebase/**` JSDoc 만 명시하고 이 트래커는 누락) | item ④ 커밋(또는 체크박스 처리) 시 4487행 문구를 "삭제 경로는 셋이며 FK CASCADE 경로는 advisory lock 을 거치지 않는다"로 함께 정정 |
| 4 | naming_collision | `findByIdForUpdate` 대체 식별자 미확정 — "잠금 아님"을 강조하려다 `Lock/Locked/Unlocked` 계열 어휘를 다시 쓰면, 원래 결함(이름이 거짓말한다)과 같은 클래스가 다른 이름으로 재발 | `plan/in-progress/trigger-lock-followups.md` 항목① (대체 이름 미정) | `trigger-config-lock.ts` 의 진짜 advisory lock 함수군(`acquireTriggerConfigLock` 등) + SQL `FOR UPDATE` 관용구 7개 파일 | `Lock` 계열 어휘 배제, 목적(PATCH 사전검증 경량 조회)을 드러내는 이름 사용(예: `findByIdForPatchPrecheck`). 선례: `AuthConfigsService.findByIdForResponse` — 접미사 패턴은 재사용하되 목적어는 새로 지을 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `trigger-config` advisory lock 키 네임스페이스가 `redis-keys.md` §4 에 여전히 미등재 (기지 사실 재확인) | `trigger-config-lock.ts:9-16` / `spec/conventions/redis-keys.md` §4 | 새 조치 불요 — 이미 planner 큐(`--impl-prep 2026/09/14/17_10_16` naming_collision W2)에 등재됨. plan/CHANGELOG 에 "재확인함"만 기록 |
| 2 | cross_spec | rotate-bot-token 404 계약은 이번 수정과 불충돌(검토 후 배제) | `triggers.service.ts:122`, `spec/5-system/15-chat-channel.md` §5.4 | 조치 불요 |
| 3 | rationale_continuity | `#1334` CHANGELOG 의 반증된 주장 정정을 이번 PR 산출물(커밋)에서 실제로 확인할 것 | 루트 `CHANGELOG.md:31-34` | item ④ 커밋에 CHANGELOG 정정 동반(코드 fix 와 짝) |
| 4 | rationale_continuity | Cafe24 advisory-lock 기각 선례와의 경계 — 이번 5건은 안 넘음(유지 확인) | `spec/2-navigation/4-integration.md` Rationale | 조치 불요, 향후 lock 보유 범위 확장 시 재인용 필요 |
| 5 | rationale_continuity | `findByIdForUpdate` 개명 근거가 "체커 문면보다 좁게" 정확히 기록되는지 코드리뷰 단계에서 확인 | `trigger-lock-followups.md` 항목① | 리뷰 시 문구 확인 |
| 6 | convention_compliance | prompt 번들 절단으로 `spec/5-system/` 15개·`conventions/` 다수 미검증(기지 이슈) | 번들 전체 | 필요 시 `--impl-prep` 파일 단위 재실행 또는 `/spec-coverage` 보완 |
| 7 | convention_compliance | advisory lock 패턴이 spec 미문서화(drift 아님, 참고) — `4-execution-engine.md` §8 기존 선례 있음 | `triggers.service.ts` 등 (spec 밖) | 조치 불요, 향후 spec 화 시 §8 서술 형태 참고 |
| 8 | convention_compliance | 트리거 도메인 에러코드·감사액션 규약 정합 확인(positive) | `3-error-handling.md` §1.9~1.11, `audit-actions.md` §3 | 조치 불요 |
| 9 | plan_coherence | 나머지 항목①⑤은 `spec/5-system/` 기존 결정·미해결 사안과 불충돌 | `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` | 조치 불요 |
| 10 | naming_collision | 항목④ `affected` 확인 수정 시 실패 처리 분기를 새로 적으면 `RESOURCE_NOT_FOUND` 리터럴이 재중복될 위험(이미 4→1로 통합한 이력) | `triggers.service.ts:401` `throwTriggerNotFound()` | 신규 분기는 반드시 `throwTriggerNotFound()` 재사용, 인라인 리터럴 금지 |
| 11 | naming_collision | `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 이름 변경 없음 — ENV/설정키 충돌 없음(확인) | `trigger-config-lock.ts:76` | 조치 불요 |
| 12 | naming_collision | 요구사항ID/API endpoint/이벤트명/파일경로 축은 이번 5건에서 해당 없음 | — | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Workflow/Workspace 삭제 CASCADE 가 `trigger` 까지 지운다는 사실이 `11-workflow.md` §3.1 다이어그램에 누락(WARNING, planner 인계 필요) |
| rationale_continuity | LOW | CRITICAL/WARNING 없음. `#1334` CHANGELOG 반증 정정의 실제 이행 여부만 후속 확인 필요(INFO) |
| convention_compliance | LOW | CRITICAL/WARNING 없음. 완전 로드된 3개 spec + `audit-actions.md` 는 규약 정합. 번들 절단으로 전수 검증은 미완(INFO) |
| plan_coherence | MEDIUM | `trigger-config-lock.ts`/`schedules.service.ts` 가 `spec/5-system/` code: glob 에 미포함(기존 planner gap 과 중복) + 반증된 전제가 살아있는 트래커 한 줄에 미정정 (WARNING 2건) |
| naming_collision | LOW | `findByIdForUpdate` 대체 이름 미확정 — Lock 어휘 재사용 시 원 결함 재발 위험(WARNING). `affected` 수정 시 리터럴 재중복 위험(INFO) |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO)
2. `project-planner` 턴에서 `spec/data-flow/11-workflow.md` §3.1 CASCADE 목록에 `trigger`(+`schedule`) 추가하고 `spec/2-navigation/2-trigger-list.md` §4.3 에 상류 방향 CASCADE 행 추가 (WARNING #1)
3. `trigger-lock-followups.md` 체크리스트에 `--impl-done` 시 spec 번들 0건 대응 방침(BYPASS+근거) 명시, 또는 `spec-draft-nullable-notation-followups.md` 항목1 처리를 이번 세션과 시간 맞출지 사용자 확인 (WARNING #2)
4. item ④ 커밋(또는 체크박스 처리) 시 `spec-draft-nullable-notation-followups.md:4487` 문구 정정 + CHANGELOG 정정 동반 (WARNING #3, INFO #3)
5. 항목① 대체 식별자 결정 시 `Lock/Locked/Unlocked` 계열 배제, `findByIdForPatchPrecheck` 류 목적 중심 이름 채택 (WARNING #4)
6. 항목④ 구현 시 신규 실패 분기는 `throwTriggerNotFound()` 재사용, 인라인 `RESOURCE_NOT_FOUND` 리터럴 재작성 금지 (INFO #10)