# 정식 규약 준수 검토 — spec/5-system/15-chat-channel.md (impl-done)

검토 대상: `plan/in-progress/eia-command-waiting-surface-guard.md` 의 F-1/F-2/F-4/F-5/F-6 구현 diff
(chat-channel / execution-engine / external-interaction / websocket 모듈 + telegram 유저 가이드 + i18n dict).
diff 자체에는 `spec/**` 변경이 없음 (`### 구현 대상 spec 영역: (없음)`) — spec 본문은 이 plan 의 앞선 커밋에서
이미 갱신되어 있었고, 본 diff 는 그 계약을 코드로 마무리하는 마지막 단계.

## 검토 방법 보정

payload 의 "정식 규약 모음" 섹션에는 `spec/conventions/audit-actions.md` 와
`spec/conventions/cafe24-api-catalog/**` 만 첨부되어 있었다 — 둘 다 본 diff(chat-channel nodeId 가드 /
MarkdownV2 검증 / languageHints 안내)와 무관하다. 실제로 관련 있는 규약 파일
(`spec/conventions/error-codes.md`, `chat-channel-adapter.md`, `swagger.md`, `i18n-userguide.md`,
`spec-impl-evidence.md`)이 첨부 목록에서 누락돼 있어, 검토자가 해당 파일들을 저장소에서 직접 Read 해
대조했다. 아래 발견사항은 이렇게 직접 확보한 규약 원문 기준이다.

## 발견사항

- **[INFO]** convention_compliance payload 의 규약 첨부 목록이 diff 와 무관
  - target 위치: payload `## 정식 규약 모음 (spec/conventions/)` 섹션
  - 위반 규약: 해당 없음 (target 문서 자체의 위반이 아니라 오케스트레이터의 규약 선별 단계 이슈)
  - 상세: 이번 diff 는 chat-channel/EIA/execution-engine/websocket 영역인데, 첨부된 규약은
    `audit-actions.md`·`cafe24-api-catalog/**` 뿐이었다. 진짜 관련 규약(`error-codes.md` §1 명명 원칙,
    `chat-channel-adapter.md` §1.1/§3.1/R-CCA-5, `swagger.md` §1-4/§2-4, `i18n-userguide.md` Principle
    5/6/6-B)은 빠져 있었다. 규약 선별 단계가 변경된 코드 경로(diff 의 파일 목록)가 아니라 다른 기준으로
    파일을 골랐을 가능성이 있다.
  - 제안: `convention_compliance` payload 조립 로직이 diff 의 변경 파일 경로 → 해당 spec 문서의
    frontmatter `code:` 역참조 → 그 spec 이 인용하는 `spec/conventions/*.md` 순으로 규약을 선별하도록
    보정을 검토. (본 검토는 직접 fetch 로 우회했으므로 최종 판정에는 영향 없음.)

- **[INFO]** `UNSAFE_TELEGRAM_MARKDOWN` DTO 상세 에러 코드가 도메인 prefix 없이 명명됨 — 위반 아님, 근거 확인
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    `LanguageHintsRawSendValidator.defaultMessage` / `spec/5-system/15-chat-channel.md` §4.1.1
    "control-plane raw-send 키의 등록 시점 검증 (F-5)"
  - 위반 규약: `spec/conventions/error-codes.md` §1 "도메인 prefix (권장)"
  - 상세: §1 은 도메인 범주화가 의미 있는 코드에 `<DOMAIN>_<CONDITION>` prefix 를 권장한다.
    `UNSAFE_TELEGRAM_MARKDOWN` 은 이 패턴이 아니다. 다만 이는 §1 위반이 아니라 **기존
    `UNKNOWN_PLACEHOLDER`(동일 파일의 형제 validator, 동일 `details[].code=INVALID_FIELD` +
    `message` colon-encoding 형식)와 명시적으로 동형**("placeholder validator 와 동형" — DTO
    주석·spec §4.1.1 본문 양쪽에서 확인)으로 설계된 것이며, `error-codes.md` §1 의 도메인 prefix 는
    top-level `error.code` enum(`ErrorCode`)을 겨냥한 권고이지 `details[].code`(`VALIDATION_ERROR` 의
    하위 상세, `UNKNOWN_PLACEHOLDER` 도 동일 레이어)에는 기존에도 적용되지 않던 관행이다. 신규 위반이
    아니라 기존 정합 패턴의 정직한 확장.
  - 제안: 조치 불요. 참고로만 등재.

## 확인 완료 (위반 없음) — 상세 대조 결과

- **명명 규약**: `makeLocaleResolver`/`resolveSurfaceMismatchMessage`/`sendBestEffortNotice`/
  `sendSurfaceMismatchNotice`/`firstUnescapedMarkdownV2Special`/`isInternalCtx`(camelCase 함수),
  `SURFACE_MISMATCH_DEFAULTS`/`MARKDOWN_V2_SPECIAL_CHARS`/`TELEGRAM_RAW_SEND_HINT_KEYS`
  (UPPER_SNAKE_CASE 상수), `LanguageHintsRawSendValidator`(PascalCase 클래스) 모두 기존 코드베이스
  관례와 일치. `provider` 문자열도 `chat-channel-adapter.md` §5 의 lower-case 규약(`telegram`) 그대로
  사용.
- **출력 포맷 규약**: `409 STATE_MISMATCH` 확장(표면 불일치 + nodeId 불일치 통합)은
  `spec/5-system/14-external-interaction-api.md` §5.1 "`STATE_MISMATCH` 강제 정합 (2026-07)" 및
  `4-execution-engine.md` §7.5.1 진입점별 커버리지 표와 코드가 1:1 대응 (`InvalidExecutionStateError`
  → WS `INVALID_EXECUTION_STATE` / EIA `409 STATE_MISMATCH`, 기존 §5.1 코드 네임스페이스 분리 원칙
  그대로 준수). `UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>` colon-encoding 은 `UNKNOWN_PLACEHOLDER` 형식과
  동일. `CustomValidationPipe` 의 실제 wire 출력(`details[].code = 'INVALID_FIELD'`, 세부는 `message`
  문자열)과 spec §4.1.1 서술("details 는 INVALID_FIELD")이 서로 일치함을 코드(`validation.pipe.ts`)로
  직접 확인.
- **문서 구조 규약**: `spec/5-system/15-chat-channel.md` 는 `## Overview`(L32) ~ `## Rationale`(L504)
  구조 유지, frontmatter `id`/`status`/`code`/`pending_plans` 형식이 `spec-impl-evidence.md` 를 따름.
  신규 파일(`markdown-v2.ts`)은 `code:` 의 `codebase/backend/src/modules/chat-channel/**` glob 에 포섭.
  `execution-engine.md`/`external-interaction-api.md`/`6-websocket-protocol.md` 의 `code:` 도 diff 의
  변경 파일(`execution-engine.service.ts`/`interaction.service.ts`/`interaction.controller.ts`/
  `websocket.gateway.ts`)을 모두 커버. plan 체크리스트(F-1/F-2/F-4/F-5/F-6) 전 항목이 "완료"로
  표시되어 있어 각 관련 spec 의 `pending_plans:` 에 `eia-command-waiting-surface-guard.md` 가 없는 것도
  정상 (책임질 미구현 surface 가 남아있지 않음).
- **API 문서 규약**: `LanguageHintsRawSendValidator` 는 `swagger.md` §1 DTO 패턴(JSDoc + 필요 시
  `@ApiPropertyOptional`)·`LanguageHintsPlaceholderValidator` 형제 클래스와 동일 스켈레톤
  (`@ValidatorConstraint` + `validate`/`defaultMessage`, TDZ 회피 선언 순서 주석 포함)을 그대로 재사용.
  `@ApiConflictResponse` 설명 갱신은 §3 톤 규약(한국어, 간결)에 부합.
- **금지 항목**: chat-channel 어댑터 컨벤션의 "안내 발송 책임 = 호출자(HooksService), 어댑터는
  side-effect free" 원칙(`chat-channel-adapter.md` §1.1 `parseUpdate`)을 위반하지 않음 —
  `sendSurfaceMismatchNotice`/`sendBestEffortNotice` 모두 `HooksService` 소속. 유저 가이드
  (`telegram.mdx`/`telegram.en.mdx` §7.4) 는 `i18n-userguide.md` Principle 6-B(내부 `spec/`·`plan/`
  경로, `CCH-XX-NN`/`R-XX-N` id, 매핑 테이블명 비노출)를 위반하지 않고, ko 본문은 해요체(Principle 6)를
  준수하며 ko/en sibling 이 동일 PR 로 함께 갱신됨(Principle 5). i18n dict(`triggers.ts` ko/en)도
  leaf key parity 유지(Principle 2).

## 요약

이번 diff(F-1/F-2/F-4/F-5/F-6, `eia-command-waiting-surface-guard` plan 마무리 단계)는 정식 규약 관점에서
뚜렷한 CRITICAL/WARNING 위반이 발견되지 않았다. 신규 에러 코드·validator·헬퍼 함수 명명은 기존 형제
패턴(`UNKNOWN_PLACEHOLDER`/`LanguageHintsPlaceholderValidator`/`chat-channel-adapter.md` 의 "호출자
책임" 원칙)을 의도적으로 재사용("동형"/"대칭"이라고 diff 자체가 명시)했고, 유저 가이드 갱신은
i18n-userguide.md 의 6-B(내부 SoT 비노출)·해요체·ko/en parity 를 모두 지켰으며, spec frontmatter(`code:`/
`pending_plans:`)도 실제 변경 파일·plan 진행 상태와 정합했다. 유일하게 짚을 점은 절차적인 것으로,
`convention_compliance` payload 에 첨부된 "정식 규약 모음"이 diff 내용과 무관한 파일(audit-actions,
cafe24 카탈로그)로 채워져 있어 검토자가 저장소에서 관련 규약을 직접 재확보해야 했다 — 검토 결과 자체에는
영향이 없었으나 payload 조립 로직 보정을 권한다.

## 위험도

NONE
