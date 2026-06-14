# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 발견 없음. WARNING 3건(규약 준수 2건, Plan 정합성 1건), INFO 12건. 명명 충돌 없음, Rationale 번복 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | V085·V087 마이그레이션에 `-- DOWN:` 주석 누락 | `migrations/V085__execution_user_variables.sql`, `V087__execution_resume_call_stack.sql` | `spec/0-overview.md §2.8` + `migrations/README.md §2` ("롤백 SQL 을 `-- DOWN:` 주석으로 보존") | V085 하단 `-- DOWN: ALTER TABLE execution DROP COLUMN IF EXISTS user_variables;`, V087 하단 `-- DOWN: ALTER TABLE execution DROP COLUMN IF EXISTS resume_call_stack;` 추가 |
| 2 | Convention Compliance | `spec/conventions/swagger.md §0)` 섹션 번호가 기존 1-based 체계 및 외부 cross-reference(`error-codes.md §18`에서 `swagger.md §2-4` 참조)와 혼재 | `spec/conventions/swagger.md` line 23 — `## 0) Swagger UI 노출 정책` | 기존 `§1~§6` 1-based 번호 체계; `error-codes.md §18` cross-reference | (a) `## 0)` → `## 1)`로 renumber하고 기존 섹션을 `§2` 이하로 밀거나, (b) `## 0)` 유지 시 `error-codes.md §18` 등의 참조를 `§3-4`로 갱신 |
| 3 | Plan Coherence | C-2 plan 체크박스 미갱신 — 구현·spec 갱신 완료됐으나 `- [ ] 결정 대기` 상태로 잔존 | `plan/in-progress/refactor/05-database.md` C-2 항목 | plan-checkbox=실제상태 원칙(MEMORY.md) | `- [ ] 결정 대기` → `- [x] 완료 (재귀 CTE 단일 쿼리, 2026-06-14)` 로 갱신 + spec 갱신 사실 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `WorkflowVersionListItemDto[]` 응답 타입 갱신이 `spec/data-flow/11-workflow.md`에 미동기화 | `spec/3-workflow-editor/5-version-history.md §7.1`, `spec/data-flow/11-workflow.md §1.1` | `data-flow/11-workflow.md §1.1` WorkflowVersionsController 설명에 "목록 응답은 snapshot 제외 DTO, 상세 응답은 snapshot 포함" 1줄 추가 |
| 2 | Cross-Spec | `computeChainDepth` 재귀 CTE 갱신 후 동일 파일 line 510 "SELECT 가 느려진다" 표현이 오해 소지로 잔존 | `spec/5-system/13-replay-rerun.md` line 281 vs line 510 | line 510 E1 설명에서 "느려진다" 표현을 결정 이전 비교임을 명시하거나 현재 구현 반영으로 보정 |
| 3 | Cross-Spec | ALTER COLUMN TYPE shadow-column 3-step 규약이 `migrations/README.md §6`에만 있고 `spec/conventions/migrations.md`·`spec/0-overview.md §2.8`에 미반영 | `codebase/backend/migrations/README.md §6` | `spec/conventions/migrations.md`에 "ALTER COLUMN TYPE 안전 절차는 `migrations/README.md §6` 참조" 1줄 추가 |
| 4 | Cross-Spec | NodeExecution V047·V048 인덱스가 `spec/1-data-model.md §3`에 추가됐으나 `spec/data-flow/3-execution.md §1.1`은 미언급 | `spec/1-data-model.md §3` vs `spec/data-flow/3-execution.md §1.1` | data-flow에 "인덱스 전체 목록은 `spec/1-data-model.md §3` 참조" 각주 추가 또는 hot-path 선택적 언급 방침 주석으로 명시 |
| 5 | Cross-Spec | `DB_POOL_MAX` 등 DB 풀 env 변수가 `.env.example`에 노출됐으나 `spec/` 어디에도 미기재 | `codebase/backend/.env.example` | `spec/0-overview.md §2.6` 또는 `spec/5-system/_product-overview.md`에 튜닝 변수 목록·기본값 추가 권장 |
| 6 | Rationale Continuity | `spec/3-workflow-editor/5-version-history.md §7.1` DTO 분리 변경에 `## Rationale` 항목 미작성 (인라인 1줄만 있음) | `spec/3-workflow-editor/5-version-history.md` 말미 | Rationale 섹션에 "목록 vs 상세 DTO 분리 — snapshot 제외 근거" 추가 권장 (필수 아님) |
| 7 | Rationale Continuity | shadow column 3-step 규약이 `migrations/README.md`에만 있고 `spec/conventions/migrations.md`에 미반영 (단일 진실 분산 위험) | `codebase/backend/migrations/README.md §6` | `spec/conventions/migrations.md`에 동일 내용 또는 참조 링크 추가 |
| 8 | Rationale Continuity | DB 풀 env 변수 spec 미기재 (운영 가시성 부재) | `codebase/backend/src/common/config/database.config.ts` | `spec/0-overview.md §2.6`에 환경변수 목록 한 줄 기재 권장 |
| 9 | Convention Compliance | `spec/1-data-model.md §2.16` 에 `#### Rationale (ModelConfig 통합)` 인라인 중첩 — 문서 끝 `## Rationale`와 위치 분산 | `spec/1-data-model.md` line 557 | 인라인 Rationale 를 문서 끝 `## Rationale`로 이전하거나, 인라인 병행 허용을 CLAUDE.md에 명시 |
| 10 | Convention Compliance | `spec/5-system/1-auth.md` Rationale 서브섹션 `### 2.3.A/B/C` 패턴이 다른 파일의 의미 중심 제목 관행과 불일치 | `spec/5-system/1-auth.md §Rationale` | `### 2.3.B — ...` → `### Refresh 쿠키 SameSite 정책 (M-5·m-3)` 형태 의미 중심 제목으로 변경 (선택적) |
| 11 | Plan Coherence | C-3·m-3 plan 체크박스 미갱신 (구현 완료됐으나 `- [ ] 미착수` 상태) | `plan/in-progress/refactor/05-database.md` C-3, m-3 항목 | 해당 항목을 `- [x] 완료`로 갱신 |
| 12 | Plan Coherence | C-3 spec 갱신을 plan이 "(planner)" 귀속했으나 developer가 직접 수행 (역할 모델 추적 불일치) | `plan/in-progress/refactor/05-database.md` C-3 | 추가 조치 불요(이미 반영). 향후 "(planner)" 귀속 spec 변경은 developer가 직접 수행 금지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 모순 없음. spec 4개 파일 변경이 다른 spec 영역과 직접 충돌하지 않음. 미동기화 INFO 4건 + env 미기재 INFO 1건 |
| Rationale Continuity | LOW | 기각 대안 재도입·합의 원칙 위반 없음. INFO 3건(Rationale 미작성, 단일진실 분산 위험, DB 풀 env 미기재) |
| Convention Compliance | LOW | WARNING 2건(V085·V087 `-- DOWN:` 누락, swagger.md §0 번호체계 혼재). INFO 2건 |
| Plan Coherence | LOW | WARNING 1건(C-2 체크박스 미갱신). INFO 2건(C-3·m-3 미갱신, 역할 추적 불일치). CRITICAL 없음 |
| Naming Collision | NONE | 신규 식별자 전원 충돌 없음. `WorkflowVersionListItemDto`, `idx_node_execution_exec_status_active` 등 기존 패턴 준수 |

## 권장 조치사항

1. **[WARNING 해소 — 즉시]** `migrations/V085`·`V087` 하단에 `-- DOWN:` 롤백 주석 추가 (각 1줄, `spec/0-overview.md §2.8` 준수).
2. **[WARNING 해소 — 즉시]** `spec/conventions/swagger.md §0)` 섹션 번호 체계 정리 — `## 1)`로 renumber하거나 `error-codes.md §18` 외부 참조 링크 갱신.
3. **[WARNING 해소 — 즉시]** `plan/in-progress/refactor/05-database.md` C-2 체크박스를 `- [x] 완료 (재귀 CTE 단일 쿼리, 2026-06-14)`로 갱신.
4. **[INFO 권장]** `plan/in-progress/refactor/05-database.md` C-3·m-3 체크박스도 `- [x] 완료`로 갱신.
5. **[INFO 권장]** `spec/conventions/migrations.md`에 "ALTER COLUMN TYPE 안전 절차는 `migrations/README.md §6` 참조" 1줄 추가 (단일 진실 보강).
6. **[INFO 선택]** `spec/0-overview.md §2.6`에 DB 풀 튜닝 환경변수(`DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`) 기본값 포함 1줄 기재.
7. **[INFO 선택]** `spec/data-flow/11-workflow.md §1.1`에 버전 목록/상세 DTO 구분 1줄 추가.