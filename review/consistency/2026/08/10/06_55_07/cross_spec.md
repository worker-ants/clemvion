# Cross-Spec 일관성 검토 — `plan/in-progress/spec-data-flow-structural-followups.md` §4 (LLM Config → Model Config)

검토 대상은 plan draft(`--plan` 모드)이며, 실질 변경 범위는 §4 "서술형 LLM Config 표기 통일"
(4파일 / 15건: `3-workflow-editor/4-ai-assistant.md` · `3-workflow-editor/_product-overview.md` ·
`4-nodes/3-ai/_product-overview.md` · `5-system/_product-overview.md`)이다. 정본 근거는
`spec/data-flow/12-workspace.md` §"명칭 통일 범위".

실제 `spec/**` 와 `codebase/**` 를 직접 조회해 아래 3개 질의에 답한다.

---

## 발견사항

### Q1 답변 — 다른 spec 영역이 "LLM Config" 를 정본으로 쓰고 있는가

- **[INFO]** 결론: 아니오. `spec/` 전수(`rg -n "LLM Config" spec/ --type md`) 17건 중 15건이
  이번 target 범위(4파일)이고, 나머지 2건(`data-flow/12-workspace.md:262,432`)은 이번 리네이밍
  작업 자체를 서술하는 meta-commentary(“구 표기가 남아 있다”)라 정본 주장이 아니다. 반대로
  `Model Config` 는 이미 `spec/5-system/1-auth.md`(2건) · `spec/2-navigation/6-config.md`(3건,
  API 표 + RBAC 각주) · `spec/data-flow/7-llm-usage.md` · `spec/data-flow/0-overview.md` ·
  `spec/5-system/7-llm-client.md` · `spec/data-flow/12-workspace.md`(7건, 방금 병합)에서 이미
  canonical 로 쓰이고 있다. 즉 이번 target 변경은 소수(legacy) 표기를 다수(canonical) 표기에
  맞추는 방향이며, **새 불일치를 만들지 않는다.**
  - target 위치: (해당 없음 — 확인용 질의)
  - 충돌 대상: 없음

### Q2 답변 — `5-system/1-auth.md §3.2` 가 실제로 정본 명칭을 쓰는가

- **[INFO]** 확인됨(참). `1-auth.md` §3.2 리소스별 권한 매트릭스에 `| Model Config | CRUD | CRUD | CRUD | R |`
  행이 있고, 바로 아래 각주도 “**Model Config Editor CRUD 근거**: Model Config(`/api/model-configs`)는
  AI 모델 설정…”이라고 명시한다. `12-workspace.md` §Rationale “명칭 통일 범위”의 인용은 정확하다.
  - target 위치: (해당 없음 — 확인용 질의)
  - 충돌 대상: `spec/5-system/1-auth.md:389,411` (§3.2 표 + 각주) — 충돌 아님, 근거 확인됨

### Q3-a — 후속 §4 실행 시 "보호 목록" 이 실제보다 좁다: `candidate-lookup.service.ts` 하드코딩 fallback 문자열

- **[WARNING]** plan §4 는 “바꾸면 안 되는 것”으로 `ASSISTANT_NO_LLM_CONFIG`(에러 코드) ·
  `llm-config-selector`(widget 이름) · `ED-AI-06`~`08`(요구사항 ID) 만 나열한다. 그런데
  `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:139`
  에 다음 라이브 코드가 있다:
  ```ts
  const label =
    typeof cfg.name === 'string'
      ? cfg.name
      : typeof cfg.provider === 'string'
        ? cfg.provider
        : 'LLM Config';
  ```
  이는 `pendingUserConfig` candidate 목록(§4.3.1, ED-AI-39 흐름)에서 name·provider 모두 없을 때
  실제로 프런트 picker 에 노출되는 **라이브 fallback 라벨 문자열**이다. `4-ai-assistant.md:1105`
  의 예시 —
  `"SendEmail (Integration); AIAgent (LLM Config). In the next round, emit a Korean summary…"`
  — 는 이 코드 경로가 만들어내는 실제 출력을 예시로 인용한 것으로 읽힌다(review guard
  `PENDING_USER_CONFIG_UNMENTIONED` details 문자열 조립 예시). 이 줄은 plan 의 “순수 서술이라
  바꿔도 되는 것” 예시(“LLM Config에 등록된 모델을 활용해” 류)와 겉보기 형태가 같아 실행자가
  기계적으로 “Model Config”로 바꿀 위험이 있는데, 그러면 spec 예시가 코드의 실제 출력과
  어긋난다(코드는 여전히 `'LLM Config'` 를 반환).
  - target 위치: `plan/in-progress/spec-data-flow-structural-followups.md` §4 “바꾸면 안 되는 것” 목록
    (실 편집 대상: `spec/3-workflow-editor/4-ai-assistant.md:1105`)
  - 충돌 대상: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:139`
  - 상세: plan 의 보호 목록에 이 fallback 문자열이 누락되어 있어, §4 실행 시 “예시 문구도
    프로세이니 바꿔도 된다”는 판단이 나올 수 있다. 실제로는 코드가 그대로 `'LLM Config'` 를
    산출하는 (드물지만 도달 가능한) 경로이므로 spec-코드 재불일치를 새로 만든다.
  - 제안: §4 실행 시 `4-ai-assistant.md:1105` 를 “바꾸면 안 되는 것” 목록에 추가하거나(문자
    그대로 유지), 코드도 함께 `'Model Config'` 로 바꾸는 별도 developer 턴을 파거나(권장하지
    않음 — 이 plan 은 spec-only), 최소한 Rationale 에 “이 예시는 `candidate-lookup.service.ts`
    의 fallback 라벨을 인용한 것이라 표기를 유지한다”는 각주를 남긴다.

### Q3-b — `4-nodes/3-ai/_product-overview.md` 요구사항 ID(KB-VE-02 등) 설명 ↔ 실제 UI 문구

- **[INFO]** `KB-VE-02`(“임베딩 모델 선택 (LLM Config 연동)”)와 `ED-AI-06`~`08`(패널 상단 LLM
  Config 선택) 이 가리키는 실제 선택 UI를 코드에서 추적하면:
  - AI Assistant 패널 상단 셀렉터(`assistant-panel.tsx`)는 `label={t("assistant.modelLabel")}`
    를 명시 전달하며, 그 dict 값은 KO `"모델"` / EN `"Model"`이다(spec §13 i18n 표와 일치).
  - AI 노드/KB 폼의 config 셀렉터(`llm-config-selector.tsx`, `kb-form-body.tsx`)는
    `nodeConfigs.llmConfigSelector.label` 을 쓰고, 그 값은 KO `"LLM 제공자"` / EN `"LLM Provider"`다.
  - 즉 **실제 렌더링된 문구는 "LLM Config" 도 "Model Config" 도 아니고 "Model"/"LLM Provider"다.**
    따라서 이번 §4 리네이밍(“LLM Config”→“Model Config”)은 이 두 UI 표면 어느 쪽과도 문자
    그대로 충돌하지 않는다(=안전) — 다만 “UI 문구에 맞춘다”는 리네이밍의 원래 동기가 이 두
    자리에서는 완전히 달성되지도 않는다(제3의 표현이 남는다).
  - target 위치: `spec/4-nodes/3-ai/_product-overview.md:128`(KB-VE-02),
    `spec/3-workflow-editor/_product-overview.md:167-169`(ED-AI-06~08)
  - 충돌 대상: `codebase/frontend/src/lib/i18n/dict/{ko,en}/nodeConfigs.ts` (`llmConfigSelector.label`),
    `codebase/frontend/src/lib/i18n/dict/{ko,en}/assistant... (assistant.modelLabel not in this file, see sidebar/assistant dicts)`
  - 상세: 충돌 아님(정보 제공). §4 를 실행해도 안전하지만, “이 리네이밍으로 spec-UI 문구가
    정합된다”는 기대는 이 두 곳에서는 성립하지 않는다는 점을 Rationale 에 남겨두면 향후
    “왜 아직도 UI 라벨과 안 맞냐”는 재지적을 예방할 수 있다.

### Q3-c — API 계약(Swagger)·i18n 사전에 남는 "LLM Config" 사용자 대면 문자열 (spec 범위 밖, 실측)

- **[INFO]** 코드에는 실제로 "LLM Config" 문자열이 다수 남아 있으나, 실측 결과 대부분은 **죽은
  코드(orphaned)** 이거나 **비-렌더 경로**다 — 즉 이번 spec-only 변경이 “살아있는” UI 문구와
  충돌하지는 않는다. 근거:
  - `codebase/frontend/src/lib/i18n/dict/{ko,en}/sidebar.ts` 의 `llmConfig: "LLM Config"`
    / `"LLM 설정"` 키는 사이드바 nav 배열(`components/layout/sidebar.tsx`)에서 참조되지
    않는다(`sidebar.models` 만 사용, href `/models`, 라벨 "Model Settings"/"모델 설정"). **dead key.**
  - `codebase/frontend/src/lib/i18n/dict/{ko,en}/llmConfigs.ts` 의 `title`/`created`/`updated`/
    `deleted`/`deleteConfirm` 등도 현재 어떤 컴포넌트에서도 `t("llmConfigs.title")` 등으로
    참조되지 않는다(`/models` 페이지는 `t("models.title")` 사용). 이 파일에서 실제로 살아있는
    키(`loadModelsFailed`, `errorConfigInvalid`, `modelPlaceholder` 등)는 리터럴 "LLM Config"
    문자열을 포함하지 않는다.
  - `codebase/backend/src/main.ts:110` 의 `.addTag('LLM Config', 'LLM Provider 설정 관리')` 는
    Swagger 태그 등록이지만, 실제 컨트롤러(`model-config.controller.ts:64`)는
    `@ApiTags('Model Config')` 를 쓴다 — 즉 이 태그도 **orphan**(어떤 엔드포인트도 그 그룹에
    속하지 않음)이라 Swagger UI 에 빈 섹션으로만 남는다.
  - 반면 **완전히 죽은 것은 아닌** 잔존: `create-assistant-session.dto.ts:13` /
    `assistant-message-request.dto.ts:186` / `update-assistant-session.dto.ts:19` 의
    `@ApiProperty({ description: '사용할 LLM Config UUID...' })` 는 실제 라이브 엔드포인트의
    Swagger 설명문이다. 필드명 자체(`llmConfigId`)는 정당한 코드 식별자라 바뀔 필요 없지만,
    Swagger 설명 문구는 여전히 "LLM Config" 다.
  - target 위치: (해당 없음 — spec 범위 밖, 참고용)
  - 충돌 대상: `codebase/backend/src/main.ts:110`,
    `codebase/frontend/src/lib/i18n/dict/{ko,en}/{sidebar,llmConfigs}.ts`,
    `codebase/backend/src/modules/workflow-assistant/dto/*.dto.ts`
  - 상세: 이번 spec-only §4 실행은 이 코드들을 건드리지 않으므로 **충돌은 아니다**(코드 변경은
    이 plan 의 범위 밖, `developer` 턴). 다만 spec 이 전부 "Model Config" 로 정리된 뒤에도
    Swagger 문서·죽은 i18n 키에는 "LLM Config" 가 계속 보일 것이므로, 별도 backend/frontend
    청소 후속 항목으로 기록해 둘 가치가 있다(이 plan 의 스코프 확장은 권고하지 않음).

### Q3-d — plan 의 보호/허용 이분류 실행 시 동일 문서 내 표기 혼재 위험 (ED-AI-39 vs ED-AI-06~08)

- **[WARNING]** `spec/3-workflow-editor/_product-overview.md` 의 “## 10. AI Assistant (ED-AI-*)”
  섹션 안에서, `ED-AI-06`~`08`(§10.2, “보호” 대상이라 “LLM Config” 유지)과 `ED-AI-39`(§10.4,
  plan 의 보호 목록에 없어 “Model Config” 로 바뀔 대상 — “Integration / LLM Config / Knowledge
  Base / 다른 워크플로”)이 **같은 섹션, 같은 `ED-AI-*` ID 시리즈, 같은 개념**(AI 노드가 참조하는
  선택형 리소스)을 서로 다른 표기로 남긴다. `4-ai-assistant.md:651` 의 “Selector 필드 정책” 헤더도
  동일 문제 — 그 줄은 보호 대상 identifier `llm-config-selector` 와, 보호 목록에 없는 서술적
  헤더 문구 `LLM Config`(필드 유형 나열) 가 한 셀에 섞여 있어 실행자가 어디까지 바꿔야 할지
  모호하다.
  - target 위치: `spec/3-workflow-editor/_product-overview.md:167-169`(ED-AI-06~08, 보호) vs
    `:192`(ED-AI-39, 미보호) / `spec/3-workflow-editor/4-ai-assistant.md:651`(식별자+서술 혼재 셀)
  - 충돌 대상: 같은 문서 내 다른 섹션(자기 자신과의 비일관성) — cross-spec 충돌은 아니지만
    “정의 중복/명명 비일관성” 범주
  - 상세: plan 의 보호 목록은 “코드에 바인딩된 문자열”만 겨냥했지만 실제로는 “설명이 UI 문구에
    바인딩되어 있는가”라는 기준을 적용하지 않고 ID 유무로만 나눴다. 그 결과 §4 실행 후에는
    “Model Config 선택” 서술과 “LLM Config 선택” 서술이 몇 줄 간격으로 같은 문서에 공존하게 된다.
    (`12-workspace.md` 는 이 문제를 Rationale 각주로 명시해 방지했지만, 이번 §4 대상 4파일에는
    그런 “왜 이 줄은 안 바뀌었나” 각주 계획이 없다.)
  - 제안: (a) `ED-AI-39` 도 “LLM Config” 로 유지하거나(동일 시리즈 내 일관성 우선), 또는
    (b) `ED-AI-06`~`08` 의 **설명 텍스트**(ID 자체가 아니라 prose)도 “Model Config” 로 바꾸고
    plan 의 “ID 자체는 불변”이라는 문구를 “설명도 불변”이 아니라 “ID 문자열만 불변, 설명은
    변경 가능”으로 명확히 재기술한다. Q3-b 조사 결과(실제 UI 어느 쪽도 리터럴 “LLM Config”를
    쓰지 않음)를 감안하면 (b) 쪽이 더 안전하고 문서 내 일관성도 얻는다. `4-ai-assistant.md:651`
    은 식별자(`llm-config-selector`)와 서술(“LLM Config”라는 필드 유형명)을 별도 문장으로
    분리해 실행자의 판단 부담을 줄이는 편집을 권장.

### 부가 — 동일 리소스에 대한 3번째 표기 계열 (out of scope, 참고)

- **[INFO]** `spec/4-nodes/3-ai/_product-overview.md` §3.1 헤딩 “LLM 프로바이더 관리”와 그 산하
  요구사항 ID `LLM-01`~`LLM-07`, 그리고 `3-workflow-editor/_product-overview.md` §10.2 헤딩
  “LLM 모델 선택”은 문자열 grep(`"LLM Config"`) 에 걸리지 않아 이번 target 범위 밖이지만,
  본질적으로 같은 리소스(현재 canonical: Model Config)를 세 번째 이름(“LLM 프로바이더”)으로
  부르고 있다. 이번 §4 가 끝나도 spec/ 에는 "Model Config"(canonical) / "LLM Config"(잔존,
  보호 대상) / "LLM 프로바이더"(헤딩+ID 시리즈, 미검토) 세 계열이 공존하게 된다.
  - target 위치: `spec/4-nodes/3-ai/_product-overview.md:41`(§3.1 헤딩), `LLM-01`~`07`
  - 충돌 대상: 없음(직접 모순 아님) — 향후 별도 용어 정리 후보로만 기록
  - 상세/제안: 이번 plan 의 스코프 확장은 권하지 않는다. 다만 §4 Rationale 에 “LLM 프로바이더
    관리(§3.1)/`LLM-*` ID 시리즈는 별도 스코프”라고 한 줄 명시해두면, 다음에 이 영역을 손대는
    사람이 “§4 가 다 정리한 줄 알았는데 왜 남아있나”라고 재지적하는 것을 예방한다.

---

## 요약

target plan(§4, LLM Config → Model Config 서술형 표기 통일, 15건/4파일)의 핵심 전제 — “API·내비게이션은 이미 Model Config 로 일원화됐고 `5-system/1-auth.md §3.2` 가 정본이다” — 는 `spec/` 및 `codebase/` 실측으로 확인됐다(Q1·Q2 모두 참). `spec/` 전수에 "LLM Config" 를 정본으로 주장하는 다른 영역은 없으며, 오히려 6개 파일에서 이미 "Model Config" 가 다수 표기다. 다만 실행 단계에서 두 가지를 보완하면 좋다: (1) `4-ai-assistant.md:1105` 의 예시 문구는 `candidate-lookup.service.ts:139` 의 하드코딩 fallback 문자열(`'LLM Config'`)을 인용하는 것으로 보이는데, plan 의 "바꾸면 안 되는 것" 목록에 이 줄이 빠져 있어 실행 시 코드-스펙 불일치를 새로 만들 위험이 있다. (2) plan 의 보호/허용 이분류가 "코드 식별자 인접 여부"만 기준으로 삼아 `ED-AI-06`~`08`(보호)과 `ED-AI-39`(미보호)처럼 같은 섹션·같은 ID 시리즈 안에서 표기가 갈리는 결과를 낳는다 — 실제 UI 라벨 조사 결과(Q3-b) 이 두 자리 모두 리터럴 "LLM Config"/"Model Config" 어느 쪽과도 충돌하지 않으므로, 설명 텍스트까지 통일해 문서 내 일관성을 확보하는 편이 더 안전하다. 그 외 코드에 남아있는 "LLM Config" 문자열(Swagger 태그·죽은 i18n 키·Swagger DTO 설명)은 대부분 orphan 이거나 spec-only 변경과 직접 충돌하지 않는 out-of-scope 항목으로 확인됐다.

## 위험도

LOW — CRITICAL 없음. WARNING 2건(코드에 바인딩된 예시 문구 보호 목록 누락, 동일 문서/ID 시리즈 내 표기 혼재)은 §4 실행 시 반영을 권고하나 plan 자체를 막을 수준은 아니다.

STATUS=success ISSUES=8 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-small-followups/review/consistency/2026/08/10/06_55_07/cross_spec.md RESET_HINT=
