# 문서화(Documentation) 리뷰 결과

**검토 대상**: `http-ssrf-all-auth` 워크트리 변경 — 주로 `spec/` 문서 갱신 (spec 파일 7개) + `review/consistency/**` 신규 산출물 (파일 37개+)
**검토 일시**: 2026-06-11
**검토 관점**: 독스트링/JSDoc · README · API 문서 · 주석 정확성 · 인라인 주석 · CHANGELOG · 설정 문서 · 예제 코드

---

## 발견사항

### [WARNING] `spec/data-flow/7-llm-usage.md` — 파일명 참조가 구 `llm-config.service.ts`에서 `model-config.service.ts`로 변경됐으나 본문의 인라인 코드 참조가 분산되어 있음
- **위치**: `spec/data-flow/7-llm-usage.md` L45-46
- **상세**: `llm-config.service.ts` → `model-config.service.ts`, `llm-config.controller.ts` → `model-config.controller.ts` 로 구 파일명을 새 파일명으로 갱신했다. 이 업데이트 자체는 정확하다. 그러나 같은 문서 하단에 `llm_config.*`/`rerank_config.*` 관련 서술이 잔존하는지 전체 파일을 확인해야 한다. 변경된 두 줄 외에 `llm-config` 문자열이 문서 내 다른 절에 남아있다면 문서 내 주석 정확성 불일치가 발생한다.
- **제안**: `spec/data-flow/7-llm-usage.md` 전체에 `llm-config` 키워드 잔존 여부 점검 후 일괄 갱신.

### [WARNING] `spec/2-navigation/6-config.md` — `code:` frontmatter의 구 파일 경로 제거 후 신규 경로 문서화 누락
- **위치**: `spec/2-navigation/6-config.md` frontmatter (lines 9-15 기준)
- **상세**: diff에서 `codebase/frontend/src/app/(main)/llm-configs/page.tsx`, `codebase/frontend/src/app/(main)/rerank-configs/page.tsx`, `codebase/frontend/src/components/llm-config/**`, `codebase/frontend/src/lib/api/rerank-configs.ts`, `codebase/frontend/src/lib/api/llm-configs.ts`, `codebase/backend/src/modules/llm-config/**`, `codebase/backend/src/modules/rerank-config/**` 7개 경로가 제거됐다. 이는 PR4 에서 해당 파일들이 삭제/통합됐음을 반영한다. 그러나 spec `code:` frontmatter 는 구현 커버리지의 단일 진실 역할을 하므로, 제거된 경로가 대체된 경로(`codebase/backend/src/modules/model-config/**`)가 frontmatter 에 남아있는지 확인이 필요하다. diff에 따르면 `model-config/**`는 유지되어 있으나, PR4 이후 frontend model config 관련 새 경로(`codebase/frontend/src/components/models/**` 등)가 있다면 frontmatter 에 추가해야 문서 커버리지가 완전해진다.
- **제안**: PR4 이후 신규 frontend/backend 파일 경로를 `code:` frontmatter에 보완.

### [WARNING] `spec/4-nodes/5-data/2-code.md` — `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 미갱신
- **위치**: naming_collision 검토(21_19_55, 발견사항 3)가 이미 지적한 사항
- **상세**: `spec/4-nodes/5-data/2-code.md`는 `EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`, `EXECUTION_MEMORY_EXCEEDED`를 `output.error.details.legacyCode`로 격하하는 정책을 도입했다. `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 이 세 코드의 격하 결정과 정규화 매핑이 등록되어야 하나, 이번 변경에 해당 파일 수정이 포함되지 않았다. 이는 단순 INFO 가 아니라, error-codes.md가 명명 안정성 SoT라고 자기 선언하고 있는 점에서 문서 정합성 경계를 넘는 문제다.
- **제안**: `spec/conventions/error-codes.md §3`에 `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED`, `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 세 매핑을 historical-artifact로 등재.

### [WARNING] `spec/data-flow/1-audit.md` — call site 수 업데이트 완료이나 Rationale 내 "9개 call site" 언급이 분산 잔존 가능
- **위치**: `spec/data-flow/1-audit.md` §Rationale 및 L274
- **상세**: diff는 `9개 call site` → `13개 call site` 를 두 곳에서 갱신했다(§1.1 도입부 + Rationale). 이 갱신은 정확하다. 다만 같은 파일 내 다른 절에서도 숫자를 하드코딩한 표현이 있을 경우 불일치가 남는다. 특히 Rationale 섹션에 "4개 모듈 9개 call site"를 언급하는 문장이 갱신됐는지(L274 기준)를 diff에서 확인했고 반영되어 있다. 문제는 없으나 향후 추가 call site 증가 시마다 두 곳을 동시에 갱신해야 한다는 구조적 fragility가 있다.
- **제안**: Rationale 의 하드코딩 숫자 대신 "§1.1 표가 SoT" 형태의 단방향 참조로 대체하는 것이 유지보수성 향상에 도움.

### [INFO] `spec/1-data-model.md` — "PR4b 이월" 레이블 신규 도입이나 PR4b 계획의 문서화 위치 불명확
- **위치**: `spec/1-data-model.md` L334-337 (`embedding_llm_config_id`, `embedding_model` 필드 설명, ModelConfig 구현 상태 blockquote)
- **상세**: `V092 제거 예정` → `PR4b 제거 예정`으로 레이블이 변경됐고, 구현 상태 blockquote에 "KB legacy embedding 컬럼 정리는 데이터 마이그레이션이 선행돼야 해 PR4b 로 이월"이 추가됐다. "PR4b"는 이 diff에서 처음 등장하는 계획 식별자다. 독자가 PR4b 가 어떤 작업인지 확인할 수 있는 plan 파일 링크나 참조가 없다.
- **제안**: `PR4b` 첫 등장 위치에 `plan/` 내 해당 plan 파일로의 링크 또는 작업 설명 한 줄 추가. 혹은 `unified-model-management.md` 에 PR4b 단계 항목을 명시.

### [INFO] `spec/5-system/3-error-handling.md` — `MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND` 신규 에러 코드 추가는 됐으나 `spec/conventions/error-codes.md`에 등재 여부 불명확
- **위치**: `spec/5-system/3-error-handling.md` L45-47
- **상세**: 두 신규 에러 코드(`MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND`)가 §1.1 API 에러 코드 표에 추가됐다. 이는 적절한 API 문서화다. 그러나 `spec/conventions/error-codes.md`가 UPPER_SNAKE_CASE 에러 코드의 단일 등록부라면, 신규 코드가 그 등록부에도 추가됐는지 이 diff에서는 확인되지 않는다.
- **제안**: `spec/conventions/error-codes.md`에 두 신규 코드 등재 여부 확인 및 보완.

### [INFO] `spec/conventions/chat-channel-adapter.md` — `HTTP_BLOCKED` 분류 추가에 대한 인라인 설명은 있으나 `EMAIL_HOST_BLOCKED`와의 설계 대칭 설명 없음
- **위치**: `spec/conventions/chat-channel-adapter.md` §3.1 표
- **상세**: `HTTP_BLOCKED`(SSRF 차단)가 `executionFailedInternal` 버킷에 추가됐다. `EMAIL_HOST_BLOCKED`는 이미 `executionFailedThirdParty`에 있다. 두 SSRF 차단 코드가 서로 다른 버킷에 분류되는 이유에 대한 설명이 없다. 워크플로우 개발자 관점에서 "왜 HTTP SSRF 는 internal 이고 Email SSRF 는 third-party 인가"가 직관적이지 않다.
- **제안**: 해당 행 또는 표 하단 note에 분류 근거(예: "HTTP 노드는 사용자 제어 URL 요청이므로 internal 분류, Email 은 외부 SMTP 서비스 의존이므로 third-party 분류") 한 줄 추가.

### [INFO] `spec/4-nodes/0-overview.md` — 샌드박싱 표 갱신이 정확하나 `buildSandbox` 참조가 완전히 제거됐는지 확인 필요
- **위치**: `spec/4-nodes/0-overview.md` §5 샌드박싱 표 "실행 격리" 행
- **상세**: diff는 `node:vm` + `buildSandbox` 언급을 `isolated-vm`(V8 Isolate) 설명으로 교체했다. 이는 정확한 갱신이다. 단, `buildSandbox` 함수가 `code.handler.ts`에서 완전히 제거됐는지, 또는 다른 명칭으로 잔존하는지에 대한 기술 확인이 없다. spec 문서에서 폐기 함수명 참조가 완전히 정리됐는지가 중요하다.
- **제안**: `spec/4-nodes/0-overview.md` 전체에서 `buildSandbox` 잔존 여부 확인 후 제거.

### [INFO] review/consistency 산출물 — `_retry_state.json`의 `agents_success: []` 초기값이 그대로 커밋됨
- **위치**: `review/consistency/2026/06/11/22_00_31/_retry_state.json`, `22_04_01/_retry_state.json`, `22_46_26/_retry_state.json`, `23_14_40/_retry_state.json`
- **상세**: `_retry_state.json`이 초기 상태(`agents_success: [], agents_pending: [모든 checker]`)로 커밋됐다. 이는 실행 중 상태 스냅샷이 아닌 세션 초기화 파일이어야 하는데, 실행 완료 후에도 `agents_pending`에 모든 checker가 남아있다. review 산출물로서 최종 상태(`agents_success: [all]`)로 갱신되지 않은 채 커밋된 것으로 보인다. 산출물 추적의 정확성 문제다.
- **제안**: 세션 완료 후 `_retry_state.json`을 최종 상태로 갱신하거나, 초기화 파일임을 명확히 하는 naming 또는 주석 추가(`_retry_state.initial.json` 또는 파일 내 `"status": "initial"` 필드). 단, 이는 review 하네스 설계 사항이므로 즉각 조치 불필요.

---

## 요약

이번 변경의 핵심은 `spec/` 문서 7개의 갱신(isolated-vm 전환 반영, model-config 통합 후속 정리, auth-config audit action 확장, SSRF 가드 확장)과 consistency review 산출물 커밋이다. 문서화 관점의 주요 관심사는 세 가지다. 첫째, `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 이번 변경으로 격하된 레거시 에러 코드 세 건(`EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`, `EXECUTION_MEMORY_EXCEEDED`)이 등재되지 않아 명명 안정성 SoT가 불완전하다(WARNING). 둘째, `spec/data-flow/7-llm-usage.md`와 `spec/2-navigation/6-config.md`에서 구 파일명/경로 갱신이 이루어졌으나 파일 내 잔존 레거시 참조나 frontmatter 커버리지 보완이 필요한 부분이 있다(WARNING 2건). 셋째, 신규 에러 코드(`MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND`)와 "PR4b" 계획 식별자의 참조 문서화가 불완전하다(INFO 2건). review/consistency 산출물 자체는 잘 구조화되어 있고 각 checker 결과물이 ## 발견사항 · ## 요약 · ## 위험도 형식을 일관되게 준수하며 내부 문서화 품질은 양호하다.

## 위험도

MEDIUM
