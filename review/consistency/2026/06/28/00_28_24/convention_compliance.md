# Convention Compliance Review — `spec/data-flow/0-overview.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-28

---

### 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

아래는 확인된 규약 준수 사항 요약이다.

---

**[INFO] 파일 명명 — 정상**

- target 위치: 파일 경로 `spec/data-flow/0-overview.md`
- 위반 규약: 해당 없음
- 상세: `0-overview.md` 는 `spec-area-index.test.ts` 의 INDEX_RE (`/^(_.*overview|_layout|0-.*|README)\.md$/`)에 일치하는 영역 진입 문서 패턴이다. CLAUDE.md 의 정보 저장 위치 표("제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`") 에서 `## Overview` 섹션을 갖는 진입 문서로 대체 가능하다고 명시하므로 `0-` prefix 선택은 적법하다.

---

**[INFO] Frontmatter 누락 — 규약 면제 대상이므로 정상**

- target 위치: 문서 전체 (YAML frontmatter 없음)
- 위반 규약: 해당 없음 (`spec/conventions/spec-impl-evidence.md §1` 적용 제외 대상)
- 상세: `spec-impl-evidence.md §1` 의 적용 경로는 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/` 로 한정되며 `spec/data-flow/` 는 이 목록에 없다. 추가로 `EXCLUDE_BASENAMES` 에 `0-overview.md` basename 이 등재되어 있어 해당 basename 은 모든 영역에서 frontmatter 의무가 면제된다. 이중 면제 상태이므로 frontmatter 부재는 규약 위반이 아니다.

---

**[INFO] 문서 3섹션 구조 — 정상**

- target 위치: 전체 구조 (`## Overview` → `## 1~5` 본문 → `## Rationale`)
- 위반 규약: 해당 없음
- 상세: CLAUDE.md 가 권장하는 Overview / 본문 / Rationale 3섹션 구성을 준수한다. Rationale 은 문서 말미에 위치하며 세 하위 절("폴더를 분리한 이유", "`spec/1-data-model.md` 와 중복 회피", "KB 원본 문서 S3 key 구조", "Mermaid 사용")로 결정의 배경·기각 이유를 충분히 서술하고 있다.

---

**[INFO] 영역 인덱스 링크 완전성 — 정상**

- target 위치: `## 2. 도메인 인덱스` 표
- 위반 규약: 해당 없음 (`spec/conventions/spec-impl-evidence.md §4.2` `spec-area-index.test.ts`)
- 상세: `spec/data-flow/` 의 15개 도메인 파일(1-audit.md ~ 15-external-interaction.md) 전부가 `## 2. 도메인 인덱스` 표에서 상대경로(`./N-name.md`)로 링크되어 있다. `spec-area-index.test.ts` 의 basename 매칭 방식으로 검증하면 누락 없음.

---

**[INFO] 내부 링크 타깃 유효성 — 정상**

- target 위치: 헤더 관련 문서 링크, BullMQ 카탈로그 cross-reference
- 위반 규약: 해당 없음 (`spec-impl-evidence.md §4.2` `spec-link-integrity.test.ts`)
- 상세: 참조된 외부 파일 모두 실존 확인됨.
  - `../0-overview.md` → `spec/0-overview.md` (exists)
  - `../1-data-model.md` → `spec/1-data-model.md` (exists)
  - `../5-system/_product-overview.md` → `spec/5-system/_product-overview.md` (exists)
  - `../conventions/secret-store.md` → `spec/conventions/secret-store.md` (exists)
  - `../5-system/4-execution-engine.md` → exists
  - `../5-system/14-external-interaction-api.md` → exists

---

**[INFO] Rationale의 S3 key 섹션 — 구버전 대비 개선**

- target 위치: `## Rationale` → `### KB 원본 문서 S3 key 구조`
- 위반 규약: 해당 없음
- 상세: 기존 파일의 Rationale은 `spec/0-overview.md §2.7` 과의 S3 key 불일치가 여전히 존재한다고 서술하나, 제안 버전은 해당 불일치가 해소됐음을 정확히 반영한다. `spec/0-overview.md §2.7` 실제 내용이 `kb/{kbId}/{documentId}/...` 로 이미 정합되어 있으므로 제안 버전이 현실과 부합한다.

---

### 요약

`spec/data-flow/0-overview.md` 제안본은 `spec/conventions/` 의 정식 규약을 전면 준수한다. 파일 명명(`0-overview.md`)은 `spec-area-index.test.ts` 의 인덱스 문서 패턴에 일치하고, frontmatter 미적용은 `spec-impl-evidence.md §1` 의 경로 제외 + `EXCLUDE_BASENAMES` 이중 면제로 정당하다. 3섹션 문서 구조(Overview/본문/Rationale)를 준수하며, 영역 내 15개 도메인 파일을 도메인 인덱스 표에서 빠짐없이 링크한다. 내부 상호참조 링크 타깃도 모두 실존한다. 규약 직접 위반이나 금지 패턴 답습은 확인되지 않았다.

### 위험도

NONE
