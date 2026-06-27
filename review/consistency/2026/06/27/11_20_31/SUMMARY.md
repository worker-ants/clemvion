# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능 (WARNING 1건 선결 권장)

---

## 전체 위험도

**LOW** — Critical 0건, WARNING 1건(Plan Coherence), INFO 9건. 차단 사유 없으나 authz 역할 규칙 spec 선기록 후 구현 착수 권장.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | `POST :id/test`·`GET :id/models` 개별 역할 규칙이 spec §3 에 미기재 — plan 이 "planner 선행 업무"로 명시한 spec 갱신이 누락된 채 impl-prep 진행 중 | `spec/2-navigation/6-config.md §3` Model Config API 표 | `plan/in-progress/refactor/02-architecture.md` §C-2 cluster 4 "잔여 ② authz follow-up" | spec §3 표의 `POST :id/test` 행에 `(Editor+)` 표기·Rationale 추가, `GET :id/models` 행에 `(Viewer+)` 표기 추가. 이후 developer 가 `@Roles` 반영·별도 PR 착수 (behavior change → product sign-off 조건) |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | NAV-CL-06 PRD 항목이 rerank 연결 테스트 미제공 제한을 반영하지 않아 "완전 구현"으로 오독 가능 | `spec/2-navigation/_product-overview.md §3.7` | NAV-CL-06 설명을 "chat·embedding 연결 테스트 기능 (rerank 미제공)"으로 구체화 |
| I-2 | Cross-Spec | LLM Client spec 이 `POST :id/test` 권한을 개별 명시 없이 포괄 규칙에 위임 | `spec/5-system/7-llm-client.md §8.3 testConnection` | "권한: editor 이상" 한 줄 추가 (`preview-models` 와 대칭) |
| I-3 | Rationale Continuity | R-3 번복(ModelConfig 단일화) 및 bearer_token 자동 발급 강제 결정이 쌍방 교차 참조로 정합 확인됨 | `spec/2-navigation/6-config.md §Rationale R-3·R-2` | 없음 (확인용 메모) |
| I-4 | Convention Compliance | `id: config` 가 basename 권장 표기(`6-config`)와 불일치 (의무 아님, 가드 통과) | `spec/2-navigation/6-config.md` frontmatter | `id: 6-config`로 변경하거나 Rationale에 안정 식별자 근거 명시 |
| I-5 | Convention Compliance | `PATCH /api/model-configs/:id/set-default` — cascade 부수효과 동반 액션에 api-convention §3 "액션=POST" 원칙 미적용 | `spec/2-navigation/6-config.md §3` API 표 | POST로 변경하거나, 현 PATCH 유지 시 Rationale에 멱등성 근거 명시 |
| I-6 | Convention Compliance | `## 3. API` 섹션 heading에 구 번호 체계 잔재 | `spec/2-navigation/6-config.md` | `## API`로 번호 접두사 제거 |
| I-7 | Plan Coherence | `plan/in-progress/spec-sync-auth-gaps.md` 내 `auth-config-webhook-followups.md` 링크가 `in-progress/` → `complete/` 이동 후 dead link | `plan/in-progress/spec-sync-auth-gaps.md` 18번째 줄 | `plan/complete/auth-config-webhook-followups.md`로 링크 갱신 |
| I-8 | Naming Collision | `api_key`/`bearer_token` 문자열이 AuthConfig(인바운드)·Integration(아웃바운드) 두 도메인에 동시 사용 — 기존 spec §2.17.3 이 인지하고 TypeScript 타입 분리로 처방 | `spec/2-navigation/6-config.md §A.2`, `spec/2-navigation/4-integration.md` | `AuthConfigType` / `IntegrationAuthType` 타입 경계를 DTO 레이어에서 유지 |
| I-9 | Naming Collision | `MODEL_CONFIG_INVALID` 소스 주석이 C-2 cluster 4 이후 `llm-model-config.controller.ts` 미반영 | `spec/5-system/3-error-handling.md` L48 | 소스 주석에 `llm-model-config.controller.ts` 추가 (별건 planner 작업) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | CRITICAL·WARNING 없음. INFO 2건 (PRD 설명 세분화 누락, LLM Client spec 권한 개별 명시 누락). 교차 참조 14개 항목 일치 확인 |
| Rationale Continuity | NONE | 번복 결정(R-3·R-5) 모두 신규 Rationale 동반, 기각 대안 재도입 없음. 쌍방 교차 참조 정합 |
| Convention Compliance | LOW | CRITICAL·WARNING 없음. INFO 3건 (id basename 불일치, PATCH vs POST 액션 패턴, heading 번호 잔재). 의무 규약 위반 없음 |
| Plan Coherence | LOW | WARNING 1건 — plan 명시 planner 선행 업무(`@Roles` spec 갱신) 미완료. INFO 1건 (dead link) |
| Naming Collision | LOW | CRITICAL·WARNING 없음. INFO 2건 (두 도메인 동일 문자열·에러코드 소스 주석 drift). 실질적 식별자 충돌 없음 |

---

## 권장 조치사항

1. **(WARNING 선결 — impl-prep 차단 아님, 착수 전 완료 권장)** `spec/2-navigation/6-config.md §3` Model Config API 표에 `POST /api/model-configs/:id/test` 행에 `(Editor+)`, `GET /api/model-configs/:id/models` 행에 `(Viewer+)` 역할 표기 추가 + Rationale 기록. 이후 developer 가 `@Roles` 반영하여 별도 PR.
2. **(INFO — low priority)** `plan/in-progress/spec-sync-auth-gaps.md` dead link 수정 (`plan/complete/auth-config-webhook-followups.md`).
3. **(INFO — 추후)** `spec/5-system/3-error-handling.md` L48 소스 주석에 `llm-model-config.controller.ts` 추가.
4. **(INFO — 추후)** `spec/2-navigation/_product-overview.md §3.7` NAV-CL-06 설명 구체화 (rerank 미제공 명시).
5. **(INFO — 선택)** `spec/2-navigation/6-config.md` frontmatter `id` basename 정렬, `## API` heading 번호 제거, `set-default` PATCH Rationale 보완.
