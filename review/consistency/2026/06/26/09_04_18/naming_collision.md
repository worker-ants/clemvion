# 신규 식별자 충돌 검토 결과

**검토 대상**: `spec/2-navigation/6-config.md`
**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**컨텍스트**: refactor C-2 cluster 4 — `llm ↔ model-config` forwardRef 순환 제거
- 신규 코드 파일: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`
- 신규 observer hook: `ModelConfigService.onConfigInvalidated`
- 기존 `ModelConfigController` 에서 3개 LLM 부속 엔드포인트를 `LlmModelConfigController` 로 이전

---

## 발견사항

### 발견사항 없음 (충돌 0건)

target 인 `spec/2-navigation/6-config.md` 가 이번 구현에서 **신규 spec 변경 사항 없음** (`(없음)`)이며,
기존 spec 이 이미 정의하는 식별자(엔드포인트·엔티티·요구사항 ID 등)는 아래와 같이 충돌이 없다.

---

### **[INFO]** `spec/data-flow/7-llm-usage.md` — 컨트롤러 파일명 참조가 이전 위치를 가리킴

- **target 신규 식별자**: 기존에 없던 파일 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (신규 `LlmModelConfigController`)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/data-flow/7-llm-usage.md` line 50
  ```
  부속 엔드포인트 (`model-config.controller.ts`; 구 `/api/llm-configs` alias …):
  ```
- **상세**: 구현 완료 후 `preview-models`·`:id/test`·`:id/models` 3개 엔드포인트의 실제 핸들러 위치가 `model-config/model-config.controller.ts` → `llm/llm-model-config.controller.ts` 로 이전되었다. `7-llm-usage.md` line 50 의 `model-config.controller.ts` 파일명 참조는 이미 구현된 이전 상태를 가리키게 되어, 개발자가 해당 엔드포인트 구현을 추적할 때 잘못된 파일을 찾게 된다. API 경로 자체(spec §3 Model Config API)는 변화 없으므로 사용자 가시 계약에는 영향 없음.
- **제안**: `7-llm-usage.md` line 50 의 `model-config.controller.ts` 를 `llm-model-config.controller.ts` (llm 모듈)로 정정. 단 본 변경은 impl 완료 후 spec-sync 단계에서 처리 가능하며, 본 impl-prep 착수를 막는 수준이 아님.

---

### **[INFO]** `spec/data-flow/7-llm-usage.md` — 캐시 무효화 경로 서술이 이전 패턴을 반영

- **target 신규 식별자**: `ModelConfigService.onConfigInvalidated` 옵저버 훅 (신규 내부 메서드)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/data-flow/7-llm-usage.md` line 54
  ```
  config 수정/삭제 시 controller 가 `LlmService.clearClientCache(id)` 를 호출해 client 캐시 + listModels 캐시를 함께 무효화한다.
  ```
- **상세**: 구현 후 캐시 무효화 경로는 "controller → LlmService 직접 호출" 에서 "ModelConfigService.onConfigInvalidated 옵저버 → LlmService.clearClientCache 콜백" 로 바뀐다. `7-llm-usage.md` 의 서술은 변경 후 동작과 달라진다. 동일 시점·동일 효과는 유지되므로 기능 계약상 차이는 없다.
- **제안**: impl 완료 후 `7-llm-usage.md` line 54 를 옵저버 패턴(`onConfigInvalidated` → `clearClientCache`) 으로 갱신. impl-prep 착수를 막지 않음.

---

### **[INFO]** `spec/2-navigation/6-config.md` frontmatter `code:` — 신규 컨트롤러 파일 미등재

- **target 신규 식별자**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (새 파일)
- **기존 사용처**: `spec/2-navigation/6-config.md` frontmatter `code:` 항목 (line 9–11)
  ```yaml
  code:
    - codebase/backend/src/modules/model-config/**
    - codebase/backend/src/modules/llm/llm-preview.service.ts
  ```
- **상세**: 새 컨트롤러 파일은 `6-config.md §3 Model Config API` 의 3개 엔드포인트(`preview-models`·`:id/test`·`:id/models`)를 구현하는 핵심 파일이다. `llm-preview.service.ts` 는 별도로 등재되어 있지만 동일 기능의 새 컨트롤러가 누락된 상태다. plan C-2.4 에서 "planner 후속: `6-config.md` frontmatter `code:` 에 신규 컨트롤러 등재" 를 명시하고 있다.
- **제안**: impl 완료 후 `6-config.md` frontmatter 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 추가. spec-impl-evidence 정책(frontmatter `code:` 갱신)에 따른 표준 절차.

---

## 주요 확인 사항 (충돌 없음 근거)

| 점검 항목 | 결과 |
|---|---|
| 요구사항 ID 충돌 | 없음 — `(없음)` 변경, 신규 ID 미도입 |
| 엔티티/타입명 충돌 | 없음 — `ModelConfig`·`AuthConfig` 기존 정의와 동일 의미 재사용 |
| API endpoint 충돌 | 없음 — `/api/model-configs/*` 는 단일 표면으로 이미 spec 에 정의됨. 구 `/api/llm-configs`·`/api/rerank-configs` alias 는 PR4 에서 제거 완료 |
| 이중 컨트롤러 route 충돌 | 없음 — `LlmModelConfigController`(`preview-models`·`:id/test`·`:id/models`)와 `ModelConfigController`(CRUD)가 같은 `@Controller('model-configs')` prefix 를 쓰지만 담당 sub-route 가 완전히 분리되어 NestJS 라우팅 충돌 없음 |
| 이벤트/메시지명 충돌 | 없음 — `onConfigInvalidated` 는 내부 콜백 훅, 공개 SSE/WebSocket 이벤트 아님 |
| ENV var·설정키 충돌 | 없음 — 신규 ENV var 미도입 |
| 파일 경로 충돌 | 없음 — `llm-model-config.controller.ts` 는 신규 파일, 기존 파일과 충돌하지 않음 |

---

## 요약

`spec/2-navigation/6-config.md` 는 이번 구현 라운드에서 spec 내용 변경이 없으며(`(없음)`), 기존 spec 이 정의하는 식별자(API 엔드포인트·엔티티명·요구사항 ID 등)에서 명명 충돌은 발견되지 않았다. 코드 레벨 신규 식별자(`LlmModelConfigController`, `onConfigInvalidated`)는 spec 공개 계약과 무관한 내부 구현 이름이라 충돌이 없다. 다만 `spec/data-flow/7-llm-usage.md` 의 2개 참조(컨트롤러 파일명·캐시 무효화 경로 서술)가 구현 완료 후 stale 해지는 INFO 수준 사항이 있으며, 이는 impl 완료 후 spec-sync 단계에서 정정하는 것으로 충분하다. impl-prep 착수를 막는 Critical 또는 Warning 충돌은 없다.

---

## 위험도

NONE
