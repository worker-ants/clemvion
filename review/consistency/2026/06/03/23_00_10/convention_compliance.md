# 정식 규약 준수 검토 결과

**검토 범위**: `spec/4-nodes/3-ai/` (diff-base: origin/main)
**검토 모드**: 구현 완료 후 검토 (--impl-done)
**검토 일시**: 2026-06-03

---

## 발견사항

### [WARNING] Config echo 열거 목록에 신규 memory 필드 누락
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7 도입부 Config echo 정책 단락 (대략 라인 427)
- **위반 규약**: `spec/conventions/node-output.md` Principle 7 — "항상 echo" 대상 필드 열거 + 구현 시 명시 enumeration 의무화(D1)
- **상세**: Config echo 정책 단락은 후속 노드가 접근하는 config 경로를 다음과 같이 나열한다:
  ```
  $node["X"].config.{mode, model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat, includeSystemContext?, systemContextSections?}
  ```
  이번 diff 에서 추가된 `memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold` 5개 신규 사용자 config 필드가 이 열거에 포함되지 않았다. `memoryKey` 는 Expression(`{{ }}`) 을 허용하는 raw 값이므로 Principle 7 상 echo 필수이며, 나머지 4개도 비민감 사용자 설정값이므로 echo 대상이다. 독자(다운스트림 노드 작성자, 구현 개발자)가 이 열거를 "complete enumeration" 으로 읽을 경우 memory 필드를 config echo 에서 누락하는 구현 오류로 이어질 수 있다.
- **제안**: Config echo 정책 단락의 열거를 다음과 같이 갱신한다:
  ```
  $node["X"].config.{mode, model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat, includeSystemContext?, systemContextSections?, memoryStrategy?, memoryTokenBudget?, memoryKey?, memoryTopK?, memoryThreshold?}
  ```
  `memoryStrategy` default(`manual`)와 일치할 때 echo 생략 정책을 추가한다면 `includeSystemContext?` / `systemContextSections?` 와 동일 패턴을 적용한다.

---

### [INFO] `text-classifier`·`information-extractor` 변경 본문에 Rationale 섹션 부재
- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` 전체, `spec/4-nodes/3-ai/3-information-extractor.md` 전체
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 **권장**"
- **상세**: 두 문서는 이번 diff 에서 `status: partial` 전환 + `pending_plans` 추가 + "미구현(Planned)" 표기로 상당한 변경이 있었다. 특히 `retryable` 미구현 사실 기술, 예약어 검증 미구현 표기 등 설계 결정 배경을 이해하는 데 Rationale 단락이 도움이 된다. `1-ai-agent.md`(§12 복수 Rationale 포함) 및 `0-common.md`(## Rationale 섹션 존재)와 비교해 두 파일만 배경 설명이 없어 형식 일관성이 낮다.
- **제안**: 두 파일에 `## Rationale` 섹션을 추가해, "미구현 surface 를 spec 에 명시적으로 기술한 이유" 및 "partial 전환 결정 배경"을 한 문단으로 기술한다. 규약이 "권장" 사항이므로 Critical 은 아니지만 대형 미구현 표기가 있는 문서에는 특히 권장된다.

---

### [INFO] `frontmatter id` 가 파일명과 불일치 (`0-common.md` → id: `common`)
- **target 위치**: `spec/4-nodes/3-ai/0-common.md` frontmatter 1번째 줄
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 — `id: string (kebab-case). 파일 basename(확장자 제외) 기반 **권장**`
- **상세**: 파일명은 `0-common.md`(basename: `0-common`) 이지만 frontmatter id 는 `common`. 이 불일치는 이번 diff 이전부터 존재하던 상태이며 이번 변경이 새로 도입한 문제는 아니다. 그러나 이번 diff 에서 `status: implemented → partial` 전환과 함께 frontmatter 를 수정하는 시점에서도 id 불일치를 그대로 두었으므로 함께 안내한다. `spec-frontmatter.test.ts` 가 id 의 kebab-case 유효성은 검증하지만 basename 일치는 강제하지 않으므로 빌드 실패로 이어지지 않는다. 단, 다른 spec 도구(검색, cross-reference 인덱스)가 basename 기반으로 id 를 매핑한다면 오매핑 위험이 있다.
- **제안**: `id: 0-common` 으로 통일하거나, 다른 같은 패턴(`1-ai-agent` → id `ai-agent` 등)이 더 많다면 "숫자 prefix 는 id 에서 생략" 을 팀 컨벤션으로 명시하고 spec-impl-evidence §2.1 에 추기한다. 이번 변경과 독립적으로 다음 frontmatter 수정 시 함께 처리 권장.

---

## 요약

`spec/4-nodes/3-ai/` 의 이번 변경(memoryStrategy·persistent memory 설계 추가, 미구현 표기 정비, status partial 전환)은 전반적으로 정식 규약을 잘 준수하고 있다. `spec-impl-evidence.md` frontmatter 계약(id/status/code/pending_plans)이 모두 올바르게 갱신됐고, `pending_plans` 경로 4개 모두 실존이 확인됐으며, `node-output.md` 의 UPPER_SNAKE_CASE 에러코드 규칙·Principle 0~4 출력 구조 컨트랙트도 충실히 따른다. 다만 신규 memory config 5개 필드가 §7 Config echo 열거에서 빠진 점은 구현 개발자가 echo 대상 필드를 확정할 때 혼란을 줄 수 있어 WARNING 으로 판단했다. 나머지 2건은 형식 권장 사항 수준의 INFO 이다.

## 위험도

LOW
