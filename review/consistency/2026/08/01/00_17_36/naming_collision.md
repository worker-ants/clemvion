# 신규 식별자 충돌 검토 — spec-data-flow-structural-followups

대상: `plan/in-progress/spec-data-flow-structural-followups.md` (spec_impact: `spec/data-flow/12-workspace.md`, `spec/data-flow/3-execution.md`, 실제 diff 는 `spec/data-flow/0-overview.md` 도 포함)

## 조사 방법

target 의 실제 working-tree diff(`git diff -- spec/data-flow/0-overview.md spec/data-flow/12-workspace.md spec/data-flow/3-execution.md`)를 1차 자료로 삼고, 각 변경이 도입하는 식별자(섹션 헤딩·테이블 컬럼명·용어·파일명)를 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로)으로 대조했다. 대조 대상: `spec/5-system/1-auth.md` §3.2, `spec/2-navigation/9-user-profile.md` §4.2, `spec/2-navigation/6-config.md`, `spec/data-flow/7-llm-usage.md`, 형제 data-flow 문서 5종(`2-auth.md`/`3-execution.md`/`11-workflow.md`/`6-knowledge-base.md`/`1-audit.md`)의 헤딩 구조, 그리고 저장소 전체의 인바운드 앵커 링크.

## 발견사항

- **[WARNING]** plan 파일명이 기존 완료 문서와 접미 중복
  - target 신규 식별자: `plan/in-progress/spec-data-flow-structural-followups.md` (본 작업이 신설한 plan 파일)
  - 기존 사용처: `plan/complete/spec-sync-structural-followups.md` (2026-06-03 시작, 2026-07-06 완료 종결 — worktree `spec-sync-audit`, `spec/3-workflow-editor/5-version-history.md` 재배치 등 **완전히 다른 스코프**)
  - 상세: 두 파일명이 `...structural-followups.md` 접미를 공유한다. `ls plan/*/*structural-followups*` 또는 `grep -rl structural-followups plan/` 같은 부분 문자열 탐색을 하면 두 문서가 함께 걸려, "structural-followups"만 기억하는 사람이 스코프가 다른 두 문서를 혼동할 수 있다(하나는 spec-sync 감사 파생, 하나는 이번 RBAC/SIGTERM/명칭 통일 파생). 다만 실질 피해는 낮다 — 저장소 전수 검색 결과 두 파일에 대한 상호참조는 모두 전체 경로(`plan/in-progress/...` / `plan/complete/...`)로 명시돼 있어 **현재 깨진 링크나 잘못된 상호참조는 0건**이며, `spec-data-flow-` 접두 자체가 이미 `spec-sync-` 와 어느 정도 구분을 제공한다.
  - 제안: 기존 링크가 전부 정상이라 강제 리네임은 불필요. 다만 향후 이 두 문서를 동시에 열람할 상황(예: data-flow 전반 구조 이력 추적)을 대비해, target 문서 Overview 나 관련 plan 인덱스에 "`spec-sync-structural-followups.md`(완료, 2026-06 spec-sync 감사 파생, 무관 스코프)와 혼동 금지" 한 줄 각주를 남기는 정도의 조치면 충분하다.

- **[INFO]** "Model Config"/"LLM Config" 용어 이원화는 target 이 새로 만든 충돌이 아님 (확인됨)
  - target 신규 식별자: `spec/data-flow/12-workspace.md` §4 표 헤더·System role, `spec/data-flow/0-overview.md` 도메인 인덱스의 `Model Config` 표기
  - 기존 사용처: `spec/5-system/1-auth.md:384`(§3.2 매트릭스 "Model Config" 행), `spec/2-navigation/6-config.md:270`(`### Model Config API`), `spec/5-system/7-llm-client.md:452`, `spec/data-flow/7-llm-usage.md:11` — 전부 **동일 의미**로 이미 `Model Config` 를 canonical 명칭으로 쓰고 있어 target 표기와 정합함. 반대로 `spec/3-workflow-editor/_product-overview.md`(ED-AI-06~08 등)·`4-ai-assistant.md`·`4-nodes/3-ai/_product-overview.md`·`spec/5-system/_product-overview.md:27`(NF-SC-02) 는 여전히 `LLM Config` 를 쓴다 — **같은 리소스를 가리키는 두 표기가 spec/ 트리 안에 공존**한다.
  - 상세: 이 이원화 자체는 target 이 만든 게 아니라 이미 존재했다(`unified-model-management` V088~V092 이후 canonical 명칭이 `Model Config` 로 바뀌었지만 일부 문서만 갱신됨). target 은 `data-flow/` 스코프만 정리하고, 나머지 잔존을 **본인 문서 §4 "잔여 — 서술형 표기"에서 이미 식별자(`ASSISTANT_NO_LLM_CONFIG`·`llm-config-selector`·`ED-AI-06~08`)와 순수 서술을 구분해 별도 추적**하도록 명시했다 — 따라서 새로 도입된 충돌이 아니라 기존 이원화를 일부 축소한 변경이다.
  - 제안(추가 정보로만): 후속 작업 시 `spec/5-system/_product-overview.md:27` (NF-SC-02 행의 "LLM Config") 도 순수 서술이라 §4 잔여 작업 스코프(`5-system/`)에 포함됨을 재확인하면 된다 — 별도 조치 불요, 참고용 breadcrumb.

- **[INFO]** 도메인 문서 섹션 넘버링 발산 — 선례 있음, 충돌 아님 (확인됨)
  - target 신규 식별자: `spec/data-flow/12-workspace.md` 의 `## 4. 권한 (RBAC 요약)` / `## 5. 외부 의존` (형제 문서는 대부분 `## 4. 외부 의존` 로 끝남)
  - 기존 사용처: `2-auth.md`·`3-execution.md`·`11-workflow.md`·`6-knowledge-base.md` 는 모두 `## 1 Source→Sink / ## 2 Schema 매핑 / ## 3 상태 전이 / ## 4 외부 의존` 4-섹션 패턴을 따른다. 그러나 `1-audit.md` 는 이미 `## 1~## 5`(Read path·보존 정책 추가) 5-섹션으로 이 패턴을 깬 선례가 있다.
  - 상세: `12-workspace.md` 가 5번째(§4 RBAC 요약)를 추가해 형제 문서와 섹션 수가 달라지지만, (a) 섹션 번호는 파일 로컬이라 다른 파일에서 숫자만으로 교차 참조하는 곳이 없음(전수 인바운드 앵커 확인 0건), (b) `1-audit.md` 가 이미 동일한 종류의 확장 선례를 갖고 있고, (c) `0-overview.md §3.6` 이 이 확장을 "선택 요소"로 명문화해 향후 다른 도메인 문서도 같은 패턴을 따를 수 있게 규약화했다. 실질적인 식별자 충돌은 아니다.
  - 제안: `0-overview.md §3.6` 의 "현재 `12-workspace.md §4` 하나만 갖고 있다" 서술에 `1-audit.md` 의 5-섹션 선례(권한 요약은 아니지만 "선택적 확장" 선례로서)를 각주로 덧붙이면 향후 독자가 "이게 최초 예외인가"라는 의문을 갖지 않아도 된다 — 필수는 아님.

## 요약

target 문서의 실제 변경분(§1 RBAC 표 승격, §2 SIGTERM 각주, §3 LLM→Model Config 명칭 부분 통일)을 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로)으로 조사한 결과, **새로 도입된 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수는 없으며**, 유일하게 신설된 파일은 `spec/` 이 아니라 `plan/in-progress/spec-data-flow-structural-followups.md` 하나뿐이다. 그 파일명이 스코프가 다른 기존 완료 plan(`spec-sync-structural-followups.md`)과 접미가 겹쳐 부분 문자열 탐색 시 혼동 가능성이 있으나(WARNING), 현재 모든 상호참조가 전체 경로로 명시돼 있어 실질 피해는 없다. `Model Config`/`LLM Config` 용어 이원화나 도메인 문서 섹션 수 발산은 모두 사전 조사 결과 target 이 새로 만든 충돌이 아니라(전자는 이미 존재하던 이원화를 정확히 target 자신이 스코프를 밝혀 축소한 것이고, 후자는 `1-audit.md` 선례와 `0-overview.md §3.6` 규약화로 이미 흡수됨) INFO 수준의 참고 사항으로만 남긴다. 인바운드 앵커 링크 전수 확인(`12-workspace.md#32`/`#4` 패턴)에서도 깨진 참조는 0건으로, target 자신의 체크리스트 주장과 실제 저장소 상태가 일치했다.

## 위험도

LOW
