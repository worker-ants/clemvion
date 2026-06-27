# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (scope: `spec/2-navigation/6-config.md`)
검토 일시: 2026-06-27

---

## 발견사항

### **[WARNING]** `6-config.md §3` Model Config API — `:id/test`·`:id/models` 엔드포인트 역할 규칙 미명시

- **target 위치**: `spec/2-navigation/6-config.md` §3 "Model Config API" 표 — `POST /api/model-configs/:id/test` 행, `GET /api/model-configs/:id/models` 행
- **관련 plan**: `plan/in-progress/refactor/02-architecture.md` §C-2 [Critical] 클러스터 4 (llm ↔ model-config) "잔여" 절 (cluster 4 완료 주석 내 `**별도 authz follow-up**` 항목)
- **상세**: C-2 cluster 4 plan 은 llm↔model-config forwardRef 해소 후 남은 후속으로 "**planner 가 `6-config.md §3` 에 action-POST(`:id/test`)·GET(`:id/models`) 역할 규칙 명시 → developer 가 `@Roles` 반영. 인가 behavior change 라 product sign-off 동반 별 PR**"을 명시한다. 현재 target 문서의 §3 Model Config API 절은 섹션 헤더에 일반 규칙("mutation POST/PATCH/DELETE 은 Editor+, 조회는 Viewer 이상")만 있고, `:id/test`(POST)·`:id/models`(GET) 행에 개별 역할 주석이 없다. 현재 코드에서 `testConnection`(`LlmModelConfigController`) 에는 `@Roles` 데코레이터가 없어 모든 역할이 호출 가능한 상태(현 동작)이며, `@Roles('editor')` 추가는 behavior change 이므로 product sign-off 동반 명시가 spec 에 먼저 필요하다. plan 이 planner 선행 업무로 명시한 spec 갱신이 target 에 반영되지 않은 채 impl-prep 이 진행되고 있다.
- **제안**: `spec/2-navigation/6-config.md §3` "Model Config API" 표의 `POST /api/model-configs/:id/test` 행에 `**(Editor+)**` 표기와 product 결정 근거 각주를, `GET /api/model-configs/:id/models` 행에 `**(Viewer+)**` 표기를 추가한다. `testConnection` 이 과금 수반 POST 라 `previewModels` 동형 Editor+ 부여가 타당하다는 Rationale 도 §3 또는 별도 `R-` 절에 기록한다. spec 갱신 후 developer 가 `@Roles` 반영·별도 PR 착수한다 (C-2 plan 의 "인가 behavior change → product sign-off 동반 별 PR" 조건 충족 경로). plan `refactor/02-architecture.md` C-2 cluster 4 "잔여 ②" 항의 planner 액션 박스를 완료 처리하는 것도 병행한다.

---

### **[INFO]** `spec-sync-auth-gaps.md` — 완료된 plan 을 in-progress 로 참조하는 dead link

- **target 위치**: 해당 없음 (target 문서인 `6-config.md` 내부가 아닌 다른 plan 내 참조)
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` 18번째 줄 — "본 spec 의 다른 미구현 갭(auth_config CRUD audit 기록 등)은 `plan/in-progress/auth-config-webhook-followups.md` 가 추적."
- **상세**: `plan/in-progress/auth-config-webhook-followups.md` 는 이미 `plan/complete/auth-config-webhook-followups.md` 로 이동 완료됐다. 현재 링크는 존재하지 않는 경로를 가리킨다.
- **제안**: `plan/in-progress/spec-sync-auth-gaps.md` 의 해당 줄을 `plan/complete/auth-config-webhook-followups.md` 로 갱신한다.

---

## 요약

`spec/2-navigation/6-config.md` 자체 내용은 C-2 cluster 4 spec-sync(frontmatter `code:` 에 `llm-model-config.controller.ts` 등재, 데이터흐름 서술 현행화 등)가 이미 반영돼 있어 주된 refactor 구현과는 정합한다. 단 `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 가 "planner 선행 업무"로 명시한 **`POST :id/test`·`GET :id/models` 개별 역할 규칙 명시**가 target 문서 §3 에 아직 없다. 이 업데이트는 behavior change(`@Roles` 추가)의 product sign-off 근거가 되므로, impl-prep 단계에서 spec 이 해당 결정을 문서화하지 않으면 developer 가 `@Roles` 구현 시 spec 근거 없이 일방 결정하게 된다. 별건 plan 의 dead link 는 추적 메모 수준이다.

## 위험도

LOW

---

STATUS: OK
