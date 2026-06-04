# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md) + `spec/conventions/cafe24-api-catalog/application.md` 및 하위 entity 파일
검토 모드: --impl-done, scope=spec/4-nodes/3-ai/, diff-base=origin/main

---

## 발견사항

### [WARNING] cafe24-api-catalog entity 파일명 — snake_case 규약 불일치

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/` 하위 파일 (appstore-orders.md, appstore-payments.md, databridge-logs.md, webhooks-logs.md, webhooks-setting.md)
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` — "`<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (snake_case). 한 resource 내 unique."
- **상세**: `_overview.md §7.1` 은 entity 파일명과 frontmatter `entity:` 값이 snake_case 여야 한다고 명시하지만, 실제 파일명은 kebab-case 를 사용한다 (`appstore-orders.md`, `appstore-payments.md`, `databridge-logs.md`, `webhooks-logs.md`, `webhooks-setting.md`). frontmatter `entity:` 값도 동일하게 kebab-case 로 선언되어 있다 (`entity: appstore-orders` 등). 예시로 제시된 `store/activitylogs.md`, `product/products.md` 는 kebab 없는 단어이나, 실제 적용된 다단어 식별자에서는 규약과 어긋난다. `store/` 하위 파일에서도 `automessages-arguments.md`, `automessages-setting.md` 같은 kebab-case 파일이 존재한다. 파일 생성기 (`_generator.py`) 가 Cafe24 docs HTML 의 anchor 를 파싱하면서 kebab-case 를 그대로 채택한 것으로 보인다.
- **제안**: 실제 생성기 산출물이 kebab-case 를 기준으로 일관되게 동작하고 있으므로, (a) `_overview.md §7.1` 을 "(snake_case 또는 kebab-case, Cafe24 docs anchor 기반)" 으로 갱신하거나 (b) 기존 파일을 전수 snake_case 로 rename 하거나 선택이 필요하다. 생성기 산출물의 일관성과 catalog-sync 테스트 영향을 감안할 때 **규약 갱신이 더 현실적**이다. 단, `_overview.md §7.1` 예시 (`store/activitylogs.md`) 는 이미 snake_case 이므로 혼재 상태가 유지되고 있다. 이 불일치를 명문화하거나 생성기 변환 규칙을 통일하는 방향이 권장된다.

---

### [WARNING] information-extractor.md — config echo 필드명 미일치 (W-1, Principle 7)

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §5.1 출력 구조, §5.4 waiting 출력, expression 접근 예 전반 (~15곳)
- **위반 규약**: `spec/conventions/node-output.md` Principle 7 — "config echo 는 사용자가 설정한 원본 값을 그대로 echo. 핸들러가 `context.rawConfig` 를 echo"하므로 원본 config 필드명 `outputSchema` 로 접근해야 한다.
- **상세**: 핸들러가 config echo 를 `config.schema` 로 노출하지만 원본 config 필드명은 `outputSchema` 이다. 다운스트림이 `$node["X"].config.schema` 로 접근하면 실제 raw config 키인 `$node["X"].config.outputSchema` 와 다른 이름을 참조하게 되어 invariant 가 깨진다. 이 결함은 spec 본문 §8 Rationale 의 "알려진 결함 — 이연 (W-1)" 으로 문서화되어 있으나, 규약 위반임은 명시되어 있지 않다.
- **제안**: spec 문서 W-1 표기에 "CONVENTIONS Principle 7 위반" 을 명시하고, 후속 plan 에서 핸들러의 `config.outputSchema` 키 rename 과 spec 문서 전체 ~15곳의 `config.schema` → `config.outputSchema` 갱신을 함께 처리한다. `spec-fix-impl-marker-flips.md` 에 이 항목을 추가하거나 별도 plan 으로 추적한다.

---

### [WARNING] text-classifier.md / information-extractor.md — "🚧 미구현" marker 와 status:partial 가 구현 완료 이후에도 유지 중

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §3.2, §5.3, §7 / `spec/4-nodes/3-ai/3-information-extractor.md` §5.3 (retryable/retryAfterSec)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3.1` 전이 규칙 — "`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)"
- **상세**: `plan/in-progress/spec-sync-text-classifier-gaps.md` 및 `spec-sync-information-extractor-gaps.md` 양 파일의 "구현 상태" 섹션에 "코드 구현 완료 — commit 0d65f322" 로 기록되어 있다. 즉 구현은 완료됐으나 spec 의 "🚧 미구현 (Planned)" 마커와 `status: partial` 가 아직 갱신되지 않았다. `plan/in-progress/spec-fix-impl-marker-flips.md` 가 이 후속 작업을 추적 중이다.
- **제안**: 이 상태는 의도된 이연(tracked)이지만, `spec-impl-evidence.md §3.1` 가드는 pending_plans 가 모두 complete 로 이동했을 때 `implemented` 승격을 강제한다. `spec-fix-impl-marker-flips.md` 와 연계한 빠른 후속 처리가 필요하다. 현재 상태에서 build-time 가드 `spec-status-lifecycle.test.ts` 의 "(c) partial 의 pending_plans 모두 complete 인데 status 미승격" 조건이 아직 미충족(pending_plans 가 in-progress 에 실존)이므로 즉각 build fail 은 없으나, 마커 flip 없이 plan 을 complete 로 이동하면 가드가 발화한다.

---

### [INFO] 0-common.md — `status: partial` 이나 `pending_plans` 의 스코프가 AI Agent spec 에도 중복 등재

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` frontmatter: `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` / `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter: `pending_plans: [..., plan/in-progress/ai-context-memory-followup-v2.md]`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans` 는 "미구현 surface 를 책임지는 plan 경로"
- **상세**: 동일한 plan 파일 (`ai-context-memory-followup-v2.md`) 이 `0-common.md` 와 `1-ai-agent.md` 양쪽의 `pending_plans` 에 동시에 등재되어 있다. 중복 등재 자체가 가드에서 차단되는 규약은 없으나, plan 이 complete 로 이동되면 양쪽 spec 을 모두 갱신해야 한다는 점에서 누락 위험이 있다. 이는 스펙 자체가 공통 규약을 담는 `0-common.md` 와 구현 노드 `1-ai-agent.md` 가 같은 plan 에 의존하는 구조에서 자연스럽게 발생한다.
- **제안**: 중복 등재는 허용 범위이나, plan 완료 시 연관 spec 을 함께 갱신하는 체크리스트를 해당 plan 파일에 명기해 두는 것이 권장된다. 이미 `ai-context-memory-followup-v2.md` 에 관련 스펙 파일 목록이 포함되어 있는지 확인하고 없으면 추가한다.

---

### [INFO] text-classifier.md / information-extractor.md — contextScope/memoryStrategy 설정 필드 §1 config 표에 미기재

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md §1` config 표, `spec/4-nodes/3-ai/3-information-extractor.md §1` config 표
- **위반 규약**: 규약 위반 아님 — `spec/4-nodes/3-ai/0-common.md §10` 에서 "자동 주입(`contextScope` / `memoryStrategy` inject) 만 두 노드에 v2 예정" 으로 명시
- **상세**: `0-common.md §10` 이 "AI 카테고리 3 노드 공통 규약" 이라고 표제하지만, text_classifier / information_extractor 는 contextScope/memoryStrategy inject 가 v2 예정이라 두 노드의 §1 config 표에 해당 필드가 없다. 이는 규약 위반이 아니라 의도된 v2 이연이나, `0-common.md §10` 표제가 "3 노드 공통"임에도 실제 적용 범위는 ai_agent 한정이어서 독자가 혼동할 수 있다.
- **제안**: `0-common.md §10` 표제 또는 서두에 "현재 inject 는 ai_agent 한정 (text_classifier / information_extractor 는 v2)" 을 더욱 명확히 강조하거나, 표 내 `memoryStrategy` 행의 "AI Agent 한정 (text_classifier/information_extractor 는 v2)" 비고를 더 눈에 띄게 표시한다.

---

### [INFO] cafe24-api-catalog/application.md — 상위 index 파일에 Overview / Rationale 섹션 부재

- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md`
- **위반 규약**: `CLAUDE.md` / `.claude/skills/project-planner/SKILL.md §Spec 문서 구조` — "3섹션 권장 (Overview / 본문 / Rationale)"
- **상세**: `application.md` 는 `## 표` 와 `## Field-level 상세 카탈로그` 두 섹션만 있으며 Overview 와 Rationale 섹션이 없다. 단, 이 파일은 API 카탈로그 index 파일로 `_overview.md` 가 영역 Overview 를 담당하고 있고, 개별 resource 파일의 Rationale 필요성은 낮다. "권장" 수준이므로 CRITICAL/WARNING 에 해당하지는 않는다.
- **제안**: 카탈로그 resource 파일은 `_overview.md` 에 대한 위임으로 Overview 를 대체한다고 판단되므로 현행 유지가 합당하다. `_overview.md §2` 에 "각 resource 파일은 `_overview.md` 위임으로 Overview 생략 가능" 을 한 줄 추가하면 규약과 구조를 명확히 정렬할 수 있다.

---

## 요약

전반적으로 `spec/4-nodes/3-ai/` 문서는 정식 규약(`spec/conventions/`)을 충실히 따르고 있다. Frontmatter `id`/`status`/`code`/`pending_plans` 는 `spec-impl-evidence.md` 규약을 준수하며, 출력 포맷은 `node-output.md` Principle 0~11 을 따른다. 에러 구조는 Principle 3.2 표준 형태를 사용하고, 블로킹/재개 컨트랙트는 Principle 4 를 준수한다. 주요 지적 사항은 두 가지다: (1) `cafe24-api-catalog` entity 파일명이 convention 에 명시된 snake_case 가 아닌 kebab-case 로 생성되어 `_overview.md §7.1` 과 불일치하는 WARNING 수준 명명 규약 위반, (2) `information-extractor.md` 의 `config.schema` echo 키가 원본 config 필드명 `outputSchema` 와 달라 Principle 7 (config echo 원칙) 을 위반하는 WARNING 수준 출력 포맷 위반. 두 항목 모두 이미 추적 중이지만 정식 규약 직접 위반임을 명시할 필요가 있다.

## 위험도

MEDIUM
