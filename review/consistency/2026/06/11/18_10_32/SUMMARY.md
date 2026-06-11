# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Convention Compliance 에서 CRITICAL 2건 확인. Cross-Spec 에서 WARNING 4건(파급 스펙 3파일 미갱신). 즉각 조치 없이 merge 시 CI 차단 및 spec 내부 정합 파괴.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `pending_plans`에 존재하지 않는(또는 미확인) plan 경로 포함 — `plan/in-progress/unified-model-management.md` 가 파일시스템에 실존하지 않을 경우 `spec-pending-plan-existence.test.ts` CI 차단 | `spec/2-navigation/6-config.md` frontmatter `pending_plans[1]` | `spec/conventions/spec-impl-evidence.md §4` | plan 파일이 실존하면 merge 순서 조율, 없으면 plan 파일 먼저 생성. Plan Coherence checker 확인 결과 PR #541 squash-merge 완료 → `pending_plans` 에서 해당 줄 제거가 올바른 해소책 |
| 2 | Convention Compliance | frontmatter `code:` 경로가 draft 본문이 새로 정의한 통합 surface를 포함하지 않고 구형 분리 경로(`llm-configs/page.tsx`, `rerank-configs/page.tsx`, `llm-config/**`, `rerank-config/**` 등)만 나열 | `spec/2-navigation/6-config.md` frontmatter `code:` 배열 | `spec/conventions/spec-impl-evidence.md §2.1·§3` | `code:` 에 통합 surface 경로(`codebase/frontend/src/app/(main)/models/**`, `codebase/backend/src/modules/model-config/**`, `codebase/frontend/src/lib/api/model-configs.ts` 등) 추가. 구형 경로는 alias 기간 동안 병기 가능하나 통합 경로 반드시 포함 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `1-auth.md §3.2` RBAC 매트릭스가 `LLM Config`/`Rerank Config` 두 행으로 분리된 채 `Model Config` 단일 행 미갱신 — 구현자가 `1-auth.md`만 읽으면 통합 여부 불명 | `spec/2-navigation/6-config.md` §3 Model Config API (Editor+ 참조) | `spec/5-system/1-auth.md §3.2` | `1-auth.md §3.2` 에서 두 행을 `Model Config (CRUD/CRUD/R/R)` 단일 행으로 교체 |
| 2 | Cross-Spec | `1-auth.md §4.1` 감사 로그 액션 슬러그가 `llm_config.*`·`rerank_config.*` 로 남아 단일 ModelConfig 리소스와 불일치 | target 의 R-3 통합 선언(함의) | `spec/5-system/1-auth.md §4.1` | `model_config.* (create/update/delete/set-default; reveal 미제공)` 로 교체. 레거시 슬러그는 과도기 alias 명시 또는 삭제 |
| 3 | Cross-Spec | `7-llm-client.md §5.5` 가 preview-models 경로를 구 `/api/llm-configs/preview-models` 로 유지 — canonical 엔드포인트 이중 정의 | `spec/2-navigation/6-config.md` §3 `POST /api/model-configs/preview-models` | `spec/5-system/7-llm-client.md §5.5` | `§5.5` 경로를 `POST /api/model-configs/preview-models` (및 `GET /api/model-configs/:id/models`)로 갱신. 구 경로는 "(alias, PR4 제거 예정)" 주석 처리 |
| 4 | Cross-Spec | `1-ai-agent.md` 의 `maxTokens` 예시값이 여전히 `2048` — R-5 "동반 갱신" 약속 미이행으로 spec 내부 정합 파괴 | `spec/2-navigation/6-config.md` §B.4 `max_tokens = 4096`, R-5 | `spec/4-nodes/3-ai/1-ai-agent.md` 라인 124·665 | `1-ai-agent.md` ASCII 다이어그램(L124)·JSON 예시(L665)의 `maxTokens`를 `2048` → `4096` 으로 갱신 |
| 5 | Rationale Continuity | §B.6.1 wireframe 의 Rerank 카드 "Connected" 배지가 R-3·§B.6.2 "연결 테스트 미제공" 원칙과 충돌하는 것으로 오독 가능 — 배지 산출 방식 미설명 | `spec/2-navigation/6-config.md` §B.6.1(L226·230) | 동 문서 R-3·§B.6.2(L249) | §B.6.1 주석 또는 §B.6.2 본문에 "Rerank 카드의 'Connected'는 Test Connection 결과가 아니라 설정 저장 상태를 의미한다" 한 줄 추가. 또는 배지를 "Saved"/"설정됨"으로 구분 표기 |
| 6 | Convention Compliance | API 절 헤더 `## 3. API` 가 Part A/B 의 알파벳 체계와 번호 혼재 | `spec/2-navigation/6-config.md` `## 3. API` | `CLAUDE.md` Spec 문서 3섹션 구성 | `## Part C: API` 또는 `## API` 로 통일 권장 (필수 아님) |
| 7 | Convention Compliance | `pending_plans[0]` (`spec-sync-config-gaps.md`) 가 cover 하는 미구현 surface 가 본문에 명시적 목록 없이 추적 어려움 | `spec/2-navigation/6-config.md` frontmatter `pending_plans[0]` | `spec/conventions/spec-impl-evidence.md §2.1` | plan 파일에 spec 이 약속하는 미구현 항목을 명시적으로 목록화하거나, 완료됐으면 `pending_plans` 에서 제거 |
| 8 | Plan Coherence | frontmatter `pending_plans` 에 PR #541 squash-merge 완료된 `unified-model-management.md` 참조 잔존 — plan 파일은 `plan/in-progress/` 에 없고 stale worktree 내부에만 존재 | `spec/2-navigation/6-config.md` frontmatter `pending_plans[1]` | `plan/in-progress/unified-model-management.md` (미존재) | frontmatter에서 해당 줄 제거. PR4 cleanup 추적을 위한 별도 plan 생성 후 `pending_plans` 등재 |
| 9 | Naming Collision | `R-3 (번복)` 헤딩의 긴 anchor slug(`r-3-번복--modelconfig-단일-화면-통합`) — 타이포 시 dead-link 위험 (현재 `5-knowledge-base.md` 참조는 유효) | `spec/2-navigation/6-config.md` `### R-3 (번복)` | `spec/2-navigation/5-knowledge-base.md:239` | 선택적 개선: 헤딩을 `### R-3. ModelConfig 단일 화면 통합`으로 단순화하고 `(번복)` 표기를 하위 bold 노트로 이동 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | R-1 Rationale 내 구 화면명 `/llm-configs` 잔재 (draft 는 이미 수정됨) | `spec/2-navigation/6-config.md` R-1(L282) 구 버전 | 다른 spec 에서 구 R-1 문구 직접 인용 시 갱신. draft 는 이미 올바름 |
| 2 | Cross-Spec | `1-auth.md §3.2` 레거시 이름(`LLM Config`·`Rerank Config`) vs target 단일 이름(`Model Config`) — WARNING #1 처리 시 자연 해소 | `spec/5-system/1-auth.md §3.2` | WARNING #1 처리와 동시 해소 |
| 3 | Rationale Continuity | §B.6.2 의 연결 테스트 미제공 근거 참조가 R-3(화면 통합 번복)를 단독 지목 — 실제 근거(표준 API 부재)가 희석 | `spec/2-navigation/6-config.md` §B.6.2(L249) | 참조를 `(표준 model-list/test API 부재 — R-3 유지 사항)` 형식으로 개선하거나 R-6 별도 항목 추가 |
| 4 | Rationale Continuity | R-5 의 AI 노드 spec 연동 갱신 약속 — target 내에서 완료 여부 확인 불가 (Cross-Spec WARNING #4 와 동일 근원) | `spec/2-navigation/6-config.md` R-5 | WARNING #4 처리로 해소 |
| 5 | Convention Compliance | H1 제목 변경(`LLM, Rerank` → `Models`) — cross-link 텍스트 참조 문서 갱신 필요 여부 확인 | `spec/2-navigation/6-config.md` H1 | merge 전 `grep -r "설정 (인증, LLM, Rerank)"` 로 점검 |
| 6 | Convention Compliance | 내부 링크 anchor slug 유효성 — `spec-link-integrity.test.ts` CI 확인 필요 | `spec/2-navigation/6-config.md` 본문 내부 링크 | merge 후 CI `spec-link-integrity.test.ts` 결과 확인. 실패 시 slug 조정 |
| 7 | Naming Collision | frontmatter `id: config` — 영역 prefix 없는 단음절, 현재 충돌 없음 | frontmatter `id: config` | 즉시 수정 불필요. 향후 `id: nav-config` 등 prefix 부여 검토 |
| 8 | Plan Coherence | `spec-sync-config-gaps.md` 소유 worktree `spec-sync-audit` stale (PR #443 MERGED) — plan 파일 자체는 미해소 Auth gap 추적으로 in-progress 유지 타당 | `plan/in-progress/spec-sync-config-gaps.md` `worktree: spec-sync-audit` | `cleanup-worktree-all.sh` 실행 권장. plan frontmatter `worktree` 를 `(unstarted)` 또는 신규 worktree 명으로 갱신 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | WARNING 4건 — `spec/5-system/1-auth.md`(RBAC·감사로그), `spec/5-system/7-llm-client.md`(preview-models 경로), `spec/4-nodes/3-ai/1-ai-agent.md`(maxTokens 예시) 3파일 미갱신 |
| Rationale Continuity | LOW | WARNING 1건 — Rerank "Connected" 배지 의미 미설명. INFO 2건 |
| Convention Compliance | HIGH | **CRITICAL 2건** — pending_plans 경로 미존재 가능성(CI 차단), code: 경로 통합 surface 누락. WARNING 2건 |
| Plan Coherence | LOW | WARNING 1건 — PR #541 완료 후 pending_plans 미정리. INFO 2건 |
| Naming Collision | LOW | WARNING 1건 — R-3 anchor slug 길이(현재 dead-link 없음). INFO 1건 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/2-navigation/6-config.md` frontmatter `pending_plans` 에서 `- plan/in-progress/unified-model-management.md` 줄 제거 (PR #541 완료 확인됨). PR4 cleanup 추적 신규 plan 파일 생성 후 등재.
2. **(BLOCK 해소 필수)** frontmatter `code:` 배열에 통합 surface 경로 추가 — `codebase/frontend/src/app/(main)/models/**`, `codebase/backend/src/modules/model-config/**`, `codebase/frontend/src/lib/api/model-configs.ts`, `codebase/frontend/src/components/models/**`. 구형 경로는 alias 기간 동안 병기 가능.
3. **(WARNING 해소 권장)** `spec/4-nodes/3-ai/1-ai-agent.md` L124·L665 의 `maxTokens` 값을 `2048` → `4096` 으로 갱신 (R-5 약속 이행).
4. **(WARNING 해소 권장)** `spec/5-system/1-auth.md §3.2` RBAC 매트릭스를 `Model Config` 단일 행으로 교체, `§4.1` 감사 로그 슬러그를 `model_config.*` 로 갱신.
5. **(WARNING 해소 권장)** `spec/5-system/7-llm-client.md §5.5` 경로를 `POST /api/model-configs/preview-models` / `GET /api/model-configs/:id/models` 로 갱신.
6. **(WARNING 해소 권장)** `spec/2-navigation/6-config.md §B.6.1` 또는 §B.6.2 에 Rerank "Connected" 배지가 Test Connection 결과가 아님을 명시.
7. **(INFO)** merge 전 `grep -r "설정 (인증, LLM, Rerank)"` 로 H1 제목 변경의 cross-link 영향 확인.
---

## 호출자(main Claude/planner) 사후 판정 — 2026-06-11 (rebase 재검토)

**BLOCK 재판정: NO — Critical 2·실질 WARNING 4 전부 실측 반증(FP).** 본 게이트는 #541(통합 모델 관리) rebase 후 6-config.md 재검토였고, 발견들은 전부 "#541 이 해야 했는데 안 했다"는 가정 기반인데 **#541 이 이미 전부 이행**했다:

| 발견 | 실측 반증 |
|------|-----------|
| C-1 (pending_plans plan 미존재 → CI 차단) | `plan/in-progress/unified-model-management.md` **실존** (`ls` 확인). 가드 통과 — docs-guard 2134 green 이 교차 증거 |
| C-2 (code: 통합 surface 누락) | frontmatter 에 `app/(main)/models/page.tsx`·`components/models/model-config-manager.tsx`·`lib/api/model-configs.ts`·`backend/modules/model-config/**` **전부 포함** (구 경로는 alias 병기) |
| W-1 (1-auth RBAC 2행 분리 잔존) | `1-auth.md` L321 **이미 `Model Config` 단일 행** |
| W-2 (감사 슬러그 llm_config.* 잔존) | `1-auth.md` L358·360 **이미 `model_config.*` 통합** + 레거시 OR-질의 정책 명시 |
| W-3 (7-llm-client 구 preview 경로) | `7-llm-client.md` L315·319 **이미 `/api/model-configs/preview-models` + `:id/models`** (구 llm-config 라우트는 코드상 alias 잔존 — spec 정합) |
| W-4 (1-ai-agent maxTokens 2048 잔존) | L124(다이어그램)·L665(JSON) **둘 다 이미 4096**, 파일 전체에 2048 등장 0회 — R-5 동반 갱신 기이행 |

나머지(W-5 Rerank 배지 의미·W-6 `## 3. API` 헤더·W-9 anchor 길이·INFO 다수)는 #541 머지 본문에 대한 선택적 nit — 본 nit PR 범위 밖 보류.

**본 PR 의 rebase 재검토 실질 결과**: stale 1건 발견·수정 — 6-config `## Overview` 도입부가 구 구조(Part B: LLMConfig / Part C: RerankConfig)를 기술 → **Part B: Models(kind 구분 단일 ModelConfig)** 로 정정. 그 외 5건(1-ai-agent 탭 명칭·라벨 통일·Back 근거·sort 오버라이드·OAuth 레지스트리)은 #541 이후에도 정합 재확인(i18n 키 실재·docs-guard 2134 green). 진행 차단 없음.
