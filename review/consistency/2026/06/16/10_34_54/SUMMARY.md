# Consistency Check 통합 보고서 (재실행 — round 2)

**BLOCK: YES** (1차 판정) → **호출자 사후 BLOCK: NO** (아래 처분 절 참조).

## 전체 위험도
**MEDIUM** — Convention Compliance CRITICAL 1건(에러 코드 SoT 미등재) + WARNING 2건(§5→§6 링크 오기, heading 번호 불연속). 현재 동작 영향 없음.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `LLM_MODEL_NOT_FOUND`(404) 가 Planned 에러 코드로 R-1 에 언급되나 `error-codes.md`·`3-error-handling.md` 에 미등재 — 향후 신설 시 정합 보증 단일 SoT 없음 | `6-config.md` §R-1 (line 293) | `error-codes.md §1~§3`, `3-error-handling.md §1.4` | `3-error-handling.md §1.4` 에 Planned 등재 후 cross-link, **또는 R-1 에서 코드명 직접 언급 제거하고 `[LLM Client §6]` 만 참조** |

---

## 경고 (WARNING)

| # | Checker | 위배 | target | 제안 |
|---|---------|------|--------|------|
| 1 | Cross-Spec / Convention (통합) | R-1 의 `[LLM Client §5]` 링크가 에러 처리 §6 이 아닌 §5(프로바이더별 매핑)를 가리킴 | `6-config.md` §R-1 | `[LLM Client §6 에러 처리](../5-system/7-llm-client.md#6-에러-처리)` 로 정정 |
| 2 | Convention Compliance | body 가 `## Part A/B` → `## 3. API` 로 전환, 인접 spec 순번 체계와 불연속 | `6-config.md` line 252 `## 3. API` | (a) Part A/B 번호 정렬 또는 (b) `## 3. API` → `## API` |

---

## 참고 (INFO)

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | Convention | `action='auth_config.reveal'` backtick 미사용 (line 117) | pre-existing, DEFER |
| 2 | Convention | frontmatter `id: config` 중복 build 가드 미검증 | DEFER (별도) |
| 3 | Plan Coherence | `spec-draft-unified-model-management.md` 동일파일 편집대상 선언 — 의미 충돌 없음 | no action |
| 4 | Naming Collision | `RERANK_CONFIG_INVALID`→`MODEL_CONFIG_INVALID` 교체 — rag-search 의 실행레이어 전용 `RERANK_CONFIG_INVALID` 잔존은 §374 레이어 구분 선언으로 충돌 아님 | **본 PR 정당성 확인** |
| 5 | Naming Collision | `LLM_MODEL_NOT_FOUND` Planned 표기 — `7-llm-client:345` 와 일치, 신규 식별자 아님 | no action |
| 6 | Naming Collision | `useHasRole`/`@Roles('admin')`/`ROLE_LEVEL` — 기존 사용처와 의미 일치 | no action |

---

## 호출자 사후판정 (main Claude, 2026-06-16 — round 2 처분)

**최종 BLOCK: NO** — Critical #1 + WARNING #1 을 **함께 해소**하고, 나머지는 pre-existing/out-of-scope 로 처분.

- **Critical #1 + WARNING #1 (R-1 코드명 미등재 + §5→§6 링크 오기)**: ground truth 확인 — `7-llm-client.md` 의 에러 매핑은 **§6 에러 처리**(L331~, `LLM_MODEL_NOT_FOUND`(404) Planned 표기 L345) 아래에 있고 §5 는 "프로바이더별 매핑". round-1 에서 내가 건 `§5` 링크가 오기였다. **checker 제안 option (b) 채택** — R-1 에서 특정 코드명(`LLM_MODEL_NOT_FOUND`·`LLM_CONNECTION_ERROR`)을 빼고 "런타임 LLM 호출 에러로 실패; 에러 코드 매핑·Planned 세분화는 [LLM Client §6 에러 처리] SoT" 단일 참조로 정정. ⇒ 미등재 코드 직접 참조 제거(Critical 해소) + §6 정확 링크(WARNING #1 해소) + R-1 의 drift 표면 자체 제거.
- **WARNING #2 (`## Part A/B` + `## 3. API` heading 번호 불연속)**: **pre-existing 문서 구조 — 본 PR 미편집**. 에러코드 drift fix 와 무관하고, heading 재번호는 앵커·cross-ref 파급이 큰 별개 구조 변경 → DEFER(별도 grooming).
- **INFO 1·2**: pre-existing cosmetic(backtick·id unique 가드) → DEFER. **INFO 4·5**: 본 PR 변경의 **정당성 확인**(rag-search RERANK_CONFIG_INVALID 레이어 구분 명시로 충돌 아님; LLM_MODEL_NOT_FOUND Planned 표기 일치).

처분 후 R-1 재수정 → docs 가드(dead-link 포함) 재확인 → 1회 더 consistency 재실행으로 BLOCK:NO 수렴 확인(또는 동일 무편집 영역에서 또 다른 Critical 시 비결정 FP 로 git/카탈로그 증거 반증·종결, [[reference_consistency_check_main_baseline_fp]] loop-avoidance).
