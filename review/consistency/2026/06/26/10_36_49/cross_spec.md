# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
scope: `spec/2-navigation/6-config.md`
diff-base: `origin/main`
검토 일시: 2026-06-26

---

## 발견사항

### [WARNING] `spec/5-system/7-llm-client.md` — forwardRef 순환 백로그(W4) 현재형으로 기술

- **target 위치**: 구현 변경 전반 (diff 전체 — `LlmModule`, `ModelConfigModule`, `LlmModelConfigController`)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/5-system/7-llm-client.md` §8 Rationale, 라인 443 및 476
- **상세**:
  - 라인 443: `"모듈 의존은 LlmModule → ModelConfigModule(상호 forwardRef; 순환 정리는 백로그 unified-model-management §7 W4)."` 
  - 라인 476: `"이로 인해 LlmModule → ModelConfigModule 상호 forwardRef 순환이 생겼고, 그 정리는 백로그 unified-model-management §7 W4 로 추적한다(런타임 위험 없음)."`
  - 이 구현(refactor-02 C-2 cluster 4)이 정확히 W4 백로그 항목을 해소한다. `LlmModule` 은 이제 `forwardRef` 없이 `ModelConfigModule` 을 직접 import 하고, `ModelConfigModule` 은 `LlmModule` 을 전혀 import 하지 않는다. 순환은 소멸했다. 그러나 spec 은 여전히 순환을 **현재 진행형**으로 기술하고 있어 이후 독자가 백로그가 미해결이라 오인한다.
- **제안**: `spec/5-system/7-llm-client.md` §8 Rationale 의 해당 두 문장을 `"모듈 의존은 LlmModule → ModelConfigModule 단방향(순환 해소 — refactor-02 C-2 cluster 4, W4 완료)"` 으로 갱신한다. `unified-model-management §7 W4` 백로그 항목도 완료 처리 필요.

---

### [INFO] `spec/2-navigation/6-config.md` frontmatter `code:` 누락

- **target 위치**: `spec/2-navigation/6-config.md` 파일 상단 frontmatter `code:` 섹션
- **충돌 대상**: 동일 파일 내 API 표 §3 (`POST /api/model-configs/preview-models`, `POST /api/model-configs/:id/test`, `GET /api/model-configs/:id/models`)
- **상세**:
  - 현재 frontmatter: `codebase/backend/src/modules/model-config/**` 만 기재됨.
  - 이 refactor 이후 `preview-models`, `:id/test`, `:id/models` 세 엔드포인트는 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/codebase/backend/src/modules/llm/llm-model-config.controller.ts` 에 존재한다.
  - spec 의 `code:` 섹션이 이 파일을 나열하지 않으므로, spec-coverage 도구나 감사자가 세 엔드포인트의 구현 위치를 놓칠 수 있다.
- **제안**: `spec/2-navigation/6-config.md` frontmatter 에 `- codebase/backend/src/modules/llm/llm-model-config.controller.ts` 행을 추가한다.

---

### [INFO] `spec/5-system/7-llm-client.md §5.5` — preview-models 의 구현 모듈 참조 정보 구식

- **target 위치**: 구현 diff — `LlmModelConfigController` (새 파일) 및 `ModelConfigController` (핸들러 제거)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/5-system/7-llm-client.md` §5.5 (preview-models 엔드포인트 설명)
- **상세**:
  - §5.5 는 `LlmPreviewService.previewModels` 가 어디서 호출되는지 모듈 구조 설명을 포함하며, 과거 `ModelConfigController` 가 이를 소유하던 맥락에서 작성됐다.
  - 이제 핸들러는 `LlmModelConfigController` (llm 모듈)가 소유한다. 기능·API 계약은 동일하지만 "어느 컨트롤러/모듈이 소유하는가" 라는 설명이 있다면 갱신 필요.
  - spec §5.5 자체는 컨트롤러 모듈을 명시적으로 지목하지 않으므로 현재는 서술 충돌이 없다. 추가 설명이 붙을 경우 주의.
- **제안**: 현재 spec 본문이 모듈 귀속을 명시하지 않으므로 즉각 수정 불요. W4 Rationale 갱신(WARNING 항목)과 함께 처리하면 충분하다.

---

## 요약

이번 구현(refactor-02 C-2 cluster 4)은 `model-config ↔ llm` 모듈 간 `forwardRef` 순환을 세 가지 기법(LlmModelConfigController 신설, 옵저버 패턴 전환, 단방향 import 정립)으로 해소한 리팩터링이다. **API 계약(라우트·HTTP 메서드·request/response shape)·RBAC(`@Roles('editor')` on `preview-models`)·데이터 모델·상태 전이 모두 기존 `spec/2-navigation/6-config.md` §3 및 `spec/5-system/7-llm-client.md §5.5`의 정의와 일치한다.** 충돌은 발견되지 않았다. 단, `spec/5-system/7-llm-client.md` Rationale 이 forwardRef 순환을 현재 진행형으로 기술하고 있어(백로그 W4가 이 구현으로 해소됐음에도 spec 미갱신) 이후 독자에게 혼란을 줄 수 있다(WARNING). `spec/2-navigation/6-config.md` frontmatter `code:` 누락은 spec-coverage 도구 정확도에 영향을 미치는 INFO 수준 사항이다.

## 위험도

LOW
