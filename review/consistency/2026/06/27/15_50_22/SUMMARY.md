# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

> **후속 조치 메모**: 아래 W-1(spec §3 표에 `?type`/400 미기술)은 본 PR 에서 **해소됨** — `spec/2-navigation/6-config.md §3` `GET :id/models` 행에 "쿼리 `?type=chat|embedding`(선택), 허용값 외 400 (`ParseEnumPipe`)" 추가. I-1/I-2/I-3 는 INFO/pre-existing 으로 defer(요약 하단).

검토 범위: `spec/2-navigation/6-config.md` (--impl-done, diff-base=origin/main)
구현 대상: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, `codebase/backend/test/workspace-rbac.e2e-spec.ts`
검토 일시: 2026-06-27

---

## 전체 위험도

**LOW** — Critical 없음. Warning 1건(spec SoT 계약 기술 갭 — 본 PR 에서 해소). 나머지 모두 INFO 수준 동기화 권장.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 제안 | 처리 |
|---|---------|------|-------------|------|------|
| W-1 | Convention Compliance | `GET :id/models` 에 `ParseEnumPipe` type 검증(허용값 외 400) 신규 도입됐으나 `spec/2-navigation/6-config.md §3` API 표에 `?type` + 400 미반영 | `spec §3 GET :id/models` 행 | spec §3 행에 `?type=chat\|embedding (optional), 허용값 외 400` 추가 | **FIXED** — 본 PR 에서 spec §3 행 보강 |

---

## 참고 (INFO)

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| I-1 | Cross-Spec | `8-embedding-pipeline.md §371` 컨트롤러 pipe 400 동작 미반영 | defer — planner 후속(2차 spec 문서) |
| I-2 | Cross-Spec | `2-api-convention.md §7` Rate Limiting 표에 probe API 10 req/min 미기재 (pre-existing gap, 본 diff 가 드러냄) | defer — pre-existing backlog |
| I-3 | Convention Compliance | `@ApiQuery` 에 `enumName` 미지정 (swagger.md §1-4 권장, 의무 아님) | defer — 선택적 |
| I-4~I-6 | Naming Collision | `MODEL_TYPE_ENUM`/`PROVIDER_PROBE_THROTTLE`/`ModelTypeFilter` 유사 명칭 — 의미·범위 구별돼 실질 충돌 없음 | no-op |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | type 검증 400·throttle 범위 spec 미기재 gap (INFO) |
| Rationale Continuity | NONE | 모든 변경(throttle DRY, MODEL_TYPE_ENUM+ParseEnumPipe, @ApiBadRequestResponse) spec Rationale 정합 |
| Convention Compliance | LOW | spec §3 type 계약 기술 누락 WARNING(본 PR fix). 나머지 규약 준수 |
| Plan Coherence | LOW | C-2 cluster 4 완료 기록 정합, 미해소 선행 없음 |
| Naming Collision | NONE | 신규 식별자 파일-로컬, 실질 충돌 없음 |

---

## 권장 조치사항

1. **(W-1 — 본 PR 해소)** spec §3 `GET :id/models` 행에 `?type`/400 기술 추가 완료.
2. (I-1·I-2 defer) embedding-pipeline §371·api-convention §7 throttle 표 보강은 planner 후속/별 backlog.
3. (I-3 선택) `@ApiQuery enumName: 'ModelTypeFilter'` — OpenAPI 가독성, 의무 아님.

STATUS=success BLOCK=NO PATH=/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/review/consistency/2026/06/27/15_50_22/SUMMARY.md
