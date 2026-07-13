# 정식 규약 준수 검토 — spec/5-system/15-chat-channel.md

검토 모드: --impl-done (diff-base=origin/main). 대상 diff: F-2 (`plan/in-progress/eia-command-waiting-surface-guard.md`) —
표면 불일치(409 `STATE_MISMATCH`) 시 `languageHints.surfaceMismatch` best-effort 안내 신설.

> 참고: 전달된 payload(`_prompts/convention_compliance.md`)의 "정식 규약 모음" 섹션은 798줄 지점에서
> truncate 되어 `spec/conventions/audit-actions.md` + `cafe24-api-catalog/` 덤프만 포함하고, 실제 이번
> diff 와 밀접한 `chat-channel-adapter.md`/`error-codes.md`/`i18n-userguide.md`/`spec-impl-evidence.md`
> 는 빠져 있었다. 본 검토는 저장소의 실제 `spec/conventions/**` 파일을 직접 Read 하여 이 공백을 메우고
> 진행했다 (아래 발견사항 참고).

## 발견사항

- **[WARNING] `chat-channel-adapter.md` cross-reference 문구 개수가 이번 변경으로 더 stale 해짐**
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1.1 (`languageHints` default 문구 표) — 이번 diff 로
    `surfaceMismatch` 행이 추가되어 표가 9키(6 CCH-ERR-* + `formOpenLabel` + `sessionExpired` +
    `surfaceMismatch`, KO/EN 합산 18 문구)가 됨.
  - 위반 규약: `spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig.languageLocale` JSDoc —
    `@see spec/5-system/15-chat-channel.md §4.1.1 (KO/EN default 12 문구 표)` (line 289).
  - 상세: 이 JSDoc 은 "12 문구" 라는 숫자를 하드코딩해 target §4.1.1 표를 가리킨다. 그러나 이 숫자는 이미
    `formOpenLabel`/`sessionExpired` 도입 시점부터 stale 했고(당시 8키/16문구), 이번 `surfaceMismatch`
    추가로 9키/18문구가 되어 격차가 더 벌어졌다. target 문서(§4.1.1) 자체는 정확하고 최신 상태이므로
    이번 diff 가 만든 위반이라기보다, 인접 convention 문서의 참조 카운트가 target 의 반복적 확장을
    따라가지 못하는 구조적 drift 다.
  - 제안: target 수정은 불필요. `spec/conventions/chat-channel-adapter.md` line 289 의 "12 문구" 를
    "KO/EN default 문구 표" 처럼 카운트-비의존 표현으로 일반화하거나, 최신 키 개수로 갱신 — project-planner
    후속 작업으로 반영 권장 (본 checker 는 `spec/conventions/**` 쓰기 권한이 없음).

- **[INFO] HooksService 의 `renderNode` 우회 direct `sendMessage` 패턴이 convention 에 명시적으로
  카탈로그화되어 있지 않음**
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1.1 `surfaceMismatch` 단락 / `spec/4-nodes/7-trigger/providers/telegram.md` §5.8 (신규 섹션, "non-escape 예외" 주의문).
  - 관련 규약: `spec/conventions/chat-channel-adapter.md` §1.1 (6함수 책임/부작용 표) — `renderNode`
    (pure, EIA event → `ChannelMessage[]`) 와 `sendMessage` (side-effect, 외부 API 호출) 의 책임 분리.
  - 상세: `HooksService.sendSurfaceMismatchNotice` 는 `renderNode` 를 거치지 않고 `adapter.sendMessage`
    를 **직접** 호출하는 control-plane 발송이다 (target 문서·telegram.md 모두 "`executionStillRunning`/
    `groupChatRefusal` 등 다른 hooks 직접 발송 안내와 동일 경로" 라고 명시 — 코드 확인 결과
    `hooks.service.ts` 안에 `adapter.sendMessage(` 직접 호출이 7곳 존재해 기존에도 반복된 패턴). 그러나
    `chat-channel-adapter.md` §1.1 표에는 이 "HooksService 가 `sendMessage` 를 `renderNode` 경로 밖에서
    직접 호출할 수 있다" 는 아키텍처 자체가 명시적으로 서술되어 있지 않다 — `parseUpdate` 행의 "안내 발송
    책임 = 호출자" 한 줄이 암묵적으로 뒷받침할 뿐, `sendMessage` 행 자체에는 이 예외가 언급되지 않는다.
  - 제안: target 수정은 불필요(기존 확립된 패턴을 그대로 따름). 규약 갱신이 적절한 사안 — 
    `chat-channel-adapter.md` §1.1 `sendMessage` 행 또는 별도 각주에 "HooksService 가 control-plane
    안내(그룹챗 거부/rate-limit/세션만료/표면불일치 등)를 `renderNode` 경로 밖에서 직접 호출할 수 있다"는
    문장을 추가하면, 신규 안내 메시지 추가 시마다 이 패턴을 재해석할 필요가 없어진다.

- **[INFO] `surfaceMismatch` 설계 근거가 `## Rationale` 대신 §4.1.1 본문에 inline**
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1.1, line 261 (문장부호 배제 + control-plane
    bypass 근거를 설명하는 장문 문단).
  - 관련 규약(참고): CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`".
  - 상세: 문장부호를 쓰지 않는 이유·렌더러 우회 이유 같은 설계 결정 배경이 `## Rationale` 섹션(R-CC-19
    까지 번호가 매겨진 기존 항목들)이 아니라 §4.1.1 본문에 직접 서술되어 있다. 다만 바로 위 `sessionExpired`
    항목(line 259)도 동일하게 본문 inline 설명 패턴을 이미 쓰고 있어, 이는 이번 PR 이 새로 도입한 이탈이
    아니라 이 문서 안에서 이미 확립된 로컬 관행이다.
  - 제안: 낮은 우선순위. 문서 전반을 정리하는 후속 작업에서 §4.1.1 의 `sessionExpired`/`surfaceMismatch`
    설계 근거 문단들을 `R-CC-2x` 형태의 `## Rationale` 항목으로 승격하는 것을 고려할 수 있으나, 기존
    패턴과의 국소 일관성을 감안하면 이번 PR 범위에서 강제할 사안은 아니다.

## 확인된 준수 사항 (참고)

- **naming**: `surfaceMismatch` 키는 기존 `languageHints` 키 전체(`groupChatRefusal`/`formOpenLabel`/
  `sessionExpired` 등)의 camelCase 패턴을 그대로 따른다.
- **error-codes.md**: `STATE_MISMATCH` 는 기존 EIA 코드 재사용(신규 코드 발행 없음) — UPPER_SNAKE_CASE ·
  의미 기반 명명 규율(§1) 위반 없음.
- **i18n-userguide.md**: `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` 양쪽에 `surfaceMismatch`
  가 동시 반영되어 Principle 2 (ko/en parity) 준수. `telegram.mdx`/`telegram.en.mdx` §7.4 신규 섹션은
  Principle 5 (canonical KO frontmatter / EN sibling no-frontmatter) · Principle 6 (해요체·글로서리 금지어
  미사용) · Principle 6-B (내부 SoT — `CCH-XX-NN`/plan 경로 등 — 미노출) 모두 준수.
  KO/EN 두 mdx 의 `### 7.4` 번호도 `### 7.3` 뒤로 정상 연속.
- **MarkdownV2 escape 재사용**: 신규 테스트(`language-hint-defaults.spec.ts`)가 `telegram-message.renderer.ts`
  의 canonical `escapeMarkdownV2` 를 재사용해 특수문자 미포함을 검증 — 특수문자 집합을 손으로 재선언하지
  않는 SoT 재사용 원칙에 부합 (MEMORY 의 "Shared secret redaction SoT" 와 동일한 패턴).
- **spec-impl-evidence.md**: `15-chat-channel.md` frontmatter (`id`/`status: partial`/`code:`/
  `pending_plans:`) 스키마 준수. `code:` 의 `codebase/backend/src/modules/chat-channel/**` 글로브가
  신규 파일 `language-hint-defaults.ts` 를 이미 커버하며, `hooks.service.ts` 도 명시적으로 등재되어 있어
  갱신 불필요. `pending_plans:` 는 F-2 를 낳은 `eia-command-waiting-surface-guard.md` 를 열거하지 않지만,
  F-2 가 이번 diff 로 완전히 구현(코드+테스트+spec+가이드)됐고 그 plan 의 잔여 항목(F-1/F-3)은
  `15-chat-channel.md` 가 약속한 surface 가 아니라 별도 영역(execution-engine nodeId 매칭 / EIA breaking
  change 공지) 이므로 누락이 아니다.
- **provider spec 동기화**: `spec/4-nodes/7-trigger/providers/telegram.md` §5.8 신규 섹션이
  `chat-channel-adapter.md` R4(`MarkdownV2 escape 책임을 어댑터로`)의 예외를 명시적으로 인용하며 정합.

## 요약

이번 diff(F-2, `languageHints.surfaceMismatch`)는 명명·i18n dict parity·MarkdownV2 escape 재사용·
frontmatter(spec-impl-evidence) 스키마·에러 코드 재사용·사용자 가이드 문체/내부 SoT 비노출 규약을
모두 준수한다. target 문서(`spec/5-system/15-chat-channel.md`) 자체에서 CRITICAL 또는 명확한 WARNING
급 정식 규약 위반은 발견되지 않았다. 유일하게 발견된 이슈들은 target 이 아니라 인접 convention 문서
(`spec/conventions/chat-channel-adapter.md`)의 cross-reference 정확도·아키텍처 서술 완결성에 관한
것으로, target 을 수정하기보다 convention 문서를 후속 갱신하는 편이 적절하다.

## 위험도

LOW
