# Plan 정합성 검토 — impl-done (spec/2-navigation/6-config.md)

## 발견사항

- **[WARNING]** spec/2-navigation/6-config.md frontmatter `code:` — `llm-model-config.controller.ts` 미등재
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/2-navigation/6-config.md` frontmatter `code:` 블록 (현재 `codebase/backend/src/modules/llm/llm-preview.service.ts` 만 등재, 신규 `llm-model-config.controller.ts` 누락)
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 "planner 후속" 항목 ① — "① `2-navigation/6-config.md` frontmatter `code:` 에 신규 `llm-model-config.controller.ts` 등재(WARNING #1)"
  - 상세: 구현에서 `LlmModelConfigController`(`codebase/backend/src/modules/llm/llm-model-config.controller.ts`)가 신설돼 `model-configs` 라우트의 LLM 부속 엔드포인트(preview-models / :id/test / :id/models)를 소유하게 됐다. spec/2-navigation/6-config.md의 `code:` frontmatter는 llm 모듈에서 `llm-preview.service.ts`만 열거하고 이 신규 컨트롤러를 포함하지 않는다. 해당 spec이 API SoT(`§3 API`)를 담고 있어 코드 커버리지 앵커가 불완전하다.
  - 제안: planner 트랙에서 `spec/2-navigation/6-config.md` frontmatter `code:` 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 한 줄 추가. plan 이 "planner 후속" 으로 이미 식별해둔 항목이므로 impl-done 차단은 아님.

- **[WARNING]** spec/data-flow/7-llm-usage.md 라인 50/54 — 구 컨트롤러명·구 캐시 무효화 서술 잔존
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/data-flow/7-llm-usage.md` 라인 50 (`model-config.controller.ts`), 라인 54 ("controller 가 `LlmService.clearClientCache(id)` 를 호출")
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 "planner 후속" 항목 ② — "② `data-flow/7-llm-usage.md` line 50 컨트롤러 파일명(`model-config.controller.ts`→부속 엔드포인트는 `llm-model-config.controller.ts`) + line 54 캐시 무효화 서술(controller 직접 호출 → `ModelConfigService.onConfigInvalidated` 옵저버 → `LlmService.clearClientCache`) 현행화(INFO #6·#7)"
  - 상세: 구현 이후 부속 엔드포인트 소유자는 `model-config.controller.ts`에서 `llm-model-config.controller.ts`로 이전됐고, 캐시 무효화는 controller 직접 호출(`llmService.clearClientCache(id)`)에서 `ModelConfigService.onConfigInvalidated` 옵저버 + `LlmService.onModuleInit` 구독으로 역전됐다. 두 spec 서술 모두 구 구현을 기술하고 있어 실제 코드와 불일치한다.
  - 제안: planner 트랙에서 `spec/data-flow/7-llm-usage.md` 라인 50의 파일명을 `llm-model-config.controller.ts`로, 라인 54를 옵저버 패턴 서술로 현행화. plan 이 "planner 후속" 으로 이미 식별한 항목이므로 impl-done 차단은 아님.

- **[INFO]** 구현이 plan 처방(Option a′)을 일방적으로 벗어난 결정 없음
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 진행 서술
  - 상세: 구현 diff는 plan이 명시한 두 가지 처방 — (1) 3 엔드포인트를 `LlmModelConfigController`로 verbatim 이전(`@Controller('model-configs')` 프리픽스 유지), (2) `clearClientCache` back-edge를 `ModelConfigService.onConfigInvalidated` 옵저버로 역전 — 을 정확히 따르고 있다. plan에서 "결정 필요"로 남긴 미해결 항목과 충돌하는 일방적 결정은 없다.

## 요약

구현(C-2 cluster 4)은 plan 처방(Option a′: 엔드포인트 재배치 + 옵저버 역전)을 충실히 따르고 있어 미해결 결정과의 충돌은 없다. 다만 plan이 명시적으로 "planner 후속"으로 예약해둔 spec 업데이트 2건 — `spec/2-navigation/6-config.md` frontmatter `code:` 의 신규 컨트롤러 등재, `spec/data-flow/7-llm-usage.md` 라인 50/54의 파일명·캐시 무효화 서술 현행화 — 이 아직 반영되지 않았다. 이 두 항목은 impl 완료 후 planner 트랙의 필수 후속 조치이며, 방치 시 spec↔코드 드리프트로 남는다. impl-done 단계 차단 요인은 아니나 planner 작업 배정이 필요하다.

## 위험도

LOW
