# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 요구사항을 충족하는 순수 프론트엔드 UI 컴포넌트 추가 PR. 보안·아키텍처·부작용 관점에서 중대한 결함은 없으며, WARNING 4건과 INFO 다수가 코드 품질·테스트 명세 일관성 개선 여지를 지적한다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 테스트 명세 일치 | "rapid double-toggle" 테스트 이름과 구현 불일치 — `fireEvent.click` 1회만 호출하면서 "double-toggle" 을 선언 | `multi-select-widget.test.tsx` L259-279 | 테스트 이름을 "single click calls onChange exactly once"로 수정하거나, 실제 두 번 클릭 + 각 결과 어서션 추가 |
| W-2 | 유지보수성 | `rawOptions` 파생 로직이 `SelectWidget`과 `MultiSelectWidget`에 중복 존재 — enum 경로만 다르고 나머지는 동일 | `widgets.tsx` `SelectWidget`, `MultiSelectWidget` | `resolveWidgetOptions(schema, ui, locale)` 헬퍼를 `utils.ts`에 추출해 두 위젯이 공유 |
| W-3 | 테스트 유지보수성 | render 블록이 다수 테스트에 거의 동일하게 반복 — 인터페이스 변경 시 동시 수정 필요 | `multi-select-widget.test.tsx` 전반 | `renderDefault(overrides?)` 헬퍼를 파일 상단에 추출해 공통 render 호출 중앙화 |
| W-4 | 요구사항 (방어) | `schema.items`가 `enum` 없이 `properties`만 갖는 배열-of-objects 케이스에서 빈 체크박스 리스트 렌더 — 현재 사용 케이스(spec §11.1)에는 영향 없으나 향후 잘못된 위젯 배정 시 사일런트 실패 | `widgets.tsx` `MultiSelectWidget` `rawOptions` 계산부 | 옵션이 비어있을 때 경고 로그 또는 placeholder 텍스트 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 테스트 격리 | `beforeEach`에서 전역 Zustand locale store 변이 후 `afterEach` 복구 없음 — `--randomize` 또는 동일 worker pool 실행 시 `en` 상태 누출 가능 | `multi-select-widget.test.tsx` | `afterEach`에서 `useLocaleStore.getState().setLocale("ko")` 추가 |
| I-2 | 코드 품질 | `within` import 미사용 — lint 경고 유발 가능 | `multi-select-widget.test.tsx` | `within` import 제거 |
| I-3 | 보안/타입 안전 | `value` 배열 원소 타입 미검증 — `Array.isArray` 후 `string[]` 캐스팅하나 원소가 객체일 경우 비정상 페이로드 전파 가능 | `widgets.tsx` `MultiSelectWidget` | `value.filter(v => typeof v === 'string')` 적용 |
| I-4 | 보안/환경 노출 | `_retry_state.json`에 로컬 절대 경로 하드코딩 — 공개 저장소 커밋 시 머신·사용자 홈·프로젝트 경로 노출 | `review/consistency/.../_retry_state.json` | `.gitignore`에 `review/**/_retry_state.json` 추가 |
| I-5 | 아키텍처 | `widget-resolver.ts`의 `registry === null` 상태에서 `resolveWidget` 호출 시 silently `undefined` 반환 — 초기화 전 호출 디버깅 어려움 | `widget-resolver.ts` | 개발 환경에서 `registry === null`이면 `console.warn` 또는 `throw` 추가 |
| I-6 | 성능 | `toggle` 함수가 `useCallback` 없이 매 렌더마다 재생성 | `widgets.tsx` `MultiSelectWidget` | (현 상황 영향 없음 — 향후 React.memo 도입 시 검토) |
| I-7 | 일관성 | options 매핑 스타일 불일치 — `SelectWidget`은 `{ ...o, label }` spread, `MultiSelectWidget`은 `{ value, label }` 명시 | `widgets.tsx` | 한 가지 스타일로 통일 |
| I-8 | 테스트 커버리지 | `schema.enum` 폴백(top-level enum, `items` 없음) 케이스 테스트 없음 | `multi-select-widget.test.tsx` | 케이스 테스트 추가 또는 분기 unreachable 주석 |
| I-9 | 테스트 커버리지 | `widget-registry.ts`의 `WIDGET_REGISTRY["multiselect"]` 등록 여부 어서션 없음 | `widget-registry.ts` | (관례 따라 생략 가능) |
| I-10 | 테스트 커버리지 | `required={true}` 전달 시 accessibility 검증 없음 — `CheckboxField`에 `required` 미전달 | `widgets.tsx`, 테스트 | `required` 전달 + 검증 |
| I-11 | 문서화 | `MultiSelectWidget` JSDoc이 특정 노드 사례에 묶여 범용 위젯임을 오해할 여지 | `widgets.tsx` | 첫 단락 범용 설명, 구체 사례는 `@example` |
| I-12 | 문서화 | `UiWidget` 타입에 `multiselect` 예상 schema 구조(array + items.enum) 문서화 누락 | `types.ts` | union 또는 `widget?` 필드 주석 |
| I-13 | 문서화 | 테스트 파일 상단 spec 상대경로 가능성 오류 | `multi-select-widget.test.tsx` L2-4 | 경로 정정 |
| I-14 | 플랜 라이프사이클 | `plan/in-progress/auto-form-multiselect-widget.md` 작업 체크리스트 미갱신 | plan | 완료 항목 `[x]` (단 본 PR 완전 종료 후) |
| I-15 | 플랜 라이프사이클 | `plan/in-progress/spec-update-ai-error-output-fields.md`의 `worktree: (assigned at impl-start)` placeholder | plan frontmatter | 기존 backlog plan 관례 따름 (위반 아님) |

---

## 라우터 결정

`routing_status=done`:
- 실행 8명: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- 제외 6명: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (영역 무관)
