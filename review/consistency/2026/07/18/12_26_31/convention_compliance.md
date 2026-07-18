# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-ai-nodes-drift-disposition.md`

## 검토 방법

target draft 가 인용/전제하는 코드·spec 실제 상태를 직접 대조 검증했다:
- `spec/conventions/node-output.md` (Principle 0~11, Principle 참조 매트릭스)
- `spec/conventions/spec-impl-evidence.md` (frontmatter 스키마·status lifecycle·pending_plans 의무)
- `spec/conventions/interaction-type-registry.md` (§4 endReason SoT)
- `codebase/packages/ai-end-reason/src/index.ts` (`AiAgentEndReason` 실제 union)
- `spec/4-nodes/3-ai/{0-common,1-ai-agent,2-text-classifier,3-information-extractor}.md`, `_product-overview.md`, 루트 `4-nodes/_product-overview.md` 의 인용 라인 원문
- `.claude/skills/project-planner/SKILL.md`, `.claude/docs/plan-lifecycle.md`
- 기존 `plan/complete/spec-draft-*.md` 전례 (`spec-draft-spec-drift-resolve.md`, `spec-draft-webchat-execution-residuals.md` 등)

## 발견사항

- **[INFO]** 항목 4 Edit 4b 의 Principle 세분번호 귀속 정밀도
  - target 위치: `## 항목 4` Edit 4b (`0-common.md:83` 개정문)
  - 위반 규약: `spec/conventions/node-output.md` Principle 1.1 vs 8.2 의 책임 경계
  - 상세: 개정문은 `(CONVENTIONS Principle 1.1/3.2/4.4/8.2 — result 네이밍·error·interaction·category 분담)` 로 4개 세부 Principle 에 4개 개념을 1:1 매핑한다. 그러나 node-output.md 본문상 `output.result.*` **네이밍 자체**(1차 wrapper 명칭)는 §8.2 "통일된 1차 네이밍" 표·"규칙: `output.result` 래핑은 LLM 계열 노드 한정" 문단이 정의하며, §1.1 은 "config/output 직교"(무엇이 `output` 에 속하는가)를 정의할 뿐 `result` 라는 sub-key 명칭 자체를 지정하지 않는다. 즉 "result 네이밍" 을 1.1 에 단독 귀속시키는 것은 §1.1(왜 output 에 있는가)과 §8.2(그 안에서 어떻게 명명하는가)의 책임 경계를 다소 흐린다. Rationale 절(§113행)의 서술 "1.1(config↔output 직교/result 네이밍)"도 동일 뉘앙스로, 두 개념을 한 항목에 묶고 있다.
  - 제안: 실제 spec 반영 전에 "result 네이밍은 §8.2 소관, §1.1 은 config/output 직교 근거"로 인용을 분리하거나(`Principle 1.1(config/output 직교)·3.2(error)·4.4(interaction)·8.2(result/category 1차 네이밍)`), 현재 표현이 의도된 요약이라면 그대로 유지해도 CRITICAL 은 아님 — spec 반영 직전 정밀 재확인만 권고.

- **[INFO]** 초안 자체의 `## Overview` 절 부재는 규약 위반 아님(참고 기록)
  - target 위치: draft 전체 구조
  - 관련 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale)" / `project-planner/SKILL.md §Spec 문서 구조`
  - 상세: 3섹션 권장은 `spec/**` 에 반영되는 **최종 spec 문서**에 적용되는 규약이며, `plan/in-progress/spec-draft-<name>.md` 자체는 SKILL.md 워크플로 3단계가 요구하는 "본문 끝에 `## Rationale`" 만 의무다. target 은 이를 충족(`## Rationale` 로 종료, 결정 근거·기각 대안 포함)하므로 위반이 아니다. 편입 대상인 실제 spec 파일들(`1-ai-agent.md` 등)은 이미 자체 Overview(`_product-overview.md` 분리)/본문/`## 12. Rationale` 3섹션 구조를 보유하고 있고, Edit 1c 가 그 기존 `### 12.N` 넘버링 관례(현재 `12.16` 까지 존재)를 그대로 이어(`12.17`) 편입한다 — 구조 정합.
  - 제안: 조치 불필요. (기록 목적 INFO)

## 정합성 확인 — 위반 없음을 확인한 항목 (긍정 근거, 발견사항 아님)

- **포트 명명**: 항목 1 이 전제하는 `out`/`user_ended`/`max_turns`/`error` 는 모두 node-output.md §Principle 6 "시스템 포트 예약어" 목록과 정확히 일치. `AiAgentEndReason` 코드 union(`codebase/packages/ai-end-reason/src/index.ts`)도 `'user_ended' | 'max_turns' | 'condition' | 'error'` 로 `out` 부재를 명시적 doc-comment 로 확정("단일턴 종결('out')은 포함하지 않는다") — 항목 1 의 코드 SoT 주장과 정확히 부합.
- **frontmatter 스키마 (item 3)**: IE 의 `status: implemented → partial` + `pending_plans:` 신설은 `spec-impl-evidence.md §3` lifecycle 표(`partial` 는 `pending_plans` 의무)와 정확히 합치. 대상 경로 `plan/in-progress/node-output-redesign/information-extractor.md` 실존 확인(가드 `spec-pending-plan-existence.test.ts` 통과 가능). ai-agent.md 는 이미 `status: partial` + 별도 2개 `pending_plans` 보유 확인(다만 `node-output-redesign/ai-agent.md` 는 Edit 2a 로 신규 추가되는 것이며 기존엔 누락 — draft 가 이 프레임워크 갭까지 함께 closes).
- **anchor 정합 (item 4)**: `#5-응답-형식-규약-principle-11` 앵커의 실사용처를 grep 으로 전수 대조한 결과 정확히 **4개 파일 10개**(0-common:144, 1-ai-agent:461/979, 2-text-classifier:132/385, 3-information-extractor:15/183/266/597/721) — target 의 "Edit 4d~4m" 목록과 라인 번호까지 100% 일치. spec-link-integrity 가드(`spec-impl-evidence.md §4.2`) 관점에서 헤더-앵커 동시 갱신 계획이 정확.
- **Principle 11 용법 (item 4)**: `2-text-classifier.md:130`·`3-information-extractor.md:181` 의 "Principle 11 포맷" 인용은 실제로 node-output.md §Principle 11(출력 예시 문서화 규칙 — `undefined` 필드 생략 등)과 일치하는 **올바른 용법**이라는 target 의 판단이 원문 대조로 확인됨(무변경 방침 타당).
- **인용 원문 대조**: Edit 1a/1b 가 명시한 "전" 텍스트(`_product-overview.md:215`, `3-ai/_product-overview.md:84`)가 실제 파일 라인과 글자 단위로 일치.
- **파일 명명**: `plan/in-progress/spec-draft-ai-nodes-drift-disposition.md` 는 `project-planner/SKILL.md` 의 `spec-draft-<name>.md` 명명 패턴과 `worktree`/`started`/`owner` frontmatter 스키마(`plan-lifecycle.md §4`)에 부합. `spec_impact` 를 in-progress 단계에 미리 선언한 것은 기존 전례(`spec-draft-webchat-execution-residuals.md` 등)와 동일한 관행으로 위반 아님(Gate C 는 `complete/` 이동 시점에만 강제).
- **API 문서 규약**: 본 draft 는 OpenAPI/Swagger 데코레이터·DTO 를 다루지 않아 해당 관점은 미적용(N/A).
- **금지 항목**: `output.output.*` 이중중첩, `output.view` 판별자, config spread echo 등 node-output.md 가 명시적으로 금지한 패턴을 새로 도입하는 내용 없음.

## 요약

target 초안은 `spec/conventions/node-output.md`(포트 예약어·Principle 세분 번호·에러/interaction 컨트랙트)·`spec-impl-evidence.md`(frontmatter status/pending_plans 라이프사이클)·`interaction-type-registry.md`(endReason 패키지 SoT)·spec-link-integrity 앵커 무결성 요구를 모두 정확히 전제하고 있으며, 인용된 라인 번호·grep 카운트·코드 union 타입까지 실제 저장소 상태와 전수 일치했다. 유일하게 짚을 만한 지점은 항목 4 Edit 4b 의 Principle 1.1/8.2 책임 경계 서술이 다소 뭉뚱그려져 있다는 정밀도 이슈(INFO)뿐이며, 이는 실제 spec 반영 직전 재확인을 권고하는 수준으로 BLOCK 사유가 아니다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

LOW
