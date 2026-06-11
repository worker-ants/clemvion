# 정식 규약 준수 검토 결과

**대상 문서**: `spec/4-nodes/5-data/2-code.md` (draft — prompt_file 내 임베디드 버전)
**검토 날짜**: 2026-06-11
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [CRITICAL] §4 실행 로직 — 구현 기술 스택이 `isolated-vm` 으로 전환됐으나 §5 intro 에 `vm.Script` 잔류

- **target 위치**: §5 출력 구조 인트로 (줄 136 부근)
- **위반 규약**: 내부 일관성 (draft 내 교차 참조 정합)
- **상세**: draft §4 는 `isolated-vm isolate compileScript` 로 컴파일하도록 기술했으나, §5 출력 구조 인트로 박스의 "**컴파일 실패** (vm.Script 구문 오류)" 는 구버전 `vm.Script` 표현이 그대로 남아 있다. 독자가 §5 를 읽으면 `vm.Script` 를, §7 을 읽으면 `isolated-vm` 을 보게 되어 단일 진실 원칙이 깨진다.
- **제안**: §5 인트로의 `(vm.Script 구문 오류)` → `(isolate compileScript 구문 오류)` 로 교체. §6 표의 `vm.Script` 언급도 동일하게 갱신.

---

### [CRITICAL] §6 Pre-flight 표 — `vm.Script` 잔류 (§4·§7 과 불일치)

- **target 위치**: §6 표 마지막 행 "**`code` 컴파일 실패** (`vm.Script` 구문 오류)"
- **위반 규약**: 내부 일관성; `spec/conventions/node-output.md §3.1` (pre-flight throw 는 구현 기술 스택 독립적으로 기술)
- **상세**: draft 전반에 걸쳐 `isolated-vm` 으로 전환됐음에도 §6 표의 컴파일 실패 행은 `` `vm.Script` `` 표현을 그대로 보유한다. §5 인트로와 함께 구버전 잔류 표현이 두 곳에 존재한다.
- **제안**: `vm.Script` → `isolated-vm isolate compileScript` 로 교체하고 §5 와 일치시킨다.

---

### [WARNING] §5.3 공통 필드 표 — 헤더 numbering 충돌 (`5.3 공통 필드 표` vs 하위 `5.3.1`/`5.3.2`)

- **target 위치**: `#### 5.3 공통 필드 표` 섹션 (줄 313 부근)
- **위반 규약**: `spec/conventions/node-output.md Principle 11` — "Case별로 분리", 문서 구조 명확성
- **상세**: `§5.3` 헤딩이 `Case: 런타임 에러 (port error)` 로 먼저 열리고, 그 하위에 `§5.3.1` / `§5.3.2` / `§5.3.3` 이 있는데, 공통 필드 표는 `#### 5.3 공통 필드 표` 로 같은 레벨(`###`)로 되돌아와 있다. 이는 표준 마크다운 문서 hierarchy 에서 `5.3` 의 중복 사용으로, 섹션 앵커가 충돌하고 링크 무결성 가드(`spec-link-integrity.test.ts`)에서 slug 충돌이 발생할 수 있다.
- **제안**: 공통 필드 표를 `### 5.3 공통 필드` 대신 `### 5.4 에러 케이스 공통 필드` 또는 `#### 공통 필드 (모든 에러 케이스)` 로 격하·개명하여 §5.3 하위 sub-section 임을 명확히 한다.

---

### [WARNING] §8 캔버스 요약 — `Data 공통 §3` 과 내용 불일치

- **target 위치**: §8 캔버스 요약 (줄 415 부근)
- **위반 규약**: 단일 진실 원칙; `spec/conventions/spec-impl-evidence.md §1` (spec 내부 교차 참조 정합)
- **상세**: draft §8 에 기술된 캔버스 요약 형식은 `{{language|upper}}` 만이며 "`Code` 행 인용 (`{language}`, 대문자 — `summaryTemplate: {{language|upper}}`. 코드 줄 수는 summaryTemplate DSL 미지원으로 미포함)" 이라 쓴다. 그런데 **commit 된 현재 파일** (동일 경로 `spec/4-nodes/5-data/2-code.md`) §8 은 `` [Data 공통 §3](./0-common.md#3-캔버스-요약) — `Code` 행 인용 (`{language}`, 대문자 — `summaryTemplate: {{language\|upper}}`. 코드 줄 수는 summaryTemplate DSL 미지원으로 미포함). `` 이며, **`Data 공통 §3`** (`0-common.md`) 는 `Code` 의 summaryTemplate 을 `{{language|upper}}` (줄 수 미포함) 으로 정의한다. Draft 의 §8 내용은 이 SoT 와 일치하나, draft 가 중복 인라인 서술을 추가해 `0-common.md` 가 SoT 임이 흐릿해진다. 아울러 draft §8 은 "`$helpers`·`console`은 host 클로저를 브리지" 같은 `isolated-vm` 전환 설명을 §8 이 아닌 §Rationale 에 이미 서술했으므로, §8 자체가 새 정보를 중복 추가하지는 않는다. 단, `0-common.md §3` 의 `Code` 행 설명과 draft §8 의 인라인 서술을 비교하면 draft 가 더 장황하다.
- **제안**: §8 을 `[Data 공통 §3](./0-common.md#3-캔버스-요약) — `Code` 행 인용.` 으로 단순화하거나, SoT 인 `0-common.md §3` 의 설명을 그대로 인용하는 형태로 통일한다.

---

### [WARNING] `meta.success` — `spec/conventions/node-output.md Principle 2` anchor 링크가 실제 heading 과 불일치

- **target 위치**: §5.1 표, `meta.success` 행의 링크 `([CONVENTIONS Principle 2](../../conventions/node-output.md#principle-2--meta-는-실행-메트릭만-담는다))`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` (anchor slug 대조)
- **상세**: `node-output.md` 의 실제 heading 은 `## Principle 2 — \`meta\` 는 "실행 메트릭"만 담는다` 이다. GitHub-Slugger 가 생성하는 anchor 는 `#principle-2----meta-는-실행-메트릭만-담는다` 가 아니라 backtick·따옴표·em dash 처리 방식에 따라 결정된다. 링크에 지정된 `#principle-2--meta-는-실행-메트릭만-담는다` (double dash, backtick 제거) 가 정확한지 별도 검증이 필요하다. 실제 slug 가 다르다면 `spec-link-integrity.test.ts` 빌드 가드에서 실패한다.
- **제안**: `node-output.md` Principle 2 heading 의 정확한 GitHub slug 를 확인한 후 링크 anchor 를 보정한다. 동일 패턴 링크가 §5.3 공통 필드 표에도 등장하므로 일괄 검토 필요.

---

### [WARNING] §5.3.3 신규 케이스 — `meta.durationMs` 필드 누락

- **target 위치**: §5.3.3 케이스 JSON 예시 (메모리 초과)
- **위반 규약**: `spec/conventions/node-output.md Principle 11` — "Case 별로 분리"; `Principle 2` (`meta.durationMs: number` 공통 필수)
- **상세**: §5.3.3 의 JSON 예시에서 `meta.durationMs` 가 없다:
  ```json
  "meta": {
    "success": false,
    "logs": []
  }
  ```
  `Principle 2` 는 `meta.durationMs` 를 `**공통** 필수 필드` 로 지정한다. §5.3.1 (durationMs: 5)·§5.3.2 (durationMs: 1000)에서는 있는데 §5.3.3 에서만 없으면 독자에게 "메모리 초과 시 durationMs 가 없다"는 잘못된 계약을 전달한다. isolate 가 즉시 폐기되면 durationMs 가 불확정일 수 있더라도, 규약상 필드 자체는 존재해야 한다.
- **제안**: §5.3.3 JSON 예시에 `"durationMs": 0` (또는 근사값 `null` 처리가 정책이라면 `0`)을 추가하거나, 본문에 "isolate 즉시 폐기 시 durationMs 는 0 또는 미측정값" 임을 명시한다. 단, 규약 자체를 바꾸려면 `node-output.md Principle 2` 를 함께 갱신해야 한다.

---

### [WARNING] §5.3 `output.error.code` 표 — `CODE_MEMORY_LIMIT` 누락

- **target 위치**: §5.3 공통 필드 표의 `output.error.code` 행 ("`CODE_TIMEOUT` / `CODE_EXECUTION_FAILED`")
- **위반 규약**: `spec/conventions/node-output.md Principle 3.2` (에러 코드 `UPPER_SNAKE_CASE` + 완전한 컨트랙트 명시)
- **상세**: §5.3 공통 필드 표는 `output.error.code` 를 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` 두 값으로 열거한다. 그러나 draft 는 §5.3.3 에서 `CODE_MEMORY_LIMIT` 를 실제 케이스로 추가했고, 에러 코드 정규화 매핑 표에도 `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 가 있다. 공통 필드 표의 열거에서 `CODE_MEMORY_LIMIT` 가 빠지면 해당 코드를 다루는 다운스트림 expression 로직 작성자가 이를 인지하지 못한다.
- **제안**: `output.error.code` 행 설명을 "`CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT`" 로 확장한다.

---

### [INFO] §4 실행 로직 — `isolated-vm` 용어 설명 없이 바로 사용

- **target 위치**: §4 실행 로직 step 3 ("`isolated-vm` isolate(`memoryLimit: 128`) + context 를 만들어 …")
- **위반 규약**: 문서 구조 규약 (Overview/본문/Rationale 3섹션 권장) — 독자 진입성
- **상세**: §7.1 에서 `isolated-vm` 에 대한 배경·선택 근거를 상세히 설명하나, §4 에서 이미 `isolated-vm isolate` 를 사용한다. 처음 읽는 독자가 §4 에서 `isolated-vm` 이 무엇인지 모를 경우 §7.1 로 포워드 참조가 없어 혼란스러울 수 있다.
- **제안**: §4 step 3 에 "`isolated-vm` 격리 방식은 §7.1 참조" 또는 인라인 링크를 추가한다.

---

### [INFO] §5.1 `meta.success` 행 — Principle 2 anchor 참조 방식이 §5.3 과 불일치

- **target 위치**: §5.1 표의 `meta.success` 행 vs §5.3 표의 `meta.success` 행
- **위반 규약**: 문서 내 일관성 (형식 컨벤션)
- **상세**: §5.1 의 `meta.success` 설명은 `([CONVENTIONS Principle 2](../../conventions/node-output.md#principle-2--meta-는-실행-메트릭만-담는다))` 로 링크를 달고, §5.3 의 `meta.success` 는 `CONVENTIONS Principle 2 의 Code 계열 권장 필드` 로만 텍스트 언급한다. 동일 필드를 두 케이스에서 다른 방식으로 참조한다.
- **제안**: 두 행을 같은 참조 방식으로 통일한다 (링크 있거나 없거나 일치).

---

### [INFO] frontmatter `code:` — 구현 완료 경로가 draft 기반 신규 파일과 일치하는지 미확인

- **target 위치**: frontmatter `code:` (lines 4–6)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` (`status: implemented` 시 `code:` ≥1 매치 의무)
- **상세**: draft 의 `status: implemented` 와 `code:` 에 `code.handler.ts` / `code.schema.ts` 가 있다. isolated-vm 전환 구현이 해당 경로에 이미 반영됐다면 문제없다. 단, draft 가 `node:vm` → `isolated-vm` 전환을 기술하고 있으므로 구현 파일이 아직 `node:vm` 기반이라면 `status: partial` 이 더 정확하다.
- **제안**: 구현 파일이 `isolated-vm` 으로 전환 완료된 경우 현재 frontmatter 유지. 미전환이라면 `status: partial` + `pending_plans:` 를 추가한다.

---

## 요약

draft `spec/4-nodes/5-data/2-code.md` 는 `isolated-vm` 전환 결정을 반영한 전면 개정 버전으로, `spec/conventions/node-output.md` 의 Principle 0·2·3·7·8·11 을 대체로 준수한다. 그러나 두 곳에서 구버전 `vm.Script` 표현이 잔류해 §4·§7 의 `isolated-vm` 기술과 직접 충돌하는 CRITICAL 불일치가 있고, §5.3.3 신규 케이스의 `meta.durationMs` 누락, §5.3 공통 필드 표의 `CODE_MEMORY_LIMIT` 누락, `§5.3 공통 필드 표` 헤딩 번호 충돌 등이 WARNING 수준으로 발견된다. anchor slug 검증이 필요한 링크 2건도 있다. CRITICAL 2건을 수정하지 않으면 spec 내부에 격리 방식에 대한 모순된 기술이 공존하게 된다.

## 위험도

MEDIUM
