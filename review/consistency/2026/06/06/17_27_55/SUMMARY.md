# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 없음. Warning 2건(중복 제거 후 실질 2건), INFO 다수. 변경의 핵심(e2e 테스트 픽스처를 DB 직접 INSERT → 정식 API 경로로 교체 + ENCRYPTION_KEY 교정)은 spec 계층 규약에 더 부합하는 방향의 개선이다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Plan Coherence | `impl-exec-concurrency-cap` active worktree 가 `spec/data-flow/3-execution.md` 동일 라인을 Phase B 이전 모델로 기술 중 — rebase 없이 push 시 Phase B 완료 서술이 덮어써질 위험 | `spec/data-flow/3-execution.md` L48-50, L108-119 | `plan/in-progress/exec-intake-queue-impl.md` (PR2b 착수조건에 "exec-park-pr-b2 머지 후 rebase 선행 필수" 명시) | target PR 머지 완료 직후 `exec-intake-queue-impl.md` PR2b 착수 담당자에게 origin/main rebase + `spec/data-flow/3-execution.md` 충돌 수동 해소 리마인드. 추가 plan 갱신 불요 (착수조건에 이미 명기). |
| W2 | Convention Compliance | `pending_plans` 에 `fix-webchat-sse-field-map.md` 포함 — 본 PR 로 해당 plan 이 완료됐다면 `pending_plans` 에서 제거 및 `plan/complete/` 이동 후 `status: implemented` 승격 필요 | `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans:` | `spec/conventions/spec-impl-evidence.md §3.1` 전이 규칙 | 본 PR 이 `fix-webchat-sse-field-map.md` 를 완료시키는지 확인. 완료됐다면 `pending_plans` 제거 + `plan/complete/` 이동 + 양쪽 plan 모두 완료 시 `status: implemented` 승격. 현재 둘 다 `in-progress/` 이므로 `status: partial` 은 적절 — 현재 상태는 가드 통과. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Naming Collision | `INTERACTION_JWT_SECRET` ENV key — spec §8.3 에 처음 명시되었으나 `.env.example` 미등재. `JWT_SECRET` 과 이름 유사하나 별개 변수 (코드 fallback 체인 구현 완료) | `spec/5-system/14-external-interaction-api.md` §8.3 | `codebase/backend/.env.example` 에 `INTERACTION_JWT_SECRET=` 항목을 `JWT_SECRET` 근처에 추가 |
| I2 | Naming Collision | `LLM_STUB_MODE` ENV key — spec §7.1 신설이나 코드·docker-compose 선행 구현. `.env.example` 누락. `OAUTH_STUB_MODE` 와 동일 패턴 | `spec/5-system/7-llm-client.md` §7.1 | `codebase/backend/.env.example` 에 `# LLM_STUB_MODE=false` 를 `OAUTH_STUB_MODE` 인근에 추가 |
| I3 | Convention Compliance | `spec/5-system/14-external-interaction-api.md` §10 의 `dto/responses.dto.ts` 단일 파일 표기 — `swagger.md §5-1` 의 `dto/responses/*-response.dto.ts` 서브폴더 규약과 표기 불일치 | `spec/5-system/14-external-interaction-api.md` §10 | 실구현 파일이 `responses/` 패턴을 따르는지 확인 우선. spec §10 표기를 `dto/responses/interact-response.dto.ts` 등으로 맞추거나 drift 주석 추가 |
| I4 | Convention Compliance | `STATE_MISMATCH` 에러 코드 신설 결정 근거 미기재 — WS `INVALID_EXECUTION_STATE` 와 별도 표기한 이유가 spec Rationale 에 없음 | `spec/5-system/14-external-interaction-api.md` §5.1 | `## Rationale` 에 "EIA 표면 에러 코드 명명 — WS INVALID_EXECUTION_STATE 와 분리 이유" 한 항목 추가 (필수 아님) |
| I5 | Rationale Continuity | ENCRYPTION_KEY 교정 이유("crypto.util AES-256 경로 e2e 커버를 위해 64-hex 세팅")가 코드·docker-compose 주석에는 기재됐으나 spec/PROJECT.md Rationale 에 미기재 | `docker-compose.e2e.yml`, `codebase/backend/test/execution-park-resume.e2e-spec.ts` | `PROJECT.md §e2e 테스트 작성 가이드` 또는 spec §14 Rationale 에 INFO 수준 메모로 추가 (재발 방지용, 필수 아님) |
| I6 | Plan Coherence | `spec-fix-eia-token-error-codes.md` §2 미결 결정(SCOPE_MISMATCH → 401/TOKEN_SCOPE_MISMATCH 통일)이 향후 §8.3 서술에 영향 가능 | `spec/5-system/14-external-interaction-api.md` §8.3 | `spec-fix-eia-token-error-codes.md` 처리 시 §8.3 참조 여부 재확인. 현재는 충돌 없음 |
| I7 | Plan Coherence | 머지된 stale worktree 3건 미정리 — `harden-review-hooks-cb1c84`(PR #493), `plan-complete-p6-043804`(PR #495), `rag-dynamic-cut-12fac1`(PR #500) | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 변경 전 범위(e2e 테스트 픽스처 교체)에서 spec 충돌 없음. 6개 관점 전수 점검 통과 |
| Rationale Continuity | NONE | DB 직접 INSERT 우회 폐기는 기존 Rationale 의 어떤 기각 대안도 재도입하지 않음. INFO 1건(ENCRYPTION_KEY 교정 근거 Rationale 미기재) |
| Convention Compliance | LOW | Warning 1건(pending_plans 완료 타이밍 정합 확인 권장), INFO 3건. CRITICAL 없음 |
| Plan Coherence | LOW | Warning 1건(impl-exec-concurrency-cap worktree 덮어쓰기 위험 — 착수조건에 이미 명기), INFO 3건 |
| Naming Collision | LOW | Critical/Warning 없음. INFO 2건(INTERACTION_JWT_SECRET, LLM_STUB_MODE 의 .env.example 미등재) |

## 권장 조치사항
1. **(W1 — 머지 후 리마인드)** target PR 머지 직후 `impl-exec-concurrency-cap` 담당자에게 origin/main rebase 및 `spec/data-flow/3-execution.md` 충돌 수동 해소를 리마인드할 것. plan 착수조건에 이미 명기되어 있어 추가 plan 변경 불요.
2. **(W2 — 완료 타이밍 확인)** 본 PR 이 `fix-webchat-sse-field-map.md` 를 완료시키는지 확인. 완료됐다면 `plan/complete/` 이동 + `spec/5-system/14-external-interaction-api.md` `pending_plans` 갱신 + 모든 pending plan 완료 시 `status: implemented` 승격.
3. **(I1/I2 — 운영자 가시성)** `codebase/backend/.env.example` 에 `INTERACTION_JWT_SECRET` 및 `LLM_STUB_MODE` 항목 추가 (기능 영향 없음, 운영자 안내 목적).
4. **(I7 — 정리)** `cleanup-worktree-all.sh --yes --force` 로 MERGED stale worktree 3건 정리.
5. **(I3/I4/I5 — 선택적 문서 보완)** spec §10 dto 경로 표기 교정, STATE_MISMATCH 신설 근거 Rationale 추가, ENCRYPTION_KEY 교정 근거 PROJECT.md 메모 추가 — 모두 필수 아님.