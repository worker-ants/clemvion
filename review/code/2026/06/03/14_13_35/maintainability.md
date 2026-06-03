# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] 일부 셀에서 과도하게 긴 인라인 설명 — 테이블 가독성 저하
- 위치: `spec/data-flow/8-notifications.md` §1.1 Type 별 source·트리거 표, `spec/data-flow/5-integration.md` §2.2 큐 표 (`cafe24-token-refresh` 행)
- 상세: `integration_expired`, `integration_action_required`, `alert_<rule.type>` 행이 단일 셀에 4~6줄 분량의 서술을 담고 있다. 마크다운 테이블 셀은 행 높이 제한이 없지만, 동일 문서 내 다른 표 셀과 분량 차이가 10배 이상 벌어지면 렌더링 후 가독성이 크게 떨어지고, 후속 편집자가 표를 파악하는 데 과도한 비용이 생긴다. `cafe24-token-refresh` 큐의 dedup 전략 설명도 동일 문제다.
- 제안: 핵심 요약만 셀에 남기고 세부 내용은 해당 행 아래 블록 인용(`>`)이나 별도 서브섹션으로 분리한다. 기존 PR 이후 추가된 `§ Rationale` 패턴이 이미 있으므로 일관성 확보가 쉽다.

### [INFO] 구현 현황 표기 방식이 파일마다 다름 — 일관성 부재
- 위치: 전체 변경 파일 다수
- 상세: 구현 상태를 나타내는 표기가 `**구현됨**`, `✓`, `(구현됨)`, `구현됨 —`, `**미구현 (Planned)**`, `🚧`, `— 미구현`, `미구현 (Planned)` 등 최소 6가지 형태로 혼재한다. 예를 들어 `node-cancellation.md` §6 표에서는 `✓` / `🚧` / `—` 기호를 쓰고, `swagger.md`·`user-guide-evidence.md`·`data-flow` 파일들은 인라인 볼드 텍스트를 사용한다. 코드베이스 스타일·패턴 기준에서 이 불일치는 후속 편집자가 "내가 어떤 형식으로 써야 하는가"를 알 수 없게 만든다.
- 제안: `spec/conventions/` 에 구현 상태 표기 단일 규약(예: `✓ 구현됨` / `🚧 부분구현` / `— 미구현 (Planned)`)을 한 줄짜리 참고 섹션으로 추가하거나, `spec-impl-evidence.md`에 표기 패턴 가이드를 포함시켜 일관성을 강제한다.

### [INFO] 인라인 코드 파일 경로에 라인 번호 하드코딩 — 유지보수 부담
- 위치: `spec/data-flow/0-overview.md` (`knowledge-base.service.ts:726`), `spec/data-flow/4-file-storage.md` (`knowledge-base.service.ts:644-658`, `755-759`), `spec/data-flow/1-audit.md` (`login-history.service.ts:82-84`), `spec/data-flow/3-execution.md` (`execution.entity.ts:97`), `spec/data-flow/5-integration.md` (`entities/integration.entity.ts:112~117`), `spec/data-flow/9-observability.md` (`alerts-evaluator.service.ts:58-103`, `:192-195`, `:197-225`)
- 상세: spec 문서에서 코드 라인 번호를 직접 참조하는 패턴은 코드가 조금만 변경되어도 spec 이 즉시 부정확해진다. 이번 PR 자체에서도 `knowledge-base.service.ts:723` → `:726` 으로 라인 번호가 변경된 사례가 있다. 라인 번호 기반 참조는 소스 오브 트루스로서 신뢰도가 낮다.
- 제안: 라인 번호 대신 함수/메서드 이름 참조(`knowledge-base.service.ts의 remove()`)로 대체한다. 꼭 라인 번호를 써야 한다면 "근사치" 임을 명시하는 `~` 기호 사용을 표준화한다 (이미 일부 파일에 `~` 사용이 있어 불일치가 존재함 — `:112~117` vs `:82-84`).

### [INFO] `spec/data-flow/10-triggers.md` §1.4 의 단조 증가 테이블 행 길이 — 미래 편집 혼란 가능성
- 위치: `spec/data-flow/10-triggers.md` §1.4 Schedule ↔ Trigger 동기화 표, 특히 `POST /api/schedules` 행
- 상세: `POST /api/schedules` 행이 `INSERT trigger(type='schedule') save 후 INSERT schedule save (순차 — 단일 트랜잭션 아님; 중간 실패 시 고아 trigger 가능). is_active 면 registerJob 으로 BullMQ 등록` 등 한 셀에 두 개의 개념(트랜잭션 특성 + BullMQ 등록)을 담고 있다. 이 내용은 아래 블록 인용이나 별도 노트로 빼는 것이 더 적합하다. 그러나 동일 표의 다른 행은 훨씬 간결해 스타일 불일치가 눈에 띈다.
- 제안: 트랜잭션 경계·고아 가능성 등 심층 설명은 행 하단 블록 인용으로 분리하고 셀은 동작 핵심만 유지한다.

### [INFO] `spec/conventions/interaction-type-registry.md` 규칙 3 의 서술 과밀
- 위치: `spec/conventions/interaction-type-registry.md` §1 규칙 3 (라인 46)
- 상세: 기존 한 문장짜리 규칙이 4줄 이상의 괄호 내용이 포함된 복합 문장으로 교체되어 빠른 참조가 어렵다. 규칙 목록은 한 줄씩 핵심을 요약하고 상세는 아래 노트나 서브섹션으로 빼는 것이 spec 문서 내 일관된 패턴이다.
- 제안: 규칙 3 본문은 "AST 가드(`interaction-type-exhaustiveness.test.ts` `REGISTRY_SITES`)가 등록된 파일에서 모든 enum 값의 string literal 등장을 검증한다"로 축약하고, 현재 4개 파일 목록과 grep 비대상 파일 설명은 규칙 바로 아래 블록 인용으로 옮긴다.

### [INFO] `spec/data-flow/12-workspace.md` §1.5 의 "미구현 (Planned)" 섹션 제목 — 검색·링크 불안정
- 위치: `spec/data-flow/12-workspace.md` §1.5 제목 변경: `### 1.5 워크스페이스 전환` → `### 1.5 워크스페이스 전환 — 미구현 (Planned)`
- 상세: 마크다운 헤더에 구현 상태를 직접 붙이면 내부 앵커 링크(`#15-워크스페이스-전환`)가 깨진다. 다른 spec 파일에서 이 섹션을 링크하거나 향후 구현 완료 시 제목을 수정하면 참조가 일괄 깨진다.
- 제안: 섹션 제목은 `### 1.5 워크스페이스 전환`으로 유지하고, 섹션 첫 줄에 `> **현재 미구현.** ...` 블록 인용을 두는 기존 패턴(이미 본 섹션 내부에 적용됨)으로 충분하다. 제목에서 상태 표기를 제거한다.

---

## 요약

이번 변경은 spec 문서 20개 파일에 걸친 구현 현황 동기화(spec-sync-audit)로, 잘못된 메서드명·엔드포인트·라인 번호·BullMQ 전환 내용 등 다수의 실제 오류를 교정하는 유의미한 작업이다. 유지보수성 관점에서 주요 리스크는 기능·로직 오류가 아니라 **문서 스타일 일관성 부재**와 **라인 번호 기반 참조의 소멸 가능성**이다. 구현 상태 표기가 `✓` / `🚧` / `**구현됨**` / `(구현됨)` 등으로 혼재하고, 특정 표 셀에 지나치게 긴 서술이 인라인으로 들어가 후속 편집 시 파악 비용이 높아진다. 라인 번호 하드코딩은 코드 변경이 잦은 활발한 코드베이스에서 spec 의 신뢰도를 빠르게 낮추는 패턴이다. 전반적으로 Critical·Warning 수준의 결함은 없으며, 모두 점진적으로 개선할 수 있는 INFO 수준 사안이다.

## 위험도

LOW

STATUS: SUCCESS
