# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance /
plan_coherence / naming_collision) 전원 성공, Critical 위배 0건.

## 전체 위험도
**MEDIUM** — 직접적 spec 충돌(CRITICAL)은 없으나, developer 자신이 이미 인지해 plan §D 에
"planner 범위"로 등재해 둔 5개 후속 항목이 이 plan 파일 밖(spec `pending_plans:`, 다른
`plan/in-progress/*.md`)에는 전혀 등재되지 않았고, 이 plan 이 통상 절차대로
`plan/complete/` 로 봉인되면 유일한 근거 문서가 사라져 5건 모두 유실 위험에 놓인다
(plan_coherence 실측).

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건 보고)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이번 라운드에 CRITICAL 로 판정된 항목이 없다. 다만 아래 WARNING 중 다수의
> 근본 원인이 `spec/` 쓰기 권한 밖(developer 가 고칠 수 없음)이라, BLOCK 사유는 아니지만
> **project-planner 턴이 다음 단계**라는 점은 동일하게 적용된다 (권장 조치사항 참고).

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, plan_coherence (cross_spec 은 INFO 로 보고 — 최고 등급 채택) | R-CC-22("chat-channel 구현 경로는 code: 에서 glob 으로 잡는다")가 막으려던 클래스의 **4번째 재발** — 신규 공용 프리미티브 `trigger-config-lock.ts` 가 `chat-channel-*`/`trigger-callback-url*` 어느 glob 에도 걸리지 않음 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) | `spec/5-system/15-chat-channel.md` frontmatter `code:` glob (R-CC-22) | project-planner 가 glob 확장(예: `trigger-config-lock*.ts` 추가) 또는 명시 경로 추가 + `pending_plans:` 에 이 plan 등재 |
| 2 | convention_compliance, plan_coherence (cross_spec/rationale_continuity/naming_collision 은 INFO 로 보고 — 최고 등급 채택) | 신규 advisory-lock key 계열 `trigger-config:<id>` 및 기존 자매 사례 `exec-cap:<workspaceId>` 가 `redis-keys.md §4`(인접 네임스페이스, Redis 아닌데 형태가 비슷한 것) 표에 미등재 — 코드 JSDoc 은 이미 이 갭을 자인 | `trigger-config-lock.ts:6-18` (`TRIGGER_CONFIG_LOCK_PREFIX`), `execution-engine.service.ts`(`exec-cap:*`) | `spec/conventions/redis-keys.md §4` 표 | project-planner 턴에서 두 계열 함께 등재 (plan §D 에 이미 그렇게 하기로 명시돼 있음) |
| 3 | plan_coherence (cross_spec 은 spec-internal 모순 자체를 INFO 로 보고 — plan_coherence 는 "이 plan 봉인 시 추적 유실" 위험을 WARNING 으로 별도 판정, 최고 등급 채택) | `15-chat-channel.md §5.4.1.1` 표(447행, "v1 미정의·PATCH 는 signing 값을 바꾸지 않는다")와 바로 아래 각주(450행, "실제 구현은 매 PATCH 마다 회전 강제")가 **문서 내부에서 이미 상충** — 이번 PR 이 다루는 `inboundSigningRef` 필드와 겹침 | (target 은 spec 델타 0 — 코드 쪽은 provider 비구분 일반화 설계로 결과적으로 안전, e2e 검증은 telegram 1개 provider 만) | `spec/5-system/15-chat-channel.md §5.4.1.1` 표 vs 각주 | project-planner 가 표 문면을 각주 실측에 맞춰 정정(또는 반대) — spec 내부 모순이라 developer 권한 밖 |
| 4 | naming_collision | 신규 private 메서드 `findByIdForUpdate` — 이 코드베이스에서 `*ForUpdate`/`FOR UPDATE` 는 이미 "진짜 pessimistic 행 잠금"을 뜻하는 확립된 관용구(`execution-engine.service.ts` 등, spec `1-auth.md §1.4.4` 도 동일 관용구 사용)인데, 실제로는 잠금 없는 경량 조회일 뿐 — 이름이 유발하는 오신뢰가 이 PR 이 고치는 결함(락 없는 읽기-수정-쓰기)의 재도입 위험을 만듦 | `codebase/backend/src/modules/triggers/triggers.service.ts:531` | 코드베이스 전역의 `*ForUpdate` 명명 관용구(`execution-engine.service.ts:8398,8407` 등) | 개명(예: `findByIdForPatchValidation`) 또는 최소한 시그니처 옆에 "이 저장소의 `FOR UPDATE` 관용구와 무관 — 실제 잠금은 `acquireTriggerConfigLock` 참조" 명시. private 스코프라 파급은 이 파일 내로 제한 |
| 5 | plan_coherence | 위 항목들을 포함해 plan §D 에 등재된 **5개 planner-범위 후속 전체**(R-CC-22 glob, redis-keys §4 등재 2계열, §5.4.1.1 모순, 32비트 해시 공간 공유)가 `trigger-config-lost-update.md` 파일 밖 어디에도(spec `pending_plans:`, 다른 `plan/in-progress/*.md` 전수 grep 0건) durable 하게 등재돼 있지 않음 — 이 plan 이 `/ai-review` 통과 후 통상 절차대로 `plan/complete/` 로 봉인되면 유일한 근거 문서가 사라짐 | `plan/in-progress/trigger-config-lost-update.md` §D | `spec/5-system/15-chat-channel.md pending_plans:`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 등 durable 트래커 | plan 을 `complete/` 로 이동하기 **전에** 5건을 다른 durable 트래커(예: `spec-draft-nullable-notation-followups.md` 확장 또는 `pending_plans:` 갱신)로 이관 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance, naming_collision | advisory lock 두 계열(`trigger-config:*`, `exec-cap:*`)이 `pg_advisory_xact_lock` 32비트 해시 공간을 접두어만 다르게 공유 — 계열이 늘수록 우연한 해시 충돌 확률 상승. 명시적 규약 위반은 아니며 이전 라운드에서 이미 급하지 않음으로 처리 | `trigger-config-lock.ts:39-63` | 계열이 3개 이상으로 늘어나는 시점에 재검토(조치 불요) |
| 2 | plan_coherence | `spec-draft-nullable-notation-followups.md:2294-2295` 가 아직 실재하지 않는 `plan/complete/trigger-config-lost-update.md` 경로를 "✅ 해소" 로 선(先)참조 — 실측(`ls`, `git status`) 결과 파일은 아직 `in-progress/` 이고 체크리스트도 미완 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2294-2295` | BLOCK:NO 확정 후 같은 커밋에서 체크박스 `[x]` 처리 + `git mv` + 이 선참조 문구 정합화를 함께 수행 |
| 3 | cross_spec, rationale_continuity | Cafe24 advisory lock 기각 선례(`2-navigation/4-integration.md`)와의 대조 — 기각 사유("HTTP 호출을 락 트랜잭션 안에 묶는다")를 구조적으로 피해 설계됐음을 코드로 확인(`setupChannel` 은 락 밖, 락 안은 재조회+UPDATE 만). 위반 아님, 모범 사례로 기록 | `trigger-config-lock.ts:97-116`, `chat-channel-binder.service.ts:260-266` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 직접 모순 없음. R-CC-22 glob 누락·redis-keys §4 미등재·§5.4.1.1 내부 모순 3건 모두 INFO(이미 plan §D 등재 확인) |
| rationale_continuity | LOW | Cafe24 기각 선례·R-CC-21 불변식 모두 준수 확인. R-CC-22 4번째 재발만 WARNING(이미 인지·미완결 후속) |
| convention_compliance | LOW | API/DTO/에러코드 신설 없음. redis-keys §4 미등재만 WARNING(기추적), review-citations §2 14건 전수 준수 확인 |
| plan_coherence | MEDIUM | R-CC-22 4번째 재발 + 5개 planner-범위 후속 전체가 plan 파일 밖에 durable 하게 미등재 — plan 봉인 시 유실 위험 |
| naming_collision | LOW | `findByIdForUpdate` 명명이 이 코드베이스의 `*ForUpdate`=행잠금 관용구와 의미 반대(WARNING, private 스코프로 파급 제한). lock-key 네이밍 혼동은 기추적 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 단, 이번 라운드 BLOCK:NO 이므로 아래는 병합 전 권고 순서)
2. plan 을 `plan/complete/` 로 이동하기 **전에**, plan §D 의 5개 planner-범위 후속 항목
   (R-CC-22 glob 확장, `redis-keys.md §4` 2계열 등재, `15-chat-channel.md §5.4.1.1` 내부
   모순 정정, `findByIdForUpdate` 개명/주석, 32비트 해시 공간 공유 메모)을 durable 트래커
   (`spec-draft-nullable-notation-followups.md` 확장 또는 신규 트래커 + `pending_plans:` 갱신)로
   이관 — 근거 문서가 사라지기 전에 옮기는 것이 이번 보고서의 핵심 조치.
3. `spec-draft-nullable-notation-followups.md` 의 선참조 문구를 실제 상태(아직 in-progress)에
   맞게 정정.
4. private 메서드 `findByIdForUpdate` 개명 또는 명시 구분 주석 추가 — developer 권한 내에서
   즉시 처리 가능.
5. 위 3건의 spec 갱신(redis-keys.md §4, 15-chat-channel.md code: glob, §5.4.1.1 정정)은
   project-planner 턴에서 처리 — developer 권한 밖.