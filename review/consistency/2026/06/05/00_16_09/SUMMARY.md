# Consistency Check SUMMARY (--impl-done)

BLOCK: NO

Mode: --impl-done, scope=spec/5-system/17-agent-memory.md (+ 1-ai-agent, 1-data-model, _product-overview)
diff-base: origin/main

> 이 환경에서는 checker fan-out 을 구동하는 Workflow/Agent tool 이 deferred 목록에
> 없어 호출 불가였다. main Claude 가 cross-spec / convention / naming 관점으로 spec
> 편집을 코드와 대조 수기 검토했다. 검토 중 발견한 내부 불일치 2건은 같은 세션에서
> 수정했고, 남은 Critical 없음.

## 검토 대상 변경
- 17-agent-memory: §1 임베딩 모델 출처·scope 인덱스 3-컬럼, §3 임베딩 출처,
  §4 recall queryText fallback·AGM-09 expires_at 갱신 조건, AGM-02 인덱스 문구.
- 1-ai-agent: embeddingModel config 필드, config echo 목록, meta.memory.compactedMessages.
- 1-data-model: AgentMemory scope 인덱스 3-컬럼.
- _product-overview: AGM-02 인덱스 문구 정합.

## Cross-Spec — 수정 후 통과
- (발견·수정) scope 인덱스를 §1 표에서 3-컬럼으로 바꾸면서 AGM-02 요구사항
  문구(17-agent-memory:46, _product-overview:110)는 2-컬럼으로 남아 불일치 →
  둘 다 (workspace_id, scope_key, created_at) 로 정정.
- §2 / data-model:755 의 "(workspace_id, scope_key) 2-튜플" 은 **네임스페이스**
  정의(논리 키)이지 인덱스 컬럼이 아니므로 변경하지 않음(정상).
- embeddingModel SoT 는 17-agent-memory §3 임베딩 출처로 단일화, 1-ai-agent 가
  참조. text-embedding-3-small 최후 폴백 명칭 양 문서 일치.

## Convention Compliance — 통과
- config 필드 표/echo 목록/meta 출력 표 갱신이 기존 optional 필드 echo 규약과
  동일 패턴. embeddingModel 은 memoryTtlDays 뒤 Memory 그룹 일관 배치.

## Naming Collision — 통과
- embeddingModel 은 KB(8-embedding-pipeline) 의 embeddingModel 과 동일 의미(임베딩
  모델 식별자)라 충돌 아닌 의도된 명명 재사용. enqueueNonce 신규 내부 필드 충돌 없음.

## Rationale Continuity — 통과
- AGM-09 expires_at 보존(W1)·M1 dedup livelock 회피 근거가 본문/주석에 명시.

## Plan Coherence — 통과
- 변경은 활성 버그 수정 + 정합성 보정 범위. plan 신규 약속 위반 없음.

## 검증
- npm run build exit 0, jest agent-memory ai-agent 499 passed (직전 동일 코드).
