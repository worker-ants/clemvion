# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — 보안 설계를 역전시키는 CORS invariant 충돌(CRITICAL) 1건 + spec 공식 계약 누락(CRITICAL) 1건 포함, 다수 WARNING.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | "빈 배열 허용 = 제한 없음" 의미론이 기존 CORS secure-by-default invariant 역전 — 빈 배열 저장 시 모든 외부 origin 이 허용됨 | `## 변경 내용 > data-flow/12-workspace.md §1.x` 검증 항목 | `spec/5-system/14-external-interaction-api.md §8.5` ("미설정 시 차단"), `spec/7-channel-web-chat/4-security.md §2` Rationale R1, `codebase/backend/src/common/cors/web-chat-cors.ts isExternalOriginAllowed()` | (a) 검증 표현을 "빈 배열 = null 과 동등, 추가 origin 없음"으로 수정해 기존 invariant 유지, 또는 (b) 의도적 정책 변경이면 EIA §8.5·4-security Rationale R1 을 동시에 번복하는 새 Rationale 을 target 에 추가하고 CORS 구현체도 함께 변경 |
| 2 | Cross-Spec | 신규 `PATCH /:id/settings` 분리 근거로 쓰인 "기존 `PATCH /:id` name 필수" 계약이 어떤 spec 에도 공식 기록되지 않아 두 엔드포인트 경계가 code 레벨에만 존재 | `## 결정` — "기존 `PATCH /:id`(name 필수)와 분리" | `spec/2-navigation/9-user-profile.md §6.1` (엔드포인트 body 스키마 미기술), `codebase/backend/src/modules/workspaces/dto/update-workspace.dto.ts` | `spec/2-navigation/9-user-profile.md §6.1` 또는 `data-flow/12-workspace.md §1.x` 에 `PATCH /api/workspaces/:id` 의 body 스키마(`{ name: string }`, `@IsNotEmpty`, min 2/max 100)와 rename 전용 성격을 공식 기록 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 시퀀스 다이어그램 응답이 `{ workspace }` 로 표기되어 전역 `{ data: ... }` 래핑 규약 위반 | `sequenceDiagram Svc-->>C: 200 { workspace }` | `spec/conventions/swagger.md §2-5`, `spec/5-system/2-api-convention.md §5.1` (TransformInterceptor) | `200 { data: workspace }` 로 정정 |
| 2 | Convention Compliance | `ADMIN_REQUIRED` 에러 코드가 공식 에러 카탈로그에 미등재된 채 spec draft 에 사용 | `sequenceDiagram Svc-->>C: 403 ADMIN_REQUIRED` | `spec/5-system/3-error-handling.md §1.2` (`FORBIDDEN` 만 등재) | (a) `3-error-handling.md §1.2` 에 `ADMIN_REQUIRED` 행 추가를 영향 spec 항목으로 명시, 또는 (b) `403 FORBIDDEN` 으로 표기 — 어느 방향이든 draft 에서 명시적 선택 필요 |
| 3 | Convention Compliance | spec 갱신 항목이 "영향 spec" 목록 한 줄로만 열거되고 정식 Phase 로 분리되지 않음 | `## 영향 spec` 섹션 전체 | CLAUDE.md memory `feedback_plan_must_include_spec_updates`, `plan-lifecycle.md §2` | `## Phase N: Spec 갱신` 섹션 신설 후 4개 spec 파일별 대상 §·before/after·체크박스 나열 |
| 4 | Cross-Spec | `embed-config 캐시 max-age=300` 근거 인용이 `7-channel-web-chat/4-security §3` 과 맞지 않음 — 해당 §3 에는 max-age=300 없고, CORS resolver 는 60s TTL | `"최대 5분([7-channel-web-chat/4-security §3])"` | `spec/7-channel-web-chat/4-security.md §2` (60s TTL 캐시), `spec/5-system/14-external-interaction-api.md §8.5` | 실제 캐시 위치(CORS resolver 60s TTL 또는 별도 embed-config 캐시)와 그 spec 경로를 정확히 명시; `4-security §3` 은 인용 대상이 아닌 영향 대상으로 재표기 |
| 5 | Cross-Spec | `/workspace/settings` 탭 구조가 기존 3탭 정의와의 관계 미결정 — "섹션/탭 신설"이라는 모호한 표현 | UI — "임베드 허용 도메인" 섹션 신설 | `spec/2-navigation/9-user-profile.md §4` (개요/멤버/위험영역 3탭) | 신규 탭("보안" 등) vs 기존 탭 내 섹션 중 하나로 결정하고 `9-user-profile.md §4` 탭 구조에 동기화 |
| 6 | Cross-Spec | `useHasRole("admin")` 이 owner 를 포함하는지 불명확 — RBAC 매트릭스 상 owner+admin 모두 U 권한 | UI — `useHasRole("admin")` 가드 | `spec/5-system/1-auth.md §3.2` (owner=CRUD, admin=RU), `spec/2-navigation/9-user-profile.md §4.2` | target 에서 "admin 이상 포함" 임을 명시하거나 `useHasRole(["owner", "admin"])` 처럼 명시적으로 기술; 또는 spec/conventions 에 hook semantics 정의 후 참조 |
| 7 | Rationale Continuity | 신설 `PATCH /:id/settings` 가 `spec/2-navigation/9-user-profile.md §6.1` API 표에 미등재 | `## 결정` — 전용 엔드포인트 신설 | `spec/2-navigation/9-user-profile.md §6.1` | target 의 영향 spec 목록에 `9-user-profile.md §6.1 API 표` 신규 행 추가 포함 |
| 8 | Cross-Spec | RBAC 표기 기호 불일치 — `1-auth §3.2` 는 RU, `data-flow/12-workspace §3.2` 는 ✓, `9-user-profile §4.2` 는 ✅/❌ | `## 영향 spec` — "RBAC 매트릭스 이미 충족" 처리 | `spec/5-system/1-auth.md §3.2`, `spec/data-flow/12-workspace.md §3.2`, `spec/2-navigation/9-user-profile.md §4.2` | Admin 구체 권한(R+U, 생성/삭제 불가) 이 드러나도록 세 문서 표기 정비; 신설 `PATCH /:id/settings` 에 cross-ref 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | EIA §8.5 와 web-chat 4-security §2·§3 의 "사용자가 명시 설정 필요" 문구에 신설 경로 cross-ref 부재 | `spec/5-system/14-external-interaction-api.md §8.5`, `spec/7-channel-web-chat/4-security.md §2·§3` | 영향 spec 목록에 해당 문구에 `(main)/workspace/settings` + `PATCH /:id/settings` cross-ref 추가 항목 명시 |
| 2 | Cross-Spec | `1-data-model.md §2.2 interactionAllowedOrigins` 에 편집 경로 cross-ref 추가 예정이나 구체 문구 미결정 | `## 영향 spec — spec/1-data-model.md §2.2` | 추가할 cross-ref 문구 예시: "편집 경로: `PATCH /api/workspaces/:id/settings` — [data-flow/12-workspace §1.x]" |
| 3 | Cross-Spec | `data-flow/12-workspace.md §1.x` 플레이스홀더 — 실제 섹션 번호 미결정 (현재 §1.1~§1.6 사용 중) | `## 변경 내용 — data-flow/12-workspace.md §1.x` | 최종 확정 시 §1.7 또는 §2 신설 등 실제 번호 부여 |
| 4 | Convention Compliance | Plan frontmatter `worktree: workspace-allowed-origins-settings` 가 실존하지 않는 worktree 지칭 | frontmatter `worktree` 필드 | `ensure-worktree.sh workspace-allowed-origins-settings` 로 생성 후 plan 이동, 또는 실제 worktree 이름으로 수정 |
| 5 | Convention Compliance | `../../spec/` 상대경로가 worktree 환경에서 의도한 spec 루트를 가리키는지 확인 필요 | `## 영향 spec` 링크들 | worktree 이동 후 링크 해석 경로 검증 |
| 6 | Naming Collision | `ADMIN_REQUIRED` 에러 코드가 기존 `WorkspacesService.assertAdmin()` 에서 이미 발행 중이므로 신규 충돌 없음 — 단 카탈로그 미등재 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:525` | `spec/5-system/3-error-handling.md` 카탈로그에 `ADMIN_REQUIRED` 정식 등재를 후속 plan 에 추가 |
| 7 | Naming Collision | `PATCH /api/workspaces/:id/settings` 경로 충돌 없음 — 기존 `PATCH /:id` 와 구조적으로 분리 | `spec/2-navigation/9-user-profile.md §6.1`, `spec/data-flow/12-workspace.md §1` | `9-user-profile.md §6.1 API 표` 에 신규 엔드포인트 행 추가 |
| 8 | Naming Collision | `useHasRole("admin")` 은 기존 `workspace/settings/page.tsx:179,277` 패턴과 일치 — 신규 발명 아님 | `codebase/frontend/src/app/(main)/workspace/settings/page.tsx:179,277` | hook 이 "admin 이상" semantics 임을 spec 에 명시하는 것으로 충분 |
| 9 | Naming Collision | `notification_url_allow_pattern` 이 `spec/5-system/14-external-interaction-api.md` 에 언급되나 `1-data-model.md §2.2` "알려진 키" 목록 밖에 존재 | `spec/1-data-model.md §2.2` | cross-ref 강화 시점에 해당 키의 정식 등재 여부 함께 확인 |
| 10 | Plan Coherence | `spec-sync-data-flow-12-workspace-gaps.md` worktree(`spec-sync-audit`, PR #440 MERGED) stale — 경합 위험 없음 | plan/in-progress | `cleanup-worktree-all.sh --yes --force` 실행 권장 (7개 stale worktree) |
| 11 | Plan Coherence | `spec/1-data-model.md` 를 `node-cancellation-engine-6bfcaa` 도 수정 중 (§4.x NodeExecution — 비겹침) | `spec/1-data-model.md §2.2` vs `§4.x` | 병합 순서 직렬화 불필요; 후착 PR 에서 rebase 확인 권장 |
| 12 | Plan Coherence | `channel-web-chat-followups.md §3` (embed-config GET 구현 완료)과 target 의 PATCH 설정 API 는 상호 보완적 — 4-security §2·§3 수정 시 "설정 경로" 문구 일관성 유지 필요 | `spec/7-channel-web-chat/4-security.md §2.1, §3` | target spec 변경에서 §3 soft 검증 완료 설명과 일관된 "설정 경로" 링크 업데이트 명시 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Rationale Continuity | **HIGH** | "빈 배열 = 제한 없음" CORS invariant 역전 (CRITICAL), 신설 엔드포인트 API 표 미등재 (WARNING) |
| Cross-Spec | **MEDIUM** | 기존 `PATCH /:id` 계약 spec 미기록 (CRITICAL), 캐시 TTL 미스레퍼런스, 탭 구조 미결정, `useHasRole` 포함 범위 불명확, RBAC 기호 불일치 |
| Convention Compliance | **MEDIUM** | 응답 래핑 규약 위반 (`{ workspace }` → `{ data: workspace }`), 에러 코드 카탈로그 미등재, spec 갱신 Phase 누락 |
| Plan Coherence | **LOW** | 경합 위험 없음, stale worktree 7건 정리 권장, rebase 확인 1건 |
| Naming Collision | **LOW** | 식별자 의미 충돌 없음, 카탈로그·API 표 미등재 등 후속 보완 사항만 존재 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 최우선)** `interactionAllowedOrigins` 빈 배열 의미론 수정: "빈 배열 = null 과 동등(추가 origin 없음)"으로 target 검증 항목 변경. 만약 "빈 배열 = 제한 없음"이 의도라면 EIA §8.5, 4-security Rationale R1 을 함께 번복하는 신규 Rationale 추가 및 `isExternalOriginAllowed()` CORS 구현 변경 필요.
2. **(BLOCK 해소)** `spec/2-navigation/9-user-profile.md §6.1` 또는 `data-flow/12-workspace.md §1.x` 에 `PATCH /api/workspaces/:id` 의 body 스키마(`{ name: string }`, `@IsNotEmpty()`, rename 전용 의미)를 공식 기록하여 두 엔드포인트의 경계를 spec 레벨로 명확화.
3. **(WARNING 해소)** 시퀀스 다이어그램 응답 표기를 `200 { data: workspace }` 로 수정.
4. **(WARNING 해소)** `ADMIN_REQUIRED` 에러 코드를 `3-error-handling.md §1.2` 에 등재하거나 `403 FORBIDDEN` 으로 통일하는 방향을 target 에서 명시적으로 선택.
5. **(WARNING 해소)** `## Phase N: Spec 갱신` 섹션 신설 — 영향 4개 spec 파일별 대상 §·before/after·체크박스 형식으로 분리.
6. **(WARNING 해소)** `embed-config 반영 지연` 서술에서 `4-security §3` 인용을 삭제하고 실제 캐시 근거(CORS resolver 60s TTL 또는 별도 embed-config 캐시)의 spec 경로로 대체.
7. **(WARNING 해소)** `/workspace/settings` UI 배치를 확정(신규 탭 vs 기존 탭 내 섹션)하고 `9-user-profile.md §4` 탭 구조에 반영.
8. **(WARNING 해소)** `useHasRole("admin")` 이 "admin 이상(owner 포함)" 의미임을 target spec 에 명시하거나 `useHasRole(["owner", "admin"])` 으로 기술.
9. **(INFO)** plan frontmatter `worktree` 를 실존하는 worktree 이름으로 수정.
10. **(INFO)** stale worktree 7건(`spec-sync-audit`, `spec-drift-resolve-efb608`, `code-node-sandbox-979a97`, `conventions-code-data-9b32d5`, `fix-presentation-tool-default-dcecc3`, `plan-grooming-2ec306`, `system-status-recent-failed-86831b`) cleanup 실행.