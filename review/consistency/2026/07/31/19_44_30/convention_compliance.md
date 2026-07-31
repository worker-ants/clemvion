STATUS=success reviewer=convention_compliance

===REPORT_MARKDOWN_BELOW===

# 정식 규약 준수 검토 — `spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 정정

## 검토 대상 확인

`git diff origin/main...HEAD`는 `spec/data-flow/12-workspace.md` 단 1개 파일, §3.2 "RBAC 매트릭스 (요약)" 절에 국한된다 (커밋 `9fa06cd4c` "docs(spec): impl-done 게이트 Critical 조치 — RBAC 요약표 viewer 실행 권한 정정"). 변경 내용: ① `viewer` 행 "실행" 셀 `✓ (수동 실행 only)` → `✗` 정정, ② 병합 열 "LLM Config / Integration" 을 2개 열로 분리, ③ 근거 각주 2개 추가.

본 검토는 이 변경(및 `spec/data-flow/` 전체 16개 문서)이 `spec/conventions/**` 및 CLAUDE.md 의 명명·문서구조 컨벤션을 따르는지만 본다 — cross-spec 데이터 정합성·명명 충돌·Rationale 이력은 동일 세션의 다른 checker(`cross_spec`·`naming_collision`·`rationale_continuity`) 산출물이 이미 다루므로 중복하지 않는다(특히 "LLM Config" vs "Model Config" 명칭 드리프트는 `naming_collision.md` 가 WARNING 으로 상세 추적 완료 — 본 문서에서 반복하지 않음).

## 발견사항

- **[WARNING]** RBAC 매트릭스가 "상태 전이" 섹션 규약 범위 밖에 위치
  - target 위치: `spec/data-flow/12-workspace.md` `## 3. 상태 전이` > `### 3.2 RBAC 매트릭스 (요약)` (표 + 신규 근거 각주 2개, 대략 239~256행)
  - 위반 규약: `spec/data-flow/0-overview.md` `## 3. 공통 규약`(각 도메인 spec 이 따라야 할 5요소 정식 템플릿) 중 `### 3.4 상태 전이 / 흐름 단계` — "엔티티가 `status` 류 enum 을 가질 때 Mermaid `stateDiagram-v2` 로 전이를 그린다. 단계형 흐름이라면 표 또는 numbered list 로 분해한다." (이 문서는 `spec/conventions/` 밖에 있지만 CLAUDE.md 정보 저장 표의 "폴더 위에서 cross-cutting 으로 참조되는 루트/도메인 진입 문서"에 해당하며, 15개 형제 문서 전원이 실제로 이 템플릿을 따르므로 사실상의 도메인 정식 규약이다.)
  - 상세: RBAC 권한 매트릭스는 엔티티 status enum 전이도, 단계형 실행 흐름도 아닌 정적 권한 참조표다. 같은 폴더의 나머지 문서를 전수 확인한 결과(`2-auth`·`3-execution`·`5-integration`·`6-knowledge-base`·`7-llm-usage`·`10-triggers`·`11-workflow`·`13-agent-memory`·`14-chat-channel`·`15-external-interaction` 등) `## 3. 상태 전이`의 하위 항목은 예외 없이 실제 entity status/enum(`execution.status`, `integration.status`, `workflow.is_active`, `trigger.is_active`, `ConversationState` 등)이며, `12-workspace.md` 만 유일하게 이 섹션 아래 권한표를 얹어 도메인 공통 템플릿에서 이탈한다. 이번 diff 는 그 표를 확장(열 분리 + 근거 각주 2개 추가)했을 뿐 위치는 그대로 두어 구조적 이탈을 그대로 남겼다 — 다만 이 배치 자체는 이번 라운드 이전부터 있던 것이라 이번 diff 가 "새로" 만든 위반은 아니다.
  - 제안: `§3.2`를 `## 3. 상태 전이` 밖으로 옮긴다(예: `§1.6 역할 변경/소유권 이전` 뒤에 배치하거나 별도 `## X. 권한(RBAC)` 섹션으로 승격). 최소 변경으로는 표제를 "상태 전이 및 권한 요약" 처럼 넓히거나, `0-overview.md §3 공통 규약`에 "도메인 문서는 5요소 뒤에 선택적 RBAC 요약을 덧붙일 수 있다"는 예외 조항을 명문화 — 어느 쪽이든 지금은 규약 문면과 실제 배치 사이에 괴리가 있다는 점만은 정리가 필요하다.

- **[INFO]** 신규 근거 각주가 인용하는 footnote 는 실제로는 다른 리소스(Auth Config)를 예시로 든다
  - target 위치: `spec/data-flow/12-workspace.md` 신규 각주 — "**LLM Config 와 Integration 은 editor 권한이 다르다** — … Integration(Org)은 외부 자격증명이라 Editor R 이다 (1-auth.md §3.2 및 그 아래 `"Model Config Editor CRUD 근거"` 각주)."
  - 위반 규약: 엄밀히는 `spec/conventions/**` 항목이 아니라 인용 정확성 이슈에 가까워 CRITICAL/WARNING 이 아닌 참고용 INFO로 남긴다(다른 checker 소관일 수 있음).
  - 상세: `spec/5-system/1-auth.md:402` 의 "Model Config Editor CRUD 근거" 각주 원문은 "Model Config … 반면 **Auth Config** 는 외부 인증 자격증명이라 Editor=R 로 좁힌다"로, 대비 대상이 **Auth Config**(`auth-configs` 모듈)이지 **Integration**(`integrations` 모듈, 별개 엔티티/컨트롤러로 코드에서 확인됨)이 아니다. 인용된 값 자체(`Integration (Org)` 행: `CRUD|CRUD|R|R`, 1-auth.md:379)는 정확하지만, 지목된 각주 문장은 "Integration" 을 문자 그대로 다루지 않는다.
  - 제안: "Integration(Org)은 외부 자격증명이라 Editor R 이다" 뒤의 인용을 "Auth Config 와 같은 논리로(1-auth.md §3.2)" 처럼 바꾸거나, 1-auth.md 에 Integration 전용 근거 각주를 별도로 두는 것이 정확하다. 값의 정확성에는 영향 없어 시급하지 않다.

- **[INFO]** 신규 인용 표기에 backtick 코드-스팬 누락 (같은 문단 내 스타일 불일치)
  - target 위치: `spec/data-flow/12-workspace.md` 신규 문장 — "1-auth.md §3.2 의 `Workflow 실행` 행도 Viewer 를 `—` 로 둔다" 및 "(1-auth.md §3.2 및 그 아래 …)" — 두 곳 모두 `1-auth.md §3.2` 부분이 backtick 없이 평문.
  - 위반 규약: 명시적 `spec/conventions/**` 규정은 없음 — 같은 문서·같은 문단 내 기존 관행(바로 위 줄 "정식 권한 매트릭스는 `` `spec/5-system/1-auth.md §3.2` ``.")과의 국소 스타일 불일치.
  - 상세: 문서·섹션 참조를 backtick 으로 감싸는 표기가 `12-workspace.md` 전반(및 data-flow 폴더 다수 문서)에서 반복 관측되는 관행인데, 이번에 새로 추가된 두 문장만 그 관행에서 벗어나 있다.
  - 제안: `1-auth.md §3.2` → `` `1-auth.md §3.2` `` 로 통일. 사소한 스타일 문제라 조치 시급성은 낮음.

- **[INFO]** 신규 근거 문단이 `## Rationale` 대신 본문 인라인에 위치 (CLAUDE.md 저장 위치 원칙과 결이 다름 — 기존 관행과는 부합)
  - target 위치: `spec/data-flow/12-workspace.md` §3.2 표 바로 아래 신규 blockquote 2개, 특히 "**LLM Config 와 Integration 은 editor 권한이 다르다** — … 병합 열로 두면 한쪽이 반드시 틀리므로 분리했다."
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`".
  - 상세: 이 문단은 열 분리라는 설계 결정의 근거 서술로, 원칙대로면 문서 말미 `## Rationale`에 위치하고 §3.2에는 링크만 남기는 편이 표준적이다. 다만 같은 문서에 이미 다수의 유사한 인라인 배경 설명(§1.4 "personal workspace 는 이 경로에서 생성하지 않는다" 근거, §1.5 "구현." 노트, §1.9 "에러 코드 케이스" 노트 등)이 선례로 존재해, 이번 추가는 새로운 이탈이라기보다 이 문서·폴더에 걸쳐 이미 정착된 로컬 관행의 연장이다.
  - 제안: 규약을 엄격히 지키려면 이 문단을 `## Rationale` 로 옮긴다. 다만 기존 관행과 충돌하므로, 팀이 "표/그림 바로 아래의 1~3문장 근거 노트"를 의도된 로컬 패턴으로 인정한다면 CLAUDE.md 저장 위치 표에 그 예외를 명문화하는 편이 실효적이다. 시급성은 낮음(이미 광범위하게 쓰이는 패턴이라 이번 건만 고쳐도 일관성이 개선되지 않음).

## 나머지 관점 확인 (이상 없음)

- **문서 구조 (Overview/Rationale 골격)**: `spec/data-flow/` 16개 파일 전수 확인 — `## Overview`·`## Rationale` 헤더가 예외 없이 1개씩 존재. `0-` prefix(`0-overview.md`)·번호 접두 파일명 규약도 전 파일 준수.
- **명명 규약**: 신규/변경된 식별자 인용(`ROLE_HIERARCHY`, `@Roles('editor')` on `POST /api/workflows/:id/execute`)을 워킹트리에서 직접 대조(`codebase/backend/src/common/guards/roles.guard.ts:20`, `codebase/backend/src/modules/workflows/workflows.controller.ts:237-239`) — 정확히 일치.
- **출력 포맷/에러 코드 규약(`error-codes.md`)**: 이번 diff 는 에러 코드·API 응답 스키마를 건드리지 않는다. 기존 §1.2/§1.9 의 lower_snake_case ↔ UPPER_SNAKE_CASE 이원화 서술(에러 코드 예외 레지스트리, `error-codes.md §3`)도 diff 밖이라 영향 없음.
- **API 문서 규약(`swagger.md`)**: 이번 diff 는 DTO/컨트롤러 코드를 포함하지 않아 직접 해당 없음. 참고로 대조한 `workflows.controller.ts:227` 는 `@Roles('editor')` 엔드포인트에 `@ApiForbiddenResponse` 를 동반해 `swagger.md §5-4` 체크리스트를 이미 준수 중.
- **표 마크다운 정합성**: 신규 7열 표(헤더/구분선/4개 행)를 `awk -F'|'` 로 실측 — 전 행 필드 수 일치, 렌더링 깨짐 없음.
- **금지 항목**: `spec/conventions/**` 가 명시적으로 금지하는 패턴(빈 껍데기 Swagger 스키마, `additionalProperties` 남용, 에러코드 임의 rename 등)에 해당하는 신규 내용 없음.

## 요약

이번 target 변경(`spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 정정)은 정식 규약(`spec/conventions/**` 및 CLAUDE.md 문서구조 규약) 관점에서 새로운 위반을 만들지 않는다. 표 마크다운은 정합하고, 인용된 코드 식별자는 워킹트리 대조 결과 정확하며, 문서의 Overview/Rationale 골격과 파일 명명 규약도 폴더 전체가 준수한다. 다만 §3.2 "RBAC 매트릭스"가 도메인 공통 규약(`0-overview.md §3.4`)이 정의한 "상태 전이" 범위 밖 내용을 그 섹션 아래 두고 있다는 사전 존재 구조적 이탈이 있으며, 이번 diff 가 그 섹션을 확장하면서도 위치는 정리하지 않았다(WARNING). 그 외 각주 인용 정확도·backtick 표기 일관성·인라인 근거문 배치는 조치 시급성이 낮은 INFO 수준이다.

## 위험도

LOW
