# 신규 식별자 충돌 검토 — spec/conventions/ (--impl-prep)

## 검토 범위에 대한 선행 메모 (중요)

전달된 `naming_collision` 프롬프트(`_prompts/naming_collision.md`, 3,869줄)는 `### 구현 대상 영역: spec/conventions/` 섹션에 **`audit-actions.md` 전문 + `cafe24-api-catalog/` 하위 트리(240개 파일 중 앞쪽 14개 파일, `category/categories.md`까지)만** 담고 있었고, 그 뒤 나머지 **256개 파일은 "컨텍스트 예산 초과로 생략"** 목록에 파일명만 나열됐다. 이 생략 목록에 이번 작업(`plan/in-progress/node-cancellation-residual-signal-propagation.md`)이 실제로 겨냥하는 **`spec/conventions/node-cancellation.md` 본문이 통째로 빠져 있었다** — 즉 이 작업의 진짜 "target 문서"는 번들 예산이 무관한 대형 하위트리(cafe24 API 카탈로그, 240개 파일)에 밀려 프롬프트에 전혀 실리지 못했다.

프롬프트 지시("여기 없다는 사실을 '해당 내용이 없다'의 근거로 삼지 말 것 — 판정에 관련되면 Read 로 직접 열어라")에 따라 `spec/conventions/node-cancellation.md`를 직접 Read 하여 아래 분석을 진행했다. 이 보정이 없었다면 이번 검토는 실제 target과 무관한 cafe24 카탈로그 콘텐츠만으로 "충돌 없음"이라는 거짓 확신을 냈을 것이다.

**하네스 개선 제안**: `--impl-prep scope=spec/conventions/` 처럼 스코프가 디렉토리 전체일 때, 그 안에 `cafe24-api-catalog/`(240개 파일 서브트리) 같은 대형 하위 디렉토리가 있으면 budget 이 그 서브트리 하나에 소진돼 같은 레벨의 다른(더 관련성 높을 수 있는) 파일들이 통째로 밀려나는 구조적 위험이 있다. `pending_plans`가 가리키는 실제 대상 파일(여기서는 `node-cancellation.md`)을 우선 포함하거나, 최소한 대형 서브트리 예산을 상한하는 보정을 검토할 가치가 있다.

## 실제 target 분석 — `spec/conventions/node-cancellation.md` + 관련 plan

`node-cancellation-residual-signal-propagation.md` plan 은 **이미 존재하는** `spec/conventions/node-cancellation.md`(id: `node-cancellation`, status: `partial`)의 §6 구현 현황 표에서 미구현(Planned, `—`)으로 남은 4~5개 항목(chat-channel/MakeShop/Cafe24 노드 signal 전파, workflow timeout 의 노드 abort 통합, IE multi-turn resume signal)을 마저 구현하는 작업이다. 신규 spec 파일이나 신규 엔티티를 만드는 작업이 아니라, **기존에 이미 정의·구현된 메커니즘을 나머지 소비자에 배선**하는 작업이다.

target 문서·plan 이 실제로 참조/사용하는 식별자를 전수 확인한 결과:

| 식별자 | 성격 | 기존 사용처 | 신규 여부 |
|---|---|---|---|
| `ExecutionContext.abortSignal` | 필드 | `node-handler.interface.ts:193`, 이미 §6 표에서 ✓ 구현 | 기존 (신규 아님) |
| `NodeExecution.status = 'cancelled'` | enum 값 | `NodeExecutionStatus.CANCELLED`, V069 migration, `1-data-model.md §2.14` | 기존 |
| `execution.node.cancelled` (WS 이벤트) | 이벤트명 | `5-system/6-websocket-protocol.md:186` 에 이미 정의(payload `{executionId, nodeId, nodeExecutionId, nodeLabel, error}`) — `execution.cancelled`(:179)·`execution.cancel`(:375, 클라이언트 명령)과 이름이 유사하지만 **모두 기존에 이미 구분·정의된 것**이며 본 plan 이 새로 만드는 이름이 아님 | 기존 |
| `assertActiveTimeWithinLimit` / `EXECUTION_TIME_LIMIT_EXCEEDED` | 함수/에러코드 | `execution-engine.service.ts`, `error-codes.ts`, `spec/conventions/error-codes.md`, `spec/5-system/4-execution-engine.md §8` 등 다수 파일에서 이미 일관 사용 (PR2a 로 구현 완료) | 기존 |
| `makeshop-api.client.ts` / `cafe24-api.client.ts` 의 `AbortController`/`signal` | 코드 패턴 | 두 클라이언트 모두 이미 **자체 timeout 전용** `AbortController`를 사용 중(`makeshop-api.client.ts:383,827`, `cafe24-api.client.ts:470,1198`). 이번 잔여 작업은 여기에 `context.abortSignal`을 §4 cascade 패턴(HTTP 노드에서 이미 확립된 `const upstream = context.abortSignal; ...` 패턴)으로 연결하는 것 | 기존 패턴 재사용 — 신규 이름 도입 없음 |

**결론**: 이 plan/target 문서가 새로 도입하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·파일 경로는 **없다**. 전부 기존에 이미 확립된 식별자를 추가 소비자(3개 노드 클라이언트)에 배선하는 작업이라, 6개 점검 관점 중 어느 것도 "새 식별자가 기존과 다른 의미로 충돌"하는 사례를 만들지 않는다.

## 발견사항

- **[INFO]** "cancellation" 용어의 도메인 간 근접
  - target 신규 식별자: (신규 아님) `spec/conventions/node-cancellation.md` — 워크플로 엔진의 노드 실행 중단(AbortSignal 기반) 컨벤션
  - 기존 사용처: 프롬프트에 실제로 번들된 `spec/conventions/cafe24-api-catalog/order/cancellation.md`, `cancellationrequests.md`, `orders__cancellation.md`, `orders__shippingfeecancellation.md` 등 — Cafe24 Admin API 의 **주문 취소(전자상거래 도메인)** entity/endpoint 카탈로그
  - 상세: 두 "cancellation"은 완전히 다른 도메인(워크플로 엔진 노드 abort vs Cafe24 쇼핑몰 주문 취소 API)이며 실제 식별자(타입명·엔드포인트·경로)가 겹치지 않는다 — `spec/conventions/node-cancellation.md` (컨벤션 문서) vs `spec/conventions/cafe24-api-catalog/order/cancellation.md` (카탈로그 entity 문서)로 경로도 구조적으로 분리돼 있다. 다만 이번 잔여 plan 이 정확히 `cafe24-api.client.ts`에 손을 대는 시점이라, 향후 이 클라이언트 코드에 주석/커밋 메시지 등에서 "cancellation" 이라는 단어만으로 검색하면 두 도메인이 섞여 나올 수 있다.
  - 제안: 실제 코드/커밋에서 모호할 수 있는 경우 "node abort" / "signal propagation" 등으로 워크플로 엔진 측을 명시하거나, Cafe24 주문 취소 언급 시 "주문 취소(Cafe24 order cancellation)"로 도메인을 명시. 문서 구조상 이미 충분히 분리돼 있어 강제 조치는 불필요 — 명명 혼동 가능성에 대한 참고 수준.

## 요약

이번 --impl-prep 검토의 실제 대상(`spec/conventions/node-cancellation.md` 및 `plan/in-progress/node-cancellation-residual-signal-propagation.md`)은 신규 spec 식별자를 전혀 도입하지 않는다 — 이미 §6 표에 `✓`로 구현 완료 표시된 `ExecutionContext.abortSignal`/`NodeExecution.status='cancelled'`/`execution.node.cancelled` WS 이벤트/`assertActiveTimeWithinLimit` 등 기존 확립된 메커니즘을 chat-channel·MakeShop·Cafe24 노드 클라이언트 3곳에 마저 배선하는 작업이라, 요구사항 ID·엔티티·엔드포인트·이벤트·환경변수·파일 경로 어느 축에서도 충돌 후보가 나오지 않는다. 다만 이번 checker 프롬프트 번들은 실제 target 파일(`node-cancellation.md`)을 예산 초과로 누락하고 무관한 `cafe24-api-catalog`(240개 파일 서브트리) 콘텐츠로 채워져 있었다 — 직접 Read 로 우회했지만, 하네스의 대형 서브트리 vs 실제 target 우선순위 배분 로직은 별도로 재검토할 가치가 있다. 유일한 실질 발견은 "cancellation" 용어가 워크플로 엔진 도메인과 Cafe24 주문취소 API 카탈로그 도메인 양쪽에서 쓰이는 근접성(INFO)뿐이며, 실제 식별자 충돌은 아니다.

## 위험도

NONE
