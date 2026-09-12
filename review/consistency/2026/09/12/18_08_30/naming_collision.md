# 신규 식별자 충돌 검토 — naming_collision

대상: `chat-channel-rules-cleanup` (impl-done, scope=`spec/5-system/`, diff-base=`origin/main`)
검토 방식: `spec/5-system` 델타는 0파일(코드 전용 PR, 정상)이므로 실제 검토 대상은 워킹트리
diff(14파일, `codebase/backend/src/modules/triggers/**` · `codebase/backend/src/repo-guards/__tests__/**`)다.
모든 판정은 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rules-cleanup`)를
절대경로로 직접 grep/read 해 실측했다.

## 발견사항

- **[INFO]** 이번 PR 자체가 낸 진짜 CRITICAL 충돌은 세션 내에서 이미 발견·정정·검증됨
  - target 신규 식별자: `ChatChannelBotIdentityDto` (응답 DTO 첫 판본에서 사용)
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:149` — 이미 같은 이름의 클래스가 존재 (입력 검증용, 필드 optional·teamId 없음)
  - 상세: `@nestjs/swagger` 는 스키마를 클래스 `.name` 문자열로 `components.schemas` 에 등록하므로 동명 클래스 두 개가 스캔되면 한쪽이 다른 쪽을 덮어써 OpenAPI 문서가 실제 응답과 달라진다. 이 PR 의 이전 라운드에서 신규 응답 DTO에 그대로 재사용해 실제로 충돌을 냈고, 두 개의 독립 code-review agent(`review/code/2026/09/12/16_17_57` documentation CRITICAL)가 잡았다.
  - 현재 상태(실측): **이미 해소됨.** 새 응답 DTO 클래스는 `ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto` 로 개명되어 `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 에 있고, `chat-channel-config.dto.ts` 의 `ChatChannelBotIdentityDto` 와는 이름이 달라 더 이상 겹치지 않는다. 독립 검증: `modules/`+`common/` 아래 `*.dto.ts` 의 `export class` 이름을 전수(256개) grep-uniq 했을 때 중복 0건 — PR 이 새로 추가한 harness 가드(`repo-guards/__tests__/dto-class-name-collision-guard.ts`/`.spec.ts`)의 "베이스라인 0" 주장과 grep 결과가 일치한다.
  - 제안: 조치 불필요 — 이미 종결. 재발 방지용 가드까지 이 PR 이 추가했으므로 후속 PR 에서 이 검토 관점을 계속 유지할 수 있다.

- **[INFO]** 새로 도입된 헬퍼/타입 식별자는 전수 grep 결과 충돌 없음
  - target 신규 식별자: `throwInvalidField`, `hasField`, `rejectBlockedField` (함수, `chat-channel-input-rules.ts`) · `ChatChannelBlockedField` (타입, `chat-channel-rejection-messages.const.ts`) · `ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto` (클래스, 신규 파일)
  - 기존 사용처: 없음 (backend `src/` 전수 grep 결과 선언처 외 참조 0건)
  - 상세: `hasField` 처럼 범용성이 높은 이름이라 다른 모듈에서 다른 의미로 쓰일 위험을 확인했으나, 이 저장소 다른 어디에도 동명 식별자가 없다.
  - 제안: 없음 (기록 목적)

- **[INFO]** 신규 파일 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 는 기존 규약(`swagger.md §5-1` `dto/responses/*-response.dto.ts`)과 형제 모듈(`folders`·`edges`·`notifications`·`auth` 등 20+ 모듈) 관례를 그대로 따름 — 파일 경로 충돌·컨벤션 이탈 없음. `triggers/dto/responses/` 안의 기존 파일(`trigger-response.dto.ts`)과도 이름이 겹치지 않는다.

- **[WARNING]** (이미 등재됨 — 새 발견 아님, 완결성 확인차 기록) `spec/5-system/15-chat-channel.md` frontmatter 의 `code:` glob(`.../triggers/dto/chat-channel-*.dto.ts`)이 신규 파일 경로 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 를 못 잡는다
  - target 신규 식별자: 새 코드 파일 경로 `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
  - 기존 사용처: `spec/5-system/15-chat-channel.md` frontmatter `code:` glob — `*` 가 `/` 를 넘지 않아 `dto/responses/` 하위 디렉터리가 그 spec 의 시야 밖
  - 상세: 이 PR 은 `spec/5-system` 을 건드리지 않았으므로(scope delta 0, developer 축 권한 밖) glob 을 직접 넓히지 않았고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 축 후속 항목으로 이미 등재했다(`code: glob 을 dto/**/chat-channel-*.dto.ts 로 넓힌다`). spec-link 판정 자체는 `2-trigger-list.md` 의 `dto/**` 가 이 자리를 덮어 깨지지 않는다고 문서화됨.
  - 제안: 조치는 planner 턴에서 glob 확장으로. 이번 developer 턴에서는 추가 조치 불필요(이미 계획대로 등재·완결된 처분).

## 요약

이번 PR(`chat-channel-rules-cleanup`)이 신규로 도입한 식별자(`throwInvalidField`·`hasField`·`rejectBlockedField`·`ChatChannelBlockedField`·`ChatChannelRotateBotTokenDto`·`ChatChannelRotateBotIdentityDto`, 신규 파일 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`, 신규 가드 `dto-class-name-collision-guard.ts`)를 백엔드 전체(`src/modules`, `src/common`)를 대상으로 전수 grep 하여 검증한 결과, 현재 워킹트리에는 살아있는 이름 충돌이 없다. 이 세션 자체가 진행 중 신규 DTO 클래스명(`ChatChannelBotIdentityDto`)이 기존 클래스와 실제로 충돌했던 사례를 이미 두 리뷰어가 CRITICAL 로 잡아 개명(`ChatChannelRotateBotIdentityDto`)했고, 재발 방지용 AST 기반 전수 스캔 가드까지 이번 PR 에 포함시켰다 — 독립적으로 `export class` 이름을 256개 전수 grep-uniq 해 중복 0건을 재확인해 그 주장을 뒷받침했다. 유일한 잔여 항목은 spec `code:` glob 이 새 파일 위치(`dto/responses/`)를 못 잡는다는 파일-경로/스코프 정합성 이슈이며, 이는 developer 권한 밖(spec 수정 불가)이라 planner 축 트래커에 이미 등재되어 있고 spec-link 자체는 깨지지 않는다.

## 위험도

LOW
