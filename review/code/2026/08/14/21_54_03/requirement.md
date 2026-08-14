### 발견사항

- **[INFO]** 브랜치/정본 plan(`plan/in-progress/eia-terminal-payload.md`, "종결(terminal) payload 정리" — `error` 객체화·`durationMs`·`result.outputs`)가 이번 누적 diff(17 commits)에서 전혀 구현되지 않았다 — 해당 plan 은 여전히 `🚫 구현 차단 — --impl-prep BLOCK: YES`, 체크박스 전부 `[ ]`
  - 위치: `plan/in-progress/eia-terminal-payload.md:97-101,139-142`(`## 범위`/`## 체크리스트`)
  - 상세: 실제 코드 델타(`strip-external-only-fields.ts`/`websocket.service.ts`/`interaction.service.ts`)는 이 plan 이 다루는 필드(`error`/`durationMs`/`result.outputs`) 어느 것도 건드리지 않는다. 대신 조사 중 별도로 발견된 `waiting_for_input`/REST `getStatus` 의 `turnDebug.llmCalls` 중첩 누출(보안 결함)을 수정했다. 이는 `plan/in-progress/HANDOFF-eia-terminal-payload.md`·`spec-draft-eia-62-waiting-payload.md`(`## 🔴 조사 중 발견`)에 pivot 경위가 투명하게 기록돼 있어 은폐된 스코프 이탈은 아니다. 다만 "요구사항 충족" 관점에서 보면 **브랜치가 표방하는 1차 요구사항은 이번 diff 로 전혀 진전되지 않았다** — 별도 착수가 필요하다.
  - 제안: 조치 불요(의도된 보류, 문서화 완료). 다음 세션에서 `eia-terminal-payload.md` 를 실제로 착수하거나, 브랜치/plan 관계를 재정리할 것.

- **[INFO]** `stripDeep`(재귀 strip)의 순환 참조 미처리는 명시적으로 문서화된 설계 결정이고, 실 데이터 경로(DB 영속 JSON)에서는 순환이 발생할 수 없어 현재는 안전
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`## 순환 참조` 절, `stripExternalOnlyFields` JSDoc 상단)
  - 상세: `JSON.stringify` 가 직후 순환을 `TypeError` 로 잡아준다는 전제에 기반한 의도적 미처리. `nodeOutput`/`turnDebug` 는 DB JSON 컬럼에서 역직렬화된 값이라 순환이 생길 수 없어 실제 위험은 없다.
  - 제안: 없음(참고 기록).

- **[INFO]** 이번 diff 는 라운드 8회(`10_32_27`~`16_44_37`)에 걸쳐 CRITICAL 다수를 실제 파이프라인 실행·뮤테이션 테스트로 닫았고, 마지막 커밋(`462455a52`)이 남은 두 게이트 결과(consistency CRITICAL 1 `waitingNodeType` SoT 상충, ai-review WARNING 1 REST 이중 순회 미실측)를 실측으로 해소했다 — 확인 결과 정확함
  - 위치: `spec/5-system/14-external-interaction-api.md:706-724`(§R17 blockquote), `codebase/frontend/src/lib/websocket/use-execution-events.ts:304,350,359`, `codebase/channel-web-chat/src/lib/eia-events.ts`(`parseWaitingForInput`)
  - 상세: 직접 grep 으로 재확인 — `use-execution-events.ts` 는 `waitingNodeType` 을 읽고(내부 에디터 WS), `channel-web-chat/src/lib/eia-events.ts` 의 `parseWaitingForInput` 은 `waitingNodeType` 을 전혀 참조하지 않는다(타입 선언 `eia-types.ts:89`·테스트 fixture 에는 값이 있지만 소비 로직에서 미사용). spec 서술("외부 소비 매핑 없음")과 코드가 일치한다.
  - 제안: 없음(positive finding).

### 기능/spec 정합성 상세 검증 (요약)

- **`stripExternalOnlyFields`(`shared/utils/strip-external-only-fields.ts`)**: 깊이 무관 strip(`depth > maxDepth` 경계) + `__proto__` 오염 방지(스프레드 우선 + `defineProperty` 이중 방어) + lazy clone-on-write(참조 동일성 보존) 모두 구현·테스트(177줄, edge case 다수: null/원시값, 빈 변경 없음, 배열 부분 clone, `__proto__`, 깊이 경계, strip↔redact 순서 동치성) 확인됨. TODO/FIXME 없음.
- **`websocket.service.ts`**: fanout 두 지점(`emitExecutionEvent`/`emitNodeEvent`) 모두 `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` 로 통일 호출. 내부 WS wire(`wireEnvelope`)는 strip 이전에 이미 broadcast 되어 있어 불변 유지 확인. 경계 연산자(`>`)가 형제 `sanitizePayloadForWs` 와 일치(둘 다 `depth > MAX_SANITIZE_DEPTH`) — JSDoc 의 "이 함수는 `>` 로 고정" 주장과 실제 코드가 일치.
- **`interaction.service.ts` (`stripAndRedact`)**: waiting `nodeOutput`·terminal `result`·terminal `error` 세 출구 모두 동일 헬퍼를 거치도록 대칭화됨(종전엔 waiting 만 strip 이 걸려 terminal 두 곳이 비대칭이었던 결함이 수정 완료). null/undefined 입력 시 `null` 반환(원래 `deepRedactSecrets(x ?? null)` 동작과 동치) — 테스트(`outputData 가 null 이면 result/error 는 {} 가 아니라 null`)로 회귀 고정. 깊이 경계 수학 직접 검산: strip 은 `depth>10` 만 미처리, redact 는 `depth>=10` 전체를 `'***'` 로 collapse 하므로 redact 의 collapse 범위(≥10)가 strip 의 미처리 범위(>10)를 완전히 포함해 raw 데이터가 새지 않음 — JSDoc 의 "그 경계에서 서브트리를 non-object 로 collapse" 주장과 일치, 실측(깊이 sweep 뮤테이션 테스트)로도 확인됨.
- **spec fidelity**: `spec/5-system/6-websocket-protocol.md` §4.4(1057-1076행 Rationale, 511-520행 표)와 `spec/5-system/14-external-interaction-api.md` §R17(1392-1405행)이 "필드명 기준 깊이 무관 strip", "WS fanout + REST getStatus 양쪽", "strip 후 redact" 순서를 코드와 line-level 로 일치시켜 갱신돼 있음. `waitingNodeType` 오너십 정정(§6.2 blockquote, 706-721행)도 실측(grep)과 일치. SPEC-DRIFT 없음 — 이번 라운드에 이미 spec 을 코드와 동기화 완료.

### 요약

핵심 보안 수정(외부 fanout·REST 스냅샷 양쪽에서 `llmCalls` raw 프롬프트를 깊이 무관으로 제거)은 기능적으로 완전하며, null/undefined/빈 컬렉션/`__proto__` 오염/깊이 경계 등 엣지 케이스가 폭넓게 테스트로 커버돼 있고 TODO/FIXME 잔존물이 없다. 세 출구(waiting/terminal result/terminal error) 비대칭이라는 이전 결함이 공용 헬퍼(`stripAndRedact`)로 구조적으로 재발 불가능하게 닫혔고, strip→redact 순서·깊이 경계 상호작용을 직접 검산한 결과 raw 데이터 누출 경로가 없음을 확인했다. 관련 spec 문서(WS §4.4, EIA §R17, §6.2)도 코드와 line-level 로 일치하도록 이미 갱신돼 spec fidelity 위반이 없다. 유일한 언급 사항은 브랜치가 표방하는 1차 요구사항(종결 payload 정리)이 이번 diff 로 전혀 진전되지 않았다는 점인데, 이는 문서화된 의도적 pivot이라 결함이 아니라 참고 사항(INFO)이다.

### 위험도
NONE
