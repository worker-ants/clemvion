# consistency-check --impl-prep SUMMARY — V-04 folder depth/cycle guard (14_08_56)

**BLOCK: NO** — CRITICAL 0. WARNING 은 (a) 본 작업이 해소할 갭, (b) 무관 pre-existing. checker 5/5.

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | LOW | 충돌 없음. INFO: PATCH row 에 depth/cycle 400 명시·§2.5 에 acyclic/same-workspace 명시 권고(구현 후 문서화) |
| rationale_continuity | NONE | §2.6 container_id cycle 거부·workflow settings strict-write 원칙이 hard-fail 지지 |
| convention_compliance | MEDIUM | WARNING: (i) §2.5 depth invariant 가 create() 만 enforce, update() 미검증 = **본 작업 대상** + PATCH row/에러코드 미문서화 → 구현+spec 문서화. (ii) NAV-WF-06 ✅ vs folder UI Planned 불일치 = **무관(V-05류 UI, 스코프 밖)**. INFO: GET bare-array shape(pre-existing repo-wide)·PATCH Swagger desc |
| plan_coherence | LOW | V-04 는 spec-code-cross-audit 잔여 major, plan 권장=코드 구현. 정합 |
| naming_collision | WARNING | 새 cycle 에러코드가 CONTAINER_CYCLE/CYCLE_DETECTED 와 충돌 위험 → **기존 create() depth 패턴처럼 `VALIDATION_ERROR` 재사용**(신규코드 없음) |

## 착수 계획
1. 코드: `update()` 에 parentId 변경 시 (a)같은 workspace parent (b)self/자손 아님(cycle) (c)parent depth+subtree height ≤5 검증 — 전부 `VALIDATION_ERROR`(create 일관). `getDepth()` visited-set+상한 가드(무한루프 방지).
2. spec 문서화: `1-workflow-list §3.1` PATCH row 에 "부모 변경 시 깊이 초과/cycle/타 workspace → 400" + PATCH Swagger desc. `1-data-model §2.5` 에 acyclic/same-workspace parent 명시.
3. 테스트: update depth/cycle(self·자손)/workspace/정상(루트) + getDepth 무한루프 가드.

## 스코프 밖(기록)
- NAV-WF-06 ✅ vs folder UI Planned 불일치(convention WARNING ii) — folder UI(V-05류) 이슈, V-04(backend guard) 무관.

## 판정: BLOCK: NO
