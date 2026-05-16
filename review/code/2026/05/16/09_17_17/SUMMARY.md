# Code Review 통합 보고서

> 세션: `review/code/2026/05/16/09_17_17`
> 대상: Cafe24 Fields 편집 버퍼 도입 (`fix(node-configs/cafe24): keep newly added fields rows visible`)
> 리뷰어: 13개 전원 완료 (pending 0 / fatal 0)

## 전체 위험도

**LOW** — 기능 동작은 올바르게 수정되었으며 Critical 위험 없음. 렌더 중 `setState` 패턴의 잠재적 무한 루프 가능성과 테스트 커버리지 갭이 주요 개선 포인트.

## Critical 발견사항

없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 / 아키텍처 | 렌더 본문에서 `setState` 직접 호출 — 부모가 매 렌더마다 새 참조 객체를 `config.fields`로 전달하면 `objectsEqual`이 항상 `false`를 반환해 `Too many re-renders` 오류로 이어질 수 있음. | `integration-configs.tsx` — `Cafe24Config` | 참조 기반 추적으로 전환 (`lastSeenFields !== config.fields`) 하거나 `useEffect`로 동기화 |
| 2 | 테스팅 | undo/redo(외부 config 재설정) 경로에 대한 테스트 없음 | `cafe24-config.test.tsx` | `rerender`로 상이한 `config.fields` 주입 테스트 추가 |
| 3 | 테스팅 | 삭제 버튼 탐색 로직이 DOM 구조에 강하게 결합 | `cafe24-config.test.tsx` — "removes a row" | `KeyValueEditor` 삭제 버튼에 `aria-label` 추가 후 명시적 셀렉터 사용 |
| 4 | 테스팅 | `objectsEqual` / `fieldRowsToObject` / `normalizeCafe24Fields` 순수 함수 단위 테스트 없음 | `integration-configs.tsx` 헬퍼 함수들 | 함수를 named export로 노출해 독립 단위 테스트 작성 |
| 5 | 테스팅 | `normalizeCafe24Fields` 의 배열 입력 / 잘못된 입력 경로 미검증 | `integration-configs.tsx` | 배열·null·primitive 입력 케이스 추가 |
| 6 | 유지보수성 | 행 제거 테스트의 이중 폴백 쿼리 패턴 | `cafe24-config.test.tsx` | 단일 명확한 쿼리 전략으로 통일 |

## 참고 (INFO)

상세 20건은 각 reviewer review.md 참고. 핵심:
- `lastPropagated` → `useState` vs `useRef` 선택 (INFO 4): 참조 비교 채택 시 useState 유지
- 중복 키 last-write-wins 동작이 spec/주석에 미기록 (INFO 5): 주석으로 명시
- `plan/in-progress/cafe24-fields-add-button-fix.md` 체크박스 완료 후 `complete/` 이동 (INFO 9)
- 로컬 store 원상복구 누락 (INFO 14)
- `objectsEqual` 의 `String()` 강제 변환에 따른 타입 모호성 (INFO 11)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 모두 INFO. 시크릿/계약 변경 없음 |
| performance | NONE | `objectsEqual` 매 렌더 실행 — 현 규모 영향 미미 |
| architecture | LOW | 렌더 중 setState, 세 책임 혼재 (WARNING) |
| requirement | LOW | 정책 미명세 등 INFO 7건 |
| scope | NONE | 변경 범위 적절 |
| side_effect | LOW | locale 원상복구 누락 (INFO) |
| maintainability | LOW | 파생 상태 패턴, 테스트 이중 폴백 (WARNING) |
| testing | LOW | undo/redo 미검증, DOM 결합, 헬퍼 단위 테스트 없음 (WARNING) |
| documentation | LOW | JSDoc 누락 (INFO) |
| dependency | NONE | 신규 의존성 없음 |
| database | NONE | 해당 없음 |
| concurrency | LOW | 렌더 중 setState 잠재 무한 루프 (WARNING) |
| api_contract | NONE | 백엔드 계약 유지 |

## 권장 조치

1. 렌더 중 setState 패턴 → 참조 기반 추적으로 리팩토링
2. KeyValueEditor 삭제 버튼에 aria-label 추가
3. undo/redo · 배열 입력 · 헬퍼 함수 단위 테스트 추가
4. JSDoc, last-write-wins 명시
5. locale store afterEach 원상복구
6. plan 파일 `complete/` 이동
