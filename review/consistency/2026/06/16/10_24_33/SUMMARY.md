# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Critical 1건(미구현 에러 코드를 기정사실로 서술), 그 외 INFO 5건. 본 worktree 의 핵심 변경(`RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`)은 정합하며, Critical 항목은 사전 존재하던 R-1 표현의 문제입니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | R-1 에서 미구현(Planned) 에러 코드 `LLM_MODEL_NOT_FOUND` 를 현재 발행되는 코드처럼 기정사실로 서술 — `LLM_*` prefix 는 `MODEL_CONFIG_*` 로 통일됐고 활성 카탈로그에 미등재, llm-client spec 에서 명시적으로 Planned 분류 | `spec/2-navigation/6-config.md` §Rationale R-1 | `spec/conventions/error-codes.md §1·§5 Rename 이력`, `spec/5-system/7-llm-client.md §5` (Planned 분류), `spec/5-system/3-error-handling.md §1.3` (미등재) | R-1 해당 문장을 "현재는 `LLM_CONNECTION_ERROR` 로 수렴되나 향후 `LLM_MODEL_NOT_FOUND` 로 세분화 예정 (Planned — `spec/5-system/7-llm-client.md §5`)"로 정정하거나, "런타임 LLM 호출 에러로 실패한다"로 단순화 |

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/7-llm-client.md §4.1 Rationale` 의 "SSRF 가드(`tei`/`local` 사설망 예외)" 표현이 `local` rerank Dropped 결정을 미반영 | `spec/5-system/7-llm-client.md §4.1 RerankClientFactory Rationale` | `tei`/`local` → `tei` (local Dropped)로 표현 정정. target 자체는 정합 |
| 2 | Cross-Spec | R-5 의 `max_tokens` 기본값 4096 "동반 갱신" 약속이 이미 이행됐으나 완료 표기가 없음 | `spec/2-navigation/6-config.md §Rationale R-5` | R-5 에 "(완료)" 표기 추가 — 실질 불일치 없음 |
| 3 | Cross-Spec | §A.4 Reveal 흐름에서 HTTP 상태코드만 명시하고 애플리케이션 에러 코드 미명시 | `spec/2-navigation/6-config.md §A.4` 3단계 | `401 AUTH_REQUIRED` / `403 FORBIDDEN` 으로 API 규약 코드 명시 권장 |
| 4 | Naming Collision | `LLM_MODEL_NOT_FOUND` 가 활성 error-codes.ts·카탈로그에 미등재 식별자로 참조됨 (Convention Compliance Critical 와 동일 건, INFO 등급으로 중복 보고) | `spec/2-navigation/6-config.md §R-1` | Critical #1 해소로 함께 해결됨 |
| 5 | Plan Coherence | `spec-sync-config-gaps.md` (전 항목 완료)가 `plan/in-progress/` 에 잔존하며 frontmatter `pending_plans` 에 등재됨 | `spec/2-navigation/6-config.md` frontmatter, `plan/in-progress/spec-sync-config-gaps.md` | plan-lifecycle 규약에 따라 `plan/complete/` 로 이동 (본 변경과 무관) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | SSRF 가드 `tei`/`local` 표현 — target 아닌 참조 문서(`7-llm-client.md §4.1`) 갱신 필요 |
| Rationale Continuity | NONE | 두 교정(`RERANK_CONFIG_INVALID`→`MODEL_CONFIG_INVALID`, provider Dropped 현행화) 모두 기존 Rationale 연속성 강화 |
| Convention Compliance | MEDIUM | R-1 의 미구현 에러 코드 `LLM_MODEL_NOT_FOUND` 기정사실 서술 (CRITICAL) |
| Plan Coherence | NONE | 변경이 PR4b 결정과 완전 정합. `spec-sync-config-gaps.md` plan 이동 미비만 INFO |
| Naming Collision | NONE | 신규 식별자 충돌 없음. `LLM_MODEL_NOT_FOUND` 미등재 참조는 INFO |

## 권장 조치사항

1. **(BLOCK 해소 — Critical)** `spec/2-navigation/6-config.md` §Rationale R-1 의 `LLM_MODEL_NOT_FOUND` 기정사실 서술을 수정한다.
2. **(INFO — 선택)** `spec/5-system/7-llm-client.md §4.1 Rationale` 의 "SSRF 가드(`tei`/`local` 사설망 예외)" → "SSRF 가드(`tei` 사설망 예외 — `local` rerank Dropped)" 로 정정.
3. **(INFO — 선택)** `spec/2-navigation/6-config.md §A.4` Reveal 흐름 3단계에 `AUTH_REQUIRED`/`FORBIDDEN` 에러 코드 명시.
4. **(INFO — 별도 작업)** `plan/in-progress/spec-sync-config-gaps.md` 를 `plan/complete/` 로 이동. **← 이미 PR #619(머지됨)에서 처리 완료.** checker 가 origin/main base 로 읽어 발생한 stale (실제 worktree·main 모두 `complete/` 에 존재, frontmatter `pending_plans` 제거됨). FP.

---

## 호출자 사후판정 (main Claude, 2026-06-16 — spec-fix-models-errorcode PR)

1차 BLOCK: YES 의 Critical + INFO ground truth 를 코드/spec 으로 검증하고 처분했다. **처분 후 재실행 결과는 같은 디렉토리의 후속 세션 SUMMARY 참조** (BLOCK 재판정).

- **Critical #1 (R-1 `LLM_MODEL_NOT_FOUND` 기정사실 서술)**: **유효 — 수정함**. ground truth: `7-llm-client.md §5`(L345)이 `LLM_MODEL_NOT_FOUND`(404)·`LLM_AUTH_ERROR`·`LLM_CONTEXT_EXCEEDED` 를 **Planned(미구현)** 로 명시, 현재 클라이언트 계층은 429→`LLM_RATE_LIMIT`/그외→`LLM_CONNECTION_ERROR` 2분기로 수렴. R-1 이 Planned 코드를 현재 동작으로 단정 → "런타임 LLM 호출 에러로 실패(현재 `LLM_CONNECTION_ERROR` 수렴; `LLM_MODEL_NOT_FOUND` 세분화는 Planned, §5)" 로 정정. 본 PR 테마(에러코드 정확성)에 직결돼 흡수.
- **INFO-1 (`7-llm-client.md §4.1·RerankFactory Rationale` "tei/local 리랭커")**: **유효 — 수정함**. 본 PR 의 W-2(`local` 리랭커 Dropped) 정정의 직접 cross-ref. L257·L472 의 "자가호스팅 tei/local 리랭커" 는 stale(rerank 에 `local` provider 없음) → "tei (rerank 유일 사설망 provider)" 로 정정하되 재사용하는 §5.5 규칙 자체는 tei/local 임을 명시.
- **INFO-5 (plan 미이동)**: **FP — rebase 로 해소**. 1차 실행은 워크트리 base 가 #619 머지 **전**(c62408c8)이라 stale 한 frontmatter(`pending_plans` 잔존)를 읽었다. 사용자가 #619 머지 후 본 PR 브랜치를 origin/main(94d3a50f, #619 포함)으로 **rebase** → frontmatter `implemented`·pending_plans 제거·plan `complete/` 이동이 모두 반영됨. checker 인용 상태는 더 이상 존재하지 않음.
- **INFO-2 (R-5 4096 완료 표기)·INFO-3 (§A.4 reveal 에러코드 명시)**: cosmetic·본 PR 범위 밖 → DEFER(별도 grooming).

**중대 발견**: 1차 consistency 실행이 stale base 를 드러냈다 — `ensure-worktree.sh` 가 로컬 HEAD(c62408c8) 기반으로 워크트리를 만들어 #619 변경이 빠진 채 작업 중이었다. 이대로 PR 했으면 **#619 를 되돌릴** 뻔했다. INFO-5 의 plan-coherence FP 가 단서가 되어 base 점검 → rebase 로 교정. ⇒ 처분 후 재실행으로 BLOCK 해소 확인.
