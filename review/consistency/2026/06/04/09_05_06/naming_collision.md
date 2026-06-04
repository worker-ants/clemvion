## 발견사항

### [WARNING] target §2(RerankConfig.provider)의 `§5.3 SSRF` 참조 링크 오류
- **target 신규 식별자**: `plan/in-progress/spec-draft-rag-reranking.md` §2.2 `baseUrl` 설명의 `[LLM Client §5.3 SSRF](../../spec/5-system/7-llm-client.md)` 앵커
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` — SSRF 가드는 **§5.5 모델 목록 Preview** (line 298)에 정의되어 있음. §5.3은 Google AI 섹션임.
- **상세**: target 원안의 `[LLM Client §5.3 SSRF]` 참조는 잘못된 섹션 번호다. 이미 반영된 worktree 스펙(`spec/1-data-model.md §2.16.1`) 및 `spec/5-system/7-llm-client.md §4.1` 은 `§5.5` 로 올바르게 수정되어 있으나, target plan 파일 §2.2 본문(`baseUrl` 설명)에는 `§5.3 SSRF`가 그대로 남아 있다.
- **제안**: target plan 의 §2.2 `baseUrl` 설명 내 `LLM Client §5.3 SSRF` → `LLM Client §5.5 SSRF` 로 수정. 이미 반영된 spec 파일들은 올바르게 `§5.5`를 가리키고 있으므로 plan 파일 자체의 오기만 정정.

---

### [INFO] `cross_encoder_llm` 모드 의미 변경이 plan 파일 구버전 텍스트에 부분 잔존
- **target 신규 식별자**: `cross_encoder_llm` — target(worktree)에서 "항상 LLM grading(v1 확정, 조건부 escalate 없음)"으로 의미가 변경됨
- **기존 사용처**: 이미 반영된 worktree spec 파일 `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-decisions-dd1d68/spec/5-system/9-rag-search.md` line 172, 180, 187 — 올바르게 "항상 수행" 으로 갱신 완료. 메인 브랜치 `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` line 172, 180 은 아직 구버전("escalate 조건 충족 시").
- **상세**: target plan 파일 §10 에 "반영 완료" 표기가 있고, worktree spec 은 이미 갱신되어 있다. 식별자 자체(`cross_encoder_llm` 열거값)는 동일 — 의미(behavior) 변경이 main 브랜치 spec 에는 아직 미반영인 상태. PR merge 전까지는 동일 식별자가 두 버전으로 공존하는 일시적 상태이며, 이는 worktree 작업의 정상 패턴이다.
- **제안**: 본 worktree PR merge 시 main 브랜치 spec도 자동으로 갱신되므로 별도 조치 불필요. 단, PR body에 `cross_encoder_llm` 의미 변경(escalate → 항상 수행)을 명시해 리뷰어가 인지하도록 권장.

---

### [INFO] `builtin` 프로바이더 값이 프론트엔드에 동명 UI 카테고리 식별자 존재
- **target 신규 식별자**: `RerankConfig.provider = 'builtin'` (Transformers.js 인프로세스 추론, Planned 후속)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/expression/variable-picker.tsx:437` — `toggleCategory("builtin")` — 워크플로우 에디터 변수 피커 내 내장 변수 카테고리 UI 레이블
- **상세**: 의미 도메인이 다르다(표현식 엔진 변수 카테고리 vs 리랭커 provider 열거값). DB/API 에서 `builtin`은 `rerank_configs.provider` 컬럼에 저장되는 값이고, 프론트엔드의 `"builtin"`은 UI 상태 토글 키다. 타입 계층도 분리(`RerankProviderEnum` vs 프론트엔드 로컬 상태)되어 런타임 혼용 경로가 없다. 단 신규 개발자가 코드베이스에서 `builtin` 을 검색할 때 두 맥락이 노출될 수 있다.
- **제안**: Planned 단계이므로 당장 조치는 불필요. `builtin` provider 구현 시 코드 내 enum 이름을 `RerankProvider.Builtin`(TypeScript)로 네임스페이스 분리해 암묵적 혼용을 방지.

---

### [INFO] `RERANK_CONFIG_INVALID` 에러 코드가 기존 `LLM_CONFIG_INVALID` 계열과 중복 우려
- **target 신규 식별자**: `RERANK_CONFIG_INVALID` — `ragDiagnostics.rerank.error` 진단 필드 전용 값
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` line 312 — `LLM_CONFIG_INVALID` (400 HTTP 응답 코드, API 응답 봉투용)
- **상세**: target 및 worktree spec(`9-rag-search.md §6`)에 "rerank 미지원 provider 구성은 구성 시점 검증 실패라 `LLM_CONFIG_INVALID` 계열로 충분하다"고 Rationale §I6이 설명하면서도, 검색 시점 endpoint 호출 실패에 한해 별도 `RERANK_CONFIG_INVALID`를 진단 필드에 사용한다. 두 코드가 완전히 다른 레벨(HTTP 응답 에러 코드 vs 진단 필드 문자열)에서 사용되어 실제 충돌은 없다. 다만 `spec/conventions/error-codes.md` 레지스트리에는 미등재 상태다.
- **제안**: target §7 에서 명시한 대로 spec 반영 시 `error-codes.md` 레지스트리에 `RERANK_ENDPOINT_FAILED` / `RERANK_LLM_GRADING_FAILED` / `RERANK_CONFIG_INVALID` 를 "진단 필드 전용, 노드 실패 아님" 주석과 함께 등재. 현재 worktree spec에는 미등재 상태.

---

## 요약

target 문서(`plan/in-progress/spec-draft-rag-reranking.md`)가 도입하는 신규 식별자(`rerank_mode`, `rerank_config_id`, `rerank_candidate_k`, `rerank_score_threshold`, `rerank_llm_config_id`, `RerankConfig`, `RerankClient`, `RerankClientFactory`, `cross_encoder`/`cross_encoder_llm` 열거값, 에러 코드 3종)는 기존 spec 영역과 이름 충돌이 없다. 이미 worktree spec 6개 파일에 Planned 표기로 반영 완료된 상태이며, 엔티티·타입명·API endpoint·이벤트명·환경변수 수준에서 기존 사용처와의 의미 충돌은 발견되지 않는다. 주요 점검 사항은 (1) target plan 파일 §2.2의 SSRF 참조 섹션 번호 오기(`§5.3` → `§5.5`), (2) `builtin` provider 명이 프론트엔드 UI 카테고리 레이블과 동명이나 도메인·타입이 분리된 INFO 수준, (3) 신규 에러 코드 3종의 conventions 레지스트리 미등재 INFO 수준이다.

## 위험도

LOW
