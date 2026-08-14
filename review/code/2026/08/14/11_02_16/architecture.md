# 아키텍처(Architecture) 코드 리뷰

## 리뷰 범위

- 실제 코드 변경 대상은 `codebase/backend/src/modules/websocket/websocket.service.ts` (`stripDeep`/
  `stripExternalOnlyFields` 재작성)와 `websocket.service.spec.ts` (회귀 테스트 추가) 두 파일뿐이다.
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/08/14/10_32_27/**`,
  `review/consistency/2026/08/14/{07_44_12,10_32_29}/**` 는 이전 리뷰/consistency 라운드의 산출물이거나
  plan 문서로, 이 저장소 관례상(`review/`·`plan/` 는 정식 커밋 대상) 코드 아키텍처 관점의 대상이 아니다 —
  해당 산출물이 이미 기록한 발견(proto 오염, 지연 할당, depth 상한 부재 등)은 커밋 로그(`5df89cda6`)와
  현재 `websocket.service.ts` 상태를 직접 대조해 실제로 반영됐는지만 확인했다.

## 발견사항

- **[INFO]** `turnDebug` 필드명이 같은 payload 스키마 안에서 서로 다른 두 shape 로 재사용된다 — name-based strip 설계의 전제(필드명 = 유일한 식별자)를 약화시키는 기존 결함
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:615` (top-level object `{ llmCalls, metadata }`) vs `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts:97` (`turnDebug: state.turnDebugHistory ?? []`, 배열)
  - 상세: 이번 diff 가 채택한 방어 전략(`stripDeep`)은 "필드명이 문서화된 비밀 마커"라는 전제 위에서 이름만으로 위치 무관하게 지운다. 그런데 같은 payload 트리 안에 동일한 키 `turnDebug` 가 완전히 다른 두 shape(객체 vs 배열, 서로 다른 의미)로 존재한다 — 스키마 설계 관점에서 동일 이름-이형 구조(polymorphic naming without discriminator)는 결합도를 낮추기는커녕 소비자가 이름만 보고 shape 을 가정할 수 없게 만드는 안티패턴이다. 이번 leak 자체도 두 개의 서로 다른 중첩 경로를 각각 손으로 추적해야 했던 이유가 바로 이 이름 재사용 때문이다. 이미 `plan/in-progress/spec-draft-eia-62-waiting-payload.md:140-146` 가 이 충돌을 별도 CRITICAL 로 분리해 planner 인계로 명시했고, developer 권한(코드) 밖이라 이번 diff 의 스코프에 넣지 않은 판단은 타당하다.
  - 제안: 이 diff 자체에 조치는 불필요(이미 별도 추적 중). 다만 planner 턴에서 이름 충돌을 해소할 때, `stripDeep` 이 "이름만으로 판단한다"는 전제가 이형 스키마 하에서도 안전한지(즉 이름을 바꾸는 리네임이 strip 정책과 충돌하지 않는지) 함께 검증하도록 그 작업에 각주로 남겨두면 좋다.

- **[INFO]** `stripDeep` 과 형제 함수 `sanitizeInner` 가 "배열/객체 재귀 + 변경 여부 추적 + clone-on-write" 라는 거의 동일한 트리 순회 스켈레톤을 각자 독립적으로 구현한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:386-421` (`stripDeep`) vs `:265-291` (`sanitizeInner`)
  - 상세: 두 함수는 목적(이름 기반 삭제 vs 패턴 기반 마스킹)과 캐싱 여부(`sanitizeInner` 만 depth-0 에서 `SANITIZE_CACHE` 적중)가 달라 즉시 통합이 정답은 아니다. 다만 이번 라운드에서 실제로 발생했던 결함(초판 `stripDeep` 의 `__proto__` 오염, "할당 없음" 주장과 실제 구현 불일치)은 `sanitizeInner` 가 이미 겪었거나 회피한 문제 유형과 같은 클래스다 — 트리 순회 프리미티브가 두 벌로 나뉘어 있으면 한쪽에서 발견된 결함 클래스가 다른 쪽에 잠복해 있을 가능성을 별도로 점검해야 한다(이번엔 우연히 `sanitizeInner` 가 스프레드-선행 초기화라 안전했다). 이는 이미 이전 라운드에서 INFO 로 식별되어 "한쪽 수정 시 짝점검" 관례로 의도적으로 defer 된 사안이며(`RESOLUTION.md` INFO 3), 그 판단에 동의한다 — full-unification 은 strip/redact 의미를 섞을 위험이 더 크다.
  - 제안: 즉시 조치 불요. 이후 두 함수 중 하나를 다시 건드릴 때는 다른 하나도 같은 결함 클래스(특히 `__proto__`/깊이 상한/할당 지연)가 없는지 짝점검하는 관례를 유지할 것.

- **[INFO]** 파일 하나(`websocket.service.ts`, 744줄)가 payload sanitize/strip 유틸리티, execution routing 부착, seq 할당, 여러 이벤트 채널(execution/KB/notification/background)의 facade 를 모두 담당해 계속 커지고 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 전체 — 특히 이번 diff 가 추가한 `stripDeep`(`:386-421`, JSDoc 포함 89줄)
  - 상세: 이 구조 자체는 이번 diff 이전부터 존재한 관례(spec R10 "ExecutionEngine 단일 sink 정책" 을 지키는 facade, `:6-11` 주석)이고, `sanitizePayloadForWs`/`sanitizeInner`/`SANITIZE_CACHE` 도 이미 같은 파일에 있었다. `stripDeep` 추가는 그 패턴을 답습한 것일 뿐 새로운 결합을 만들지는 않는다(파일의 import 목록은 이번 diff 로 바뀌지 않았고, `websocket.service.ts` 는 여전히 `execution-engine` 모듈을 직접 import 하지 않는다 — payload shape 지식은 JSDoc 주석으로만 참조). 다만 "WS transport facade" 와 "payload 보안 정책(credential 마스킹 + 외부 노출 필드 strip)" 은 서로 다른 관심사이고, 후자가 파일 규모의 상당 부분(주석 포함 약 130줄, `:216-421`)을 차지하는 지점까지 왔다.
  - 제안: 지금 당장 분리를 요구할 정도는 아니다(테스트가 같은 파일 단위로 잘 커버하고, 이 저장소는 무거운 JSDoc 주석 관례를 이미 채택 중). 다만 `EXTERNAL_STRIPPED_FIELDS` 에 필드가 더 늘거나 채널별 정책 분기가 필요해지는 시점에는 `sanitizePayloadForWs`/`sanitizeInner`/`SANITIZE_CACHE`/`stripDeep`/`stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 를 `payload-sanitization.ts` 같은 별도 유틸 모듈로 추출해, facade(`WebsocketService`)는 순수 전송/라우팅 책임만 갖도록 하는 편이 응집도에 유리하다.

## 확인했으나 문제 없음 (positive findings)

- **OCP 정합**: strip 기준을 "위치(top-level)" 에서 "이름(`EXTERNAL_STRIPPED_FIELDS` 배열, 어느 깊이든)" 으로 바꾼 것은 정책(무엇을 지울지)과 메커니즘(어떻게 순회할지)을 분리하는 올바른 방향이다 — 새 중첩 경로가 상류(예: `ai-turn-orchestrator.service.ts`)에서 추가돼도 `stripDeep` 자체는 수정할 필요가 없다(`websocket.service.ts:322` `EXTERNAL_STRIPPED_FIELDS`, `:402-407`).
- **호출 순서 결합 제거**: 이전 라운드에서 지적됐던 "`stripDeep` 의 깊이 안전이 `sanitizePayloadForWs` 가 먼저 실행된다는 호출 순서에만 암묵적으로 의존한다"는 결합이, 이번 상태에서는 `stripDeep` 자신이 `MAX_SANITIZE_DEPTH` 를 독립적으로 체크(`:387` `if (depth >= MAX_SANITIZE_DEPTH) return value;`)하도록 고쳐져 해소됐다. 함수 자신의 방어가 됐다는 점에서 결합도가 실제로 낮아졌다.
- **연산 순서가 보안 불변식을 지킨다**: `emitExecutionEvent`/`emitNodeEvent` 양쪽 모두 `stripExternalOnlyFields`(strip) 를 먼저 실행한 뒤 그 결과에 `attachRoutingContext`(routing 필드 부착)를 적용한다(`:571-575`, `:642-646`). `attachRoutingContext` 는 `triggerId`/`workflowId`/`chatChannel`(그마저 `sanitizePayloadForWs` 로 재마스킹)만 추가하므로 strip 이후 단계에서 `llmCalls` 가 재유입될 경로가 없다 — 레이어 순서(strip → enrich)가 구조적으로 보안 경계를 보존한다.
- **순환 의존성 없음**: `websocket.service.ts` 의 import 는 `@nestjs/common`/`rxjs`/동일 모듈 내 `websocket.gateway`/`execution-seq-allocator.service` 뿐이며 이번 diff 로 바뀌지 않았다. `stripDeep` 이 다루는 payload shape 지식은 JSDoc 인용(파일:라인)으로만 존재하고 실제 import 결합은 만들지 않는다 — 모듈 경계가 유지된다.
- **단일 chokepoint 유지**: 외부로 나가는 유일한 스트림(`executionEventSubject`)에 `.next()` 하는 지점은 `emitExecutionEvent`/`emitNodeEvent` 둘뿐이고 둘 다 이번 strip 을 거친다 — 새로운 fan-out 표면이나 우회 경로를 추가하지 않았다.

## 요약

이번 diff 의 실질 아키텍처 변경은 `stripExternalOnlyFields` 의 strip 전략을 "위치 기반 top-level 삭제"에서 "이름 기반 깊이-무관 재귀 삭제"로 바꾼 것이며, 이는 정책과 메커니즘을 분리하는 개방-폐쇄 원칙에 부합하는 개선이다. 이전 라운드에서 지적됐던 호출-순서 의존(암묵적 결합)도 `stripDeep` 자신의 `MAX_SANITIZE_DEPTH` 체크로 해소되어 실제로 결합도가 낮아졌고, strip → routing-context 부착이라는 연산 순서가 보안 경계를 구조적으로 보존한다. 모듈 경계(import 표면)도 이번 diff 로 넓어지지 않았다. 남는 것은 즉시 조치가 필요 없는 세 가지 관찰뿐이다 — (1) `turnDebug` 필드명이 payload 안에서 서로 다른 shape 로 재사용되는 기존 스키마 결함(이미 별도 planner 항목으로 추적 중), (2) `stripDeep`/`sanitizeInner` 의 트리 순회 스켈레톤 중복(이미 의도적으로 defer), (3) `websocket.service.ts` 가 transport facade 와 payload 보안 정책 두 관심사를 계속 한 파일에 누적하고 있는 점(파일이 더 커지면 분리 고려). 셋 다 이번 diff 가 새로 만든 문제가 아니며 CRITICAL/WARNING 급 아키텍처 결함은 발견되지 않았다.

## 위험도

LOW
