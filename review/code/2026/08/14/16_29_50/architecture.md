# 아키텍처(Architecture) 코드 리뷰

## 리뷰 범위

`git diff origin/main...HEAD --stat` 기준 실제 애플리케이션 코드 변경은 6개 소스 파일이다:

- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` / `.spec.ts` (신규)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts` / `.spec.ts`

나머지(`CHANGELOG.md`, `plan/**`, `spec/**`, `review/**` 다수)는 문서/프로세스 산출물이라
아키텍처 관점 밖이다. 이 diff 는 이미 5회의 코드 리뷰 라운드(`10_32_27`→`11_02_16`→
`12_06_20`→`14_30_35`→`14_55_29`→`15_58_26`)를 거쳤고, 그 라운드들이 이미 지적·해소한
발견(경계 연산자 `>`/`>=` 불일치, `stripAndRedact` 공용화 검토·미채택 근거, 순서-의존
JSDoc, `__proto__` 방어, null 분기 회귀, 대용량 payload 성능 실측)은 현재 코드로 재확인만
하고 중복 재기재하지 않는다.

## 발견사항

이번 라운드에서 새로 escalate 할 CRITICAL/WARNING 급 구조 결함은 찾지 못했다. 확인 결과는
아래 "확인했으나 문제 없음" 및 참고용 INFO 참조.

- **[INFO]** 재귀 트리 순회(clone-on-write) 스켈레톤이 세 곳에 독립 구현돼 있다 — 상태 불변,
  이미 추적 중인 항목
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 의 `stripDeep`
    함수(파일 하단, `export function stripExternalOnlyFields` 바로 아래) ↔
    `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `sanitizeInner` 함수 ↔
    `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `deepRedactObject`(추정
    함수명, 동일 파일 내 `MAX_REDACT_DEPTH` 사용부)
  - 상세: 세 함수 모두 "재귀 순회 + 변경 여부 추적 + 필요한 서브트리만 clone" 이라는 동일한
    형태를 가지며 판정 조건(필드명 vs secret 패턴)과 치환값(`delete` vs `'[REDACTED]'` vs
    `'***'`)만 다르다. `14_55_29`·`15_58_26` 라운드에서 이미 식별돼 의도적으로 defer 됐고
    (`@see` 상호참조로 최소 연결만 하기로 함), 이번 diff 에서도 상태가 그대로다. 세 함수가
    독립적으로 진화하면 한쪽만 버그를 고치고 나머지 둘에 반영되지 않을 위험이 있다 — 실제로
    이 PR 자체가 "경계 연산자가 형제와 다르다" 는 형태로 같은 클래스의 drift 를 두 번(depth-1
    strip 범위, `>`/`>=` 불일치) 겪었다.
  - 제안: 새 발견 아님. 다음에 이 세 함수 중 하나를 실질적으로 만질 때 공통 고차함수
    추출(`deepTransform(value, depth, predicate, replace)` 형태)을 재검토할 것을 권고.
    지금 강제 리팩터링은 이번 diff 범위를 벗어난다.

- **[INFO]** `stripExternalOnlyFields` 의 `maxDepth` 인자와 경계 연산자(`>` 고정)는 호출부가
  자매 sanitizer 의 상수·연산자와 "같은 안전 지점에서 collapse 한다" 는 불변식에 의존하는데,
  이 불변식은 타입 시스템이 아니라 JSDoc 관례 + 테스트로만 강제된다
  - 위치: `strip-external-only-fields.ts` 상단 JSDoc "## 경계 연산자는 이 함수가 `>` 로
    고정한다" 절, `interaction.service.ts` 의 `stripAndRedact` (`MAX_REDACT_DEPTH` 전달),
    `websocket.service.ts` 의 `emitExecutionEvent`/`emitNodeEvent` (`MAX_SANITIZE_DEPTH` 전달)
  - 상세: 새 표면이 추가될 때 담당자가 `stripExternalOnlyFields(value, someOtherNumber)` 처럼
    자매 상수와 다른 값을 넘겨도 컴파일은 통과한다 — 안전은 "그 깊이에서 자매가 이미 서브트리를
    non-object 로 collapse 했다" 는 런타임 사실에 의존한다. 이 프로젝트는 이미 `15_58_26`
    라운드에서 `stripAndRedact` 류의 공용 승격을 실측 후 명시적으로 기각했다(WS/REST 가 마스커·
    판정범위·토큰·경계연산자·적용위치 5축 모두 달라 강제 공용화가 오히려 오도적이라는 근거표를
    JSDoc 에 남김) — 그 판단은 타당하다고 본다. 다만 그 대가로 "깊이 상수 짝을 맞춘다" 는
    책임은 여전히 호출부 컨벤션에 남아 있고, 이를 강제하는 정적 장치(예: 타입으로 상수 쌍을
    묶는 헬퍼, lint 규칙)는 없다.
  - 제안: 조치 불요(현재 2개 호출부는 실제로 올바른 짝을 쓰고 있고 회귀 테스트로 sweep 됨).
    세 번째 외부 표면이 추가되는 시점에 "짝 상수 누락"을 정적으로 잡을 방법(예: 호출부가
    `{ depth, boundary }` 객체를 자매 모듈에서 export 받아 그대로 전달하도록 강제하는 얇은
    타입)을 재고할 가치는 있다 — 지금 강제하면 과설계다.

## 확인했으나 문제 없음

- **레이어링·순환 의존성**: `shared/utils/strip-external-only-fields.ts` 는 외부 import 가
  전혀 없는 leaf 유틸이고, `interaction.service.ts`(external-interaction 모듈)와
  `websocket.service.ts`(websocket 모듈) 양쪽이 단방향으로만 가져간다
  (`grep -rln stripExternalOnlyFields codebase/backend/src` → 정의 1 + 소비 2, spec 제외).
  두 feature 모듈 간 직접 의존이 생기지 않았다(`interaction.service.ts` 가
  `websocket.service.ts` 를 import 하는 나쁜 대안을 피함). `chat-channel.dispatcher.ts` /
  `notification-fanout.service.ts` 는 `WebsocketService.executionEvents$` 를 구독해 **이미
  strip 된 fanout 스트림**을 받으므로 별도 strip 경로가 필요 없다 — 세 번째 출구가 몰래
  생기지 않았음을 확인.
- **단일 책임 / 응집도**: `stripExternalOnlyFields` 는 필드 삭제 하나의 관심사만 갖고,
  `stripAndRedact`(module-private, `interaction.service.ts`)는 REST 표면의 "strip + redact"
  합성이라는 하나의 관심사를 캡슐화한다. `getStatus` 의 세 출구(waiting `nodeOutput`, terminal
  `result`/`error`)가 전부 같은 `stripAndRedact` 를 호출하도록 리팩터돼, 이 PR 이 세 라운드에
  걸쳐 반복시킨 "출구별 개별 조립" 실패 패턴이 REST 표면 내부에서는 구조적으로 재발 불가능해졌다.
- **개방-폐쇄 원칙(OCP)**: strip 판정 기준이 이름 배열(`EXTERNAL_STRIPPED_FIELDS`)뿐이라 새
  debug 필드 추가 시 배열에 원소 하나만 늘리면 두 소비처(WS fanout·REST snapshot) 모두 자동
  보호된다. `emitNodeEvent`(현재 `llmCalls` 를 담지 않는 node 이벤트)에도 동일 strip 을 미리
  걸어(방어심층화) 향후 확장에 대비한 점도 OCP 에 부합한다.
- **레이어 책임 분리**: `stripAndRedact` 는 `InteractionService` 서비스 계층 내부에서만
  조립되고 controller/guard 계층으로 새지 않는다. 토큰 검증(guard)·엔진 위임(facade)·응답
  정화(이번 헬퍼)가 각자의 책임 선에 머문다. `websocket.service.ts` 도 wire 전달(내부 채널)과
  fanout 정화(외부 채널)를 같은 함수 안에서 명확히 분기해 처리한다.
- **문서-구현 정합**: `spec/5-system/6-websocket-protocol.md` §4.4 / `14-external-interaction-api.md`
  §6.2 가 이번 diff 에서 "깊이 무관·WS+REST 양쪽" 으로 갱신돼 코드 계약과 spec 서술이
  일치한다. `notification-fanout.service.ts` 가 `payload: event.payload` 를 필드명 변경 없이
  그대로 감싸는 것도 spec 갱신에서 확인돼, "채널마다 필드명이 달라진다" 는 과거 오독이 정정됐다.

## 요약

핵심 아키텍처 변화는 `websocket.service.ts` 안에 갇혀 있던 depth-1 shallow strip 을
`shared/utils/strip-external-only-fields.ts` 공용 leaf 유틸로 승격해 깊이 무관 재귀 strip 으로
강화하고, REST(`InteractionService.getStatus`)와 WS fanout 양쪽이 같은 필드-삭제 함수를
공유하게 한 것이다. 순환 의존 없음, 단방향 의존 방향(모듈→공유 유틸), 이름 기반 확장(OCP),
REST 세 출구를 단일 헬퍼로 묶어 "출구별 재조립" 결함 클래스를 REST 표면 내부에서 구조적으로
차단한 점 모두 명확한 개선이다. 5차례의 선행 리뷰가 지적한 이슈(경계 연산자 통일, 공용화
범위, null 분기, 성능 실측)는 실측 근거와 함께 해소돼 있다. 남은 것은 이미 추적 중인 저위험
항목뿐이다: (1) 세 파일에 독립 구현된 재귀 clone-on-write 스켈레톤의 중복(의도적 defer), (2)
깊이 상수/경계 연산자 짝맞춤이 타입이 아닌 컨벤션+테스트로만 강제되는 점(현재 호출부 2곳은
올바르게 지키고 있으나 정적 강제 장치는 없음). 둘 다 이번 diff 의 신규 결함이 아니라 향후
확장 시 재검토할 저위험 관찰이다.

## 위험도

NONE
