STATUS: OK

### 발견사항

- **[INFO]** `sourceItemSample` 이 spec 본문에 최초 노출됨
  - target 신규 식별자: `sourceItemSample` (§8.4.2 신규 행의 "데이터 소스" 셀: `실행 결과 행 샘플(sourceItemSample)`)
  - 기존 사용처: `codebase/frontend/src/components/editor/expression/use-expression-context.ts:56` (`sourceItemSample: Record<string, unknown> | null`), `use-expression-suggestions.ts:187,192`, `variable-picker.tsx` — 코드 내부 필드명. `spec/5-system/5-expression-language.md`, `spec/4-nodes/6-presentation/2-table.md` 어디에도 현재 이 문자열은 등장하지 않음(grep 확인).
  - 상세: 새 엔티티·타입 도입이 아니라 기존 내부 구현 필드명을 처음으로 spec 텍스트에 인용하는 것. 다른 의미로 이미 쓰이는 이름과 충돌하지 않고, target 의 "코드 ground truth" 절에 적힌 실제 필드명과 정확히 일치한다. §8.4.2 기존 행들도 `outputData`, `config`, `nodes` 등 구현 필드명을 "데이터 소스" 셀에 직접 노출하는 선례가 있어 스타일상 이질적이지 않음.
  - 제안: 충돌 아님 — 조치 불필요. 참고로만 기록.

- **[INFO]** `$sourceItem`/`$sourceItemIndex`/`$dataSource` 는 신규 식별자가 아님 (정합성 확인)
  - target 신규 식별자: 없음 — target 이 §7.1/§8.4.2 에 추가하는 행은 새 이름을 도입하지 않고 기존 canonical 정의를 재인용한다.
  - 기존 사용처: `spec/5-system/5-expression-language.md:185` (§4.1 note: `$sourceItem`(현재 행 항목)·`$sourceItemIndex`(행 인덱스)·`$dataSource`(원본 데이터 배열) — Table 노드 한정 컨텍스트), `spec/4-nodes/6-presentation/2-table.md:49-51`(표 정의) 및 `:39-40,152,156`(사용처). 코드: `expression-constants.ts:56-60`(`TABLE_CONTEXT_VARIABLES`), `use-expression-suggestions.ts:186-191,344-346`(`NESTED_DRILL_SOURCES`).
  - 상세: 세 이름 모두 spec·코드 양쪽에서 이미 "Table 노드 컬럼 표현식 전용, 행 샘플 기반" 이라는 단일 의미로만 쓰이고 있으며, target 은 §7.1/§8.4.2 자동완성 트리거 표에 같은 의미로 cross-ref 행을 추가할 뿐 재정의하지 않는다(§4.1 을 SoT 로 명시). 다른 노드 컨텍스트·다른 영역에서 동일 이름이 다른 의미로 쓰이는 사례 없음(grep 전체 spec/ 결과 2개 파일에만 출현, 둘 다 동일 의미).
  - 제안: 충돌 아님 — 문서화 방식(§4.1 을 canonical 로 두고 §7.1/§8.4.2 는 cross-ref)이 오히려 중복 정의를 피하는 바람직한 패턴.

### 부가 확인 (충돌 없음)

- **요구사항 ID**: `spec/5-system/` 은 `_product-overview.md` 류 문서에서만 요구사항 ID(prefix) 를 부여하는 컨벤션이며, target 이 건드리는 `5-expression-language.md` 본문에는 요구사항 ID 체계가 없고 target 도 새 ID 를 부여하지 않는다.
- **API endpoint / 이벤트·메시지명 / 환경변수**: target 은 순수 문서(표 행 2개 + note 1개) 추가이며 코드·API·이벤트·ENV 변경이 전혀 없다. 새 endpoint/이벤트/ENV 도입 없음.
- **파일 경로**: 새 spec 파일을 만들지 않고 기존 `spec/5-system/5-expression-language.md` 를 수정한다. plan 파일명 `plan/in-progress/expr-autocomplete-table-rows.md` 도 기존 plan 파일과 중복 없음(검색 결과 유일).
- **§7.1/§8.4.2 표의 트리거 키 중복 여부**: 두 표 모두 현재 `$sourceItem.`/`$dataSource.` 행이 없어(기존 행: `$input.`/`$params.`/`$node["`/`$var.`/함수명/표현식 시작 뿐) target 이 추가하는 행과 기존 행 사이 키 중복 없음.

### 요약
target 은 새 요구사항 ID·엔티티·endpoint·이벤트명·ENV 변수·파일 경로를 전혀 도입하지 않는 순수 additive 문서 변경이다. 유일하게 spec 텍스트에 처음 등장하는 문자열은 `sourceItemSample` 인데, 이는 코드에 이미 존재하는 필드명을 그대로 인용한 것이고 다른 의미로 쓰이는 동명 식별자가 없어 충돌이 아니다. `$sourceItem`/`$sourceItemIndex`/`$dataSource` 도 §4.1 에 이미 정의된 이름을 재정의 없이 cross-ref 로만 확장하므로 신규 식별자 충돌 관점에서 문제되는 지점이 없다.

### 위험도
NONE
