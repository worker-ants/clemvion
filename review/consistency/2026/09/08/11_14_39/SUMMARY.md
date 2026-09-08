# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (rationale_continuity)

## 전체 위험도
**MEDIUM** — SoT 문서(`spec/1-data-model.md ## Rationale`)에 같은 문서 안 §2.19 반례로 즉시 반증되는 과잉일반화 문장이 새겨질 Critical 1건 + 완결성 WARNING 3건(권한표 비대칭 2건 중복집계·표기 레이어 미설명·인접 서술 stale)이 있으나, 나머지 4개 항목(A-1~A-4 대부분)은 실제 파일·수치를 정확히 재현해 정합함이 확인됨.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | A-5 신규 Rationale "이 저장소는 `select: false` 도 `@Exclude()` 도 쓰지 않는다(2026-09-06 전수 확인)"가 저장소 전체로 과잉일반화됨. 같은 문서 §2.19 `Notification.background_run_id`(V107)가 `select: false` 를 실제로 쓰고 있어(`codebase/backend/src/modules/notifications/entities/notification.entity.ts:56-62`) 즉시 반증됨. 실제 근거(`user-secret-absence.ts`/`user-entity-exposure.spec.ts`)는 "User 민감 7컬럼에 0건"이라고 범위를 좁혀 적었는데 target 이 이를 "이 저장소는"으로 넓혀 옮겨 적었다. | A-5 변경안(b) — `1-data-model.md ## Rationale` 결정 근거 승격 표 1행 | `spec/1-data-model.md:730`(§2.19 Notification, V107 Rationale) ↔ `notification.entity.ts:56-62` | 문장을 "`User` 민감 7컬럼에 `select: false` 0건(2026-09-06 실측)"으로 범위를 좁히고, 필요하면 "select:false 채택 여부는 컬럼별 소비 패턴(WHERE-only vs 값 직접 소비)으로 판단하며 `Notification.background_run_id`는 전자라 유효하다"는 경계 문장을 덧붙여 기존 결정(Notification)과의 모순을 해소한다. |

## planner 인계 (권한 밖 Critical)

(없음) — 이 세션은 `project-planner` 가 `spec/` 에 쓰기 전 자기 draft(`plan/in-progress/spec-draft-followups-batch-a.md`)를 검토하는 `--spec` 턴이다. Critical 의 근본 원인(반증 가능한 과잉일반화 문장)은 draft 작성자 자신이 이번 턴에 직접 수정 가능한 범위 안에 있으며, developer 턴의 권한 밖 spec drift 가 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | A-1 이 신설하는 "거버넌스 문서(`CLAUDE.md`·`.claude/skills/**/SKILL.md`·`.claude/docs/**`)는 project-planner 소유" 규칙이 `CLAUDE.md`와 `developer/SKILL.md`(read-only 안내) 양쪽엔 반영되지만, 정작 그 권한의 주체인 `project-planner/SKILL.md` 자신의 「경로별 권한」 표에는 대응 행이 없다 — developer 축(harness 3종)은 자기 SKILL.md 표에 반영되는 것과 비대칭. | A-1 변경안 (`CLAUDE.md` + `developer/SKILL.md` 두 곳만 갱신 대상으로 명시) | `.claude/skills/project-planner/SKILL.md` §경로별 권한 표 (`spec/**`·`plan/**`·`codebase/**`(RO)·`review/**`(R) 네 행뿐, `.claude/**` 없음) | `project-planner/SKILL.md` 표에 `.claude/docs/**`, `.claude/skills/**/SKILL.md`, `CLAUDE.md` Read/Write 행 추가, 체크리스트를 "`CLAUDE.md` + `developer/SKILL.md` + `project-planner/SKILL.md` 동시 갱신"으로 확장. |
| 2 | convention_compliance | A-5 규범 블록이 `passwordHash`·`twoFactorSecret` 등 7개 필드를 camelCase 로 나열하는데, 같은 §2.1 표는 `password_hash` 등 snake_case 로 일관 서술한다. 설명 없이 병치되어 "새 필드가 추가됐나"로 오독 가능. (필드 자체는 `user-secret-absence.ts`의 `USER_SECRET_KEYS`와 정확히 일치, 내용은 정확함) | A-5 변경안(a) `1-data-model.md §2.1` 규범 블록 | `1-data-model.md §2.1 User` 표 (snake_case 컬럼명 관례) | `2-trigger-list.md §2.1` 의 기존 병기 패턴("API 응답 시 camelCase. DB 컬럼은 snake_case — [Spec 데이터 모델 §2.8]")을 재사용해 레이어 명시 문구 추가. |
| 3 | plan_coherence | `secret-store.md:69-78` 및 `14-external-interaction-api.md §7.1(934-936)` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 `#1291` 머지로 이미 거짓인데, target 이 A-5 에서 `secret-store.md §1.1`을 상호 참조로 직접 여는 같은 세션에서도 이를 갱신하지 않는다. 자매 트래커 자신이 이 stale 화를 예견해 별도 미체크 항목으로 남겨 두었다. | A-5 (`secret-store.md §1.1` 상호 참조 한 줄 추가) | `spec/conventions/secret-store.md:69-78`, `spec/5-system/14-external-interaction-api.md §7.1` | A-5 편집 세션에서 두 blockquote를 "이 창은 `#1291`로 닫혔다" 형태로 정정(자매 트래커 패턴 준용), 또는 이번 배치 스코프에서 제외한 이유를 target에 명시. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | A-2-1 R-2 앵커 rename 시 인입 링크가 R-CC-10 한 곳뿐임을 grep 으로 검증했으나 그 결과를 실행 기록에 남기지 않으면 누락 위험이 재발 가능 | A-2-1 체크리스트 | `grep -rn "r-2-webhook-hmac-secret" spec/` 결과를 PR 본문/plan 에 실측 기록 |
| 2 | plan_coherence | A-2-2 `pending_plans` 지정 대상의 "developer 항목 신설" 체크리스트 항목이 `spec-pending-plan-existence.test.ts` 게이트로 강제되는지 불확실(파일 존재만 볼 가능성) | A-2-2 체크리스트 | 게이트가 파일 존재만 확인하는지 항목 매칭까지 보는지 먼저 확인, 전자면 실행 후 수동 확인 단계 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 실측 전부 정합. A-1 project-planner 권한표 대칭성 WARNING 1건만 |
| rationale_continuity | MEDIUM | A-5 신규 Rationale 문장이 같은 문서 §2.19 반례로 즉시 반증되는 CRITICAL 1건 |
| convention_compliance | LOW | A-1 권한표 비대칭, A-5 표기 레이어 미설명 WARNING 2건. 나머지 전부 규약 준수 확인 |
| plan_coherence | LOW | 자매 트래커·타 plan 과 충돌 없음. secret-store.md stale 서술 WARNING 1건 |
| naming_collision | NONE | 신규 식별자 실질적으로 없음(기존 이름 등재/제목 정정 위주). 충돌 0건 |

## 권장 조치사항
1. (BLOCK 해소 우선) A-5 `1-data-model.md ## Rationale` 문장을 "User 민감 7컬럼에 select:false 0건"으로 범위를 좁히고, `Notification.background_run_id` 반례와의 모순을 해소하는 경계 문장 추가.
2. `project-planner/SKILL.md` §경로별 권한 표에 `.claude/docs/**`·`.claude/skills/**/SKILL.md`·`CLAUDE.md` 행 추가 (A-1 대칭성 확보), 체크리스트도 3-파일 동시 갱신으로 확장.
3. A-5 규범 블록에 camelCase(엔티티/응답) vs snake_case(DB 컬럼) 레이어 명시 문구 추가 (`2-trigger-list.md §2.1` 패턴 재사용).
4. A-5 편집 세션에서 `secret-store.md:69-78` 및 `14-external-interaction-api.md §7.1` 의 "노출 창 미해결" 서술을 `#1291` 반영해 정정(또는 스코프 제외 사유 명시).
5. A-2-1 grep 검증 결과를 실행 기록에 남기고, A-2-2 `pending_plans` 게이트의 실제 검증 범위(파일 존재 vs 항목 매칭)를 확인 후 필요 시 수동 확인 단계 추가.
