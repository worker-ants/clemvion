# 신규 식별자 충돌 검토 — spec-draft-waiting-surface-guard

대상: `plan/in-progress/spec-draft-waiting-surface-guard.md`

## 검증 방법

target draft가 인용하는 라인 번호·기존 식별자를 실제 저장소 파일(`spec/5-system/4-execution-engine.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/4-nodes/6-presentation/0-common.md`,
`spec/3-workflow-editor/3-execution.md`, `spec/conventions/interaction-type-registry.md`,
`spec/1-data-model.md`, `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts`)와
직접 대조했다.

## 발견사항

### [INFO] `WaitingSurface`(3값)는 코드에서 이미 확정된 이름 — 이미 확립된 disambiguation 패턴을 정확히 따름

- target 신규 식별자: `WaitingSurface`(`'form' | 'buttons' | 'ai_conversation'`, 3값), `WaitingSurfaceCommand`, `SURFACE_ALLOWED_COMMANDS`
- 기존 사용처: `spec/conventions/interaction-type-registry.md` §1 `WaitingInteractionType`(4값: `'form' | 'buttons' | 'ai_conversation' | 'ai_form_render'`), 정의 `codebase/backend/.../execution-engine.service.ts`
- 상세: `WaitingSurface`는 이미 구현 완료된 코드(`codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts`, BLOCK:NO plan `eia-command-waiting-surface-guard.md`)에서 확정된 타입명이며, target draft는 이를 spec 본문에 **역류 반영**하는 것뿐 신규로 명명하는 것이 아니다. `WaitingInteractionType`(4값, 내부 엔진 전용) vs `WaitingSurface`(3값, publisher 사전 검증 전용 — `ai_form_render`를 `ai_conversation`으로 흡수)는 이름이 다르고 값 집합도 다르지만, 겹치는 3개 값(`form`/`buttons`/`ai_conversation`)이 같은 문자열이라 표면적으로는 혼동 소지가 있다. 그러나 이 4→3 흡수 매핑 자체는 **이미** `interaction-type-registry.md` §1.1 note("내부 4값 ↔ EIA 외부 3값 매핑")에 선례로 명문화돼 있고, target 변경 5는 이 note에 "`WaitingSurface` 도 이 4→3 통합의 소비처" 한 줄만 추가한다. 이는 프로젝트가 이미 확립한 disambiguation 관행(예: `spec/1-data-model.md:553`의 `interaction_data.interactionType`("수행된 user action 기록" enum) vs `WaitingInteractionType`("대기 상태 분류" enum) — "이름만 같고 별개 enum"이라고 명시 서술)과 정확히 같은 패턴이다.
- 제안: 현재 서술로 충분하다. 변경 없음 권고. (참고로 §1.1 note와 §1.2 "값 → 처리 분기 매트릭스"가 같은 문서 안에 있으니, 아래 WARNING 항목의 문구 명확화만 권장.)

### [WARNING] "매트릭스" 용어가 같은 문서(`interaction-type-registry.md`) 안에서 두 다른 개념을 가리킴

- target 신규 식별자: "표면 매트릭스"(§1.1 note에 삽입되는 문구, `SURFACE_ALLOWED_COMMANDS`를 가리킴)
- 기존 사용처: `spec/conventions/interaction-type-registry.md` §1.2 제목 "값 → 처리 분기 매트릭스"(enum value별 backend emit 위치·frontend 분기 위치를 나열하는 기존 매트릭스)
- 상세: 두 매트릭스는 축(axis)이 다르다 — 기존 §1.2는 "enum 값 → 코드상 처리 분기 위치" 매핑이고, target이 §1.1에 추가하는 문구가 가리키는 것은 "표면(surface) → 허용 명령 집합"(`SURFACE_ALLOWED_COMMANDS`) 매핑이다. 같은 문서, 인접 섹션(§1.1 바로 다음이 §1.2)에서 한정어 없이 "매트릭스"라는 같은 단어가 서로 다른 두 표/개념을 가리키면, 처음 읽는 사람이 §1.1의 "표면 매트릭스"를 §1.2의 "처리 분기 매트릭스"와 혼동하거나 동일한 것으로 오인할 수 있다.
- 제안: target 변경 5의 문구를 "publisher 사전 검증의 **표면-명령 허용 매트릭스**(`waiting-surface-guard.ts` 의 `WaitingSurface` 3값, `SURFACE_ALLOWED_COMMANDS`)"처럼 §1.2 "값 → 처리 분기 매트릭스"와 형태상 구분되는 한정어를 붙여 명명하면 혼동을 줄일 수 있다. 등급은 WARNING이나 BLOCK 사유는 아님 — 문구 다듬기 수준.

### [INFO] 요구사항 ID·에러 코드·API endpoint·이벤트명·ENV/설정키·파일 경로 — 신규 도입 없음, 전량 확인됨

- **요구사항 ID**: target 본문이 명시하듯 신규 ID 없음. Rationale이 인용하는 `EIA-IN-13`은 `spec/5-system/14-external-interaction-api.md:83`에 실제 존재하는 기존 ID(EIA 상태 불일치 시 409 반환 요구사항)와 정확히 일치 — 새 의미 부여 아님.
- **에러 코드**: `INVALID_EXECUTION_STATE`/`STATE_MISMATCH`/`INVALID_STATE` 모두 기존 코드 재사용(각각 `4-execution-engine.md:1045-1046`, `14-external-interaction-api.md:341`, `3-execution.md:334`에 이미 정의). 신규 코드 없음.
- **API endpoint**: 신규 endpoint 없음. `POST /api/executions/:id/continue`(`3-execution.md:334`)는 기존 endpoint의 에러 조건 서술 보강.
- **이벤트/명령명**: target 3번째 표 행이 언급하는 `submit_form`/`click_button`/`submit_message`/`end_conversation`은 모두 `spec/5-system/6-websocket-protocol.md` §4.2/§4.4에 이미 정의된 WS 명령명과 정확히 일치(신규 명령 없음). `expectedCommands` 필드도 `14-external-interaction-api.md:560`에 이미 등장하는 기존 필드(변경 2b는 각주 추가일 뿐 신규 필드 도입 아님).
- **환경변수/설정키**: 신규 ENV·config key 없음.
- **파일 경로**: 신규 spec 파일 생성 없음(기존 5개 spec 파일의 부분 편집). `code:` frontmatter에 추가되는 `waiting-surface-guard.ts`는 `interaction-type-registry.md` frontmatter에 현재 미등재 상태(중복 아님, 정당한 신규 추가).

### 라인 번호 실증 (참고)

target이 인용한 모든 라인 번호가 실제 파일과 일치함을 확인:
- `4-execution-engine.md` §7.5.1 표: L1043-1046 (표 헤더 L1043, 기존 2행 L1045-1046) — 일치.
- `4-execution-engine.md` L1041 receiver 서술 — 일치.
- `14-external-interaction-api.md` §5.1 `STATE_MISMATCH` 행: L341 — 일치.
- `14-external-interaction-api.md` §6.2 SSE wire note: L575-583 — 일치.
- `0-common.md` §10.9 `button_click` invariant 문단: L412 — 일치.
- `3-execution.md` §9 `/continue` 행: L334 — 일치.

## 요약

target draft가 새로 도입하는 유일한 실질적 신규 식별자는 `WaitingSurface`(3값)이며, 이는 spec에서 새로 명명하는 것이 아니라 **이미 구현·검증(BLOCK:NO)된 코드의 타입명을 spec 본문에 역류 반영**하는 것이다. 값 집합이 겹치는 기존 `WaitingInteractionType`(4값)과의 혼동 가능성은 프로젝트가 이미 확립한 "이름 유사·의미 별개" disambiguation 관행(예: `interaction_data.interactionType` 선례)을 그대로 따라 §1.1 note 확장으로 해소하고 있어 구조적으로 안전하다. 다만 같은 문서 안에서 "매트릭스"라는 용어가 §1.1(표면→명령)과 §1.2(값→처리분기)라는 서로 다른 개념에 한정어 없이 재사용되는 점은 문구 수준의 WARNING으로 남긴다. 요구사항 ID·에러 코드·endpoint·이벤트명·ENV/설정키·파일 경로 축에서는 신규 도입이 전혀 없으며, target이 인용하는 모든 기존 식별자·라인 번호가 실제 저장소와 정확히 일치함을 확인했다. CRITICAL 충돌 없음.

## 위험도

LOW
