# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-update-llm-embed-signature.md`
검토 모드: spec draft (--spec)

---

## 발견사항

- **[INFO]** target 이 `§5.4` 를 참조하나 해당 섹션이 spec 에 존재하지 않음
  - target 위치: `spec/5-system/8-embedding-pipeline.md §5.4` (plan 의 "Before" 기술)
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md §5` (§5.1~§5.3 만 존재)
  - 상세: plan 의 INFO-19 발견사항이 `§5.4` 의 `LlmService.embed(texts, model, opts, inputType)` 기술을 수정 대상으로 지목한다. 그러나 현행 spec 본문의 §5 는 §5.1(배치 처리)·§5.2(임베딩 모델)·§5.3(벡터 차원) 3개 절만 존재하며 §5.4 는 없다. plan 이 지목한 "Before" 기술 — `LlmService.embed(texts, model, opts, inputType)` — 도 spec 어디에도 없다. 즉 수정 대상 원문 자체가 spec 내에 존재하지 않는 상태로 draft 가 작성됐다.
  - 제안: plan 실행 전 §5.4 가 실제로 spec 에 신설되어야 한다면 그 신설 내용과 함께 draft 에 "After (§5.4 신설)" 형태로 명시한다. 만약 다른 절(예: §5.1 비고 또는 §9-rag-search.md 내 일부)의 오타라면 정확한 위치를 특정해 수정한다.

- **[INFO]** `inputType` 파라미터를 `LlmService.embed` 에 추가하는 제안이 `LLMClient.embed` 인터페이스와의 관계를 기술하지 않음
  - target 위치: plan `### spec/5-system/7-llm-client.md §3.3` → §8.3 추가 pseudo-code 내 `inputType?: 'query' | 'document'`
  - 과거 결정 출처: `spec/5-system/7-llm-client.md §3.3` — "임베딩은 파라미터/응답 객체를 쓰지 않고 평탄한 시그니처를 사용한다" + `LLMClient.embed(texts, model?)` 를 인터페이스로 확정
  - 상세: plan 제안 시그니처에는 `inputType?: 'query' | 'document'` 가 포함된다. 그러나 §3.1 의 `LLMClient` 인터페이스(`embed(texts, model?)`)와 §3.3 의 "평탄한 시그니처" 결정에는 `inputType` 이 없다. 실제 코드(`codebase/backend/src/modules/llm/llm.service.ts:194`)에도 현재 `inputType` 파라미터가 없어, "코드가 옳고 spec 기술이 낡음" 이라는 SPEC-DRIFT 분류 하에 이 파라미터를 추가하는 것은 분류 논리와 모순이다. 서비스 레이어가 `inputType` 을 `LLMClient.embed` 로 어떻게 전달하는지, 또는 서비스 레이어 내부에서만 처리하는지도 기술되지 않았다.
  - 제안: `inputType` 을 이번 draft 에 포함시키려면 (a) 분류를 SPEC-DRIFT 가 아닌 신규 기능 추가로 정정하고, (b) `LLMClient.embed` 인터페이스 확장 여부·프로바이더별 매핑(OpenAI `input_type` 등)을 함께 명시한다. 범위 최소화를 원한다면 `inputType` 을 이번 변경에서 제외하고 별도 Planned 항목으로 분리하는 것이 더 안전하다.

---

## 요약

target plan draft 는 `LlmService.embed` 의 `opts` 파라미터 누락(SPEC-DRIFT)과 `config` 인자 순서 오기(spec 결함) 두 건을 보정하는 scope 이 명확하고, 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 부분은 발견되지 않는다. 다만 두 가지 INFO 급 보완이 필요하다. 첫째, plan 이 수정 대상으로 지목한 `§5.4` 가 현행 `spec/5-system/8-embedding-pipeline.md` 에 존재하지 않아 실행 단계에서 착지점 오류가 발생할 수 있다. 둘째, `inputType` 파라미터는 현재 코드·`LLMClient` 인터페이스 모두에 없으므로, "코드가 옳고 spec 이 낡음" 이라는 SPEC-DRIFT 분류 하에 이를 추가하는 것은 분류 논리와 모순이며 별도 신규 기능 계획으로 분리해야 한다.

---

## 위험도

LOW
