STATUS=success reviewer=cross_spec

# Cross-Spec 일관성 검토 — `spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 정정

## 검토 대상 확인

`origin/main...HEAD` diff 는 `spec/data-flow/12-workspace.md` 단 1개 파일, §3.2 "RBAC 매트릭스 (요약)" 절에 국한된다 (커밋 `9fa06cd4c` "docs(spec): impl-done 게이트 Critical 조치 — RBAC 요약표 viewer 실행 권한 정정"). 변경 내용:

1. `viewer` 행의 "실행" 셀을 `✓ (수동 실행 only)` → `✗` 로 정정.
2. 병합 열 "LLM Config / Integration" 을 "LLM Config" / "Integration" 2개 열로 분리 (editor: LLM Config=✓, Integration=view).
3. 두 정정에 대한 근거 각주 2개 추가.

이는 이전 impl-done 게이트에서 CRITICAL 로 지적된 cross-spec 불일치(§3.2 요약표가 정식 RBAC spec 과 모순)의 직접적 수정이므로, 본 검토는 "수정이 실제로 다른 영역과 정합하는가" 를 코드·타 spec 문서 양쪽으로 재검증했다.

## 재검증 결과 (다른 영역과의 대조)

### 1. `spec/5-system/1-auth.md §3.2` (정식 권한 매트릭스, 요약표가 명시적으로 가리키는 SoT)

- `Workflow 실행 | ✅ | ✅ | ✅ | —` — Owner/Admin/Editor=✅, **Viewer=—**. 정정된 요약표(`owner=✓ admin=✓ editor=✓ viewer=✗`)와 **일치**. 정정 전에는 이 두 문서가 정면 모순이었다(Critical) — 이제 해소.
- `Model Config | CRUD | CRUD | CRUD | R` — editor=CRUD. 신규 분리된 "LLM Config" 열의 `editor=✓` 와 **일치**.
- `Integration (Org) | CRUD | CRUD | R | R` — editor=R. 신규 분리된 "Integration" 열의 `editor=view` 와 **일치** (요약표 각주가 "Integration(Org)" 한정임을 명시해 Personal 행과 혼동하지 않도록 스코프를 좁혀둔 점도 적절).
- §3.2 바로 아래 "Model Config Editor CRUD 근거" 각주 존재 확인 — target 의 각주 인용("1-auth.md §3.2 및 그 아래 'Model Config Editor CRUD 근거' 각주")이 실제 위치·내용과 정확히 일치.

### 2. `spec/2-navigation/9-user-profile.md §4.2` (역할 권한 매트릭스, 내비게이션 영역 사본)

- `워크플로우 실행 | ✅ | ✅ | ✅ | ❌` — 여기도 이미 Viewer=❌ 였다. 정정 전 data-flow 요약표만 유일하게 "viewer 수동 실행 가능" 이라는 3번째 모순된 서술을 갖고 있었고, 이제 3개 문서(1-auth §3.2 · 9-user-profile §4.2 · data-flow §3.2)가 모두 합의한다.

### 3. `spec/5-system/13-replay-rerun.md` / `spec/2-navigation/4-integration.md §8`

- `RERUN_PERMISSION_DENIED` 사유에 "Viewer" 를 명시(재실행 불가) — 정정 방향과 상충 없음.
- Integration §8 권한 규칙 표: Organization 스코프 생성/수정/rotate 는 "Admin 이상" — 신규 "Integration" 열의 editor=view(R) 각주("Integration(Org)은 외부 자격증명이라 Editor R")와 일치.

### 4. 코드 대조 (impl-done 워킹트리, 절대경로/현재 CWD 로 직접 확인)

- `codebase/backend/src/modules/workflows/workflows.controller.ts:237-239` — `POST :id/execute` 에 `@Roles('editor')` 확인됨. target 각주의 주장과 일치.
- `codebase/backend/src/common/guards/roles.guard.ts:20-25` — `ROLE_HIERARCHY = { viewer:1, editor:2, admin:3, owner:4 }` 확인됨. "viewer(1) < editor(2)" 주장과 일치.
- `codebase/backend/src/modules/model-config/model-config.controller.ts` — `POST`/`PATCH`/`DELETE`/`set-default` 전부 `@Roles('editor')` 확인됨. "LLM Config: editor=✓(CRUD)" 와 일치.
- `spec/2-navigation/4-integration.md §8` Org-scope Admin+ 규칙은 `0-overview.md` 의 "라우트 가드 floor=editor, 세부 RBAC 는 상보" 각주와 함께 이미 spec 내부적으로 조정되어 있어 신규 모순 없음.

### 5. 잔존 사본·앵커 점검

- `grep -rl "워크스페이스 설정 | 멤버 관리 | 워크플로우 CRUD"` — `spec/data-flow/12-workspace.md` 단 1건. 동일 요약표의 미수정 사본이 다른 문서에 남아있지 않음.
- `grep -r "수동 실행 only"` — 전체 spec 트리에서 0건. 정정 전 표현이 다른 곳에 잔존하지 않음.
- 섹션 헤딩 텍스트("3.2 RBAC 매트릭스 (요약)")가 변경되지 않아 앵커(`#32-rbac-매트릭스-요약`) 링크 깨짐 없음(어차피 외부 인바운드 링크도 없음).

## 발견사항

- **[INFO]** 열 이름 "LLM Config" 와 각주가 인용하는 1-auth.md 행 이름 "Model Config" 불일치
  - target 위치: `spec/data-flow/12-workspace.md` §3.2 표 헤더("LLM Config" 열) 및 바로 아래 각주("Model Config 는 워크플로우 구축의 일부라 Editor CRUD")
  - 충돌 대상: `spec/5-system/1-auth.md §3.2` 의 행 이름 "Model Config", `spec/1-data-model.md` 의 엔티티명 `ModelConfig`, `spec/data-flow/7-llm-usage.md` 의 "Model Config" 서술
  - 상세: 같은 문장 안에서 표 열 헤더는 "LLM Config", 근거 설명은 "Model Config" 를 쓴다. 코드·데이터 모델·인증 spec 의 정식 명칭은 `model-config` (chat/embedding/rerank 3-kind 통합, 구 `llm_config`/`rerank_config`). "LLM Config" 자체는 이번 diff 가 새로 만든 표현이 아니라 `3-workflow-editor/`, `4-nodes/3-ai/`, `5-system/_product-overview.md` 등 spec 전반에 걸쳐 이미 광범위하게 쓰이는 구어적 동의어라 이번 수정이 새로 유발한 문제는 아니다. 다만 이번에 열을 분리하면서 정식 명칭("Model Config")과 나란히 놓이게 되어 불일치가 더 눈에 띄게 됐다.
  - 제안: 시급하지 않음. 여유가 있을 때 열 헤더를 "Model Config" 로 바꾸거나(1-auth.md 와 완전 정렬), 혹은 반대로 spec 전반의 "LLM Config" 관용 표현을 유지하려면 각주를 "LLM/Model Config" 로 통일해 표기 정합을 맞추는 정도. 어느 쪽이든 의미·RBAC 값 자체는 정확하므로 별도 spec 갱신 없이도 무방.

이 외에 데이터 모델·API 계약·요구사항 ID·상태 전이·계층 책임 관점에서는 본 diff 가 건드리는 범위가 없다(순수 RBAC 요약 서술 정정) — 새 엔티티/필드/엔드포인트/요구사항 ID 도입이 없어 해당 4개 관점은 해당 사항 없음(N/A).

## 요약

이번 target 변경은 새로운 충돌을 만드는 diff 가 아니라, 이전에 이미 지적된 CRITICAL cross-spec 불일치(“viewer 가 워크플로우를 수동 실행할 수 있다”는 `data-flow/12-workspace.md` 요약표의 서술이 `5-system/1-auth.md §3.2` 및 `2-navigation/9-user-profile.md §4.2` 와 정면으로 모순되던 상태)를 해소하는 정정 커밋이다. 재검증 결과 정정된 표의 6개 열·4개 행 값은 두 상위 spec 문서와 실제 코드(`@Roles('editor')` on execute/model-config 엔드포인트, `ROLE_HIERARCHY` 순서)에 전부 부합했고, 동일 표의 미수정 사본이나 깨진 앵커도 발견되지 않았다. 유일한 잔여 관찰은 "LLM Config" 열 헤더와 인용된 1-auth.md 의 "Model Config" 명칭 간의 사소한 표기 차이이며, 이는 spec 전반에 걸친 기존 관용 표현이라 이번 diff 가 새로 만든 문제가 아니고 값의 정확성에도 영향이 없다.

## 위험도

LOW
