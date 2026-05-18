# Convention Compliance Check

검토 대상: `spec/4-nodes/3-ai/` (impl-prep 모드)
검토 기준: `spec/conventions/` 정식 규약

---

## 발견사항

### 1
- **[CRITICAL]** `cafe24-api-metadata.md §6` — `op` 토큰 잔존 (drift fix 미완)
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §6 신규 endpoint 추가 절차 step 5 (line 258) 및 step 7 (line 265)
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §2 `restricted` 컬럼 정의 + 동일 파일 CHANGELOG (2026-05-17 drift fix 항) — `restricted` 컬럼 값은 `scope` / `operation` / 빈칸으로 통일됨. `op` 약칭은 폐기
  - 상세: `_overview.md` §4 검증 규칙 8 과 본 파일 CHANGELOG line 309 모두 `op → operation` 통일을 명시했음에도 `cafe24-api-metadata.md §6 step 5` ("catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸)") 와 `step 7` ("catalog 가 `scope` 또는 `op` 면") 에 구 토큰 `op` 가 그대로 남아있다. `catalog-sync.spec.ts` 가 `operation` 토큰으로 비교하는 상황에서 메타데이터 절차 문서가 `op` 를 허용 값으로 기술하면 구현자가 catalog row 에 잘못된 토큰을 입력할 가능성이 있다. `_overview.md` 가 정확한데 절차 문서가 부정확한 상태 — invariant 깨짐 위험.
  - 제안: `cafe24-api-metadata.md §6 step 5` 의 `` `scope` / `op` / 빈칸 `` → `` `scope` / `operation` / 빈칸 `` 으로, `step 7` 의 `catalog 가 \`scope\` 또는 \`op\` 면` → `catalog 가 \`scope\` 또는 \`operation\` 이면` 으로 수정.

### 2
- **[WARNING]** `spec/4-nodes/3-ai/0-common.md` — CHANGELOG 행 3개가 `## Rationale` 섹션 내부에 dangling
  - target 위치: `spec/4-nodes/3-ai/0-common.md` line 269~272 (Rationale 섹션 안에 표 헤더 없이 `| 2026-05-14 |` ~ `| 2026-05-09 |` 3행이 위치)
  - 위반 규약: CLAUDE.md 권장 3섹션 구성 — "## Rationale" 은 spec 문서의 마지막 섹션이며 그 안에 CHANGELOG 표 행이 섞이지 않아야 한다. `## 12. CHANGELOG` 섹션(line 241)은 올바르게 존재하나, §11 신설 시 CHANGELOG 번호를 +1 이동하면서 `## Rationale` 이후에 위치해야 할 구 CHANGELOG 항목들이 잘못된 위치에 남겨졌다
  - 상세: `## 12. CHANGELOG` 표는 line 243에서 정상적으로 열리고, `## Rationale` 는 line 250에서 시작한다. 그런데 `Rationale` 섹션의 마지막 단락("근거: 사용자 제안..." 줄) 바로 다음(line 269)부터 `| 2026-05-14 |`, `| 2026-05-10 |` (×2), `| 2026-05-09 |` 의 3개 표 행이 붙어 있다. 이 행들은 `## 12. CHANGELOG` 의 표 헤더(`| 일자 | 변경 |`) 와 분리되어 있어 CHANGELOG 표가 두 곳으로 쪼개진 구조가 됐다. 렌더러가 이 행들을 Rationale 섹션의 일부로 파싱하면 결정 근거 문서가 표 데이터로 오염된 것처럼 보인다.
  - 제안: line 269~272 의 4개 표 행을 `## 12. CHANGELOG` 표(line 243~246) 바로 아래로 이동한다. `## Rationale` 섹션은 Rationale 본문만 포함하도록 정리.

### 3
- **[WARNING]** `spec/4-nodes/3-ai/2-text-classifier.md` / `spec/4-nodes/3-ai/3-information-extractor.md` — `## Rationale` 섹션 없음
  - target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` 전체 (§8 CHANGELOG 가 마지막 섹션), `spec/4-nodes/3-ai/3-information-extractor.md` 전체 (§8 CHANGELOG 가 마지막 섹션)
  - 위반 규약: CLAUDE.md 명명 컨벤션 — "spec/\<영역\>/N-name.md 는 본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: 이번 PR 에서 두 파일 모두 `includeSystemContext` / `systemContextSections` 필드를 추가했고 `0-common.md` §Rationale 에 설계 근거가 집중됐다. 그러나 CLAUDE.md 는 N-name.md 각 파일에도 `## Rationale` 를 권장한다. `1-ai-agent.md` 는 `## 12. Rationale` 가 있어 해당 패턴을 준수한다. 두 파일은 권장 규약에서 이탈하며, 새 기능 추가 PR 과 함께 gap 이 더 커졌다.
  - 제안: 두 파일에 `## Rationale` 섹션을 추가하고, 각 노드 관점에서의 주요 설계 결정(최소한 "설계 SoT 는 공통 §11 참조" 한 줄 stub)을 기술한다. 규약 갱신이 아니라 기존 권장 사항 이행으로 처리.

### 4
- **[INFO]** `spec/4-nodes/3-ai/0-common.md §11.2` — 출력 예시 포맷에서 마크다운 코드 블록이 번호 없는 목록 (bulleted) 으로 표현됨
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §11.2 "기본 (`['time', 'timezone']`) 출력 예시"
  - 위반 규약: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)" + JSON 예시는 ` ```json ` 블록으로 작성. §11.2 는 plain ` ``` ` (언어 없음) 으로 System Context 출력을 표현
  - 상세: 규약 위반의 직접적 영향은 없으나, 다른 모든 노드 출력 예시가 ` ```json ` 언어 태그를 사용하는 것과 달리 §11.2 의 두 예시 블록은 언어 태그가 없다. 렌더러에서 syntax highlight 가 누락된다.
  - 제안: 두 코드 블록의 ` ``` ` 을 ` ```text ` 또는 ` ```markdown ` 으로 명시 (JSON 이 아닌 human-readable 포맷이므로 `json` 은 부적절, `text` 가 가장 정확). 기존 예시 형식 유지.

### 5
- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md` 섹션 번호 건너뜀 — `§9` 없음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 전체 섹션 목차 — `## 8. 디버그 데이터` 다음이 `## 9. Provider 도구 진단 메타` 가 맞지만, 섹션 9 자체가 `0-common.md §7` 을 단순 인용하는 1-2줄짜리 short section 으로 존재함
  - 위반 규약: 명시적 위반은 아니나, CLAUDE.md 의 spec 문서 권장 구성("N-name.md 는 숫자 prefix, 정렬 보장된 상세 spec 문서")에서 섹션 9가 단순 교차 참조 한 줄 이라는 점은 섹션 분류의 실질적 무게가 없어 독자에게 혼란을 줄 수 있음
  - 상세: `## 9. Provider 도구 진단 메타` (line 1133~1141) 가 `0-common.md §7` 을 참조하는 3줄 짜리 표로만 구성된다. INFO 수준 — 문서 가독성 개선 제안이며 규약 위반이 아님.
  - 제안: §9 본문을 §8 의 sub-section 으로 흡수하거나, §9 표를 구체화하여 독립 섹션으로서의 내용 밀도를 높인다. 선택 사항.

---

## 요약

`spec/4-nodes/3-ai/` 및 관련 정식 규약 파일의 정식 규약 준수 수준은 전반적으로 양호하다. 출력 포맷은 CONVENTIONS Principle 0~11 을 준수하고, 3섹션 구성(Overview·본문·Rationale)은 `0-common.md` 와 `1-ai-agent.md` 에서 지켜지고 있다. 단, 두 가지 문제가 채택 전 수정을 권장한다: (1) `cafe24-api-metadata.md` §6 에 drift-fix 이후에도 구 토큰 `op` 가 잔존해 구현자가 카탈로그에 잘못된 값을 입력할 여지가 있다(CRITICAL), (2) `0-common.md` §11 신설 과정에서 CHANGELOG 구 항목 3개가 Rationale 섹션 내부에 dangling 됐다(WARNING). `2-text-classifier.md` 와 `3-information-extractor.md` 에 Rationale 섹션이 없는 점은 권장 규약 미이행이다(WARNING).

---

## 위험도

MEDIUM
