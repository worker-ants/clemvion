# Naming Collision Review — Cafe24 §9.9 UX Cleanup (Phase 4)

대상 파일: `spec/4-nodes/4-integration/4-cafe24.md`
검토 범위: §2 Fields 편집 UI 수정 + §9.9 재작성 + CHANGELOG `2026-05-16 (ux-cleanup)` 행 추가

---

## 발견사항

- **[INFO]** `ExpressionInput` — 기존 정의와 일치, 충돌 없음
  - target 신규 식별자: `ExpressionInput` (§2 line 57, §9.9 line 479)
  - 기존 사용처: `spec/5-system/5-expression-language.md` §8.4.1 "ExpressionInput 컴포넌트" — 동일 컴포넌트를 동일 의미(표현식 aware 텍스트 입력 위젯)로 지칭
  - 상세: 두 참조가 완전히 동일한 개념을 가리키고 있어 의미 충돌이 없다. §9.9 의 사용("모든 값 입력칸은 `ExpressionInput` 베이스로")은 expression-language spec 에서 정의한 컴포넌트와 일관된 호칭이다.
  - 제안: 이상 없음. 현행 유지.

- **[INFO]** `fields` — 다층적 의미로 쓰이나 컨텍스트 내 명확히 구분됨
  - target 신규 식별자: `fields` (§9.9에서 "metatata 의 `fields[]`" 와 "config.fields" 두 의미로 사용)
  - 기존 사용처: `spec/conventions/cafe24-api-metadata.md` §2 — `Cafe24OperationMetadata.fields` (operation 의 입력 스키마 맵), `spec/4-nodes/4-integration/4-cafe24.md` §1 — config 필드 `fields: Record<string, unknown>` (사용자 입력값)
  - 상세: "operation 의 필드 정의 스키마(메타데이터 측)" 와 "사용자가 채운 config 값(노드 측)" 이 둘 다 `fields` 라는 동일 토큰을 사용한다. §9.9 본문은 `fields[].name` (메타데이터 측) 과 `config.fields` (노드 설정 측) 를 구별해 쓰고 있고 §2 도 같은 패턴을 따르므로 독자가 컨텍스트로 구분할 수 있다. 이 이중 의미는 이번 PR 이 처음 도입한 것이 아니며 기존 spec 전반에 이미 확립된 패턴이다.
  - 제안: 이번 PR 범위 내 변경 사항은 기존 관례를 그대로 따르므로 추가 조치 불필요. 장기적으로 메타데이터 측을 `fieldDefs` 또는 `fieldSchema` 로 구분하면 독자 부담이 줄어들 수 있으나, 이는 별도 spec 리팩터링 범위이며 현 PR 의 충돌 문제는 아니다.

- **[INFO]** `extras.operationsByResource` — 단일 참조, 기존 충돌 없음
  - target 신규 식별자: `extras.operationsByResource` (§9.9 line 479 — Phase 2 payload 설명)
  - 기존 사용처: spec 전체 검색 결과 `4-cafe24.md` 외에 이 키를 정의하거나 참조하는 문서 없음
  - 상세: `extras` 네임스페이스 자체도 cafe24.md 외의 spec 문서에서 사용되지 않는다. §9.9 는 이 페이로드를 "Phase 2 의 … 페이로드" 라는 역사적 맥락으로만 언급하고 있어 현재 계약으로 오인될 우려가 낮다. 다만 `extras.operationsByResource` 가 어느 API endpoint 또는 어느 spec 섹션에서 정의되는지에 대한 명시적 링크가 없다.
  - 제안: 혼동 방지를 위해 `extras.operationsByResource` 에 출처 참조(예: "Cafe24 노드 설정 API §X" 또는 plan 링크)를 한 줄 추가하면 좋지만, 식별자 충돌 자체는 아니므로 현 PR 차단 사유가 아니다.

- **[INFO]** `메타데이터 기반 typed 동적 폼` — 한국어 기술 산문, 식별자 아님
  - target 신규 식별자: `메타데이터 기반 typed 동적 폼` (§9.9 소제목 / CHANGELOG 라벨)
  - 기존 사용처: 다른 spec 문서에서 동일 문자열 미사용
  - 상세: 이 구문은 프로그래밍 식별자나 요구사항 ID 가 아닌 기술 설명 레이블이다. 충돌 대상이 아니며, `spec/conventions/cafe24-api-metadata.md` 에서 사용하는 "메타데이터 테이블" / "Operation 메타데이터" 와 동일한 개념 맥락에서 파생된 표현이다.
  - 제안: 이상 없음.

- **[INFO]** `호환 키 보존` 소제목 — 신규 heading, 중복 없음
  - target 신규 식별자: heading "**호환 키 보존**" (§2 bullet, §9.9 볼드 단락 시작)
  - 기존 사용처: `4-cafe24.md` 전체 및 spec 코퍼스 전체에서 동일 heading 미존재
  - 상세: §2 에서는 bullet 의 강조 텍스트로, §9.9 에서는 볼드 단락 시작으로 사용된다. `###` 수준의 독립 heading 이 아니라 인라인 표현이므로 Markdown anchor 충돌이 없다.
  - 제안: 이상 없음.

- **[INFO]** `§9.9` anchor — 파일 내 유일, 중복 없음
  - target 신규 식별자: `### 9.9 Fields 편집 UI — 메타데이터 기반 typed 동적 폼` (line 475)
  - 기존 사용처: `grep "^### 9\."` 결과: §9.1 ~ §9.9 가 연속 unique. 동일 파일에 `## 9. Rationale` 는 하나뿐이며 `### 9.9` 가 새로 추가된 것으로, 이전에 같은 번호를 가진 subsection 이 없었음을 확인
  - 상세: `4-cafe24.md` 에는 이 PR 이전에 §9.1~§9.8 까지만 존재했다. §9.9 는 순번상 신규이며 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** CHANGELOG 레이블 `2026-05-16 (ux-cleanup)` — 같은 날 기존 레이블과 구분됨
  - target 신규 식별자: `2026-05-16 (ux-cleanup)` (CHANGELOG 테이블 행 키, line 500)
  - 기존 사용처: 같은 CHANGELOG 테이블 내 — `2026-05-16` (bare), `2026-05-16 (후속)`, `2026-05-16 (catalog)` 총 3개가 이미 존재 (lines 497-499)
  - 상세: 4번째 `2026-05-16` 행으로, 구분자 `(ux-cleanup)` 이 기존 `(후속)` / `(catalog)` / bare 와 완전히 다르다. Markdown 테이블에서 행 키 중복이 허용되는 구조이지만 이 프로젝트는 일자 + 괄호 수식어를 복합 레이블로 사용하고 있어 의미 구분이 명확하다. 혼동 가능성 없음.
  - 제안: 이상 없음.

- **[INFO]** `Phase 2` / `Phase 3` 참조 — cafe24 노드 UX 개편 내부 단계, spec 전체의 Phase 용어와 중복 없음
  - target 신규 식별자: `Phase 2`, `Phase 3` (§9.9 내 역사적 맥락 참조)
  - 기존 사용처: `spec/5-system/4-execution-engine.md` 에 "Phase 2 — Send Email + HTTP Request", "Phase 3 — 나머지 25개 핸들러", "Phase 4 — Frontend autocomplete" 가 다른 작업(Node Output Contract Unification)의 단계로 존재
  - 상세: 두 Phase 레이블이 다른 맥락(execution engine 마이그레이션 vs. Cafe24 노드 UX 개편)에서 동일한 "Phase 2 / Phase 3" 라는 이름을 사용한다. 그러나 §9.9 에서의 참조는 해당 절의 맥락("Cafe24 UX 개편") 안에서 쓰이고 있으며, 독자가 두 계통을 혼동할 가능성이 있다.
  - 제안: §9.9 의 Phase 참조에 `(cafe24-node-resource-operation-ux.md §Phase 2)` 처럼 plan 링크나 "(Cafe24 노드 UX 개편 Phase 2)" 수식어를 추가하면 execution engine spec 의 "Phase 2/3" 와 구분이 명확해진다. 현 PR 에서의 의미 충돌은 critical 하지 않으나 장기 문서 가독성을 위한 권고 사항이다.

---

## 요약

§9.9 재작성과 §2 설정 UI 정리에서 도입된 신규 식별자("메타데이터 기반 typed 동적 폼", "호환 키 보존", `ExpressionInput`, `extras.operationsByResource`, `§9.9` anchor, `2026-05-16 (ux-cleanup)` 레이블)는 모두 기존 사용처와 의미 충돌이 없다. `ExpressionInput` 은 `spec/5-system/5-expression-language.md` 에서 정의된 동일 컴포넌트를 가리키며 일관되다. `fields` 는 메타데이터 측과 config 측의 이중 의미를 갖지만 이는 기존 spec 전반에 확립된 관례이며 이번 PR 이 새로 도입한 문제가 아니다. 유일한 경미한 우려는 "Phase 2 / Phase 3" 레이블이 execution engine 마이그레이션 단계와 Cafe24 UX 개편 단계를 동일 이름으로 지칭한다는 점이나, 이는 각 문서의 국소 맥락으로 독자가 충분히 구분 가능하고 CRITICAL 혼선을 유발하지 않는다.

---

## 위험도

LOW
