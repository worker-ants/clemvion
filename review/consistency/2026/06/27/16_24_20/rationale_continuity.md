### 발견사항

- **[INFO]** §372 "불필요해지고" 표현이 ParseEnumPipe 400 강화와 표면적 긴장
  - target 위치: `plan/in-progress/spec-draft-mc-endpoint-spec-sync.md` — 변경 1 (`8-embedding-pipeline.md §371` 업데이트 계획)
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md` Rationale §372 — "`kind='embedding'` ModelConfig 1급화로 `listModels type='embedding'` 필터가 불필요해지고(소스가 이미 embedding kind)"
  - 상세: §372 는 1급화 이후 `type` 필터가 "불필요해진다" 고 기록했다. target 은 §371 업데이트로 컨트롤러 `ParseEnumPipe` 가 허용값 외 400을 반환한다는 명세를 추가한다. §372 의 "불필요"는 서비스 레이어 필터링 의미(embedding kind 소스이므로 redundant)를 가리키고, target 의 ParseEnumPipe 추가는 컨트롤러 입력 검증 계약을 가리켜 대상 레이어가 다르다. target 의 자체 Rationale 도 이 점을 명시한다("필터 의미가 옅어져도 입력 검증 계약은 컨트롤러에 남는다"). 다만 §372 원문 자체는 이 구분을 담지 않아 독자가 "1급화 이후 `?type` 파라미터 전체가 불필요"로 오독할 수 있다.
  - 제안: `8-embedding-pipeline.md §372` 본문에 "(서비스 레이어 type 필터링이 불필요해진다 — 컨트롤러 ParseEnumPipe 입력 검증은 유지)" 괄호 주석을 추가하거나, §371 업데이트 시 §372 의 "불필요해지고" 범위를 "서비스 레이어 type 필터링이 불필요해지고"로 명시 한정한다.

- **[INFO]** `LlmConfigController` stale 참조 정정 — 기존 Rationale 와 정합 확인
  - target 위치: 변경 1 — `8-embedding-pipeline.md §371` Rationale 업데이트 계획
  - 과거 결정 출처: `spec/5-system/7-llm-client.md` Rationale "forwardRef 순환 해소 (refactor-02 C-2 cluster 4)" 항 — 부속 엔드포인트가 `LlmModelConfigController`(llm 모듈)로 재배치된 것을 이미 기록.
  - 상세: `7-llm-client.md` Rationale 에는 C-2 cluster 4 결과로 `LlmModelConfigController` 재배치가 이미 명시돼 있으나, `8-embedding-pipeline.md §371` 은 여전히 구 컨트롤러명 `LlmConfigController`를 참조한다. target 이 이 stale 참조를 정정하는 것은 과거 결정과 완전히 부합한다.
  - 제안: 계획대로 진행. 추가 Rationale 기술 불필요 — 기존 `7-llm-client.md` Rationale 이 C-2 cluster 4 결정 근거를 보유한다.

- **[INFO]** Rate Limiting SoT 단일 표 원칙 — cross-ref 전략 부합 확인
  - target 위치: 변경 3 (`2-api-convention.md §7` 행 추가) + 변경 4 (`7-llm-client.md §5.5` cross-ref 추가)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` Rationale "§11 Webhook 절을 12-webhook.md 로 위임·정합화" — Rate limit SoT 를 §7 표에 집중하고 도메인 spec 에는 참조만 두는 패턴.
  - 상세: target 은 `2-api-convention.md §7` 를 SoT 로 유지하고 `7-llm-client.md §5.5` 에는 cross-ref 만 두겠다는 Rationale 를 명시했다. 이는 기존 Webhook Rate limit 정합화 결정 패턴(도메인 doc 위임, §7 표 단일 SoT)과 완전히 일치한다. 현재 `7-llm-client.md §5.5` 에 `@Throttle(10/60s)` 가 본문에 기술돼 있고, `:id/test`·`:id/models` 두 핸들러의 동일 throttle 은 미기재 상태여서 drift 가 존재한다. cross-ref 추가는 이를 해소한다.
  - 제안: 계획대로 진행. `7-llm-client.md §5.5` 의 `@Throttle(10/60s)` 단독 표기를 "3 probe 공통 `PROVIDER_PROBE_THROTTLE`(10 req/min, 정책 SoT: `spec/5-system/2-api-convention.md §7`)" 형태로 대체하면 더 명확하다.

---

### 요약

target 문서(`spec-draft-mc-endpoint-spec-sync`)가 제안하는 4건의 spec 변경은 모두 이미 머지 완료된 코드의 doc-sync 이며, 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 요소가 발견되지 않았다. 유일한 주의 지점은 `8-embedding-pipeline.md §372` 의 "불필요해지고" 표현이 서비스 레이어 필터링만을 가리키는 것인지 `?type` 파라미터 전체를 가리키는 것인지 불명확하여, target 이 §371 에 ParseEnumPipe 400 동작을 추가할 경우 독자에게 두 기술이 모순처럼 보일 수 있다는 점이다. target 자체 Rationale 에서 이 구분을 이미 명시하고 있으므로 §372 에 소폭 범위 한정 표현을 추가하면 충분히 해소된다. Rate Limiting SoT 단일 표 원칙·컨트롤러 재배치 기록 모두 기존 Rationale 와 정합하며, 과거 결정의 번복이나 암묵적 invariant 위반은 없다.

### 위험도

LOW
