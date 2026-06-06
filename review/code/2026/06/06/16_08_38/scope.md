# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** 일관성 검토 산출물(review/consistency/)이 spec 변경과 함께 커밋됨
  - 위치: `review/consistency/2026/06/06/14_44_26/rationale_continuity.md`, `review/consistency/2026/06/06/14_53_44/` 디렉터리 전체 (9개 파일)
  - 상세: `review/consistency/**` 는 일관성 검토(`consistency-checker` 역할)의 산출물 위치로, spec 변경과 동일 커밋에 포함됐다. 이 자체는 프로젝트 규약(CLAUDE.md §정보 저장 위치)에서 `review/consistency/**` 가 올바른 저장 위치이므로 위반이 아니다. 단 `_retry_state.json` (내부 오케스트레이터 상태 파일)이 커밋에 포함된 것은 체크할 만하다 — 내용이 민감하지는 않으나 ephemeral 운영 상태 파일이 이력에 남는다.
  - 제안: 인지하고 있다면 수용 가능. 이미 `review/consistency/` 하위이므로 규약 위반은 아님.

- **[INFO]** `spec/5-system/9-rag-search.md` Rationale 섹션 신규 항목 추가가 다수이나 모두 D1/D2 설계 결정에 직접 귀속됨
  - 위치: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` Rationale 섹션 (약 10개 항목 추가)
  - 상세: 추가된 Rationale 항목들(`왜 동적 점수 컷인가`, `왜 θ 를 SQL/rerank 게이트로 유지했나`, `off cosine θ 유지 vs 기각 대안`, `왜 D2 conditional escalate 를 지금 도입하나`, `byte-identical 조항 폐기`, `왜 ragTopK 기본값(5)을 제거했나`, `왜 회수폭/예산/ceiling 을 내부 상수로 두나`, `왜 token-budget 추정에 char/3을 쓰나`, `v1 breaking note` 등)은 모두 이번 PR 범위인 D1(동적 컷)·D2(conditional escalate) 설계를 직접 설명하는 내용이다. Rationale이 많아 보이나 불필요한 리팩토링이나 무관한 영역 수정에 해당하지 않는다.
  - 제안: 이상 없음.

- **[INFO]** `spec/1-data-model.md` 변경 1줄 — `rerank_candidate_k` 설명에 `RAG_RECALL_K` 독립 주석 추가
  - 위치: `/Volumes/project/private/clemvion/spec/1-data-model.md` 라인 342 근처
  - 상세: 일관성 검토 I3 항목(`1-data-model.md §2.11 rerank_candidate_k 설명에 off 경로 주석 추가 고려`)을 반영한 변경이다. 검토 산출물(cross_spec.md INFO I3)이 권장 사항으로 제시한 내용을 spec 편집에 반영한 것으로 작업 범위 내다.
  - 제안: 이상 없음.

- **[INFO]** `review/consistency/2026/06/06/14_53_44/_retry_state.json` 커밋 포함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/review/consistency/2026/06/06/14_53_44/_retry_state.json`
  - 상세: 오케스트레이터의 내부 실행 상태 파일(agents_pending/success/fatal, rate_limit_episodes 등)이다. `review/consistency/` 하위에 위치해 규약상 허용 경로지만, 이 파일은 산출물(검토 결과)이 아니라 오케스트레이터 운영 상태다. 이력에 남길 필요성이 낮다.
  - 제안: 향후 `_retry_state.json` 같은 `_` prefix 내부 파일은 `.gitignore` 처리 고려. 이번 커밋에서는 허용 범위.

## 요약

전체 변경은 RAG 동적 컷(D1) 및 conditional escalate(D2) 도입이라는 하나의 명확한 작업 범위 안에서 이뤄졌다. spec 파일 5개(`9-rag-search.md`, `1-data-model.md`, `0-common.md`, `1-ai-agent.md`, `10-graph-rag.md`, `17-agent-memory.md`)의 수정은 모두 D1/D2 설계에 직접 귀속되며, 무관한 리팩토링·불필요한 주석 정리·추가 기능 확장은 발견되지 않는다. 일관성 검토 산출물 파일들은 규약에서 정한 `review/consistency/**` 위치에 올바르게 저장됐다. `_retry_state.json` 오케스트레이터 상태 파일 포함은 경미한 운영 노이즈이나 범위 위반은 아니다. 의미 없는 포맷팅 변경, 불필요한 임포트 추가, 설정 파일 의도 외 수정 등의 범위 일탈은 없다.

## 위험도

NONE
