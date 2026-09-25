### 발견사항

- **[WARNING]** 결정을 내린 트래커 항목에 역참조가 없다
  - target 위치: 문서 전체 (frontmatter `title`/서두 — "트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «…» 의 설계 결정 턴이다")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4946` — `- [ ] **경로 파라미터로 워크스페이스를 받는 라우트 13개가 가드 층 보호를 전혀 못 받는다**` (스코프 조건: "구조적 해법을 먼저 결정하고 …")
  - 상세: target 은 이 트래커 항목을 향해 **뒤에서 앞으로**만 링크한다(target → 트래커). 트래커 항목 4946은 여전히 `- [ ]` 미해소 상태이고, 이 draft 가 그 결정 턴이라는 사실을 가리키는 역참조가 없다. 같은 트래커 문서 안에서 이미 반복 확립된 관례(예: 4908-4909줄 "이 축을 아래 별 항목으로 갈랐다 … 註로만 두면 항목을 닫을 때 함께 묻힌다", 4920줄 "✅ 2026-09-24 해소 — developer 턴 `plan/complete/member-auth-order.md`")를 따르면, 항목 4946 에도 "결정 턴 분리: `spec-draft-workspace-path-guard.md`" 같은 포인터가 있어야 다음 사람이 이 결정을 놓치지 않는다. 지금 상태로는 트래커만 보는 사람에게 이 항목이 여전히 완전히 미착수로 보인다.
  - 제안: target(또는 병행 커밋)에서 트래커 항목 4946 에 짧은 포인터 각주를 추가할 것 — "2026-09-25 — 결정 턴: `plan/in-progress/spec-draft-workspace-path-guard.md`(옵션 3 채택, 구현은 후속 developer PR)".

- **[INFO]** 신설 링크가 기존 doclink-guard 사각지대에 놓일 위험
  - target 위치: `C-1(c)` ("아래 Rationale «경로 파라미터 워크스페이스도 가드가 본다»"), `C-3` ("가드 Rationale 을 가리키는 링크 자리에 «…» 를 함께 가리킨다")
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` — `spec/5-system/1-auth.md` · `spec/data-flow/12-workspace.md` 가 **이미** 멀티라인 markdown 링크로 `spec-link-integrity` 가드를 침묵 통과한 6파일 중 2곳이라고 실측·뮤테이션으로 확정해 둔 상태(가드 자체의 사각지대로 별도 등재됨).
  - 상세: target C-1(c)/C-3 이 `1-auth.md`·`12-workspace.md` 에 새 cross-reference 링크를 넣는데, 그 두 파일은 이미 "멀티라인 링크가 앵커 검증을 건너뛴다"는 결함 클래스의 실제 사례로 지목된 파일이다. 구현 시 이 새 링크를 멀티라인으로 작성하면 깨진 앵커가 있어도 가드가 못 잡는 채로 조용히 추가될 수 있다.
  - 제안: C-1(c)/C-3 반영 시 새 링크를 **한 줄**로 작성해 기존에 알려진 가드 사각지대를 새로 늘리지 않도록 developer PR 체크리스트에 명시.

- **[INFO]** `spec/conventions/error-codes.md` 동시 편집 план 3개
  - target 위치: `C-4` (`admin_required` 소문자 역사적 예외 목록에 註 추가)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md`(§Overview 병기, 대부분 완료) · `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md §3`(같은 파일 예외 레지스트리에 `AbortError` 등재 검토 중)
  - 상세: 같은 규약 문서를 세 개의 독립 plan 이 서로 다른 절(§Overview, §3 예외 레지스트리, 소문자 역사적 예외 목록)에서 각각 편집하려 한다. 절이 겹치지 않아 내용 충돌 가능성은 낮지만, `spec-conventions-engine-error-code-surface.md` 자체가 "나란히 가는 plan … 착수 순서가 겹치면 서로의 문단을 덮을 수 있다"고 이미 경고해 둔 파일이라 세 번째 동시 편집자가 생겼다는 사실은 기록해 둘 가치가 있다.
  - 제안: 반영 순서에 크게 구애받지 않지만, `--spec`/`--impl-done` 번들 시 `error-codes.md` 최신본 기준으로 diff 를 재확인할 것.

### 요약
target 은 `plan/in-progress/spec-draft-nullable-notation-followups.md:4946` 이 명시한 스코프 조건(구조적 해법을 먼저 결정)을 정확히 따르고 있고, 채택한 옵션(가드 확장 + 코드 부여)은 다른 in-progress plan 이 내려 둔 미해결 결정과 충돌하지 않으며, `keyset-cursor-uuid-validation.md`(다른 자원의 `isUuidShaped` 재사용)·`auth-guard-reflection-hardening.md`(부트 캐너리 설계)·`spec-sync-*-gaps.md`(무관 도메인)와도 정합한다. 다만 결정의 원천이 된 트래커 항목에 역참조가 아직 없어 plan 위생 관점의 후속 누락이 있고, 새로 추가될 spec 링크가 이미 알려진 doclink-guard 사각지대 파일(`1-auth.md`/`12-workspace.md`)에 놓일 위험이 있다. 두 건 모두 CRITICAL 급 충돌이 아니라 plan/구현 단계에서 손쉽게 보완 가능한 수준이다.

### 위험도
LOW
