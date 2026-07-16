# 유지보수성(Maintainability) 리뷰 결과

## 스코프 메모

이번 변경분 35개 파일은 전부 **spec 문서(`spec/**/*.md`)** 와 **consistency-check 리뷰 산출물(`review/consistency/**/*.md`, `meta.json`, `_retry_state.json`)** 이며, 실행 가능한 애플리케이션 소스(`.ts`/`.tsx` 등)는 포함되지 않는다. 따라서 함수 길이·중첩 깊이·순환 복잡도 같은 전통적 코드 메트릭 관점은 적용 대상이 없다. 아래는 문서/산출물에 적용 가능한 관점(가독성·네이밍·중복·일관성·"매직 넘버"에 대응하는 하드코딩 리터럴 중복)으로 재해석해 검토한 결과다.

## 발견사항

- **[WARNING]** 매직 넘버성 수치 리터럴(485 / 128 / 161)이 SoT 링크 없이 다수 지점에 중복 하드코딩됨 — 이번 변경 자체가 해소하려는 "~180 화석 drift" 와 동일한 재발 패턴
  - 위치: `spec/0-overview.md:79`, `spec/2-navigation/4-integration.md:1116`, `spec/4-nodes/3-ai/0-common.md:63`, `spec/4-nodes/3-ai/1-ai-agent.md:49`·`:333`, `spec/4-nodes/4-integration/4-cafe24.md:29`·`:446`, `spec/5-system/11-mcp-client.md:339`
  - 상세: "485"(Cafe24 endpoint 총수)와 "128"(`AI_AGENT_TOOL_COUNT_MAX` 기본값)이 실측 결과 최소 7개 지점에 리터럴로 재기입되어 있다. `4-cafe24.md:29`(원 SoT)만 "2026-07-17 실측", "규모 SoT: Cafe24 API 카탈로그 §5 Coverage Matrix" 각주를 동반하고, 나머지 6곳(`0-overview.md`, `2-navigation/4-integration.md`, `0-common.md`, `1-ai-agent.md` 2곳, `11-mcp-client.md`)은 날짜·출처 각주 없이 숫자만 복제한다. Markdown 에는 상수 재사용 메커니즘이 없어 완전한 회피는 어렵지만, 코드의 "매직 넘버 산발"과 정확히 동형인 문제다 — 다음 카탈로그 갱신 시 이 6곳을 모두 수동으로 찾아 고쳐야 하고, 하나라도 놓치면 이번에 정정한 "~180" 화석과 동일한 종류의 drift 가 다시 발생한다. 실제로 `spec/conventions/cafe24-api-catalog/_overview.md §5 Coverage Matrix` 라는 canonical source 가 이미 존재하는데도 대부분의 인용처가 링크 대신 숫자를 복제하는 방식을 택했다. (이 관찰은 이번 리뷰 대상에 포함된 `review/consistency/2026/07/17/00_35_59/convention_compliance.md` WARNING #2·`rationale_continuity.md` WARNING 이 이미 동일하게 지적한 사안이며, 실제 반영된 spec 상태에서도 그대로 재현됨을 확인했다.)
  - 제안: 단일 SoT(`4-cafe24.md §지원 범위` 또는 카탈로그 `_overview.md §5`)만 정확 수치·날짜를 유지하고, 나머지 인용처는 리터럴 대신 "[§지원 범위 참조]" 형태의 링크 위주 서술로 낮추거나, 최소한 모든 리터럴에 동일한 날짜·SoT 각주를 일괄 부여해 향후 갱신 시 `grep` 으로 전수 파악 가능하게 할 것.

- **[INFO]** Rationale 앵커 명명 규약 부재 — `R-N` / `R-<도메인>-N` / `R-wontdo-<slug>` 세 계열이 규율 문서 없이 공존
  - 위치: `spec/4-nodes/1-logic/11-merge.md:226` `### R-wontdo-async-fanin`(신설), 비교 대상 `spec/3-workflow-editor/2-edge.md ### R-1~R-3`, `spec/7-channel-web-chat/1-widget-app.md ### R8`, `spec/5-system/6-websocket-protocol.md #R-wontdo-rawws-rest`
  - 상세: 이번에 신설된 `R-wontdo-async-fanin` 앵커는(리뷰 이력상 초안 단계였던 `R-adr-async-fanin` 에서 최종적으로 `R-wontdo-*` 계열로 정정되어 현재 spec 에 반영된 상태를 실측 확인) 기존 `R-wontdo-*` 선례를 정확히 따르고 있어 이번 diff 자체는 문제 없다. 다만 이 과정에서 리뷰 산출물들(`review/consistency/2026/07/17/00_55_57/` 세션의 `SUMMARY.md`·`convention_compliance.md`·`naming_collision.md` 등)이 공통으로 지적했듯, 저장소 전체적으로 `R-N`(순수 순번)·`R-<도메인>-N`(예: `R-CCA-N`)·`R-wontdo-<slug>`(의미 slug) 세 명명 계열이 규율 문서 없이 관례로만 공존한다. 이번 diff 의 결함은 아니지만, 새 Rationale 항목을 추가할 때마다 접두를 즉흥적으로 결정하게 되는 구조적 유지보수 리스크가 남아 있다.
  - 제안: `spec/conventions/` 에 Rationale 앵커 명명 규약을 짧게 명문화(예: 순수 결정=`R-N`, won't-do/dormant 결정=`R-wontdo-<slug>`, 도메인 클러스터=`R-<도메인>-N`)해 향후 판단 기준을 고정. 이번 PR 필수는 아님(비차단).

- **[INFO]** `spec/0-overview.md` 요약 테이블 셀에 긴 인라인 경고 문구가 삽입되어 표의 스캔성이 저하
  - 위치: `spec/0-overview.md:79`(Cafe24 행), `:80`(MakeShop 행)
  - 상세: 원래 "한눈에 훑어보기" 용도인 기능 개요 테이블의 셀에 "⚠ 이 규모는 ... 사실상 필수. [AI Agent §4.2](...)" 형태의 링크 포함 경고 문단이 인라인으로 추가되어, 해당 셀이 인접 행 대비 현저히 길어졌다. 정보 자체는 정확하고 유용하나 Overview 문서의 "한 화면 스캔" 목적과는 다소 배치된다.
  - 제안: 경고 상세는 링크된 §4.2 로 위임하고 Overview 셀에는 짧은 플래그(예: "⚠ allowlist 필수 — 상세 §4.2")만 남기는 편이 테이블 가독성에 유리. 비차단.

- **[INFO]** 리뷰 산출물(`review/consistency/**`)의 "상세" 항목이 단일 초장문 문단으로 작성되어 재검토 시 스캔 비용이 큼
  - 위치: 예 `review/consistency/2026/07/17/00_35_59/plan_coherence.md` 세 번째 발견사항 상세(~600자 단일 문단), `review/consistency/2026/07/17/00_35_59/rationale_continuity.md` 첫 발견사항 상세(~700자), `review/consistency/2026/07/17/00_55_57/convention_compliance.md` 다수 항목
  - 상세: 이 파일들은 프로젝트 표준 산출물 포맷(발견사항/요약/위험도)을 정확히 따르고 있어 구조 자체는 일관적이다. 다만 각 발견사항의 "상세" 필드가 여러 사실(교차검증 결과·날짜·근거 인용·부차 관찰)을 쉼표·em-dash 로 이어붙인 단일 문단으로 압축되어 있어(문단당 400~800자) 한 번에 소화하기 어렵다. audit trail 성격상 완전성이 우선이라는 점은 이해되나, 세션이 누적될수록(`SUMMARY.md` 는 수십~수백 줄) 재검토자의 스캔 비용이 커진다.
  - 제안: 향후 checker 산출물 템플릿에서 "상세" 항목 내부에도 하위 bullet(사실/근거/영향 구분)을 쓰는 관례를 권장. 이번 PR 자체를 되돌릴 필요는 없음(비차단, 현재 형식이 이미 프로젝트 표준을 준수).

## 그 외 확인한 부분 — 문제 없음

- 신설된 spec 산문(예: `4-cafe24.md` §9.1 "endpoint 규모 실측" 단락, `11-merge.md` §Rationale `R-wontdo-async-fanin`, `1-ai-agent.md` §4.2 note)은 모두 기존 문서의 blockquote·날짜 타이틀 스타일(`> **... (YYYY-MM-DD)**: ...`)을 일관되게 따른다.
- `plan/in-progress/parallel-p2-followups.md` → `plan/complete/` 이동에 따른 4개 spec 파일의 상대링크 경로 정정(`cross-node-warning-rules.md`, `execution-context.md`, `node-cancellation.md`, `10-parallel.md`)은 기계적이고 명확하며 가독성에 영향 없음.
- `review/consistency/**` 3개 세션 디렉토리(`00_17_40`/`00_35_59`/`00_55_57`) 간 파일 구조(SUMMARY.md/meta.json/_retry_state.json/checker별 md)가 완전히 동일해 툴링 산출물로서의 일관성은 우수함 — 세션 간 내용 중복은 각 세션이 서로 다른 target 범위를 다루는 설계상 자연스러운 결과이며 회피 대상 "코드 중복"에 해당하지 않음.

## 요약

이번 변경분은 애플리케이션 코드가 아닌 spec 문서와 consistency-check 리뷰 산출물로 구성되어 함수 길이·중첩·순환 복잡도 등 전통적 코드 메트릭은 해당하지 않는다. 문서 유지보수성 관점에서 가장 실질적인 이슈는 "매직 넘버"에 대응하는 수치 리터럴(485/128/161)이 SoT 각주 없이 6곳 이상에 중복 하드코딩된 점으로, 이는 이번 변경이 정정하려는 "~180 화석 drift" 와 동일한 재발 패턴이라 WARNING으로 표시했다(이미 project 자체 consistency-checker 가 동일하게 지적한 사안이며 반영 권장). 그 외 Rationale 앵커 명명 규약 부재, Overview 테이블 셀 과밀, 리뷰 산출물 문단 밀도는 모두 비차단 INFO 수준이다. 전반적으로 문서 구조·링크 위생·스타일 일관성은 기존 관례를 잘 따르고 있어 구조적 결함은 없다.

## 위험도

LOW
