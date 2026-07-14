# 보안(Security) Review

대상: `spec/5-system/15-chat-channel.md` (F-5), `spec/5-system/4-execution-engine.md` / `spec/5-system/6-websocket-protocol.md` (F-6) 의 spec 변경 + 참조된 구현 (`chat-channel-config.dto.ts`, `websocket.gateway.ts`, `execution-engine.service.ts`, `hooks.service.ts`, `telegram.adapter.ts`, `language-hint-defaults.ts`) 직접 검증.

## 발견사항

- **[WARNING]** F-5 `LanguageHintsRawSendValidator` 의 MarkdownV2 unescaped-특수문자 검출 정규식에 우회(bypass) 존재 — "등록 시점 검증으로 400 유실 방지" 라는 F-5 의 목표 자체가 특정 입력에서 무력화됨
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:170-195` (`MD_V2_ESCAPE_PAIR`, `firstUnescapedMdV2Special`)
  - 상세: `MD_V2_ESCAPE_PAIR = /\\[_*[\]()~\`>#+\-=|{}.!]/g` 를 이용해 "escape 쌍(`\X`)을 먼저 제거한 뒤 남은 특수문자만 검사"하는 방식인데, 이 regex 는 **좌→우 순차 backslash-toggle 의미론을 재현하지 못한다**. 연속된 backslash 뒤에 예약문자가 오는 패턴(`\\!`, `\\.`, `\\-` 등 — backslash 2개 + 예약문자)에서, regex 가 두 번째 backslash 를 예약문자와 짝지어 "이미 escape 된 것"으로 오판하고 스킵한다. 실제 MarkdownV2 의미론으로는 `\\` 가 "escaped backslash"(리터럴 `\` 1개) 이고 그 뒤의 예약문자는 **escape 되지 않은 상태**라 Telegram 이 400 을 반환한다. 직접 재현:
    ```js
    const MD_V2_SPECIAL_CHARS = "_*[]()~`>#+-=|{}.!";
    const MD_V2_ESCAPE_PAIR = /\\[_*[\]()~`>#+\-=|{}.!]/g;
    function firstUnescapedMdV2Special(text) {
      const stripped = text.replace(MD_V2_ESCAPE_PAIR, "");
      for (const ch of stripped) if (MD_V2_SPECIAL_CHARS.includes(ch)) return ch;
      return null;
    }
    firstUnescapedMdV2Special("\\\\!"); // 실제 문자열: \\!  (backslash, backslash, !)
    // → null (validator: 안전 판정) 이지만 Telegram sendMessage 는 parse_mode=MarkdownV2 로
    //   이 텍스트를 거부(400) 할 가능성이 높다 — F-5 가 막으려던 바로 그 실패 모드.
    ```
    `telegram.adapter.ts:141-145` 확인 결과 `message.body.text` 는 추가 escape 없이 그대로 `parse_mode: 'MarkdownV2'` 로 전송되므로 (control-plane raw-send 키는 렌더러를 거치지 않는다는 spec 설명과 일치), DTO 검증을 통과한 값이 실제 send 단계에서 재차 실패할 수 있는 경로가 그대로 열려 있다.
  - 영향 범위: `languageHints` 는 워크스페이스 소유자(트리거 configurator)가 자신의 트리거에 설정하는 값이라 외부 공격자가 직접 주입하는 인젝션은 아니다 — cross-tenant 침해나 인젝션이 아닌, **F-5 가 보장하려던 가용성 안전장치의 우회**(자기 트리거의 안내 메시지가 조용히 유실될 수 있음, CCH-SE-01 degraded 로 흡수는 되나 설계 의도는 "등록 시점에 100% 차단"이었음). 심각도는 낮지만 F-5 의 정합성 자체를 깨는 회귀.
  - 제안: escape-pair 제거 후 잔여 문자를 스캔하는 방식 대신, 문자열을 좌→우로 순회하며 `\` 를 만나면 다음 1문자를 무조건 소비(escape)하고, 그 외 위치에서 예약문자를 만나면 unsafe 로 판정하는 **상태기계(순차 파싱)** 로 교체. `telegram-message.renderer.ts` 의 `MD_V2_ESCAPE_REGEX`(인코딩 방향)와 대칭되는 디코딩 로직을 공유 유틸로 추출해 두 로직의 escape 의미론이 항상 일치하도록 강제. 테스트에 `\\!`, `\\.`, `\\\\.` 등 다중 backslash 케이스 추가.

- **[INFO]** `languageHints` 의 값이 문자열이 아닌 경우 두 커스텀 validator(`LanguageHintsPlaceholderValidator`, `LanguageHintsRawSendValidator`) 모두 조용히 스킵됨
  - 위치: `chat-channel-config.dto.ts:108` (`findFirstUnknownPlaceholder` 의 `typeof template !== 'string'` guard), `:190` (`findFirstUnsafeRawSendHint` 동일 guard)
  - 상세: `languageHints?: Record<string, string>` 필드는 `@IsObject()` 만으로 검증되고 값 타입은 강제되지 않는다. 숫자/객체/배열 등 non-string 값이 들어오면 두 validator 모두 "문자열이 아니므로 검사 대상 아님"으로 통과시킨다. 소비 측(`resolveLanguageHint`, `makeLocaleResolver`)은 `typeof override === 'string'` guard 로 non-string 을 무시하고 default 로 fallback 하므로 현재 코드 경로상 크래시·인젝션으로 이어지지는 않지만, 방어 계층이 하나 비어 있다.
  - 제안: `languageHints` 의 각 value 에 대해 `@IsString({ each: true })` (Record 값 검증을 위한 커스텀 validator 또는 class-validator 확장) 로 타입을 등록 시점에 강제 권장.

- **[INFO]** `languageHints` 개별 값의 길이 상한 없음
  - 위치: `chat-channel-config.dto.ts:404-420`
  - 상세: `botToken`/`inboundSigningPlaintext` 등 다른 필드는 `@MaxLength` 가 있으나 `languageHints` 의 각 문자열 값에는 길이 제한이 없다. 악용 시나리오는 제한적(트리거 소유자 self-input, Telegram 자체 4096자 한도로 결국 실패)이나, config JSONB 비대화·DB 저장 비용 관점에서 방어적으로 상한(예: 4096) 부여를 권장.

## 검증 완료 — 이상 없음 (F-6)

`execution.click_button`/`submit_message`/`end_conversation` 의 `nodeId` publisher 측 검증(F-6, `execution-engine.service.ts:5281-5356` `resolveWaitingNodeExecutionId`)을 인가 경계 우회 관점에서 점검한 결과, 문제를 발견하지 못했다:

- `nodeId` 대조는 `websocket.gateway.ts` 의 `verifyExecutionOwnership(executionId, workspaceId)` (workspace 소유권 IDOR 가드) **이후에만** 수행된다 (`handleClickButton`/`handleSubmitMessage`/`handleEndConversation` 모두 동일 순서). `nodeId` 는 인가에 관여하지 않고, 이미 소유권이 확인된 execution 안에서 "현재 대기 중인 단일 NodeExecution" 과의 **사후 일치 검사**로만 쓰인다 — 다른 execution/노드로의 접근을 허용하는 lookup key 가 아니다.
- `nodeId` 미제공(기존 클라이언트, chat-channel `in_process_trusted`)은 `expectedNodeId === undefined` 로 검사를 skip 하는 명시적 exemption이며 (`execution-engine.service.ts:5342`), spec 본문에도 "scope 단위 면제" 로 정확히 문서화되어 있다. `click_button` 은 frontend 가 `nodeId` 를 아직 보내지 않아 "실질 no-op" 이라는 spec 서술도 실제 gateway 코드(`data.nodeId` optional, `undefined` 그대로 forward)와 일치한다.
- 불일치 시 client 에는 `InvalidExecutionStateError` 의 **고정 client-safe 메시지**("Execution is not waiting for input.")만 노출되고, 실제 대기 nodeId·행 수 등 진단 정보는 `serverDetail`(서버 로그 전용, `buildContinuationErrorAck` 가 분리)로만 기록된다 — nodeId 불일치와 "애초에 대기 상태가 아님" 두 케이스가 client 관점에서 구분되지 않아 내부 상태 추론(정보노출) 여지도 없다.
- IDOR 가드(`verifyExecutionOwnership`) 자체도 실패 시 획일적으로 `false`(→ `MSG_NOT_AUTHORIZED_EXECUTION`)를 반환해 "존재하지 않음"과 "권한 없음"을 구분하지 않는 fail-closed/존재 비노출 패턴을 유지한다.

## 기타 관점 확인

- **하드코딩 시크릿**: diff·참조 코드에 하드코딩된 토큰/키 없음. `botToken`/`inboundSigningPlaintext` 는 spec CCH-SE-03 대로 `SecretResolver` 경유 AES-256-GCM 저장 + `botTokenRef`/`inboundSigningRef` 만 DB(JSONB) 보관 정책이며, DTO 레벨에서도 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 3필드는 `@IsEmpty()` 로 **외부 입력 자체를 차단**해 클라이언트가 ref 를 직접 주입/스푸핑할 수 없도록 막아둔 점이 확인됨(양호).
- **에러 처리/정보노출**: WS continuation 4종 공통 `buildContinuationErrorAck` 이 non-typed Error 의 원본 message/stack 을 client 로 전달하지 않고 서버 로그로만 격리 — CCH-ERR-03 류 정책과 일관.
- **SQL 인젝션**: `resolveWaitingNodeExecutionId` 쿼리는 TypeORM QueryBuilder 파라미터 바인딩(`:executionId`, `:status`) 사용 — 문자열 결합 없음.
- **인젝션(MarkdownV2)**: F-5 가 다루는 것은 XSS/SQLi 류가 아니라 "raw text 를 Telegram 파서가 어떻게 소비하는가"의 가용성 문제이며, 상기 WARNING 외에는 별도 인젝션 벡터 없음(HTML/JS 렌더링 경로가 아니라 봇 API 텍스트 필드).

## 요약

이번 diff 는 문서(spec) 3건과, 명시적으로 요청된 두 구현 지점(F-5 telegram MarkdownV2 등록시점 validator, F-6 WS continuation `nodeId` 사후검증)을 직접 코드까지 추적 검증했다. F-6 은 인가 경계(workspace 소유권 검증)와 명확히 분리된 사후 일치 검사로 설계·구현되어 IDOR 나 정보노출 문제가 없음을 확인했다. F-5 는 목표(등록 시점에 unsafe MarkdownV2 override 를 100% 차단)에는 미달하는 정규식 우회가 실제로 재현되어(WARNING), 이는 cross-tenant 침해나 데이터 유출로 이어지는 취약점은 아니지만 스스로 설계한 가용성 안전장치를 무력화하는 회귀이므로 구현 단계에서 수정이 필요하다. 그 외 시크릿 저장·에러 메시지 노출·SQL 파라미터 바인딩 등 기존에 확립된 보안 관례는 일관되게 지켜지고 있다.

## 위험도

LOW
