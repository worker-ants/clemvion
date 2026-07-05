# RESOLUTION — G-1-remaining 전체 (18 resource, 485 op field-set docs 미러)

## 조치 항목

| SUMMARY # | 심각도 | 조치 | 상태 |
|---|---|---|---|
| CRITICAL 1 | requirement | **docs 필수(✓) ⊄ requiredFields 계약 결함**. (1) 신규 전수 가드 `catalog-required-fields.spec.ts` — 485 op 각각 docs Request 표 `필수(✓)` ∩ fields ⊆ requiredFields 검증. (2) 가드가 검출한 **262건 전량 codemod 로 보강**(requiredFields = 기존 ∪ docs-필수∩fields). mileage_grant/points_autoexpiration_create/sms_send 포함 15 resource. | ✅ 가드 green |
| WARNING 1 | requirement | mileage_grant `type` 가 docs 필수인데 requiredFields 누락(+default 제거로 느슨) → 위 codemod 로 `type` requiredFields 추가(docs 필수라 default 불요). | ✅ |
| WARNING 4 | testing | requiredFields 완화 미검증 → 신규 가드가 "docs 필수보다 느슨해짐"을 전수 차단. | ✅ |
| WARNING 5 | documentation | 7개 파일 module docstring 누락 → notification·order·privacy·salesreport·store·supply 6개에 G-1 규약 docstring 추가(customer 는 기존 보유). | ✅ |
| WARNING 3 | testing | 리소스별 타깃 테스트 편중 → 신규 `catalog-required-fields.spec`(requiredness 전수) + 기존 `catalog-docs-drift.spec`(method/path/scope 전수) + `metadata.spec`(§5.2/enum/subset/placeholder 전수)가 **전 18 resource 를 구조·계약 양면 커버**. product-fields.spec 는 대표 예시로 유지. 개별 리소스별 field-content 스냅샷은 저가치(가드가 회귀 차단)로 미추가. | ✅ 가드로 커버 |
| WARNING 2 | side_effect | 필드명/타입 변경(page_path→path, since→created_start_date, category_no→category, script_no number→string)의 저장된 워크플로 config 하위호환 | **수용/문서화**: 교체 대상은 전부 **비동작 alias**(Cafe24 가 인식 못 해 무시하던 필드) — 실기능 회귀 아님. 핸들러는 unknown field 를 drop 하므로 구 config 도 안전 degrade. 별도 마이그레이션 불요. spec 예시 동기화는 planner 태스크(task_28baf9cb) 등록. |
| INFO 6 | maintainability | salesreport 만 date 상수 인라인화 | 무시 — salesreport 필드는 start_date/end_date(created/updated 아님)라 공용 상수 부적용, SINCE/UNTIL 제거 후 §5.2 준수 인라인. |
| INFO 4/5/others | maint/doc | 스타일 혼재·JSDoc 중복·PII 필드 확장 | 무시 — 기존 컨벤션 연장, 기능 영향 없음. restrictedApproval 은 전 op 보존(catalog-drift green). |

미기록 reviewer: `scope` output 파일 write-block(세션 미isolate). 커버리지: side_effect(순수 데이터·범위 이탈 없음 확인)+plan §G-1-remaining 지시 일치로 대체. 앞선 product 라운드 scope reviewer 는 NONE(plan 일치) 확정.

## TEST 결과

- lint: 통과
- unit: cafe24 221 pass(handler/mcp/metadata) + metadata 117 pass(신규 catalog-required-fields 가드 포함). 전체 backend unit green. **전체 suite 유일 실패=본 PR 무관 pre-existing** frontend Gate C(`plan/complete/spec-code-cross-audit-2026-06-10.md`, #825 — planner 태스크 task_550ec516).
- build: 통과
- e2e: **면제** — metadata-only(handler/infra 로직 무변경), cafe24 e2e 는 OAuth precheck/install 만·변경 op/필드 미참조(#816 선례).

## 보류·후속 항목
- `4-cafe24.md` spec 예시 필드명 동기화 = planner 태스크 task_28baf9cb.
- Gate C spec_impact(#825 무관 pre-existing) = planner 태스크 task_550ec516.
