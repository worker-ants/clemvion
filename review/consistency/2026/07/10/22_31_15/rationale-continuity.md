# Rationale 연속성 검토 — #501 후속 llm_usage_log 문서 정합화 (docs-only draft)

- 검토 대상: `/private/tmp/claude-501/.../scratchpad/spec-draft.md` (변경 1(a)/2(c)/3(f) + 재검증 (b)/(d))
- 대조 SoT: `spec/data-flow/7-llm-usage.md ## Rationale`, `spec/1-data-model.md ## Rationale` + §2.10.1/§2.13(line 487)/§2.16, `spec/5-system/4-execution-engine.md ## Rationale`

---

## 발견사항

### [Warning] 신설 §2.16.1 의 "잔여 NULL" 열거가 SoT 대비 1건 누락 — "중복 금지" 원칙과 자기모순

- target 위치: draft `## 변경 2 — (c)` 의 "attribution 3열 주석" 불릿 (`spec/1-data-model.md` 신설 §2.16.1 예정 위치)
  > "워크플로우 밖 caller(KB graph 추출·listwise rerank grading·AgentMemory 추출 processor)는 NULL."
- 과거 결정 출처:
  - `spec/data-flow/7-llm-usage.md:113` (§1.3 캡션): "**잔여 NULL** 은 워크플로우 밖·non-node caller(`GraphExtractionService`·`RerankService` listwise·AgentMemory 추출 processor)와 **노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축**뿐이다. 상세는 [§Rationale](#rationale) ... 에 일원화 — 단일 진실."
  - `spec/data-flow/7-llm-usage.md:204-206` (`## Rationale` "`llm_usage_log` 의 nullable context 컬럼들"): "**잔여 NULL** 은 (a) 워크플로우 밖 호출이라 애초에 노드 컨텍스트가 없는 caller(`GraphExtractionService`·AgentMemory 추출 processor)와 (b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise grading, **AI Agent 자동 메모리 롤링 요약 압축**)뿐이다."
  - `spec/data-flow/7-llm-usage.md:107` (§1.3 표 행): "AI Agent 자동 메모리 롤링 요약 압축 (...) | chat | `context` 미전달 → ... 전부 NULL (노드 내부 실행이나 아직 미배선 — 잔여 갭)"
- 상세: 두 곳 모두(§1.3 캡션, Rationale) "잔여 NULL" 캐논 목록은 4개 caller — GraphExtractionService(KB graph 추출) / RerankService listwise grading / AgentMemory 추출 processor / **AI Agent 자동 메모리 롤링 요약 압축**(`agent-memory-injection.ts`) — 인데, draft 가 신설하려는 §2.16.1 "attribution 3열 주석" 불릿은 3개만 열거하고 마지막 "AI Agent 메모리 롤링 요약 압축"이 빠져 있다(사용자가 사전 지적한 대로 확인됨). 이 불릿은 바로 다음 문장에서 "**채움 현황 SoT 는 data-flow §1.3 (중복 금지)**" 라고 명시해 중복을 피하겠다고 선언하면서도, 실제로는 그 요약을 축약 복제하고 있고 그 복제가 이미 부정확하다 — SoT 를 참조만 하지 않고 자체 enumeration 을 작성하는 순간 "단일 진실" 원칙(§1.3 캡션 마지막 문장)과 충돌하는 2차 사본이 생기며, 그 사본이 신설 당일부터 SoT 와 어긋난다.
- 제안: (a) 가장 안전한 방향 — §2.16.1 의 해당 불릿에서 caller 열거를 제거하고 "잔여 NULL 캐논 목록은 [§1.3](../data-flow/7-llm-usage.md#13-caller-카탈로그-코드-기준) 참조"로 단순 cross-ref 만 남긴다(중복 금지 선언과 실제 문면을 일치). (b) 열거를 유지해야 한다면 누락된 "AI Agent 자동 메모리 롤링 요약 압축(노드 내부·미배선)"을 반드시 추가해 4건 전부를 옮긴다 — 3건만 남기면 "워크플로우 밖" 카테고리와 "미배선(노드 내부)" 카테고리를 혼동시켜 §1.3/Rationale 이 명시적으로 구분한 (a) 구조적 부재 vs (b) 배선 누락(후속 여지 있음) 구분이 사라진다.

---

## 정합 확인 완료 (충돌 없음) — 근거 기록

아래 항목들은 사용자가 지정한 대조 축을 모두 대조했으며, Rationale 연속성 위반이 발견되지 않았다.

1. **변경 1(a) "chat 계열만 적재" 정정** (`spec/data-flow/13-agent-memory.md:231`, `spec/data-flow/6-knowledge-base.md:348`)
   - `spec/data-flow/7-llm-usage.md ## Rationale` "모든 호출을 `LlmService` 로 통합" 항(line 172-179)과 "`llm_usage_log` 의 nullable context 컬럼들" 항(line 189-208)은 애초에 "embed 미적재"를 **의도된 설계**(계측 불가에 따른 현행 한계)로 명시하고 있어, target 이 "chat 계열만 적재"로 정정하는 방향은 이 Rationale 을 그대로 반영하는 것이지 번복이 아니다.
   - `13-agent-memory.md:231`/`6-knowledge-base.md:348` 의 "모든 LLM 호출은 적재" 문구는 해당 문서 자신의 `## Rationale` 항목이 아니라 "외부 의존" 표의 cross-ref 한 줄이었다(각 파일 `grep` 결과 두 줄 모두 `## Rationale` 섹션 밖). 즉 과거에 명시적으로 내려진 결정을 뒤집는 것이 아니라 stale cross-ref 를 SoT(`7-llm-usage.md §1.3`)에 맞게 정정하는 것 — 재도입/번복 리스크 없음.

2. **변경 2(c) §2.16.1 신설 vs AuthConfig "전용 로그 엔티티 없이 Execution 재사용" 결정** (`spec/1-data-model.md:487`)
   - line 487 은 **AuthConfig 도메인 한정** 결정이며, 그 안에서 스스로 "(Integration 이 전용 `IntegrationUsageLog`(§2.10.1)를 두는 것과 달리, AuthConfig 의 '호출'은 ... `Execution` 을 재사용)"라고 **Integration 은 전용 로그 엔티티를 갖는다는 사실을 대조군으로 인용**하고 있다 — 즉 "전용 로그 엔티티 지양"이 문서 전반의 일반 원칙이 아니라 AuthConfig 1:1 관계 특유의 최적화임을 스스로 명시. `LlmUsageLog` 는 신규 엔티티가 아니라 V014 부터 이미 존재하는 엔티티(코드 `llm-usage-log.entity.ts`)에 대한 **누락된 문서 서브섹션**을 채우는 것이므로, AuthConfig 결정과 충돌하지 않는다.
   - **보존 기간 대비**: `spec/1-data-model.md §2.10.1`(IntegrationUsageLog, line 330)의 "90일 보존 + 일일 배치 정리"는 그 근거가 문서 내 별도 `## Rationale` 항목으로 존재하지 않고, `2-navigation/4-integration.md` 의 `usage-log-prune` 배치 job 서술(운영 정책)일 뿐이다. `LlmUsageLog` 의 "무기한 append-only"는 이미 `spec/data-flow/7-llm-usage.md` 본문 §3(line 147: "상태 머신은 없다. `llm_usage_log` 는 append-only 다")에 기존재하는 서술과 정합하며, `spec/data-flow/9-observability.md` 에도 이를 뒤집는 보존정책 서술이 없다(검색 결과 `llm_usage_log` 관련 보존/정리 문구 전무 — Dashboard 가 raw 테이블을 그때그때 집계하는 이유만 서술). 두 엔티티는 서로 다른 도메인(외부 API 호출 vs LLM 사용량)에서 독립적으로 결정된 보존 정책이라 상충하는 "이미 기각된 결정"이 없다.

3. **변경 3(f) Text Classifier "단발" 명확화** (`spec/5-system/4-execution-engine.md:713`, `CHANGELOG.md:25`)
   - `spec/5-system/4-execution-engine.md ## Rationale` "resume/retry 턴 usage-log attribution — 식별 필드 재유도 불변식 (#501, 2026-07)" 항(line 1378-1384)은 "적용 범위" 문단에서 **resumeState 는 `ai_agent`·`information_extractor` 두 노드에 대해서만** `workflowId`/`nodeExecutionId` 를 실어 나른다고 명시(#877) — Text Classifier 는 이 재구성/재유도 불변식의 적용 대상이 아니다(단발이라 resume 자체가 없음).
   - target 의 변경 3(f) 는 execution-engine.md:713 과 CHANGELOG.md:25 의 "3종 모두 첫 턴·resume 턴을 갖는다"는 식으로 읽히는 모호 서술을 "3종 공통(기록) vs 멀티턴 2종 한정(resume 재유도)"으로 분리하자는 것 — 이는 §Rationale 의 "적용 범위" 항을 정확히 반영하는 **교정**이며 번복이 아니다. 오히려 현재 execution-engine.md:713 문면이 Rationale 과 어긋나 있었으므로, target 미적용 시가 오히려 Rationale 불일치 상태로 남는다.
   - draft 의 no-op 판정 (d)("두 재유도 채널"=조작 필드/식별 필드 구분이 이미 `spec/4-nodes/3-ai/1-ai-agent.md:720` + `execution-engine.md §1.3`(line 167, 171)에 반영됨)도 직접 대조 결과 정확 — 두 위치 모두 "조작 필드(`node.config` 재평가) / 식별 필드(호출측 컨텍스트)" 2채널 언어가 이미 존재한다. no-op 판정에 이견 없음.

4. **draft §2.16.1 "record 는 ungated (`?? null`) ... 자매 `IntegrationUsageLog` 의 gated 동작과 대비"** 서술은 `execution-engine.md:171`/`:1384` 의 "`ai_agent` 의 provider-tool `IntegrationUsageLog` 는 게이트드(부재 시 로그 drop)" / "`llm_usage_log`(... **ungated** `?? null` 폴백)" 서술과 정확히 대응 — 정합.

---

## 요약

draft 의 4개 변경(1(a)/2(c)/3(f) + no-op 판정 (b)/(d)) 은 대체로 기존 `## Rationale` 결정을 **뒤집기보다 반영·교정**하는 방향이며, 특히 변경 3(f) 는 execution-engine.md 의 "#501 resume/retry attribution" Rationale 과 현재 본문 사이의 기존 불일치를 바로잡는 정합화다. 유일한 발견은 변경 2(c) 가 신설하는 §2.16.1 이 "채움 현황 SoT 는 data-flow §1.3(중복 금지)"라고 스스로 선언하면서도 그 캐논 "잔여 NULL" 4-caller 목록(GraphExtractionService/RerankService listwise/AgentMemory 추출 processor/AI Agent 메모리 롤링 요약 압축) 중 마지막 1건을 누락한 채 재서술한다는 점 — 기각된 대안의 재도입이나 invariant 위반은 아니지만, 스스로 선언한 "단일 SoT·중복 금지" 원칙과 어긋나는 부정확한 사본을 만들어 신설 당일부터 두 문서 간 drift 를 발생시킨다. WARNING 으로 분류하고, `spec/` 반영 시 해당 불릿을 cross-ref 로 단순화하거나 누락 caller 를 보강할 것을 제안한다.

## 위험도

LOW

STATUS: DONE
