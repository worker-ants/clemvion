# 정식 규약 준수 검토 결과

검토 범위: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
검토 모드: --impl-done, diff-base=origin/main

---

## 발견사항

### 1. [INFO] `0-common.md` frontmatter `id` 필드가 basename 과 불일치
- target 위치: `/spec/4-nodes/3-ai/0-common.md` frontmatter `id: common`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "id: spec 식별자. 파일 basename(확장자 제외) 기반 권장"
- 상세: 파일 basename 은 `0-common` 이나 id 는 `common` 으로 `0-` prefix 가 없다. 권장("기반 권장")이라 빌드 가드 차단은 아니나 검색·색인 시 혼동 가능성이 있다.
- 제안: `id: 0-common` 으로 갱신. 단 동일 basename 중복 충돌이 없는 한 현행 유지도 허용 범위이므로 LOW 우선순위.

---

### 2. [INFO] `1-ai-agent.md` frontmatter `id` 필드가 basename 과 불일치
- target 위치: `/spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `id: ai-agent`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — basename 기반 권장
- 상세: 파일 basename 은 `1-ai-agent` 이나 id 는 `ai-agent` 로 숫자 prefix 가 없다. `0-common.md` 와 동일 패턴이며 프로젝트 관행으로 보이나 conventions 상 "basename 기반 권장"에서는 `1-ai-agent` 가 더 정확하다.
- 제안: 현행 관행이 일관적으로 숫자 prefix 를 생략하는 것이라면 규약 문서에 "숫자 prefix 제외 가능" 문구 추가로 명확화하는 편이 더 실용적이다.

---

### 3. [WARNING] `3-information-extractor.md` Rationale 섹션이 번호 붙은 절(§9) 안에 중첩됨 — 최상위 `## Rationale` 패턴 미준수
- target 위치: `/spec/4-nodes/3-ai/3-information-extractor.md` `## 9. Rationale` (line 700)
- 위반 규약: CLAUDE.md "문서 구조 규약" — "Overview / 본문 / Rationale 3섹션 권장". `spec/conventions/node-output.md` 및 `spec/4-nodes/3-ai/0-common.md` 는 최상위 `## Rationale` 로 끝나는 패턴을 사용한다.
- 상세: `0-common.md` 는 `## Rationale`, `1-ai-agent.md` 는 `## 12. Rationale` (번호 붙음), `2-text-classifier.md` 는 `## 8. Rationale` (번호 붙음), `3-information-extractor.md` 는 `## 9. Rationale` (번호 붙음). 번호 붙은 Rationale 패턴이 세 파일 모두에 일관되게 적용되므로 단순 불일치는 아니지만, CLAUDE.md 의 "3섹션 권장" 은 `## Rationale` 을 별도 최상위 섹션으로 암시한다. `0-common.md` 만 최상위 비번호 패턴이고 나머지 세 파일은 번호 붙은 절이다.
- 제안: 노드 spec 파일군의 관행이 번호 붙은 Rationale 절로 수렴했다면 허용 변형임을 CLAUDE.md 또는 conventions 에 명시적으로 기재하는 것을 권장. 지금 당장 수정 필요는 없으나 향후 신규 spec 작성 시 혼동 가능.

---

### 4. [INFO] `3-information-extractor.md` config echo 에서 원본 필드명 `outputSchema` 를 `schema` 로 echo 하는 알려진 결함이 spec 에 명시됨
- target 위치: `/spec/4-nodes/3-ai/3-information-extractor.md` §9.3 (line 721)
- 위반 규약: `spec/conventions/node-output.md Principle 7` — "config echo 는 원본 필드명 그대로"
- 상세: spec 본문 §9.3 의 "알려진 결함 W-1" 에 이미 명시: `config.schema` 로 노출하나 원본 필드명은 `outputSchema`. Principle 7 직접 위반이나 spec 이 이를 의식적으로 이연 처리로 기록한 상태.
- 제안: 현재 plan/in-progress 에 추적 아이템이 없다면 후속 정리 plan 을 등재 권장. spec 본문의 "이연(W-1)" 표기가 있으므로 당장 blocking 은 아님.

---

### 5. [INFO] `_product-overview.md` 는 frontmatter 적용 제외 대상임을 확인 — 이상 없음
- target 위치: `/spec/4-nodes/3-ai/_product-overview.md`
- 규약: `spec/conventions/spec-impl-evidence.md §1` 제외 목록 — `spec/<영역>/_*.md` (밑줄 prefix) 는 frontmatter 가드 면제
- 상세: `_product-overview.md` 는 밑줄 prefix 파일이므로 `id`/`status` frontmatter 의무가 없다. 현행 파일에 frontmatter 없음 — 정상.

---

### 6. [INFO] `2-text-classifier.md` 상태가 `implemented` 이나 공유 규약(`0-common.md`)은 `partial` — 논리적 불일치 없음
- target 위치: `/spec/4-nodes/3-ai/2-text-classifier.md` frontmatter `status: implemented`
- 규약: `spec/conventions/spec-impl-evidence.md §3` — 각 파일은 독립적 구현 상태 추적
- 상세: `text-classifier` 는 자체 구현이 완료(`implemented`)이고, 공통 규약 `0-common.md` 가 `partial` 인 것은 다른 공유 기능(메모리, System Context Prefix 등)의 미완으로 인한 것이다. 파일별 독립 추적이 명확하여 위반 아님.

---

### 7. [INFO] `1-ai-agent.md` 에서 deprecated Tool Area 내용이 스펙 본문에 남아 있으나 명시적 경고 추가됨
- target 위치: `/spec/4-nodes/3-ai/1-ai-agent.md` §4, §1 경고 블록 (line 377-382)
- 위반 규약: 해당 없음 (금지된 패턴 아님)
- 상세: "재작성 예정 (현재 제거됨)" 블록이 명시적 경고로 포함되어 있고 `toolNodeIds` / `toolOverrides` 필드도 "제거됨" 으로 표기됨. 규약 위반은 아니나 독자가 이 절을 active spec 으로 오인할 수 있는 표현이 일부 남아 있다(§4 본문이 deprecated 콘텐츠를 설명 조로 서술). 명확성 측면에서 ~~취소선~~ 처리나 `{: .archived}` 표기가 더 강한 신호가 될 수 있다.
- 제안: 변경 필수 아님. 현행 경고 블록이 이미 명시적이라 INFO 수준.

---

### 8. [INFO] `0-common.md` 에서 `CONVENTIONS §4.5` 참조가 특정 섹션 앵커 없이 약칭으로 사용됨
- target 위치: `/spec/4-nodes/3-ai/0-common.md` §4 본문 line 105: "(CONVENTIONS §4.5)"
- 위반 규약: `spec/conventions/spec-impl-evidence.md` 링크 무결성 가드 (`spec-link-integrity.test.ts`) 대상 — 외부 링크가 아닌 in-repo 링크는 실존 경로여야 함. 그러나 이 경우 단순 텍스트 약칭("CONVENTIONS §4.5")으로 링크 형식이 아님.
- 상세: 같은 문서 §5 에서 `([CONVENTIONS Principle 11](../../conventions/node-output.md#principle-11--출력-예시-문서화-규칙))` 형태로 완전한 링크를 제공하는 패턴과 일치하지 않는다. "(CONVENTIONS §4.5)" 는 텍스트 약칭이라 링크 가드 대상이 아니지만 독자가 찾기 어렵다.
- 제안: `[CONVENTIONS Principle 4.5](../../conventions/node-output.md#45-interactiondata-payload-규격)` 형식으로 실제 링크로 교체 권장.

---

### 9. [INFO] `1-ai-agent.md` 출력 구조 §7.1 에서 `meta.thinkingTokens: 0` 예시가 실제 LLM 응답에서 생략 가능한 optional 필드를 0으로 echo
- target 위치: `/spec/4-nodes/3-ai/1-ai-agent.md` §7.1 JSON 예시 (line 779): `"thinkingTokens": 0`
- 위반 규약: `spec/conventions/node-output.md Principle 11` — "`undefined` 필드는 JSON 예시에서 생략"
- 상세: `meta.thinkingTokens` 는 `0-common.md §6` 에서 선택(`선택`) 필드로 정의됨. Principle 11 은 "선택적 필드는 표에 `?` 표기"를 요구하고 JSON 예시에서는 `undefined` 필드를 생략해야 한다. `thinkingTokens: 0` 은 "모델이 thinking 토큰을 보고하는 경우만" 포함하는 필드이므로 0 값 예시 대신 JSON 에서 생략이 적절하다.
- 제안: JSON 예시에서 `"thinkingTokens": 0` 행을 제거하고 표의 해당 행에 `?` 표기를 유지하는 것이 Principle 11 과 정합한다.

---

## 요약

`spec/4-nodes/3-ai` 문서군은 전반적으로 정식 규약을 충실히 따르고 있다. `spec/conventions/node-output.md` 의 Principle 0~11 을 명시적으로 참조하며, 5필드 불변식·`output.result.*` 래핑·에러 컨트랙트(`retryable` / `retryAfterSec` 필수 포함)·config echo 원칙 모두 문서에 올바르게 반영되어 있다. `spec/conventions/spec-impl-evidence.md` 의 frontmatter 요건(`id`/`status`/`code`/`pending_plans`) 도 세 파일 모두 충족하며 `pending_plans` 에 열거된 plan 파일이 `plan/in-progress/` 에 실존하는 것도 확인됐다. 주요 발견은 `id` 필드의 basename-prefix 불일치(INFO), Rationale 절 번호 부착 관행의 conventions 미명시(WARNING), `information-extractor` 의 의도된 이연 결함(W-1, INFO), `thinkingTokens: 0` 의 Principle 11 비준수(INFO) 수준으로, CRITICAL 위반은 없다.

---

## 위험도

LOW
