# 문서화(Documentation) 리뷰 결과

**리뷰 대상**: rag-rerank-impl 워크트리 변경 (34개 파일: review/consistency/ 산출물 28개 + spec 파일 6개)
**리뷰 일시**: 2026-06-04

---

## 발견사항

### [WARNING] `spec/5-system/9-rag-search.md` — Rationale 섹션이 plan draft 외부 링크로만 위임됨

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/5-system/9-rag-search.md` 끝부분 (`> 설계 결정·근거·폐기 대안: plan/in-progress/spec-draft-rag-reranking.md ## Rationale`)
- **상세**: 리랭킹 아키텍처의 핵심 설계 결정(완전 선택적 off 기본, KB 소유권 원칙, `rerank_mode` 가변 vs `rag_mode` 불변 비대칭, pointwise 금지, v1 항상-grading 결정, 폐기 대안 4종)이 spec 본문이 아닌 임시 plan draft 파일에만 기록되어 있다. `plan/in-progress/spec-draft-rag-reranking.md` 는 구현 완료 후 `plan/complete/archive/` 로 이동 또는 삭제되므로, 이후 해당 링크가 깨지면 설계 근거 전체가 spec에서 추적 불가능해진다. CLAUDE.md 는 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 에 기록하도록 명시한다.
- **제안**: `spec/5-system/9-rag-search.md` 끝에 `## Rationale` 섹션을 추가하고, spec-draft-rag-reranking.md 의 핵심 내용(완전 선택적·KB 단위·`rerank_mode` 가변 비대칭·`ragThreshold` 이중 해석·v1 항상-grading 결정 근거·폐기 대안 목록)을 옮겨 기록한다. plan 파일이 complete로 이동하기 전 구현 PR 시점에 처리하는 것을 강력 권장.

---

### [WARNING] `spec/5-system/7-llm-client.md` — Rationale 섹션 부재로 RerankClient 분리 결정 근거 미기록

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/5-system/7-llm-client.md` (## Rationale 섹션 없음)
- **상세**: `RerankClient`/`RerankClientFactory`를 `LLMClientFactory` 와 분리한 근거("chat/embedding 팩토리 switch 오염 방지"), SSRF 가드 재사용 방침, `LLM_CONFIG_INVALID` 재사용 결정 등 중요한 설계 결정이 §4.1 인라인 주석으로만 기술되어 있고 `## Rationale` 공식 섹션이 없다. `LLMClientFactory` 통합 capability flag 방식이 기각된 대안임을 공식 문서에서 확인할 수 없어, 향후 구현자가 잘못된 통합 방식을 선택할 수 있다.
- **제안**: `spec/5-system/7-llm-client.md` 에 `## Rationale` 섹션 추가. `9-rag-search.md` Rationale 신설 작업과 동일 PR에 묶어 처리 가능.

---

### [WARNING] `spec/5-system/9-rag-search.md` frontmatter 갱신 — `pending_plans` 가 존재하지 않는 파일 참조

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/5-system/9-rag-search.md` frontmatter `pending_plans: - plan/in-progress/rag-rerank-followup.md`
- **상세**: frontmatter 의 `status: partial` 전이와 `pending_plans` 등록은 올바른 방향이나, 참조된 `plan/in-progress/rag-rerank-followup.md` 파일이 아직 생성되지 않았다. `spec/conventions/spec-impl-evidence.md §3` 에 따르면 `pending_plans:` 에 등록된 파일은 실제로 존재해야 한다. review/consistency 산출물(09_30_18/SUMMARY.md)도 "W6: rag-rerank-followup.md 미생성 — partial-impl pending_plans 등록 불가"를 경고로 명시했다.
- **제안**: 구현 착수 첫 커밋에서 `plan/in-progress/rag-rerank-followup.md` 를 생성하거나, 생성 전까지는 frontmatter 의 `pending_plans` 참조를 유보한다.

---

### [INFO] `spec/5-system/3-error-handling.md` — 신규 에러 코드 2종 인라인 설명의 참조 링크 점검 필요

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/5-system/3-error-handling.md` (신규 행: `EXECUTION_TIME_LIMIT_EXCEEDED`, `WORKER_HEARTBEAT_TIMEOUT`)
- **상세**: 두 코드 모두 `[4-execution-engine §8]` / `[4-execution-engine §7.1]` 로 cross-link가 추가되어 문서화 의도는 양호하다. 단, `spec/conventions/chat-channel-adapter.md:387` 과 `spec/5-system/14-external-interaction-api.md:532` 에서 `EXECUTION_TIMEOUT` 을 여전히 엔진 레벨 코드로 기술하고 있어, `3-error-handling.md` 의 새 정의가 프로젝트 전체 문서와 아직 정합되지 않은 상태다. 사용자 노출 문서(`codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`, `.en.mdx`)도 `EXECUTION_TIMEOUT` 을 "전체 워크플로우 실행 시간 초과"로 기술한다.
- **제안**: 구현 PR에서 `chat-channel-adapter.md`, `14-external-interaction-api.md`, frontend docs 의 `EXECUTION_TIMEOUT` 설명을 함께 갱신하고, `EXECUTION_TIME_LIMIT_EXCEEDED` 를 신규 행으로 추가.

---

### [INFO] `spec/5-system/7-llm-client.md` §3.3.2 인라인 주석 오기 수정 확인

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/5-system/9-rag-search.md` §3.3.2 2단계 주석 (`RerankClient.rerank() — Spec LLM Client §3.6/§4.1`)
- **상세**: 기존 `LLMClient.rerank()` 에서 `RerankClient.rerank()` 로 수정된 것이 본 diff 에 포함되어 있어 오기는 해소되었다. 인라인 주석이 실제 인터페이스 구조를 정확하게 반영한다.
- **제안**: 이상 없음.

---

### [INFO] `spec/5-system/4-execution-engine.md` diff 생략 — 리뷰 범위 확인 불가

- **위치**: 파일 32번 (spec/5-system/4-execution-engine.md) diff 가 "omitted due to prompt size limit" 으로 생략됨
- **상세**: execution-engine spec 은 이번 변경의 핵심 파일 중 하나(intake 큐 §4, heartbeat 폐기 §7.1, 타임아웃 §8 등)로 문서화 관점에서 중요한 변경이 있을 것으로 예상되나, diff 가 제공되지 않아 독스트링·인라인 주석·Rationale 추가 여부를 직접 확인하지 못했다. consistency 리뷰 산출물에서 관련 이슈는 충분히 보고되었으므로 전반적 평가에는 영향이 제한적이다.
- **제안**: 리뷰 워크플로 개선을 위해 핵심 spec 파일의 diff 는 prompt 최우선 순위로 포함 권장.

---

### [INFO] review/consistency 산출물 파일들 — `_retry_state.json` 의 `agents_pending` 상태 불일치

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/review/consistency/2026/06/04/09_05_06/_retry_state.json`, `09_30_18/_retry_state.json`, `09_48_46/_retry_state.json`
- **상세**: 세 `_retry_state.json` 파일 모두 `"agents_success": []`, `"agents_pending": [모든 에이전트]` 상태로 커밋되었다. 실제로 각 세션의 모든 checker가 결과 파일을 생성했음에도 상태 파일이 초기 상태 그대로 남아있다. 이 파일은 재시도 상태 추적용 메타 문서이므로, 산출물 리더가 세션 완료 여부를 판단할 때 혼란을 줄 수 있다.
- **제안**: 결과 파일 형식 또는 규약상 상태 파일을 완료 후 갱신하지 않는 것이 의도된 동작인지 확인. 의도되지 않았다면 세션 완료 시 `agents_success` 에 완료된 에이전트를 이동시키는 cleanup 스텝 추가.

---

### [INFO] `spec/0-overview.md` — §2.4 변경 설명의 밀도 증가, 가독성 확인 권장

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/0-overview.md` §2.4 (line ~225–227)
- **상세**: 기존 2줄(`Message Queue`, `Worker Pool`) 이 1줄의 밀도 높은 설명으로 압축되었다. "execution-run", "active 세그먼트", "in-process dispatch", "per-node task queue 없음", "durable DB park" 등 전문 용어가 단일 bullet에 집약되어 overview 문서의 입문 독자에게 부담이 될 수 있다. 내용의 정확성은 양호하고 cross-link도 포함되어 있다.
- **제안**: 필수 조치는 아님. overview 수준에 맞게 핵심 변경점("execution-level 세그먼트 단위 처리", "per-node queue 없음")만 요약하고 상세는 `spec/5-system/4-execution-engine.md §4` 링크로 위임하는 간결화를 고려.

---

### [INFO] `spec/1-data-model.md` §2.16.1 provider 컬럼 설명 — 1차/Planned 구분 명확화

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/1-data-model.md` §2.16.1 `provider` 행
- **상세**: provider 컬럼 설명이 `**1차 구현: tei** ... **Planned(후속): jina / voyage / local / builtin**` 형태로 갱신되어 구현 범위 구분이 명확해졌다. 문서화 관점에서 개선이다. `base_url` 행에 `[LLM Client §5.5]` cross-link가 포함되어 있어 SSRF 가드 참조도 적절하다.
- **제안**: 이상 없음.

---

## 요약

이번 변경의 문서화 관점 가장 큰 취약점은 spec 설계 결정의 영속성이다. `spec/5-system/9-rag-search.md` 의 리랭킹 Rationale 전체와 `spec/5-system/7-llm-client.md` 의 RerankClient 분리 근거가 임시 plan draft 파일 외부 링크로만 위임되어 있어, plan 파일이 complete/archive 로 이동한 후 spec 자체에서 설계 근거를 추적할 방법이 없어진다. 이 두 건은 WARNING으로 처리했으며 구현 PR 완료 전 해소가 강력 권장된다. `pending_plans` 파일 미생성 문제는 spec-impl-evidence.md 가드와의 직접 충돌이므로 첫 커밋에서 처리해야 한다. 나머지 발견사항은 INFO 수준으로 구현 차단 요인은 아니다. spec 파일들(`0-overview.md`, `1-data-model.md`, `3-error-handling.md`, `7-llm-client.md`, `9-rag-search.md`)의 인라인 설명과 cross-link는 전반적으로 충실하게 갱신되었다.

---

## 위험도

MEDIUM
