# 신규 식별자 충돌 검토 — spec/3-workflow-editor/0-canvas.md

## 검토 범위

`git diff main -- spec/3-workflow-editor/0-canvas.md` 로 실제 변경분을 확정하고, 함께 변경된
`spec/3-workflow-editor/{2-edge,4-ai-assistant,_product-overview}.md` 를 보조 corpus 로 대조했다.
변경 요지: §8 "자동 저장" → "저장" 재명명(2초 디바운스 자동 저장·오프라인 로컬 저장·동시편집 충돌
감지가 미구현임을 인지해 명시 저장 모델로 정정), §8.1 표 헤더 변경, `저장 API` 행 신규 추가,
Rationale R-3 신규 절 추가.

이 변경분이 새로 도입하는 식별자 후보를 모두 추출해 기존 spec/코드베이스 사용처와 대조했다.

## 점검한 신규(또는 신규 노출) 식별자

| 후보 | 대조 결과 |
|---|---|
| `POST /workflows/:id/save` (§8 "저장 API" 행) | 이미 `spec/3-workflow-editor/5-version-history.md:19,148`, `spec/data-flow/11-workflow.md:42,44,58,128` 에서 동일 의미(캔버스 bulk save)로 정의·사용 중. target 은 기존 정의를 재사용만 함 — 충돌 없음 |
| `saveCanvas` (§8 "저장 API" 행 괄호 표기) | `codebase/frontend/src/lib/api/workflows.ts:149` (`workflowsApi.saveCanvas`), `codebase/backend` 다수 e2e, `spec/conventions/cross-node-warning-rules.md:98`, `spec/data-flow/11-workflow.md:65,83`, `spec/3-workflow-editor/5-version-history.md:144` 와 완전히 일치. 충돌 없음 |
| `saveWorkflow` (R-3, 프런트 store 액션) | `codebase/frontend/src/lib/stores/editor-store.ts:1114` 의 실제 store 액션명과 일치. `saveCanvas`(API client 계층) 와 `saveWorkflow`(store 계층)는 이름이 비슷하지만 실제 코드에서도 계층이 다른 두 개의 별도 함수이므로 **의도된 분리**이며 오검출 대상 아님 |
| ED-SP-05 재정의 (R-3, `_product-overview.md:85`) | 신규 ID 발급이 아니라 기존 ID(`설정 변경 즉시 반영` → `변경 저장`/`JSON 적용` 명시 클릭으로 정정)의 텍스트 갱신. 동일 PR 내에서 `_product-overview.md`·`0-canvas.md` R-3 가 함께 갱신되어 일관됨. 충돌 없음 |
| ED-SV-02 재정의 (`_product-overview.md:97`) | 위와 동일 패턴 — 기존 ID 텍스트만 정정("자동 저장" → "실행 직전 자동 저장"). 신규 ID 아님, 충돌 없음 |
| `hasError` (§8 "수동 저장" 행, 신규 spec 노출) | `codebase/frontend/src/lib/stores/editor-store.ts:76` (`graphWarnings.hasError`), `editor-toolbar.tsx:467,470`, `spec/conventions/cross-node-warning-rules.md:102` 와 동일 필드명·의미. 충돌 없음 |
| `Restored from vN` (§8.1 "버전 복원" 행) | `spec/3-workflow-editor/5-version-history.md:21,172` 의 기존 `change_summary` 포맷 문자열과 동일. 충돌 없음 |
| "서버 저장" (§8.1 표 헤더, "자동 저장" → 개명) | 정식 식별자가 아닌 서술어. `spec/2-navigation/_product-overview.md:220`, `spec/7-channel-web-chat/5-admin-console.md`, `spec/3-workflow-editor/4-ai-assistant.md:818` 에 동일 문구가 있으나 각각 문맥이 다른 "서버에 영구 저장됨"의 일반 서술이라 엔티티/필드명 충돌 소지 없음 |
| 헤더 재명명 `## 8. 자동 저장` → `## 8. 저장`, `### 8.1 자동 저장과 버전의 관계` → `### 8.1 저장과 버전의 관계` | 앵커(`#8-저장`, `#81-저장과-버전의-관계`) 를 참조하는 타 spec 문서 없음(grep 결과 0건) — 링크 깨짐 소지 없음. 새 헤더 텍스트가 문서 내 다른 절과 중복되지도 않음 |

## 발견사항

없음. 검토 대상 diff 는 새 요구사항 ID·엔티티·API endpoint·이벤트·환경변수·파일 경로를 신규로
발급하지 않는다 — 모두 기존 코드베이스/spec corpus 에 이미 확립된 식별자를 문서에 뒤늦게
정합화(반영)하는 정정이며, 대조 결과 전부 기존 정의와 정확히 일치한다.

### 참고 (충돌은 아니나 확인해 둔 것)
- **[INFO]** `saveCanvas` / `saveWorkflow` 표기 구분
  - target 신규 식별자: 없음 (기존 식별자 재노출)
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:149` (`saveCanvas`, API client) vs `codebase/frontend/src/lib/stores/editor-store.ts:1114` (`saveWorkflow`, store action)
  - 상세: 같은 §8 절 안에서 `saveCanvas`(저장 API 행)와 `saveWorkflow`(R-3 본문)가 나란히 등장해 처음 읽는 사람이 동일 대상의 오타로 오인할 수 있음. 다만 실제 코드 계층이 다르고(REST client 메서드 vs Zustand store 액션), 두 이름 모두 codebase 실명과 정확히 일치해 spec 오류는 아님.
  - 제안: 필요 시 §8 "저장 API" 행이나 R-3 각주에 "`saveCanvas`=API client 메서드, `saveWorkflow`=이를 호출하는 store 액션" 한 줄 구분을 덧붙이면 향후 재독 시 혼동을 줄일 수 있음 (선택 사항, 차단 사유 아님).

## 요약

target diff(`spec/3-workflow-editor/0-canvas.md` §8/§8.1 + Rationale R-3, 및 동반 수정된 `2-edge.md`·
`4-ai-assistant.md`·`_product-overview.md`)는 새 식별자를 발급하는 변경이 아니라, 이미 코드베이스에
존재하는 `saveCanvas`/`POST /workflows/:id/save`/`hasError`/`isDirty`/`isSaving`/`Restored from vN`
및 기존 요구사항 ID(ED-SP-05, ED-SV-02, ED-AI-17)를 spec 문서에 뒤늦게 정합화하는 정정이다. 대조
결과 모든 식별자가 `5-version-history.md`, `data-flow/11-workflow.md`, `conventions/cross-node-
warning-rules.md`, 실제 프런트/백엔드 코드와 정확히 일치하며, 신규 식별자 충돌 관점에서 문제되는
항목은 발견되지 않았다.

## 위험도

NONE
