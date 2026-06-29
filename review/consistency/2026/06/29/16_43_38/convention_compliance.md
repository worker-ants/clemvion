# 정식 규약 준수 검토 결과

대상 문서: `spec/conventions/i18n-userguide.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 1. [WARNING] Principle 7 GUI 흐름 절 판별 정의가 SoT 와 불일치

- **target 위치**: `## Principle 7 — 사용자 가이드 페이지 stale 방지` > "GUI 흐름 절" 설명 (자동 검출 첫 번째 bullet)
- **위반 규약**: `spec/conventions/user-guide-evidence.md §2` (Build-time 가드 `integrations-coverage.test.ts` 의 `findGuiFlowSections()` 정의)
- **상세**: 현재 디스크의 `spec/conventions/i18n-userguide.md` (line 172)는 GUI 흐름 절 판별 기준을 `**GUI ...**` strong 패턴으로 시작하거나 heading 에 `GUI` 키워드를 가진 절`이라고 서술한다. 그러나 SoT 인 `user-guide-evidence.md §2`는 `findGuiFlowSections()` 의 **두 신호 OR** — (1) h2/h3 heading 텍스트에 bareword `GUI` 포함, 또는 (2) 절 본문 **어디든** `GUI` 를 포함한 bold strong(`**…GUI…**` / `__…GUI…__`) 존재 — 로 정확히 명시한다. "strong 패턴으로 시작" vs "본문 어디든 bold strong 존재"는 의미가 다르고, "h2/h3 heading" vs "heading" 도 구체성이 다르다. 검토 대상인 prompt_file 버전은 SoT 와 일치하는 정확한 서술을 포함하고 있으나, 현재 디스크 파일은 stale 요약으로 남아 있어 두 버전 간 불일치가 존재한다.
- **제안**: `i18n-userguide.md` Principle 7 의 GUI 흐름 절 설명을 `user-guide-evidence.md §2` 의 `findGuiFlowSections()` 두 신호 OR 정의와 일치하도록 갱신한다. prompt_file 버전의 서술(`두 신호 OR — (1) h2/h3 heading 텍스트에 bareword GUI 포함, 또는 (2) 절 본문 어디든 GUI 를 포함한 bold strong 존재; 판별 정의 SoT 는 user-guide-evidence.md §2`)이 올바른 형태다.

---

### 2. [WARNING] 자동 가드 요약 표의 Principle 7 행이 SoT 와 불일치

- **target 위치**: `## 자동 가드 요약` 표 > `7 (페이지 stale)` 행
- **위반 규약**: `spec/conventions/user-guide-evidence.md §2` (GUI 흐름 절 가드 3건 명시)
- **상세**: 현재 디스크의 `i18n-userguide.md` (line 189) 는 Principle 7 행에 `— | manual / reviewer` 만 기재한다. 그러나 `user-guide-evidence.md §2` 에 따르면 GUI 흐름 절에 대한 build hard fail 가드 3건(`impl-anchor-existence.test.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`)이 구현돼 있다. 이 가드들이 자동 가드 요약 표에서 누락되어 있어, 표만 읽으면 Principle 7 이 완전히 manual 검수에만 의존하는 것으로 오해된다. prompt_file 버전은 `GUI 흐름 절: impl-anchor-existence.test.ts / integrations-coverage.test.ts / triggers-coverage.test.ts (SoT: user-guide-evidence.md). 개념 설명 절: — | hard fail (GUI 흐름 절) / manual (개념 설명 절)`로 올바르게 기재하고 있다.
- **제안**: 자동 가드 요약 표의 Principle 7 행을 prompt_file 버전과 같이 GUI 흐름 절 가드(3건)와 개념 설명 절(manual) 을 분리 표기하도록 갱신한다.

---

### 3. [INFO] frontmatter `code:` 에 `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` 누락

- **target 위치**: 문서 frontmatter `code:` 목록 (lines 4–14)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: implemented` 시 `code:` 에 본 spec 이 약속한 surface 의 구현 경로 등재 의무
- **상세**: Principle 7 의 GUI 흐름 절 자동 가드(`impl-anchor-existence.test.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`)는 `i18n-userguide.md` 가 약속하는 구현 surface 임에도 `code:` 목록에 없다. 이 파일들은 `user-guide-evidence.md` 의 `code:` 에 이미 등재돼 있어 중복 등재를 피한 것일 수 있다(두 spec 이 동일 파일을 가리키는 것은 허용됨). 다만 Principle 7 가드가 `i18n-userguide` 의 §Principle 7 의 약속을 실행하는 파일이므로, cross-reference 관점에서 `user_guide:` 또는 별도 주석으로 `user-guide-evidence.md` 를 연결하는 것을 고려할 수 있다.
- **제안**: 필수 수정은 아니나, `user_guide:` 필드 또는 상단 주석에 `user-guide-evidence.md` 를 교차 참조로 추가하면 spec 간 연결이 명확해진다. 현재 frontmatter 에 `code:` 로 등재하지 않은 결정이 의도적이라면 인라인 주석으로 근거를 명시하는 것을 권장한다.

---

## 요약

`spec/conventions/i18n-userguide.md` 는 frontmatter 스키마(`id`, `status`, `code:`)를 준수하고, 문서 구조(Principle 본문 + Rationale)도 규약 권장 형식을 따른다. 주요 위반은 Principle 7 과 자동 가드 요약 표에서 GUI 흐름 절 판별 기준 및 build-time 가드(3건)가 SoT(`user-guide-evidence.md §2`)와 달리 stale 하게 서술되어 있다는 점이다. 이는 `user-guide-evidence.md` 에서 `findGuiFlowSections()` 정의가 정교화된 이후 `i18n-userguide.md` 가 동기 갱신되지 않아 발생한 드리프트이며, 검토 대상인 prompt_file 버전은 이미 올바른 내용을 반영하고 있다 — 즉 prompt_file 버전이 현행 SoT 와 일치하는 올바른 상태이고, 현재 디스크 파일이 stale 하다. 규약 자체를 갱신할 필요는 없으며, `i18n-userguide.md` 를 prompt_file 버전으로 수렴하면 발견사항 1·2 가 해소된다.

## 위험도

LOW
