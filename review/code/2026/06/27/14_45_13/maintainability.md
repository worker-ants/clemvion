# 유지보수성(Maintainability) 리뷰

리뷰 대상: `claude/mc-test-authz-7b3bbc` — model-config `:id/test` Editor+ 인가 강화 (authz follow-up + 이전 review-fix 반영 후 최종 상태)
리뷰 일시: 2026-06-27

---

## 발견사항

### [INFO] `it` 설명 내 화살표 표기 혼용 — `->` 대 `—`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` L98, L106
- 상세: 같은 `describe('@Roles decorator presence')` 블록 안에서 `testConnection` 케이스 설명은 `->` (ASCII 부등호+하이픈), `listModels` 케이스 설명은 `—` (em dash)를 사용한다. 이전 리뷰(11_46_32 I9)에서 언어를 영어로 통일한 것은 반영됐으나, 구두점·기호 스타일 불일치가 소폭 남아 있다. 블록 내 첫 케이스(`previewModels`)는 화살표 없이 직술형이다.
- 제안: 세 케이스 모두 동일 서술 패턴으로 맞춘다. 예: `"testConnection has 'editor' role metadata (billed action-POST, Editor+ required)"`, `"listModels has no role metadata — Viewer+ access retained"`. 가독성 영향은 낮아 별건 minor fix 수준이다.

---

### [INFO] `@Roles('editor')` 문자열 · `@ApiForbiddenResponse` 설명 문자열 두 핸들러에 반복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L72 (`previewModels`) / L90 (`testConnection`)
- 상세: `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 문자열과 `@Roles('editor')` 가 두 핸들러에 동일하게 등장한다. 이번 변경이 `previewModels` 패턴을 의도적으로 대칭 복사한 결과이며, 패턴 일관성 측면에서는 긍정적이다. 그러나 역할 문자열이나 Swagger 메시지를 향후 바꿀 때 두 곳을 모두 찾아야 한다.
- 제안: pre-existing 패턴이므로 본 PR 범위를 벗어난다. 별건 리팩터로 `EDITOR_ROLE = 'editor'` 상수 또는 `@RequireEditor()` 커스텀 데코레이터(둘을 묶음)를 도입하면 한 곳 수정으로 정리된다.

---

### [INFO] `@Throttle` 설정값 3개 핸들러에 동일값 반복 (pre-existing)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.ts` `previewModels`·`testConnection`(L80)·`listModels`(L103)
- 상세: `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 이 세 핸들러 모두에 동일하게 선언돼 있다. 숫자 `10`·`60_000` 은 의미를 유추할 수 있으나 명명된 상수가 아니다. 이는 이번 변경 이전부터 존재한 패턴이며 `testConnection` 에 `@Roles('editor')` 를 추가하면서 컨트롤러 내 반복이 더 눈에 띈다.
- 제안: 별건 리팩터로 `LLM_THROTTLE_CONFIG = { default: { limit: 10, ttl: 60_000 } }` 상수를 선언해 세 핸들러가 참조하게 한다. 현재는 차단 사유 없다.

---

### [INFO] e2e 케이스 H 길이 (77행) — 정당하나 분리 고려 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/test/workspace-rbac.e2e-spec.ts` 케이스 H 전체
- 상세: `it('H. …', …)` 단일 블록이 77행이다. 세 HTTP 요청(viewer→test, viewer→preview, editor→test, viewer→models)과 사전 인프라 설정(owner·ws·viewer·editor 생성)을 한 `it` 에 담아 길어졌다. 인라인 주석이 각 블록의 의도를 명확히 설명하고 있어 가독성은 확보됐다. 기존 케이스 A–G 도 유사한 구조를 따르므로 일관성 측면에서는 적절하다.
- 제안: 현행 유지 가능. 만약 향후 케이스가 추가되어 파일이 더 길어진다면, 인프라 설정을 `beforeAll`·공유 픽스처로 분리하는 방향을 고려한다.

---

## 긍정적 발견

- **ROLES_KEY 상수 사용**: 이전 리뷰 W3 를 반영해 `Reflect.getMetadata('roles', …)` 매직 스트링을 `roles.guard.ts` 의 `ROLES_KEY` 상수 import 로 교체했다. 3개 테스트 모두 일관되게 적용돼 키 문자열 변경 시 컴파일 타임에 잡힌다.
- **`listModels` 의도적 미적용 주석**: `@Roles` 와 `@ApiForbiddenResponse` 가 없는 이유를 3행 인라인 주석(`// 조회(Viewer+) — @Roles 미적용이 의도적이다…`)으로 명확히 설명해, 향후 수정자가 누락으로 오해해 잘못 추가하는 상황을 방지한다.
- **테스트 설명 언어 통일**: 이전 리뷰 I9 를 반영해 `listModels` 케이스 설명에서 한글을 제거하고 영어로 통일했다(`GET read`, `Viewer+ retained`).
- **e2e 인라인 주석 품질**: `missingId` 사용 이유, guard-first 실행 순서, `testConnection` best-effort 200 대 `listModels` NotFound 404 차이를 주석으로 명확히 구분해 테스트 의도를 잘 전달한다.
- **`previewModels` viewer→403 단언 추가 (이전 W1 반영)**: 케이스 H 가 spec §3·R-7 이 묶는 두 action-POST(`:id/test`·`preview-models`) 모두를 e2e 수준에서 검증한다.
- **editor 단언 축소 (이전 W2 반영)**: `editorTest` 단언을 `not.toBe(403)` 단독으로 정리해 서비스 best-effort 구현 세부사항에 결합되지 않는다.
- **변경 최소성**: 컨트롤러 소스 변경은 실질적으로 `@Roles('editor')` 1행 + `@ApiForbiddenResponse` 1행 + 인라인 주석 3행으로 극히 좁다. 새로 도입한 기술 부채가 없다.

---

## 요약

이번 변경은 `LlmModelConfigController.testConnection` 에 `@Roles('editor')` 와 `@ApiForbiddenResponse` 를 추가하고, 이전 리뷰(11_46_32)에서 지적된 매직 스트링·테스트 언어 혼용·단언 결합·CHANGELOG 누락·JSDoc 미기재를 모두 반영한 최종 상태다. 컨트롤러 변경은 `previewModels` 의 기존 패턴을 의도적으로 대칭 복사한 것으로 코드베이스 일관성을 잘 유지하며, `ROLES_KEY` 상수 사용과 `listModels` 의도 주석이 유지보수성을 높인다. 잔여 지적 사항(`->` 대 `—` 기호 혼용, `@Roles` 문자열 중복, `@Throttle` 매직 넘버)은 모두 pre-existing 패턴이거나 극히 미세한 스타일 불일치로 즉각적 수정 필요성이 없다. 신규 도입된 기술 부채는 없다.

---

## 위험도

LOW
