# 정식 규약 준수 검토 결과

검토 모드: --impl-done  
대상 spec: `spec/2-navigation/6-config.md`  
diff-base: `origin/main`

---

## 발견사항

### [WARNING] spec frontmatter `code:` 가 신규 구현 파일(`llm-model-config.controller.ts`)을 포함하지 않음

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/2-navigation/6-config.md` frontmatter `code:` (line 11)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 필드는 "본 spec 이 약속한 surface 의 구현 경로"를 모두 열거해야 한다. `status: implemented` spec 은 `spec-code-paths.test.ts` 가드 통과를 위해 ≥1 glob 매칭을 요구하지만, 규약의 의미론적 요건은 spec 이 약속한 surface 전체를 커버하는 것이다.
- **상세**: 본 PR 에서 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 가 신규 생성됐고, 이 파일이 `spec/2-navigation/6-config.md §3 Model Config API` 에 명시된 세 엔드포인트(`POST /api/model-configs/preview-models`, `POST /api/model-configs/:id/test`, `GET /api/model-configs/:id/models`)를 구현한다. 그러나 현재 frontmatter `code:` 의 llm 모듈 관련 항목은 `codebase/backend/src/modules/llm/llm-preview.service.ts` 단일 파일만 지목한다 — 디렉토리 glob 이 아닌 파일 단위 참조라 새 컨트롤러 파일을 포함하지 않는다. 빌드 가드(`spec-code-paths.test.ts`)는 다른 glob(`codebase/backend/src/modules/model-config/**`) 덕분에 통과하지만, llm 모듈의 spec-promised surface 에 대한 evidence 가 불완전하다.
- **제안**: frontmatter `code:` 의 `codebase/backend/src/modules/llm/llm-preview.service.ts` 를 `codebase/backend/src/modules/llm/**` 로 확장하거나, 신규 파일을 별도 항목으로 추가한다:
  ```yaml
  - codebase/backend/src/modules/llm/llm-preview.service.ts
  + - codebase/backend/src/modules/llm/llm-model-config.controller.ts
  ```
  또는
  ```yaml
  - codebase/backend/src/modules/llm/**
  ```

---

## 요약

`spec/2-navigation/6-config.md` 의 문서 구조(Overview/본문/Rationale 3섹션), frontmatter 의무 필드(`id`, `status: implemented`), API 문서 규약(컨트롤러 데코레이터·DTO 래퍼·경로 파라미터 형식), 금지 패턴 항목은 모두 정식 규약을 준수한다. 단, refactor-02 C-2 cluster 4 에서 Model Config API 의 LLM-구동 엔드포인트 구현체가 `model-config` 모듈에서 `llm` 모듈의 `LlmModelConfigController` 로 이전되면서, spec frontmatter `code:` 에 새 구현 경로가 반영되지 않은 evidence 갭이 1건 남아 있다. 빌드 가드는 통과하나, spec-impl-evidence 규약의 의미론적 요건(약속한 surface 의 구현 경로 열거)을 충족하지 못한다.

---

## 위험도

LOW
