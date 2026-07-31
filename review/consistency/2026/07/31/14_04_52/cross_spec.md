# Cross-Spec 일관성 검토 — `spec-workflow-version-snapshot-drift`

## 검토 대상

- target: `plan/in-progress/spec-workflow-version-snapshot-drift.md` (spec draft, `--spec` 모드)
- 변경 스코프: `spec/1-data-model.md` §2.15 `WorkflowVersion.snapshot` 행 서술 정정 (코드 변경 없음)

## 독립 검증 (실측)

target 이 인용한 3개 소스를 직접 열어 대조했다.

| 소스 | 실측 결과 |
| --- | --- |
| `spec/1-data-model.md:572` §2.15 | `\| snapshot \| JSONB \| 워크플로우 전체 스냅샷 (nodes, edges, settings) \|` — target 의 AS-IS 인용과 정확히 일치 (현재 worktree·`origin/main` 양쪽 모두 아직 미수정, 중복 작업 위험 없음) |
| `spec/data-flow/11-workflow.md:52,61,232-238` | `snapshot=JSONB(name+description+nodes+edges)` + "스냅샷에 `workflow.settings` 는 포함되지 않는다" + Rationale "`workflow.settings` 는 포함하지 않는다 — 버저닝·복원 대상은 캔버스와 이름/설명이다" — target 의 TO-BE 와 일치 |
| `codebase/backend/src/modules/workflows/workflows.service.ts:620-651` `buildSnapshot()` | 반환 객체 키가 `name`/`description`/`nodes`/`edges` 뿐, `settings` 없음 — target 의 코드 인용과 일치 |

세 소스 모두 target 의 진단·TO-BE 문구와 정확히 부합한다. 새 요구사항 ID·API 계약·상태 머신·RBAC·계층 책임은 이 변경에 등장하지 않으므로 해당 4개 관점은 해당 없음(N/A).

## 발견사항

- **[INFO]** "두 spec 문서 상충" 프레이밍이 세 번째 동조 소스를 누락 — 실제로는 코드까지 포함해 3곳이 일치, data-model 1곳만 이탈
  - target 위치: `plan/in-progress/spec-workflow-version-snapshot-drift.md:2`(제목 "두 spec 문서에서 상충"), `:14`, `:61`("셋 중 둘(코드·data-flow)이 일치")
  - 충돌 대상: `spec/3-workflow-editor/5-version-history.md` §7.2(110-138행)·§8(154-164행) — API 응답 스냅샷 스키마를 `interface VersionSnapshot { name; description; nodes[]; edges[]; }` 로 명시하는 **정본 TypeScript 인터페이스**이며 `settings` 필드가 없다. 이 문서는 target 의 어디에도 인용되지 않았다.
  - 상세: 이것은 target 의 결론을 약화시키지 않는다 — 오히려 강화한다(코드·data-flow·version-history 3곳이 동일 shape 에 합의, data-model 만 outlier). 다만 "두 spec 문서 상충"·"셋 중 둘" 이라는 서술은 실제 증거 개수(정합 3 : 이탈 1)를 과소 집계한 표현이라 Overview/§2 의 역사 기록으로서는 부정확하다. version-history.md §7.2 가 필드 단위로 가장 정밀한 정의(실제 API DTO shape)를 갖고 있어, data-model 수정 시 참조할 근거로도 유용하다.
  - 제안: (선택) Overview 표에 `spec/3-workflow-editor/5-version-history.md §7.2/§8` 행을 추가하고 "두 spec 문서" → "data-flow·version-history(+코드) vs data-model" 로 문구를 정정. TO-BE 셀의 SoT 링크에도 `data-flow` 와 나란히 `[version-history §7.2](./3-workflow-editor/5-version-history.md#72-버전-상세)` 를 병기하면 가장 정밀한 필드 정의(TS interface)까지 한 번에 가리킬 수 있다. 블로킹 아님 — 현재 TO-BE 문구(`name`/`description`/`nodes`/`edges`)는 이미 세 소스 모두와 정확히 일치한다.

- **[INFO]** TO-BE 셀의 SoT 링크에 `#`-anchor 없음 (기존 문서 내 유사 패턴과 형식 편차)
  - target 위치: `plan/in-progress/spec-workflow-version-snapshot-drift.md:57` — `[data-flow §1.1 / Rationale "버전 스냅샷 = JSONB"](./data-flow/11-workflow.md)`
  - 충돌 대상: `spec/1-data-model.md` §2.10 `Integration.install_token` 행 — 같은 문서 안에서 이미 "다른 파일의 Rationale 서브섹션을 가리키는" 동일 패턴을 쓰면서 `[Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale)` 처럼 `#rationale` anchor 를 포함한다.
  - 상세: 기능적 오류는 아니다(파일 링크 자체는 유효) — 단지 같은 문서 내 기존 관례와 형식이 다르다. 클릭 시 파일 최상단이 아니라 해당 섹션으로 바로 이동하는 편의가 없어진다.
  - 제안: (선택) `./data-flow/11-workflow.md#rationale` 로 anchor 를 붙여 기존 관례와 맞출 수 있다. 블로킹 아님.

## 추가 확인 (충돌 없음 — 근거만 기록)

- `spec/3-workflow-editor/0-canvas.md:517`, `spec/4-nodes/4-integration/0-common.md:112` 등 `WorkflowVersion`/`workflow_version` 을 언급하는 나머지 spec 파일은 스냅샷 필드 구성(=settings 포함 여부)을 재서술하지 않아 이번 정정과 무관.
- `spec/1-data-model.md` §2.4 `Workflow.settings` 행 자체는 버저닝 여부를 언급하지 않아 영향 없음.
- `plan/` 전체에서 "향후 settings 도 버저닝 대상에 포함" 같은 상반 의도의 백로그 항목 없음 — 방향 전환 리스크 없음.
- `spec/data-flow/11-workflow.md` §1.5(복제)의 "description/tags/folder_id/settings 승계" 는 `Workflow.duplicate()` 가 **workflow 행**에 `settings` 를 직접 복사하는 별개 동작이며 `WorkflowVersion.snapshot` JSONB 와는 무관 — 혼동 소지 없음.
- data-model.md 가 상세 근거를 data-flow 로 위임하고 본문 중복을 피하는 패턴(target §2 의 논리)은 같은 문서 §2.10 Integration 행에서 이미 쓰이는 선례와 일치 — 신규 관례 도입이 아니다.

## 요약

target 의 진단·TO-BE 문구를 코드(`buildSnapshot()`)·`spec/data-flow/11-workflow.md`·(target 이 인용하지 않은) `spec/3-workflow-editor/5-version-history.md` 세 곳에 대해 직접 대조 검증한 결과 완전히 일치했다. `spec/1-data-model.md:572` 가 유일한 stale 소스이며, 다른 spec 영역(요구사항 ID·API 계약·상태 머신·RBAC·계층 책임)에 새로운 충돌을 만들지 않는 순수 문서 정합화다. 발견한 두 건은 모두 INFO 수준의 서술 정확도·링크 편의성 개선 제안으로, 수정 방향 자체에는 영향이 없다.

## 위험도

LOW
