# 아키텍처(Architecture) 코드 리뷰

## 리뷰 범위

실제 코드 변경은 6개 소스 파일이다(`git diff origin/main...HEAD -- codebase/`):
`shared/utils/strip-external-only-fields.ts`/`.spec.ts`(신규 — depth-1 shallow delete →
깊이 무관 재귀 strip 공유 유틸로 승격), `modules/external-interaction/interaction.service.ts`/
`.spec.ts`(REST `getStatus` 세 출구에 `stripAndRedact` 헬퍼 적용), `modules/websocket/
websocket.service.ts`/`.spec.ts`(로컬 depth-1 strip 제거 → 공유 유틸 import). 나머지
(`CHANGELOG.md`, `plan/**`, `review/**`)는 문서/검토 산출물이라 본 관점 밖이다. 직전
라운드(`11_02_16`·`14_30_35`·`14_55_29`)가 이미 기록·해소한 발견(경계 연산자 `>`/`>=` 불일치,
순서-의존 JSDoc, `redactAndStrip`→`stripAndRedact` 개명, orphan JSDoc)은 현재 코드로 재확인만
하고 중복 재기재하지 않았다 — 전부 반영 확인됨.

## 발견사항

- **[WARNING]** "출구마다 각자 조립" 문제를 **strip 절반만** 공유 유틸로 승격했고, REST 출구에
  필요한 "strip + redact 합성 레시피"는 여전히 소비 모듈에 비공개로 남아, 이 PR 이 세 라운드에
  걸쳐 반복시킨 바로 그 결함 클래스(출구별 재조립)가 세 번째 외부 표면에서 재발할 구조적 여지가
  남아 있다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:11-21`(`## 왜 공유
    유틸인가` — "처방을 한 곳에 두고 **모든 외부 출구가 같은 것을 부르게** 한다. 새 외부 표면이
    생기면 **여기를** 부르면 된다"— "여기"가 가리키는 대상은 `stripExternalOnlyFields` 단일
    함수뿐이다) ↔ `codebase/backend/src/modules/external-interaction/interaction.service.ts:98`
    (`function stripAndRedact` — module-private, export 없음, `deepRedactSecrets` 와의 합성
    순서·`MAX_REDACT_DEPTH` 짝을 이 파일 밖에서는 재사용할 수 없다) ↔
    `codebase/backend/src/modules/websocket/websocket.service.ts:430,450-453`(`emitExecutionEvent`
    — `sanitizePayloadForWs` 와 `stripExternalOnlyFields` 를 REST 와는 **다른 순서·다른 스코프**
    (payload 대 wireEnvelope 전체)로 독자 합성)
  - 상세: 이번 diff 의 명시 목표(JSDoc·CHANGELOG 모두 동일하게 서술)는 "출구를 각자 조립하면
    한 번에 하나씩만 고쳐진다"는 반복 결함을 구조적으로 없애는 것이었다. 실제로는 필드-삭제
    (`stripExternalOnlyFields`)라는 **절반**만 단일 함수로 수렴했다. 값-마스킹(`deepRedactSecrets`)
    과의 올바른 합성 순서·깊이 상수 짝은 REST 표면에서는 `stripAndRedact`(비공개, `interaction.
    service.ts` 로컬)로, WS 표면에서는 `emitExecutionEvent`/`emitNodeEvent` 내부의 별도 합성으로
    **각각 독립적으로** 존재한다. 두 모듈이 서로 다른 이유로 서로 다른 합성 순서(WS: sanitize→
    envelope 조립→strip 별도 pass, REST: strip→redact 단일 값)를 택한 것은 각 표면의 요구사항상
    합리적이지만(WS 는 envelope 전체를, REST 는 `outputData` 서브트리 하나만 다룬다), 그 결과
    **"외부로 나가는 값은 반드시 strip+redact 를 이 순서·이 상수로 함께 받는다"는 불변식 자체가
    코드 어디에도 단일 함수로 존재하지 않는다** — 오직 두 소비처의 사적 관례로만 존재한다. 이
    프로젝트가 정확히 세 라운드(`10_32_27`→`12_06_21`→`14_30_36`) 동안 "fanout 만 고치고 REST 를
    안 세었다"·"waiting 만 고치고 terminal 둘을 안 세었다" 는 형태로 이 결함을 반복해 왔다는 사실
    자체가, "필드-삭제 하나만" 중앙화하는 것으로는 재발을 막기에 불충분하다는 근거다. 세 번째
    외부 표면(예: GraphQL resolver, 관리자 audit 조회 API 등)이 생기면 담당자는 `stripExternal
    OnlyFields` 만 호출하고 `deepRedactSecrets` 짝을 잊기 쉽다 — JSDoc 이 "여기를 부르면 된다"고
    명시적으로 안내하는 함수가 정확히 그 절반짜리 함수이기 때문이다.
  - 제안: `stripAndRedact` 류의 "strip 후 redact, 같은 깊이 상수" 합성을 `shared/utils/` 로
    승격해(예: `sanitizeForExternalSurface(value, maxDepth)` 또는 `stripAndRedactDeep`) REST 뿐
    아니라 향후 표면도 이 하나만 부르면 두 방어가 함께 딸려오게 한다. WS 표면은 payload/envelope
    스코프가 달라 그대로 못 쓰더라도, 최소한 두 프리미티브를 **함께** 노출하는 상위 함수 하나를
    `shared/utils/strip-external-only-fields.ts` 의 "왜 공유 유틸인가" 절이 가리키도록 해, 다음
    세 번째 소비처가 필드-삭제만 부르고 값-마스킹을 빠뜨리는 경로를 구조적으로 막는다.

- **[INFO]** `stripDeep`(공유 유틸)과 `sanitizeInner`(`websocket.service.ts` 잔류)·`deepRedactObject`
  (`sanitize-error-message.ts`)가 "재귀 트리 순회 + 변경 여부 추적 + clone-on-write"라는 거의 동일한
  스켈레톤을 세 벌 독립 구현한다 — 이미 `14_55_29` 라운드에서 식별·의도적 defer 됐고(RESOLUTION
  INFO 3: "파일 분리로 짝점검이 약해진 건 맞다. `@see` 상호참조는 다음 편집 때") 이번 diff 에서도
  상태 불변(`@see` 상호참조 아직 추가 안 됨). 새 발견 아님 — 계속 추적 중임만 확인.
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:84-125`(`stripDeep`)
    ↔ `codebase/backend/src/modules/websocket/websocket.service.ts:266-292`(`sanitizeInner`) ↔
    `codebase/backend/src/shared/utils/sanitize-error-message.ts`(`deepRedactObject`)

## 확인했으나 문제 없음

- **레이어링·순환 의존성**: `shared/utils/strip-external-only-fields.ts` 는 외부 import 가 전혀
  없는 leaf 유틸이고, `interaction.service.ts`/`websocket.service.ts` 양쪽이 단방향으로만
  가져간다(`grep -rln stripExternalOnlyFields codebase/backend/src` → 정의 1 + 소비 2, spec
  제외). 두 feature 모듈 간 직접 의존이 생기지 않아(예: `interaction.service.ts` 가
  `websocket.service.ts` 를 import 하는 나쁜 대안을 피함) 모듈 경계가 깨끗하고 순환 여지가 없다.
- **OCP**: strip 판정 기준이 이름 배열(`EXTERNAL_STRIPPED_FIELDS`)뿐이라 새 debug 필드 추가 시
  이 배열에 원소 하나만 늘리면 두 소비처(WS fanout·REST snapshot) 모두 자동 보호된다 —
  `stripDeep` 메커니즘 자체를 건드릴 필요가 없다.
  강건화(`emitNodeEvent`)도 이 원칙을 실제로 지킨다 — `websocket.service.ts:521-527` 은 현재
  `llmCalls` 를 담지 않는 node 이벤트에도 동일 strip 을 미리 걸어(방어심층화) 향후 확장에
  대비한다.
- **레이어 책임 분리**: `stripAndRedact` 는 `InteractionService` 내부 module-private 헬퍼로,
  controller/guard 계층에 새지 않고 서비스 계층 안에서만 조립된다. 토큰 검증(guard)·엔진
  위임(facade)·응답 정화(이번 헬퍼)가 각자의 책임 선에 머문다.
- **깊이 상한 파라미터화**: `stripExternalOnlyFields<T>(value, maxDepth)` 가 상한을 호출부
  주입으로 받아, 두 소비처가 각자의 자매 sanitizer(`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH`)와
  동일 상수를 import 해 넘긴다 — 상수 값 자체가 인접 파일에 하드코딩 복제되는 형태(진짜 단일
  값 duplication)가 아니라, 각 소비처가 자신의 짝 상수를 그대로 재사용하는 구조라 값 drift
  경로가 없다(WS: `MAX_SANITIZE_DEPTH` 는 `websocket.service.ts` 안에서 두 곳 모두 같은 참조,
  REST: `interaction.service.ts` 가 `sanitize-error-message.ts` 의 `MAX_REDACT_DEPTH` 를 import
  해 strip·redact 양쪽에 동일 참조로 사용).

## 요약

핵심 아키텍처 변화는 `websocket.service.ts` 안에만 있던 depth-1 shallow strip 을
`shared/utils/strip-external-only-fields.ts` 로 승격해 깊이 무관 재귀 strip 으로 강화하고,
REST(`InteractionService.getStatus`)와 fanout(`WebsocketService`) 양쪽이 같은 필드-삭제 함수를
공유하게 한 것이다. 레이어링·순환 의존성·OCP(필드 이름 기반 확장) 관점에서 명확한 개선이고
CRITICAL 급 구조 결함은 없다. 다만 이 PR 이 반복적으로 겪어 온 "출구마다 각자 조립" 실패
패턴을 근본적으로 막으려면 **필드-삭제 반쪽**이 아니라 **strip+redact 합성 전체**가 재사용
가능한 형태로 공유돼야 하는데, 그 절반(`stripAndRedact`)은 여전히 `interaction.service.ts`
비공개 헬퍼로만 존재해 세 번째 외부 표면이 생겼을 때 같은 결함 클래스가 재발할 구조적 여지가
남아 있다.

## 위험도

LOW
