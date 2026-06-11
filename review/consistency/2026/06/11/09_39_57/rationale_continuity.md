# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/14-execution-history.md`
검토 기준 Rationale 출처: 동 파일 `## Rationale` R-1~R-4, `spec/5-system/13-replay-rerun.md ## Rationale`, `spec/2-navigation/1-workflow-list.md ## Rationale`, `spec/0-overview.md ## Rationale` (payload 발췌 기준)

---

## 발견사항

### [INFO] EH-LIST-02 요구사항 텍스트의 "트리거 유형" 표현이 실제 설계(triggerSource)와 불일치

- **target 위치**: `## Overview §3.1` 요구사항 표 EH-LIST-02 (`각 행에 상태, 시작 시간, 소요 시간, 트리거 유형 표시`)
- **과거 결정 출처**: 동 파일 `## Rationale R-2` ("Trigger 출처를 5종 enum 으로 정규화하고 판정 우선순위를 명시한 이유")
- **상세**: R-2 는 원시 `Trigger.type` 을 직접 노출하지 않고 백엔드가 `triggerSource` enum 으로 정규화해 클라이언트에 넘기는 것을 설계 원칙으로 확립했다. 그런데 EH-LIST-02 의 요구사항 텍스트는 여전히 "트리거 유형(trigger type)" 이라는 표현을 쓰고 있어, 이 요구사항을 처음 읽는 독자는 `Trigger.type` 을 그대로 노출하는 것으로 오인할 수 있다. `§2.4 테이블` 의 열 정의와 R-2 는 이미 `triggerSource` / `triggerLabel` 패턴으로 일관되어 있으므로, 요구사항 텍스트만 구식 표현을 유지하는 상태다.
- **제안**: EH-LIST-02 텍스트를 "트리거 출처 표시 (`triggerSource` — 5종 enum, §2.4 Trigger 열)" 로 갱신해 R-2 의 결정과 용어를 맞춘다. Rationale 재작성은 불필요하다.

---

### [INFO] §2.2 Back 링크의 `router.back()` — 직접 진입 시나리오 Rationale 부재

- **target 위치**: `§2.2 헤더` 표 — "Back 링크 | 이전 페이지로 돌아가기 (`router.back()`)"
- **과거 결정 출처**: 해당 없음 (기존 Rationale 어디에도 `router.back()` 채택·기각 결정이 없음)
- **상세**: EH-NAV-01 은 대시보드 Recent Executions 행 클릭 시 실행 상세 페이지(`/workflows/:id/executions/:executionId`)로 직접 이동하도록 정의한다. 이 경로로 진입하면 브라우저 히스토리 스택에 실행 목록 페이지(`/workflows/:id/executions`)가 없으므로 `router.back()` 은 대시보드로 돌아가게 된다 — 실행 목록 링크로 동작하지 않는다. 이것이 **의도된 동작**(이전 어느 화면이든 돌아간다)이라면 Rationale 이 없는 상태이고, 실행 목록으로의 고정 링크가 필요하다면 설계 변경이 필요하다. 기각된 Rationale 의 재도입은 아니지만, 명시적 결정 근거 없이 UX invariant 가 모호한 상태다.
- **제안**: §2.2 헤더 표 비고 또는 Rationale 에 "Back 링크는 browser history stack 기반(`router.back()`) — 실행 목록 고정 링크 대신 이전 어떤 화면으로든 돌아가는 것이 의도" 임을 명기하거나, 또는 실행 상세 헤더(`§3.1`)의 "← Executions" 링크처럼 고정 경로 링크로 통일하는 방향을 결정한다. 현재 §3.1 의 상세 페이지 헤더는 "← Executions" (실행 목록 고정 링크 형태)인데, §2.2 의 목록 페이지 헤더는 `router.back()` 이라는 비대칭이 관찰된다.

---

## 명시적으로 기각된 대안 재도입 없음 확인

| 점검 항목 | 결과 |
|-----------|------|
| 단일 `LLM Information` 탭 아래 하위 탭 구조 (R-3 에서 기각) | 재도입 없음. §3.4.2 는 평탄화 구조를 정확히 따른다. |
| 목록 API 에 `nodeExecutions` 포함 (R-1 에서 기각) | 재도입 없음. §5 API 표와 §2.4 Nodes 열 모두 배치 집계 3카운트 패턴을 따른다. |
| 클라이언트별 triggerSource 독립 판정 (R-2 에서 기각) | 재도입 없음. 백엔드 정규화 + `triggerSource`/`triggerLabel` 응답 패턴이 유지된다. |
| Skipped 노드 상세 목록 표시 (R-4 에서 기각) | 재도입 없음. §3.3 은 skipped 제외를 명확히 정의한다. |
| Re-run 설계 결정 (13-replay-rerun.md Rationale 에서 기각된 A1·B1·C2·D2·G2) | 재도입 없음. §3.7 은 화면 배치만 정의하고 설계 결정 SoT 를 13-replay-rerun.md 로 명시 위임한다. |

---

## 요약

`spec/2-navigation/14-execution-history.md` 는 기존 Rationale 에서 명시적으로 기각된 대안(중첩 LLM 탭, 목록 API nodeExecutions 포함, 클라이언트 측 triggerSource 판정, Skipped 노드 표시)을 어디서도 재도입하지 않으며, Re-run/chain 관련 설계 결정 SoT 도 올바르게 13-replay-rerun.md 로 위임한다. 발견된 항목은 모두 INFO 수준으로, (1) EH-LIST-02 요구사항 텍스트가 R-2 에서 확정된 `triggerSource` 개념 대신 구식 "트리거 유형" 표현을 유지하는 용어 불일치, (2) 목록 페이지 Back 링크가 `router.back()` 을 사용하는 이유가 Rationale 에 부재한 것이다. 두 항목 모두 합의된 설계 원칙을 위반하거나 기각된 대안을 부활시키는 성격이 아니며, 문서 명확성 개선 제안에 해당한다.

---

## 위험도

LOW
