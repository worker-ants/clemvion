# Rationale 연속성 검토 — control-plane-provider-escape (F-5 제거)

대상: `spec/5-system/15-chat-channel.md` (연관: `spec/conventions/chat-channel-adapter.md`,
`spec/4-nodes/7-trigger/providers/telegram.md`, `codebase/backend/src/modules/{chat-channel,hooks,triggers}/**`)

## 핵심 판정 — F-5 제거는 부당한 번복이 아니라 예고된 근본 fix 진행

`plan/complete/eia-command-waiting-surface-guard.md` 를 직접 확인했다. F-5 절(L207-223)은
스스로를 "control-plane raw 발송 키의 MarkdownV2-safe **불변식** DTO 강제"로 부르면서도, 말미에
명시적으로 잔여 갭과 후속 경로를 기록해 두었다:

> **미채택(백로그)**: defaults 의 telegram escape baked-in(`\\.`)이 slack/discord 에서 literal 로
> 노출되는 잔여 갭 — 근본 해결은 발송 경로의 per-provider escape 이관(hooks 직접 발송 대신 어댑터
> escape). 별도 작업.

문서 상단 완료 배너(L16-19)에도 "미채택 백로그(별도 작업): ... defaults per-provider escape 이관 ..."
으로 동일 항목이 재등재되어 있다. 즉 F-5 는 **스스로를 interim 조치로 규정**했고, "발송 시점
per-provider escape 이관"을 명시적 후속 작업으로 예고했다 — 이번 PR 은 정확히 그 예고된 작업이다.

이번 PR 은 이를 뒷받침하는 근거를 4곳에 모두 남겼다 (실제로 "새 Rationale 없이 번복" 패턴이 아님):

1. **`plan/in-progress/control-plane-provider-escape.md`** — "## rationale continuity" 섹션을 자체
   포함해 "F-5 는 interim 등록 검증이었고, plan(eia-command-waiting-surface-guard)이 per-provider
   escape 이관을 근본 fix backlog 로 명시했다. 따라서 F-5 제거는 기각된 대안의 재도입이 아니라
   **예고된 진행**이다" 라고 명시.
2. **`spec/5-system/15-chat-channel.md` §4.1.1** — F-5 문단을 "control-plane 안내의 발송 시
   per-provider escape" 문단으로 교체하고, telegram/slack/discord 3-provider escape 규칙과
   default·override 평문화 근거를 본문에 기술.
3. **`spec/conventions/chat-channel-adapter.md`** — `escapeControlText` 를 어댑터 필수 인터페이스에
   신설(JSDoc + §1.1 표 신규 행)하고 3-provider 규칙을 SoT 로 명문화.
4. **`spec/4-nodes/7-trigger/providers/telegram.md`** — "non-escape 예외" 콜아웃을
   "control-plane 직접 발송의 escape" 로 교체, "종전엔 ... operator override 는 [F-5] 등록 검증으로
   막았다. 근본 해결로 **발송 직전 `adapter.escapeControlText(text)`**..." 로 F-5→신규 메커니즘 전환을
   명시적으로 서술.
5. **`CHANGELOG.md`** — `#950 F-5` 를 직접 인용하며 제거 근거·대체 메커니즘·breaking 성격(operator
   override 계약이 "escaped 필요" → "평문" 으로 바뀜)을 기록.

또한 이 변경은 **기존 원칙(R4, `providers/telegram.md` "MarkdownV2 escape 책임을 어댑터로")과
충돌하지 않고 오히려 그 원칙을 일관되게 확장**한다 — R4 는 애초에 "escape 책임은 어댑터가 진다"는
`renderNode` 경로 원칙이었는데, control-plane 직접 발송 경로만 예외적으로 DTO 등록시점 검증(F-5)에
의존해 있던 비일관을 이번 PR 이 해소한다. 즉 과거 결정(R4)의 재도입이자 정합화이지, R4 위반이 아니다.

**결론: CRITICAL 없음.** 사용자가 우려한 "과거 결정의 부당한 번복" 은 성립하지 않는다 — 근거·문서화
모두 충분하다.

## 발견사항

- **[WARNING] `## Rationale` 항목의 "6함수" 리터럴 카운트가 이번 PR로 stale 해짐 (부분 전파 누락)**
  - target 위치: `spec/5-system/15-chat-channel.md` R6 (L552, `chat-channel-adapter.md 를 spec/conventions/ 에 두는 정당화`)
    · `spec/conventions/chat-channel-adapter.md` R1 제목(L517, "6함수 인터페이스의 책임 분리") ·
    R2 제목(L521, "6함수 (5+1 ack) 의 의도")
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md ## Rationale` R1/R2 — 어댑터 인터페이스가
    "6함수"(5 core + 1 ack)로 구성된다는 카운트 자체가 R1/R2 의 제목·본문 근거.
  - 상세: 이번 PR 이 `escapeControlText` 를 **필수**(옵션 아님) 인터페이스 함수로 신설해 실질 함수
    개수가 7개가 됐다. PR 은 같은 파일·인접 문서에서 "6함수" 표현을 실제로 여러 곳 정정했다 —
    `types.ts` JSDoc("6함수 인터페이스" → "어댑터 인터페이스"), `chat-channel-adapter.md` §1.1 표
    헤딩("6함수 책임..." → "어댑터 함수 책임..."), R-CCA-5 본문("6함수 인터페이스 (§1) drift" →
    "어댑터 인터페이스 (§1) drift"), `15-chat-channel.md` CCH-CV-05 앵커 링크. 그런데 정확히 같은
    성격의 R1/R2 제목과 R6 본문 세 곳은 "6함수" 문구가 그대로 남아 실제 인터페이스와 어긋난다 —
    의도된 유지가 아니라 동일 정정 패턴의 누락으로 보인다.
  - 제안: R1 제목을 "어댑터 인터페이스의 책임 분리"로, R2 제목을 "ack 를 별도 함수로 분리한 이유"
    (또는 개수 언급 제거)로, 15-chat-channel.md R6 본문의 "6함수 인터페이스"를 "어댑터 인터페이스"로
    통일. 겸사겸사 R2 본문에 `escapeControlText` 를 별도 함수로 분리한 이유(provider-variant 이므로
    R-CCA-5 의 "provider invariant 는 공유 helper, provider variant 는 어댑터 함수" 구분과 일관됨)를
    한 문장 추가하면 R-CCA-5 의 "인터페이스 최소화 원칙" 과의 관계도 명시적으로 닫힌다.

- **[WARNING] F-5 체제에서 저장된 pre-escaped `languageHints` 값의 이중 escape(발송 실패) 위험이 plan 문서에만 있고 CHANGELOG/spec 에는 없음**
  - target 위치: `plan/in-progress/control-plane-provider-escape.md` "## 마이그레이션 주의 — 이중
    escape 배포 점검" 섹션 (`codebase` 변경분과 짝을 이루는 문서지만 spec 아님)
  - 과거 결정 출처: `plan/complete/eia-command-waiting-surface-guard.md` F-5 — telegram provider 의
    `languageHints` override 가 **operator 가 직접 backslash-escape 한 문자열**(예:
    `"받을 수 없어요\\."`)이어야 등록이 통과했다(구 계약).
  - 상세: 신규 `escapeMarkdownV2`(및 그 전신 `escapePromptText`)는 backslash 자체를 escape 대상에
    포함하지 않는 단순 char-class 치환이다 (`MD_V2_ESCAPE_REGEX = /([_*[\]()~`>#+\-=|{}.!])/g`). F-5
    체제에서 저장된 `"받을 수 없어요\\."` (backslash 1개 + 마침표) 가 이번 PR 이후
    `escapeControlText` 를 다시 거치면 `.` 가 재차 escape 되어 `"받을 수 없어요\\\\."`(연속
    backslash + 마침표)가 되고, 이는 정확히 삭제된 `firstUnescapedMarkdownV2Special` 의 회귀 테스트가
    검출하던 "연속 backslash 뒤 예약문자는 unescaped" 패턴과 같은 모양이라 telegram 이 400 을
    반환한다. `sendBestEffortNotice` 는 발송 실패를 swallow(warn) 하므로, 이 경로를 쓰던 operator 는
    **PR 배포 후 안내가 조용히 유실**될 수 있다. 개발자 본인이 plan 문서에 이 위험을 상세히
    인지·서술했고 "실무 확률은 낮다"고 판단해 코드 방어 대신 ops 1회성 데이터 점검을 권장(비강제)
    했다. 문제는 이 근거·완화책이 **`plan/in-progress/**` 안에만 있고**, `CHANGELOG.md`(이 PR 이 이미
    breaking-behavior 공지로 쓰고 있는 곳)나 spec 어디에도 등재되지 않아, plan 이 `plan/complete/`
    로 이동한 뒤에는 이 운영 caveat 을 찾을 신뢰 가능한 경로가 사라진다.
  - 제안: `CHANGELOG.md` 의 신규 항목에 "F-5 체제에서 telegram override 를 backslash-escape 해
    저장한 operator 는 배포 전/후 해당 값을 평문으로 재저장해야 한다"는 한 문장을 추가하거나,
    `spec/5-system/15-chat-channel.md §4.1.1` 의 신규 문단 말미에 마이그레이션 각주를 남길 것.
    (코드 방어 미채택 판단 자체는 근거가 타당해 재고를 요구하지 않음 — 가시성만 보완.)

- **[INFO] `language-hint-defaults.ts` 의 `SURFACE_MISMATCH_DEFAULTS` JSDoc 이 신규 아키텍처와
  불일치(코드 주석, spec 아님)**
  - target 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts:171-176`
  - 상세: "본 문구는 ... provider 별 escape 가 적용되지 않는다. 따라서 default 는 ... 특수문자를
    피해 ..." 문구가 여전히 F-5 이전 세계관(발송 시 escape 없음)을 서술한다. 실제로는 이제
    `sendBestEffortNotice` 가 `adapter.escapeControlText` 를 항상 거치므로 이 설명은 stale.
  - 제안: spec 반영 완료 후 후속 커밋에서 주석을 "escape는 발송 시 어댑터가 담당하므로 특수문자
    회피는 더 이상 필수가 아니나 기존 문구를 유지"로 정정 (기능 영향 없음, 문서 정확성만).

## 요약

사용자가 우려한 "F-5(#950) 제거가 과거 결정의 부당한 번복인가" 질문에 대한 답은 **아니오**다.
`plan/complete/eia-command-waiting-surface-guard.md` 가 F-5 를 스스로 interim 조치로 규정하고
"per-provider escape 이관"을 명시적 백로그로 예고했으며, 이번 PR 은 그 예고된 근본 fix를
`spec/5-system/15-chat-channel.md §4.1.1` · `spec/conventions/chat-channel-adapter.md`(신규
`escapeControlText` 인터페이스 + Rationale 서술) · `spec/4-nodes/7-trigger/providers/telegram.md`
· `CHANGELOG.md` 네 곳에 일관되게 새 근거로 기록하며 진행했다. 나아가 이 변경은 기존 R4("escape
책임은 어댑터가 진다") 원칙을 control-plane 직접 발송 경로까지 일관되게 확장하는 방향이라 원칙
위반이 아니라 원칙의 완성에 가깝다. 다만 (a) 이번 PR 이 다른 곳에서는 부지런히 정정한 "6함수"
리터럴 카운트가 `## Rationale` R1/R2/R6 세 곳에서는 누락돼 stale 상태로 남아 있고, (b) F-5 체제의
pre-escaped 운영 데이터에 대한 이중 escape 회귀 위험이 개발자 자신에 의해 잘 분석됐음에도 archive
후 소실될 plan 문서에만 남아 CHANGELOG/spec 에 반영되지 않았다. 둘 다 PR 을 막을 사안은 아니나
머지 전 보완을 권한다.

## 위험도

LOW
