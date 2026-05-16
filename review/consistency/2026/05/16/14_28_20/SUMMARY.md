# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 구현 착수를 차단해야 합니다.

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/2-navigation/4-integration.md`
Worktree: `cafe24-mall-dup-ux-a7f2c8`
세션: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/`
재시도 필요: 0건

---

## 전체 위험도

**HIGH** — CRITICAL 3건(spec-코드 직접 충돌 2건 + worktree Rationale 병합 충돌 1건). 코드베이스와 정면으로 모순되는 spec 삭제가 있어 방향 결정 없이 구현 착수 불가.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `Attention` 가상 필터값·`?status=attention` 쿼리값 삭제 — 프론트엔드 코드와 직접 충돌 | `spec/2-navigation/4-integration.md` §2.3 상태 칩, §2.4 배너 동작, §9.1 status 파라미터, Rationale | `frontend/.../integrations/page.tsx` (`attentionCount`, `needsAttention` 사용), `frontend/.../status-badge.tsx` (`export function needsAttention`), 사용자 가이드 MDX 2종 | (A) Attention 칩·`?status=attention`·삭제된 Rationale 를 spec 에 복원 — 또는 — (B) 프론트엔드 코드·MDX 사용자 가이드를 spec 변경에 맞춰 동시 갱신 후 착수 |
| 2 | Cross-Spec | `GET /api/integrations/:id` 응답에서 `appUrl` 필드 제거 — 프론트엔드 테스트·관련 spec 과 직접 충돌 | `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` | `frontend/.../integrations/[id]/__tests__/scope-tab.test.tsx` (mock `appUrl` 3개소), `spec/1-data-model.md` §2.10, `spec/4-nodes/4-integration/4-cafe24.md` §9 | (A) `appUrl` 필드와 Overview 탭 App URL 카드를 spec 에 복원 — 또는 — (B) 프론트엔드 테스트와 Cafe24 노드 spec 에러 복구 안내도 함께 갱신. Cafe24 Private 운영 흐름에서 App URL 접근 필요 여부 재검토 필수 |
| 3 | Plan Coherence | `cafe24-hmac-raw-fix-b8e2d1` worktree(PR 대기 중, commit `30be2f94`)가 동일 파일 Rationale 말미를 이미 수정 — 병합 충돌 확정 | `spec/2-navigation/4-integration.md` `## Rationale` 섹션 말미 (신규 항목 2개 추가 예정) | `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` (worktree `cafe24-hmac-raw-fix-b8e2d1`, branch `claude/cafe24-hmac-raw-fix-b8e2d1`, 미병합) | `cafe24-hmac-raw-fix-b8e2d1` PR 을 main 에 먼저 병합한 뒤 현재 worktree 를 `git rebase main`으로 갱신하고 Rationale 추가 진행. 병렬 merge 가 불가피하면 `merge-coordinator` 경유 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 배너 `expiring` 포함 조건 단순화 — `expired` 상태 행이 이중 카운트될 수 있음 | §2.4 배너 조건 `token_expires_at <= now() + 7d` 및 §11.4 UI 배지 조건 | `spec/5-system/4-execution-engine.md` (상태 전이 `connected → expired` 정의) | 배너 조건에 `status NOT IN (expired, error, pending_install)` 가드 추가. §11.4 동시 갱신 |
| 2 | Cross-Spec | `expiring` 가상 필터값 변환 규칙 삭제 — `Expiring` 칩은 남아 있으나 백엔드 WHERE 절 변환 규칙 없음 | §9.1 `GET /api/integrations` status 파라미터 | §2.3 상태 칩 `Expiring (7일 이내)` | §9.1 에 `status='connected' AND token_expires_at within 7d` 변환 규칙 복원 또는 §2.3 칩 목록에 가상값임을 명시 |
| 3 | Convention Compliance | API error code `UPPER_SNAKE_CASE` 와 DB `status_reason` `snake_case` 이중 표기 — 의도적이나 구현자 혼동 여지 | §9.4 에러 코드 표, §6 상태 전이 표 | `spec/conventions/swagger.md` | §9.4 상단에 "API error code는 `UPPER_SNAKE_CASE`, DB `status_reason` 값은 `snake_case` — 의도적 구분 (Rationale 참조)" 주석 추가 |
| 4 | Plan Coherence | `spec-update-cafe24-app-url-reuse.md` 미완 §9 갱신이 target 의 §9.2 수정 범위와 겹침 | §9.2 (begin 표 수정) | `plan/in-progress/spec-update-cafe24-app-url-reuse.md` 미체크 `[ ] spec 갱신` | 해당 plan 에 "§9 갱신 시 `cafe24-mall-dup-ux-a7f2c8` PR 병합 결과 기반으로 시작" 메모 추가 |
| 5 | Plan Coherence | `spec-update-cafe24-background-refresh.md` 미완 §11 갱신이 같은 파일 대기 중 | §11 (스캐너 잡 목록 + 신규 소절) | `plan/in-progress/spec-update-cafe24-background-refresh.md` 미체크 항목 | `spec-update-cafe24-background-refresh.md` 에 "§9/Rationale 변경은 `cafe24-mall-dup-ux-a7f2c8` PR 병합 이후 기준으로 작업 시작" 메모 추가 |
| 6 | Plan Coherence | `cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 체크박스 미갱신 | `plan/in-progress/cafe24-mall-dup-ux.md` 진행 상태 섹션 | 개발자 skill 규약 — 구현 착수 직전 `--impl-prep` 호출 의무 | 본 consistency-check 완료 후 해당 체크박스를 `[x]`로 갱신 |
| 7 | Naming Collision | `GET /api/integrations/cafe24/precheck` — 기존 `@Get(':id')` / `@Get(':id/usages')` / `@Get(':id/activity')` 와 NestJS 라우트 우선순위 충돌 위험 | `spec-update-cafe24-public-dup-guard.md` §9.2 신규 행 | `backend/.../integrations.controller.ts:209` `@Get(':id')` (`ParseUUIDPipe`) | `@Get('cafe24/precheck')` 핸들러를 동적 경로 핸들러보다 앞에 선언(현재 `@Get('services')` 바로 아래). `ParseUUIDPipe` 미적용 |
| 8 | Naming Collision | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 Public 흐름에 재사용 — `PRIVATE` 이름이 의미를 오도 | `cafe24-mall-dup-ux.md` §Backend (1), `spec-update-cafe24-public-dup-guard.md` §9.2 | `backend/.../integration-oauth.service.ts:1068` (Private 전용), `backend/.../integrations.controller.ts:170` (Swagger "private" 맥락) | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` 로 rename. backend, spec, Swagger doc, 프론트엔드 메시지 키 일괄 변경 |
| 9 | Rationale Continuity | §11 본문 "expire 처리" 표현이 폐기된 `expired(refresh_failed)` 흐름을 연상시킴 | §11 서두 2번째 문단 | Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)" | 해당 문구를 "갱신 실패한 토큰 셋은 `error(auth_failed)` 로 전이되어 사용자에게 reauthorize 권장"으로 정정 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/5-integration.md` — 삭제된 `GET /api/integrations/:id` `appUrl` 흐름 기술 여부 점검 | `spec/data-flow/5-integration.md` line 78-79 | `POST /api/integrations/oauth/begin` → `appUrl` 흐름은 유지. `GET` 경로 관련 기술 부분만 존재 시 갱신 |
| 2 | Cross-Spec | `spec/4-nodes/4-integration/4-cafe24.md` 에러 복구 안내가 삭제된 App URL 카드를 가리킴 | `spec/4-nodes/4-integration/4-cafe24.md` Rationale "Cafe24 install_token mismatch 회복 흐름" | App URL 카드 삭제 확정 시 대체 접근 경로로 안내 문구 갱신 |
| 3 | Rationale Continuity | Rationale "OAuthState.mode='reauthorize'" 의 "향후 분리 검토" 언급이 이미 처리된 `request_scopes` 분리와 불일치 | Rationale (2026-05-14 항) | 해당 항에 "(2026-05-15 후속) `request_scopes` mode 분리는 'Cafe24 Private request-scopes 흐름' 항 참조 — 분리 방향으로 처리됨" 한 줄 추가 |
| 4 | Convention Compliance | `## Rationale` 하위 소섹션 앵커 참조 혼용 (`#rationale` vs 실제 소섹션 앵커) | 문서 전체 인라인 참조 | 참조 앵커를 실제 소섹션 헤딩과 일치시켜 마크다운 렌더러 깨짐 방지 |
| 5 | Convention Compliance | `## Overview` 섹션 없이 `## 1. 라우트 구성`으로 시작 (`_product-overview.md` 가 Overview 역할 수행 중) | 문서 최상단 | `## 1. 라우트 구성` 상단에 1~3문장 목적 설명 추가 가능. 규약 갱신 불필요 |
| 6 | Convention Compliance | §9.3 activity 응답 예시에 `data:` 래퍼 명시 누락 | §9.3 응답 예시 | `{ data: { items[], summary: { ... } } }` 형태로 명시하거나 §9.4 에 "이하 모든 응답이 `data:` 래퍼를 가짐" 문구 추가 |
| 7 | Convention Compliance | orchestrator 가 target 파일 내용을 `(없음)`으로 수집 — checker 들이 직접 파일을 Read 해 보완, 이번 검토 신뢰도 영향 없음 | orchestrator 파일 수집 단계 | orchestrator 의 파일 수집 로직에서 `(없음)` 반환 시 에러를 올리도록 보완. checker 의 직접 Read fallback 정책 명문화 권장 |
| 8 | Plan Coherence | `cafe24-mall-dup-ux.md` 의 `[ ] Spec 위임 (project-planner)` 항목이 미체크인 채로 위임 plan 문서만 작성된 상태 | `plan/in-progress/cafe24-mall-dup-ux.md` | spec 위임 plan 작성 완료를 `[x]`로 표기하고, project-planner 처리 완료 시점에 양쪽 plan 동시 갱신 |
| 9 | Naming Collision | `findExistingConnectedCafe24Mall` helper 이름이 `connected` 상태만 조회한다는 범위를 내포하나 precheck 는 모든 status 대상 | `cafe24-mall-dup-ux.md` §Backend (1) | `findConnectedCafe24MallIntegration`으로 범위 명확화. precheck 용 전체 status 조회는 별도 로직 또는 `findAnyCafe24MallIntegration`으로 분리 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | `Attention` 칩·`appUrl` 필드 삭제가 프론트엔드 코드·테스트와 직접 충돌 (CRITICAL 2건). `expiring` 필터 변환 규칙 누락, 배너 조건 이중 카운트 위험 (WARNING 2건) |
| Plan Coherence | HIGH | `cafe24-hmac-raw-fix-b8e2d1` worktree 가 Rationale 말미를 이미 commit 해 병합 충돌 확정 (CRITICAL 1건). 소멸 worktree 의 §9·§11 미완 갱신 순서 관리 필요 (WARNING 2건) |
| Naming Collision | MEDIUM | `GET /api/integrations/cafe24/precheck` NestJS 라우트 선언 순서 충돌 위험, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Public 재사용 시 이름 오도 (WARNING 2건) |
| Rationale Continuity | LOW | §11 "expire 처리" 표현이 폐기된 `expired(refresh_failed)` 흐름을 연상시킴 (WARNING 1건) |
| Convention Compliance | LOW | 문서 자체 규약 준수 양호. orchestrator 파일 수집 오류(인프라 버그)를 checker 직접 Read 로 보완함. 이번 검토 신뢰도 영향 없음 |

---

## 권장 조치사항

1. **[BLOCK 해소 — 우선]** `Attention` 칩·`?status=attention` 가상 필터값·삭제된 Rationale 복원(A) 또는 `frontend/.../integrations/page.tsx`, `status-badge.tsx`, 사용자 가이드 MDX 2종 동시 갱신(B) 중 하나를 선택하고 해소한다.
2. **[BLOCK 해소 — 우선]** `appUrl` 필드·Overview 탭 App URL 카드 복원(A) 또는 `scope-tab.test.tsx` mock 제거·`spec/4-nodes/4-integration/4-cafe24.md` 에러 복구 안내 갱신(B) 중 하나를 선택한다. Cafe24 Private 운영 흐름에서 App URL 접근성 필요 여부를 product owner 와 재검토 권장.
3. **[BLOCK 해소 — 우선]** `cafe24-hmac-raw-fix-b8e2d1` PR 을 먼저 main 에 병합한 뒤 현재 worktree 를 `git rebase main`으로 갱신하고 Rationale 추가를 진행한다.
4. **[WARNING — 구현 착수 전]** §9.1 에 `expiring` 가상 필터값 변환 규칙(`status='connected' AND token_expires_at within 7d`)을 복원하고, §2.4 배너 조건과 §11.4 UI 배지 조건에 `status NOT IN (expired, error, pending_install)` 가드를 추가한다.
5. **[WARNING — 구현 착수 전]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` rename 결정. backend, spec, Swagger doc, 프론트엔드 메시지 키 일괄 변경.
6. **[WARNING — 구현 시 필수]** `@Get('cafe24/precheck')` 핸들러를 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 보다 앞에 선언한다.
7. **[WARNING — 규약]** 본 consistency-check 완료 후 `plan/in-progress/cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 체크박스를 `[x]`로 갱신한다.
8. **[WARNING — 문서 정합]** `spec/2-navigation/4-integration.md` §11 서두 "expire 처리" 문구를 `error(auth_failed)` 전이로 정정한다.
9. **[INFO — 권장]** orchestrator 파일 수집 로직 보완(`(없음)` 반환 시 에러 처리).
10. **[INFO — 권장]** `spec/data-flow/5-integration.md` 에서 `GET /api/integrations/:id` → `appUrl` 흐름 기술 여부 확인 및 필요 시 갱신.

---

## 본 worktree 에서의 처리 결정 (developer 판단)

- **Critical 1·2 (Attention 칩, appUrl 필드)**: 본 작업 범위(§9.2 begin + §9.4 errors + Rationale 신설) 밖. spec 의 기존 불일치로 별도 worktree 가 처리해야 함. 본 PR 에 끌어들이지 않음.
- **Critical 3 (Rationale 말미 충돌)**: 본 worktree 는 spec 본문을 직접 수정하지 않고 project-planner 위임 plan note 만 작성. 위임 단계에서 `cafe24-hmac-raw-fix-b8e2d1` 의 PR merge 결과를 기준으로 rebase 처리. 코드(backend/frontend) 구현 자체에는 영향 없음.
- **Warning 8 (error code rename)**: 사용자 지시 ("호환성 유지, 메시지 문구만 일반화") 에 따라 기각.
- **Warning 6·7·9 / INFO 9**: 본 PR 에서 반영.
- 기타 Warning (배너 조건, errors 표기 컨벤션, §11 expire 표현, §9.1 expiring 변환 규칙): `spec-update-cafe24-public-dup-guard.md` 의 위임 항목에 추가.
