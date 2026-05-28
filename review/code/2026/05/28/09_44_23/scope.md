# 변경 범위(Scope) 리뷰 — integration-activity-api-label

리뷰 일시: 2026-05-28
리뷰 대상: 41개 파일 (파일 1–41, backend + frontend + spec + plan + review artifacts)
의도된 범위 출처: `plan/in-progress/integration-activity-api-label.md`

---

## 발견사항

발견된 범위 이탈, 불필요한 리팩토링, 과도한 기능 확장, 무관한 수정, 포맷팅 오염, 불필요한 주석·임포트·설정 변경이 **없음**.

### [INFO] `spec/5-system/11-mcp-client.md` — 파일 39, 범위 내 추가

- 위치: `spec/5-system/11-mcp-client.md §8.3` IntegrationUsageLog 필드 테이블 확장
- 상세: plan 의 "Backend" 목록에는 명시되지 않았으나 consistency-check `SUMMARY.md` 에서 W4 로 식별된 누락이 본 PR 에서 동일 세션 안에 해소된 것. spec 갱신 범위이며 project-planner 위임 결과물이다. 새 3컬럼을 §8.3 테이블에 추가하는 것은 해당 컬럼이 MCP Bridge 경로에도 적용된다는 cross-spec 정합화로, 의도된 범위 내 변경이다.
- 제안: 없음.

### [INFO] `review/consistency/2026/05/28/09_07_26/` (파일 23–30) — 범위 내 아티팩트

- 위치: `review/consistency/` 하위 8개 파일
- 상세: CLAUDE.md 규약에 따라 `--impl-prep` consistency-check 산출물이 `review/consistency/` 에 저장된다. 이 파일들은 코드 변경 아티팩트가 아닌 리뷰 인프라 아티팩트이다. 포함이 적절하다.
- 제안: 없음.

---

## 범위 이탈 8개 항목 점검 결과

| 점검 항목 | 결과 |
|---|---|
| 의도 이상의 변경 | 없음 — 41개 파일 전부 plan §변경 범위 내 |
| 불필요한 리팩토링 | 없음 — 신규 `clampApiField` 함수·`extractSqlVerb`·`extractApiPath` 모두 INT-US-05 직접 구현 |
| 기능 확장 (over-engineering) | 없음 — catalog endpoint, `renderApiCell`, `tryTranslateLabel` 모두 plan 에 명시된 항목 |
| 무관한 수정 | 없음 — 수정된 모든 섹션이 api 식별 3컬럼 또는 catalog endpoint 와 직접 연결 |
| 포맷팅 변경 오염 | 없음 — 공백·줄바꿈 변경이 실질 변경과 분리돼 있지 않으나, 포맷팅만의 변경은 발견되지 않음 |
| 불필요한 주석 변경 | 없음 — 추가된 모든 JSDoc/인라인 주석이 INT-US-05 또는 spec 참조를 직접 설명 |
| 임포트 변경 | `listAllCafe24Operations`, `OperationCatalogDto` 등 신규 기능에 필요한 임포트만 추가됨 |
| 설정 파일 변경 | 없음 |

---

## 요약

변경 범위 관점에서 본 PR 은 매우 절제된 구현 범위를 유지하고 있다. 41개 파일 전부가 `plan/in-progress/integration-activity-api-label.md` 의 "변경 범위" 절에 직접 열거되거나, consistency-check 에서 파생된 spec 정합화 항목으로 추적 가능하다. 기존 코드의 불필요한 정리, 요청하지 않은 기능 확장, 무관한 파일 수정이 전혀 없으며, 포맷팅 오염이나 스타일 전용 변경도 발견되지 않았다. INFO 2건은 범위 이탈이 아닌 "plan 목록에 명시되진 않았으나 동일 세션 내 필요한 정합화"임을 확인한 것이다.

---

## 위험도

NONE

---

## 이슈 카운트

| 등급 | 건수 |
|---|---|
| CRITICAL | 0 |
| WARNING | 0 |
| INFO | 2 |
| **합계** | **2** |
