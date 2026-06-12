# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] chat-channel.controller.ts — 책임 분리 개선 (긍정적 변경)
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` 전체
- 상세: `@Headers('x-workspace-id')` 수동 파싱 + 인라인 `UnauthorizedException` 방어 로직을 공용 `@WorkspaceId()` 데코레이터로 교체했다. 컨트롤러가 직접 헤더 이름 문자열(`'x-workspace-id'`)을 알아야 했던 지식이 제거되어, 헤더 이름 변경 시 한 곳만 수정하면 된다. 이것은 유지보수성 향상이다.
- 제안: 없음.

### [INFO] chat-channel.controller.ts — 중복 방어 코드 제거 (긍정적 변경)
- 위치: `chat-channel.controller.ts` 53–58행 (삭제된 `if (!workspaceId)` 블록)
- 상세: `@WorkspaceId()` 데코레이터가 이미 `WORKSPACE_ID_REQUIRED` 400을 발생시키므로, 컨트롤러 내부의 동일 의미 검증이 중복이었다. 삭제로 코드가 간결해졌다.
- 제안: 없음.

### [INFO] chat-channel.controller.spec.ts — 테스트 코멘트 범위 명확화 (긍정적 변경)
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` 상단 JSDoc
- 상세: 워크스페이스 검증이 어디서 이루어지는지(`workspace.decorator.spec.ts`)와 왜 직접 호출 단위테스트 범위 밖인지를 설명하는 코멘트가 추가되었다. 테스트 코드를 읽는 사람이 "왜 이 케이스가 없지?"라는 의문을 갖지 않도록 문서화되어 있다.
- 제안: 없음.

### [WARNING] chat-channel.controller.ts — `body?.newBotToken` 옵셔널 체이닝 불일치
- 위치: `chat-channel.controller.ts` 49행 `if (!body?.newBotToken || typeof body.newBotToken !== 'string')`
- 상세: 첫 조건에서 `body?.newBotToken`(옵셔널 체이닝)을 사용하고, 두 번째 조건에서는 `typeof body.newBotToken`(비-옵셔널)을 사용한다. `body`가 `null`/`undefined`인 경우 첫 조건에서 이미 `true`가 되므로 두 번째 조건은 실행되지 않아 런타임 오류는 없다. 그러나 읽는 사람 입장에서는 두 조건의 `body` 접근 방식이 다른 이유를 명확히 알기 어렵다. 또한 이 변경 자체가 기존 코드에서 이미 있던 패턴이므로 본 PR이 도입한 문제는 아니다.
- 제안: 일관성을 위해 두 조건을 `body?.newBotToken`과 `typeof body?.newBotToken`으로 통일하거나, `body`가 항상 Nest의 `@Body()` 파이프라인에서 non-null임을 주석으로 명시할 수 있다. 단, 기존 패턴이므로 별도 PR에서 다루는 것이 적절하다.

### [INFO] user-docs triggers.mdx / triggers.en.mdx — 에러코드 단일 진실 정합 (긍정적 변경)
- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:299`, `triggers.mdx:788`
- 상세: `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 단순 string 치환으로 두 언어판 사용자 문서가 spec 및 구현과 정합을 유지한다. 한국어판과 영어판이 동일하게 업데이트되었다.
- 제안: 없음.

### [INFO] spec/5-system/15-chat-channel.md — spec 표 업데이트 명확성
- 위치: `spec/5-system/15-chat-channel.md` §5.4 표
- 상세: `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED` 변경 시 공용 데코레이터 파일 경로와 canonical 에러 문서 참조(`3-error-handling.md §1.3`)가 함께 명시되어 있다. 파일 경로를 링크로 제공해 구현 파일을 빠르게 찾을 수 있다.
- 제안: 없음.

### [INFO] spec/5-system/15-chat-channel.md — `EiaAiMessageEvent` → `EiaEvent` 명칭 정합
- 위치: `spec/5-system/15-chat-channel.md` 652행
- 상세: `EiaAiMessageEvent` 라는 부정확한 타입명이 `EiaEvent` (convention §1.2의 실제 union 타입명)로 수정되었다. 타입명 불일치는 스펙 검색 및 구현 참조 시 혼동의 원인이 된다.
- 제안: 없음.

### [INFO] plan 파일들 — 작업 추적 문서 정합
- 위치: `plan/complete/code-node-isolated-vm.md` (신규), `plan/in-progress/chat-channel-workspace-code-unify.md` (신규)
- 상세: 두 plan 파일 모두 frontmatter 스키마가 준수되어 있고, 완료 체크리스트·결정 배경·Rationale 섹션이 체계적으로 기록되어 있다. `code-node-isolated-vm.md`는 `plan/complete/`에, 진행 중인 것은 `plan/in-progress/`에 배치되어 프로젝트 규약을 따른다.
- 제안: `plan/in-progress/chat-channel-workspace-code-unify.md`의 `/ai-review`와 `/consistency-check --impl-done` 체크박스가 미완료 상태(`[ ]`)다. 해당 항목들은 이 PR의 리뷰 프로세스가 끝난 후 갱신되어야 한다.

---

## 요약

이번 변경은 `WORKSPACE_REQUIRED`/`UnauthorizedException`/`@Headers` 수동 패턴을 공용 `@WorkspaceId()` 데코레이터로 교체하는 집중적이고 범위가 명확한 정합성 패치다. 컨트롤러에서 중복 방어 코드와 불필요한 import가 제거되어 단일 책임 원칙이 강화되었고, 테스트 코멘트가 검증 책임의 소재를 명시함으로써 유지보수자가 테스트 gap을 오해하지 않도록 가이드한다. 에러코드 문자열 변경이 spec·컨트롤러·사용자 문서(한/영) 전 레이어에 일관되게 적용되어 단일 진실 원칙이 유지된다. 기존에 발견된 `body?.newBotToken` 옵셔널 체이닝 불일치는 본 PR 도입 사항이 아니므로 별도 후속으로 처리하면 충분하다.

## 위험도

LOW
