# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 발견사항은 WARNING 이하 수준.

## 전체 위험도
**LOW** — WARNING 4건(Swagger 규약 위반 2건 + spec frontmatter 미갱신 + Rationale 문서 오해 유발), INFO 5건. 코드 행동·API 계약·보안에 대한 실질적 위험 없음.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | rationale_continuity + cross_spec | `spec/5-system/7-llm-client.md` Rationale 가 forwardRef 순환을 여전히 "오픈 백로그(`unified-model-management §7 W4`)"로 기술 — C-2 cluster 4 가 이미 해소함 | `spec/5-system/7-llm-client.md` §5.4 (line 443) + §Rationale (line 476) | `llm.module.ts` / `model-config.module.ts` 에서 `forwardRef` 제거 완료, `LlmModelConfigController` 분리 + 옵저버 패턴 도입 | `"백로그 W4 로 추적"` 문구를 `"refactor-02 C-2 cluster 4 에서 컨트롤러 분리 + 옵저버 패턴으로 해소됨"` 으로 교체 |
| W2 | convention_compliance + plan_coherence + rationale_continuity | `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 컨트롤러 미등재 — spec-impl-evidence §2.1 위반 | `spec/2-navigation/6-config.md` frontmatter `code:` 섹션 | `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (신설, JSDoc 에 "SoT: spec/2-navigation/6-config.md §3" 명시) | planner 가 `code:` 목록에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 추가 (plan C-2 cluster 4 "planner 후속 ①" 미수행 항목) |
| W3 | convention_compliance | `LlmModelConfigController` 세 핸들러(`previewModels`, `testConnection`, `listModels`) 모두 `@ApiUnauthorizedResponse` 누락 | `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — 세 핸들러 | `spec/conventions/swagger.md §2-4` — "보호된 엔드포인트는 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 포함" | 세 핸들러 각각에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 추가 |
| W4 | convention_compliance | `testConnection` POST 핸들러 `@HttpCode(HttpStatus.OK)` 누락 — Swagger(200) 와 실제 응답(NestJS 기본 201) 불일치 | `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `testConnection` 핸들러 | `spec/conventions/swagger.md §2-4, §5-4` 체크리스트; 동일 컨트롤러 `previewModels` 는 `@HttpCode(HttpStatus.OK)` 보유 | `testConnection` 에 `@HttpCode(HttpStatus.OK)` 추가 (기존 `ModelConfigController.testConnection` 에도 동일 버그 있었음 — 이전 시 수정 기회 놓침) |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | cross_spec | `POST /:id/test` 핸들러에 `@Roles` 가드 없음 — `previewModels` (`@Roles('editor')` 보유)와 불일치. pre-existing 동작이며 보안 영향 낮음 | `llm-model-config.controller.ts` `testConnection` | `spec/2-navigation/6-config.md §B.3` 에 "action 엔드포인트(`test`, `preview-models`) 는 mutation 아님" 명시 또는 `@Roles('editor')` 추가해 `previewModels` 와 일관성 맞춤 |
| I2 | plan_coherence | `spec/data-flow/7-llm-usage.md §1.1` 컨트롤러 파일명(`model-config.controller.ts`) 및 캐시 무효화 경로(`controller → LlmService.clearClientCache()`) 구현 이전 서술 유지 | `spec/data-flow/7-llm-usage.md` §1.1 lines 50, 54 | planner 가 (a) 파일명 → `llm-model-config.controller.ts`, (b) 경로 → `ModelConfigService.onConfigInvalidated` 옵저버 → `LlmService.clearClientCache` 로 갱신 (plan C-2 cluster 4 "planner 후속 ②") |
| I3 | rationale_continuity | plan W3/W4 해소 경로 예측(DTO 이동) vs 실제 구현 경로(컨트롤러 분리 + 옵저버 역전) 차이 — 설계 원칙 충돌 없음 | `plan/complete/unified-model-management.md §7 W3/W4` | W1 Rationale 갱신 시 채택된 방식(컨트롤러 분리 + 구독 옵저버) 명시로 해결 |
| I4 | naming_collision | `LlmModelConfigController` 와 `ModelConfigController` 가 동일 라우트 프리픽스 `model-configs` 공유 — 핸들러 경로 겹침 없고 NestJS 정상 허용 패턴 | `llm-model-config.controller.ts` + `model-config.controller.ts` | 유지 가능. 향후 핸들러 추가 시 `Reflect.getMetadata` 기반 경로 중복 단위 테스트 추가 고려 |
| I5 | naming_collision | `onConfigInvalidated` 가 "리스너 등록 API" 임에도 `on*` 접두사 사용 — NestJS 라이프사이클 훅과 혼동 소지 미미 | `model-config.service.ts:59` | 변경 불필요. Node.js `EventEmitter.on()` 관례와 일치, 코드베이스 내 동명 충돌 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | INFO 2건 — spec Rationale 문서 낙후(forwardRef 해소 미반영), testConnection 역할 가드 정책 불명확 |
| rationale_continuity | LOW | WARNING 1건(W1) + INFO 2건 — Rationale 가 해소된 백로그를 미해결로 기술 |
| convention_compliance | LOW | WARNING 3건(W2·W3·W4) — spec frontmatter 미등재, @ApiUnauthorizedResponse 누락, @HttpCode 누락 |
| plan_coherence | LOW | WARNING 1건(W2 공유) + INFO 1건 — plan 지정 planner 후속 항목 미수행 (구현 완료 후 예정 상태) |
| naming_collision | NONE | INFO 2건 — 실질적 충돌 없음 |

---

## 권장 조치사항

1. **(W3 · W4 — 코드 수정, developer)** `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 에서 세 핸들러에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 추가, `testConnection` 에 `@HttpCode(HttpStatus.OK)` 추가. Swagger 문서 정확성 직결.
2. **(W1 — spec 수정, planner)** `spec/5-system/7-llm-client.md` §5.4 line 443 + §Rationale line 476 의 "백로그 unified-model-management §7 W4" 참조를 "refactor-02 C-2 cluster 4 해소" 로 교체. 독자 오해 방지.
3. **(W2 — spec 수정, planner)** `spec/2-navigation/6-config.md` frontmatter `code:` 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 추가. spec-impl-evidence 정합성 회복 (plan C-2 cluster 4 "planner 후속 ①").
4. **(I2 — spec 수정, planner)** `spec/data-flow/7-llm-usage.md §1.1` 컨트롤러 파일명·캐시 무효화 경로 현행화 (plan C-2 cluster 4 "planner 후속 ②").
5. **(I1 — 선택)** `spec/2-navigation/6-config.md §B.3` 에 action 엔드포인트 역할 가드 면제 정책을 명시하거나, `testConnection` 에 `@Roles('editor')` 를 추가해 `previewModels` 와 일관성 확보. 보안 영향 낮으므로 우선순위 하.