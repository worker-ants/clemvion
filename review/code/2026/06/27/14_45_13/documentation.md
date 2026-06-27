# Documentation Review

**대상 브랜치**: `claude/mc-test-authz-7b3bbc`
**리뷰 일시**: 2026-06-27
**변경 개요**: `LlmModelConfigController.testConnection` Editor+ 인가 강화 (`@Roles('editor')` + `@ApiForbiddenResponse`) + 단위/e2e 테스트 보강 + CHANGELOG/spec 동기화

---

## 발견사항

### [INFO] CHANGELOG 항목이 이전 리뷰 사이클 W4 를 해소했으나 "Breaking changes" 섹션 위치가 표준과 다름

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/CHANGELOG.md` — 새 `## Unreleased — model-config :id/test 인가 강화` 섹션
- 상세: `## Unreleased` 항목이 추가됐고 `### Breaking changes` 하위에 Viewer→403 behavior change 가 정확히 기재됐다. 내용 자체는 충분하다. 단, CHANGELOG 에서 일반적으로 "### Breaking changes" 는 "### 변경 사항" 보다 앞에 오는 관례가 이미 이 문서에 지켜지고 있으며 이번 항목도 그 순서를 준수한다. 표현 불일치 없음. — 이전 리뷰 W4 가 완전히 해소됐다.
- 제안: 없음.

### [INFO] `listModels` 핸들러 인라인 주석이 워크스페이스 멤버십 403 책임을 "컨트롤러 공통 인증 계층"으로 표현

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-test-authz-7b3bbc/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L99–101
- 상세: 주석은 "워크스페이스 멤버십 미충족 403 은 컨트롤러 공통 인증 계층 책임이다" 라고 기술한다. 이는 정확하지만, "공통 인증 계층"이 구체적으로 어떤 가드·미들웨어인지 명시하지 않는다. 독자가 어느 가드를 찾아야 하는지 알기 어려울 수 있다. 그러나 이 주석의 주목적은 `@Roles` 미적용이 의도적임을 설명하는 것이고, 가드 구현 위치까지 설명하는 것은 주석의 책임 범위를 넘는다.
- 제안: 현행 유지. 필요하다면 "워크스페이스 멤버십 가드(`WorkspaceGuard` 또는 동등 레이어) 책임이다" 처럼 가드 이름을 한 단어 추가할 수 있으나 의무는 아니다.

### [INFO] `@ApiForbiddenResponse` description 한국어 표기 — 코드베이스 언어 스타일 확인 필요

- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L90 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })`
- 상세: 이번 변경이 아닌 기존 `previewModels` 핸들러(L72)에 이미 동일 패턴("editor 이상 권한 필요")이 사용됐으며, 이번 `testConnection` 추가는 그것을 대칭 복사했다. Swagger description 이 한국어로 기재된 점은 pre-existing 패턴으로 일관성 있다. 언어 표기 자체가 이 PR 에서 도입된 문제는 아니다.
- 제안: pre-existing 패턴. 별건 리팩터 시 영어 통일 여부를 검토한다.

### [INFO] e2e 파일 상단 JSDoc invariants 에 케이스 H 항목 추가 — 이전 리뷰 I12 해소 확인

- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 상단 JSDoc (diff 파일 4, L166–167)
- 상세: 이전 리뷰(11_46_32) I12 에서 지적한 "케이스 H 인가 계약이 파일 상단 JSDoc invariants 목록에 미기재" 가 반영됐다. "model-config 과금 action-POST(`:id/test`·`preview-models`)는 Editor+ 게이트, 조회 GET(`:id/models`)은 Viewer+ 허용 (spec §3·R-7)" 항목이 추가됐다.
- 제안: 없음.

---

## 긍정적 발견

- **CHANGELOG Breaking changes 기재**: `POST /api/model-configs/:id/test` Viewer→403 behavior change 가 `## Unreleased — model-config :id/test 인가 강화` 섹션과 `### Breaking changes` 하위에 정확히 기재됐다. 영향 범위(UI 경로 없음, 직접 API 갭 차단), spec SoT 참조(spec §3·R-7), 부수효과(embedding 차원 자동저장 PATCH) 설명이 모두 포함돼 운영 팀과 외부 소비자가 배포 전 인지할 수 있다.
- **`listModels` 의도적 생략 주석**: `@Roles` 와 `@ApiForbiddenResponse` 가 없는 이유를 `// 조회(Viewer+) — @Roles 미적용이 의도적이다(spec §3·R-7: :id/models 는 Viewer 이상)…` 주석으로 명확히 서술해, 후속 개발자가 누락으로 오해하고 데코레이터를 추가하는 실수를 방지한다.
- **Swagger 선언 정합성**: `testConnection` 에 `@Roles('editor')` 추가와 동일 커밋에서 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 가 추가돼 OpenAPI 문서와 구현이 일치한다. `previewModels` 의 기존 패턴을 정확히 복사해 대칭성을 유지했다.
- **테스트 describe 블록 주석 갱신**: `// ── @Roles guard — preview-models stays editor-gated ──` 가 `// ── @Roles guard — preview-models·testConnection editor-gated; listModels Viewer+ ──` 로 갱신돼 테스트 파일만 읽어도 인가 계약을 즉시 파악할 수 있다.
- **spec SoT 인라인 참조**: 테스트 파일 `describe` 블록에 `// 인가 계약 SoT: spec/2-navigation/6-config.md §3 + R-7.` 와 `// ROLES_KEY 상수를 import 해 메타데이터 키 매직 스트링('roles') 하드코딩을 피한다.` 주석이 추가돼 계약 출처와 구현 결정 이유를 모두 추적 가능하다.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 우수하다. 이전 리뷰(11_46_32) 에서 지적된 두 가지 문서화 항목 — W4(CHANGELOG 누락)와 I6(listModels 의도적 생략 주석 부재), I12(e2e JSDoc invariants 미기재) — 이 모두 해소됐다. CHANGELOG 는 breaking change 의 배경·영향 범위·spec 근거를 충분히 서술하고, 컨트롤러 인라인 주석은 `@Roles` 부재가 의도적임을 spec 절 참조와 함께 명시하며, Swagger 어노테이션은 구현과 정합한다. 잔여 INFO 항목은 pre-existing 스타일(Swagger description 한국어 표기)이거나 주석 세부 개선 수준으로, 차단 사유가 없다.

---

## 위험도

NONE
