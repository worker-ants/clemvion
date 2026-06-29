# 요구사항(Requirement) 리뷰 결과

**대상 변경**: `spec/conventions/spec-impl-evidence.md` — `spec/data-flow/**` 의도적 제외 설명 blockquote 추가 + `**제외**` 헤더 명료화 + R-10 Rationale 신설; `spec-area-index.test.ts` — 주석 SoT 참조 보강; consistency review artifacts.

---

## 발견사항

### [INFO] `spec-area-index.test.ts` 주석 변경 — 내용 정확하며 기능 영향 없음

- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` L17-18
- 상세: 이전 주석 "SoT: spec/conventions/spec-impl-evidence.md." 에서 "This guard belongs to the §4.2 knowledge-base/plan-integrity family. SoT: spec/conventions/spec-impl-evidence.md §4.2." 로 변경됐다. 실제 `collectSpecMarkdown()` 는 `spec/data-flow/**` 를 포함한 전체 `spec/**/*.md` 를 수집하므로 (api-catalog만 제외), `spec/data-flow/` area-index 검사도 이 가드에서 수행된다. 주석의 §4.2 귀속 선언은 `spec-impl-evidence.md §4.2` 표와 일치한다. 코드 동작에 변경 없음.
- 제안: 없음.

### [INFO] `spec/data-flow/` area-index 가드 실제 적용 여부 확인 — 통과 가능

- 위치: `spec/conventions/spec-impl-evidence.md §1` 신설 blockquote
- 상세: spec 본문은 "단 §4.2 의 링크 무결성·area-index 가드는 `spec/data-flow/` 에도 그대로 적용된다"고 선언한다. 실제로 `spec/data-flow/`는 16개 파일(0-overview.md 포함)을 가지므로, `collectAreas()`가 이 디렉토리를 area로 수집하고 `0-overview.md`를 index 문서로, 나머지 15개 파일을 siblings로 판정한다. `spec/data-flow/0-overview.md`를 직접 확인한 결과 1-audit.md~15-external-interaction.md 전 15개 파일에 대한 링크가 존재하므로 area-index 가드는 현재 통과 상태다. 이 사실이 spec 서술("가드는 data-flow에도 적용된다")과 일치한다.
- 제안: 없음. 현재 정합.

### [INFO] `spec-impl-evidence.md §2.1` `user_guide` 필드 설명 + R-10 — 기존 구현과 일치

- 위치: `spec/conventions/spec-impl-evidence.md §2.1` + `## Rationale R-10`
- 상세: `user_guide:` 에 build-time 가드가 없음을 §2.1 에 명시하고 R-10 에 근거를 추가했다. `spec-frontmatter-parse.ts` 에는 `user_guide:` 경로를 검증하는 로직이 없으므로 구현과 spec 서술이 일치한다. R-10 이 신설되기 전까지 이 설계 결정이 Rationale 에 미기재였던 것은 consistency checker 가 이미 INFO(LOW 위험도)로 보고하고 즉시 반영한 것이다.
- 제안: 없음.

### [INFO] `**제외**` 헤더 재작성 — 의미 범위 동일, 목록 변경 없음

- 위치: `spec/conventions/spec-impl-evidence.md §1` "**제외**" 단락
- 상세: 헤더가 "가드 구현 `spec-frontmatter-parse.ts` 기준 — **basename 매칭**" → "위 inclusive list 내부에서 추가로 빠지는 파일 — 가드 구현 `spec-frontmatter-parse.ts` 기준 **basename 매칭**" 으로 변경됐다. 제외 목록 자체(0-overview.md, 1-data-model.md, _*.md, api-catalog)는 변경이 없으며 구현 코드 `EXCLUDE_BASENAMES`·`CATALOG_FIELD_FILE` 과 일치한다. 영역 수준 제외(inclusive list 바깥)와 파일 수준 제외(list 내부 basename 매칭)의 구분을 명확히 한 서술 개선이다.
- 제안: 없음.

---

## 요약

이번 변경은 `spec/conventions/spec-impl-evidence.md §1` 에 `spec/data-flow/**` 의도적 제외 설명 blockquote를 삽입하고, `**제외**` 헤더를 "inclusive list 내부 파일 수준 제외"로 명료화하며, `user_guide:` 가드 미적용 근거(R-10)를 Rationale 에 추가한 문서 보강이다. `spec-area-index.test.ts` 는 주석에 §4.2 귀속 선언과 SoT 정확한 참조를 추가한 것으로 기능 변경이 없다. 모든 변경은 기존 구현(`INCLUDE_PREFIXES`, `collectSpecMarkdown`, `EXCLUDE_BASENAMES`, `spec/data-flow/0-overview.md` 링크 현황)과 정합하며, 비즈니스 로직 오류, 엣지 케이스 미처리, 기능 누락, TODO/FIXME, 에러 경로 미정의가 발견되지 않았다. consistency review 산출물 파일(파일 2-9)은 리뷰 기록으로 기능 구현 대상이 아니다. 요구사항 충족도 관점에서 문제가 없다.

---

## 위험도

NONE
