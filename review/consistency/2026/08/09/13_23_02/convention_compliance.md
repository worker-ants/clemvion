# 정식 규약 준수 검토 — `spec/7-channel-web-chat/`

## 0. 선행 확인 — diff 범위 불일치 (중요)

본 검토는 `--impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main` 로 호출됐으나, 실제
`git diff origin/main` 결과 **이 브랜치(`claude/ci-required-check-skip-jobs-42f5d8`)는
`spec/7-channel-web-chat/**` 를 전혀 건드리지 않는다**:

```
git diff origin/main --stat -- spec/7-channel-web-chat/   → (출력 없음, 변경 0)
git diff origin/main --stat                                → CI 워크플로/pnpm-workspace/plan/review 산출물만 변경
codebase/channel-web-chat 관련 diff                          → package.json 1줄(버전 핀) 뿐
```

`spec/7-channel-web-chat/1-widget-app.md` 등 6개 문서는 이미 `origin/main` 에 머지된 상태(마지막 관련
커밋 `5de44d4d6 fix(web-chat): replay_unavailable 소비 배선 + 세션 staleness 가드 worldGen 단일화 (#964)`)이며
본 브랜치의 실제 작업 대상은 CI required-check skip-jobs 관련 harness 변경이다.

→ 이는 과거에도 관측된 harness 번들링 결함 클래스(오케스트레이터가 diff 와 무관한 spec 영역을 impl-done
프롬프트에 잘못 번들)와 동일 패턴이다. 아래 §1~§5 는 **번들된 문서 자체의 정식 규약 준수 여부**를
문서 내용 기준으로 평가한 것이며, "본 PR 이 이 위반을 도입했다"는 주장이 아니다 — 실제로 이 PR 은
해당 spec 을 변경하지 않았다.

---

## 1. 검토 결과 — 문서 내용 기준

`spec/7-channel-web-chat/{_product-overview,0-architecture,1-widget-app,2-sdk,3-auth-session,4-security,5-admin-console}.md`
6+1개 문서를 전문 읽고, 직접 관련된 정식 규약 — `spec/conventions/swagger.md` · `conversation-thread.md` ·
`i18n-userguide.md` · `error-codes.md` · `interaction-type-registry.md` — 과 대조했다.

### 1.1 명명 규약
- frontmatter `id:` 는 전 문서 `web-chat-<topic>` 패턴으로 일관(`web-chat-widget-app`/`web-chat-sdk`/
  `web-chat-auth-session`/`web-chat-security`/`web-chat-architecture`/`web-chat-admin-console`).
  `4-security.md` 의 `id: web-chat-security` 는 basename(`4-security`)과 의도적으로 다른데, 문서 자체가
  그 이유(타 영역 `4-security` 슬러그 충돌 방지)를 frontmatter 주석으로 명시해 규약 위반이 아니라
  의도된 예외로 self-documenting 되어 있다.
- 에러 코드(`WEBCHAT_IDLE_TIMEOUT`, `EXECUTION_NOT_FOUND`, `STATE_MISMATCH`)는 `UPPER_SNAKE_CASE` +
  의미 기반 명명으로 [`error-codes.md §1`](../../../../spec/conventions/error-codes.md) 원칙과 정합. 신규
  코드 발명이 아니라 EIA 기존 코드 인용이다.
- `EmbedConfigDto`(`codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts`)는
  `dto/responses/*-response.dto.ts` 위치·`*Dto` 접미사·JSDoc 필드 주석·`ApiOkWrappedResponse` 사용까지
  [swagger.md §5-1·§2-5](../../../../spec/conventions/swagger.md) 를 그대로 따른다.

### 1.2 출력 포맷 규약
- `TransformInterceptor` `{ data }` 래핑을 모든 REST 응답 서술에서 일관되게 언급(§3 세션 시퀀스,
  §3-① embed-config, §R5 언랩 폴백 등) — [api-convention §5.1](../../../../spec/5-system/2-api-convention.md)/
  [swagger.md §2-5](../../../../spec/conventions/swagger.md) 와 정합.
- SSE wire 필드명이 notification 추상 표기(`node.id`/`context.*`)와 다르다는 점(`waitingNodeId`/
  top-level `interactionType` 등)을 `0-architecture.md §3` 이 **명시적으로 각주 처리**하고 코드 SoT
  (`eia-events.ts`)를 지목 — 관례에서 벗어나는 지점을 숨기지 않고 규약 문서화 원칙에 맞게 노출했다.
- `conversation-thread.md §1.1` 의 backend 5-source enum(`presentation_user`/`ai_user`/`ai_assistant`/
  `ai_tool`/`system`) → 말풍선 role 축약 매핑(`1-widget-app.md §2` 메시지 리스트 행)이 SoT 값과 정확히 일치.
  `turn.presentations[]` 가 `source: 'ai_assistant'` 한정이라는 제약(§2.1)도 위젯 스펙 R8 이 정확히 인용.

### 1.3 문서 구조 규약
- 6개 문서 모두 `## Overview` → 번호 섹션 본문 → `## Rationale` 3섹션 구조를 따른다(`0-architecture.md`
  §Overview 확인, `1-widget-app.md` 등 동일).
- `_product-overview.md` 는 다른 영역의 `_product-overview.md`(2-navigation/3-workflow-editor/4-nodes/
  5-system/4-nodes/4-integration/4-nodes/3-ai)와 동일하게 `## Overview` 헤더 없이 본문 섹션으로 직행하는
  기존 패턴을 따르며, 오히려 다른 `_product-overview.md` 들에는 없는 `## Rationale` 절까지 추가로 갖춰
  권장 3섹션 구조에 더 근접한다 — 위반 아님.
- `0-architecture.md` 의 `0-` prefix 는 `spec/2-navigation/0-dashboard.md`·`spec/3-workflow-editor/
  0-canvas.md`·`spec/4-nodes/0-overview.md` 와 동일하게 "영역 폴더 내 진입 문서" 관례를 따른 것으로,
  CLAUDE.md 가 말하는 루트 `spec/0-overview.md` 의 `0-` prefix 와는 별개 계층의 기존 관례이며 신규 일탈이 아니다.

### 1.4 API 문서 규약
- 코드 레벨에서 확인한 `EmbedConfigDto`(§1.1)는 swagger.md 패턴 100% 준수. 다른 backend 표면(예:
  `PublicWebhookThrottleGuard`, `WebChatIdleReaperService`)은 본 spec 문서에서 서비스명만 인용하고
  Swagger 데코레이터 세부는 각 서비스 소속 API 문서(webhook/EIA)에 위임 — 책임 분리가 정확하다.

### 1.5 금지 항목
- swagger.md §1-4 "닫힌 union 을 `additionalProperties` 로 뭉개지 않는다" 규칙과 관련해, 본 spec 은
  EIA `context`/`conversationThread` 를 DTO 로 재선언하지 않고 SoT 문서(`node-output.md`/
  `conversation-thread.md`)만 참조하도록 명시(§2 표) — swagger.md 가 규정한 "SoT 이중화 회피" 예외
  경로(§1-4 "형태는 고정이나 SoT 이중화 회피로 여는 경우")와 정확히 같은 근거로 열려 있어 금지 패턴
  답습이 아니다.
- i18n-userguide.md 의 위젯 carve-out(적용 범위 §)과 본 spec §4/`5-admin-console.md §8` 의 서술이
  문장 단위로 상호 인용하며 완전히 정합한다(위젯 로컬 catalog vs 메인 앱 dict, chrome-only 범위,
  Principle 6 공유, dev-only 시뮬레이터 P6 예외). 금지 패턴(TSX 하드코딩 한국어 직접 노출 등) 관련 서술
  없음.

CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다. 아래는 참고용 INFO 뿐이다.

---

## 발견사항

- **[INFO]** 검토 범위와 실제 diff 의 불일치
  - target 위치: 전체(`spec/7-channel-web-chat/**` 번들)
  - 위반 규약: 해당 없음(정식 규약 위반이 아니라 오케스트레이터 diff-scope 산출 문제)
  - 상세: `--impl-done, diff-base=origin/main` 모드로 호출됐으나 `git diff origin/main -- spec/7-channel-web-chat/` 결과가 비어 있다. 이 브랜치는 CI required-check skip-jobs 관련 harness 변경이 실제 작업이며, channel-web-chat spec/코드는 이미 `origin/main` 에 머지된 상태(§0)다.
  - 제안: 통합 SUMMARY 산출 시 본 checker 의 발견을 "이번 PR 이 도입한 위반"으로 집계하지 말 것. 오케스트레이터의 spec-bundle 산출 로직이 diff 와 무관한 영역을 번들하는 사례가 반복되면 `.claude/skills/consistency-checker/` 쪽의 대상 파일 산출 스크립트를 diff 교집합 기준으로 재검토할 필요가 있다(별도 harness 이슈, 본 세션 범위 밖).

- **[INFO]** `codebase/packages/web-chat-sdk` 디렉토리명과 npm 패키지명(`@workflow/web-chat`) 불일치
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` 목록 / `_product-overview.md §4` 표 B행
  - 위반 규약: 명시적 규약 없음 — 참고용 일관성 제안
  - 상세: 폴더는 `web-chat-sdk` 인데 배포 패키지명은 `@workflow/web-chat` 로 확정되어(`eia-sdk-publish.md §결정 #3`) 있다. 다른 `@workflow/*` 패키지들의 폴더-패키지명 매핑 관례와 대조가 필요할 수 있으나, spec 은 이미 두 이름을 명확히 구분해 서술하고 있어 혼동 소지는 낮다.
  - 제안: 조치 불요(정보 제공 목적). 폴더 rename 이 필요하다고 판단되면 별도 planner 턴에서 검토.

## 요약
`spec/7-channel-web-chat/` 6개 기술 문서(`_product-overview`/`0-architecture`/`1-widget-app`/`2-sdk`/
`3-auth-session`/`4-security`/`5-admin-console`)를 전문 검토한 결과, 명명·출력 포맷·문서 구조·API 문서·
금지 항목의 5개 관점 모두에서 `spec/conventions/`(swagger.md·conversation-thread.md·
i18n-userguide.md·error-codes.md·interaction-type-registry.md)와 정합했고 CRITICAL/WARNING 급 위반은
발견되지 않았다. 다만 본 검토가 호출된 `--impl-done` 모드의 diff-base(`origin/main`) 기준으로 확인한
결과, 이 브랜치(`claude/ci-required-check-skip-jobs-42f5d8`)의 실제 변경분은 `spec/7-channel-web-chat/`
을 전혀 포함하지 않는다 — 대상 spec 은 이미 origin/main 에 머지된 기존 문서다. 따라서 이번 PR 맥락에서는
"신규 위반 없음" 으로 판정하되, 검토 대상 산출 자체가 diff 와 무관했다는 프로세스 사실을 통합 SUMMARY 에
반영해야 한다.

## 위험도
NONE
