### 발견사항

- **[INFO]** `_retry_state.json`에 하드코딩된 절대 경로
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/review/consistency/2026/06/06/14_53_44/_retry_state.json` 전체
  - 상세: `session_dir`, `prompt_file`, `output_file` 모든 경로가 `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/...` 로 하드코딩되어 있다. 이 파일은 orchestrator 재시도 상태를 추적하는 용도이므로 machine-local 절대 경로 의존성이 있다. 다른 환경에서 worktree 를 체크아웃하거나 경로가 변경되면 재시도 상태 복원이 불가능해진다. 단, 이 파일은 `review/` 산출물로서 실행 후 재사용 목적이 아니므로 실질적 운영 영향은 없다.
  - 제안: 현재 용도(단일 실행 세션 추적)에서는 허용 가능. 단, orchestrator 가 이 파일을 cross-machine 재사용하는 로직이 있다면 상대 경로 또는 `session_dir` 기준 상대 경로 방식으로 전환 필요.

- **[INFO]** `spec/4-nodes/3-ai/0-common.md` — `ragTopK` 설명 변경이 기존 코드의 동작 기대를 바꿀 수 있음
  - 위치: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/0-common.md` 라인 45
  - 상세: 기존 "기본: 5" 에서 "상한(optional), 미지정 시 동적 점수 컷 결정"으로 의미가 변경된다. spec 변경 자체는 read-only 문서이지만, 실제 구현(`RagSearchService`)이 `ragTopK` 를 mandatory 파라미터로 받는 경우 기본값 `5` 를 주입하는 코드 패스가 있을 수 있다. 해당 코드가 변경 전에 `ragTopK = 5` fallback 로직을 포함한다면, spec 이 변경된 후 developer 단계에서 코드가 따라오기 전까지 spec-impl 불일치 상태가 생긴다. spec 단독 변경으로 런타임 부작용은 없으나, 구현 전까지의 불일치 기간이 존재한다.
  - 제안: spec 편집 완료 직후 `rag-search.service.ts` 에서 `ragTopK` 기본값 `5` hardcoding 또는 fallback 로직이 있는지 확인해 developer 작업 범위에 명시적으로 포함할 것.

- **[INFO]** `spec/1-data-model.md` — `rerank_candidate_k` 설명에 `RAG_RECALL_K` 링크 추가
  - 위치: `/Volumes/project/private/clemvion/spec/1-data-model.md` 라인 345 (변경 후)
  - 상세: `[RAG 검색 §3.4](./5-system/9-rag-search.md#34-동적-점수-컷-생성-주입-모든-모드-공통)` 앵커 링크가 추가됐다. spec 문서의 Markdown 앵커는 한국어 제목을 kebab-case 로 변환한 것으로, 제목이 변경되면 링크가 깨진다. 이 자체는 런타임 부작용이 아니지만 문서 정합성 문제다.
  - 제안: spec 편집 시 `9-rag-search.md §3.4` 의 실제 앵커 ID 를 확인하고 링크 정합성을 검증할 것.

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md` — 예시 JSON에서 `"ragTopK": 5` 제거
  - 위치: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 라인 664 영역
  - 상세: 예시 JSON에서 `"ragTopK": 5` 라인을 제거한다. 이 예시 JSON을 copy-paste 해서 사용하는 외부 통합 문서·API 가이드·클라이언트 SDK 가 있다면 `ragTopK` 없이 동작하는 것으로 인식될 수 있다. 순수 문서 변경이라 런타임 영향은 없으나 공개 API 문서로 기능하는 경우 기존 사용자에게 의미론적 변경이 전달된다.
  - 제안: 마이그레이션 가이드 또는 변경 이력에 "`ragTopK` 기본값 제거 — optional 화" 를 명시할 것.

### 요약

이번 변경 세트는 review 산출물 파일(md/json) 및 spec 문서(md) 신규 추가·수정으로 구성되어 있다. 모든 파일이 정적 문서이므로 전역 상태 변경, 네트워크 호출, 파일시스템 부작용, 이벤트/콜백 변경은 존재하지 않는다. 함수 시그니처나 공개 API 코드 변경도 없다. 주요 부작용 위험은 spec 문서에서 `ragTopK` 의미 변경(기본값 `5` 제거 → optional 화)이 developer 단계 코드 변경 전까지 spec-impl 불일치를 낳는다는 점이며, 이는 spec 변경 단계에서 불가피하게 발생하는 일시적 상태다. `_retry_state.json` 의 절대 경로 하드코딩은 해당 파일의 단일 실행 목적상 수용 가능하다.

### 위험도

LOW
