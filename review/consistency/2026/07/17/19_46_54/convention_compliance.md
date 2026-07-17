# 정식 규약 준수 검토 — spec/7-channel-web-chat/ (2026-07-17 19:46:54)

## 검토 범위 안내

- target: `spec/7-channel-web-chat/{0-architecture,1-widget-app,2-sdk,3-auth-session,4-security,5-admin-console}.md` + `_product-overview.md`.
- `prompt_file` 이 조립해 준 "정식 규약 모음" 절에는 `spec/conventions/audit-actions.md` ·
  `cafe24-api-catalog/**` 만 포함돼 있었다 — 둘 다 web-chat 도메인과 무관해 target 이 위반할 여지가
  없음을 확인만 하고(감사 액션 신규 등록 없음, Cafe24 API 무관), 실제로 target 이 인용·의존하는 정식
  규약(`conversation-thread.md` · `interaction-type-registry.md` · `i18n-userguide.md` · `swagger.md` ·
  `error-codes.md` · `node-output.md` · `spec-impl-evidence.md`)은 워크트리 절대경로로 직접 Read 해
  대조했다 (`/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/spec/conventions/*.md`).
- `git diff origin/main...HEAD -- spec/7-channel-web-chat/` 로 확인한 실제 변경분은 `2-sdk.md` frontmatter
  `code:` 4줄 추가뿐이다(나머지 5개 문서는 origin/main 과 바이트 단위로 동일). 아래 발견사항은 이 변경분과
  전체 영역의 정식 규약 정합을 함께 다룬다.

---

## 발견사항

- **[WARNING]** `2-sdk.md` frontmatter 주석의 `§110` 이 실재하지 않는 section 을 가리킴 — 저장소 전역 `§N` 표기 관례와 충돌
  - target 위치: `spec/7-channel-web-chat/2-sdk.md:6` (이번 diff 로 신설된 `code:` 항목 주석)
    ```yaml
    code:
      - codebase/packages/web-chat-sdk/**
      # §110 `wc:boot` 재전송 계약("위젯은 **마지막** wc:boot 의 config 를 적용")의 **위젯 측** 구현.
      # 이 문서가 그 계약의 SoT 이므로 여기 증거를 건다 — 1-widget-app.md 는 재전송을 서술하지 않는다.
      - codebase/channel-web-chat/src/widget/host-bridge.ts
      - codebase/channel-web-chat/src/widget/use-widget.ts
    ```
  - 위반 규약: 명문화된 단일 `spec/conventions/<file>` 조항은 없다 — 다만 `spec/conventions/**`·`spec/**` 전체가
    예외 없이 지키는 **de facto 표기 관례** `§N` = 그 문서의 실제 `##`/`###` heading 번호(예:
    `spec/conventions/swagger.md §2-5`, `spec/conventions/node-output.md §4.5`, `spec/conventions/conversation-thread.md §9.1`,
    본 문서 자신의 `2-sdk.md §3`·`§R6` 등)와 정면으로 충돌한다. `2-sdk.md` 는 `## 1`~`## 5` + `Rationale`(R2~R6)
    까지만 존재하며(`grep -n "^## " spec/7-channel-web-chat/2-sdk.md` 실측), `§110` 에 대응하는 heading 은 없다.
  - 상세: `§110` 은 section 번호가 아니라 **줄 번호 핀**이다 — 실측 결과 인용 대상 문단("`wc:boot` 재전송(멱등
    재설정)…")은 파일의 **§3(`## 3. host ↔ iframe postMessage 프로토콜`)** 안, 현재 **110행**에 있다(우연이
    아니라 의도된 line-pin). 이 관행은 이미 `codebase/channel-web-chat/src/widget/use-widget.ts`·
    `use-widget-eager-start.test.ts`·`widget-state.ts`·`CHANGELOG.md`·`plan/in-progress/webchat-boot-single-flight.md`
    30곳 이상에 "§110" 이라는 비공식 clause-id 로 이미 전파돼 있고, **직전 코드 리뷰 라운드
    (`review/code/2026/07/17/18_39_11/documentation.md` WARNING)가 정확히 같은 문제를 이미 지적**했다 — 원래
    `§106` 이었던 것이 바로 이번 PR 이 frontmatter 에 넣은 4줄 때문에 대상 문단이 106→110행으로 밀려
    "자기 자신이 인용하는 줄을 자기 자신이 밀어낸" 자기모순적 인용이 됐고, 즉시 조치로 `§106→§110` 39건을
    기계적으로 정정했다. 근본 조치(줄 번호 핀 대신 안정적 앵커 — 예: 산문 섹션 참조 또는 `EIA-IN-02`·
    `WH-SC-01`·`CCH-SE-04` 류의 명시적 clause-id 스킴 채택)는 "spec 규약 변경" 이라는 이유로 planner 트랙으로
    이월됐고, `plan/in-progress/webchat-boot-single-flight.md` 말미 "이월 (신규)" 절에 "**`§NNN` 행-번호
    clause-id 가 구조적으로 취약** … spec 조항에 안정적 앵커를 주는 게 근본 해결이고 이는 spec 규약 변경이라
    planner 트랙" 으로 명시 기록돼 있다. 즉 본 발견은 **신규 발견이 아니라 이미 인지·추적 중인 항목의
    convention-compliance 관점 재확인**이며, 현재 target(`2-sdk.md:6`)은 그 취약한 표기를 그대로 신규 반영한
    상태다.
  - 제안: (a) **즉시(이 PR 범위)**: `2-sdk.md:6` 의 `§110` 을 실제 section 참조 `§3`(host ↔ iframe postMessage
    프로토콜)으로 정정 — `1-widget-app.md:154` 가 이미 동일 대상을 `[2-sdk §3 wc:boot]` 로 정확히 인용하고
    있어 그 표기와도 맞춘다. (b) **규약 갱신 쪽이 근본 해결**: `plan` 이 이미 식별한 대로, 반복 drift 를
    구조적으로 막으려면 `spec/conventions/`(예: `spec-impl-evidence.md` 또는 신설 문서)에 "spec 조항 인용은
    `§<heading-number>` 만 쓰고 줄 번호를 clause-id 로 재사용하지 않는다 / 안정적 clause-id 가 필요하면
    `<AREA>-<CAT>-<NN>` 스킴(`WH-*`/`EIA-*`/`CCH-*` 선례)을 따른다" 는 한 항을 명문화하는 편을 권고한다 — 이미
    project-planner 트랙으로 이월돼 있으므로 본 발견은 그 트랙의 우선순위 판단 자료로 사용하면 된다.

- **[INFO]** 영역 개요(`_product-overview.md`) 헤더 백링크가 6개 문서 중 2개에만 존재 — 사소한 서식 비일관
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md:248-250` · `2-sdk.md:547-548` · `3-auth-session.md:761-762`
    (헤더 블록에 `_product-overview.md` 링크 없음) vs `0-architecture.md:55` · `5-admin-console.md:12`
    (`> 영역 개요: [_product-overview](./_product-overview.md).` 로 시작) vs `4-security.md:905`(헤더가 아니라
    `## Overview` 본문 안에서 인용).
  - 위반 규약: 명시적 규약 없음 — `spec-area-index.test.ts`(SoT: `spec/conventions/spec-impl-evidence.md §4.2`)는
    영역 index 문서(`_product-overview.md`/`0-architecture.md`)가 모든 sibling 을 링크하기만 요구하고,
    개별 sibling 문서가 역방향으로 index 를 링크할 것을 요구하지 않는다. `_product-overview.md` 자체는 6개
    문서를 전부 링크하고 있어 그 가드는 통과한다(실측 확인).
  - 상세: 순수 가독성 관점의 제안이다 — 독자가 `1-widget-app.md`/`2-sdk.md`/`3-auth-session.md` 를 먼저 열면
    영역 진입점으로 되돌아가는 명시적 링크가 헤더에 없다.
  - 제안: 6개 문서 헤더 blockquote 모두 `0-architecture.md`/`5-admin-console.md` 패턴(`> 영역 개요:
    [_product-overview](./_product-overview.md).`)으로 통일하면 좋으나, 이는 규약 위반 교정이 아니라
    스타일 통일 제안이라 우선순위는 낮다.

---

## 점검했으나 위반 없음으로 확인된 항목 (근거 요약)

- **문서 구조(Overview/본문/Rationale)**: 6개 문서 전부 `## Overview` → 번호 섹션 → `## Rationale` 3단 구성을
  지킨다. `_product-overview.md`(밑줄 prefix) · `0-architecture.md`(`0-` prefix) 명명도 CLAUDE.md 컨벤션과 일치.
- **frontmatter(`spec-impl-evidence.md`)**: `spec/7-channel-web-chat/**.md` 는 §1 inclusive list 에 명시 대상.
  6개 문서 모두 `id`(kebab-case, 영역 접두 `web-chat-*` 로 타 영역과 충돌 회피 — `4-security.md` 는 그 사유를
  frontmatter 주석으로 직접 명문화)·`status: implemented`·`code:` 를 보유하며, `code:` glob/파일 경로를
  워크트리에서 전수 실존 확인(누락 없음 — `codebase/channel-web-chat/**`, `codebase/packages/web-chat-sdk/**`,
  `codebase/backend/src/modules/hooks/**`, `codebase/backend/src/common/cors/web-chat-cors.ts` 등). 이번 diff 가
  추가한 `host-bridge.ts`/`use-widget.ts` 도 실제로 `wc:boot` 재전송 로직을 담고 있어 evidence 로 타당하다
  (`grep -n "wc:boot" codebase/channel-web-chat/src/widget/{host-bridge,use-widget}.ts` 로 확인).
- **`spec-area-index.test.ts`**: `_product-overview.md`(`_*overview.md` 매치) + `0-architecture.md`(`0-*.md` 매치)
  가 index 후보이며, `_product-overview.md` 헤더가 나머지 5개 sibling 을 모두 링크 — 가드 통과.
- **출력 포맷(`swagger.md §2-5`)**: target 이 반복 인용하는 "`TransformInterceptor` 가 성공 응답을 `{ data }`
  로 래핑" 서술이 `swagger.md §2-5 응답 wrapping` 본문과 정확히 일치. `embed-config` 엔드포인트 인용
  (`4-security.md §3-①`)도 `swagger §2-5` anchor 를 정확히 가리킨다.
- **DTO/API 문서 규약(`swagger.md §5-1`)**: `code:` 로 인용된 `embed-config-response.dto.ts` 의 실제 export
  클래스명이 `EmbedConfigDto` — `dto/responses/*-response.dto.ts` 파일 위치 + `*Dto` 클래스명 패턴과 일치
  (실측: `grep -n "^export class" codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts`).
- **`conversation-thread.md`**: 위젯의 2-way 말풍선 축약(`presentation_user`·`ai_user`→user,
  `ai_assistant`·`ai_tool`·`system`→assistant)이 `conversation-thread.md §9` 의 "스코프 예외 — 임베드형 채널
  위젯" blockquote 와 토씨까지 일치. `[user-input]…[/user-input]` strip 의무(§9.5)도 `1-widget-app.md` 메시지
  리스트 행에 명시 인용돼 있고, 실제 구현(`codebase/channel-web-chat/src/lib/conversation.ts` 의
  `stripUserInputMarkers`)도 확인됨 — 문서·코드·규약 3자 정합.
- **`interaction-type-registry.md`**: EIA 외부 표면 3값(`form`/`buttons`/`ai_conversation`) ↔ 엔진 내부 4값
  (`ai_form_render` 포함) 매핑 서술이 registry §1.1 note 와 일치.
- **`i18n-userguide.md`**: 위젯 chrome 이 메인 앱 dict 대신 로컬 catalog + 자체 ko/en parity 테스트를 쓰는 것,
  운영 콘솔(구성요소 D)은 메인 앱 dict in-scope 인 것 모두 `i18n-userguide.md §적용 범위`·Rationale "왜
  channel-web-chat 위젯은…" 절이 이미 동일하게 carve-out 해 둔 내용과 정확히 대응(`1-widget-app.md §4`,
  `5-admin-console.md §8`).
- **`error-codes.md`**: `WEBCHAT_IDLE_TIMEOUT`(도메인 prefix `WEBCHAT_` 부여, §1 권장과 일치),
  `STATE_MISMATCH`(도메인 prefix 없음이지만 EIA 자체 Rationale 이 이미 "REST 표면 전용 간결 코드" 로 별도
  근거를 밝혀 둔 기존 코드 재사용 — 신규 위반 아님)·`GENERIC_ERROR_MESSAGE`(에러 코드가 아니라 위젯 로컬 상수/
  i18n 키 `error.generic` 이라 이 규약의 적용 대상 밖) 모두 이상 없음.
- **`node-output.md §4.5`**: `interaction.data` shape 인용(`form_submitted`/`button_click`/`button_continue`)이
  §4.5 표와 일치.
- **`secret-store.md`**: per_execution 단명 토큰(`iext_*`)은 `secret://` scheme 대상(서버측 provider 자격증명)이
  아니라 클라이언트 sessionStorage 저장 대상이라 애초 무관 — target 이 이 규약을 인용하지 않는 것 자체가 옳다.

---

## 요약

`spec/7-channel-web-chat/` 6개 문서는 `spec/conventions/**` 전반(문서 3단 구성·frontmatter evidence·
`{ data }` wrapping·conversation-thread 위젯 carve-out·interaction-type 매핑·i18n 위젯 catalog carve-out·
에러 코드 명명)과 매우 높은 수준으로 정합했다 — 다수 항목이 이미 이전 검토 사이클을 거치며 정식 규약을
문장 단위로 정확히 인용하도록 다듬어져 있음을 실측으로 확인했다. 이번 PR 이 실제로 건드린 유일한 target
변경(`2-sdk.md` frontmatter 4줄)도 spec-impl-evidence 관점에서는 완전히 정당한 evidence 보강이지만, 그
주석에 실린 `§110` 인용이 저장소 전역 `§N`=heading 번호 관례와 어긋나는 취약한 line-pin 표기를 그대로
승계했다 — 이는 이미 직전 코드 리뷰·plan carryover 로 인지·추적 중인 사안이라 이번 PR 을 차단할 사유는
아니지만, target 문서 자체에 여전히 라이브로 존재하므로 WARNING 으로 재확인해 둔다. 그 외에는 스타일
수준의 INFO 1건 외에 규약 위반을 발견하지 못했다.

## 위험도

LOW
