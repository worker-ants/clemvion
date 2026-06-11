# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/2-navigation/14-execution-history.md`
**검토 일시**: 2026-06-11
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [INFO] `executionPath` 필드가 목록 API 응답 샘플에 포함됨

- **target 위치**: §5 목록 API 응답 JSON 샘플 (`"executionPath": []`)
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution` 주석 ("옛 `execution_path UUID[]` 컬럼은 V036 에서 DROP")
- **상세**: DB 컬럼은 V036 에서 삭제됐지만 DTO 응답 시그니처 `executionPath: string[]` 는 유지되며 `findById` 가 `ExecutionNodeLog` 정렬 쿼리로 채운다. target Rationale R-1 도 "목록 응답에서는 항상 빈 배열" 로 이 동작을 명시한다. 모순은 없으나 목록 응답에 `executionPath: []` 가 포함된 이유가 샘플만 봐서는 불명확하다 — Rationale R-1 이 설명하고 있어 문서 내적으로 일관성이 있다.
- **제안**: 현재 서술로 충분. 별도 변경 불필요.

### [INFO] Re-run 버튼 disabled tooltip — i18n 키 참조 vs 인라인 텍스트 방식 차이

- **target 위치**: §3.7 표 `[⟳ Re-run]` 버튼 행 ("tooltip `history.rerun.permissionDenied`")
- **충돌 대상**: `spec/5-system/13-replay-rerun.md §10.1 진입점` 표 ("버튼 disabled + tooltip `Re-run 권한이 없습니다 (정책 RR-PL-06)`")
- **상세**: target 은 i18n 키로 참조하고, Re-run spec §10.1 은 번역된 텍스트를 직접 기술한다. `spec/5-system/13-replay-rerun.md §10.4` 의 i18n 표가 `history.rerun.permissionDenied` = "Re-run 권한이 없습니다 (정책 RR-PL-06)" 로 매핑하므로 실질적 모순은 없다. 표현 방식만 다를 뿐 동일한 내용이다.
- **제안**: 의미 충돌 없음. 두 문서를 같은 방식(둘 다 i18n 키 또는 둘 다 인라인 텍스트)으로 동기화하면 향후 편집 시 혼선이 줄어든다.

### [INFO] Re-run 모달 §10.2 원본 ID 클릭 동작 — "새 탭 열기" vs "같은 탭 이동" 불일치

- **target 위치**: §3.7 표 Chain badge 행 ("원본 ID 클릭 시 같은 탭에서 원본 상세로 이동 (`<Link href>`, `target=_blank` 없음)")
- **충돌 대상**: `spec/5-system/13-replay-rerun.md §10.2 Re-run 모달` 표 원본 실행 헤더 행 ("ID 클릭 시 **새 탭**으로 원본 상세 페이지")
- **상세**: target §3.7 은 실행 상세 페이지의 chain badge 에서 원본 ID 클릭 시 "같은 탭"으로 이동한다고 명시한다. Re-run spec §10.2 는 모달 내 원본 실행 헤더의 ID 클릭이 "새 탭"으로 이동한다고 명시한다. 두 위치(chain badge vs 모달 원본 헤더)가 서로 다른 클릭 맥락이므로 서로 다른 동작을 의도할 수 있으나, 표현이 모호해 구현자가 혼동할 여지가 있다.
- **제안**: Re-run spec §10.2 의 "새 탭" 동작이 모달 내 전용이고 chain badge 의 "같은 탭" 동작이 페이지 내 네비게이션임을 각 문서에 명시적으로 구분 표기하는 것을 권장. 두 동작이 의도적으로 다르다면 Rationale 에 그 이유를 추가할 것.

---

## 요약

`spec/2-navigation/14-execution-history.md` 는 데이터 모델(`spec/1-data-model.md §2.13 Execution`), Re-run 정책(`spec/5-system/13-replay-rerun.md`), API 규약(`spec/5-system/2-api-convention.md`), 워크플로우 목록(`spec/2-navigation/1-workflow-list.md §2.6`), AI Assistant 도구 정의(`spec/3-workflow-editor/4-ai-assistant.md §10.9`)와 전반적으로 일관성이 있다. Execution 상태 enum(pending/running/completed/failed/cancelled/waiting_for_input), NodeExecution 상태(skipped 포함), Re-run 관련 API 엔드포인트 계약, 요구사항 ID(EH-LIST/EH-DETAIL/EH-NAV) 네임스페이스 충돌 없음이 확인됐다. CRITICAL 또는 WARNING 등급의 충돌은 발견되지 않았으며, Re-run 모달 내 원본 ID 클릭("새 탭")과 chain badge 의 원본 ID 클릭("같은 탭") 간 동작 차이가 두 문서 간 표현 불일치로 존재하나 맥락이 달라 의도적 설계일 가능성이 높다.

---

## 위험도

LOW
