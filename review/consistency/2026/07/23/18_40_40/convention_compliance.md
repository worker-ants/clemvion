# 정식 규약 준수 검토 — spec/4-nodes/6-presentation

## 검토 범위·방법

- target: `spec/4-nodes/6-presentation/{0-common,1-carousel,2-table,3-chart,4-form,5-template}.md`
- 대조 대상: `spec/conventions/node-output.md`, `spec/conventions/conversation-thread.md`,
  `spec/conventions/interaction-type-registry.md`, `spec/conventions/swagger.md`,
  `spec/conventions/spec-impl-evidence.md`, `spec/conventions/error-codes.md`
- `git diff origin/main -- spec/4-nodes/6-presentation` 결과 **변경 없음** — 이번 세션 diff 대상이
  아니라 현재 HEAD 워킹트리에 이미 커바된 상태에 대한 standing 준수 감사로 처리했다. frontmatter
  `code:` 경로는 워킹트리에서 전부 실존 확인(존재/glob 매치)했고, 스펙이 인용하는 함수·상수
  (`backfillButtonUuids`, `backfillFormOptionValues`, `MAX_BUTTONS_PER_NODE`,
  `PRESENTATION_MAX_BYTES`, `normalizeNodeButtonIds`)도 코드에서 직접 확인했다 — 모두 스펙 서술과 일치.

---

## 발견사항

### [CRITICAL] §4.6 `excludeFromConversationThread` — presentation 5 노드 어디에도 미구현, conversation-thread.md 와 직접 모순

- target 위치: `spec/4-nodes/6-presentation/0-common.md` §4.6 "Conversation Thread opt-out (공통)"
  (라인 197-209)
- 위반 규약:
  - `spec/conventions/spec-impl-evidence.md` §3 — frontmatter `status: implemented` 는 "모든 약속
    구현 완료" 를 의미해야 한다.
  - `spec/conventions/conversation-thread.md` §2.4 "opt-out" — 이 필드의 단일 진실을 **명시적으로
    "3 노드 공통 공유 fragment"(AI 3종 전용)** 로 선언한다.
- 상세:
  1. `0-common.md` §4.6 은 "Presentation 5 노드 (Carousel / Table / Chart / Form / Template) 모두
     공통으로 `excludeFromConversationThread` boolean config 필드를 가진다 … UI 그룹:
     `Advanced > Conversation`" 라고 명문화한다. 이 문서의 frontmatter 는 `status: implemented`.
  2. 그러나 `codebase/backend/src/nodes/presentation/{carousel,table,chart,form,template}.schema.ts`
     어디에도 `excludeFromConversationThread` 필드 선언이 없다(전수 grep 확인, 0건). 5개 노드의
     config echo(`configEcho`/`{ ...rawConfig }`)에도 이 필드가 존재하지 않는다.
  3. `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts` 의 docstring 은
     "AI Agent / Text Classifier / Information Extractor **3 노드** schema 가 동일한 …
     `excludeFromConversationThread` 5 필드를 갖는다" 라고 **명시적으로 AI 3종 한정**이며, UI 그룹
     상수는 `GROUP = 'Conversation Context'` (0-common.md §4.6 이 주장하는
     `Advanced > Conversation` 과도 다른 값).
  4. `spec/4-nodes/3-ai/0-common.md` §10 도 "AI 카테고리 3 노드 공통 규약" 이라고 동일 필드를
     3-AI-노드 전용으로 재확인한다.
  5. 엔진 opt-out 게이트(`ConversationThreadService.isOptedOut` →
     `node.config?.excludeFromConversationThread === true`)는 source 종류와 무관하게 generic 하게
     동작하므로 *메커니즘 자체*는 어떤 노드에도 적용 가능하지만, presentation 노드 zod schema 에
     필드가 없어 (a) 자동 생성 UI 에 토글이 노출되지 않고 (b) 워크플로우 저장 config 에도 이 값이
     실릴 경로가 없다 — 즉 "구현됐다"고 부를 수 있는 사용자 도달 가능 기능이 아니다.
  6. 결과적으로 presentation 0-common.md §4.6 은 (i) `status: implemented` 요건(spec-impl-evidence
     §3)을 충족하지 못하는 미구현 기능을 기정사실처럼 서술하고 있으며, (ii) 그 서술이 정작 필드의
     실제 단일 진실 문서인 conversation-thread.md §2.4 / AI 0-common.md §10 의 "AI 3 노드 전용"
     선언과 정면으로 모순된다.
- 제안: 다음 중 하나로 정정.
  - (a) presentation 5 노드에 실제로 `excludeFromConversationThread` 를 구현(schema 필드 + UI 노출)한
    뒤 §4.6 을 유지하고 frontmatter `code:` 에 해당 스키마 파일을 추가한다.
  - (b) 아직 미구현이면 §4.6 을 삭제하거나 "Planned" 로 격하하고, frontmatter 를 `status: partial` +
    `pending_plans:` 로 낮추거나(0-common.md 전체를 partial 로 내리는 대신 §4.6 만 별도 plan-linked
    절로 표시), conversation-thread.md §2.4 의 "3 노드 전용" 서술과 재정합한다.
  - 어느 쪽이든 두 문서(§4.6 vs conversation-thread §2.4 / AI 0-common §10) 의 "몇 개 노드가 이 필드를
    갖는가" 서술을 한 곳으로 통일해야 한다.

### [WARNING] `form.handler.ts` 의 config echo 가 node-output.md §7 D1 "금지" 스프레드 패턴을 사용

- target 위치: `spec/4-nodes/6-presentation/4-form.md` §5 출력 구조 표 (`config.title` 등 —
  "config echo (Principle 7)" 로 인용), 배경 코드 `codebase/backend/src/nodes/presentation/form/form.handler.ts:42-44`
- 위반 규약: `spec/conventions/node-output.md` §7 "`config` echo 구현 방식 — 명시 enumeration 의무화
  (D1)" — "❌ 금지 — spread 패턴: `{ ...context.rawConfig }` … 형태로 echo 하지 않는다."
- 상세: `form.handler.ts` 는 `config: { ...rawConfig }` (전체 raw config 무조건 spread)로 echo 한다.
  같은 카테고리의 나머지 4개 핸들러(`carousel.handler.ts`, `table.handler.ts`, `chart.handler.ts`,
  `template.handler.ts`)는 모두 `configEcho` 라는 이름의 **명시 키 열거 객체**를 쓰며,
  `carousel.handler.ts` 에는 "future credential-shaped fields can't slip in via spread" 라는 주석까지
  달려 D1 위반을 의도적으로 피하고 있다. Form 핸들러만 이 패턴에서 예외로 남아 있다. 현재
  `formNodeConfigSchema` 에 자격증명류 필드는 없어 즉시 credential leak 은 없지만, node-output.md
  가 명시한 세 가지 금지 사유(① 향후 민감 필드 추가 시 자동 노출, ② 회귀 감지 곤란 — 실제로
  `carousel`/`table`/`chart`/`template` 는 `background.handler.spec.ts` 류의 credential-leak 가드
  테스트 baseline 을 따르지만 `form.handler.spec.ts` 에는 그런 가드 테스트가 없다, ③ dead field
  echo)는 그대로 유효한 리스크다. spec 자체(§5 표)는 "config echo (Principle 7)" 라고만 적고
  D1(스프레드 금지) 위반 여부까지는 서술하지 않아 spec 문서 텍스트 자체의 규약 위반은 아니지만,
  spec 이 SoT 로 인용하는 구현이 규약을 어기고 있다.
- 제안: `form.handler.ts` 도 나머지 4개 핸들러와 동일하게 `configEcho = { title, description,
  submitLabel, fields }` 명시 열거로 교체. 겸사겸사 credential-leak 가드 테스트(빈 스키마라도
  향후 필드 추가 시 자동 통과하지 않도록 하는 회귀 테스트)를 `form.handler.spec.ts` 에 추가하는 편이
  일관적이다.

### [INFO] §10.9 `action.type` 4값 sentinel — `interaction-type-registry.md` 매트릭스 등재 여부 애매

- target 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 "`processAiResumeTurn` dispatch 4
  케이스 명시 매칭"
- 관련 규약: `spec/conventions/interaction-type-registry.md` — cross-cutting enum 값의 단일 진실 +
  처리 분기 매트릭스를 강제하는 문서. frontmatter `code:` 에 이미 `resume-turn-dispatch.ts` /
  `park-entry-dispatch.ts` 등 §10.9 가 언급하는 동일 파일들을 포함하고 있어 인접 도메인이다.
- 상세: §10.9 가 도입하는 `action.type` (`ai_end_conversation` / `ai_message` / `form_submitted` /
  `button_click`) 4값은 본문이 스스로 "단일 함수(`processAiResumeTurn`) 안의 4-case 명시 매칭"이라고
  기술하므로 interaction-type-registry.md 가 다루는 "N개 분기 위치에 흩어지는 enum" 문제와는 성격이
  다르다 — 반드시 등재 의무가 있다고 보긴 어렵다. 다만 registry 문서의 code 목록이 이미 같은 파일들을
  가리키고 있어, 향후 이 sentinel 이 여러 소비처로 퍼질 경우 등재 필요성이 커진다는 점만 남겨둔다.
- 제안: 즉시 조치 불요. 향후 `action.type` 소비처가 2곳 이상으로 늘어나면
  `interaction-type-registry.md` 에 항목 추가를 검토.

---

## 확인 결과 (위반 아님 — 정합 확인)

- 문서 구조(Overview/본문/Rationale): `spec/4-nodes/6-presentation/*.md` 는 별도 `## Overview` 헤더가
  없지만, project-planner SKILL.md 의 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"
  규칙대로 `spec/4-nodes/_product-overview.md#9-presentation-노드-5종` 로 Overview 책임을 위임하는
  패턴이며, 이는 `1-logic`/`2-flow`/`5-data`/`7-trigger` 등 다른 노드 카테고리 전부와 동일한 확립된
  패턴이다 — presentation 만의 이탈이 아니다. 각 파일은 `## Rationale` 섹션을 갖춘다.
- frontmatter(`id`/`status`/`code:`): 6개 파일 모두 `spec-impl-evidence.md` §2 스키마를 따르고, `id`
  는 basename 기반, `code:` 경로는 전부 워킹트리에 실존한다(§4.6 건 제외 — 위 CRITICAL).
- node-output.md Principle 1.1/4.1-4.5/5/6/7/11 인용 — §4/§4.1/§4.2/§4.3/§4.5/§7/§7.1/§8 의 표·JSON
  예시가 실제 Principle 정의와 표현·구조 모두 일치. `previousOutput` 과도기 예외 서술도
  node-output.md §4.2 의 "과도기 예외" 문구와 정합.
- conversation-thread.md §1.2(`presentations[]` top-level 분리), §1.4(marker 없는 `ai_user`), §1.6
  (`[user-input]` 마커 presentation_user 한정), §2.1(`data.via: 'ai_render'` sentinel — node-output
  §4.5 표와 1:1 일치) — 모두 target 서술과 정확히 일치.
- interaction-type-registry.md §3 `PresentationType` 5값(`table`/`chart`/`carousel`/`template`/`form`)
  — §10.1 도구 카탈로그와 1:1 일치.
- swagger.md — presentation 노드는 신규 REST 엔드포인트/DTO 를 선언하지 않으므로 직접 위반 대상 없음.
- 명명: `PRESENTATION_MAX_BYTES`, `MAX_BUTTONS_PER_NODE`, `backfillButtonUuids`,
  `backfillFormOptionValues`, `normalizeNodeButtonIds` 모두 실제 코드 식별자와 spec 서술이 일치.
- 링크 anchor 검증은 자체 제작한 근사 slug 스크립트로 다수 "누락" 후보가 나왔으나, 표본 검증 결과
  전부 알고리즘 오차(연속 공백 처리 등)로 인한 false positive 로 판명되어 이번 보고에서는 제외했다
  (신뢰 가능한 결과를 낼 수 없어 보고하지 않음 — 실제 `spec-link-integrity.test.ts` 로 별도 검증 권장).

---

## 요약

`spec/4-nodes/6-presentation` 문서군은 `node-output.md`·`conversation-thread.md`·
`interaction-type-registry.md`·`spec-impl-evidence.md` 등 핵심 정식 규약과 대부분 매우 높은 수준으로
정합돼 있고(다수의 "4-layer SSOT 정렬" 절이 실제 코드 식별자까지 정확히 인용), 문서 구조·frontmatter·
명명 규약도 카테고리 전반의 확립된 패턴을 따른다. 다만 두 가지 실질 결함을 발견했다: (1) §4.6 이
문서화한 `excludeFromConversationThread` presentation 5 노드 지원은 코드 어디에도 없고, 그 필드의
실제 단일 진실 문서(conversation-thread.md §2.4, AI 0-common.md §10)는 이를 AI 3 노드 전용으로 못박고
있어 `status: implemented` frontmatter 요건과 직접 충돌한다(CRITICAL). (2) `form.handler.ts` 의 config
echo 가 나머지 4개 형제 핸들러와 달리 node-output.md §7 D1 이 명시적으로 금지하는 spread 패턴을 쓰고
있다(WARNING). 두 건 모두 이번 세션 diff 범위 밖의 기존 상태이지만, standing 준수 감사 관점에서는
실질적 규약 위반이다.

## 위험도

HIGH
