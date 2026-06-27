# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 1 WARNING(Rate Limiting §7 표 완전성) + 복수 INFO. Critical 없음. 5 checker 전원 결과 확보(재실행 후).

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 | 처리 |
|---|---------|------|-------------|-----------|------|------|
| W-1 | Cross-Spec | `2-api-convention.md §7` 를 "Rate Limiting 정책 SoT 단일 표"로 선언하면서 KB re-embed `@Throttle 3/min` 이 §7 에 없음 — 표의 완전성 보증이 불명확 | 변경 #3 Rationale | `spec/5-system/8-embedding-pipeline.md §368` KB re-embed `POST /:id/re-embed @Throttle 3/min` 이 §7 에 미기재 | (a) §7 에 KB re-embed 3/min 행 추가(권장) 또는 (b) Rationale 에 표 범위 제한 명시 | **RESOLVED (a)** — §7 에 KB re-embed `POST /:id/re-embed` 3 req/min 행 추가. §7 을 "대표 글로벌 tier + 주요 endpoint-specific @Throttle 오버라이드" 로 표현해 완전성 정합 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 처리 |
|---|---------|------|------|------|
| I-1 | Cross-Spec / Rationale Continuity | `7-llm-client.md §5.5` 에 `@Throttle(10/60s)` inline 값 + §7 cross-ref 이중 출처 drift 위험 | 변경 #4 | **APPLIED** — §5.5 의 `10/60s` 리터럴 제거, `PROVIDER_PROBE_THROTTLE`(3 probe 공통) + 수치 SoT §7 참조로 단일화 |
| I-2 | Cross-Spec / Naming Collision | `LlmConfigController` → `LlmModelConfigController` 정정이 C-2 cluster 4 결과·data-flow §1.1 과 정합 | 변경 #1 | 계획대로 적용 |
| I-3 | Rationale Continuity | `§372` "불필요해지고" 가 ParseEnumPipe 400 강화와 표면적 긴장 — `?type` 전체 제거로 오독 가능 | 변경 #1 | **APPLIED** — §372 에 "서비스 레이어 type 필터 불필요(컨트롤러 ParseEnumPipe 입력 검증은 유지)" 한정 |
| I-4 | Cross-Spec | `6-config.md §3`·`8-embedding-pipeline`·`data-flow/7-llm-usage` 3곳이 같은 ParseEnumPipe 400 기술 → 동시 갱신 필요 | 변경 #1·#2 | 본 draft Rationale 에 3-문서 동기화 체크리스트 명시 |
| I-5 | Naming Collision | 신규 행 "10 req/min" 이 인증 API(IP 기준) 와 동일 숫자 — 혼동 주의 | 변경 #3 | **APPLIED** — 신규 행에 "(사용자 기준)" 명시 |
| I-6 | Naming Collision | `PROVIDER_PROBE_THROTTLE` spec 첫 등장(코드→doc-sync), 동일명 타 사용처 없음 | 변경 #3·#4 | 무해 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 1건(§7 완전성, RESOLVED), INFO 2건 |
| Rationale Continuity | LOW | INFO 3건(§372 범위, stale 참조 정합, SoT 패턴 부합) |
| Convention Compliance | NONE | Critical/Warning 0건 |
| Plan Coherence | NONE | Critical/Warning 0건 |
| Naming Collision | NONE | INFO 4건 모두 무해 |

---

## 권장 조치사항

1. **[WARNING W-1]** `2-api-convention.md §7` 에 KB re-embed `POST /:id/re-embed — 3 req/min (editor, @Throttle)` 행 추가 — RESOLVED.
2. **[INFO I-1]** `7-llm-client.md §5.5` 의 `@Throttle(10/60s)` → `PROVIDER_PROBE_THROTTLE` + §7 참조 — APPLIED.
3. **[INFO I-3]** `8-embedding-pipeline.md §372` 한정 표현 추가 — APPLIED.

---

*검토 대상: `plan/in-progress/spec-draft-mc-endpoint-spec-sync.md` (mode: spec draft, --spec). 재실행 후 5 checker 전원 결과 확보.*
*세션: `/Volumes/project/private/clemvion/.claude/worktrees/planner-mc-spec-sync-8dd179/review/consistency/2026/06/27/16_24_20/`*
