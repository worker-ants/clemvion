# Cross-Spec 일관성 검토 — spec-data-flow-structural-followups

대상: `plan/in-progress/spec-data-flow-structural-followups.md` (spec_impact: `spec/data-flow/12-workspace.md`, `spec/data-flow/3-execution.md`; 실제 diff 는 `spec/data-flow/0-overview.md` 포함 3개 파일)

## 검토 방법

번들 프롬프트가 컨텍스트 예산으로 `spec/data-flow/0-overview.md`, `spec/data-flow/12-workspace.md`, `spec/data-flow/3-execution.md`, `spec/5-system/1-auth.md`, `spec/2-navigation/6-config.md`, `spec/data-flow/7-llm-usage.md`, `spec/2-navigation/9-user-profile.md` 등 판정에 직결되는 파일을 다수 생략했으므로(생략 목록에 명시), 이 파일들은 워크트리에서 `Read`/`grep` 로 직접 열어 대조했다. 또한 실제 워크트리에 이미 반영된 uncommitted diff(`git diff`)를 1차 자료로 사용했다 — target 문서의 체크리스트가 서술하는 "적용 결과"와 실제 파일 상태가 정확히 일치하는지 라인 단위로 확인했다.

## 발견사항

이번 target 은 3건 모두 **배치·표기 변경**(RBAC 섹션 위치, SIGTERM 각주, 용어 통일)이며 데이터 모델·API 계약·요구사항 ID·RBAC 권한 값 자체를 바꾸지 않는다. 6개 관점으로 대조한 결과 **CRITICAL/WARNING 급 충돌은 발견되지 않았다.** 아래는 검증 과정에서 확인한 사실과, 비차단 수준의 완결성 관찰(INFO) 이다.

### 검증되어 충돌 없음으로 확인된 항목 (참고용, 발견사항 아님)

- **RBAC 섹션 배치(§1)**: `12-workspace.md#32-rbac-…` / `#4-외부-의존` 형태의 인바운드 앵커를 `spec/`·`plan/`·`review/`·`codebase/` 전역에서 검색한 결과 실제로 **0건**이었다(target 체크리스트의 주장과 일치). 기존 인바운드 링크는 전부 `§1.x`/`§Rationale`/전체 문서 참조뿐이라 `## 3.2` → `## 4` 승격, `## 4 외부 의존` → `## 5` 재번호가 안전하다. `spec/data-flow/0-overview.md` 신설 `### 3.6 권한 요약 (선택)` 은 `### 3.4 상태 전이`(엔티티 status enum 전이 전용, 본문에서 명시적으로 재확인됨) 와 분리되어 있고, "권장 5요소"(§2 서술) 텍스트는 3.6 을 선택 요소로 정확히 구분해 모순이 없다. 형제 data-flow 문서 14개 전수 확인 결과 `RBAC`/`권한`/`role` 헤딩이 있는 문서는 없음(target 의 "15개 형제 전원이 템플릿을 지킨다" 주장과 일치).
- **RBAC 값 일관성**: `spec/5-system/1-auth.md §3.2`("Workflow 실행" 행 Viewer=`—`, "Model Config" 행 CRUD/CRUD/CRUD/R, "Integration (Org)" 행 CRUD/CRUD/R/R) ↔ `spec/data-flow/12-workspace.md §4`(viewer 실행=`✗`, editor/Model Config=`✓`, editor/Integration=`view`) ↔ `spec/2-navigation/9-user-profile.md §4.2`(워크플로우 실행 Viewer=`❌`) — **세 표 모두 값이 합치**한다. 과거 Critical 이었던 "viewer 실행 권한" 오기는 이미 세 곳 모두 정정된 상태.
- **SIGTERM 각주(§2)**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 확인 결과 (a)/(b) 결정은 실제로 **미결**(체크박스 미체크)이었고, `data-flow/3-execution.md` 에 추가된 각주는 "본 문서는 어느 쪽도 선점하지 않는다"는 문구대로 중립적이다. 종속 실측 갭 인용("`assertExecutionNotCancelled` 는 `CANCELLED` 만 본다")도 `plan/in-progress/node-cancellation-residual-signal-propagation.md:197-199` 원문과 정확히 일치한다. `3-execution.md §3.1/§3.2` 의 기존 상태 전이 다이어그램(`running --> failed: ... SERVER_INTERRUPTED ...`)이나 `spec/1-data-model.md`/`spec/5-system/4-execution-engine.md:1305` 의 `SERVER_INTERRUPTED` 서술과도 사실관계가 어긋나지 않는다(모두 "현재 구현"을 동일하게 기술).
- **명칭 통일(§3)**: 저장소 전수 `grep -rn "LLM Config" spec/` 결과 잔존 위치는 정확히 `3-workflow-editor/4-ai-assistant.md`, `3-workflow-editor/_product-overview.md`, `4-nodes/3-ai/_product-overview.md`, `5-system/_product-overview.md` 뿐이다 — target §4 "잔여" 목록이 예고한 범위와 일치하고 `2-navigation/`·`data-flow/` 에는 서술형 잔존이 없다. `spec/2-navigation/6-config.md:286` 의 "구 alias 제거 완료 (PR4)" 문서화, `spec/data-flow/7-llm-usage.md:11` 의 기존 "Model Config" 표기 모두 target 이 인용한 그대로 확인됐다.

### INFO — 완결성 관찰 (비차단)

- **[INFO]** `plan_impact` frontmatter 누락 파일
  - target 위치: `plan/in-progress/spec-data-flow-structural-followups.md` frontmatter `spec_impact:`
  - 충돌 대상: 실제 `git diff` 는 `spec/data-flow/0-overview.md`(§3.6 신설 + 도메인 인덱스 1행)도 수정하는데 frontmatter 는 `12-workspace.md`·`3-execution.md` 2개만 명시
  - 상세: 직접적인 spec-vs-spec 모순은 아니지만, `spec_impact` 를 근거로 영향 범위를 판단하는 후속 프로세스(예: 다른 검토자·audit)가 `0-overview.md` 변경을 놓칠 수 있다.
  - 제안: `spec_impact` 에 `spec/data-flow/0-overview.md` 추가.

- **[INFO]** SIGTERM 미결 각주의 비대칭 노출
  - target 위치: `spec/data-flow/3-execution.md §3.3` (신규 각주)
  - 충돌 대상: `spec/5-system/4-execution-engine.md`(§11, 그리고 `spec-update-node-cancellation-shutdown-classification.md` 자신이 "이미 3곳에 인코딩된 구조적 invariant"로 지목하는 §Rationale §4/§11) · `spec/1-data-model.md`(`SERVER_INTERRUPTED` bullet)
  - 상세: 세 문서 모두 오늘의 동작(`failed`+`SERVER_INTERRUPTED`)은 동일하게 기술해 사실관계 모순은 없다. 다만 "이 분류가 재검토 대상"이라는 경고는 이번 target 이 `data-flow/3-execution.md` 한 곳에만 달아, 같은 사실을 다루는 다른 두 문서를 먼저 읽는 독자는 이 분류가 확정된 것으로 오인할 수 있다. target 의 Rationale 이 스스로 "고치면 scope 가 번진다"며 이번 범위를 data-flow 로 한정한 판단은 합리적이나, 향후 (a)/(b) 결정 PR 착수 전 참고용으로 남긴다.
  - 제안: 필수 조치 아님. 여유가 있다면 `execution-engine.md §11`(또는 그 Rationale)에도 동일한 한 줄 포인터를 추가 — 단, 이는 이번 target 의 P3 스코프 밖이므로 별도 후속으로 남겨도 무방.

- **[INFO]** 세 번째 RBAC 요약표의 SoT 링크 관례 미적용 (target 범위 밖, 사전 존재)
  - target 위치: `spec/data-flow/0-overview.md §3.6`(신규 규약: "요약표 아래에 SoT 링크를 반드시 단다")
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2 역할 권한 매트릭스`
  - 상세: §3.6 규약은 `spec/data-flow/` 도메인 문서에 한정되므로 `2-navigation/` 문서에 적용 의무는 없고, 값 자체도 이미 `1-auth.md §3.2`·`12-workspace.md §4` 와 합치한다. 다만 같은 원칙을 적용하면 `9-user-profile.md §4.2` 아래에도 "정식 SoT: `1-auth.md §3.2`" 링크를 붙여 세 표의 관례를 통일할 수 있다 — 이번 target 의 `spec_impact` 밖이므로 강제 사항 아님.
  - 제안: 후속 P3/P4 로 별도 추적 가능. 이번 target 수정 불요.

## 요약

target 의 3건(RBAC 섹션 승격, SIGTERM 미결 각주, `data-flow/` 범위 명칭 통일)은 모두 **사전 검증 가능한 구체적 주장**(인바운드 앵커 0건, 미결 plan 상태, 전수 grep 결과)으로 뒷받침되어 있고, 직접 파일을 열어 대조한 결과 그 주장이 실제 워크트리 상태와 정확히 일치했다. `1-auth.md`(RBAC 정본) · `9-user-profile.md`(제3의 RBAC 요약) · `7-llm-usage.md`/`6-config.md`(Model Config 명명 정본) 등 인접 spec 영역과 비교해도 값·용어·앵커 수준에서 모순이 없다. 발견된 것은 CRITICAL/WARNING 이 아니라 완결성 차원의 INFO 3건(모두 target 범위 밖이거나 필수 아님)뿐이다.

## 위험도
LOW
