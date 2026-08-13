# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — CCH-SE-02 chat-channel update dedup

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 19개, id 목록: new-node · node-schema-change · new-ui-string ·
new-widget-chrome-string · integration-provider-change · new-userguide-section-dir · backend-api-change ·
new-bullmq-queue · new-warning-code · new-error-code · new-cross-cutting-enum · new-backend-ui-zod-value ·
new-handler-output-field · auth-session-flow-change · auth-config-type-enum-change ·
expression-language-change · run-debug-flow-change · env-runtime-change · spec-major-change ·
userguide-gui-flow-section · spec-defect-found) + `PROJECT.md` §127-198 (동일 표 + "자주 누락되는 항목") 을
보조로 Read.

## 변경 파일 식별
`git diff --name-only origin/main...HEAD` (review artifact 제외, 실제 코드/spec/plan 변경만):

```
CHANGELOG.md
codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts   (신규)
codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts        (신규)
codebase/backend/src/modules/chat-channel/chat-channel.module.ts               (DI 등록)
codebase/backend/src/modules/hooks/hooks.service.spec.ts
codebase/backend/src/modules/hooks/hooks.service.ts
plan/in-progress/backend-lint-gate-broken-on-main.md
spec/4-nodes/7-trigger/providers/telegram.md
spec/5-system/15-chat-channel.md
spec/conventions/redis-keys.md
spec/data-flow/14-chat-channel.md
```

나머지(파일 8~50, `review/code/**` · `review/consistency/**`)는 이전 리뷰 라운드(`02_38_41` ·
`02_50_38` · `09_09_58`)와 consistency-check(`02_38_42` · `02_50_39`) 산출물이며 코드/문서 변경
자체가 아니므로 trigger 매칭 대상에서 제외.

## trigger 매칭

- **`codebase/backend/src/nodes/**`** (new-node / node-schema-change) — 매칭 없음. 변경 파일은
  전부 `src/modules/chat-channel/**` · `src/modules/hooks/**` 이며 노드 디렉터리 밖.
- **`codebase/frontend/src/**/*.tsx`** (new-ui-string) — 매칭 없음. frontend 파일 변경 0건.
- **`codebase/channel-web-chat/src/**/*.tsx`** (new-widget-chrome-string) — 매칭 없음.
- **`codebase/frontend/src/content/docs/*/`** (new-userguide-section-dir) — 매칭 없음. 신규 섹션
  디렉터리 없음.
- **`**/*.controller.ts`, `**/dto/**`** (backend-api-change) — 매칭 없음. `hooks.controller.ts` 는
  이번 diff 에 없음(스키마 문서 확인용 `hooks.service.ts` 내부 그대로 재사용).
- **신규 warningCode/errorCode** (new-warning-code / new-error-code) — 매칭 없음.
  `chat-channel-dedup.service.ts` 의 실패 경로는 구조화된 warningCode/errorCode 가 아니라
  평문 `this.logger.warn('chat-channel update dedup 실패 …')` 호출이다
  (`codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:69-73`). `grep -rl
  "warningRules|WARNING_KO" src/modules/chat-channel src/modules/hooks` 결과 0건 — `warningRules`
  레지스트리도, `error-codes.ts` 의 `ErrorCode` enum 도 건드리지 않는다. `backend-labels.ts` 에도
  `CCH`/`dedup` 관련 항목 0건으로 확인, 매핑이 필요한 신규 코드가 없다.
- **`codebase/backend/src/modules/auth/**`** (auth-session-flow-change) — 매칭 없음. dedup 게이트는
  `chatChannelInboundAuthenticator.verify()`(기존, 미변경) **뒤**에서 동작하고 인증/세션/권한
  로직 자체는 건드리지 않는다.
- **`codebase/packages/expression-engine/**`** (expression-language-change) — 매칭 없음.
- **실행·디버깅 흐름 변경** (run-debug-flow-change, `05-run-and-debug/` 대상) — grey zone 검토:
  이 변경은 **워크플로우 실행 엔진**(노드 실행·디버그 로깅)이 아니라 그 앞단인 **webhook trigger
  intake** 단계(실행 시작 여부 게이트)다. 기존 rate-limit 게이트도 동일 계층에서 `05-run-and-debug/`
  갱신 없이 처리돼 온 선례이므로 매칭 아님으로 판단.
- **`spec/{2,3,4,5}-*/**`, `spec/conventions/**`** (spec-major-change, glob 매치) — **매칭**.
  `spec/4-nodes/7-trigger/providers/telegram.md` · `spec/5-system/15-chat-channel.md` ·
  `spec/conventions/redis-keys.md` 가 모두 glob 에 해당. `spec/5-system/15-chat-channel.md`
  frontmatter 확인 결과 `status: partial`, `code:` 글로브에 이미
  `codebase/backend/src/modules/chat-channel/**` 와 `hooks.service.ts` 가 포함돼 있어 신규
  `chat-channel-dedup.service.ts` 도 자동으로 커버되고, `pending_plans:` 도 비어있지 않다
  (`chat-channel-discord-gateway.md` 등 4건). 이 행의 verify 대상(`spec-frontmatter.test.ts` 등)은
  이미 같은 PR 안에서 `--impl-done` consistency-check 를 3라운드(`02_38_42`, `02_50_39` 및 그
  rebase 재검토 `09_09_58`) 돌려 `cross_spec`/`convention_compliance`/`plan_coherence` 관점으로
  검증됐고 전부 BLOCK:NO 로 수렴했다(`plan/in-progress/backend-lint-gate-broken-on-main.md` 의
  "실측 3개 파일" 정정 기록 포함). User-guide-sync reviewer 고유 관점(docs MDX·dict·backend-labels)
  에서 추가로 걸리는 갭은 없음 — INFO 로만 기록.
- **통합 신규/제공자 변경** (integration-provider-change, semantic) — grey zone 검토:
  `codebase/frontend/src/content/docs/06-integrations-and-config/{telegram,slack,discord}.{mdx,en.mdx}`
  가 실존하고 이 PR 이 정확히 telegram/slack/discord 공통 inbound 경로(재도착 억제)의 동작을
  바꾼다. 다만 provider 어댑터 코드(`providers/telegram/*`, `providers/slack/*`,
  `providers/discord/*`) 자체나 설정/인증 스키마는 이번 diff 에서 전혀 건드리지 않았고, 사용자가
  설정 화면에서 바꿀 수 있는 옵션도 신설되지 않았다 — 순수 서버 내부 신뢰성 동작(중복 웹훅 억제)
  이라 "제공자 변경"의 통상 의미(신규 provider·인증 방식·설정 필드)와는 결이 다르다. 다만
  `slack.mdx:185` 트러블슈팅 표에 "Slack 이 retry 폭주 (`dispatch_failed`)" 항목이 이미 존재해
  이 신규 dedup 이 그 시나리오의 실제 동작(30초 내 동일 update 재도착은 이제 조용히 무시됨)에
  영향을 준다 — 문서가 잘못된 것은 아니지만 보강 여지가 있는 grey zone. INFO 로 기록.

## 발견사항

- **[INFO]** `slack.mdx`/`slack.en.mdx` 트러블슈팅 표의 "Slack 이 retry 폭주" 항목이 신규 dedup
  동작을 반영하지 않음
  - 변경 파일: (간접) `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts`,
    `codebase/backend/src/modules/hooks/hooks.service.ts:328-345`
  - 매트릭스 항목: `integration-provider-change` — "`codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키"
  - 관련 기존 문서: `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx:185`
    ("Slack 이 retry 폭주 (\"dispatch_failed\") | 3초 이내 ack 실패. backend latency 점검 —
    `chat_channel_health` 가 `degraded` 면 외부 API 호출 자체 실패 가능")
  - 상세: 이번 PR 은 telegram/slack/discord 공통 inbound 경로에 `SET NX EX 30` 기반 재도착 억제를
    추가했다. 이제 provider 가 ack 지연으로 같은 update 를 30초 안에 재전송하면 그 재도착은
    rate-limit 게이트보다 앞에서 조용히 흡수돼 `chat_channel_health` 에 영향을 주지 않는다.
    기존 트러블슈팅 문구는 "재전송 = degraded 원인 후보"로만 안내하는데, 신규 dedup 이후에는 같은
    update 의 단순 재전송만으로는 이제 이 시나리오에 덜 기여한다(진짜 API 실패로 인한 반복
    handshake/새 이벤트만 여전히 유효). 사용자가 이 표를 보고 원인을 추정할 때 미묘하게 어긋날 수
    있는 grey zone — 문서가 "틀렸다"고 보기는 어렵고(여전히 3초 ack 실패가 근본 원인), dedup 계층의
    존재를 언급하면 더 정확해지는 수준.
  - 제안: 급하지 않음. 다음에 `slack.mdx`/`slack.en.mdx` 트러블슈팅 표를 만질 때 "동일 update
    30초 재도착은 이제 dedup 으로 무시됨 — 그래도 반복 발생하면 backend latency 문제" 정도의
    한 줄 보강을 고려. telegram/discord 쪽에는 이 표가 없어 해당 없음.

- **[INFO]** `spec-major-change` 매트릭스 행(glob 매치: `spec/5-system/15-chat-channel.md`,
  `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/conventions/redis-keys.md`)은
  frontmatter `code:`/`status:`/`pending_plans:` 정합을 요구하지만, 이 PR 은 이미 `--impl-done`
  consistency-check 를 3라운드(`review/consistency/2026/08/13/02_38_42`,
  `review/consistency/2026/08/13/02_50_39` + rebase 재검토 `09_09_58`) 거쳐 `cross_spec` ·
  `convention_compliance` · `plan_coherence` 관점으로 이미 검증됐고 전부 BLOCK:NO 다. 이 관점은
  본 리뷰어(user-guide-sync)의 핵심 관할(docs MDX·i18n dict·backend-labels)보다는
  consistency-checker 의 관할에 가까우며, 그쪽에서 이미 반복 검증됨 — 추가 조치 불요, 참고 기록만.

- **[INFO]** `chat-channel-dedup.service.ts`/`hooks.service.ts` 자체는 매트릭스의 핵심 CRITICAL
  trigger(신규 노드, TSX 신규 문자열, warningCode/errorCode 발행, 신규 섹션 디렉터리) 어디에도
  해당하지 않음을 직접 확인 — `grep -rl "warningRules|WARNING_KO" src/modules/chat-channel
  src/modules/hooks` 0건, `backend-labels.ts` grep `"CCH|dedup|Dedup"` 0건, frontend/channel-web-chat
  파일 변경 0건. i18n parity 위반·backend-labels 매핑 누락·locale 등록 누락 등 CRITICAL 급 결함
  없음.

## 요약

매트릭스 19개 trigger 중 명확히 매칭된 것은 glob 기반 `spec-major-change`(spec 파일 3건) 1개뿐이며,
그 항목은 이미 별도 consistency-check 3라운드로 검증 완료됐다. Semantic trigger 인
`integration-provider-change`(telegram/slack/discord 06-integrations-and-config 문서)는 grey zone —
provider 어댑터·설정 스키마는 안 건드리고 순수 내부 신뢰성 동작만 바뀌어 필수 갱신으로 보기는
어렵지만, `slack.mdx` 트러블슈팅 표 한 줄이 신규 dedup 동작을 반영하면 더 정확해지는 여지가 있어
INFO 로 남긴다. 이 PR 은 `codebase/backend/src/nodes/**`·frontend TSX·`channel-web-chat` TSX·신규
문서 섹션·controller/DTO·auth 모듈·expression-engine·warningRules/error-codes.ts 어디에도 손대지
않아 CRITICAL/WARNING 급 "유저 가이드 동반 갱신 누락"은 발견되지 않았다.

## 위험도

LOW
