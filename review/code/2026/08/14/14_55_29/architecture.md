# 아키텍처(Architecture) 코드 리뷰

## 리뷰 범위

실제 코드 변경은 6개 소스 파일이다: `strip-external-only-fields.ts`(신규, 공유 유틸로 승격)/
`.spec.ts`, `interaction.service.ts`(REST 표면에 `redactAndStrip` 헬퍼 도입)/`.spec.ts`,
`websocket.service.ts`(로컬 `stripDeep`/`EXTERNAL_STRIPPED_FIELDS` 제거 → 공유 유틸 import)/
`.spec.ts`. `CHANGELOG.md`·`plan/**`·`review/**` 는 문서/검토 산출물이라 본 관점 대상이 아니다.
직전 라운드(`11_02_16`, `14_30_35`)의 아키텍처 리뷰가 이미 기록한 발견은 현재 코드 상태와
대조해 반영 여부만 확인했다(중복 재기재하지 않음).

## 발견사항

- **[WARNING]** 공유 유틸의 깊이-경계 안전성 서술이 "자매 sanitizer 가 먼저 실행된다"는 순서를
  전제하는데, 그 서술이 적용되는 두 호출부 중 하나(`interaction.service.ts`)는 실제로 **반대
  순서**로 그 유틸을 부른다 — 결과는 안전하지만(직접 실행으로 실증) 그 이유는 문서가 말하는
  메커니즘이 아니다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:31-40`("경계 연산자는
    이 함수가 `>` 로 고정한다" 절, 특히 39-40행 "상한 밖 서브트리는 그 sanitizer 가 **이미**
    마스킹한 뒤라 여기서 더 볼 것이 없다") 및 `:69-72`(`@param maxDepth` JSDoc, 같은 주장) ↔
    `codebase/backend/src/modules/external-interaction/interaction.service.ts:95-104`
    (`redactAndStrip` — `deepRedactSecrets(stripExternalOnlyFields(value, MAX_REDACT_DEPTH))`,
    **strip 이 안쪽(먼저), redact 가 바깥쪽(나중)**) ↔ 자매 함수
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:134`
    (`if (depth >= MAX_REDACT_DEPTH) return '***';`)
  - 상세: JSDoc 은 "자매가 그 깊이에서 이미 객체를 없앤다"(과거 시제 — 자매가 **먼저** 실행돼
    이미 마스킹을 끝낸 뒤 `stripDeep` 이 그 자리에 도달한다는 전제)를 안전 근거로 명시한다. 이
    서술은 `websocket.service.ts` 호출부(먼저 `sanitizePayloadForWs`로 마스킹 → 그 결과에
    `stripExternalOnlyFields` 적용)에는 정확히 들어맞는다. 그런데 `interaction.service.ts` 의
    `redactAndStrip` 은 이 라운드에서 **의도적으로 순서를 뒤집었다**(비싼 `deepRedactSecrets`
    를 곧 버릴 `llmCalls` 서브트리에 먼저 태우지 않기 위한 성능 최적화, 주석 `:97-101` 로 명시)
    — 즉 `stripExternalOnlyFields` 가 **먼저**, `deepRedactSecrets` 가 **나중**이다. 이 순서에서
    JSDoc 의 인과 서술("자매가 먼저 collapse 해놓아서 내가 볼 게 없다")은 문자 그대로는 거짓이다
    — `stripDeep` 이 깊이 상한(`>` maxDepth) 밖 서브트리를 만나는 시점에 `deepRedactSecrets`
    는 아직 실행되지 않았다.
    직접 실행으로 확인한 결과, 최종 출력은 여전히 안전하다 — 단 그 메커니즘은 문서가 말하는
    것과 **반대**다: `stripDeep` 이 깊이 캡을 넘어 손대지 못한 서브트리를, **나중에 실행되는**
    `deepRedactSecrets` 가 자신의 독립적인 깊이 캡(`>= MAX_REDACT_DEPTH`, 필드명 무관 전체
    subtree 를 `'***'` 로 치환)으로 뒤늦게 덮는다. `llmCalls` 를 depth 11(11중 `{ child: … }`
    래핑)에 심고 `redactAndStrip` 을 태워 직접 실증: 출력에 시크릿 문자열 미포함, 해당
    서브트리는 `"***"` 로 collapse. 즉 "안전"은 참이지만, 그 근거는 "자매가 먼저 지운다"가
    아니라 "**늦게 실행되는 자매가 나중에라도 통째로 지운다**"이며 둘은 인과가 정반대다.
    이 프로젝트는 정확히 이 클래스의 결함("문서한 보장이 실제 구현/호출 그래프보다 넓다")을
    같은 함수의 이전 버전에서 이미 한 번 잡았고(`14_30_35` W3, 경계 연산자 `>`/`>=` 불일치),
    그때도 "안전은 우연이 아니라 X 때문"이라고 정정했는데 — 그 정정 자체가 **호출 순서가
    한 방향(redact-먼저)일 때만** 성립하는 서술이었고, 같은 라운드에서 성능상 그 순서를
    뒤집으면서(W1) 문서를 다시 검증하지 않았다. 두 수정이 같은 파일·같은 라운드에서 서로의
    전제를 깬 채 커밋됐다.
    실무 영향은 낮다 — 데이터 손실(정보 노출) 방향은 아니고(오히려 과잉 마스킹 방향으로만
    작동), `deepRedactSecrets` 자체가 스칼라가 아닌 모든 값을 깊이 상한에서 무조건 치환하는
    한 이 특정 우연은 구조적으로 유지된다. 다만 **검증되지 않은 우연**이라는 점이 문제다 —
    `websocket.service.spec.ts` 는 정확히 이런 종류의 연산자/순서 불일치를 리뷰어 4명이
    갈릴 정도로 심각하게 다뤄 `it.each` 깊이 경계 sweep(`MAX_SANITIZE_DEPTH-5`~`+3`)으로
    실행 결과를 고정했는데(`websocket.service.spec.ts:830-838`), REST 경로
    (`interaction.service.spec.ts`, `strip-external-only-fields.spec.ts`)에는 그런 경계
    sweep 이 없다. 유일한 순서 관련 테스트(`strip-external-only-fields.spec.ts:105-125`,
    "`deepRedactSecrets` 와의 순서를 바꿔도 결과가 같다")는 얕은 nesting(2~3 레벨)만 검증해
    `MAX_REDACT_DEPTH` 경계 근처를 지나지 않는다 — 이번 발견이 실증한 depth-11 케이스는
    어떤 자동 테스트도 커버하지 않는다.
  - 제안: (a) JSDoc 을 "자매가 **먼저** collapse 하거나, 순서가 반대라면 **나중에** collapse
    한다 — 어느 쪽이든 그 경계를 넘는 서브트리는 결국 자매의 깊이 캡에 걸려 스칼라로
    치환된다"처럼 순서-무관 서술로 고쳐 `redactAndStrip` 의 실제 호출 그래프를 정확히
    반영한다. (b) `websocket.service.spec.ts` 의 `it.each` 깊이 sweep 에 대응하는 최소 1개
    테스트를 `interaction.service.spec.ts` 또는 `strip-external-only-fields.spec.ts` 에
    추가해, `llmCalls` 를 `MAX_REDACT_DEPTH` 부근(`-1`/`0`/`+1`)에 심고 `redactAndStrip`
    (또는 그와 동일한 합성)을 태워 결과에 시크릿 문자열이 없음을 직접 확정한다 — "우연히
    안전"에서 "테스트가 보증"으로 전환한다.

- **[INFO]** `stripDeep`(공유 유틸)과 `sanitizeInner`(`websocket.service.ts` 잔류)가 "재귀
  트리 순회 + 변경 여부 추적 + clone-on-write"라는 거의 동일한 스켈레톤을 여전히 별도
  구현하는데, 이번 승격으로 **물리적으로 다른 파일/모듈**에 놓이게 되어 "한쪽 수정 시 짝점검"
  관례(직전 라운드가 명시적으로 채택한 defer 근거)를 지킬 신호가 코드 안에서 약해졌다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:78-119`(`stripDeep`)
    ↔ `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `sanitizeInner`(같은
    파일 내 credential 마스킹용 병렬 재귀 함수)
  - 상세: 같은 파일에 있을 때는 한쪽을 고치며 스크롤하다 다른 쪽을 우연히도 보게 될 확률이
    있었지만, `stripDeep` 이 `shared/utils/`로 옮겨간 지금은 두 함수 사이에 import 관계도
    JSDoc 상호 참조도 없다(각 파일에서 `grep` 확인 — 서로를 언급하지 않음). "짝점검" 관례가
    순전히 review 산출물(`RESOLUTION.md` INFO 3)에만 기록돼 있고 코드에는 흔적이 없다.
  - 제안: 즉시 통합을 요구하진 않는다(목적이 다름 — strip vs redact). 다만 두 함수 중 하나의
    JSDoc에 "자매 트리-순회 구현: `websocket.service.ts` 의 `sanitizeInner` — 같은 클래스의
    결함(예: `__proto__` 오염, 깊이 캡 누락)이 없는지 함께 점검할 것" 같은 상호 참조를 한 줄
    추가하면, 파일이 분리된 뒤에도 짝점검 관례가 코드 자체에서 유지된다.

## 확인했으나 문제 없음 (positive findings)

- **DIP/DRY 개선**: 이전 라운드(`11_02_16`)가 "`websocket.service.ts` 가 transport facade 와
  payload 보안 정책 두 관심사를 계속 누적한다"고 지적했던 것을, 이번 승격이 실제로 해소했다
  — `stripDeep`/`EXTERNAL_STRIPPED_FIELDS`가 `shared/utils/strip-external-only-fields.ts`로
  옮겨가 `websocket.service.ts` 는 import 한 줄(`websocket.service.ts:5`)만 갖는다. 동시에
  `interaction.service.ts` 가 같은 유틸을 재사용하게 되어(`interaction.service.ts:46`), 이
  결함이 세 라운드 반복된 근본 원인("출구마다 로직을 각자 조립")이 구조적으로 제거됐다 — 새
  외부 표면이 생겨도 이 한 함수만 부르면 정책이 자동 적용된다(OCP).
- **순환 의존성 없음**: `shared/utils/strip-external-only-fields.ts` 는 외부 import 가
  전혀 없고(`grep '^import'` 결과 0건), `websocket.service.ts`/`interaction.service.ts` 양쪽만
  단방향으로 그것을 가져간다. 모듈 경계가 깨끗하다.
  - 검증: `grep -rln "stripExternalOnlyFields" codebase/backend/src` → 정의 파일 + 두 소비
    모듈뿐(spec 제외).
- **단일 chokepoint 유지(fanout)**: `notification-fanout.service.ts`/`chat-channel.dispatcher.ts`
  둘 다 `WebsocketService.executionEvents$` 를 구독해 `event.payload` 를 변형 없이 그대로
  쓴다 — 즉 `emitExecutionEvent`/`emitNodeEvent` 가 strip 을 적용한 **하나의 게시 지점**이
  fanout 세 수신자 전체를 커버한다. REST(`getStatus`)는 이벤트 스트림을 타지 않는 별도
  데이터 흐름(DB 읽기)이라 불가피하게 두 번째 호출부가 되지만, **로직**은 공유 유틸 하나로
  수렴했다(코드는 두 곳, 정책은 한 곳).
- **레이어 책임 분리 유지**: `redactAndStrip` 은 `InteractionService` 내부의 module-private
  헬퍼로, controller/guard 계층에 새는 것 없이 서비스 계층 안에서만 조립된다. 토큰 검증
  (guard)·엔진 위임(facade)·응답 정화(이번 헬퍼)가 여전히 각자의 책임 선에 머문다.
- **Open/Closed**: strip 판정 기준이 "이름"(`EXTERNAL_STRIPPED_FIELDS`)뿐이라, 새 debug
  필드가 생기면 배열에 한 원소만 추가하면 두 호출부 모두 자동 보호된다 — 메커니즘
  (`stripDeep`)을 건드릴 필요가 없다.

## 요약

이번 diff 의 핵심 아키텍처 변화는 `websocket.service.ts` 안에만 있던 top-level-only strip
로직을 `shared/utils/strip-external-only-fields.ts` 로 승격해 REST(`InteractionService.
getStatus`)와 fanout(`WebsocketService`) 양쪽이 같은 함수를 공유하게 한 것이다. 이는 "출구를
각자 조립하면 한 번에 하나씩만 고쳐진다"는, 이 결함이 세 라운드 반복된 근본 원인을 구조적으로
제거하는 올바른 방향이고, 순환 의존성·레이어 경계·OCP 관점에서 모두 개선이다. 다만 REST 호출부
(`redactAndStrip`)가 성능상 자매 sanitizer 와의 호출 순서를 의도적으로 뒤집으면서, 공유 유틸의
"왜 깊이 상한이 안전한가" JSDoc(자매가 **먼저** collapse 한다는 전제)이 그 호출부에는 더 이상
문자 그대로 맞지 않게 됐다 — 직접 실행으로 확인한 결과 최종 동작은 안전하지만(자매가 **나중에**
같은 서브트리를 통째로 치환하는, 반대 방향의 우연한 backstop), 이 우연은 어떤 자동 테스트로도
고정돼 있지 않다. 같은 클래스의 문제(깊이 경계 연산자 불일치)를 WS 경로에서는 이미 `it.each`
sweep 으로 실행 검증까지 마쳤는데 REST 경로만 비대칭으로 남아 있다는 점이 이 리뷰의 핵심
지적이다. CRITICAL 급 구조적 결함은 없다.

## 위험도

LOW
