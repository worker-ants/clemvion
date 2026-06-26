# Plan 정합성 검토 결과

검토 모드: impl-prep  
Target: `spec/2-navigation/6-config.md`  
관련 Plan: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4

---

## 발견사항

- **[WARNING]** 신규 `LlmModelConfigController` 가 `spec/2-navigation/6-config.md` frontmatter `code:` 에 미등재 상태
  - target 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 항목 — 현재 llm 모듈 파일은 `codebase/backend/src/modules/llm/llm-preview.service.ts` 단일 파일만 등재
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 항목 본문 중 "planner 후속(impl-first, M-4/M-7 동형): `2-navigation/6-config.md` frontmatter `code:` 에 신규 컨트롤러 등재"
  - 상세: C-2 cluster 4 구현이 완료되면 `codebase/backend/src/modules/llm/` 내에 `LlmModelConfigController` 가 신설되고, `preview-models`·`:id/test`·`:id/models` 3개 엔드포인트 구현이 `model-config` 모듈에서 `llm` 모듈로 이전된다. 현재 spec frontmatter의 `codebase/backend/src/modules/model-config/**` 글로브는 이 이전된 파일들을 커버하지 않으며, `codebase/backend/src/modules/llm/llm-preview.service.ts` 단일 파일 지정도 신규 컨트롤러를 포함하지 않는다. 구현 후 이 follow-up 을 놓치면 spec-impl coverage 가 stale 된다.
  - 제안: 이 follow-up은 plan 본문에 괄호 주석으로만 언급되어 있고 별도 체크박스나 pending_plans 등재가 없다. 구현 완료 후 planner가 `spec/2-navigation/6-config.md` frontmatter `code:` 에 `codebase/backend/src/modules/llm/**` (또는 컨트롤러 파일 경로)를 추가하는 작업을 명시적으로 추적하는 것을 권장한다. plan 에 체크박스 항목 추가 or spec `pending_plans:` 등재로 추적 가시화.

- **[INFO]** 구현 결정 완료 — 미해결 결정 없음
  - target 위치: 해당 없음 (spec 내용 충돌 없음)
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4
  - 상세: C-2 cluster 4의 처방은 사용자가 2026-06-26에 Option a′(엔드포인트 재배치)를 확정했다. 공개 API 경로(`/api/model-configs/...`)는 `@Controller('model-configs')` 프리픽스 유지로 불변이므로 `6-config.md` §3 API 표는 그대로 정확하다. 충돌 없음.
  - 제안: 없음.

---

## 요약

`spec/2-navigation/6-config.md`는 C-2 cluster 4(llm ↔ model-config forwardRef 해소) 구현과 공개 API 수준에서 충돌이 없다. 구현은 백엔드 모듈 경계를 재편하는 것이며 라우트 프리픽스가 유지되므로 spec API 표(§3)와 UX 명세는 변경 없이 유효하다. 단, 구현 완료 후 spec frontmatter `code:` 에 신규 `LlmModelConfigController` 위치를 등재하는 planner follow-up이 plan 내 괄호 주석으로만 표기되어 있고 정식 체크박스나 `pending_plans` 항목이 없어 누락 위험이 있다. 이 후속 작업이 실행되지 않으면 spec-impl coverage 가 stale 된다(WARNING).

---

## 위험도

LOW
