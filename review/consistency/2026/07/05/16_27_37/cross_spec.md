# Cross-Spec 일관성 검토 — target: `spec/2-navigation/` (초점: `14-execution-history.md` EH-DETAIL-03 §3.3/§3.4)

검토 모드: --impl-prep (구현 착수 전). 배경: `execution-detail` 페이지가 에디터의 `ResultDetail` 컴포넌트를 재사용해 Config·LLM Usage·메시지 레벨(Response/Request/LLM Usage) 서브탭을 추가하는 구현(V-05, `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 기재) 착수 전 검토. spec 변경 없음 — 이미 ✅ 로 표시된 spec 을 코드가 뒤늦게 따라잡는 케이스.

## 발견사항

- **[WARNING]** 노드 레벨 기본 선택 탭 규칙이 `3-workflow-editor/3-execution.md` §10.6.1 대비 단순화되어 있어 구현 시 우선순위 세부사항이 누락될 위험
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.3 "기본 선택 탭: 에러면 Error, outputData가 있으면 Preview, 그 외 Output"
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §10.6.1 "디폴트 탭 선택 우선순위" (라인 506-519) — 동일한 `ResultDetail`/`NodeResultsTab` 재사용 대상 컴포넌트의 SoT 격 서술
  - 상세: 에디터 spec 은 (1) Error 최우선, (2) Preview(Presentation outputData 존재 또는 AI 대화형/Form/버튼 대기), (3) 그 외 Output — 세 단계 우선순위에 더해 **"AI multi-turn retryable error 종결 시 예외"**(에러가 있어도 `port:'error'` + `retryable===true` 이면 Error 대신 Preview 우선, 대화 스레드 안 `[다시 시도]` 버튼 노출)와 **"선택된 탭이 이후 숨겨지면 Preview 또는 남은 첫 탭으로 자동 폴백"** 규칙을 명시한다. 실행 내역 문서의 §3.3 은 이 두 세부 규칙(retryable-error 예외, 자동 폴백)을 언급하지 않고 "에러면 Error"로만 단순화했다 — 문언 그대로 읽으면 실행 내역 페이지에서는 AI multi-turn retryable 에러 발생 시에도 Error 탭이 기본 선택되는 것으로 오독될 수 있다. 두 문서가 "동일 컴포넌트 재사용"을 전제(§3.3 서두, EH-DETAIL 표)로 하므로 이 누락은 구현자가 에디터 쪽 세부 규칙을 놓치고 단순화된 3단계만 구현할 위험을 만든다.
  - 제안: target 구현 시 3-execution.md §10.6.1 의 retryable-error 예외 및 탭-숨김 시 폴백 규칙까지 함께 포팅할 것. 구현 완료 후에는 `14-execution-history.md` §3.3 문구도 "디폴트 탭 규칙은 [3-execution §10.6.1] 참조 — 동일 컴포넌트 공유" 식으로 참조를 추가하거나 규칙을 동일 수준으로 상세화해 두 문서가 향후 다시 벌어지지 않도록 project-planner 후속 정정 권장(코드 변경 아님, 구현 직후 spec 동기화 항목).

- **[INFO]** Config 탭 표시 조건 문구가 두 문서에서 미세하게 다름
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.3 "Config (노드 레벨에서 항상)" — 표시 조건에 대한 별도 단서 없음
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §10.6.1 표 "Config | 노드 레벨에서 항상 | 노드 핸들러가 echo한 실행 시 config(새 출력 shape 적용 노드만). 미지원 노드는 안내 메시지"
  - 상세: 에디터 spec 은 Config 탭이 "항상" 표시되지만 콘텐츠는 "새 출력 shape 적용 노드만" 실제 config 를 보여주고 그 외에는 "미지원 노드는 안내 메시지"를 표시한다고 명시한다. 실행 내역 문서는 이 미지원-노드 안내 메시지 분기를 언급하지 않는다. 실질적 모순은 아니나(탭 자체는 "항상" 이라는 점은 두 문서 모두 동일), 구현자가 실행 내역 페이지에서 미지원 노드의 Config 탭에 빈 화면을 두거나 별도 처리를 빠뜨릴 여지가 있다.
  - 제안: 공용 컴포넌트를 그대로 재사용하는 구현이라면 이 안내 메시지 분기도 자연히 함께 따라올 것 — 별도 조치 불필요. 다만 재사용이 아니라 부분 포팅(래핑)이라면 이 분기를 누락하지 않도록 구현 체크리스트에 명시 권장.

- **[INFO]** 상태 enum·트리거 소스 등 나머지 데이터/전이 모델은 완전히 일치
  - target 위치: `spec/2-navigation/14-execution-history.md` §2.4/§5, `spec/2-navigation/0-dashboard.md` §5
  - 충돌 대상: `spec/1-data-model.md` §2.13 Execution.status(6종: pending/running/completed/failed/cancelled/waiting_for_input), §2.14 NodeExecution.status(7종, `skipped` 포함)
  - 상세: target 이 참조하는 status enum·아이콘 매핑·`triggerSource` 5종 분류(§2.4 Trigger 출처 분류, R-2)는 `1-data-model.md`, `4-execution-engine.md`, `data-flow/10-triggers.md` 의 내부 마커(`__triggerSource` 3종)와 명확히 별개 식별자임을 target 자신이 이미 Rationale(R-2)로 명시해 구분해 두었다. 충돌 없음 — 참고용으로만 기재.
  - 제안: 조치 불필요.

## 요약

target(`spec/2-navigation/` 전 영역, 특히 `14-execution-history.md` EH-DETAIL-03 §3.3/§3.4)은 이미 `status: implemented`·요구사항 ✅로 확정된 spec 이며, 이번 구현은 그 spec 의도를 코드가 뒤늦게 따라잡는 것(V-05, spec 변경 없음)이다. 데이터 모델(Execution/NodeExecution status enum), API 계약(목록/상세 endpoint, Re-run/Chain), 트리거 출처 분류, RBAC(해당 없음 — 표시 전용 기능) 등 핵심 축에서는 다른 영역 spec 과 모순이 없다. 다만 구현이 재사용을 명시한 대상인 `spec/3-workflow-editor/3-execution.md` §10.6.1(에디터 `result-detail.tsx` 탭 명세)과 비교했을 때, `14-execution-history.md` §3.3 의 "기본 선택 탭" 규칙이 에디터 spec 이 규정하는 AI multi-turn retryable-error 예외와 탭-숨김 시 자동 폴백 규칙을 생략한 단순화된 서술이라는 점이 유일한 실질적 갭이다. 이는 spec 간 직접 모순(CRITICAL)은 아니지만, 구현자가 target 문서만 보고 세부 우선순위 로직을 놓칠 위험이 있어 WARNING 으로 분류한다.

## 위험도

LOW
