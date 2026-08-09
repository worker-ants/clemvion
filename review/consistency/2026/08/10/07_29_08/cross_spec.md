# Cross-Spec 일관성 검토 — EIA `/cancel` ack shape 정정 + swagger.md §5-1 신설

## 검토 대상

- `spec/5-system/14-external-interaction-api.md` — §5 봉투 각주, §5.4 본문, R16 세 곳에서
  `/cancel` ack body 를 `{executionId, status}` → `InteractAckDto {executionId, accepted, currentStatus}`
  로 정정 (working tree, uncommitted).
- `spec/conventions/swagger.md §5-1` — `*.literal.ts` 형제 DTO enum 공유 SoT 패턴 신설.
- 연계 target 문서: `plan/in-progress/eia-context-schema-followups.md` §잔여 (체크리스트) —
  이번 정정을 "코드가 SoT, spec 이 낡았다" 판정으로 완료 처리.

## 발견사항

검토 결과 CRITICAL/WARNING 레벨 충돌은 발견되지 않았다. 실측 근거는 아래와 같다.

- **[INFO] `EIA_EXECUTION_STATUS_VALUES` 선언 순서가 `spec/1-data-model.md` 의 Execution.status
  서술 순서와 다르다 (값 집합은 동일)**
  - target 위치: (참고용 — 이번 diff 범위 밖) `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts`
  - 충돌 대상: `spec/1-data-model.md:465` — `status | Enum | pending / running / completed / failed / cancelled / waiting_for_input`
  - 상세: `EIA_EXECUTION_STATUS_VALUES` 는 `['pending','running','waiting_for_input','completed','failed','cancelled']`
    순서다. 데이터 모델 서술은 `pending/running/completed/failed/cancelled/waiting_for_input` 순서다.
    **값 집합(6개)은 완전히 동일** — 순서만 다르다. `execution-status.literal.ts` 의 docstring 이
    "엔티티 enum 과 선언 순서가 다르며 그것이 의도(로컬 리터럴이 wire SoT)" 라고 명시적으로 밝히고 있어
    **의도된 divergence** 다. 이 파일 자체는 이번 diff 에 포함되지 않았고(swagger.md·EIA spec 본문만
    변경), 순서 문제는 wire enum(OpenAPI `enum` 배열)에 관한 것이라 `data-model.md` 의 필드 설명
    나열 순서와는 계약 층위가 다르다 — 실질적 충돌은 아니다.
  - 제안: 조치 불요. 필요하면 `data-model.md` 필드 설명에 "wire enum 순서는 EIA DTO SoT 참조" 각주를
    추가할 수 있으나 이번 정정의 범위는 아니다.

## 항목별 확인 결과 (요청받은 4가지 관점)

### 1. 다른 spec 이 `/cancel` 응답을 `{executionId, status}` 로 전제하는가

전수 grep 결과 — **전제하지 않는다.** 오히려 다른 두 영역은 이미 새 shape(`{executionId, accepted,
currentStatus}`)로 기술돼 있었다:

- `spec/data-flow/15-external-interaction.md:99` — `interact`/`cancel` 공용 시퀀스 다이어그램
  (§1.2 제목이 "Inbound — interact / cancel → continuation 재개") 이 이미
  `Svc-->>Ext: 202 Accepted { executionId, accepted, currentStatus }` 로 그려져 있다.
- `spec/7-channel-web-chat/3-auth-session.md:109-110` (R5) — `interact` 의 ack 를
  `InteractAckDto({ executionId, accepted, currentStatus })` 로 이미 정확히 서술하고, "위젯
  eia-client 는 그 ack body 를 소비하지 않는다" 고 명시한다.

즉 이번 정정 이전에는 **EIA spec 문서 자체 내부(§5.1 vs §5.4/R16)의 불일치**가 있었을 뿐, 다른 영역
spec 은 처음부터 옳은 shape 을 참조하고 있었다. 이번 정정은 그 내부 불일치를 없애면서 다른 영역과
**새로 어긋나게 만들지 않고 오히려 정합을 이룬다.**

`spec/7-channel-web-chat/1-widget-app.md`·`2-sdk.md`·`4-security.md` 도 확인했으나 `/cancel` ack
응답의 필드 shape 을 서술하는 곳이 없다(동작 의미론 — "execution 전체 중단" — 만 서술).

### 2. 위젯 코드가 실제로 어느 shape 을 소비하는가

`codebase/channel-web-chat/src/lib/eia-client.ts` 의 `interact()`:

```ts
async interact(
  endpoints: InteractionEndpoints,
  token: string,
  command: InteractCommand,
): Promise<void> {
  const res = await this.fetchImpl(...);
  if (res.status === 410) throw new EiaError("대화 종료됨", 410);
  if (!res.ok) { ... }
}
```

반환 타입이 `Promise<void>` 이고 `res.json()` 을 호출하지 않는다 — **ack body 를 전혀 파싱·소비하지
않는다.** 위젯은 `/cancel` REST 엔드포인트 자체도 호출하지 않고(`InteractionEndpoints.cancel` 필드는
타입에만 존재, 실사용처 없음), 항상 `command: "cancel"` 바디로 `/interact` 를 호출한다
(`use-widget.ts:733,772`). 후속 상태는 SSE 로만 받는다(spec R5 서술과 일치). **결론: spec shape 변경이
위젯에 미치는 런타임 영향은 없다 — 별개의 진짜 결함도 아니다.**

반면 `codebase/packages/sdk/src/client.ts` (별도 npm SDK, 외부 연동용)는 실제로
`POST /api/external/executions/:id/cancel` 을 호출하고 응답을 `InteractAck` 타입으로 파싱한다
(`client.ts:281-296`):

```ts
export interface InteractAck {
  executionId: string;
  accepted: boolean;
  currentStatus?: 'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled';
}
async cancel(...): Promise<InteractAck> { ... return this.parseJsonOrThrow<InteractAck>(res, 'CANCEL_FAILED'); }
```

이 타입·구현·`client.spec.ts` 의 fixture(`{ executionId: 'e', accepted: true }`)가 **이미 새 shape
을 정확히 구현하고 있다.** 이는 plan 의 "코드가 SoT 이고 spec 이 낡았다" 판정을 그대로 뒷받침하는
독립 증거다.

### 3. `swagger.md §5-1` 신설 문단이 다른 conventions 문서와 충돌하는가

충돌 없음.

- `spec/conventions/error-codes.md` — `ErrorCode` enum(에러 코드 식별자)에 대한 규율로, 이번
  신설 문단(응답 DTO 의 **상태값 리터럴** 공유 패턴)과 도메인이 다르다. 겹치는 규칙 없음.
- `spec/conventions/interaction-type-registry.md §4` — "AI 노드 `endReason` — **패키지가 SoT**"
  섹션이 `@workflow/ai-end-reason` 의 `CONVERSATION_END_REASONS` 런타임 배열을 SoT 로 쓰는 유사
  선례를 이미 규정하고 있다. 이는 신설 `*.literal.ts` 패턴과 **동일한 사상**(공유 값 배열을 단일
  파일에 두고 파생 타입/소비처가 import)이라 상호 보강 관계지 충돌이 아니다.

### 4. `EIA_EXECUTION_STATUS_VALUES` 6값이 다른 영역 어휘와 일치하는가

값 집합은 일치한다 — `spec/1-data-model.md:465` 의 Execution.status 6값
(`pending/running/completed/failed/cancelled/waiting_for_input`)과 `EIA_EXECUTION_STATUS_VALUES`
(`pending/running/waiting_for_input/completed/failed/cancelled`)는 **동일 6개 값의 집합**이며
선언 순서만 다르다(위 INFO 항목 참조, 이번 diff 범위 밖·의도된 divergence로 코드에 문서화됨).
`spec/2-navigation/0-dashboard.md:88` 도 같은 6값 세트를 "DTO 의 status enum" 으로 인용하며 일치한다.

## 요약

이번 정정(EIA `/cancel` ack shape 을 `InteractAckDto {executionId, accepted, currentStatus}` 로
맞추고 swagger.md §5-1 을 신설한 것)은 cross-spec 관점에서 **새로운 불일치를 만들지 않는다.**
오히려 `spec/data-flow/15-external-interaction.md` 와 `spec/7-channel-web-chat/3-auth-session.md`
가 이미 참조하고 있던 shape 및 `codebase/packages/sdk/src/client.ts` 의 기존 구현·테스트와
일치시켜, EIA 문서 내부에만 존재하던 §5.1 vs §5.4/R16 불일치를 해소했다. 위젯
(`codebase/channel-web-chat`)은 ack body 를 아예 소비하지 않아(`Promise<void>`) 이번 변경의
영향권 밖이다. `swagger.md §5-1` 신설 문단은 다른 convention 문서와 도메인이 겹치지 않고,
`interaction-type-registry.md` 의 기존 "패키지가 SoT" 패턴과 사상이 일치한다.
`EIA_EXECUTION_STATUS_VALUES` 6값은 `data-model.md` Execution.status 값 집합과 동일하다(순서만
다르며 의도적·이번 diff 범위 밖).

## 위험도

NONE

STATUS=success
