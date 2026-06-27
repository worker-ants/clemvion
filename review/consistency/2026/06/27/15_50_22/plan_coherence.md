# Plan 정합성 검토 결과

> 검토 모드: `--impl-done` | scope: `spec/2-navigation/6-config.md` | diff-base: `origin/main`
> 검토 일시: 2026-06-27

---

## 발견사항

- **[INFO]** `GET :id/models` `type` 쿼리 파라미터 400 응답 — spec §3 API 표 미반영
  - target 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `@ApiBadRequestResponse` 데코레이터 추가 + `ParseEnumPipe` 적용 (listModels 핸들러)
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 — "코드 fix W5·W7·W9·W10·I16 + swagger W3·W4" 로 기록된 ai-review fix 항목
  - 상세: `GET /api/model-configs/:id/models` 에 `ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true })` 가 추가돼 `type=bogus` 같은 허용값 외 값 전달 시 400을 반환하도록 런타임 검증이 강화됐다. `spec/2-navigation/6-config.md §3` API 표 line 283은 `:id/models`를 "사용 가능한 모델 목록 조회 (chat/embedding)"으로 기술하지만 `type` 쿼리 파라미터의 허용값과 400 응답은 명시하지 않는다. Swagger 레이어(`@ApiQuery enum: ['chat','embedding']` + `@ApiBadRequestResponse`)에는 문서화됐다. 이미 암묵적으로 존재하던 제약을 런타임 강제로 표면화한 것이어서 spec 결정을 새로 내린 것이 아니라 기존 "(chat/embedding)" 서술의 논리적 귀결이다.
  - 제안: spec §3 `:id/models` 행에 `type=chat|embedding` (optional, 허용값 외 400) 을 명기하거나, Swagger 레이어 문서화로 충분하다고 판단하는 경우 plan에 planner-defer 메모를 남기는 것으로 충분하다. plan 정합에 실질 위협은 없어 차단 불필요.

---

## 요약

C-2 cluster 4(`llm↔model-config` forwardRef 순환 해소)는 `plan/in-progress/refactor/02-architecture.md` 에서 완료로 기록돼 있고, 구현·e2e·리뷰·spec-sync(`6-config.md` frontmatter `code:` 등재, `data-flow/7-llm-usage.md`, `5-system/7-llm-client.md §8`)·authz follow-up(PR #716, `6-config.md` §3 표 Editor+/Viewer+ 명문화 + R-7 Rationale 신설)이 전부 완료됐다. target 변경(`PROVIDER_PROBE_THROTTLE` 상수 DRY 추출·`MODEL_TYPE_ENUM` + `ParseEnumPipe` 타입 검증·`@ApiBadRequestResponse`·e2e 400 케이스)은 ai-review의 swagger W3/W4 fix에 해당하며 plan이 추적하는 완료 작업의 일환이다. 미해결 결정과의 충돌 없고(모든 C-2 클러스터 4 결정 확정), 선행 plan 미해소 항목 없다(spec-sync 완료·authz follow-up PR #716 머지 완료). 소규모 INFO 발견사항 1건: `type` 파라미터의 400 응답이 spec §3 API 표에는 미반영이나 Swagger 레이어에 문서화돼 있고 기존 impl-done consistency check(review/consistency/2026/06/26/10_36_49/, BLOCK:NO)가 이미 clearance를 줬으므로 plan 정합 차원의 실질 위협은 없다.

---

## 위험도

LOW
