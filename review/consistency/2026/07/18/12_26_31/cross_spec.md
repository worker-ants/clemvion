# Cross-Spec 일관성 검토 — spec-draft-ai-nodes-drift-disposition

## 발견사항

- **[WARNING]** Item 4 앵커 rename 이 놓친 2개 dangling 링크 (plan 문서)
  - target 위치: Edit 4a (`0-common.md:81` 헤더 rename) + Edit 4d~4m (mechanical 앵커 갱신 목록)
  - 충돌 대상: `plan/in-progress/node-output-redesign/ai-agent.md:198`, `plan/in-progress/node-output-redesign/information-extractor.md:190`
  - 상세: `grep -rln '응답-형식-규약-principle-11'` 전수 조사 결과 앵커 참조 파일은 **6개**(spec 4개 + plan 2개)다. target 의 Edit 4d~4m 목록(`0-common:144·2-text-classifier:132,385·3-information-extractor:15,183,266,597,721·1-ai-agent:461,979` = 10개 링크, 4개 spec 파일)은 spec 내부 링크만 갱신하고 위 두 plan 문서의 동일 앵커 링크는 갱신 대상에서 누락됐다. `spec-link-integrity` 빌드 가드는 "spec→plan" 방향만 검사하고 "plan→spec" 역방향(plan 문서 내부 링크가 spec 앵커를 가리키는 경우)은 검사하지 않는다(가드 주석: "What plan-coherence-checker owns is link hygiene *inside* `plan/**` docs") — 즉 이 두 dangling 링크는 CI 로 잡히지 않고 조용히 깨진 채 남는다. 또한 target 의 Rationale 이 명시한 검증 기준 "적용 후 `grep -c '응답-형식-규약-principle-11'` == 0" 은 검색 스코프를 `spec/` 로 한정하지 않으면 이 2건 때문에 실패한다.
  - 제안: Edit 4d~4m 목록에 `plan/in-progress/node-output-redesign/ai-agent.md:198` · `plan/in-progress/node-output-redesign/information-extractor.md:190` 를 추가하거나(같은 세션에서 project-planner 가 plan 파일도 write 가능하므로 무리 없음), 최소한 target 의 Rationale 검증 커맨드에 `spec/` 스코프 한정을 명시.

- **[WARNING]** Item 1 이 해소하는 drift 를 이미 추적 중인 durable plan 이 stale 화됨 (frontmatter 미동기화)
  - target 위치: Item 1 (Edit 1a/1b/1c) — `1-ai-agent.md` 자체의 frontmatter 는 수정 목록에 없음
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans: [..., plan/in-progress/spec-drift-ai-agent-outport-countmax.md]` (기존, 무편집) ↔ `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`의 "Critical 1 — Multi Turn `out` 포트 유무가 요구사항 vs 기술 spec 정반대" (체크박스 `[ ]` 미해결)
  - 상세: `spec-drift-ai-agent-outport-countmax.md` 는 정확히 이 draft 의 Item 1 과 동일한 모순(ND-AG-24 "하위 호환" vs §3.2 dangling)을 Critical 1 로 추적하고 있고, `1-ai-agent.md` frontmatter 는 이 plan 을 자신의 `pending_plans` 로 이미 가리키고 있다(§spec-impl-evidence R-5: "spec 이 자기를 책임지는 plan 을 가리킴"의 실제 사례). target 이 Item 1 을 적용해 두 `_product-overview.md` 를 정정하면 Critical 1 은 사실상 해소되지만, target 의 Edit 목록 어디에도 (a) 그 plan 파일의 Critical 1 체크박스 정리, (b) (Critical 2 도 이미 전부 `[x]` 이므로) 전체 plan 을 `plan/complete/` 로 이동, (c) `1-ai-agent.md` frontmatter `pending_plans` 에서 이 항목 제거— 가 없다. 그 결과 spec 이 스스로 가리키는 pending_plans 항목이 "이미 해결된 항목을 미해결로 잘못 가리키는" 상태로 남는다.
  - 제안: Item 1 완료 시 project-planner 가 `spec-drift-ai-agent-outport-countmax.md` 의 Critical 1 체크·plan 종결(complete 이동) + `1-ai-agent.md` frontmatter `pending_plans` 갱신을 동일 세션에서 동반 처리(plan_coherence 관점과 중복될 수 있으나 spec frontmatter 자체가 대상이므로 cross-spec 관점에서도 유효).

- **[INFO]** Edit 4b 의 Principle 4.4/4.5 인용 granularity
  - target 위치: Edit 4b — `0-common.md:83` "(CONVENTIONS Principle 1.1/3.2/4.4/8.2 — result 네이밍·error·interaction·category 분담)"
  - 충돌 대상: `spec/conventions/node-output.md` §4.4 "Resumed 상태의 `output` 내용"(포괄적 resumed envelope) vs §4.5 "`interaction.data` payload 규격"(interaction 필드의 구체 shape). 같은 절(0-common.md §5) 의 바로 아래 표 행(`0-common.md:91`, 무편집 유지)은 이미 `output.interaction.{type, data, receivedAt}` 을 **Principle 4.5** 로 정확히 인용하고 있다.
  - 상세: Edit 4b 는 "interaction" 을 4.4 하나로 뭉뚱그려 인용한다. 4.4 가 `interaction` 필드의 **존재**(resumed envelope 에 `interaction` 키가 추가된다는 사실)를 정의하는 것은 맞지만, `data` shape 세부 규격은 4.5 SoT 다. 표 행이 이미 4.5 를 정확히 쓰고 있는 상태에서 body 문장만 4.4 로 축약 인용하면, 같은 절 안에서 "interaction → 4.4" (본문) vs "interaction → 4.5" (표) 두 인용이 공존해 — 정확히 이 항목(4)이 고치려는 "오귀속" 패턴을 약한 형태로 재도입할 소지가 있다.
  - 제안: Edit 4b 문구를 "4.4/4.5" 로 병기하거나, 표 행과 정합하도록 4.5 로 맞춘다.

## 요약

target 문서가 인용하는 코드 SoT(`resolve-dynamic-ports.ts` L121-133, `ai-turn-executor.ts` L3420-3434)와 spec 본문(§3.2), 그리고 앵커 개수(4파일 10링크)·Principle 3.2/3.3/4.4/4.5 정의는 실제 리포지토리 상태와 정확히 일치했고, IE 의 `status: partial` + `pending_plans` 전환도 `spec-impl-evidence.md` 컨벤션(§2.1, R-5)과 ai-agent 의 기존 선례에 부합해 신규 모순을 만들지 않는다. ND-AG-24 의 "하위 호환" 문구가 최초 커밋부터 존재했다는 git 이력도 "번복이 아니라 미실현 잔재" 라는 target 의 rationale 을 뒷받침한다. 다만 target 은 자신이 해소하는 drift 를 이미 추적 중이던 durable plan(`spec-drift-ai-agent-outport-countmax.md`, `1-ai-agent.md` frontmatter `pending_plans` 로 상호 참조됨)의 동기화를 누락했고, Item 4 의 앵커 rename 범위 산정에서 `plan/in-progress/node-output-redesign/{ai-agent,information-extractor}.md` 2개 문서의 동일 앵커 링크를 빠뜨려 rename 후 CI 로 잡히지 않는 dangling 링크가 남는다. 둘 다 target 의 핵심 처분 로직 자체를 무효화하지는 않는 WARNING 수준이며, 병행 반영을 권고한다.

## 위험도

MEDIUM
