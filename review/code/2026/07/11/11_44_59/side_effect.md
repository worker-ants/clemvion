# 부작용(Side Effect) 리뷰

대상: `git diff 1682777fe..HEAD` (2 commits)
- `964e887af` feat(web-chat,sdk): EIA getStatus context 를 클라이언트에서도 닫힌 union 으로 정밀화
- `428134b64` test(docs): spec-link-integrity 가드를 codebase 소스로 확장 + 깨진 링크 14곳 정정

## 발견사항

- **[INFO]** `@workflow/sdk` 공개 타입 표면 narrowing — pre-1.0 alpha 라 리스크 낮음, 문서화 확인
  - 위치: `codebase/packages/sdk/src/client.ts` `ExecutionStatus.context` (`Record<string, unknown> | null` → `WaitingContext | null`), `codebase/packages/sdk/src/index.ts` (신규 export `WaitingContext`/`ButtonsContext`/`NodeOutputContext`)
  - 상세: `context` 필드를 인덱스 시그니처 없는 닫힌 union(`ButtonsContext | NodeOutputContext`)으로 좁혔다. 런타임 값은 그대로지만(진짜 "type-only") — 만약 외부 소비자가 `status.context?.someArbitraryKey` 같은 임의 키 인덱스 접근을 하던 코드가 있었다면 **컴파일 타임에 깨진다** (`WaitingContextBase`/`ButtonsContext`/`NodeOutputContext` 모두 index signature 없음). 리포 안에서는 SDK 소비처가 `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` 뿐이며 이 파일은 `context` 를 전혀 참조하지 않아 내부적으로는 영향 없음을 확인. 다만 `@workflow/sdk` 는 `package.json` 에 `private` 플래그가 없고 npm publish 를 겨냥한 패키지라 외부(3rd-party) TypeScript 소비자가 존재한다면 잠재적 breaking type change.
  - 완화 근거: `codebase/packages/sdk/README.md` 가 "v0 alpha (0.1.x) — 외부 publish 전. SemVer 정책: 0.x 동안 minor 도 breaking change 가능" 을 명시적으로 선언하고 있어(아직 실제 외부 publish 전), 이 narrowing 은 프로젝트가 사전 승인한 정책 범위 안. `WaitingContext`/`ButtonsContext`/`NodeOutputContext` 신규 export 이름도 백엔드 `ButtonsContextDto`/`NodeOutputContextDto`/`WaitingContextBaseDto`(`responses.dto.ts`)와 1:1 대응하며 기존 export 이름과 충돌 없음(grep 확인).
  - 제안: 별도 조치 불필요(문서화된 pre-1.0 정책 범위). 향후 실제 npm publish 시점에는 CHANGELOG 항목으로 명시하는 것을 권장.

- **[INFO]** 위젯(`eia-types.ts`) 측 `ExecutionStatus.context` 도 동일하게 narrowing — 내부 유일 소비처만 확인됨
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` `ExecutionStatus.context: Record<string, unknown> | null` → `WaitingContext | null`
  - 상세: repo 전체에서 `.context` 를 실제로 역참조하는 곳은 `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `seedWaitingFromStatus` 단 한 곳뿐(grep 으로 확인, `ExecutionStatus`/`.context` 양쪽 검색). `channel-web-chat` 은 `package.json` 에 `"private": true` 로 외부 배포 대상이 아니므로 breaking-change 리스크 사실상 0.
  - 제안: 없음(정보 제공용).

- **[INFO]** `use-widget.ts` — `as WaitingForInputEvent` 캐스트 제거는 컴파일 타임 전용, 런타임 영향 없음. Assignability 재확인 완료
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:225-232`
  - 상세: `parseWaitingForInput(ev: WaitingForInputEvent): ParsedWaiting` (`eia-events.ts:36`) 은 구조적 타이핑을 사용한다. `WaitingForInputEvent` 의 모든 필드(`status?`, `waitingNodeId?`, `waitingNodeType?`, `interactionType?`, `conversationThread?`, `nodeOutput?`, `buttonConfig?`, `seq?`)가 optional 이므로, `ButtonsContext`(`interactionType`/`waitingNodeId` required + `buttonConfig` required)와 `NodeOutputContext`(동일 + `nodeOutput` required)는 각 required 필드 타입이 대상 optional 필드의 타입과 호환되고 나머지는 대상에서 optional 이라 누락이 허용된다 — 두 variant 모두, 따라서 union 전체가 `WaitingForInputEvent` 에 assignable. 여기에 더해 `status.context` 는 `status.status === "waiting_for_input" && status.context` 가드로 `null` 이 좁혀진 뒤 전달되므로 타입 오류 없이 컴파일된다. 캐스트 제거는 순수 컴파일타임 표기 변화 — `as` 는 애초에 런타임 no-op(타입 단언)이므로 실행 동작에 어떤 차이도 없다. `eia-events.test.ts` 신규 테스트("`as` 없이 컴파일된다는 것" 자체가 회귀 가드)로도 같은 결론을 뒷받침.
  - 제안: 없음(주장한 대로 순수 type-only, 검증 완료).

- **[INFO]** 백엔드 3파일(14곳 링크) — JSDoc 주석 라인만 변경, 코드 라인 0줄 확인
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts`(8개 링크, 3개 헝크), `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts`(1개), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`(1개)
  - 상세: `git show 428134b64 -- <세 파일>` 로 직접 확인. 모든 변경 hunk 가 `/** ... */` JSDoc 블록 내부의 markdown 링크 `[text](../../..../spec/....md#anchor)` 상대경로 깊이(`../` 개수)와 anchor fragment 텍스트만 바뀌었다. `export`/`class`/필드 선언·데코레이터·로직 등 실행 코드 라인은 diff 에 전혀 등장하지 않음 — 커밋 메시지의 "코드 라인 0줄" 주장과 일치.
  - 제안: 없음.

- **[INFO]** `spec-links.ts` 신규 함수(`collectCodebaseSources`, `findBrokenSpecLinksInSources`) — 전역 상태·부작용 없음, 기존 함수 미변경
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:238-341` (순수 추가, `findBrokenLinks`/`collectSpecMarkdown` 등 기존 함수 본문은 diff 에 등장하지 않음 — 변경 없음 확인)
  - 상세: 두 신규 함수 모두 module-level mutable state 를 도입하지 않는다 — `slugCache`(`Map`)는 `findBrokenSpecLinksInSources` 함수 스코프 로컬 변수. 파일시스템 접근은 `fs.existsSync`/`fs.readdirSync`(읽기 전용)뿐, 쓰기·삭제 없음. 기존 export 된 헬퍼(`extractLinks`/`isExternal`/`headingSlugs`/`SpecMdFile`)를 재사용만 하며 그 구현을 수정하지 않았다(grep 으로 각 함수 정의가 diff hunk 밖에 있음을 확인). 스캔 대상은 `codebase/{backend,channel-web-chat,packages}` 로 한정, `node_modules`/`dist`/`build`/`.next` 제외 — 빌드 산출물 오탐 없음.
  - 제안: 없음.

- **[INFO]** `spec-impl-evidence.md` §4.2 — 표 셀 텍스트만 변경
  - 위치: `spec/conventions/spec-impl-evidence.md` (가드 스코프 설명 표 1행)
  - 상세: `git diff` 확인 결과 단일 표 행의 서술 텍스트 교체뿐(가드 스코프를 `spec/**.md` 단독 → `spec/**.md` + codebase 소스로 갱신). 코드·frontmatter 스키마·다른 섹션 변경 없음.
  - 제안: 없음.

- **[INFO — 프로세스 관찰, diff 범위 밖]** 리뷰 도중 워크트리에 일시적 uncommitted 변경 관측(자연 해소됨)
  - 위치: 워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/eia-client-context-types-33e771` (커밋 아님, 파일시스템 상태)
  - 상세: 리뷰 중간 시점에 `git status --short` 가 `use-widget.ts`/`eia-types.ts`/`eia-events.test.ts` 3파일을 modified 로 보고했고, 그 working-tree 내용이 정확히 커밋 `964e887af` 의 변경을 되돌린 상태(캐스트 원복, `WaitingContext`류 타입 삭제)였다. 이후 재확인 시 `git status` 는 해당 3파일에 대해 clean(HEAD 와 동일)으로 돌아왔고, 대신 `plan/in-progress/eia-context-schema-followups.md` 1파일 modified + `review/code/**`·`review/consistency/**` 신규 untracked 디렉터리만 남아 있었다. 즉 같은 워크트리에서 다른 프로세스(동시 진행 중인 다른 리뷰/에이전트 세션)가 일시적으로 해당 파일들을 원복했다가 복구한 것으로 보인다 — 커밋된 diff 자체의 결함은 아니지만, 워크트리 공유 상태가 리뷰 시점에 따라 달라질 수 있음을 시사하므로 기록해 둔다. 최종 커밋 push 전에는 `git diff HEAD --stat` 로 working tree 가 HEAD 와 정확히 일치(또는 의도된 변경만 존재)하는지 재확인 권장.
  - 제안: push 직전 `git status`/`git diff HEAD` 로 워크트리 클린 상태 재확인. (본 리뷰의 CRITICAL/WARNING 판정에는 반영하지 않음 — 커밋 diff 자체는 건전.)

## 요약

두 커밋 모두 주장대로 순수 컴파일타임 변경이다. `use-widget.ts` 의 `as` 캐스트 제거는 구조적 타이핑상 `WaitingContext`(`ButtonsContext | NodeOutputContext`, 모든 필드 required)가 `WaitingForInputEvent`(전 필드 optional)에 assignable 함이 성립해 런타임·컴파일 양쪽에서 안전함을 확인했다. 위젯·SDK 양쪽의 `ExecutionStatus.context` narrowing(`Record<string, unknown>` → 닫힌 union)은 인덱스 시그니처를 잃으므로 이론상 "임의 키 접근"을 하던 소비 코드를 컴파일 타임에 깨뜨릴 수 있으나, 리포 내 실제 소비처는 각 1곳뿐이고 `@workflow/sdk` 는 README 에 "v0 alpha, 0.x 동안 breaking change 허용" 이 명시된 미배포 패키지라 실질 리스크는 낮다. 백엔드 3파일의 14곳 링크 수정은 JSDoc 주석 내부 상대경로/anchor 텍스트만 바뀌었고 실행 코드는 0줄 변경 — 확인됨. `spec-links.ts` 신규 함수는 전역 상태·쓰기 부작용 없이 파일시스템을 읽기 전용으로 스캔하며 기존 함수(`findBrokenLinks`/`collectSpecMarkdown`)를 수정하지 않았다. `spec-impl-evidence.md` 편집은 표 셀 텍스트 1곳뿐. 부작용 관점에서 이 diff 자체에 CRITICAL/WARNING 급 문제는 없다.

## 위험도

LOW
