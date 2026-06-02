# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `conversation.test.ts` — presentation-only turn 테스트 미추가
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/channel-web-chat/src/lib/conversation.test.ts`
- **상세**: `threadToMessages` 에 `presentations` 가 있는 turn 처리 로직이 추가됐다(텍스트가 없어도 presentations 가 있으면 포함). 기존 `conversation.test.ts` 에는 이 새 경로에 대한 테스트가 없다. 구체적으로 테스트 누락 경로는 (1) 텍스트 없이 presentations 만 있는 turn → 포함되는지, (2) presentations 가 있고 map 시 `presentations` 필드가 올바르게 전파되는지, (3) presentation 이 빈 배열인 경우의 처리다.
- **제안**: 기존 `conversation.test.ts` 에 아래 케이스를 추가한다:
  - `presentations` 만 있는 turn(text 없음) → messages 에 포함, `text` 는 `""`
  - `text + presentations` 동시 존재 turn → 포함, 둘 다 전파
  - `presentations: []` turn → 제외(빈 배열은 필터 통과 못 함)

### [INFO] `widget-state.test.ts` — `AI_MESSAGE` presentations 전파 경로 테스트 미추가
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/channel-web-chat/src/lib/widget-state.test.ts`
- **상세**: `AI_MESSAGE` action 에 `presentations` 필드가 추가됐고 `assistantMsg` 헬퍼에서 `presentations?.length` 조건부 전파를 한다. 기존 `widget-state.test.ts` 에 `AI_MESSAGE` 와 관련된 기존 테스트가 있으나, `presentations` 를 포함한 `AI_MESSAGE` dispatch 시 messages 에 올바르게 전파되는지, `presentations` 가 빈 배열일 때 `undefined` 로 설정되는지는 테스트되지 않는다. 추가된 `BLOCKED` 테스트는 잘 작성됐다.
- **제안**: `AI_MESSAGE` with presentations 케이스 추가:
  - `presentations: [{ output: { rendered: "T" } }]` → `state.messages[0].presentations` 배열 전파 확인
  - `presentations: []` → `state.messages[0].presentations` 가 `undefined` 확인

### [INFO] `use-widget.test.ts` — 테스트 범위가 `refreshDelayMs` 유틸 함수에 한정
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/channel-web-chat/src/widget/use-widget.test.ts`
- **상세**: 추가된 테스트는 `refreshDelayMs` 순수 함수만 다루며 이 자체는 적절하다. 그러나 `isEmbedAllowed`, `fetchEmbedConfig` 로직도 순수 함수에 준하는 검증이 가능한 구조다. `isEmbedAllowed` 는 `fetch` 결과·`enforce` 플래그·`detectHostOrigin` 결과의 조합이므로, 현재 `widget-app.test.tsx` 의 통합 경로 외에 단위 수준 테스트가 없다. `widget-app.test.tsx` 에서 fetch stub 을 통해 BLOCKED 경로를 검증하는 통합 케이스는 있으나, `isEmbedAllowed` 의 세부 분기(enforce off → 허용, origin 미탐지 → 허용, fetch 실패 → 허용)가 개별 단위 테스트로 분리되어 있지 않다.
- **제안**: `isEmbedAllowed` 를 별도 export 하거나 테스트 파일에서 fetch 를 stub 하여 (1) `enforce=false` 시 항상 `true`, (2) `allowlist` 비어있으면 `true`, (3) fetch 실패 시 `true`(fail-open), (4) `detectHostOrigin` 이 null 일 때 `true` 케이스를 단위 테스트로 커버한다. 현재 `widget-app.test.tsx` 의 통합 테스트가 이를 부분 커버하지만, 단위 테스트로 분리하면 디버깅이 용이하다.

### [INFO] `hooks.controller.spec.ts` — `getEmbedConfig` 엣지 케이스(EmbedConfigService resolve 실패) 미테스트
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/backend/src/modules/hooks/hooks.controller.spec.ts`
- **상세**: `getEmbedConfig` 에 대해 정상 경로(allowlist 반환 + Cache-Control 설정)만 테스트한다. `EmbedConfigService.resolve` 가 예외를 던질 경우(가령 서비스 자체 예외가 service 레벨 catch 를 통과하지 못하는 경우) 컨트롤러가 어떻게 동작하는지 테스트가 없다. 단, `EmbedConfigService` 자체가 내부 catch 로 항상 `{ allowlist: [], enforce: false }` 를 반환하므로 컨트롤러 레벨에서 예외가 전파될 일은 사실상 없다 — INFO 수준.
- **제안**: `embedConfigService.resolve` 가 예외를 던질 경우 컨트롤러가 글로벌 exception filter 를 통해 500 응답을 내려보내는지 검증하는 케이스를 선택적으로 추가할 수 있다.

### [INFO] `presentation.test.ts` — `toTable` config.columns 폴백 경로 미테스트
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/channel-web-chat/src/lib/presentation.test.ts`
- **상세**: `toTable` 테스트는 `output.columns` + `output.rows` 를 사용한다. 그러나 `toTable` 구현에는 `output.columns` 없을 때 `config.columns` 로 폴백하는 경로가 있다. 또한 `config.rows` 폴백(`Array.isArray(output.rows) ? output.rows : config.rows`)도 미테스트다.
- **제안**: `config.columns` / `config.rows` 폴백 케이스를 각각 추가한다.

### [INFO] `presentations.test.tsx` — 캐러셀 `prev` 버튼 내비게이션 테스트 미추가
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/channel-web-chat/src/widget/components/presentations.test.tsx`
- **상세**: 캐러셀 테스트에서 다음(다음 슬라이드)은 테스트하지만 이전(이전 슬라이드) 내비게이션은 테스트하지 않는다. 또한 단일 아이템 캐러셀에서 이전/다음 버튼 비활성화 상태도 테스트되지 않는다.
- **제안**: (1) 이전 버튼 클릭 → 슬라이드 감소, (2) 경계값에서 버튼 disabled 상태를 추가한다.

### [WARNING] `widget-app.test.tsx` — `document.referrer` 전역 상태 변경 후 복원 방식이 불안정
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/channel-web-chat/src/widget/widget-app.test.tsx` (임베드 불허 테스트 내)
- **상세**: 임베드 불허 테스트에서 `Object.defineProperty(document, "referrer", { value: "https://evil.example.com/page", configurable: true })` 로 `referrer` 를 설정하고 테스트 끝에서 `{ value: "", configurable: true }` 로 복원한다. 그러나 테스트 실행 중 예외가 발생하면(assertion 실패 포함) 복원 코드가 실행되지 않아 `referrer` 가 오염된 채로 남아 이후 테스트에 영향을 줄 수 있다.
- **제안**: `afterEach` 또는 `try/finally` 패턴으로 복원을 보장한다:
  ```ts
  afterEach(() => {
    Object.defineProperty(document, "referrer", { value: "", configurable: true });
  });
  ```

### [INFO] `embed-config.service.spec.ts` — workspace 가 null 인 경우(trigger 존재, workspace 미탐지) 미테스트
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/backend/src/modules/hooks/embed-config.service.spec.ts`
- **상세**: trigger 는 있으나 workspace 가 null 인 경우(trigger.workspaceId 는 있으나 해당 workspace 가 삭제됐거나 조회 실패)의 동작이 테스트되지 않는다. 구현 코드(`workspace?.settings?.['interactionAllowedOrigins']`)는 workspace 가 null 일 때 `origins` 가 undefined 가 되어 빈 allowlist 를 반환하므로 allow-all 로 degrade 된다 — 이 경로를 명시적으로 테스트하면 의도가 더 명확해진다.
- **제안**: `trigger: { workspaceId: 'ws1' }`, `workspace: null` 케이스 추가 → `{ allowlist: [], enforce: false }` 확인.

### [INFO] `_ensure_web_chat_deps` — test-stages.sh 의 헬퍼 함수 자체 검증 부재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/.claude/test-stages.sh`
- **상세**: `_ensure_web_chat_deps` 는 `node_modules` 디렉터리 존재 여부를 확인해 없으면 `npm ci` 를 실행한다. 이 로직 자체에 대한 자동화 테스트는 없다. `npm ci` 실패 시(lock 파일 불일치 등) 전체 stage 가 실패하나, 이는 CI 실행 시 검출된다. shell script 단위 테스트(bats 등)가 프로젝트에 없으므로 INFO 수준이다.
- **제안**: CI 에서 lock 파일 무결성 검증(`npm ci --dry-run`)이 이미 수행되므로 현재 수준은 적절하다. `npm ci` 실패 시 명확한 오류 메시지를 남기는 패턴을 추가하면 디버깅에 도움이 된다.

## 요약

전체적으로 이번 변경은 TDD 규약에 잘 부합한다. `EmbedConfigService` 유닛 테스트는 trigger 미존재, 조회 오류, 비-문자열 필터링 등 핵심 경계 케이스를 충분히 커버하며, `presentation.test.ts` 는 모든 presentation 종류와 shape 판별 로직을 독립적으로 검증한다. `widget-state.test.ts` 의 `BLOCKED` 케이스, `widget-app.test.tsx` 의 임베드 불허 통합 테스트, `use-widget.test.ts` 의 `refreshDelayMs` 순수 함수 테스트도 의도를 명확히 표현한다. 주요 테스트 갭은 (1) `conversation.test.ts` 의 presentation-only turn 경로 미커버, (2) `widget-state.test.ts` 의 `AI_MESSAGE presentations` 전파 미검증, (3) `widget-app.test.tsx` 의 전역 상태(`document.referrer`) 복원 불안정(WARNING, 테스트 간 오염 위험) 세 가지다. Mock 사용은 적절하며 테스트 간 의존성은 없다.

## 위험도

LOW

---

STATUS=success ISSUES=9
