# Rationale 연속성 검토 — Cafe24 노드 UX Phase 4 (§9.9 cleanup)

검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` §2 및 §9.9 재작성 (PR #89, cafe24-spec-buffer-cleanup-2b6e9c)
기준 Rationale: 동일 파일 §9.1~§9.8, plan/complete/cafe24-fields-add-button-fix.md, plan/complete/spec-update-cafe24-fields-ui-buffer.md, review/consistency/2026/05/16/09_03_04/SUMMARY.md, review/consistency/2026/05/16/13_09_46/rationale_continuity/review.md

---

## 발견사항

### 1. [INFO] 옛 §9.9 결정의 "기각" 처리 방식 — 번복이 아닌 범위 한정 소멸, 단 명시성 보강 권장

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.9` "적용 범위 변경 (2026-05-16)" 단락
- **과거 결정 출처**: 동일 파일 §9.9 PR #77 원문 (옛 옵션 B — "Array<{key,value}> 내부 편집 버퍼 분리"); plan/complete/cafe24-fields-add-button-fix.md §해결방향; review/consistency/2026/05/16/09_03_04 INFO 2
- **상세**: 옛 §9.9 는 "빈 key 행이 object 변환 시 즉시 사라져 '추가' 버튼이 동작하지 않는다"는 문제를 이유로 `Array<{key,value}>` 편집 버퍼를 채택했다. 새 §9.9 는 "키가 메타데이터로 고정되므로 '추가' 버튼 자체가 없어 빈 key 행 문제가 구조적으로 소멸"이라는 근거로 이 결정의 적용 범위가 사라졌음을 선언한다. 이는 기각된 대안의 재도입이 아니라 선결 조건 자체가 제거된 것으로, Rationale 번복이 아닌 Rationale 진부화(obsolescence) 선언이다. 새 §9.9 는 이 사실을 "적용 범위 변경" 단락에서 명시하고 있어 원칙적으로 적절하다. 단, "옛 'object-shaped contract + 편집 버퍼' 패턴은 본 프로젝트에서 더 이상 사용되지 않는다"는 문장이 cafe24 노드에만 한정되는지 아니면 프로젝트 전체에서 선언하는 것인지 독자에 따라 해석이 갈릴 수 있다. http_request 의 headers/queryParams 는 `KeyValue[]` (배열 직렬화)로서 object 변환이 없어 패턴 대상이 아니지만, 문장 표현상 이 점이 명확하지 않다.
- **제안**: "옛 패턴은 본 프로젝트에서 더 이상 사용되지 않는다" 문장 뒤에 "(다른 통합 노드의 headers/queryParams 는 `KeyValue[]` 배열 직렬화로 처음부터 해당 없음)" 등 소괄호 보충을 추가하면 다른 노드 작업자의 혼동을 방지할 수 있다.

---

### 2. [INFO] 옛 §9.9 가 채택한 옵션 기호(A/B)의 재사용 — 의미 불연속 위험 낮음, 단 독자 주의 필요

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.9` 옵션 (A) / (B) 정의
- **과거 결정 출처**: 동일 §9.9 PR #77 원문 — 옛 (A) = "config.fields 를 React state 직접 사용", 옛 (B) = "내부 Array<{key,value}> 편집 버퍼 분리"
- **상세**: 새 §9.9 는 같은 (A)/(B) 기호를 전혀 다른 맥락으로 재정의한다: 새 (A) = "자유 key/value 행 입력 (옛 KeyValueEditor 패턴)", 새 (B) = "메타데이터 기반 동적 폼". 재작성이므로 재정의 자체는 적법하나, CHANGELOG 상에서 PR #77 의 "내부 버퍼 분리" 결정이 §2 에 한 줄로 추가됐다고 기록하고 있고 plan/complete/spec-update-cafe24-fields-ui-buffer.md 도 옛 결정을 "작업 완료"로 마감했기 때문에, 기존 문서를 참조하는 독자가 §9.9 를 읽으면서 옛 (A)→(B) 결정과 새 (A)→(B) 결정을 혼용할 가능성이 있다. 실질적 Rationale 충돌은 없으나 추적 가독성에서 혼동 위험이 존재한다.
- **제안**: §9.9 첫 줄에 "(PR #77 의 편집 버퍼 결정을 대체한다. 이하 (A)/(B) 는 위 PR 의 옵션과 무관한 새 비교 축이다)" 정도의 메모를 추가하면 이력 추적 시 혼동이 방지된다.

---

### 3. [INFO] "호환 키 보존" 결정 — 과거 Rationale 에 충돌 없음, 신규 결정 근거 기록 적절

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.9` 마지막 단락 "호환 키 보존 (Phase 3 추가 결정)" 및 §2 "호환 키 보존" 불릿
- **과거 결정 출처**: 동일 파일 §9.1~§9.8 전체 — 어떤 항목도 operation 변경 시의 fields 처리 정책을 다루지 않았음
- **상세**: "operation 변경 시 교집합 키만 보존, resource 변경 시 전체 reset"이라는 결정은 이 PR 에서 새로 추가되는 신규 결정이다. 과거 Rationale 에 이와 대립하거나 다른 정책을 선언한 항목이 없으므로 기각된 대안의 재도입이나 합의된 원칙 위반에 해당하지 않는다. 결정 배경(사용자가 점진 전환 시 공통 키를 다시 입력하지 않아도 되는 편의)과 trade-off(의미 단절이 큰 resource 변경은 전체 reset)가 §9.9 에 기재되어 있으며 양방향 결정이 모두 설명되어 있다. 또한 review/consistency/2026/05/16/13_09_46/SUMMARY.md INFO 에서 "Phase 4 후속 항목으로 위임"이라고 명시된 spec 갱신이 이 PR 에서 적절히 이행되었다.
- **제안**: 변경 없음. 출처 인용(`review/consistency/2026/05/16/09_03_04/SUMMARY.md`, `review/consistency/2026/05/16/13_09_46/SUMMARY.md`)이 §9.9 말미에 기재되어 있어 추적 가능성이 충분하다.

---

### 4. [INFO] §2 재작성 — §1 config 스키마 및 §4 실행 로직과의 정합성 확인

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §2` 설정 UI, 특히 "호환 키 보존" 불릿, "planned 옵션 노출" 불릿, "Pagination 분기" 불릿
- **과거 결정 출처**: 동일 파일 §1 (config.fields: `Record<string, unknown>`, config.pagination: optional), §4 실행 로직 step 1·5·8
- **상세**:
  - **호환 키 보존** (§2 불릿) — §1 의 `fields: Record<string, unknown>` 계약과 충돌하지 않는다. 교집합 키 보존은 frontend UI 동작이며 backend 계약을 변경하지 않는다. §4 step 5 (requiredFields 검증)가 교집합 누락 시 `CAFE24_MISSING_FIELDS` 로 잡으므로 실행 안전성에도 문제없다.
  - **planned 옵션 표시** (§2 불릿) — §4 step 1 에서 메타데이터 미존재 시 `CAFE24_UNKNOWN_OPERATION` throw 로 정의되어 있고, §2 는 "planned 선택 시 fields/pagination 미렌더"로 사용자가 실행을 시도하지 않도록 유도한다. UI 방어와 실행 에러 양쪽이 일치한다.
  - **Pagination 분기** (§2 불릿) — §1 의 `pagination: object?` (optional)과 정합하며, §4 step 8 ("pagination.{limit, offset, cursor} 는 항상 query") 과 충돌하지 않는다. 미지원 operation 에서 pagination 을 숨기는 것은 spec 초안(§2 mock)에서 이미 의도된 바이다.
  - 정합성 이슈는 발견되지 않는다.
- **제안**: 변경 없음.

---

### 5. [INFO] CHANGELOG "ux-cleanup" 행 — "버퍼 패턴을 완전히 폐기"라는 표현의 정확성

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` "2026-05-16 (ux-cleanup)" 행
- **과거 결정 출처**: 동일 파일 CHANGELOG "2026-05-16 (후속)" 행 — "§9.9 (Fields 편집 UI 의 내부 버퍼 분리) 신설 (PR #62 후속)"으로 옛 §9.9 를 "신설"로 기록
- **상세**: CHANGELOG "ux-cleanup" 행은 "옛 §9.9 의 'object-shaped contract + 편집 버퍼' 패턴은 본 프로젝트에서 더 이상 사용되지 않음을 명시"라고 적고 있다. 이 표현은 `plan/complete/spec-update-cafe24-fields-ui-buffer.md` 에서 "작업 완료"로 처리된 PR #77 의 spec 변경과 본 PR 의 §9.9 재작성 두 단계를 거쳤음을 충분히 추적할 수 있어 허위 기록이 아니다. 다른 §9.x 섹션 (§9.1~§9.8) 에서 "편집 버퍼" 또는 "KeyValueEditor" 를 참조하는 문장은 발견되지 않아 잔존 참조로 인한 혼동 위험도 없다.
- **제안**: 변경 없음.

---

## 요약

Phase 4 의 §2·§9.9 재작성은 Rationale 연속성 관점에서 기각된 대안의 재도입, 합의된 invariant 위반, 근거 없는 결정 번복, 암묵적 가정 충돌 어느 것도 해당하지 않는다. 핵심 전환점인 "옛 Array 버퍼 결정의 소멸"은 선결 조건(KeyValueEditor + 자유 key 입력 UX) 이 Phase 3 구현으로 구조적으로 제거되었음을 올바르게 설명한다. 신규 추가된 "호환 키 보존" 결정도 기존 §1 config 스키마·§4 실행 로직과 충돌하지 않으며 과거 Rationale 의 어떤 항목도 이와 대립하지 않는다. 발견사항 5건 전부 INFO 수준 — 독자 가독성·이력 추적 편의를 위한 문장 보강 제안이며, 구현 또는 spec 적용 차단 사유가 없다.

## 위험도

NONE
