# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 결과 확보 (전문 인라인 제공, 재시도 필요 없음). Critical 0건.

## 전체 위험도
**LOW** — Cross-Spec/Rationale/Convention/Naming 4개 관점은 NONE(변경이 `spec/5-system` 을 건드리지 않는 순수 e2e 테스트 헬퍼 추출이므로 충돌 후보 자체가 없음). Plan Coherence 1건이 plan 라이프사이클 기록의 시점 불일치(WARNING, MEDIUM)를 지적해 전체 등급을 LOW 로 끌어올림.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 트래커가 "해소" 를 선언(체크 + "2026-09-21 해소 (`plan/complete/e2e-race-helper.md`)" 각주, commit `ffb2a8197`)했지만 인용된 `plan/complete/e2e-race-helper.md` 는 존재하지 않고, 소유 plan `plan/in-progress/e2e-race-helper.md` 는 여전히 `plan/in-progress/` 에 머물며 `## 체크리스트` 3항목(`/ai-review → 수렴`, `/consistency-check --impl-done → BLOCK: NO`, `트래커 항목 해소 + plan/complete/ 이동`)이 미체크 상태. `git show ffb2a8197 -- plan/in-progress/e2e-race-helper.md` 는 빈 diff — 트래커 갱신 커밋이 소유 plan 자체는 건드리지 않음. 이 저장소의 동일 라운드 선례(`webauthn-dup-delete`, `modelconfig-dup-delete`, `integration-dup-delete` 등)는 트래커 갱신과 `plan/complete/` 이동을 항상 같은 커밋에 처리해 왔음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커) ↔ `plan/in-progress/e2e-race-helper.md` (소유 plan) | 저장소 관례("트래커 해소 마커 = plan/complete 이동과 동일 커밋", 위 3개 선례) | 마무리 커밋에서 한 번에 처리: (1) 이번 `/consistency-check --impl-done` 결과(BLOCK: NO)를 소유 plan 체크리스트 2번째 항목에 반영, (2) `/ai-review` 체크박스가 이미 사실(라운드 3 수렴)과 일치하는지 확인 후 체크, (3) `plan/in-progress/e2e-race-helper.md` → `plan/complete/e2e-race-helper.md` 로 실제 이동 + frontmatter `status: complete` 갱신. 이 세 가지가 트래커 각주가 이미 주장한 상태를 사실로 만든다 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Naming Collision | 신규 식별자 `raceUnderHeldLock`, `KNOWN_LOCK_TIMEOUTS_MS`, `VACUITY_GUARD_MS`, 파일 `codebase/backend/test/helpers/concurrency.ts` — 저장소 전체 grep 결과 기존 정의와 충돌 없음. `KNOWN_LOCK_TIMEOUTS_MS` 는 기존 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(`codebase/backend/src/modules/triggers/trigger-config-lock.ts:128`)를 재정의 없이 import 재사용 | `codebase/backend/test/helpers/concurrency.ts` | 없음 — 정보성 기록 |
| 2 | Naming Collision | `spec/5-system` 은 이번 변경에서 델타 0 — 요구사항 ID·엔드포인트·env var 어느 것도 이번 diff 와 접점 없음 | `spec/5-system/**` | 없음 — 정보성 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `spec/5-system` 델타 0, 프로덕션 코드 변경 0 — 데이터모델/API계약/요구사항ID/상태전이/RBAC/계층책임 6관점 전부 충돌 후보 없음 (순수 e2e 헬퍼 추출) |
| Rationale Continuity | NONE | 리팩터 전후 단언·기대 응답코드 불변 확인. `spec/5-system/1-auth.md` §1.4.4 동시성 설계 Rationale 우회 없이 오히려 검증(공허성 가드)을 구조적으로 강화 |
| Convention Compliance | NONE | 명명(`helpers/*.ts` 패턴, camelCase/SCREAMING_SNAKE_CASE)·문서 구조(`PROJECT.md` e2e 패턴 SoT 배치)·API/출력 포맷·금지항목 5관점 전부 위반 없음. `spec_impact: none` bare 리터럴 형식도 정확 |
| Plan Coherence | MEDIUM | target(spec) 축은 문제 없음. diff 에 포함된 트래커 plan 이 소유 plan 의 미체크 상태·부재 경로를 앞질러 "해소" 선언 — WARNING 1건 |
| Naming Collision | NONE | 신규 식별자 3개(`raceUnderHeldLock`, `KNOWN_LOCK_TIMEOUTS_MS`, `VACUITY_GUARD_MS`) 전수 grep, 기존 요구사항ID/엔티티/엔드포인트/이벤트명/env var 와 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) 마무리 커밋에서 `plan/in-progress/e2e-race-helper.md` 체크리스트 3항목(ai-review 체크, 이번 consistency-check 결과 반영, 트래커 해소+`plan/complete/` 이동)을 이 커밋과 **동일 커밋**으로 처리해 트래커의 기존 "해소" 각주와 실제 상태를 일치시킬 것.
2. 위 처리 시 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 각주가 가리키는 `plan/complete/e2e-race-helper.md` 경로가 실제로 생성되는지 확인.
