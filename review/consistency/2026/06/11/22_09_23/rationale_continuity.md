# Rationale 연속성 검토 결과

## 발견사항

### [WARNING] `LLMClient.testConnection` 반환 타입 확장 — embed 반환 메타데이터 정책과의 긴장

- **target 위치**: `plan/in-progress/spec-update-embedding-testconnection.md` §1 (제안 변경), `spec/5-system/7-llm-client.md` 개정안
- **과거 결정 출처**: `spec/5-system/7-llm-client.md §3.3` 및 `## Rationale` "왜 `LlmService.embed` 에 `opts`/`inputType` 을 위치 인자로 추가했나" 항
- **상세**:
  - 기존 spec 에는 두 가지 관련 합의가 병행한다.
    1. `LLMClient.embed` 는 `number[][]` 만 반환한다 — "usage/dimensions 등 메타데이터는 반환하지 않음" (§3.3 주석). `EmbedResponse`(usage/dimensions 포함 응답 객체)는 **Planned** 로 명시적으로 미채택 상태다.
    2. `LLMClient.testConnection(): Promise<boolean>` — 반환 타입은 단순 `boolean`.
  - target 은 `testConnection` 서비스 레이어 응답에 `{ success: true, dimension?: number }` 를 추가하는 설계를 제안한다. 이는 `embed()` 호출 결과의 벡터 길이를 **서비스 레이어(LlmService.testConnection)** 에서 추출해 응답에 포함하는 것으로, `LLMClient` 인터페이스(`testConnection(): Promise<boolean>`)를 직접 변경하지는 않는다.
  - 문제: spec 에서 "embed 호출 결과로부터 dimension 메타데이터를 추출하는 경로"는 `EmbedResponse` Planned 상태와 연계된 미래 작업으로 보류된 설계다. target 은 testConnection 경로를 통해 이 메타데이터를 우회 추출하는 방식을 채택하면서, 이것이 `EmbedResponse` Planned 트랙과 어떻게 관계되는지 — 그것을 앞당기는 것인지, 독립적인 것인지 — 를 명시하지 않는다.
  - target 의 §3 각주는 "구 `LlmConfigService.findEntity`(chat 고정)를 거치지 않는다"를 의도적 설계 결정으로 명시한다. 이는 `spec/5-system/7-llm-client.md` 의 서비스 레이어가 `testConnection` 을 "기존 chat / testConnection / resolveConfig 유지" (§8.3)로만 기술하고 kind-agnostic 조회 경로에 대한 기록이 없는 상황에서, 번복이 의도됐음은 분명하지만 새 Rationale 의 배치 위치가 target 의 §3 각주에만 있고 실제 spec 문서의 `## Rationale` 에는 없다.
- **제안**: target 이 `spec/5-system/7-llm-client.md §8.3` 에 `testConnection` 의 kind-agnostic 경로와 dimension 반환을 반영할 때, `## Rationale` 에 다음을 명시적으로 기록할 것: (a) `testConnection` 경로의 `dimension` 추출은 `EmbedResponse` Planned 트랙과 독립적인 서비스 레이어 전용 추출이며 `LLMClient` 인터페이스를 변경하지 않는다, (b) kind-agnostic `ModelConfigService.findEntity` 채택은 구 `LlmConfigService` chat-고정 경로를 대체하는 의도적 결정이다.

---

### [INFO] `LLMClient.testConnection` 인터페이스 계약과의 레이어 경계 명시 보완

- **target 위치**: `plan/in-progress/spec-update-embedding-testconnection.md` §1 After 블록
- **과거 결정 출처**: `spec/5-system/7-llm-client.md §3.1` — `testConnection(): Promise<boolean>`
- **상세**:
  - target 에서 제안하는 embedding probe 전략 표 (`{ success: true, dimension?: number }` 반환)는 **서비스 레이어(`LlmService.testConnection`)** 의 반환 형태다. `LLMClient` 인터페이스의 `testConnection(): Promise<boolean>` 은 변경되지 않는다.
  - 그러나 target 초안 본문에서 이 레이어 구분이 명시적이지 않아, 독자가 `LLMClient` 인터페이스 자체가 변경된다고 오독할 수 있다.
- **제안**: spec 개정 시 "서비스 레이어의 응답 shape" 와 "`LLMClient` 인터페이스 계약은 불변" 임을 한 줄로 명시해 레이어 경계를 분명히 한다.

---

### [INFO] `dimension` read-only 조건 — `EmbedResponse` Planned 와의 미래 충돌 가능성

- **target 위치**: `plan/in-progress/spec-update-embedding-testconnection.md` §3 (`§B.5 차원(dimension) 행 갱신`)
- **과거 결정 출처**: `spec/5-system/7-llm-client.md §3.3` 참고 블록 — "`EmbedResponse` 도입 시 옵션 객체로 통합 검토"
- **상세**:
  - target 은 dimension read-only 조건을 "저장된 값이 있으면 폼에서 read-only"로 정의하고, testConnection probe 를 통한 자동 저장이 이 조건의 1차 공급원이 된다.
  - 미래 `EmbedResponse` 도입 시 dimension 을 추출하는 경로가 두 개(testConnection probe + 정식 embed 응답)가 되며, 양쪽의 값이 불일치할 경우 read-only SoT 가 어느 쪽인지 spec 이 정의하지 않게 된다.
  - 이는 현재 충돌이 아닌 미래 잠재 갭이다.
- **제안**: spec 개정 시 dimension SoT 는 testConnection probe 결과(마지막 성공 값)이며, 향후 `EmbedResponse` 도입 후에는 embed 호출 응답을 통한 갱신 경로도 추가될 수 있음을 각주로 남긴다. 이렇게 하면 `EmbedResponse` Planned 트랙이 실현됐을 때 충돌 없이 spec 을 확장할 수 있다.

---

## 요약

target 문서(`spec-update-embedding-testconnection.md`)는 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하지는 않는다. 핵심 변경(embedding testConnection 에서 `dimension` 추출, kind-agnostic `ModelConfigService.findEntity` 채택)은 과거 결정을 번복하는 의도된 SPEC-DRIFT 반영이며, target 초안 자체에 번복 근거가 서술돼 있다. 다만 두 가지 긴장이 남는다. 첫째, `LLMClient.embed` 의 "usage/dimensions 메타데이터 미반환" 및 `EmbedResponse` Planned 보류 결정은 dimension 을 testConnection 경로에서만 추출한다는 방식으로 우회되는데, 이 우회가 기존 Planned 트랙과 독립임을 spec `## Rationale` 에 명시하지 않으면 미래 `EmbedResponse` 도입 시 혼선이 생긴다. 둘째, `LLMClient.testConnection` 인터페이스 불변과 서비스 레이어 응답 shape 확장의 레이어 경계가 draft 에서 불분명하다. 양쪽 모두 Critical 수준의 invariant 위반은 아니며, spec 갱신 시 `## Rationale` 에 명시적 기록을 추가하면 해소된다.

## 위험도

LOW
