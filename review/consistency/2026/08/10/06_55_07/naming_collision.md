# 신규 식별자 충돌 검토 — `spec-data-flow-structural-followups.md` §4 "LLM Config" → "Model Config" 표기 통일

## 검토 방법

`plan/in-progress/spec-data-flow-structural-followups.md` §4 가 지정한 15건 교체 대상·2건 제외
대상을 `spec/` 실물 파일에서 `rg -n "LLM Config" spec/` 로 재확인하고, 각 항목이 "식별자"인지
"서술"인지를 코드베이스(`codebase/backend/src`, `codebase/frontend/src`)까지 추적해 실제
런타임 문자열과 대조했다.

## 발견사항

### [WARNING] "서술" 로 분류된 2개 위치가 실제로는 아직 코드가 그대로 내보내는 런타임 문자열의 국문 요약이다

- target 신규 표기: `Model Config` (target 이 `3-workflow-editor/4-ai-assistant.md:143` 의
  "LLM Config selector." 와 `:651` / `3-workflow-editor/_product-overview.md:192` 의
  "(Integration / MCP Server / LLM Config / KB / Workflow)" 라벨을 이렇게 바꾸려 한다)
- 기존 사용처(코드, 아직 미변경):
  - `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts:300` — LLM 에게
    매 세션 전송되는 시스템 프롬프트 원문: `` `llm-config-selector` — LLM Config picker. ``
  - `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts:434` — 같은
    프롬프트의 예시문: `"AI Agent에 연결할 **LLM Config**가 없어요."`
  - `codebase/backend/src/modules/workflow-assistant/tools/review-workflow.ts:365` —
    `PENDING_USER_CONFIG_UNMENTIONED` 가드가 LLM 에게 되돌려 보내는 `details` 문자열:
    `"...empty user-picked fields (Integration / LLM Config / Knowledge Base / Sub-workflow)..."`
    — 이 형식이 `4-ai-assistant.md:651` / `_product-overview.md:192` 라벨과 사실상 같은 목록이다
  - `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:139` —
    candidate 의 name/provider 가 없을 때의 fallback 표시 라벨 리터럴 `'LLM Config'`
- 상세: plan 은 "식별자 보존" 판정 기준을 **백틱 kebab-case id**(`llm-config-selector`)와
  **`ASSISTANT_*` 에러 코드**로만 그었다. 그런데 이 두 위치의 "서술"은 순수 내러티브 문장(예:
  25행 "LLM Config에 등록된 모델을 활용해")과 달리, 코드가 **지금 이 순간 실제로 LLM 에게
  보내고/사용자에게 보여주는** 문자열(시스템 프롬프트·가드 detail·fallback 라벨)의 한국어 요약에
  더 가깝다. 이 두 곳을 `Model Config` 로 바꾸면 spec 은 "이 리소스는 Model Config 로 불린다"고
  단언하지만, 실제 시스템 프롬프트·가드 메시지·fallback UI 라벨은 여전히 문자 그대로
  `LLM Config` 를 내보낸다 — spec 서술과 라이브 문자열이 이 두 지점에서만 새로 갈라진다.
- 제안: (a) 이 두 곳(651/192, 143)은 이번 라운드에서 보류하고 `LLM Config` 로 유지하거나,
  (b) 바꾸더라도 `12-workspace.md` 가 이미 쓰는 bridging 각주 패턴("system-prompt·가드 메시지는
  아직 `LLM Config` 리터럴을 그대로 사용한다 — 코드 레벨 통일은 별도 작업")을 이 두 위치에
  추가한다. **CRITICAL 로 올리지 않은 이유**: 파괴되는 식별자는 없고(파일은 여전히 prose), 이미
  651/192 라벨 자체가 코드 문구를 토씨 그대로 인용한 것이 아니라 의역(`Knowledge Base`→`KB`,
  `Sub-workflow`→`Workflow`)이라 완전한 verbatim quote 는 아니었다 — 다만 어휘(LLM Config) 는
  지금까지 일치했었고 이 교체로 그 일치가 깨진다.

### [INFO] §3.1 헤딩 자체는 대상에서 빠져 있어, 교체 후 상호참조 라벨과 대상 헤딩명이 더 벌어진다

- target 신규 표기: `Model Config (§3.1)` (`4-nodes/3-ai/_product-overview.md:146`),
  `[Model Config](...)` (`3-workflow-editor/_product-overview.md:151`)
- 기존 사용처: `4-nodes/3-ai/_product-overview.md:41` `### 3.1 LLM 프로바이더 관리`
  (요구사항 `LLM-01`~`LLM-07`, 이번 target 범위 밖 — `rg` 매치도 안 됨, "LLM Config" 문자열이
  아니라 "LLM 프로바이더 관리"이기 때문)
- 상세: 두 곳 모두 §3.1 을 가리키는 상호참조 라벨이다. 지금은 `LLM Config (§3.1)` → 헤딩
  `LLM 프로바이더 관리` 로 최소한 "LLM" 이 공통이었는데, 교체 후 `Model Config (§3.1)` →
  `LLM 프로바이더 관리` 가 되어 참조 라벨과 실제 헤딩 제목의 첫 단어부터 달라진다. 이 자체가
  충돌은 아니고(헤딩은 provider 관리 전반이라 Model Config 보다 넓은 개념), 다만 다음 사람이
  "§3.1 도 Model Config 로 리네임해야 하나" 헷갈릴 여지가 생긴다.
- 제안: 이번 라운드에서 헤딩까지 건드릴 필요는 없다(범위 확장). 다만 완료 기록에 "§3.1 헤딩
  자체(`LLM-01`~`07`)는 이번 통일 대상이 아니다" 한 줄만 남기면 향후 재작업 시 혼동을 막는다.

### [정보 확인 — 이슈 아님] 714 헤딩 교체는 인입 앵커 관점에서 안전 — 재검증 결과 일치

`### 12.3 LLM Config` (`3-workflow-editor/4-ai-assistant.md:714`) 를 가리키는 마크다운 앵커
(`4-ai-assistant.md#12-3-llm-config` 형태)를 `spec/`·`plan/`·`codebase/` 전체에서 재검색했다 —
`grep -rn "4-ai-assistant.md#"` 결과 6건 모두 `#31-패널-위치크기`·`#35-키보드-단축키`·
`#41-탐색-도구-clarify-read-only`·`#412-re-run-비트리거-정책`·`#431-pendinguserconfig-...`
중 하나였고 `#12` 계열은 0건. plan 이 명시한 "인입 앵커 0건" 판정은 **정확**하다. 목차(TOC)는
GitHub-style 자동 생성이라 헤딩 텍스트 변경 시 슬러그도 함께 바뀌므로 별도 조치 불필요하다.

### [정보 확인 — 이슈 아님] 1105 제외 판단도 정확 — 코드 대조로 근거 보강

`4-ai-assistant.md:1105` 의 인용문 `"SendEmail (Integration); AIAgent (LLM Config). In the
next round, emit a Korean summary..."` 는 `review-workflow.ts:365`(`PENDING_USER_CONFIG_UNMENTIONED`
detail 포맷)와 `system-prompt.ts:434`(예시문)가 실제로 조합해 LLM 에게 보내는 문자열과 같은
계열의 실례다. "인용된 프롬프트 원문이라 바꾸면 원문을 왜곡한다"는 판단은 코드 대조로도
확인된다 — 배제가 맞다.

### [INFO] 건수 표기 "17건/4파일"(plan 구 기록) 과 "교체 대상 15건"(이번 지시) 이 둘 다
정밀하지 않다 — 실측은 "4파일 내 15occurrence, 그중 교체 14 + 보류 1"

- `rg -c "LLM Config" <4파일>` 실측: `4-ai-assistant.md`=7, `_product-overview.md`(workflow-editor)=5,
  `4-nodes/3-ai/_product-overview.md`=2, `5-system/_product-overview.md`=1 → **합 15**.
  `data-flow/12-workspace.md` 는 별도 2건(`:262`, `:432`) — 이 파일은 "4파일" 목록에 없다.
- plan 의 기존 체크리스트 문구("2026-08-08 실측 잔존 **17건 / 4파일**")는 **17을 통째로 "4파일"
  귀속으로 적었지만 실제로는 15가 4파일, 나머지 2가 별도 5번째 파일(`data-flow/12-workspace.md`)
  소속**이다 — 바로 다음 문장에서 "그 2건은 대상 아님"이라 correctly 배제하면서도, 그 위 숫자
  "17건/4파일" 자체는 그 배제를 반영하지 못한 상태로 남아 있다.
- 이번 지시문의 "교체 대상 (15건)" 헤더도 마찬가지로 자기 목록과 어긋난다 — 헤더 아래 실제
  나열된 항목은 25·108·143·620·651·714(4-ai-assistant.md, 6건) + 151·167·168·169·192
  (_product-overview.md, 5건) + 128·146(4-nodes, 2건) + 27(5-system, 1건) = **14건**이다.
  "15건" 은 (교체 14건 + 보류 1건[1105]) 의 합, 즉 **"4파일 내 occurrence 총계"** 이지 "교체
  대상 개수" 가 아니다.
- 제안: 완료 기록 시 "4파일 내 실측 15 occurrence = 교체 14 + 예외(인용문) 1. `data-flow/` 의
  별도 2건은 범위 밖(§3 소관)"처럼 세 수를 분리해 적으면, 다음에 이 항목을 다시 열어보는 사람이
  같은 산수를 반복해서 틀리지 않는다. 함의는 **작다**(실제 편집 대상 파일·라인은 이미 정확히
  식별돼 있다) — 다만 plan 문서 자체의 숫자 서술이 세 번째로 반복해서 자기 목록과 어긋나는
  사례라 기록 위생 차원에서 지적한다.

### [정보 확인 — 이슈 아님] 새로 도입되는 `Model Config` 는 기존 다른 의미와 충돌하지 않는다

`Model Config`/`ModelConfig` 는 이미 이 저장소 전역에서 같은 의미로 정착한 정본 명칭이다 —
`spec/5-system/1-auth.md:387`(RBAC 매트릭스 행 "Model Config"), `spec/2-navigation/6-config.md`
(`### Model Config API` 섹션, `ModelConfig` 엔티티), `spec/data-flow/7-llm-usage.md`
(`ModelConfig` CRUD 흐름), 그리고 **교체 대상 파일 자신도 이미** `4-ai-assistant.md:367` 에서
`` `ModelConfig (kind=chat)` `` 를 코드 조회 대상으로 쓰고 있다. 4개 target 파일 안에 `Model
Config` 를 다른 의미로 쓰는 기존 사용처는 없다(grep 0건). 요구사항 ID(`ED-AI-06/07/08`,
`LLM-01~07`, `KB-VE-02`, `NF-SC-02`)·에러 코드(`ASSISTANT_NO_LLM_CONFIG`)·widget id
(`llm-config-selector`)는 target 이 명시한 대로 전부 보존되고 있어 이 축의 충돌도 없다.

## 요약

15개 교체 대상 라인·2개 제외 라인의 **위치(파일·행)는 전수 재확인 결과 모두 정확**하고, 요구사항
ID·에러 코드·widget id 를 식별자로 보존하려는 판정도 옳다. 714 헤딩 교체(인입 앵커 0건)와 1105
제외(인용 프롬프트 원문) 판단도 코드 대조로 재확인해 정확함을 확인했다. 다만 두 지점(143 의
"LLM Config selector.", 651/192 의 "(Integration / MCP Server / LLM Config / KB / Workflow)")은
plan 이 "순수 서술"로 분류했지만 실제로는 `system-prompt.ts`·`review-workflow.ts`·
`candidate-lookup.service.ts` 가 지금도 문자 그대로 `LLM Config` 를 LLM 에게 보내거나 사용자에게
보여주는 문자열의 한국어 요약이라, 교체 시 spec 서술과 라이브 문자열이 새로 갈라진다(WARNING,
차단 사유는 아니며 보류 또는 각주 추가로 해소 가능). 새로 도입되는 `Model Config` 자체는 이미
저장소 전역에 정착한 정본 명칭과 완전히 일치해 다른 의미와의 충돌은 없다. 건수 표기("17건/4파일"
구 기록, "15건" 이번 헤더)는 둘 다 자기 목록과 정확히 들어맞지 않아(실측: 4파일 내 15 occurrence
= 교체 14 + 보류 1, `data-flow/` 별도 2건은 5번째 파일) 기록 정확도 차원의 INFO 로 남긴다.

## 위험도

LOW
