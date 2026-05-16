# 정식 규약 준수 검토 결과

검토 대상:
- `spec/4-nodes/3-ai/0-common.md`
- `spec/4-nodes/4-integration/4-cafe24.md`
- `spec/5-system/5-expression-language.md`
- `spec/conventions/conversation-thread.md`

---

### 발견사항

---

- **[INFO]** `spec/4-nodes/3-ai/0-common.md` — `## Rationale` 섹션 부재
  - target 위치: 문서 전체 (§11 CHANGELOG 이전 어느 섹션에도 Rationale 없음)
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 표 — "`spec/<영역>/N-name.md` 본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: `0-common.md` 는 `0-` prefix(기술 아키텍처 개요/공통 규약 파일)로 분류되어 있으나 `N-name.md` 형식의 상세 spec 문서와 동일한 권장 사항이 해당된다. 문서에 설계 근거·선택지 비교 등의 Rationale 섹션이 없다.
  - 제안: `## Rationale` 섹션을 CHANGELOG 앞에 추가. 예: multi-turn 차단 모드 선택 근거, 공통 wrapper(`output.result.*` / `output.error.*`) 채택 배경 등을 기재.

---

- **[INFO]** `spec/4-nodes/3-ai/0-common.md` — 섹션 번호 `§11`이 "CHANGELOG"인데 중간 번호와 미스매치 가능성
  - target 위치: `## 11. CHANGELOG`
  - 위반 규약: 해당 규약 없음 (정식 위반은 아님)
  - 상세: §10 은 "Conversation Context"이고 그 다음이 §11 CHANGELOG 인데, 내용상 §10 신설로 기존 §10 이 §11 로 재번호된 점이 CHANGELOG 에는 기록되어 있으나 문서 본문에는 Overview 섹션이 없다. `0-common.md` 패턴 파일에는 전체 개요를 담는 `## Overview` 혹은 도입 설명 섹션이 사실상 없다.
  - 제안: 권고 수준이므로 필요 시 문서 첫머리에 한 문단 Overview 를 두어 3섹션 구성(Overview / 본문 / Rationale)을 완성.

---

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` — 출력 구조 섹션 번호 불연속 (`§5.1`, `§5.3`, `§5.8` — `§5.2`, `§5.4`~`§5.7` 누락)
  - target 위치: `## 5. 출력 구조` 내부 (§5.1, §5.3, §5.8)
  - 위반 규약: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리(성공 / 에러 / 재개 등)", 출력 예시 문서화 규칙. 정식 위반은 아니나 `N-name.md` 정렬 보장 컨벤션(`CLAUDE.md`) 정신에 어긋난다.
  - 상세: §5.2 가 없고 §5.3 으로 바로 이동, §5.4~§5.7 은 공란이며 §5.8 이 "Pre-flight throw"다. 의도적 예비 번호 확보인지 삭제된 케이스의 잔재인지 불분명하여 독자가 누락 여부를 판단하기 어렵다. Principle 11 은 케이스별 분리를 요구하며, 번호 불연속은 문서 유지보수 시 혼란을 야기한다.
  - 제안: §5.2 를 명시적으로 제거하거나 "Reserved" 주석을 달거나, 섹션 번호를 §5.1(성공) / §5.2(에러) / §5.3(Pre-flight) 으로 재번호화. 또는 CHANGELOG 에 섹션 번호 재배치 배경을 기재.

---

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` — `§9.7` OAuth scope wire format 절이 `§9.8` 뒤에 내용이 위치
  - target 위치: `### 9.7 OAuth scope wire format — 콤마 구분 (RFC 6749 예외)` (실제 내용 텍스트가 §9.8 이후 줄에 있음)
  - 위반 규약: `CLAUDE.md` "N-name.md — 정렬 보장된 상세 spec 문서"
  - 상세: 파일 내 §9.7 헤더 직후 본문이 없고, 본문이 §9.8 다음 줄(파일 말미)에 나타난다. 즉 §9.7 절의 내용이 §9.8 뒤에 실제로 배치되어 있어 섹션 순서가 어긋나 있다.
  - 제안: §9.7 헤더 직후에 해당 OAuth scope wire format 본문을 이동하거나, §9.8 뒤의 본문을 §9.7 헤더 바로 아래로 재배치.

---

- **[INFO]** `spec/conventions/conversation-thread.md` — `§2.5 nextSeq 원자성` 절이 `## 3. 스코프 규칙` 안에 삽입되어 있음
  - target 위치: `### 2.5 nextSeq 원자성` (파일 내 줄 326~338, `## 3. 스코프 규칙` 본문 중간에 위치)
  - 위반 규약: `CLAUDE.md` "N-name.md — 정렬 보장" 및 문서 구조 권장
  - 상세: §2.5 는 번호 기준으로 §2 (자동 누적 컨트랙트) 의 하위 절이어야 하지만, 파일 구조를 보면 §3 (스코프 규칙) 섹션의 §3.1~§3.3 이 모두 나온 뒤에 `### 2.5` 가 등장한다. 즉 §3 본문 안에 §2.5 가 끼어들어 있어 문서 섹션 순서가 2→3→2.5→4 가 된다.
  - 제안: `### 2.5 nextSeq 원자성` 절을 `## 2` 섹션의 끝(§2.4 이후)으로 이동시켜 섹션 번호 순서를 복원.

---

- **[INFO]** `spec/5-system/5-expression-language.md` — `## Rationale` 섹션 부재
  - target 위치: 문서 전체 (§8.5 보안 고려사항이 마지막 섹션)
  - 위반 규약: `CLAUDE.md` — "`spec/<영역>/N-name.md` 본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: 표현식 언어는 여러 설계 선택(BNF 문법, 느슨한 타입 변환, strict 모드 opt-in, eval 금지, npm 패키지 분리 등)을 포함하고 있으나 이 결정들에 대한 Rationale/배경 섹션이 없다.
  - 제안: 문서 말미에 `## Rationale` 섹션을 추가하여 설계 결정의 근거(예: eval 금지 이유, 자체 파서 선택, 타입 변환 느슨 모드 기본 채택 근거 등)를 기재.

---

- **[INFO]** `spec/conventions/conversation-thread.md` — conventions 파일임에도 `## 8. Rationale` 에 "본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다"는 위임 표현
  - target 위치: `## 8. Rationale`
  - 위반 규약: `CLAUDE.md` "정식 규약 (옛 user_memo CONVENTIONS) — `spec/conventions/<name>.md`". 단일 진실 원칙.
  - 상세: conventions 문서가 Rationale 자체는 다른 문서(`spec/4-nodes/3-ai/1-ai-agent.md §12`)에 위임하고 있다. 이는 규약 위반은 아니지만 `spec/conventions/` 파일이 해당 규약의 단일 진실 공급원이어야 한다는 원칙과 긴장 관계에 있다. 독자가 컨벤션 파일을 읽으면서 설계 근거를 이해하려면 별도 문서를 참조해야 한다.
  - 제안: 핵심 결정(예: push vs inject 분리, source 열거 이유, v1 ai_agent 만 적용한 이유)에 대한 1~2문장 요약을 §8 에 인라인으로 추가하고, 상세는 `ai-agent.md §12` 참조로 연결하는 방식을 권장. 단순 위임보다는 요약+참조 형식이 단일 진실 공급원 원칙에 더 부합.

---

### 요약

4개 target 문서 모두 정식 규약(`spec/conventions/`)의 핵심 항목(노드 Output Principle, Cafe24 API Metadata, Conversation Thread 컨벤션)을 직접 위반하는 CRITICAL 이슈는 발견되지 않았다. 각 문서는 Principle 0~11 의 5필드 불변, output/meta/error 분리, config echo 규칙, `output.error.{code, message, details?}` envelope, 파일 명명(`0-common`, `N-name`, `conventions/*.md`) 등 핵심 규약을 올바르게 준수하고 있다. 다만 WARNING 1건(출력 섹션 번호 불연속), INFO 5건(Rationale 섹션 부재, 섹션 순서 이탈 2건, Rationale 위임 표현)이 발견되었으며, 이는 채택 시 다른 시스템 invariant 를 깨지는 않으나 문서 유지보수와 가독성 측면에서 개선이 권장된다.

### 위험도

LOW
