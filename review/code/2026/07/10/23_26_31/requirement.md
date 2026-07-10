### 발견사항

- **[INFO]** `truncation` 병합 로직이 spec(AI Agent §7.10 type block, `0-common.md` §10.4)의 4개 키(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`)와 정확히 line-level 로 일치
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:108-125`(`TRUNCATION_KEYS`/`truncationMeta`), `spec/4-nodes/3-ai/1-ai-agent.md:960-972`(`PresentationPayload` type 정의), `spec/4-nodes/6-presentation/0-common.md:100,312`
  - 상세: backend `render-tool-provider.ts:334-346`(`applyOneMbCap`)가 emit 하는 `truncation.{itemsTruncated|rowsTruncated|itemsTotalCount|rowsTotalCount}` 4개 필드와 프런트 `TRUNCATION_KEYS` 화이트리스트가 정확히 대응한다. `bytes > PRESENTATION_MAX_BYTES`(근사치 오버추정)이어도 정밀 재계산 결과 실제로는 안 잘렸으면 `rowsTruncated:false`가 truncation 객체와 함께 온다는 backend 동작(`applyOneMbCap:322-346`)까지 프런트 테스트(`presentation.test.ts` "1MB 초과여도 잘림이 실제로 없었으면 rowsTruncated=false")가 정확히 반영 — 가공의 엣지 케이스가 아니라 실제 backend 계약을 재현한 것으로 확인됨.
  - 제안: 없음(정합 확인 목적 기록).

- **[INFO]** "durable thread 의 `turn.presentations[]` 는 `source: 'ai_assistant'` 한정" 이라는 3개 spec 문서(`1-widget-app.md`/`_product-overview.md`/`conversation-thread.md`)의 공통 주장이 backend 실제 구현과 일치
  - 위치: `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts:107-129`(`appendAiAssistantMessage` 만 `presentations` 인자를 받아 turn 에 부착), `appendPresentationInteraction`(같은 파일 상단)은 `data`(interaction 스냅샷)만 설정하고 `presentations` 를 설정하지 않음
  - 상세: plan §2·§3 및 3개 spec 파일의 사실 주장을 grep 으로 직접 재현·검증. standalone presentation 노드의 `{config,output}` envelope 이 durable thread 에 영속되지 않는다는 주장이 코드로 실증됨 — spec 정정이 실측 기반이며 근거 없는 서술이 아님.
  - 제안: 없음.

- **[INFO]** `asEnvelope`/`toTable`/`toCarousel` 등 변환기가 신규 `truncation` 흡수 포함 전 함수 시그니처·계약을 그대로 유지 — 함수명·JSDoc·구현 완전 일치
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:127-155`
  - 상세: JSDoc 이 명시하는 "흡수는 output 에만, config 는 순수 payload 사본 유지", "같은 키 충돌 시 top-level truncation 이 우선"이라는 두 병합 규칙을 코드(`{ config: {...payload}, output: {...payload, ...truncationMeta(o.truncation) } }`)와 신규 lock-in 테스트(`presentation.test.ts` "payload 와 truncation 이 같은 키를 가지면 top-level truncation 우선") 양쪽에서 재확인. 반환값은 모든 경로(정상/malformed truncation/키 충돌/미등록 키)에서 완전한 `TableData`/`CarouselData` 형태를 반환 — 누락 경로 없음.
  - 제안: 없음.

- **[INFO]** 엣지 케이스 방어가 코드·테스트 양쪽에서 포괄적으로 확인됨
  - 위치: `presentation.ts:89-90`(`asRecord`), `117-125`(`truncationMeta`), `presentation.test.ts` 신규 7개 케이스
  - 상세: `truncation` 이 `null`/`문자열`/미등록 키 포함 객체/배열(수동 검증, 코드 내 테스트로는 미포함이나 `asRecord`의 `typeof v === 'object'` 분기 때문에 배열도 `{}` 로 흡수돼 크래시 없음)일 때 모두 no-op — 별도 로컬 실행으로 `truncationMeta([1,2,3])`, `truncationMeta(42)` 도 안전하게 `{}` 반환 확인. `threadToMessages` 도 text 없는 presentation-only turn을 메시지로 포함하는 경계값을 정확히 커버(`conversation.ts:52-56` 필터 조건).
  - 제안: 없음(배열 케이스 명시 테스트는 선택 사항 — 현재 리스크 낮음).

- **[INFO]** `1-widget-app.md` §2 diff 의 `[Presentation 공통 §10.6]` 앵커가 "표시-전용 presentation 노드의 위젯 envelope" 주장을 직접 정의하는 절이 아니라 AI `render_*` 도구의 blocking/non-blocking 표(§10.6)를 가리킴
  - 위치: `spec/7-channel-web-chat/1-widget-app.md`(diff) — `[Presentation 공통 §10.6](../4-nodes/6-presentation/0-common.md#106-blocking-vs-display-only)`; 실제 standalone 노드 envelope 정의는 `0-common.md` §2("포트 토폴로지 Non-blocking vs Blocking")·§4("출력 포맷")에 있음
  - 상세: §10.6 본문은 `render_table`/`render_chart`/`render_carousel`/`render_template` **AI 가상 도구**의 display-only/blocking 여부를 규정하는 절이며, 그래프상의 standalone presentation *노드*가 버튼 미설정 시 non-blocking 으로 `{config,output}` 을 emit 한다는 사실 자체는 §2/§3/§4 이 규정한다. 다만 동일 인용 패턴(§10.6 을 "표시-전용" 용어의 근거로 재사용)이 `conversation-thread.md:62`(이번 diff 이전부터 존재)에도 이미 있고, 직전 `/consistency-check --impl-prep`(22_41_55) 의 naming_collision checker 가 이 이분법 재사용을 이미 검토해 "의미 정합, 혼동 위험 낮음 — 조치 불요"로 판정한 바 있다. 기능상 오류는 아니며 새 결함이 아니라 기존에 검토·수용된 인용 관례.
  - 제안: 조치 불요(이미 이전 라운드에서 명시적으로 검토·수용됨). 후속 `conventions/` 용어집 정리 시 §2/§4 인용으로 교체하면 더 정확하나 필수 아님.

- **[INFO]** plan(`widget-presentation-restore.md`)에 등재된 2건의 스코프 밖 후속 항목(caroulsel truncation 배너 미구현, table 배너의 `totalCount` 미노출)이 실제로 이번 diff 범위 밖이며 회귀가 아님을 코드로 재확인
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:26-30`(`CarouselData` 에 `truncated` 필드 부재), `widget/components/presentations.tsx:174-199`(`toTable` 의 `truncated` 만 소비, `totalCount` 미사용)
  - 상세: `asEnvelope` 는 `itemsTruncated`/`itemsTotalCount` 도 동일하게 흡수하지만 `toCarousel`/`CarouselData` 에는 이를 읽는 소비처가 없다 — 카루셀 잘림 배너는 애초에 미구현 UI 이므로 "흡수했는데 소비 안 함"은 결함이 아니라 plan §6 에 명시된 의도적 후속 스코프. 정확히 실측 일치.
  - 제안: 조치 불요(추적만, 이번 PR 범위 아님).

### 요약
프로덕션 코드 변경은 `presentation.ts` `asEnvelope`의 `truncation` top-level 필드 흡수(4-키 화이트리스트) 1건으로 매우 좁고, 이 변경이 의도한 기능(복원 thread·라이브 AI `render_*` 경로 모두에서 1MB cap 잘림 배너가 정상 노출)을 완전히 구현한다. 병합 우선순위(charset 충돌 시 top-level `truncation` 우선), malformed 입력(`null`/문자열/미등록 키) 방어, presentation-only(텍스트 없는) turn 포함 등 엣지 케이스가 코드와 신규 lock-in 테스트 양쪽에서 정밀하게 일치한다. spec fidelity 검증에서는 `TRUNCATION_KEYS` 4개 필드가 `AI Agent §7.10`의 `PresentationPayload.truncation` type 정의 및 `0-common.md §10.4/§4`의 cap 정책과 정확히 line-level 로 일치하고, backend `render-tool-provider.ts`(`applyOneMbCap`)의 실제 truncation-계산 로직(근사치 오버추정으로 인한 `rowsTruncated:false` even-though-over-estimate 케이스 포함)까지 프런트 테스트가 재현한다. 3개 spec 문서(`1-widget-app.md`/`_product-overview.md`/`conversation-thread.md`)가 주장하는 "durable thread 의 `presentations[]` 는 `source: 'ai_assistant'` 한정" 사실도 `conversation-thread.service.ts`의 `appendAiAssistantMessage`/`appendPresentationInteraction` 구현으로 직접 재현·검증됨 — 근거 없는 spec 서술이 아니다. 유일하게 지적할 만한 사항은 `1-widget-app.md` §2 의 `[Presentation 공통 §10.6]` 인용이 standalone 노드 envelope 자체가 아니라 AI 도구 blocking 여부를 규정하는 절을 가리킨다는 점인데, 이는 새 결함이 아니라 기존에 존재하던 인용 관례의 재사용이며 직전 `/consistency-check --impl-prep`(22_41_55) naming_collision checker 가 이미 "의미 정합, 조치 불요"로 판정했다. CRITICAL/WARNING 없음.

### 위험도
NONE
