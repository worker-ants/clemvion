---
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-12
owner: project-planner
spec_impact:
  - spec/7-channel-web-chat/_product-overview.md
  - spec/7-channel-web-chat/2-sdk.md
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/7-channel-web-chat/5-admin-console.md
  - spec/conventions/i18n-userguide.md
  - spec/0-overview.md
---

# channel-web-chat 위젯 chrome 문자열 EN 다국어화 — locale 활성 (spec draft)

> 유형: spec 개정(제품 스코프 이동) — 후속 구현은 `developer` 위임.
> 트리거: 사용자가 [`plan/complete/webchat-i18n-scope.md`](../complete/webchat-i18n-scope.md) (#922, 2026-07-12) 가
> **명시적으로 defer** 한 옵션 **(c)**(위젯 dict indirection 도입 = EN 지원 착수)의 **정식 재검토**를 요청.

## 1. 재검토 배경 — 이것은 "번복" 이 아니라 "예약된 활성화"

#922 는 위젯 하드코딩 한국어의 i18n 스코프를 명문화하며 세 옵션을 정의했다([webchat-i18n-scope §옵션 라벨](../complete/webchat-i18n-scope.md)):

- **(a)** i18n-userguide 에 위젯 carve-out 신설 — 채택
- **(b)** `_product-overview §2` 에 위젯 EN 다국어화 비목표 + locale reserved 명문화 — 채택
- **(c)** 위젯에 dict indirection 도입(EN 지원 착수) — **기각**

핵심: (c) 의 기각 사유는 **제품 가치 판단이 아니라 그 태스크의 스코프 한정**이었다 —
> "(c) 기각: EN 착수 = 코드 변경, 본 태스크 '코드 변경 없음' 명시. Korean-only 상태에서 dict-indirection 은 이득 0 → **v1 defer**."
> ([webchat-i18n-scope §Rationale](../complete/webchat-i18n-scope.md))

그리고 spec 자체가 이 활성화를 **예약**했다:
- [`2-sdk §R6`](../../spec/7-channel-web-chat/2-sdk.md): *"Korean-only 는 v1 **스코프 경계**이지 영구 결정이 아니므로 … 필드를 삭제해 미래 경로를 박제하지 않는다"*, *"EN 위젯 지원 시 이 필드가 UI 언어 선택자로 활성화된다"*.
- [`_product-overview §2`](../../spec/7-channel-web-chat/_product-overview.md): locale 은 *"EN 지원 착수 시 위젯 UI 언어 선택자로 활성화될 **reserved** 필드"*.
- [`i18n-userguide §적용 범위`](../../spec/conventions/i18n-userguide.md): *"EN 위젯 지원을 착수하면 본 제외를 재검토한다."*

따라서 본 개정은 rationale-continuity 상 **기각된 대안의 재도입이 아니다** — #922 가 defer 하고 spec 이 명시적으로 예약한 활성화 경로를, 사용자가 코드-변경 마일스톤을 승인함으로써 실행하는 것이다.

## 2. 사용자 결정 (2026-07-12)

| 축 | 결정 |
|---|---|
| **번역 범위** | **위젯 소유 chrome 문자열만** ko/en. 운영자 작성 콘텐츠(`headerTitle`·`welcome`·`launcher.suggestions`·`disclaimer`)는 입력값 그대로 — per-locale 콘텐츠 현지화는 비목표 유지. |
| **언어 선택** | **명시 `BootConfig.locale` → 브라우저 auto-detect(`navigator.language`) → `ko` fallback** 우선순위. |
| **마일스톤** | **메커니즘 + EN 전문(full EN copy) 동반** — 진짜 EN 지원을 다음 빌드 단위로. spec 확정 후 `developer` 구현. |

## 3. 설계

### 3.1 i18n 메커니즘 — 위젯 로컬 경량 dict (frontend dict 와 분리)

위젯 SPA(`codebase/channel-web-chat`)는 별도 정적 export 번들이라 메인 앱의 `frontend/src/lib/i18n/dict` 를 import 할 수 없다.
따라서 **위젯 로컬 경량 i18n 모듈**을 신설한다:

- 위젯 내부 문자열 카탈로그 `{ ko: {...}, en: {...} }` + 키 lookup `t(key, params?)`.
- 언어는 **boot 시 1회 해석**(§3.2)해 위젯 전역에 고정. 런타임 토글은 이번 범위 밖(선택 방식이 explicit+auto-detect 이므로).
- **ko/en leaf key parity 필수** — 키 집합이 두 로케일에서 동일해야 한다(위젯 로컬 parity 테스트로 가드).
- frontend dict Principle 1·2 의 *메인 앱 dict 시스템* 은 여전히 위젯에 강제되지 않는다(별도 표면). 위젯은 자체 경량 catalog 를 쓴다.
- **보간 문법은 제품 전반 컨벤션과 통일** — count 등 파라미터 보간은 메인 앱 `core.ts` 의 `{{name}}` 이중 중괄호(i18n-userguide Principle 3-C 선례)를 따른다. (§3.5 표의 `{count}` 는 표기 편의일 뿐 최종 구현은 `{{count}}`.)
- **개념 구분**: 이 `locale`/catalog 는 **위젯 UI 렌더 언어**다. Chat Channel 어댑터의 `config.chatChannel.languageLocale`([15-chat-channel §4.1](../../spec/5-system/15-chat-channel.md), 서버 발신 메시지 언어)와 필드명·계층이 다른 별개 개념 — 혼동 금지.

> 정확한 파일 경로·API 시그니처·번들링은 구현 세부 → `developer`. spec 은 "메커니즘 존재 + parity + 해석 우선순위 + chrome 표면 범위" 를 규범으로 둔다.

### 3.2 언어 해석 우선순위 (runtime)

```
resolveLocale():
  1) explicit BootConfig.locale ∈ {'ko','en'}  → 사용
  2) 없으면 navigator.language (Accept-Language) 파싱: /^en\b/i → 'en', 그 외 → 'ko'
  3) 최종 fallback → 'ko'
```

- 운영 콘솔 경로는 보통 `locale` 을 명시 전달(폼 필드 기본 `ko`)하므로 1) 로 결정.
- auto-detect(2)는 주로 raw 스니펫/npm 경로에서 개발자가 `locale` 을 생략했을 때 방문자 브라우저 언어를 따른다.
- 미지원/미지정 → `ko` (하위호환: 기존 위젯은 항상 한국어).

### 3.3 번역 대상 = chrome 문자열 (전수 인벤토리)

**대상 (위젯 소유 chrome)** — 아래 §3.5 인벤토리:
- 세션 컨트롤 버튼: "새 대화", "대화 종료", "새 대화 시작"(ended CTA), 닫기(✕) aria-label
- 2단계 확인 문구: "대화를 종료할까요?" 류
- 입력창: placeholder, 전송 버튼 label, "AI 응답 중" `aria-label`/`aria-busy`
- 상태·에러·시스템 메시지: 토큰 만료/종료 안내, form 검증 실패, 재시도 CTA
- presentation 잘림 배너: "일부 행만 표시돼요.", "총 N개 중 일부만 표시돼요."(count 보간)
- 빈 상태/기타 tooltip·title

**비대상 (번역하지 않음)**:
- 운영자가 **제공한** 콘텐츠(`headerTitle`·`welcome.text`·`welcome.suggestions`·`launcher.suggestions`·`disclaimer`) 및 backend 발행 payload(presentation `label`/`title`, form field `label`) — 입력 그대로 렌더.
- AI 생성 메시지 본문 — 백엔드/AI 소관.
- 코드 주석·`console.*`·EiaError 진단문(모두 `GENERIC_ERROR_MESSAGE` 로 대체되어 미노출)·데모(`src/app/demo/**`)·테스트.

**경계 규칙 2건 (인벤토리에서 도출)**:
1. **위젯 하드코딩 *기본값* 은 chrome 이다** — 운영자가 값을 안 줬을 때 위젯이 박아둔 fallback(`headerTitle` 미지정 시 `"AI 어시스턴트"`, [panel.tsx:72](../../codebase/channel-web-chat/src/widget/components/panel.tsx))은 위젯 소유 문자열이므로 **번역 대상**. 운영자가 *제공한* 값은 비대상. (이 경계로 EN 모드에서 미설정 헤더가 "AI Assistant" 로 일관.)
2. **이미 영문인 chrome 도 ko/en 대상** — chrome = "위젯 소유 사용자 가시 문자열" 이며 *현재 언어와 무관*. presentations 의 하드코딩 영문 aria-label(`` `${type} chart` ``·`"pie chart"`·`"donut chart"`, [presentations.tsx:331·390](../../codebase/channel-web-chat/src/widget/components/presentations.tsx))도 ko 키를 신설해 parity 를 맞춘다(현재 ko 표면에서도 영문이라 P6 관점 슬립).

### 3.4 EN 문체(voice) 가이드

ko 는 해요체(i18n-userguide P6). EN chrome 은 **간결·정중(concise, polite)** 병렬 보이스 — 짧은 명령형 버튼("New chat","End chat","Send"), 확인은 의문형("End this conversation?"). 글로서리 대응은 구현 시 EN copy 리뷰에서 확정.

### 3.5 하드코딩 chrome 문자열 인벤토리 (전수)

전수 스캔 결과 **위젯 소유 chrome = 28개 고유 문자열**(한국어) + 하드코딩 영문 chrome 3개(§3.3 규칙2) + 헤더 기본값 1개(규칙1).
아래 표가 SoT. **제안 key/EN copy 는 착수 재료**이며 최종 확정은 구현 시 EN copy 리뷰(§3.4)에서. 파일 경로는 `codebase/channel-web-chat/src` 기준.

**composer** (`widget/components/composer.tsx`)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| composer.tsx:34 | 메시지를 입력해 주세요. | textarea placeholder | `composer.placeholder` | Type a message. |
| composer.tsx:35 | 메시지 입력 | textarea aria-label | `composer.inputLabel` | Message input |
| composer.tsx:43 | AI 응답 중 | send btn aria-label(loading) | `composer.sendBusy` | AI is responding |
| composer.tsx:43 | 전송 | send btn aria-label(idle) | `composer.send` | Send |

**panel header** (`widget/components/panel.tsx`)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| panel.tsx:70 | 채팅 패널 | `<section>` aria-label | `panel.ariaLabel` | Chat panel |
| panel.tsx:81 | 새 대화 | header btn(new) | `header.newChat` | New chat |
| panel.tsx:88 | 대화 종료 | header btn(end) / confirmLabel | `header.endChat` | End chat |
| panel.tsx:92 | 닫기 | close btn aria-label | `header.close` | Close |
| panel.tsx:72 | AI 어시스턴트 | headerTitle **기본값**(규칙1) | `header.defaultTitle` | AI Assistant |

**confirm dialog** (`panel.tsx` CONFIRM_COPY 31–46, dialog 99–124)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| panel.tsx:100 | 확인 | alertdialog aria-label | `confirm.ariaLabel` | Confirm |
| panel.tsx:37 | 새 대화를 시작할까요? 현재 대화 내용은 사라져요. | confirm prompt(new) | `confirm.newPrompt` | Start a new chat? Your current conversation will be lost. |
| panel.tsx:38,177 | 새 대화 시작 | confirm-yes(new) / ended CTA | `confirm.newYes` | Start new chat |
| panel.tsx:42 | 대화를 종료할까요? 종료하면 이어서 대화할 수 없어요. | confirm prompt(end) | `confirm.endPrompt` | End this conversation? You won't be able to continue afterward. |
| panel.tsx:107 | 확정 (``${confirmLabel} 확정``) | confirm-yes aria suffix | `confirm.yesSuffix` | confirm |
| panel.tsx:118 | 확인 취소 | confirm-no aria-label | `confirm.noAria` | Cancel |
| panel.tsx:121 | 취소 | confirm-no btn | `confirm.no` | Cancel |

**panel body** (`panel.tsx`)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| panel.tsx:143 | 선택지 | buttons group aria-label | `group.choices` | Options |
| panel.tsx:162 | 추천 질문 | suggestions group aria-label(공유) | `group.suggestions` | Suggested questions |
| panel.tsx:175 | 대화가 종료되었어요. | ended empty-state | `ended.text` | This conversation has ended. |

**launcher** (`widget/components/launcher.tsx`)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| launcher.tsx:16 | 추천 질문 | suggestions aria-label(→`group.suggestions` 공유) | `group.suggestions` | Suggested questions |
| launcher.tsx:29 | 채팅 열기 | launcher btn aria-label | `launcher.open` | Open chat |
| launcher.tsx:35 | 읽지 않은 메시지 ${unread}개 | unread badge aria-label(보간) | `launcher.unread` | {count} unread messages |

**presentations** (`widget/components/presentations.tsx`)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| presentations.tsx:142 | 이전 | carousel prev aria-label | `carousel.prev` | Previous |
| presentations.tsx:154 | 다음 | carousel next aria-label | `carousel.next` | Next |
| presentations.tsx:202 | 총 ${totalCount}개 중 일부만 표시돼요. | table trunc banner(보간) | `table.truncatedWithCount` | Showing some of {count} items. |
| presentations.tsx:203 | 일부 행만 표시돼요. | table trunc banner | `table.truncated` | Showing some rows only. |
| presentations.tsx:394 | 범례 | chart legend aria-label | `chart.legend` | Legend |
| presentations.tsx:331 | `${type} chart` (**영문**, 규칙2) | cartesian chart aria-label | `chart.cartesianLabel` | {type} chart |
| presentations.tsx:390 | pie chart (**영문**, 규칙2) | pie chart aria-label | `chart.pie` | Pie chart |
| presentations.tsx:390 | donut chart (**영문**, 규칙2) | donut chart aria-label | `chart.donut` | Donut chart |

**dynamic form** (`widget/components/dynamic-form.tsx`)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| dynamic-form.tsx:56 | 선택 | select 빈 option placeholder | `form.selectPlaceholder` | Select |
| dynamic-form.tsx:78 | 제출 | form submit btn | `form.submit` | Submit |
| dynamic-form.tsx:52 | " *" | required 마커(구두점) | — | (번역 불요) |

**global error** (`widget/use-widget.ts`)

| file:line | ko 원문 | 표면 | 제안 key | 제안 EN(draft) |
|---|---|---|---|---|
| use-widget.ts:605 | 일시적인 오류로 대화를 진행할 수 없어요. 잠시 후 새 대화로 다시 시도해 주세요. | `GENERIC_ERROR_MESSAGE`(유일 노출 에러) | `error.generic` | Something went wrong. Please start a new chat and try again shortly. |

> 중복 병합: `추천 질문`(panel+launcher)·`새 대화 시작`(confirm+ended)·`대화 종료`(header+confirmLabel)는 단일 키 공유.
> `" *"` required 마커는 구두점이라 번역 제외. → **번역 키 = 위젯 소유 고유 표면 기준**(ko 28 + 영문 chrome 3 + 헤더 기본값 1, `" *"` 제외).

## 4. 적용할 spec 변경 (6개 파일) — **[x] 전부 적용 완료 (2026-07-12)**

- **Edit A — `_product-overview.md §2`**: "위젯 UI 다국어화(EN 등)" 비목표 항목을 **목표로 이동(chrome 한정)**.
  잔여 비목표로 (i) 운영자 콘텐츠 per-locale 현지화, (ii) 메인 앱 dict 시스템으로의 편입, (iii) 인-위젯 엔드유저 토글 명시.
  locale 서술을 "reserved/inert" → "활성(§R6 우선순위)" 로.
- **Edit B — `2-sdk.md`**: §4 스키마 주석(`locale?: 'ko'|'en'`) reserved→활성, §4 산문 note 재작성(해석 우선순위 + languageLocale 구분 1줄),
  **§R6 재작성** — "reserved(삭제 대신 정직화)" → "활성화(예약된 경로 실행)"; 삭제 안 한 이유는 이제 "이미 활성 계약" 으로 흡수.
  **[W1 반영] §3 "wc:boot 재전송(멱등 재설정)" 문단(106-109행)도 포함** — 갱신 필드 목록 "(외형·locale·콘텐츠)" 에서
  locale 을 빼고, "locale 은 boot 시 1회 해석되므로 재전송만으로는 반영되지 않으며 iframe 재마운트가 필요하다" 제약 명시
  (109행 '인스턴스/locale 변경 시에만 재마운트' 와 정합화, admin §6.1 한정 서술을 SDK 범용 계약으로 일반화).
- **Edit C — `1-widget-app.md`**: 신설 본문 절 **`## 4. i18n (chrome 문자열 다국어화)`** (현재 §1·§2·§3 뒤, Rationale 앞 —
  §4 미사용이라 충돌 없음) — 메커니즘(§3.1)·해석 우선순위(§3.2)·chrome 표면(§3.3)·비대상. §2 표의 하드코딩 문자열
  참조("AI 응답 중" 등)를 "i18n key 경유" 로 서술 정정. **Rationale `### R10`** 추가(위젯 spec 은 `WCA-*` ID 스킴이
  아니라 §번호 + R# rationale 관례 — 신규 ID 발명 금지, R4~R9 다음 순번 R10).
- **Edit D — `5-admin-console.md`**: §4 각주(120-122) "운영자가 en 을 골라도 한국어 렌더" → "en 선택 시 EN chrome 렌더";
  §6.1 step5(218) "locale 은 현재 reserved" → "locale 변경 시 재마운트로 새 언어 적용".
- **Edit E — `i18n-userguide.md`** (**[W3] 범위 확대 — §적용 범위 본문 + Rationale 하위섹션 + 자동 가드 요약 표 3곳 동반**):
  - §적용 범위 본문: 위젯 chrome 은 이제 **위젯 로컬 catalog + ko/en parity** 대상(단 메인 앱 dict 시스템 P1·2 의 *구체 기구* 는 아님). 운영자 *제공* 콘텐츠·backend payload 는 여전히 dict 밖. P6 문체 유지 존치.
  - **Rationale 하위섹션 "왜 …위젯은 dict-indirection 스코프 밖인가"(242~254행) 갱신**: "위젯 = 스코프 밖" 전제를 **chrome 한정 편입**으로 정정 — "이득 0"(Korean-only) 전제는 EN 착수로 **폐기**되나, 메인 앱 dict 시스템과의 *물리적 분리*(별도 정적 번들) 근거는 유지되어 위젯은 로컬 catalog 를 쓴다는 인과 명시.
  - **자동 가드 요약 표(204~216행)**: "위젯 로컬 parity 테스트(신규)" 행 추가 — 이 로컬 가드가 기존 "가드가 위젯 스캔 밖" backstop 을 대체함을 명시.
- **Edit F — `spec/0-overview.md §6.1`** (**[W2] 신설**): "임베드형 웹채팅 위젯" 행(82행)의 "영역 spec 6문서 전부 implemented(영역 종결). 잔여는 비차단 backlog" 서술을, **위젯 chrome EN 다국어화(locale 활성)는 spec 확정·구현 착수 예정 신규 마일스톤**([1-widget-app §4](./7-channel-web-chat/1-widget-app.md))이라는 사실과 정합화 — "영역 종결" 을 "영역 6문서 implemented, EN chrome i18n 마일스톤 신규 착수" 로 완화(§6.2 이관은 과대표현이라 지양, §6.1 유지+단서).

## 5. Rationale (결정 근거)

- **재도입 아님**: §1 근거 — (c) 는 merits 기각이 아닌 스코프 defer, spec 이 활성화를 명시 예약. 사용자가 코드 마일스톤 승인.
- **chrome-only**: 운영자 콘텐츠 현지화는 BootConfig 콘텐츠 필드를 per-locale map 으로 확장 = 운영 콘솔·서버 저장 스키마 변경(큰 표면). 가치 대비 범위가 커 별 마일스톤으로 분리. chrome 만으로 "위젯이 방문자 언어로 말한다" 의 1차 가치 확보.
- **explicit → auto-detect → ko**: 명시 우선은 운영자 의도 존중(콘솔이 항상 명시), auto-detect 은 raw 스니펫 방문자 경험, ko fallback 은 하위호환. 인-위젯 토글은 상태 저장·표면 추가라 이번 범위 밖.
- **위젯 로컬 catalog(vs frontend dict import)**: 별도 정적 번들 경계상 frontend dict 를 끌어올 수 없음. 경량 로컬 catalog 가 번들 크기·격리 유지. parity 는 위젯 로컬 테스트로 가드.

## 6. consistency-check 결과 (`--spec`, review/consistency/2026/07/12/14_34_23)

- **BLOCK: NO** (Critical 0). 최초 자동 SUMMARY 는 3 checker(cross_spec·convention_compliance·naming_collision) **disk-write gap** 으로 fail-closed BLOCK:YES 오판 → workflow `journal.jsonl` 반환값에서 전문 복구·재집계해 Critical 0 확정([[feedback_workflow_disk_write_gap_false_counts]] 절차).
- **rationale_continuity LOW / plan_coherence LOW / naming_collision NONE / cross_spec MEDIUM / convention_compliance LOW.**
- **WARNING 4건 전부 반영**: W1(2-sdk §3 wc:boot→Edit B 확대), W2(0-overview §6.1→Edit F 신설+spec_impact), W3(Edit E 3곳 확대), P1(카루셀 후속 plan 교차참조→§7·후속 plan).
- **INFO 반영**: 보간 `{{name}}` 통일(§3.1)·languageLocale 구분(§3.1/Edit B)·PROJECT.md 매핑+doc-sync-matrix 행(§8)·Edit E 인과.
- 재-invoke 불요(복구로 5/5 확보). 상세: [SUMMARY.md](../../review/consistency/2026/07/12/14_34_23/SUMMARY.md).

## 7. 검증

- **[x]** `spec-link-integrity.test.ts` — **13/13 pass** (신규 cross-link 전부 resolve; §4 링크는 무-fragment 로 anchor 리스크 없음).
- **[x]** side-effect sweep — 잔여 "reserved/inert/Korean-only" 현행-상태 주장 없음(히스토리 서술만 존치). 미러 6파일 외 누락 0.
- Gate C: `spec_impact` 6파일 리스트(전부 실존).
- **[P1] plan_coherence 교차참조**: 카루셀 잘림 배너 후속([webchat-widget-presentation-followups.md](webchat-widget-presentation-followups.md) "미구현 항목 #2")에 "착수 시 배너 문구는 `1-widget-app §4` i18n 키·ko/en parity 를 경유" 각주 1줄 추가.

## 8. 후속 (구현 핸드오프)

- spec 확정·commit 후 `developer` 가 `/consistency-check --impl-prep spec/7-channel-web-chat/` 부터 구현 착수.
- 구현 범위:
  1. 위젯 로컬 i18n catalog(`{ko,en}`) + `t(key, params?)`(`{{}}` 보간) + `resolveLocale()`(explicit→navigator.language→ko).
  2. §3.5 인벤토리 32키 치환(ko 유지 + en 신규) — 헤더 기본값·영문 chart aria-label 포함.
  3. **위젯 로컬 ko/en parity 테스트**(신규 가드).
  4. demo host·운영 콘솔 locale 실동작(en 선택→EN chrome, 재마운트) 확인.
  5. **동반 갱신**: `PROJECT.md §변경 유형 → 갱신 위치 매핑` 에 "위젯 chrome 문자열" 행 + `.claude/config/doc-sync-matrix.json` 위젯 i18n 행(신규 문자열 추가 시 catalog 양쪽+parity 강제).
- **EN copy 리뷰**: §3.5 draft EN 은 착수 재료 — user-guide/글로서리 보이스로 최종 확정.

## 9. 구현 트래커 (developer, 2026-07-12)

**모듈 구조** (`codebase/channel-web-chat/src/lib/i18n/`):
- `catalog.ts` — `WIDGET_STRINGS = { ko, en }` (§3.5 전 키), `type Locale='ko'|'en'`, `type TranslationKey`.
- `resolve-locale.ts` — `resolveLocale(explicit, navigatorLang): Locale` (explicit ko/en → navigatorLang `/^en\b/i`→en → ko).
- `context.tsx` — `I18nProvider` + `useTranslation()` → `t(key, params?)`, `{{name}}` 보간.
- **테스트는 콜로케이트**(channel-web-chat 관례, impl-prep WARNING 4): `catalog.test.ts`(ko/en parity hard fail)·`resolve-locale.test.ts`·`context.test.tsx`(보간). `__tests__/` 서브디렉터리 금지.

**배선**:
- `widget-app.tsx`: `const locale = useMemo(()=>resolveLocale(config?.locale, navigator.language),[config?.locale])` → `<I18nProvider locale={locale}>` 로 launcher/panel 래핑. (config 도착 전엔 auto-detect 로 런처 렌더.)
- 컴포넌트(composer·panel·launcher·dynamic-form·presentations): `const t = useTranslation()` 로 하드코딩 문자열 치환.
- **에러**: `use-widget.ts` 는 state.error 에 ko `error.generic` **유지**(내부 신호, test W1 이 "잠시 후 새 대화로 다시 시도" 검증) — DRY 위해 catalog ko 에서 import. **표시**는 `panel.tsx` 가 `t("error.generic")` 로 지역화(렌더되는 에러는 항상 generic — BLOCKED 코드는 blocked phase=미렌더).

**impl-prep WARNING 조치**(review/consistency/2026/07/12/15_33_33, BLOCK NO):
- W4 콜로케이트 테스트 → 위 반영. W1(후속 링크)·W3(구현상태 고지)는 **구현 완료 후** spec 캐비엇 갱신에서 해소(planner touch-up: 1-widget §4·0-overview "착수 예정"→"구현됨", 후속 링크를 이 plan 으로, 2-sdk/5-admin 현재형 정합). W2 카루셀 각주는 followup plan 에 실제 추가. INFO: 4-security §1 catalog 상호참조 1줄.

**체크리스트**:
- [x] 3. `/consistency-check --impl-prep spec/7-channel-web-chat/` **BLOCK NO** (Critical 0, WARNING 4건 조치계획 수립)
- [x] 4. DOCUMENTATION: PROJECT.md 갱신위치 매핑 + `.claude/config/doc-sync-matrix.json` 위젯 i18n 행(row 21, test_doc_sync_matrix 7/7 pass)
- [x] 5-6. i18n 모듈(`src/lib/i18n/{catalog,resolve-locale,context,index}`) + 배선(widget-app provider + 5 컴포넌트 + use-widget 에러 DRY) + 문자열 치환. parity/resolveLocale/context 테스트 콜로케이트
- [x] 7. 테스트 보강: widget-app EN 렌더 + auto-detect 테스트, presentations donut aria-label ko 정정, vitest.setup navigator.language=ko-KR
- [~] 8. TEST WORKFLOW: lint PASS. unit(웹챗 128 pass 확인)·build·e2e 진행 중
- [ ] 9. REVIEW WORKFLOW (`/ai-review` + fix) + `/consistency-check --impl-done` + post-impl spec 캐비엇 정합(W1/W3)
