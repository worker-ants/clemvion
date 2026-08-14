### 발견사항

없음 — 이번 diff 는 정보 노출(CWE-200) 결함에 대한 수정이며, 새로 도입된 취약점은 발견되지 않았다.

**참고 (비발견, 검증 메모)**: 아래는 결함이 아니라 검증 과정에서 확인한 사실이다.

- 이 diff 는 `execution.waiting_for_input`(WS fanout: SSE·webhook·chat-channel)과
  `GET /api/external/executions/:id`(REST `InteractionService.getStatus`) 두 경로 모두에서
  `NodeExecution/Execution.outputData.meta.turnDebug[].llmCalls[].requestPayload/responsePayload`
  (시스템 프롬프트·대화 이력)가 raw 로 새던 CRITICAL 을 닫는다.
  - `codebase/backend/src/shared/utils/strip-external-only-fields.ts` — 신규 공유 유틸,
    필드명(`llmCalls`) 기준으로 **깊이 무관** 재귀 삭제. `stripDeep()`.
  - `codebase/backend/src/modules/websocket/websocket.service.ts:450`,`524` — fanout 호출부가
    depth-1 shallow delete 를 공유 유틸(`MAX_SANITIZE_DEPTH` 전달)로 교체.
  - `codebase/backend/src/modules/external-interaction/interaction.service.ts`
    (`stripAndRedact()` 헬퍼, `getStatus()` 내 waiting `nodeOutput`/terminal `result`/terminal
    `error` 세 출구 모두 적용) — REST 스냅샷이 `deepRedactSecrets`(값 마스킹)만 거치고
    필드 자체는 남기던 경로를 막았다. 세 출구를 각자 조립하지 않고 한 헬퍼로 묶어, 한쪽만
    고쳐지고 나머지가 남는 재발 패턴(과거 세 라운드 반복)을 구조적으로 차단.
  - 직접 실행(diff 확인)으로 `interaction.service.ts` 의 waiting/terminal(`result`/`error`)
    세 분기 모두 `stripAndRedact()` 를 거치는 것을 확인했다 — CHANGELOG/RESOLUTION 의
    서술과 코드가 일치한다.
- **`__proto__` 오염 방어**: `stripDeep()` 이 삭제/치환 시 `out ??= { ...obj }`(스프레드로
  `__proto__` own-property 화) 후 `Object.defineProperty` 로 대입한다(bracket 대입 금지 주석
  명시, CWE-1321 방어). `strip-external-only-fields.spec.ts`/`websocket.service.spec.ts` 에
  `__proto__` 값 안에 실제 strip 대상(`llmCalls`)을 넣어 대입 분기를 타게 만든 fixture 로
  값 보존·프로토타입 무결성·전역 오염 없음을 확인하는 테스트가 존재한다(뮤테이션 판별력도
  기록됨).
- **경계 연산자 일치**: `stripDeep`(`depth > maxDepth`)과 자매 `sanitizePayloadForWs`
  (`depth > MAX_SANITIZE_DEPTH`)/`deepRedactSecrets`(`depth >= MAX_REDACT_DEPTH`)의 경계가
  서로 다르지만(`>` vs `>=`), 두 함수 중 하나가 그 경계에서 서브트리 전체를 non-object 로
  collapse 하므로 raw 내용은 어느 깊이에서도 새지 않는다는 것을 실제 파이프라인 sweep
  (depth 0·5·8·9·10·11·12, `websocket.service.spec.ts` it.each)으로 검증했고, mutation
  (strip no-op)으로 각 케이스의 판별력까지 실측해 기록했다. `interaction.service.ts` 쪽은
  `stripExternalOnlyFields(value, MAX_REDACT_DEPTH)` → `deepRedactSecrets(...)` 순서로
  같은 상한 값을 명시적으로 공유한다.
- **fanout 소비처 재확인**: `chat-channel.dispatcher.ts`, `notification-fanout.service.ts`
  는 `websocket.service.ts` 가 이미 strip 한 fanout payload(`event.payload`)를 그대로
  전달할 뿐 별도로 raw `outputData`/`llmCalls` 를 재조회하지 않는다 — 우회 경로 없음을
  grep 으로 확인.
- 테스트 데이터의 `'SECRET PROMPT ...'` 류 문자열은 전부 fixture 리터럴이며 실제 시크릿이
  아니다. diff 전체(`codebase/`, `spec/`)에 하드코딩된 API 키/자격증명 패턴 없음(패턴 검색
  결과 0건).
- 이번 diff 범위 밖에서, `spec/5-system/14-external-interaction-api.md` 의 "`nodeOutput`
  일반 키 allowlist" 잔여 항목(author config 값-embedded secret 이 값/키 기반 redaction
  으로는 못 잡는 저위험 gap)은 기존에 이미 문서화된 잔여 결정이며 이번 변경으로 새로 생기거나
  악화된 것이 아니다 — 새 발견으로 등재하지 않음.

### 요약

이번 diff 는 신규 기능이 아니라 이전 라운드에서 지적된 CRITICAL(외부로 나가는 raw LLM
프롬프트/대화 이력 유출)을 두 출구(WS fanout 깊이 무관 strip, REST `getStatus` 세 분기 전부)
모두에서 닫는 보안 수정이다. 필드명 기반 재귀 strip, `__proto__` 오염 방어(스프레드+
`defineProperty`, 테스트로 실증), 자매 sanitizer 와의 깊이 경계 상호작용(실제 파이프라인
sweep + mutation 판별력 실측)까지 충분히 검증되어 있고, fanout 소비처(chat-channel,
notification webhook)에 우회 경로가 없음도 확인했다. 하드코딩된 시크릿·인젝션·인증 우회
등 새로운 취약점은 발견되지 않았다.

### 위험도
NONE
