### 발견사항

- **[INFO]** `llmCalls` depth-무관 strip 처방을 REST(`stripAndRedact`)/WS fanout(`emitExecutionEvent`/`emitNodeEvent`) 양쪽에서 재확인 — 경계 산술(`depth > maxDepth` vs `depth >= MAX_REDACT_DEPTH`)을 직접 추적한 결과 depth 10/11 경계에서도 raw `llmCalls` 가 새는 조합을 찾지 못했다 (실제 코드로 검증, positive finding)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `stripDeep()`(`depth > maxDepth` 이면 그대로 반환) / `codebase/backend/src/shared/utils/sanitize-error-message.ts:134`(`if (depth >= MAX_REDACT_DEPTH) return '***';`) / `codebase/backend/src/modules/websocket/websocket.service.ts:252`(`if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`)
  - 상세: REST 경로는 `stripExternalOnlyFields(value, MAX_REDACT_DEPTH)` → `deepRedactSecrets(...)` 순서(strip 먼저)다. strip 은 depth 0~10 은 정상 처리(키 삭제)하고 depth 11+ 는 손대지 않은 채 반환하지만, 뒤이어 도는 `deepRedactSecrets` 가 depth>=10 인 노드를 통째로 `'***'` 문자열로 collapse 하므로 strip 이 못 지운 depth 11+ 서브트리는 그 조상 노드가 `'***'` 로 뭉개지면서 함께 사라진다. WS fanout 경로는 반대 순서(sanitize 먼저, `depth > MAX_SANITIZE_DEPTH` → `'[REDACTED_DEPTH]'`)인데 sanitize 가 이미 depth 11+ 를 문자열로 collapse 해 놓아 뒤이은 strip 이 그 안의 object 를 만날 일이 없다. 즉 "경계 연산자가 자매와 다르다"는 문서화된 비대칭은 두 레이어 중 최소 한쪽이 그 깊이에서 항상 subtree 를 통째로 지운다는 불변식으로 실제로 보완돼 있다. 다만 이는 코드 판독에 의한 검증이며, 앞선 라운드(`11_02_16`)가 실제 파이프라인 실행(depth 0·5·8·9·10·11·12 sweep)으로 이미 검증을 마친 결론과 일치한다.
  - 제안: 조치 불요 — 확인 기록.

- **[INFO]** prototype pollution 방어(`__proto__` 오염 방지)가 `stripDeep()` 에 정확히 구현돼 있다 — `{...obj}` 스프레드로 새 객체를 만든 뒤 `Object.defineProperty` 로 값 대입(bracket 대입 미사용)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `stripDeep()` 내부 `Object.defineProperty(out, k, {...})` 블록
  - 상세: 객체 리터럴 스프레드는 `[[DefineOwnProperty]]` 의미론이라 입력에 own `__proto__` 키가 있어도(예: `JSON.parse` 로 생성된 객체) 진짜 프로토타입 접근자를 타지 않고 own data property 로 복사된다. 그 뒤 `out[k] = s` 대신 `Object.defineProperty` 를 쓰는 것은 `out` 의 생성 방식이 바뀌어 스프레드가 아닌 `{}` 리터럴로 대체되는 회귀가 생겨도 여전히 접근자를 타지 않도록 하는 방어 심층화다. 코드 리딩으로 재확인했고 새로운 취약점 없음.
  - 제안: 조치 불요.

- **[INFO]** `GET /api/external/executions/:id`(REST 스냅샷) 세 출구(`nodeOutput`/`result`/`error`)가 모두 같은 `stripAndRedact` 헬퍼를 통과하도록 통합됐다 — "출구를 각자 조립하면 한 곳만 고쳐진다"던 이전 결함 재발 방지 구조
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` 의 `nodeOutput`/`result`/`error` 세 대입 지점
  - 상세: 세 출구가 개별 `deepRedactSecrets` 호출 대신 단일 `stripAndRedact()` 함수를 공유하므로, 다음에 새 표면이 추가되지 않는 한 이 방어가 재분기될 여지가 구조적으로 없다.
  - 제안: 조치 불요(positive finding). 새 REST 출구를 추가할 때는 반드시 `stripAndRedact()` 를 재사용할 것.

- **[INFO]** 이번 라운드(`21_54_03`)의 실질 코드 델타는 spec 문서(`spec/5-system/14-external-interaction-api.md`)의 `waitingNodeType` 매핑 철회와 JSDoc 실측 수치 추가(`interaction.service.ts` 주석 1개)뿐이며, 보안 관련 로직(`stripDeep`/`stripAndRedact`/`stripExternalOnlyFields`) 자체는 직전 라운드(`16_44_37`, 위험도 LOW·CRITICAL 없음)에서 변경 없음
  - 위치: 커밋 `462455a52`(spec만 변경, `interaction.service.ts` 는 주석 1블록 추가뿐) / 커밋 `85511cafc`(plan 문서만)
  - 상세: `git show 462455a52 -- codebase/`로 직접 대조한 결과 실행 로직 변경은 없고 JSDoc 블록 하나(실측 수치 병기)만 추가됐다. 새로운 인젝션·인증/인가·시크릿 하드코딩·암호화 이슈는 발견되지 않았다.
  - 제안: 조치 불요.

### 요약
이번 diff 의 보안 핵심은 `execution.waiting_for_input` 이벤트의 `llmCalls`(raw LLM 프롬프트/응답) 가 fanout(SSE·webhook·chat-channel)과 REST 스냅샷 두 경로 모두에서 depth-1 shallow strip 을 우회해 새고 있던 CRITICAL 을 이름 기반 depth-무관 strip(`stripExternalOnlyFields`/`stripDeep`)으로 막고, REST 세 출구(`nodeOutput`/`result`/`error`)를 단일 `stripAndRedact` 헬퍼로 묶어 "한 곳만 고쳐지는" 재발 패턴을 구조적으로 차단한 것이다. 코드를 직접 열어 depth 경계 연산자 비대칭(`>` vs `>=`)이 실제로 안전한지, `__proto__` 오염 방어가 올바른지 재확인했고 둘 다 문제없이 구현돼 있다. 새로운 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화는 발견되지 않았다. 이번 라운드의 실질 델타는 spec 문서 정정과 JSDoc 실측 수치 추가뿐으로 신규 보안 리스크가 없다. 유일한 잔여는 이미 이전 라운드에서 성능 카테고리로 등재된 REST 이중 순회 미실측(WARNING, 보안 아님)과, 이미 CHANGELOG/plan 에 disclose 된 과거 노출분(코드로 회수 불가, 운영 판단 대기)이다.

### 위험도
NONE
