# 신규 식별자 충돌 검토 — naming-collision

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- diff 범위: `origin/main..HEAD` (base=`2aa4c8093`, HEAD=`31bbd1d3a`)
- target 변경 요약: `codebase/frontend/src/lib/websocket/use-kb-events.ts` 의 `KB_EVENT_NAMES` 배열을
  `useKbEvents` 함수 내부 closure-local 선언에서 module-scope `export const` 로 승격. 원소 목록도
  `document:graph_error` 제거(12종→11종)로 backend `KbEventType` union 과 1:1 정렬. backend
  `websocket.service.ts` 는 JSDoc 만 갱신(12개→11개 정정), `KbEventType` union 타입 리터럴 자체는 무변경.
  신규 테스트 `use-kb-events.test.ts` 추가. spec 4곳(`6-websocket-protocol`, `8-embedding-pipeline`,
  `10-graph-rag`, `2-navigation/5-knowledge-base`) 및 `CHANGELOG.md` 문서 정합화.

## 검토 방법

1. `git diff origin/main..HEAD --stat` 로 변경 파일 전수 확인 (8개 파일, code 3 + spec 4 + CHANGELOG 1).
2. `use-kb-events.ts` diff 정독 — 신규 export 식별자가 `KB_EVENT_NAMES` 1개뿐임을 확인.
3. `grep -rn "KB_EVENT_NAMES"` 전체 리포(`codebase/**`, node_modules 제외)로 기존/신규 사용처 전수 확인.
4. `grep -rn "EVENT_NAMES"` 로 동일 패턴 명명(예: `BACKGROUND_RUN_EVENT_NAMES`)과의 충돌·혼동 여부 확인.
5. backend `websocket.service.ts` 의 `KbEventType` union 전체 리터럴을 diff 전후 대조 — 리터럴 변경 없음(JSDoc만) 확인.
6. backend `embedding.service.ts` / `graph-extraction.service.ts` 의 `'document:*'` emit 리터럴 전수
   grep — union 밖 신규 이벤트명 없음, 타 도메인과의 `document:` prefix 충돌 없음 확인.
7. `__tests__/` 디렉터리 내 기존 테스트 파일 명명 컨벤션과 신규 `use-kb-events.test.ts` 경로 대조.
8. 신규 export 의 barrel/index 재수출 여부 확인 (`index.ts` 없음 → 재수출 충돌 경로 없음).

## 발견사항

- **[INFO]** `KB_EVENT_NAMES` 신규 export — 충돌 없음, 명명 컨벤션 일부 비대칭
  - target 신규 식별자: `codebase/frontend/src/lib/websocket/use-kb-events.ts:18` `export const KB_EVENT_NAMES`
  - 기존 사용처: 리포 전체에서 `KB_EVENT_NAMES` 문자열은 이번 diff 이전에 존재하지 않았음(순수 신규 도입). 동일 파일 내 이전 위치(구 closure-local, `useKbEvents` 함수 body 내부)에서만 쓰이던 것을 module-scope 로 끌어올린 것 — 의미·값 모두 동일 개념의 승격이라 이름 재사용에 해당하지 않음.
  - 상세: 리포지토리 전수 grep(`grep -rn "KB_EVENT_NAMES" --include="*.ts" --include="*.tsx" .`, node_modules 제외) 결과 사용처는 정의부(`use-kb-events.ts:18`)와 소비처 2곳(`use-kb-events.ts:124,135` 내부 `ws.on/off` 루프, `use-kb-events.test.ts:3,17,20,23,29,45,51,55` import 및 assertion)뿐이다. 다른 모듈·다른 의미로 이미 쓰이던 이름을 가로채는 경우가 아니다. 다만 인접 파일 `use-background-run.ts:14` 의 `BACKGROUND_RUN_EVENT_NAMES` 는 이미 module-scope 로 선언돼 있으나(단, `export` 는 아님) export 되지 않는다 — 같은 `lib/websocket/` 디렉터리 안에서 "이벤트명 배열 상수" 패턴이 하나는 `export`, 하나는 파일 내부 전용으로 비대칭이다. 충돌은 아니지만 두 상수가 관례상 대구를 이루므로(`KB_*` vs `BACKGROUND_RUN_*`, 접두사 방식은 일관) 명명 자체는 문제없다.
  - 제안: 조치 불필요(NONE). 참고로 `BACKGROUND_RUN_EVENT_NAMES` 도 향후 회귀 테스트가 필요해지면 동일 패턴(`export const` 승격)을 따르는 것이 일관성 있음 — 이번 target 범위 밖이므로 강제 아님.

- **[INFO]** backend `KbEventType` union — 요구사항/타입 리터럴 무변경 확인
  - target 신규 식별자: 없음 (`KbEventType` 자체는 기존 정의, 이번 diff 는 JSDoc 텍스트만 "12개"→"11종" 정정)
  - 기존 사용처: `codebase/backend/src/modules/websocket/websocket.service.ts:343-354` — union 리터럴 11개(`document:embedding_started/_progress/_completed/_error/_retry/_failed`, `document:graph_started/_progress/_completed/_retry/_failed`)는 diff 전후 문자열 그대로 동일.
  - 상세: `git diff origin/main..HEAD -- codebase/backend/src/modules/websocket/websocket.service.ts` 로 대조한 결과 변경 hunk 는 `KbEventType` 선언 바로 위 JSDoc 블록뿐이며, `export type KbEventType = ...` 이하 11개 union 멤버는 한 글자도 바뀌지 않았다. `embedding.service.ts`/`graph-extraction.service.ts` 의 실제 emit 리터럴(`'document:embedding_*'`, `'document:graph_*'`, `_error` 제외)도 union 과 정확히 일치하며 타 도메인(execution: 접두사 등)과 `document:` prefix 충돌 없음.
  - 제안: 조치 불필요(NONE). target 설명("backend `KbEventType` union·이벤트 리터럴은 무변경")과 실제 diff 가 일치함을 확인.

- **[INFO]** 신규 테스트 파일 경로 — 기존 컨벤션과 일치
  - target 신규 식별자: `codebase/frontend/src/lib/websocket/__tests__/use-kb-events.test.ts` (신규 파일)
  - 기존 사용처: 동일 디렉터리에 `use-background-run.test.tsx`, `use-execution-events.test.ts`, `use-execution-interaction-commands.test.ts`, `apply-execution-snapshot.test.ts`, `execution-error-codes.test.ts`, `ws-client.test.ts` 존재 — `use-<hook-name>.test.ts` 1:1 대응 패턴을 그대로 따름.
  - 상세: 경로 충돌·명명 컨벤션 이탈 없음.
  - 제안: 조치 불필요(NONE).

## 요약

이번 diff 가 도입하는 유일한 신규 export 식별자 `KB_EVENT_NAMES` 는 리포지토리 전역에서 사전 사용례가 없는 순수 신규 이름이며, 같은 파일 안에서 기존에 같은 의미로 쓰이던 closure-local 상수를 module-scope export 로 승격한 것이라 의미 재정의나 다른 도메인과의 충돌 소지가 없다. `document:*` 이벤트 리터럴도 신규 추가 없이 기존 backend emit 코드·`KbEventType` union(11종, 리터럴 무변경)과 정확히 1:1 재정렬됐을 뿐이며, 타 모듈(`execution:` 채널 등)과의 이벤트명 prefix 충돌도 없다. 신규 테스트 파일 경로도 기존 `__tests__/use-*.test.ts` 컨벤션을 따른다. 발견된 사항은 모두 INFO 수준(조치 불필요)이며 CRITICAL/WARNING 급 충돌은 없다.

## 위험도

NONE
