### 발견사항

- **[WARNING]** `12-workspace.md` Rationale 이 plan 자기 섹션 번호를 오인용 (§3 → 실제로는 §4)
  - target 위치: `spec/data-flow/12-workspace.md` `## Rationale` → `### 명칭 통일 범위 — "LLM Config" → "Model Config" (2026-07-31)` 마지막 문장 (`:361`, `... 서술형 잔존은 [plan/in-progress/spec-data-flow-structural-followups.md] §3 에서 **식별자와 서술을 구분해** 별도로 처리한다.`)
  - 위반 규약: 명시적 `spec/conventions/*.md` 항목은 아니고, CLAUDE.md 가 요구하는 "정보 저장 위치 단일 진실" 원칙(문서가 가리키는 SoT 절 번호는 정확해야 한다)과의 정합성 문제 — 명명·상호참조 정확성(점검 관점 1·3)에 해당.
  - 상세: `plan/in-progress/spec-data-flow-structural-followups.md` 를 직접 읽어 절 구조를 확인한 결과, `ASSISTANT_NO_LLM_CONFIG`(에러 코드)·`llm-config-selector`(widget)·`ED-AI-06~08`(요구사항 ID) 등 "식별자는 보존, 서술만 교체" 원칙과 `3-workflow-editor/`·`4-nodes/`·`5-system/` 잔존 처리 방침을 실제로 담고 있는 절은 **`## 4. 잔여 — 서술형 "LLM Config" 표기 (별도)`** 다. `## 3. "LLM Config" → "Model Config" 표기 통일`은 이번 라운드에 이미 끝난 `data-flow/` 범위 작업만 다루며 저 식별자들을 전혀 언급하지 않는다. 그런데 `12-workspace.md` 의 신규 Rationale 문단은 "§3 에서 ... 별도로 처리한다"고 써서 이미 완료된 §3 을 가리킨다 — 실제로 그 작업을 규정하는 §4 가 아니다. 같은 세션의 다른 4개 검토 리포트(`cross_spec.md`/`naming_collision.md`/`plan_coherence.md`/`rationale_continuity.md`)를 확인했으나 이 특정 오인용은 어디에서도 지적되지 않아 본 리뷰에서 새로 발견한 항목이다.
  - 제안: `spec/data-flow/12-workspace.md:361` 의 "§3" 을 "§4" 로 정정.

- **[WARNING]** `spec_impact` frontmatter 가 실제 변경 파일 중 `0-overview.md` 누락 (교차 확인됨)
  - target 위치: `plan/in-progress/spec-data-flow-structural-followups.md` frontmatter `spec_impact:`
  - 위반 규약: `spec/conventions/**` 자체 항목은 아니고 CLAUDE.md "정보 저장 위치" 표(`진행 중 작업` 행, frontmatter 완결성)·plan-lifecycle 스키마 관련.
  - 상세: `spec_impact` 는 `spec/data-flow/12-workspace.md`·`spec/data-flow/3-execution.md` 2건만 나열하지만, `git diff --stat` 확인 결과 `spec/data-flow/0-overview.md` 도 실제로 수정됐다(도메인 인덱스 "LLM Config"→"Model Config" 정정 + 신규 `### 3.6 권한 요약 (선택)` 섹션). target 본문(§1 체크리스트·§3 Rationale 인용)도 이 파일 변경을 여러 차례 명시한다. 이 항목은 같은 세션의 `plan_coherence.md`(INFO)·`cross_spec.md`(INFO, "plan_impact 누락")·`rationale_continuity.md`(INFO)에서도 동일하게 지적돼 3중 교차 확인됐다.
  - 제안: `spec_impact` 리스트에 `spec/data-flow/0-overview.md` 추가.

- **[WARNING]** 원 plan(`review-info-followups.md`) §4 가 "완료 처리" 주장과 달리 갱신되지 않음 (교차 확인됨)
  - target 위치: `plan/in-progress/spec-data-flow-structural-followups.md` `## Overview` 두 번째 문단 (`"원 plan(review-info-followups.md §4)에서 이관. 그 plan 은 본 항목들이 분기됐으므로 완료 처리한다."`)
  - 위반 규약: 직접적인 spec/conventions 항목은 아니고 CLAUDE.md "정보 저장 위치 단일 진실 원칙"(plan 라이프사이클 동기화)과의 거리.
  - 상세: 실제 `plan/in-progress/review-info-followups.md` §4 "impl-done 게이트가 드러낸 범위 밖 항목" 의 3개 체크박스(`12-workspace.md §3.2 위치` / `3-execution.md §3.3 SIGTERM 행 상호참조` / `"LLM Config" → "Model Config" 표기 통일`, 각각 "**planner 턴 필요**"로 명시)는 여전히 `- [ ]` 미체크이고, target 문서로의 상호참조도 0건이다. `review-info-followups.md` 는 이미 `origin/main`(커밋 `a6fb90526`, `#1040`)에 병합된 정적 파일이므로 "다른 세션이 아직 처리 중"이 아니라, 이번 PR 이 두 문서를 동시에 인지하면서도 한쪽만 갱신한 상태다. 이 항목은 같은 세션의 `plan_coherence.md`(WARNING, 매우 상세히 동일 지적)에서도 확인됐다.
  - 제안: `plan/in-progress/review-info-followups.md` §4 의 3개 bullet 에 "→ `spec-data-flow-structural-followups.md` 로 이관·완료(2026-07-31)" 각주 추가. `project-planner` 는 `plan/**` 쓰기 권한이 있어 이번 PR 범위에서 직접 처리 가능하다.

- **[INFO]** `0-overview.md §3.6` 의 도메인 문서 인용이 하이퍼링크가 아닌 코드 텍스트
  - target 위치: `spec/data-flow/0-overview.md` `### 3.6 권한 요약 (선택)` — "현재 `12-workspace.md §4` 하나만 갖고 있다."
  - 위반 규약: 명시적 규약 없음. 같은 파일 §2 도메인 인덱스 표가 형제 문서를 항상 `[텍스트](경로)` 하이퍼링크로 인용하는 기존 스타일과의 사소한 불일치.
  - 상세: 기능적 문제는 없다 — `spec-link-integrity` 가드는 `[..](..)` 형태의 링크만 검사하므로 이 백틱 텍스트는 애초에 검증 대상이 아니다.
  - 제안: `[12-workspace.md §4](./12-workspace.md#4-권한-rbac-요약)` 형태로 통일해도 좋음(선택).

### 검증 완료 항목 (문제 없음 — 참고)

- **명명 규약**: `Model Config`(공백 2단어, 대문자 시작) 표기가 `spec/5-system/1-auth.md §3.2`(정본)·`7-llm-usage.md`·`2-navigation/6-config.md` 와 정확히 일치. `ModelConfig`(코드 식별자, PascalCase)와 네임스페이스 충돌 없음.
- **문서 구조 규약**: `12-workspace.md` 의 `## 3. 상태 전이` 아래 있던 `### 3.2 RBAC 매트릭스` 를 독립 `## 4. 권한 (RBAC 요약)` 으로 승격하고 기존 `## 4. 외부 의존` 을 `## 5.` 로 재번호한 것, `0-overview.md §3` 공통 규약 템플릿에 선택적 6번째 요소 `### 3.6 권한 요약 (선택)` 를 신설한 것 모두 `Overview/본문(numbered)/Rationale` 3섹션 구조·`---` 구분자·헤딩 넘버링(마침표 포함) 스타일을 형제 문서(`2-auth.md`, `3-execution.md`) 와 동일하게 유지한다.
- **frontmatter 면제 경계**: `spec/data-flow/**` 는 `spec-impl-evidence.md §1` 에 의해 `id`/`status`/`code` frontmatter 의무에서 명시적으로 제외된 영역이며, 세 파일 모두 frontmatter 를 추가하지 않아 이 예외를 정확히 준수한다.
- **링크 무결성**: 재배치로 사라진 앵커(`12-workspace.md#32-rbac-매트릭스-요약`, `#4-외부-의존`)를 가리키는 인바운드 링크를 `spec/`·`plan/`·`codebase/**/*.{ts,tsx}` 전수(grep)로 확인한 결과 0건. 신규 도입 링크(plan 파일 3건, `1-auth.md`)는 전부 파일 레벨 링크이며 실제 존재를 확인했다. `codebase/frontend/.../spec-link-integrity.test.ts` 의 검사 범위(스코프 1: `spec/**.md` 전체, plan 링크 포함)와 충돌하지 않는다.
- **error-codes.md 정합**: 신규로 인용된 `SERVER_INTERRUPTED`/`WORKER_HEARTBEAT_TIMEOUT` 값 자체는 변경되지 않았고(§Rationale 텍스트만 추가), `error-codes.md §5` 의 기존 `LLM_CONFIG_NOT_FOUND`→`MODEL_CONFIG_DEFAULT_MISSING` 등 rename 이력과 모순되지 않는다. `ASSISTANT_NO_LLM_CONFIG`/`llm-config-selector`/`ED-AI-06~08` 를 "코드 식별자라 보존" 이라 명시한 target 의 판단은 실제 코드베이스 조회로 정확함이 확인됐다(전부 현재도 그 이름으로 살아있음).
- **수치 정확성**: `spec/` 전수의 "LLM Config" 잔존이 "20건" 이라는 target 의 주장을 `git show HEAD` 로 파일별 재계산해 정확히 일치함을 확인(`3-workflow-editor/4-ai-assistant.md` 7 · `_product-overview.md` 5 · `4-nodes/3-ai/_product-overview.md` 2 · `5-system/_product-overview.md` 1 · `data-flow/0-overview.md` 1 · `data-flow/12-workspace.md` 4 = 20).
- **API 문서/출력 포맷 규약(점검 관점 2·4)**: target 은 API 응답·이벤트 페이로드·에러 코드 값·Swagger 데코레이터 등 어떤 output-format surface 도 변경하지 않는다 — 해당 없음(N/A), 위반 없음.

### 요약

target plan(`plan/in-progress/spec-data-flow-structural-followups.md`)이 실제로 적용한 `spec/data-flow/{0-overview,12-workspace,3-execution}.md` 변경분을 `spec/conventions/`(spec-impl-evidence.md·node-cancellation.md·error-codes.md)·`spec/5-system/1-auth.md` SoT·저장소 grep 결과와 직접 대조 검증했다. 핵심 규약 준수 항목 — 문서 구조 템플릿(Overview/numbered 본문/Rationale, `0-` prefix, 선택 요소 표기), `Model Config` 명명 통일 범위(정확히 20건 중 5건만 교정, 나머지는 코드 식별자로 보존), data-flow frontmatter 면제 경계, 링크/앵커 무결성 — 는 전부 사실과 정확히 일치해 CRITICAL 급 위반은 없다. 다만 문서 간 상호참조·추적 정합성에서 WARNING 3건을 발견했다: (1) `12-workspace.md` Rationale 이 plan 의 §3 을 인용했으나 실제로 그 내용을 다루는 절은 §4 다(본 리뷰 고유 발견), (2) `spec_impact` frontmatter 가 실제 수정 파일(`0-overview.md`)을 누락(3개 리뷰어 교차 확인), (3) "완료 처리한다"고 선언한 원 plan(`review-info-followups.md`) §4 가 실제로는 갱신되지 않아 동일 항목이 두 plan 에 이중 추적됨(다른 리뷰어와 교차 확인). 셋 다 `spec/conventions/**` 의 직접 위반이라기보다 CLAUDE.md 의 "단일 진실" 추적 규율과의 거리이며, push 전 각주·frontmatter 한 줄 수정으로 해소 가능한 저비용·비차단 이슈다.

### 위험도
LOW
