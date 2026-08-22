# 정식 규약 준수 검토 — `spec/4-nodes/7-trigger/`

## 검토 방법 메모 (중요 — 판정에 영향)

전달된 `_prompts/convention_compliance.md` 번들은 context 예산 초과로 `spec/conventions/**`
대부분(약 45개 파일 중 `audit-actions.md` · `error-codes.md` · `node-cancellation.md` 3개를
제외한 전부, 특히 이 target 과 직결된 `chat-channel-adapter.md`(46,835자) ·
`node-output.md`(25,670자) · `conversation-thread.md`(78,317자) · `secret-store.md`(18,970자) ·
`interaction-type-registry.md`(15,909자))가 `"본문 생략됨 — 컨텍스트 예산 초과"` 로 절단되어
있었다. 번들만으로는 이 target 을 제대로 검토할 수 없었으므로, 본 검토는 번들을 신뢰하지 않고
`spec/conventions/**` 및 `spec/4-nodes/7-trigger/**` 원본 파일을 파일시스템에서 직접 읽어
수행했다. 아래 발견사항은 그 직접 대조 결과다. (참고: 이 truncation 자체는 기존에 알려진
harness 예산 이슈이며 이번 target 문서의 결함이 아니다 — 단, 이 checker 가 번들만 신뢰하고
직접 읽기를 생략했다면 `chat-channel-adapter.md`/`node-output.md` 대조 전체가 누락되는
거짓 음성(false negative)이 났을 것이므로 기록해 둔다.)

---

## 발견사항

### [WARNING] `1-manual-trigger.md` §6 이 명시한 SoT 파일이 frontmatter `code:` 어느 쪽에도 없음

- **target 위치**: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 "에러 코드" 표
  (Manual re-run 행) + 그 아래 인용 각주 2곳(2026-08-20 배선 교정 서술)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 필드 정의
  ("본 spec 이 약속한 surface 의 구현 경로")
- **상세**: §6 표는 "Manual re-run (inputOverride)" 400 응답의 처리 위치를
  `executions.service.ts` (= `codebase/backend/src/modules/executions/executions.service.ts`,
  실존 확인함) 로 **두 곳에서 명시**한다 — 표의 한 행 + 그 아래 각주("그전까지
  `executions.service.ts` 는 내부 reason 을 `errors` 키로 던졌고 …"). 그런데 이 파일은
  `1-manual-trigger.md` 자신의 frontmatter `code:` 에도, sibling `0-common.md` 의 `code:`
  에도 등재되어 있지 않다. 두 frontmatter 모두 `hooks.service.ts` / `schedule-runner.service.ts`
  / `workflows.controller.ts` 등 §6 표의 다른 행이 가리키는 파일은 (0-common.md 쪽에)
  정확히 등재해 두었으므로, `executions.service.ts` 만 빠진 것은 패턴 적용 누락으로 보인다.
  `status: implemented` 라 build 가드(`spec-code-paths.test.ts`)는 `code:` glob ≥1 매치만
  요구해 이미 통과 상태이므로 CI 는 이 누락을 잡지 못한다 — 즉 **가드 미검출 지대**의
  실제 사례다.
- **제안**: `1-manual-trigger.md` (또는 `0-common.md`) frontmatter `code:` 에
  `codebase/backend/src/modules/executions/executions.service.ts` 추가. 현재 진행 중인
  "masked-marker-cosmetic-followups" 작업이 이 파일의 형제 표면인
  `codebase/backend/src/modules/executions/dto/re-run.dto.ts` 의 Swagger 설명을 바로 이번에
  손대므로(마커 재제출 거부 계약을 문서화하는 지점), 같이 등재하면 이후 spec-coverage 대조
  때 drift 를 줄인다.

### [INFO] Rationale 서브섹션 ID 네이밍이 provider 3파일 간 불일치

- **target 위치**: `providers/discord.md` `## Rationale` (`R-D-1` ~ `R-D-9`) ·
  `providers/slack.md` `## Rationale` (`R-S-1` ~ `R-S-9`) ·
  `providers/telegram.md` `## Rationale` (`R1` ~ `R5`, provider prefix 없음)
- **위반 규약**: 명시적 규약은 없음(참고용 INFO) — `spec/conventions/chat-channel-adapter.md`
  자체는 `R-CCA-<n>` 접두 패턴을 쓰고, 후발 provider 문서(discord/slack)는 `R-<provider>-<n>`
  으로 그 패턴을 계승했다. telegram.md 만 접두 없는 `R<n>` 을 유지하고 있어 3-provider 세트
  내에서 스타일이 갈린다.
- **상세**: 기능적 문제는 없다(다른 문서가 telegram 의 `R1`~`R5` 앵커를 상호참조하는 곳은
  없음을 확인). 다만 `providers/_overview.md` §신규 provider 추가 절차가 "telegram.md 와 동일한
  8섹션 + Rationale 구조 채택" 을 표준으로 지목하고 있어, 향후 4번째 provider 를 추가할 때
  discord/slack 의 `R-<provider>-N` 패턴과 telegram 의 무접두 패턴 중 무엇을 따라야 하는지
  불명확해질 수 있다.
- **제안**: 우선순위 낮음. 다음에 telegram.md 를 편집할 기회에 `R1`→`R-T-1` 식으로
  맞추거나, 혹은 discord/slack 쪽이 예외였다면 그 반대로 통일. 이번 cosmetic followups
  범위에 넣을 필요는 없다.

---

## 확인 완료 — 위반 아님 (기록용)

작업 범위와 밀접해 특히 주의 깊게 대조했으나 **정합했던** 항목들:

- `1-manual-trigger.md` §6 의 내부 사유 코드(`missing_required`/`coerce_failed`/
  `invalid_schema`/`masked_value_resubmitted`) → 정규화 public 코드
  (`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/
  `MASKED_VALUE_RESUBMITTED`) 매핑은 `spec/conventions/error-codes.md` §4.2 표와
  1:1 일치 (두 문서 모두 2026-08-20~22 인접 시점에 함께 갱신된 흔적 — cross-link 도 상호
  정확).
- `1-manual-trigger.md` / `0-common.md` 의 5필드(`config`/`output`/`meta?`/`port?`/`status?`)
  invariant, JSON 예시의 `undefined` 필드 생략, `port: undefined` 단일-출력 표기는
  `node-output.md` Principle 0/5/11 과 정합. 금지 패턴(`output.output.*` /
  `output.metadata.tokens` / `_multiTurnState` / `output.submittedData` /
  `output.view.type`) 은 target 어디에도 없음(grep 0건).
- `config.parameters`(스키마) vs `output.parameters`(런타임 값) 직교성 서술은
  `node-output.md` Principle 1.1 과 정확히 정합, echo 금지 규칙도 위반 없음.
- `providers/discord.md` · `slack.md` · `telegram.md` frontmatter 의 `user_guide:`
  필드 — 최초 훑어볼 때 discord/slack 에 이 필드가 없는 것으로 오판할 뻔했으나(코드 경로
  나열이 길어 `head -15` 로 잘렸을 뿐), 전체를 다시 읽어 discord.mdx/discord.en.mdx ·
  slack.mdx/slack.en.mdx 모두 `user_guide:` 에 로케일 쌍으로 정확히 등재되어 있음을
  확인했다 — telegram.md 와 패턴 동일. (오판을 여기 기록해 두는 이유: 같은 착시가 재발하지
  않도록.)
- `chat-channel-adapter.md` 가 정의하는 `ChatChannelAdapter` 인터페이스 필수 메서드
  (`setupChannel`/`teardownChannel`/`parseUpdate`/`renderNode`/`ackInteraction`/
  `escapeControlText`/`supportsNativeForm`) 언급 밀도는 discord/slack/telegram 세 문서
  모두 유사(12~22회) — 인터페이스 커버리지 편차 없음.
- `providers/_overview.md` §4 provider 식별자 컨벤션(lower-case kebab-case) — `telegram`
  `slack` `discord` 모두 준수.
- `chat-channel-adapter.md` 의 `R-CCA-5`~`R-CCA-8` 앵커는 실제로 해당 문서에 존재하며,
  provider 문서들의 인용 링크가 정확히 착지함(dangling anchor 없음).
- `0-common.md`/`1-manual-trigger.md` frontmatter 의 나머지 `code:` 경로
  (`manual-trigger.handler.ts` · `manual-trigger.schema.ts` ·
  `resolve-trigger-parameters.ts` · `reject-masked-resubmission.ts` ·
  `trigger-parameter.types.ts` · `hooks.service.ts` · `schedule-runner.service.ts` ·
  `workflows.controller.ts` · `workflows.service.ts` · `error-codes.ts`) 는 전부 실존 파일과
  일치 (stale path 없음).
- 문서 구조(Overview/본문/Rationale) — `1-manual-trigger.md` 류 개별 노드 문서가
  `## Overview` 헤딩 없이 서론 문단으로 시작하는 것은 `spec/4-nodes/**` 전역 44개 문서의
  기존 패턴과 동일(프로젝트 전체 관례 — `spec/4-nodes/_product-overview.md` 가 영역
  Overview 를 별도 소유하는 구조, project-planner SKILL.md §명명 컨벤션과 정합). 반면
  provider 문서(discord/slack/telegram) 는 각자 `## Overview (제품 정의)` 절을 명시적으로
  갖는데, provider 별로 제품 시나리오가 크게 달라 공유 `_product-overview.md` 로 뽑기
  어려운 성격이라 합리적 설계로 판단.

---

## 요약

target(`spec/4-nodes/7-trigger/**`)은 `node-output.md`(5필드/echo/직교성 원칙)와
`error-codes.md`(§4.2 trigger 파라미터 사유 정규화)를 정밀하게 준수하고 있고, 최근
마커 재제출 거부 시리즈(#1188~#1193)의 spec 갱신이 두 conventions 문서와 시간적으로도
내용적으로도 잘 맞물려 있다. 유일한 실질 결함은 WARNING 1건 — `1-manual-trigger.md` §6
이 스스로 지목한 SoT 파일(`executions.service.ts`)이 frontmatter `code:` 추적 목록에서
빠져 있는 traceability gap이며, build 가드를 통과하지만(다른 경로로 이미 ≥1 매치) 이번
작업이 바로 그 인접 표면(`re-run.dto.ts`)을 만지므로 지금 고치는 비용이 낮다. 나머지는
INFO 1건(provider 간 Rationale ID 네이밍 스타일 불일치, 기능 영향 없음)뿐이다. 이 판정을
번들 그대로 신뢰했다면 `spec/conventions/**`의 90% 이상이 절단되어 있어 `chat-channel-adapter.md`
등 핵심 규약과의 대조 자체가 누락됐을 것 — 원본 파일을 직접 읽어 보완했다는 점을 밝혀 둔다.
Critical 은 0건이므로 구현 착수를 막을 사유는 없다.

## 위험도

LOW
