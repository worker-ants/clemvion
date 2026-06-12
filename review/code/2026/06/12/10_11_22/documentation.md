### 발견사항

- **[INFO]** `spec/conventions/error-codes.md §3` 과 §4 의 목적 분리가 문서화되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/conventions/error-codes.md` line 62 경계 주석
  - 상세: `§3 Historical-artifact` 예외 레지스트리(active 코드, 부정확한 이름 유지)와 신설 `§4 Rename 이력 (Retired codes)`(은퇴 코드)은 목적이 다르다. §3 하단에 `> §3 은 부정확한 이름이나 유지되는 active 코드의 예외 등록부다. 교체·은퇴된 구 코드의 rename 이력은 §4 에 둔다` 라는 구분 주석이 추가됐다. 이 주석은 최근 변경(§4 신설)의 결과로 올바르게 삽입되어 있으며, §4 의 신설 목적을 독자가 추적하기 충분하다. 추가 문서화 불필요 — 현행 상태 적절.

- **[INFO]** `spec/conventions/error-codes.md §4` 테이블의 PR 컬럼이 실제 PR 번호 없이 `PR4b` 라벨만 기재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/conventions/error-codes.md` line 70~71
  - 상세: `| ... | PR4b | ...` — PR 번호(예: `#554`) 가 아직 미기재다. 이 PR 이 merge 되면 실제 번호로 채워야 한다. PR 번호가 빈칸이면 rename 이력 추적 시 특정 커밋·PR 로 역추적이 불가능하다.
  - 제안: merge 완료 후 PR 번호를 실제 번호로 갱신하는 follow-up 작업을 plan 에 명시하거나, PR description 에 "merge 후 §4 PR 컬럼 채우기" 를 TODO 로 남긴다.

- **[INFO]** `spec/5-system/3-error-handling.md §1.3` 에 `MODEL_CONFIG_DEFAULT_MISSING` 의 발행 서비스가 일부 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/3-error-handling.md` line 51
  - 상세: `MODEL_CONFIG_DEFAULT_MISSING` 설명에 `resolveConfig / resolveEmbedding ws default 경로 (model-config.service.ts 발행)` 라고 기재됐다. `resolveEmbedding` 은 `model-config.service.ts` 뿐 아니라 `knowledge-base.service.ts` 에서도 호출되므로, 발행 경로가 한 서비스에 묶여 보인다. 독자 혼선 가능성은 낮으나, `MODEL_CONFIG_NOT_FOUND` 의 설명 패턴(`model-config.service.ts 발행`)과 일치하도록 서술 범위를 확인할 필요가 있다.
  - 제안: 발행 서비스 명시가 정확한지 확인 후 필요 시 `(model-config.service.ts 발행)` 표기를 그대로 유지하거나 호출 계층 설명을 추가한다.

- **[INFO]** `spec/data-flow/6-knowledge-base.md §1.6 embedding-probe` 의 legacy 파라미터(`llmConfigId`, `embeddingModel`) 가 API 형상에 잔존
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/6-knowledge-base.md` line 231
  - 상세: embedding-probe endpoint body shape 에 `llmConfigId?` 와 `embeddingModel` 이 여전히 명시되어 있다. PR4b 가 legacy step-3(chat piggyback 폴백)를 제거했다면 이 파라미터들도 실제 코드에서 무시되거나 제거됐을 가능성이 있다. spec draft(`spec-update-pr4b-embedding-retire.md`)의 §5 변경 범위에 `data-flow/6 §2` 컬럼 제거는 포함되어 있으나 `§1.6` API shape 는 명시적으로 포함되지 않아 API 문서 드리프트가 발생할 수 있다.
  - 제안: 실제 코드에서 `llmConfigId`·`embeddingModel` 파라미터가 제거됐다면 spec draft 적용 시 `data-flow/6 §1.6` 도 함께 갱신한다.

- **[INFO]** `spec/data-flow/7-llm-usage.md §1` embed 계열 caller 표에 `kb.embeddingModelConfigId` 참조가 spec draft 적용 위치 표에 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/7-llm-usage.md` line 119
  - 상세: 해당 줄은 이미 `resolveEmbedding(kb.embeddingModelConfigId)` 로 갱신되어 있다(legacy `llmConfigId` 제거). 따라서 현재 상태는 올바르다. 다만 `spec-update-pr4b-embedding-retire.md`의 §5 적용 위치 표에 이 파일(`data-flow/7-llm-usage.md`)이 없어, 관련 변경이 이미 반영됐는지 plan 추적 상 확인이 어렵다.
  - 제안: spec draft 적용 위치 요약 표에 `spec/data-flow/7-llm-usage.md` 행을 "(이미 반영됨)" 상태로 추가해 추적 완결성을 확보한다.

- **[WARNING]** CHANGELOG.md 에 PR4b breaking change 가 기록됐으나 `embeddingModel`·`embeddingLlmConfigId` DTO 필드 제거의 영향 대상(엔드포인트)이 명시되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/CHANGELOG.md` line 13
  - 상세: "KB create/update DTO 에서 `embeddingModel`·`embeddingLlmConfigId` 필드 제거 — `POST`/`PATCH /api/knowledge-bases` 요청 body 에 이 두 필드를 보내도 무시된다(silent breaking)" 으로 기록되어 있다. 영향 엔드포인트(`POST /api/knowledge-bases`, `PATCH /api/knowledge-bases/:id`)는 명시됐다. 다만 응답 필드 변경("`KB 응답에서 embeddingLlmConfigId 제거`")의 영향을 받는 응답 schema 참조 — 예: `GET /api/knowledge-bases/:id` 응답 body에서도 해당 필드가 제거됨 — 가 CHANGELOG 에 명시적으로 언급되지 않았다. 외부 소비자가 없으므로 실질적 위험은 낮으나 내부 검색 시 completeness 가 낮다.
  - 제안: CHANGELOG breaking change #3 에 "응답 shape 에서 `embeddingLlmConfigId` 제거 (`GET /api/knowledge-bases`, `GET /api/knowledge-bases/:id` 포함)" 를 명시 보완한다.

- **[WARNING]** `spec/5-system/7-llm-client.md` 내 `LLM_CONFIG_INVALID` 참조 4곳이 갱신되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/7-llm-client.md` line 235, 257, 327 일대
  - 상세: `spec/conventions/error-codes.md §4` 가 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` rename 이력을 등재하고, `3-error-handling.md §1.3` 이 `MODEL_CONFIG_INVALID` 를 카탈로그에 올렸다. 그러나 `7-llm-client.md` 본문에 `LLM_CONFIG_INVALID` 코드명이 여전히 4곳 잔존한다(line 235: 팩토리 래핑 설명, line 257: rerank factory 오류 래핑, line 327: SSRF 가드 차단, line 341: 에러 표). 이 파일만 읽으면 코드 카탈로그와 다른 에러코드명을 기준으로 분기 로직을 작성하게 된다. spec 내 에러코드 이중 표기로 문서 가이드 일관성이 낮다.
  - 제안: `spec-update-pr4b-embedding-retire.md §4` 변경 범위에 7-llm-client.md 내 `LLM_CONFIG_INVALID` 4개소 갱신을 명시적으로 포함한다.

- **[WARNING]** `spec/5-system/8-embedding-pipeline.md §5.5` 의 `MODEL_CONFIG_NOT_FOUND` 에러코드가 2단계 폴백 설명과 일치하지 않을 가능성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/8-embedding-pipeline.md` line 168
  - 상세: 2단계 폴백 중 step-2 ("워크스페이스 default") 가 없으면 `MODEL_CONFIG_NOT_FOUND(404)` 를 반환한다고 기재되어 있다. 그러나 `3-error-handling.md §1.3` 의 갱신된 정의에서 `MODEL_CONFIG_NOT_FOUND` 는 "id 지정 경로 전용" 이고, id 미지정 ws default 부재는 `MODEL_CONFIG_DEFAULT_MISSING(400)` 으로 분리됐다. `8-embedding-pipeline.md §5.5` 의 코드명 표기가 신규 분리 기준과 맞는지 확인이 필요하다.
  - 제안: step-2 에러 경로를 `MODEL_CONFIG_DEFAULT_MISSING(400)` 으로 갱신하고, spec draft §1 변경 범위에 이 수정을 포함한다.

---

### 요약

이번 PR4b 변경에서 CHANGELOG 는 breaking change 를 상세히 기록하고, `spec/conventions/error-codes.md` 에 §4 rename 이력 섹션이 신설됐으며, `spec/5-system/3-error-handling.md`, `spec/5-system/8-embedding-pipeline.md §5.5`, `spec/1-data-model.md §2.16` 등 핵심 spec 문서가 갱신됐다. 문서화 전반의 품질은 높다. 주요 미해결 항목은 두 가지다. 첫째, `spec/5-system/7-llm-client.md` 내 구 에러코드명(`LLM_CONFIG_INVALID`) 4개소가 갱신되지 않아 에러코드 카탈로그와 내부 불일치가 있다. 둘째, `spec/5-system/8-embedding-pipeline.md §5.5` 의 step-2 에러 코드가 신규 분리(`MODEL_CONFIG_DEFAULT_MISSING`)와 맞는지 확인이 필요하다. 나머지 항목(PR 번호 미기재, embedding-probe API shape, CHANGELOG 응답 필드 보완)은 추적성과 완전성 향상을 위한 낮은 우선순위 개선 사항이다.

### 위험도

LOW
