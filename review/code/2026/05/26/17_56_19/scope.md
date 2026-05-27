# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [WARNING] 테스트 파일 — 사용되지 않는 `within` 임포트
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/multi-select-widget.test.tsx` 라인 2
- 상세: `import { render, screen, fireEvent, within } from "@testing-library/react"` 에서 `within` 이 임포트됐으나 테스트 본문 어디에도 사용되지 않는다. 8개의 테스트 케이스 전체를 확인했으나 `within(...)` 호출이 없다.
- 제안: `within` 을 임포트 목록에서 제거하거나, 혹은 실제로 사용하는 테스트 케이스가 의도적으로 제외됐다면 해당 케이스를 추가할 것.

### [INFO] `review/consistency/2026/05/26/17_18_37/` 하위 파일 포함 — 본 PR 의도와 직접 관련성 검토
- 위치: 파일 7(`_retry_state.json`), 파일 8(`convention_compliance.md`), 파일 9(`cross_spec.md`), 그리고 나머지 consistency review 산출물들
- 상세: 이 파일들은 `--impl-prep` 사전 검토 세션의 산출물로, `plan/in-progress/auto-form-multiselect-widget.md` 배경 절에서 명시적으로 참조된다. 본 PR 의 "무관한 수정" 범주에 해당하지 않는다 — consistency check 산출물은 `CLAUDE.md` 에 따라 `review/consistency/**` 에 기록해야 하며, 이 PR 의 전제 조건 증거로서 함께 커밋되는 것이 프로젝트 규약에 부합한다.
- 제안: 조치 불필요. 의도된 범위 내.

### [INFO] `plan/in-progress/spec-update-ai-error-output-fields.md` — multiselect widget 범위 외 plan 신규 생성
- 위치: 파일 6
- 상세: 본 작업(multiselect widget 구현)과 무관한 spec 결함 보강 plan 이 함께 커밋됐다. 그러나 `plan/in-progress/auto-form-multiselect-widget.md` 에 "별도 plan 으로 이관 후 본 작업 진행" 결정이 기록되어 있고, 이 파일은 consistency check BLOCK 사유(무관한 spec 결함)를 추적하는 파일이다. 두 plan 을 함께 커밋하는 것은 CLAUDE.md 계획 추적 규약상 정상이며 분리된 변경이 없다.
- 제안: 조치 불필요. plan 파일 생성은 developer 쓰기 권한 범위(`plan/**`) 내.

### [INFO] `MultiSelectWidget` 구현에서 `schema.enum` 도 처리하는 이중 폴백 — 요청 범위 초과 여부 확인
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx` 라인 846-851 (diff 기준)
- 상세: `rawOptions` 산출 시 `schema.items?.enum` 뿐 아니라 `schema.enum` (flat enum) 폴백도 처리한다. `plan/in-progress/auto-form-multiselect-widget.md` 의 변경 set 정의에는 이 폴백에 대한 명시가 없으나, `SelectWidget` 과의 일관성 유지 및 방어적 처리 관점에서 합리적인 추가다. 테스트 `"falls back to schema items.enum when ui.options is absent"` 가 이를 명시적으로 커버한다.
- 제안: 조치 불필요. 폴백 로직은 `SelectWidget` 패턴과 일관되며 over-engineering 수준이 아니다.

---

## 요약

변경 범위 관점에서 이번 PR 은 전반적으로 의도된 범위를 잘 준수한다. 4개 핵심 파일(types.ts, widgets.tsx, widget-registry.ts, 테스트 파일)의 변경은 plan 에서 예고한 변경 set 과 1:1 대응되며, 추가 리팩토링이나 무관한 코드 영역 수정은 없다. 유일한 실질 문제는 테스트 파일의 `within` 미사용 임포트로, 코드 품질에는 경미한 영향이나 lint/CI 에서 오류를 유발할 수 있다. 나머지 파일(consistency review 산출물, 분리된 plan 파일)은 프로젝트 규약에 따른 정상 범위 내 포함이다.

## 위험도

LOW
