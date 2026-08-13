# 정식 규약 준수 검토 — spec-draft-eia-notification-payload-contract.md

## 발견사항

- **[CRITICAL] `spec/conventions/chat-channel-adapter.md` 가 spec_impact 에서 누락 — R3 drift-회피 invariant 붕괴**
  - target 위치: frontmatter `spec_impact:` 목록(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` 만 등재) / §"무엇을 쓸 것인가" §1 (§6.3 재작성) / 체크리스트
  - 위반 규약: `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` 타입 선언 + §Rationale **R3** ("EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union 만 정의. 두 spec 간 type drift 회피. 구체 필드의 spec 갱신은 항상 EIA spec 우선.")
  - 상세: `chat-channel-adapter.md` §1.2 는 `EiaEvent` union 을 **참조가 아니라 인라인 TypeScript 타입으로 그대로 복제**해 정의한다. 그 중 `execution.completed` variant 가 정확히 이 draft 가 삭제하려는 필드를 **필수(non-optional)** 로 선언한다:
    ```
    | { type: "execution.completed"; ...; result: { outputs: unknown; finalNodeId: string; finalPort: string }; durationMs: number; ...}
    ```
    draft 는 §6.3 을 다음과 같이 바꾸기로 결정했다 — ① `finalNodeId`/`finalPort` **완전 삭제**(엔진에 개념 자체가 없어 "미구현" 이 아니라 "철회"), ② `result.outputs`·`durationMs` 는 "미구현 (Planned)" 로 격하. 이 draft 가 실제로 적용되면 `chat-channel-adapter.md` 는 (a) 존재하지 않게 될 `finalNodeId`/`finalPort` 를 여전히 필수 필드로 주장하고, (b) "미구현" 으로 격하된 `result.outputs`/`durationMs` 를 여전히 필수로 주장하는 **거짓 문서**가 된다. `finalNodeId`/`finalPort` 는 이 문서 전체에서 `chat-channel-adapter.md` 가 **유일한 교차 참조처**이며(grep 결과 target 자신 외 유일 매치), draft 는 이를 전혀 언급하지 않는다. 이는 draft 자신이 원래 문제로 지목한 "문서가 실제와 근본적으로 다르다 — 외부 계약이 거짓" 패턴을 정확히 conventions 계층에서 재생산하는 것이며, `chat-channel-adapter.md` 가 스스로 표방하는 "SoT 는 EIA spec, drift 회피" invariant 를 이 draft 채택 순간 깨뜨린다.
  - 부수 관찰: 같은 `EiaEvent` union 은 `execution.failed`·`execution.cancelled` 두 variant 에도 `durationMs: number` 를 필수로 선언한다. 그런데 draft 자신의 "실측" 표는 `execution.failed` emit(`{status, error}`)·`execution.cancelled` emit(`{status, result:{cancelledBy}, error?}`)·fanout 봉투(`최상위 result/durationMs 없음`) 어디에도 `durationMs` 가 없다고 명시한다. 즉 `durationMs` 부재는 **completed 만이 아니라 3종 전체**의 문제인데, draft 의 "무엇을 쓸 것인가" §2(§6.4)·§3(§6.5) 는 `durationMs` 를 전혀 다루지 않아 이 갭이 사후에도 정정 대상에서 빠진다.
  - (완화 요인, 참고용): `chat-channel-adapter.md` §3 "EIA / Internal Event → renderNode 매핑" 표의 실제 소비 열은 `execution.completed` 에 대해 `result.outputs` 만 사용한다고 적혀 있어(§1372 의 타입 선언과 달리) `finalNodeId`/`finalPort`/`durationMs` 를 실제로 읽는 소비 코드는 없다 — 즉 **런타임 breakage 는 아니고 문서 레벨 drift**다. 다만 이 project 의 conventions 는 "문서가 실제와 다르면 안 된다" 를 이 draft 의 존재 이유로 삼고 있으므로, 같은 기준을 conventions 문서에도 적용해야 한다.
  - 제안: `spec_impact` 에 `spec/conventions/chat-channel-adapter.md` 추가. §1.2 의 `execution.completed` variant 에서 `finalNodeId`/`finalPort` 제거, `result`/`durationMs` 를 optional(`result?: {...}`, `durationMs?: number`) 또는 "미구현" 주석으로 정정. `execution.failed`/`execution.cancelled` variant 의 `durationMs: number` 도 draft §6.4/§6.5 결정과 맞춰 optional 화 여부를 명시. 체크리스트에 "chat-channel-adapter.md §1.2 EiaEvent 동기화" 항목 추가.

- **[WARNING] §6.3 재작성 예시의 링크 앵커가 placeholder(`#`) — 실제 spec 반영 시 dead link**
  - target 위치: "무엇을 쓸 것인가 §1" 마지막 불릿 — "풍부한 데이터가 필요한 수신자는 [EIA-IN-04 상태 조회](#) 를 가리킨다."
  - 위반 규약: 직접적으로 금지하는 conventions 항목은 없으나, `spec/conventions/` 전반(예: cafe24-api-metadata.md, chat-channel-adapter.md)의 cross-reference 는 예외 없이 `[텍스트](상대경로.md#앵커)` 형태의 실 링크를 쓴다(문서 전역에서 반복 확인됨). `(#)` 는 자기 문서 최상단으로 튀는 dead placeholder 다.
  - 상세: 이 문구가 §6.3 본문에 그대로 옮겨지면 EIA spec 안에 실제 목적지 없는 링크가 남는다. draft 문서 자체는 plan 초안이라 placeholder 가 허용될 수 있으나, "무엇을 쓸 것인가" 절은 최종 spec 문구를 그대로 제시하는 성격이라 실제 반영 시 그대로 복붙될 위험이 있다.
  - 제안: `[EIA-IN-04 상태 조회](14-external-interaction-api.md#eia-in-04-get-apiexternalexecutionsexecutionid)` 형태의 실제 앵커로 교체(§ 번호는 실제 target 문서 확인 필요).

- **[INFO] 리뷰 커버리지 제약 — 본 bundle 이 컨텍스트 예산 초과로 target 과 직접 관련된 다수 conventions 를 절단**
  - target 위치: N/A (리뷰 입력 자체의 한계)
  - 위반 규약: 없음 — target 의 결함이 아니라 조립 파이프라인의 기존 알려진 문제(메모리 `feedback_consistency_spec_mode_budget.md` 와 동일 패턴).
  - 상세: `spec/conventions/error-codes.md`(§6.4 `error.code` 타입/타당성과 밀접), `execution-context.md`, `node-output.md`, `swagger.md`(API 문서 데코레이터 규약), `interaction-type-registry.md`, `redis-keys.md`, `migrations.md`, `spec-impl-evidence.md` 가 전부 "본문 생략됨 — 컨텍스트 예산 초과" 로 절단되어 있다. 반면 이 target 과 관계가 먼 `cafe24-api-catalog/**` 서브파일 수백 개가 앞자리를 차지해 예산을 소모했다. 이 때문에 점검 관점 ②(출력 포맷 규약 — 특히 `error-codes.md` 대비 `error` 객체/코드 형식)·④(API 문서 규약, `swagger.md`)·⑤(금지 항목) 는 **완전히 검증하지 못했다**. 다행히 `chat-channel-adapter.md`(완전 로드됨) 가 §6.4 `error.code` 타당성 검증에 실질적으로 대체 가능한 정보를 제공했으나, `error-codes.md` 자체의 명명 taxonomy 는 대조하지 못했다.
  - 제안: target 자체 수정 사항 아님. 오케스트레이터가 `--spec` 모드의 conventions 번들링 순서/예산 배분을 재검토할 필요(이미 알려진 backlog 항목과 동일 근본 원인으로 보임).

## 요약

가장 중요한 발견은 target draft 가 `spec/5-system/14-external-interaction-api.md` §6.3 의 `finalNodeId`/`finalPort`/`durationMs` 를 삭제·격하하기로 결정하면서, 동일한 필드를 **인라인으로 복제**해 "SoT=EIA spec, drift 회피" 를 명시적으로 표방하는 `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` 타입을 spec_impact 목록·수정 범위에서 빠뜨린 것이다. draft 자신의 핵심 동기("문서가 실제와 다르면 외부 계약이 거짓")가 이 conventions 문서에 그대로 재발한다 — 다만 실제 소비 코드(§3 매핑 표)는 해당 필드를 읽지 않아 런타임 파급은 없다. 그 외 명명 규약·API 문서 데코레이터 규약(swagger.md 등)은 컨텍스트 예산 초과로 완전 검증이 불가능했으며, 이는 target 자체가 아니라 리뷰 파이프라인의 알려진 한계다. 나머지 항목(파일명, frontmatter `spec_impact` 리스트 형식, 문서 3섹션 구조, "미구현(Planned)" 마커 관용구)은 project 관행과 정합한다.

## 위험도

MEDIUM
