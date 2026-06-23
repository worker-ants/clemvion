### 발견사항

- **[INFO]** `spec/2-navigation/2-trigger-list.md` code 글로브가 새 서브디렉터리를 커버하지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 라인 6 — `codebase/frontend/src/components/triggers/*.tsx`
  - 충돌 대상: M-8 2단계 구현 신규 파일 `codebase/frontend/src/components/triggers/cards/*.tsx` (5개), `hooks/*.ts` (2개), `codebase/frontend/src/lib/api/triggers.ts`
  - 상세: `*.tsx` 단일 깊이 글로브는 `cards/` 와 `hooks/` 서브디렉터리를 포함하지 않는다 (`globToRegex` 상 `*` = `[^/]*` — 경로 구분자 불통과). `spec-code-paths.test.ts` 가드는 루트 `.tsx` 파일이 여전히 존재(`trigger-detail-drawer.tsx` 65줄)해 통과하지만, 본 spec 이 약속하는 surface 의 실질 구현체(`ChatChannelCard`, `WebhookConfigCard`, `ScheduleConfigCard`, `ExternalInteractionCard`, `OverviewCard` 5개 카드)와 데이터 레이어(`triggersApi` — `lib/api/triggers.ts`)가 `code:` 경로에서 누락됐다. `spec/2-navigation/2-trigger-list.md §3` API 표 계약을 직접 구현한 `triggersApi` 카탈로그가 어떤 spec `code:` 에도 등재되지 않았다.
  - 제안: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 `codebase/frontend/src/components/triggers/cards/*.tsx`, `codebase/frontend/src/components/triggers/hooks/*.ts`, `codebase/frontend/src/lib/api/triggers.ts` 세 경로를 추가. 또는 기존 글로브를 `codebase/frontend/src/components/triggers/**/*.tsx` 로 확장. 중요도: 가드 실패는 없으나 spec coverage gap.

- **[INFO]** `spec/conventions/user-guide-evidence.md` `ImplAnchor` 예시의 `file` 경로가 실제 심볼 정의 파일과 분리됨
  - target 위치: `spec/conventions/user-guide-evidence.md` 라인 118–119 — `file="codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx"`, `symbol="ChatChannelCard"`
  - 충돌 대상: M-8 2단계 구현 — `ChatChannelCard` 정의가 `trigger-detail-drawer.tsx` 에서 `cards/chat-channel-card.tsx` 로 이동
  - 상세: `trigger-detail-drawer.tsx` 는 현재 `import { ChatChannelCard } from "./cards/chat-channel-card"` 를 포함하므로 `grep "ChatChannelCard"` 는 해당 파일에서 여전히 매치된다 — `impl-anchor-existence.test.ts` 가드는 통과. 그러나 본 예시 문서가 가이드 작성자에게 전달하는 의도("컴포넌트 정의 파일을 `file` 에 지정")와 실제 상황(정의는 `cards/chat-channel-card.tsx`, `trigger-detail-drawer.tsx` 는 import 소비자)이 분리됐다. 이 spec 은 참고용 예시이므로 동작 차단은 없으나 문서 정합성이 저하됐다.
  - 제안: `spec/conventions/user-guide-evidence.md` 예시의 `file` 값을 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 로 갱신하는 것을 권고. 단, 이 수정의 우선순위는 낮음 — 가드 통과 중이므로 defer 가능.

- **[INFO]** 상위 spec 3개 (`15-chat-channel.md`, `slack.md`, `discord.md`) `code:` 경로에 새 카드 파일 미등재
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` — `trigger-detail-drawer.tsx` 단독; `spec/4-nodes/7-trigger/providers/slack.md`, `discord.md` 동일 패턴
  - 충돌 대상: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` (ChatChannel 설정 편집 UI의 실질 구현체)
  - 상세: Chat Channel spec 이 "구현됐다"고 약속하는 frontend surface 의 실체가 `chat-channel-card.tsx` 로 이동했으나 해당 spec 들의 `code:` 에는 아직 `trigger-detail-drawer.tsx` 만 기록돼 있다. 가드(`spec-code-paths`)는 `trigger-detail-drawer.tsx` 가 존재하므로 통과하지만 reverse-coverage 관점에서 `chat-channel-card.tsx` 는 어떤 spec 에도 evidence 로 연결되지 않는 orphan 파일이 됐다.
  - 제안: `spec/5-system/15-chat-channel.md` + `slack.md` + `discord.md` `code:` 에 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 추가. M-8 2단계의 파일 이동과 동시에 했어야 하는 spec 동기화 — defer 허용 (가드 통과 중) 이나 다음 spec 갱신 PR 에서 포함 권장.

### 요약

M-8 2단계 리팩터는 `trigger-detail-drawer.tsx` 를 thin wrapper 로 슬림화하고 실질 구현을 `cards/` 5개 + `hooks/` 2개 + `lib/api/triggers.ts` 로 분산했다. 이 파일 분산으로 인해 기존 spec `code:` 경로가 세 영역에서 outdated(단일 파일 지목 또는 단일 깊이 glob)가 됐다. 각 건은 `spec-code-paths` 및 `impl-anchor-existence` 가드를 현재 통과하고 있어 즉각적인 차단은 없지만, 역방향 커버리지(어떤 spec 이 `cards/*.tsx` 를 책임지는가)가 명시되지 않은 상태다. 직접적인 두 영역 간 의미 충돌(데이터 모델·API 계약·상태 전이·RBAC 모델)은 발견되지 않았다.

### 위험도

LOW
