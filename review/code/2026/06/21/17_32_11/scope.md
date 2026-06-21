# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] `readString` 이 facade re-export 에서 노출됨
- 위치: `integration-oauth.service.ts` L81 — `import { ..., readString } from './oauth-providers'`
- 상세: `readString` 은 전략 내부 유틸이며 facade 의 `export {}` 블록(L85~86)에는 포함되지 않으나, `integration-oauth.service.ts` 내부에서 직접 사용된다. 커밋 메시지에는 `readString` 을 facade 에서 re-export 한다고 기술되어 있지 않으므로 스코프 일탈은 아니지만, `readString` / `readNumber` 가 facade 자체 로직에서 필요한지 확인이 필요하다. 실제 diff 를 보면 `readString` 은 `normalizeTokenResponse` 내 `strategy.extractProviderMeta` 위임으로 제거되었고, 잔류 사용처가 없는지 검토 필요.
- 제안: 빌드 통과가 확인되어 있으므로 실질 문제는 없다. INFO 수준.

### [INFO] `cafe24AuthorizeUrl` / `cafe24TokenUrl` 이 신설 파일에서 `export` 됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/cafe24-oauth.strategy.ts` L761~767
- 상세: `cafe24AuthorizeUrl` / `cafe24TokenUrl` 이 `export` 함수로 선언됐다. 이 두 함수는 동일 파일(및 서브클래스)에서만 사용되는 내부 유틸이므로 `export` 가 불필요하다. M-2 스코프가 "facade 에서 strategy 로 위임" 이므로 과도한 공개 API 확장은 범위 초과에 해당할 수 있다. 외부 의존이 없으면 `export` 제거가 깔끔하다.
- 제안: 두 함수를 `export` 없이 모듈 내부 함수로 유지한다. 테스트에서 직접 사용한다면 허용 가능하나, 그렇지 않으면 `export` 제거.

### [INFO] `review/consistency/` 하위 파일 7개가 동일 커밋에 포함됨
- 위치: `review/consistency/2026/06/21/17_02_20/` — SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md 등
- 상세: consistency impl-prep 결과물 파일들이 코드 리팩터링 커밋과 묶여 있다. CLAUDE.md 규약상 `review/` 산출물은 커밋에 포함하도록 명시되어 있으므로("review/ 는 gitignored 아님") 원칙 위반은 아니다. 단, 단일 커밋에서 코드 변경 + review 산출물이 혼재하면 diff 분리가 어려워진다.
- 제안: 프로젝트 규약상 허용이므로 비차단. INFO 수준.

### [INFO] `plan/in-progress/refactor/02-architecture.md` 체크박스 갱신이 동일 커밋에 포함됨
- 위치: `plan/in-progress/refactor/02-architecture.md` L148~151
- 상세: M-2 항목을 `[ ]`에서 `[x]`로 갱신하고 구현 결과 요약을 추가한 변경이 코드 변경과 같은 커밋에 포함됐다. MEMORY.md 규약("e2e/ai-review 는 수행 후 체크하고 그 갱신을 PR 커밋에 포함")과 일치하므로 범위 이탈이 아니다.
- 제안: 비차단. 규약 준수.

## 요약

M-2 변경은 `IntegrationOAuthService` 내 5가지 OAuth 프로토콜 혼합 로직을 `oauth-providers/` 하위 provider 별 strategy 로 위임하는 리팩터링으로, 외부 API 계약·facade 명·install 보안 로직은 그대로 유지된다. 변경 파일 전체가 해당 리팩터링 목적에 직결되며 무관한 파일·기능 확장·불필요한 포맷팅 변경은 발견되지 않았다. `cafe24AuthorizeUrl` / `cafe24TokenUrl` 의 불필요한 `export` 및 `readString` 잔류 import 는 경미한 정리 누락이나 빌드·테스트가 통과 확인된 상태이므로 기능적 위험은 없다. review 산출물 및 plan 체크박스 갱신은 프로젝트 규약에 따른 의무 포함이다.

## 위험도

NONE
