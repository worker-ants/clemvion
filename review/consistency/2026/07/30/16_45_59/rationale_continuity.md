# Rationale 연속성 검토 — workflow-duplicate-nodes-edges

## 검증 방법

target(`plan/in-progress/workflow-duplicate-nodes-edges.md`)이 인용하는 과거 결정·근거를 프롬프트에 포함된 발췌뿐 아니라, 컨텍스트 예산으로 생략된 `spec/data-flow/11-workflow.md`(target 이 직접 수정하는 파일 본인의 `## Rationale`)와 `spec/3-workflow-editor/3-execution.md`(target 이 인용하는 선례)를 리포지토리에서 직접 Read 하고, `git log`/`git show` 로 인용된 커밋(`db496a3c2`)의 실제 diff 를 대조해 검증했다.

## 발견사항

- **[INFO]** §1.4 "Rationale 추가" 체크리스트 항목이 "기각한 대안" 이관을 명시하지 않음
  - target 위치: `plan/in-progress/workflow-duplicate-nodes-edges.md` §1.4 (line 109-111) 및 체크리스트 (line 126 `spec 3곳 반영 (§1.1 / §1.2 / §1.3) + Rationale (§1.4)`)
  - 과거 결정 출처: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조" 표 — `## Rationale` = "결정 배경·근거·**폐기된 대안**" (spec 문서가 폐기된 대안의 SoT). `CLAUDE.md` "정보 저장 위치" 표도 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 로 동일 규정.
  - 상세: target 문서 자체의 하단 `## Rationale` (line 137-171) 은 이미 매우 충실하다 — "왜 spec 을 코드에 맞추지 않는가"(3개 counter-reference 로 근거 제시, 아래 검증 완료), "왜 export/import 를 재사용하지 않는가", "왜 버전 이력을 승계하지 않는가", 그리고 `### 기각한 대안` 2건(Manual Trigger 자동생성 기각·spec 하향 기각)까지 갖춘다. 그런데 §1.4 의 실행 지시문은 "duplicate 는 왜 export/import 와 별 경로인가 / 버전 이력을 왜 승계하지 않는가 를 명문화" 두 항목만 명시적으로 언급하고, 이미 작성된 `### 기각한 대안` 절은 이관 대상으로 이름이 불려있지 않다. 본 plan 문서는 완료 후 `plan/complete/` 로 이동해 더 이상 1차 SoT 가 아니게 되므로 ("정보 저장 위치" 규약), "기각한 대안"이 spec 의 `## Rationale` 로 전량 이관되지 않으면 향후 "왜 duplicate 에 Manual Trigger 자동 생성을 안 넣었나"라는 재질문에 답할 근거가 spec 에서 사라질 위험이 있다 (plan 재조회에 의존).
  - 제안: §1.4 문구를 "본 문서 하단 `## Rationale` 전체(별 경로 근거·버전 이력 비승계 근거·`기각한 대안` 2건 포함)를 `spec/data-flow/11-workflow.md` 의 `## Rationale` 에 이관"으로 구체화해 누락 위험을 없앨 것.

- **[INFO]** `execution.md:753` 인용은 "소유권 패턴" 선례이지 "노드/엣지 내용 복사" 선례가 아님
  - target 위치: target 문서 `## Rationale` > "왜 spec 을 코드에 맞추지 않고 코드를 고치는가" 문단 (line 145-147)
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md:753` — "타 구성원은 clone 으로 수정: … 원본은 소유자만 변경 — 출처 명확성 + 충돌 회피. (workflows 의 duplicate 선례와 동일한 '복제 후 자기 소유' 패턴.)"
  - 상세: 인용 문구 자체는 실측 확인 결과 정확하다(허구 아님). 다만 원문이 실제로 참조하는 것은 "복제 후 자기 소유"라는 **권한/소유권 전환 패턴**이며, "duplicate 가 노드/엣지 내용을 복사한다"는 사실을 직접 진술하지는 않는다. target 이 이를 "duplicate 를 정상 동작하는 선례로 인용한다"고 서술한 것은 과장까지는 아니나(다른 기능이 duplicate 를 신뢰할 수 있는 clone 패턴으로 전제하고 있다는 정황 증거로는 유효), 세 가지 counter-reference 중 가장 간접적인 근거다. 나머지 두 근거 — `NAV-WF-04`("워크플로우 생성/복제/삭제 기능", 필수, ✅) 와 `spec/2-navigation/1-workflow-list.md:104`("워크플로우 복사본 생성") — 는 직접적이고 실측으로 확인됨.
  - 제안: 근거 서술에서 이 인용의 역할을 "소유권 패턴 선례"로 한정해 정밀화하거나, 주 근거(NAV-WF-04 + workflow-list.md §2.6)와 보조 정황을 구분 표기.

CRITICAL/WARNING 레벨 발견 없음. 아래는 검증 과정에서 확인된 근거(발견사항 아님, 참고용 확인 결과):

- `spec/data-flow/11-workflow.md:137` "nodes/edges 는 복제하지 않는다" 는 `git show db496a3c2` 로 대조한 결과 실제로 **신규 추가(`+`) 라인**이며, 해당 커밋은 "spec↔code 전수 상호 감사 — 역방향 커버리지 + drift 동기화 + data-flow 재구성" 이다. 이 문구를 도입하기 전/후 어느 시점에도 `spec/data-flow/11-workflow.md` 자체의 `## Rationale` 절(현재 3개 항목: 노드 배치 mutual exclusion / 버전 스냅샷 JSONB / Assistant usage JSONB)에 "메타만 복제"를 정당화하는 trade-off 서술은 존재한 적이 없다(`git log --all -p` 로 삭제 이력도 확인, 없음). 즉 target 이 뒤집으려는 대상은 **trade-off 가 기록된 채택 결정이 아니라 감사 시점 drift 동기화 문구**라는 target 의 주장은 사실과 일치한다. 따라서 이번 정정은 criterion 3("결정의 무근거 번복")에 해당하지 않는다 — 오히려 새 Rationale(§1.4)을 명시적으로 작성해 정공법을 취하고 있다.
- target 의 `### 기각한 대안` 중 "복제본에도 Manual Trigger 자동 생성" 기각은 같은 파일 §1.1 의 기존 불변식("Manual Trigger 정확히 1개, 누락/중복 시 400")과 정확히 부합한다 — 실제 불변식을 근거로 대안을 기각한 것으로, criterion 2("합의된 원칙 위반") 에 해당하지 않는다.
- target 구현 계획(§2)이 `importWorkflow()` 의 UUID 재매핑 알고리즘은 재사용하되 label 중복 409·reserved-name 게이트·기본 LLM 주입·`applyConfigDefaults` 는 재사용하지 않기로 한 것은, 코드에 이미 존재하는 신뢰 경계 원칙과 정확히 일치한다 — `workflows.service.ts` 의 `saveCanvas(skipLegacyDataGates)` 및 `importWorkflow()` 코드 주석("Imported JSON is new data, never a historical snapshot of this workspace — the legacy-data escape that `restoreVersion` gets does not apply")이 "이 워크스페이스 내부의 이미 검증된 과거 데이터"(restoreVersion)와 "외부에서 들어오는 신규/미신뢰 데이터"(import)를 구분해 전자만 게이트를 건너뛰는 선례를 이미 코드 수준에 두고 있다. duplicate 가 복제하는 원본은 restoreVersion 의 과거 스냅샷보다도 더 강하게 "현재 이미 모든 활성 게이트를 통과한 이 워크스페이스의 데이터"이므로, target 의 게이트 생략 설계는 이 기존 원칙의 정합적 연장이며 위반이 아니다(criterion 4 미해당). 다만 이 코드 수준 선례를 target 의 새 Rationale 문구가 명시적으로 인용하지는 않는다 — INFO 수준 보강 여지는 있으나 별도 발견사항으로 등재할 정도의 리스크는 아니라고 판단해 본문 발견사항에서 제외했다.
- `spec/2-navigation/1-workflow-list.md` 의 기존 `## Rationale` 4개 항목(공유 워크플로우 정의·Import permissive config·폴더 계층 무결성·태그 필터 하향) 중 target 의 변경과 상충하는 항목 없음.
- `plan/complete/workflow-cap-validated-dto.md` 의 "import/duplicate 는 별도 DTO(범위 밖)" 결정은 `settings.maxConcurrentExecutions` strict 검증에 관한 것으로, target 의 "settings 승계"(원본의 이미 검증된 값을 그대로 복사, 신규 미검증 입력 없음)와 상충하지 않는다.

## 요약

target 은 자신이 뒤집으려는 spec 문구(`spec/data-flow/11-workflow.md:137` "nodes/edges 는 복제하지 않는다")의 출처를 `db496a3c2` drift-sync 커밋으로 정확히 지목했고, 이는 실측(git show)으로 확인된다 — 즉 되돌리는 대상이 trade-off 가 기록된 합의 결정이 아니라 감사 시점 부작용이라는 target 의 핵심 전제가 참이다. `## Rationale` 자체에 "기각한 대안"(Manual Trigger 자동생성 재도입 검토·spec 하향 검토)을 실제 불변식(§1.1 "정확히 1개") 에 근거해 명시적으로 기록했고, export/import 게이트를 재사용하지 않는 설계는 코드에 이미 존재하는 "신뢰 경계"(legacy-data escape) 원칙과 정합적으로 이어진다. NAV-WF-04·workflow-list.md·execution.md 세 counter-reference 도 모두 실측 확인 결과 사실과 일치해 허구의 이력 인용은 없었다. 발견된 두 건은 모두 INFO — plan 문서의 "기각한 대안"이 실제 spec Rationale 로 전량 이관되도록 체크리스트 문구를 구체화할 것, execution.md 인용의 역할(소유권 패턴 vs 콘텐츠 복사)을 더 정밀하게 표기할 것 — 이며 실질적 충돌·무근거 번복·invariant 위반은 발견되지 않았다.

## 위험도

LOW
