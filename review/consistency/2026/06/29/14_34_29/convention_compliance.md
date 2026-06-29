# 정식 규약 준수 검토 — spec/conventions/spec-impl-evidence.md

검토 모드: spec draft (--spec)
검토 대상 변경: `spec/data-flow/**` 의도적 제외 설명 blockquote 추가 + "제외" 헤더 명료화

---

## 발견사항

해당 변경에서 CRITICAL 또는 WARNING 등급의 규약 위반은 발견되지 않았다. 아래에 관찰된 사항을 등급별로 기술한다.

### [INFO] `spec/data-flow/**` 제외 설명 — 문서 구조적으로 적절한 위치에 삽입됨
- target 위치: `spec/conventions/spec-impl-evidence.md` §1 (적용 대상) — inclusive list 직후, "제외" 항목 위
- 위반 규약: 해당 없음. CLAUDE.md 의 문서 3섹션(Overview / 본문 / Rationale) 권장 구조와 일치하며 §1 본문 내 blockquote 형태로 삽입됨.
- 상세: 새로 추가된 blockquote는 `spec/data-flow/**` 가 inclusive list 에 없는 이유(구현 lifecycle 추적 대상이 아닌 흐름 다이어그램·매핑 문서)를 명확히 설명한다. 이 설명은 이전에 "제외" 항목(basename 매칭)과 혼동될 수 있었던 독자 혼란을 예방한다. 실제 `spec/data-flow/` 파일들이 `id`/`status` frontmatter 없이 존재하는 사실과 정합하며(구현으로 확인됨), `INCLUDE_PREFIXES` 에도 해당 경로가 없음을 코드(`spec-frontmatter-parse.ts` L47-54)로 확인했다.
- 제안: 변경 자체는 적절하다. 추가 조치 불필요.

### [INFO] "제외" 헤더 명료화 — 규약 준수
- target 위치: §1, "제외" 단락 헤더 (`**제외** (가드 구현 …)` → `**제외** (위 inclusive list 내부에서 추가로 빠지는 파일 …)`)
- 위반 규약: 해당 없음.
- 상세: 변경 전 헤더는 "가드 구현 `spec-frontmatter-parse.ts` 기준 — basename 매칭" 이라 inclusive list 외부 제외(data-flow 등)와 내부 제외(basename 매칭)가 구분되지 않았다. 변경 후는 "위 inclusive list 내부에서 추가로 빠지는 파일" 로 범위를 한정해 두 종류의 제외(영역 수준 vs 파일 수준)를 명확히 구분한다. 규약 문서 내 정확성 향상으로 평가됨.
- 제안: 변경 자체는 적절하다.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 의 이번 변경은 `spec/data-flow/**` 가 frontmatter 의무 대상에서 의도적으로 제외된다는 사실을 §1 에 blockquote 로 명시하고, "제외" 헤더를 "inclusive list 내부에서 추가로 빠지는 파일" 로 한정하는 두 부분으로 구성된다. 두 변경 모두 정식 규약(`spec/conventions/spec-impl-evidence.md` §1, CLAUDE.md 문서 구조 3섹션 권장)의 범위 안에 있으며, 명명·출력 포맷·API 문서·금지 항목 어느 측면에서도 규약 위반이 없다. 코드(`spec-frontmatter-parse.ts` `INCLUDE_PREFIXES`)와도 정합하며 실제 `spec/data-flow/` 파일의 frontmatter 부재 사실과 일치한다. 채택해도 다른 시스템이 가정하는 invariant를 깨지 않는다.

---

## 위험도

NONE
