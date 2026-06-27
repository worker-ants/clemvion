# 유지보수성(Maintainability) 리뷰

리뷰 대상: authz follow-up — `testConnection @Roles('editor')` 추가 + e2e 케이스 H
리뷰 일시: 2026-06-27

---

## 발견사항

### [WARNING] 메타데이터 키 `'roles'` 가 테스트 3곳에 매직 스트링으로 하드코딩
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` — `@Roles decorator presence` describe 블록 내 세 `it` 블록 모두 (`Reflect.getMetadata('roles', ...)`)
- 상세: `@Roles` 데코레이터가 메타데이터 키로 사용하는 문자열 `'roles'` 가 어느 상수에도 참조되지 않고 3곳에 반복된다. 이 키가 데코레이터 구현에서 바뀌면 세 테스트 모두 `undefined`를 반환해 `toBeUndefined()` 단언은 통과하고 `toContain('editor')` 단언은 오류 메시지 없이 실패하게 된다 — 즉, 회귀를 음소거(silent failure)할 가능성이 있다.
- 제안: `@Roles` 가드 구현(`roles.guard.ts`)에서 `ROLES_KEY` 또는 동등한 상수를 export하고, 테스트에서 그 상수를 import해 사용한다. 이 패턴은 이미 프리-existing 코드(`previewModels` 테스트)에도 동일하게 존재하므로, 신규 테스트 2건이 기존 패턴을 따른 것이나 패턴 자체를 함께 개선할 기회다.

---

### [INFO] 동일 `describe` 블록 내 테스트 설명 언어 혼용
- 위치: `llm-model-config.controller.spec.ts` 라인 155, 163, 171
- 상세: 기존 테스트("previewModels method has 'editor' role metadata")는 영어 서술이고, 신규 추가된 `listModels` 테스트 설명은 `'listModels (GET 조회) has NO role metadata — Viewer+ 유지'`로 한글이 혼입돼 있다. `testConnection` 테스트 설명도 `"(billed action-POST → Editor+)"` 처럼 영어 문장에 한글 개념어가 섞인다. 같은 `describe` 블록 안에서 언어·서술 톤이 불일치하면 테스트 목록 가독성이 저하된다.
- 제안: 블록 내 서술을 영어 단일 언어로 통일한다. 예: `'listModels (GET) has NO role metadata — Viewer+ access maintained'`, `"testConnection has 'editor' role metadata (billed POST → Editor+)"`.

---

### [INFO] `@Throttle` 설정 3개 메서드에 동일값 반복
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `previewModels`(L275), `testConnection`(L295), `listModels`(L315)
- 상세: `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 이 세 핸들러 모두에 동일하게 붙어 있다. `testConnection` 에 `@Roles('editor')`를 추가한 이번 변경으로 컨트롤러 내 반복이 더 뚜렷해졌다. 숫자 `10`·`60_000` 이 매직 넘버이기도 하다.
- 제안: 컨트롤러 레벨 또는 모듈 공유 상수로 `LLM_THROTTLE_CONFIG = { default: { limit: 10, ttl: 60_000 } }` 를 선언해 세 메서드가 참조하게 한다. 제한값을 조정할 때 한 곳만 수정하면 된다. 단, 이 패턴은 pre-existing 코드이며 본 PR 변경 범위를 벗어나므로 별건 개선으로 분류한다.

---

### [INFO] `'editor'` 역할 문자열·`@ApiForbiddenResponse` 메시지 중복
- 위치: `llm-model-config.controller.ts` — `previewModels`(L274, L287), `testConnection`(L294, L305)
- 상세: `@Roles('editor')`와 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 가 두 메서드에 동일하게 나타난다. 이번 변경이 `testConnection`에 정확히 `previewModels` 패턴을 복사해 일관성을 유지했다는 점은 긍정적이나, 문자열이 여전히 분산돼 있다.
- 제안: `EDITOR_ROLE = 'editor'` 상수 및 Swagger 메시지 상수를 선언해 재사용하거나, 커스텀 데코레이터(`@RequireEditor()`)로 `@Roles('editor')` + `@ApiForbiddenResponse(...)` 조합을 캡슐화한다. 이 또한 pre-existing 패턴이므로 별건 리팩터 항목이다.

---

### [INFO] e2e 테스트 케이스 H 내 의도 중복 단언
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 라인 408-409
- 상세: `expect(editorTest.status).not.toBe(403)` 직후에 `expect(editorTest.status).toBe(200)` 가 온다. 두 번째 단언이 첫 번째를 포함하므로 `not.toBe(403)` 단언은 정보가 중복된다.
- 제안: `not.toBe(403)` 단언을 제거하고 `toBe(200)` 만 유지한다. 가드 통과 의도는 주석으로 설명하면 충분하다. 단, 현재 주석이 이미 `// 200 자체가 역할 가드 통과의 증거다` 라고 명시하고 있으므로 가독성 저해 정도는 낮다.

---

## 요약

이번 변경(`testConnection` `@Roles('editor')` 추가 + `@ApiForbiddenResponse` + 단위/e2e 테스트)은 기존 `previewModels` 패턴을 의도적으로 대칭 복사했으며, 컨트롤러 구조·테스트 구성·e2e 헬퍼 재사용 모두 코드베이스 스타일을 일관되게 따른다. 핵심 우려 사항은 메타데이터 키 `'roles'`가 세 테스트에 매직 스트링으로 분산된 점(사전 존재 패턴의 확산)이며, 이 외의 지적 사항들(스로틀 설정 중복, 역할 문자열 중복, 테스트 설명 언어 혼용)은 모두 기존 코드에 이미 존재하던 패턴으로 이번 변경이 새롭게 도입한 기술 부채는 아니다. 전체적으로 변경 범위가 작고 의도가 명확하며 미래 수정자가 역할 게이트를 추가·변경할 때 참고할 선례를 명확히 남긴다.

---

## 위험도

LOW
