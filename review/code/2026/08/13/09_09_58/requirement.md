# 요구사항(Requirement) 리뷰 — CCH-SE-02 chat-channel update dedup (라운드 `09_09_58`)

## 스코프 및 검증 방식

이 diff 는 이미 두 차례의 code-review 라운드(`02_38_41`, `02_50_38`)와 한 차례의 consistency-check
라운드(`02_50_39`)를 거친 최종 상태(모든 WARNING 조치 반영본)다. 이번 라운드는 그 결론을
신뢰하지 않고 실제 소스(`Read`/`grep`)를 다시 열어 핵심 주장(스펙 line-level 일치, 엣지 케이스
도달 가능성, 뮤테이션 근거, 이전 WARNING 조치 여부)을 독립 재검증했다.

## 검증한 사실

- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전문을 직접 열어
  `claim()` 의 4개 반환 경로(Redis 미주입 → `true`, 빈 키 → `true`, `SET NX EX 30` 성공 →
  `result==='OK'`, 예외 → `warn`+`true`)가 모두 정의돼 있고 미정의 경로가 없음을 확인.
- `spec/5-system/15-chat-channel.md:88` (CCH-SE-02) 실제 라인을 재확인 — 키 포맷
  `cc:dedup:<triggerId>:<updateId>` ↔ `makeChatDedupKey` 구현, TTL 30 ↔ `CHAT_DEDUP_WINDOW_SEC`,
  `SET NX EX 30` ↔ `this.redis.set(key,'1','EX',30,'NX')`, fail-open(+warn) 모두 line-level 일치.
- `spec/5-system/15-chat-channel.md:113` (CCH-NF-03 "구현:" 절)이 새 dedup 게이트 삽입을 반영해
  "parseUpdate 직후(**CCH-SE-02 dedup 게이트를 통과한 뒤**...)" 로 이미 갱신돼 있음을 확인 —
  직전 라운드가 `[SPEC-DRIFT]` WARNING 으로 지적했던 항목이 실제로 조치됨.
- `spec/5-system/15-chat-channel.md:710-719` `## Rationale` 에 신규 `R-CC-20`(EIA `Idempotency-Key`
  재사용이 불가능했던 구조적 이유·게이트 위치·fail-open 근거)이 실제로 추가됐음을 확인 — consistency
  라운드(`02_50_39`) 의 rationale_continuity WARNING #3 이 조치됨.
- `spec/data-flow/14-chat-channel.md:196-197` 에 `cc:dedup:{triggerId}:{idempotencyKey}` (TTL 30초)
  과 `cc:rl:{triggerId}:{conversationKey}` 두 행이 실제로 추가됐음을 확인 — cross_spec WARNING #2
  (data-flow 미러 갱신 누락)가 조치됨. `ChatChannelRateLimiterService.consume` 실 구현
  (`INCR`+`EXPIRE NX`, `cc:rl:` 키, TTL 60초)과 대조해도 이 표 서술이 정확함을 재확인.
- `CHANGELOG.md:5` "provider 파서 3종(telegram·slack·discord)" — `grep -rl idempotencyKey
  .../providers/` 로 실제 3개 파일만 이 필드를 채움을 재확인. 직전 라운드가 지적한 "4종" 오기가
  "3종"으로 정정돼 있음.
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts:160-162` —
  `view_submission` 분기에서 `view.id` 와 top-level `trigger_id` 가 둘 다 없으면
  `idempotencyKey: ''` 가 실제로 만들어질 수 있는 코드 경로임을 직접 확인. `claim()` 의 "빈 키는
  dedup 대상 아님" 가드가 도달 불가능한 사문이 아니라 이 malformed-payload 경로에 대응하는 정당한
  방어라는 이전 라운드 판단에 동의.
- `hooks.service.ts:257`(`handleChatChannelWebhook(trigger: Trigger, ...)`)를 확인 — `trigger` 는
  필수 파라미터라 dedup 게이트(`:338-345`) 시점에 `trigger.id` 는 항상 정의됨. null 역참조 위험 없음.
- `hooks.controller.spec.ts` 에는 `new HooksService(...)` 위치 인자 생성 호출이 없음(mock 객체
  캐스팅만 사용) — `HooksService` 생성자 시그니처 변경(파라미터 삽입)이 컴파일을 깨지 않음을 재확인.
- `hooks.service.spec.ts:1227-1271` 의 CCH-SE-02 신규 테스트가 (1) `dedup.claim` 호출 인자
  (`trigger.id`, `'3001'`), (2) 호출부 `Logger.warn('재도착 무시')`, (3) rate-limiter 미소비,
  (4) `interactionService.interact` 미호출을 모두 단언함을 확인 — "서비스는 옳은데 호출부가 반환값을
  버리는" dead-field 류 회귀를 실제로 잡을 수 있는 형태.
- TODO/FIXME/HACK/XXX: 신설·변경 파일(`chat-channel-dedup.service.ts`/`.spec.ts`,
  `chat-channel.module.ts`, `hooks.service.ts`/`.spec.ts`) 전체에 0건.

## 발견사항

- **[INFO]** `spec/5-system/4-execution-engine.md` §9.1 Redis 키 네이밍 레지스트리(`{service}:{workspaceId}:{resource}:{id}:{sub}`)를 신규 `cc:dedup:<triggerId>:<updateId>` 키가 여전히 따르지 않는다(workspaceId 세그먼트 없음).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:6-9` (`makeChatDedupKey`)
  - 상세: 새 이슈가 아니라 형제 키 `cc:rl:<triggerId>:<conversationKey>` 와 동일한 기존 편차를 그대로 따른 것이며, `plan/in-progress/backend-lint-gate-broken-on-main.md` 가 이미 별도 항목(`convention_compliance INFO 4`)으로 추적 중이다. 이번 라운드에서 consistency-checker(`02_50_39` cross_spec)가 지적한 "PR #1160 병합 전까지 §9.1 위반 상태 유지"라는 처분도 `RESOLUTION.md`(`02_38_41`, 항목4)에 반영돼 있음을 확인했다 — 근거 없이 "이미 해소됨"이라 적었던 이전 오류가 정정된 상태.
  - 제안: 이번 PR 단독 조치 불요(기존 추적 항목에 편입). PR #1160 병합 여부만 후속 확인.

- **[INFO]** (재확인, 이미 acknowledged) developer 턴에서 `spec/5-system/15-chat-channel.md`·`spec/4-nodes/7-trigger/providers/telegram.md` 를 직접 수정 — CLAUDE.md 의 "`developer` 는 `spec/` read-only, 변경 필요 시 `project-planner` 위임" 규칙 이탈.
  - 위치: `spec/5-system/15-chat-channel.md:88`, `spec/4-nodes/7-trigger/providers/telegram.md:235`
  - 상세: 내용 자체(키 포맷·TTL·fail-open 서술)는 구현과 line-level 로 정확히 일치하고, `review/code/2026/08/13/02_38_41/RESOLUTION.md` WARNING #1 및 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "⚠️ 절차 이탈 기록" 단락에 이미 자체 인지·기록돼 있다(되돌리지 않기로 한 근거도 명시). 요구사항 충족 관점에서는 spec 내용이 정확해졌으므로 결함이 아니나, 절차 축(scope reviewer 담당)에서 이미 다뤄진 항목이라 중복 지적 없이 참고로만 남긴다.
  - 제안: 추가 조치 불요(이미 기록·처분됨).

- **[INFO]** `hooks.service.spec.ts` 상단에 `@nestjs/common` import 가 두 줄(기존 multi-import 블록 + 신규 `import { Logger } from '@nestjs/common';`)로 나뉘어 있다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:11` 부근 (`Logger` 단독 import)
  - 상세: eslint 통과·기능 영향 없는 스타일 이슈이며, `02_50_38` RESOLUTION 에서 이미 "다음에 그 블록을 만질 때 병합" 으로 유예 처분됨을 확인했다.
  - 제안: 추가 조치 불요(기존 유예 유지).

## 요약

`ChatChannelDedupService` 신설과 `HooksService.handleChatChannelWebhook` 배선은 CCH-SE-02(필수)
요구사항 — "동일 update_id 30초 안 재도착 무시" — 을 키 포맷·TTL·NX 원자성·fail-open(+warn)·
게이트 위치(parseUpdate 직후, rate-limit 앞) 전부 spec 본문과 line-level 로 정확히 구현한다.
반환값은 4개 경로(정상 최초/재도착/미가용/에러) 모두 정의돼 있고, 엣지 케이스(빈 idempotencyKey)는
Slack `view_submission` 의 실제 malformed-payload 경로에 대응하는 정당한 방어로 확인됐다. 서비스
단위 테스트와 `HooksService` 호출부 테스트가 "판정이 옳다"와 "그 판정을 실제로 소비한다"를 각각
분리해 dead-field 류 회귀(이번 작업의 발단이 된 결함 그 자체)를 실제로 재발 방지한다. 이전 두
리뷰 라운드와 consistency-check 라운드가 지적한 WARNING(CHANGELOG 파서 수치 오기, sibling spec
`telegram.md` stale, CCH-NF-03 spec-drift, data-flow 미러 누락, spec `## Rationale` 미기재, plan
절차 기록 누락)은 전부 이번 최종 diff 상태에서 실제 소스 대조로 조치 완료가 재확인됐다. CRITICAL
없음. 남은 항목(§9.1 Redis 키 네이밍, developer 의 spec 직접 수정, import 스타일)은 모두 이미
문서화·유예 처분된 기존 추적 항목이거나 절차 축(scope) 문제로, 요구사항 충족 자체를 저해하지 않는다.

## 위험도

LOW
