# 신규 식별자 충돌 검토 — spec/data-flow/ (--impl-done)

## 사전 확인 (SoT 워킹트리 기준)

- 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/review-info-followups`, HEAD=`9fa06cd4c`) 기준 `spec/` 변경은 `spec/data-flow/12-workspace.md` 1개 파일, §3.2 RBAC 요약표 + 각주뿐이다 (`git show 9fa06cd4c -- spec/data-flow/12-workspace.md` 로 대조).
- 이 diff 는 직전 라운드(`review/consistency/2026/07/31/19_20_50/`)의 cross_spec CRITICAL(viewer 실행 권한 오기재) + WARNING#1(Editor 의 "LLM Config / Integration" 병합 열이 CRUD 를 view 로 축소 서술)을 조치한 planner 커밋이다. **표의 셀 값을 정정하고, 병합 열을 "LLM Config"/"Integration" 두 열로 분리**했을 뿐 — 신규 요구사항 ID, 신규 엔티티/DTO/인터페이스명, 신규 API endpoint, 신규 webhook/queue/SSE 이벤트명, 신규 ENV var·config key, 신규 spec 파일 경로는 diff 어디에도 없다. 6개 관점 중 5개는 후보 자체가 없다.
- 유일하게 실질 검토가 필요한 축은 **엔티티/타입명**이다 — 병합 열을 분리하며 "LLM Config" 열을 신설하고, 새 각주가 그 근거로 "Model Config" 라는 이름을 이번 diff 에서 **이 파일 최초로** 사용했기 때문이다. 아래 발견사항 참조.
- 코드 대조: `POST /api/workflows/:id/execute` → `codebase/backend/src/modules/workflows/workflows.controller.ts:237-239` `@Roles('editor')` 일치. `ROLE_HIERARCHY`(`codebase/backend/src/common/guards/roles.guard.ts:20-25`) `viewer:1 < editor:2` 일치. `Integration` 엔티티(`codebase/backend/src/modules/integrations/entities/integration.entity.ts:22` `@Entity('integration')`) 존재 확인 — 열 이름 재사용에 실제 충돌 없음. 두 인용 모두 정확하다.

## 발견사항

- **[WARNING]** 새 각주가 "LLM Config"(표 헤더, 기존)와 "Model Config"(각주 신규 도입)를 같은 문단에서 무연결로 병용
  - target 신규 식별자: `Model Config` — `spec/data-flow/12-workspace.md:255-256`(이번 diff 신규 추가 각주)에서 이 파일 최초로 등장. 인접한 `spec/data-flow/12-workspace.md:241`(같은 표 헤더)은 그대로 `LLM Config` 를 쓴다("`| ... | LLM Config | Integration |`").
  - 기존 사용처:
    - 동일 파일 `spec/data-flow/12-workspace.md:11`(Overview) — "워크스페이스는 모든 리소스(워크플로우·통합·KB·**LLM Config** 등)의 격리 단위".
    - 동일 target 폴더 `spec/data-flow/0-overview.md:131` — 도메인 인덱스가 `7-llm-usage.md` 를 "**LLM Config** 해석·LLM 호출·usage_log 적재"로 요약. 그러나 정작 그 링크 대상 `spec/data-flow/7-llm-usage.md:11`은 이미 "워크스페이스 단위 **Model Config** (kind=chat/embedding...)"로 시작해 **같은 target 폴더 안에서도 두 이름이 갈려 있다**.
    - 정본(SoT) `spec/5-system/1-auth.md:379-402` §3.2 는 "LLM Config" 를 단 한 번도 쓰지 않고 전부 `Model Config`(행 이름 384, 각주 제목 "Model Config Editor CRUD 근거" 402)로 통일돼 있다. 이번 diff 의 각주가 인용하는 바로 그 각주다.
    - 백엔드 실체: 테이블 `model_config`(`codebase/backend/src/modules/model-config/entities/model-config.entity.ts:30` `@Entity('model_config')`), 컨트롤러/모듈 경로 `codebase/backend/src/modules/model-config/**`, API `/api/model-configs`. "llm_config" 테이블/엔티티/경로는 더 이상 존재하지 않는다 — `spec/1-data-model.md:583` "마이그레이션: `llm_config`→`model_config` rename ... (V088)", `spec/2-navigation/6-config.md:286` "구 alias 제거 완료 (PR4): 종전 `/api/llm-configs`... 프론트 redirect 라우트 `/llm-configs`... 는 `unified-model-management` PR4 에서 제거됐다."(2026-06-11, `bfdfd71fd`)
  - 상세: "LLM Config" 와 "Model Config" 는 **동일 리소스**를 가리키므로 엄밀한 의미상 충돌(같은 이름·다른 뜻)은 아니다. 그러나 방향이 반대인 위험이 실재한다 — **다른 이름·같은 뜻**이 한 표/한 각주 안에서 아무 연결 고리 없이 섞이면 독자는 두 열(혹은 표 헤더와 각주 설명)이 서로 다른 리소스를 가리킨다고 오해할 수 있다. 특히 이번 각주는 "**LLM Config** 와 Integration 은 editor 권한이 다르다" 로 시작해 곧바로 "**Model Config** 는 워크플로우 구축의 일부라 Editor CRUD" 로 근거를 댄다 — 이 표만 읽는 독자는 "Model Config" 가 "LLM Config" 열의 근거인지, 표에 없는 제3의 리소스인지 판단할 단서가 없다. `unified-model-management`(V088~V092, 2026-06-11/12 완료) 이후 API·내비게이션·컨트롤러·엔티티는 전부 "Model Config" 로 일원화됐고 "LLM Config" 별칭은 명시적으로 제거됐는데(`6-config.md:286`), 워크플로우 에디터·AI Assistant·노드 계열 product-overview 문서(`spec/3-workflow-editor/_product-overview.md`, `spec/3-workflow-editor/4-ai-assistant.md`(최종 수정 2026-07-14, rename 1개월 후에도 미동기화), `spec/4-nodes/3-ai/_product-overview.md`, `spec/5-system/_product-overview.md`)와 `spec/data-flow/12-workspace.md`/`0-overview.md`는 여전히 "LLM Config" 를 최신 명칭인 것처럼 쓴다. 이는 **의도적 UI 라벨 분리로 문서화된 적이 없는** 명명 드리프트다 — `spec/2-navigation/6-config.md` Rationale R-3 은 "단일 `ModelConfig` + 단일 `/models` 화면"으로 **화면 이름까지** 통합했다고 명시하며, "LLM Config" 를 UI 라벨로 유지한다는 결정은 어디에도 없다. 참고로 이 rename 의 파급(엔드포인트 alias·감사 액션명·내비게이션 URL 등)은 2026-06-10 두 차례 naming_collision 라운드에서 이미 WARNING/CRITICAL 로 상세 추적됐고 API/내비 레이어는 2026-06-16 라운드에 "해소"로 확인됐다 — 그러나 **product-facing 문서 표기**까지는 그 정리가 미치지 못했고, 이번 diff 가 그 미정리 지점(12-workspace.md)에 "Model Config" 라는 정확한 이름을 처음 흘려 넣으면서 **같은 표 안에서** 신·구 명칭이 처음으로 나란히 노출됐다.
  - 제안: 각주에 한 문장으로 동일 리소스임을 명시한다 — 예: "**LLM Config**(표 헤더 표기, 백엔드/1-auth.md 상 정식 명칭은 **Model Config** — 동일 리소스) 와 Integration 은 editor 권한이 다르다." 또는 표 헤더 자체를 `Model Config` 로 갱신(1-auth.md·6-config.md·7-llm-usage.md 와 통일)하고 Overview(`12-workspace.md:11`)·`0-overview.md:131` 의 "LLM Config" 표기도 함께 정정한다. 후자가 근본 해결이나 영향 범위가 넓으므로(product-overview 계열 다수 문서), 본 PR 범위에서는 최소 각주 한 줄 bridging 만 추가하고 전체 명칭 통일은 별도 후속 항목으로 분리하는 쪽을 권장한다.

- **[INFO]** `Integration(Org)` 표기 — 정본과 공백 불일치
  - target 신규 식별자: 없음(엔티티명 재사용, 신규 아님) — 표기 스타일만 지적.
  - 기존 사용처: `spec/5-system/1-auth.md:379` `Integration (Org)`(공백 있음) vs 이번 diff `spec/data-flow/12-workspace.md:255` `Integration(Org)`(공백 없음).
  - 상세: 동일 엔티티·동일 스코프 지칭이라 충돌은 없다. grep 가독성 관점의 사소한 표기 차이.
  - 제안: 조치 불요 수준이나, 다음 편집 시 `Integration (Org)` 로 공백 통일 권장.

## 요약

이번 diff(`spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 정정 + 병합 열 분리)는 신규 요구사항 ID·엔티티/DTO/인터페이스·API endpoint·webhook/queue/SSE 이벤트명·ENV/설정키·spec 파일 경로 6개 관점 중 5개에서 새로 도입된 식별자가 없다. 유일한 실질 이슈는 엔티티명 축이다 — 병합 열을 분리하며 신설한 "LLM Config" 열과, 그 근거로 이 파일에 처음 등장시킨 "Model Config"(1-auth.md 정본 명칭)가 동일 리소스임에도 각주 안에서 아무 연결 없이 섞여 있다(WARNING). 이는 `unified-model-management`(V088~V092, 2026-06-11/12) 이후 API·내비게이션 레이어는 "Model Config" 로 완전히 일원화됐지만 product-facing 문서 다수(및 본 target 폴더의 `12-workspace.md`·`0-overview.md`)가 아직 "LLM Config" 를 쓰는, 이전부터 있던 명명 드리프트가 이번 diff 의 새 각주에서 처음으로 한 문단 안에 가시화된 것이다. 두 이름 모두 실제로는 같은 리소스를 가리키므로 "동일 식별자·다른 의미"의 CRITICAL 충돌은 아니며, 시스템 동작에 영향은 없다. 그 외 `Integration(Org)` 공백 표기 차이는 조치 불요 수준의 INFO 다.

## 위험도
MEDIUM
