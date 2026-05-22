# Requirement Review — trigger-history-dialog (PR #265 follow-up)

리뷰 대상 커밋: `244d3862639ea6a463a512786b17794cfc1ba47c`
Spec 기준 문서: `spec/2-navigation/2-trigger-list.md §2.1` + Rationale R-6

---

## 발견사항

### [INFO] plan 파일의 체크박스가 미완료(`[ ]`) 상태로 커밋됨
- 위치: `plan/in-progress/trigger-row-history-dialog.md` 라인 16, 21
- 상세: 모든 작업 항목이 `[ ]`(미완료)로 체크되지 않은 채 커밋되어 있다. 코드는 실제로 완성되었으나 plan 파일이 완료 상태를 반영하지 않는다. 또한 파일이 `plan/in-progress/`에 남아 있어 `plan/complete/`로 이동되지 않았다.
- 제안: 모든 체크박스를 `[x]`로 갱신하고 `git mv`로 `plan/complete/trigger-row-history-dialog.md`로 이동하거나, 해당 작업을 후속 PR에서 처리.

### [INFO] plan 파일의 state 명칭이 구현과 미세하게 다름
- 위치: `plan/in-progress/trigger-row-history-dialog.md` 라인 22 vs `page.tsx` 라인 90
- 상세: plan은 `historyTrigger`로 표기했으나, 실제 구현의 state 변수명은 `historyTarget`이다. 의미상 동일하지만, plan ↔ 코드 traceability 관점에서 불일치.
- 제안: plan 파일을 완료 처리할 때 `historyTarget`으로 정정. spec은 state 명을 직접 명시하지 않으므로 CRITICAL 사항은 아님.

### [INFO] 스펙 §2.3의 "최근 호출 이력" 항목이 "응답 코드"도 포함하나 Dialog에서는 표시하지 않음
- 위치: `spec/2-navigation/2-trigger-list.md §2.3` (트리거 상세 패널) vs `trigger-history-dialog.tsx` 라인 99–121
- 상세: spec §2.3은 상세 패널의 "최근 호출 이력" 섹션에 대해 "최근 10건의 호출 시각, 상태(성공/실패), **응답 코드**"를 정의한다. 그러나 이 spec 항목은 detail drawer(`§2.3`) 전용이며, dialog는 §2.1 + Rationale R-6에서 "Recent Calls 만" 빠르게 보는 컴포넌트로 분리 정의됐다. Rationale R-6은 dialog의 필드 집합을 명시적으로 열거하지 않고 "Recent Calls 만"이라는 개념만 언급한다. 따라서 응답 코드 미노출이 spec 위반인지는 R-6의 침묵 영역에 해당.
- 제안: Rationale R-6 또는 §2.1에 dialog가 표시하는 필드(시각·상태 Badge)를 명시적으로 열거해 "응답 코드 표시 여부" 회색지대를 해소. spec 수정은 `project-planner` 위임.

### [INFO] `TriggerHistoryEntry.status` 타입이 `string`으로 열린 타입 — spec의 상태값 열거형과 불일치 가능
- 위치: `trigger-history-dialog.tsx` 라인 20
- 상세: `status: string`은 어떤 값도 허용한다. spec §2.3은 "성공/실패"로만 언급하나, 실제 API 응답에서 `"pending"`, `"running"`, `"cancelled"` 등 추가 상태가 올 경우 Badge variant 분기(`"success"` / `"error"|"failed"` / `"outline"`)에서 `"outline"`로 처리된다. UX 상 예측 불가한 상태값을 사일런트하게 중립 배지로 표시하는 것이 의도적 설계인지 미명시.
- 제안: 알려진 상태값은 union 타입(`"success" | "failed" | "error" | "running" | "pending"`)으로 제한하거나, `TriggerHistoryEntry.status`를 실행 상태 열거형으로 분리. 단, API 응답 shape가 spec에 명시되어 있지 않으므로 INFO 등급.

### [INFO] `onOpenFullDetail` 콜백 내 state 갱신 순서 — dialog close 후 drawer open
- 위치: `page.tsx` 라인 126–133
- 상세: `onOpenFullDetail` 콜백은 `setHistoryTarget(null)` 후 `setSelectedTriggerId(id)`를 동기적으로 순서 실행한다. React 18의 자동 배치(auto-batching)로 두 setState가 동일 렌더 사이클에서 처리되어 dialog 닫힘 애니메이션과 drawer 열림 애니메이션이 겹칠 수 있다. 스펙 Rationale R-6은 "dialog를 닫고 drawer를 연다"는 흐름만 기술하며 애니메이션 겹침에 대해 침묵. 현 구현이 기능적으로는 올바르나 UX 전환이 자연스럽지 않을 수 있음.
- 제안: Dialog의 `onAnimationEnd`/`onClose` 완료 후 drawer를 여는 방식으로 개선을 검토할 수 있으나, spec이 이를 요구하지 않으므로 INFO 수준.

---

## Spec Fidelity 점검 요약

| Spec 요구사항 | 구현 상태 |
|---|---|
| §2.1 — 호출 이력: 별도 Dialog | 충족 (`TriggerHistoryDialog`, `Dialog` 컴포넌트 사용) |
| §2.1 — 메타·인증·EIA·Schedule 카드 미노출 | 충족 (dialog는 Recent Calls list만 렌더) |
| §2.1 — 모든 역할 가시 | 충족 (role gate 없이 모든 사용자에게 menu item 노출) |
| §3 — `GET /api/triggers/:id/history` | 충족 (정확한 endpoint 호출) |
| Plan — limit=10 | 충족 (`params: { limit: 10 }`) |
| Plan — queryKey 분리 (`["trigger-history-dialog", id]`) | 충족 |
| Plan — 푸터 "전체 상세 보기" (onOpenFullDetail 조건부) | 충족 |
| R-6 — dialog 닫고 drawer 오픈 흐름 | 충족 |
| i18n 5키 KO/EN parity | 충족 (title/empty/loadFailed/viewFullDetail/close 모두 확인) |
| 테스트 6케이스 (타이틀 interp, empty, 정상, endpoint, onOpenFullDetail 조건부, 로딩) | 충족 |

---

## 요약

코드 변경은 spec §2.1 + Rationale R-6이 요구하는 "상세 보기(drawer) vs 호출 이력(별도 Dialog)" 분리를 정확하게 구현했다. TriggerHistoryDialog는 Recent Calls만 표시하며, 올바른 API endpoint(`GET /api/triggers/:id/history?limit=10`)를 호출하고, "전체 상세 보기" 콜백으로 drawer 승격 흐름도 구현됐다. i18n KO/EN parity, 테스트 커버리지도 plan 요구사항을 충족한다. CRITICAL 또는 WARNING 수준의 spec 불일치는 발견되지 않았다. 발견된 4건은 모두 INFO 수준으로 plan 파일 관리 누락, state 명 미세 불일치, spec의 회색지대(dialog 표시 필드 범위·응답 코드 미노출), 애니메이션 전환 UX 개선 가능성이다.

---

## 위험도

LOW
