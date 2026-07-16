### 발견사항

- **[INFO]** plan lifecycle 이동(3건 rename)이 5개 spec 문서에 걸친 하드코딩 상대경로 링크의 수작업 동기화를 강제 — N:M 결합의 반복 유지비
  - 위치: `spec/4-nodes/1-logic/10-parallel.md`(L211, L230), `spec/conventions/cross-node-warning-rules.md`(L20), `spec/conventions/execution-context.md`(L45), `spec/conventions/node-cancellation.md`(L18) — 전부 `plan/in-progress/parallel-p2-followups.md` → `plan/complete/parallel-p2-followups.md` 동일 치환.
  - 상세: `plan/in-progress/*.md` → `plan/complete/*.md` 3건 rename(parallel-p2-followups·rag-dynamic-cut·spec-sync-mcp-client-gaps) 각각이 그 plan 을 참조하는 모든 spec 파일에서 개별적으로 링크를 찾아 고쳐야 했다. `spec-link-integrity.test.ts` 가 build-time 으로 dead link 를 잡아주므로 누락은 방지되지만, 근본적으로 "plan 파일 하나의 디렉터리 이동"이 "그 plan 을 인용하는 spec 파일 N개의 동시 편집"을 강제하는 구조다. 이번 diff 자체가 그 반복 패턴(동일 find/replace 가 5곳)을 실증한다.
  - 제안: 매번 grep 으로 재발견하는 대신, plan 경로를 참조하는 spec Rationale 절이 늘어날수록 반복될 비용이므로 — (a) plan-lifecycle 문서에 "plan 이동 시 `grep -rln '<old-path>' spec/` 로 참조자 전수 갱신" 체크리스트를 명시하거나, (b) 장기적으로 plan 참조를 파일 시스템 경로 대신 안정적 식별자(제목/anchor)로 두고 이동 시 자동 재작성하는 codemod 를 고려. 차단 사유는 아님(가드가 이미 안전망 역할).

- **[INFO]** 동일 정책 상수·근거가 완료된 plan 문서 내에서 3곳(정책 요약 / spec 초안 / Rationale) 에 근접 중복 서술
  - 위치: `plan/complete/ai-agent-tool-payload-budget-guardrail.md` — "## 확정 정책"(약 L212-226, byte 임계값·env var 표), "### D1. ai-agent.md §4.2"(L273-291, 동일 표 재기술), "## Rationale"(L312-320, "왜 bytes 우선인가" 등 동일 논거 재서술).
  - 상세: `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES=98304` / `HARD_BYTES=262144` / `COUNT_MAX=128` 같은 구체 수치와 그 근거가 문서 내 3개 절에서 표현만 바꿔 반복된다. 이 문서는 계획 템플릿(결정→spec 초안→근거)으로 이 구조가 이 저장소의 일관된 관례이긴 하나, 향후 값이 바뀌면 한 곳만 고치고 나머지를 놓칠 위험이 있는 전형적 SSOT 위반 패턴이다(이번 diff 의 `spec-impl-evidence.md §4.2` 자체 drift 발견이 정확히 이 위험을 보여주는 사례).
  - 제안: 해당 plan 은 이미 `status: complete` 로 고정된 이력 문서라 즉각 수정 불요. 다만 앞으로 유사 plan 을 작성할 때 "결정 값의 SoT 는 §확정 정책 한 곳"임을 명시하고, spec 초안·Rationale 절은 그 값을 재타이핑하지 않고 인용(cross-ref)하는 편이 drift 위험을 줄인다.

- **[INFO]** 코드 주석 정정(파일 3)은 정확하고 유익함 — 별도 조치 불요
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` L20-24.
  - 상세: 기존 주석("Plan-side link hygiene is handled by plan-coherence-checker, not this gate")이 실제 `findBrokenLinks()` 동작(스캔 (1) spec 본문에는 target 필터가 없어 `plan/**` 링크도 검사 대상)과 반대로 서술돼 있던 것을, 실측(vitest 실행)에 기반해 정확한 scope 구분(스캔 (1) vs (2))으로 교정했다. `spec/conventions/spec-impl-evidence.md §4.2`(파일 29)도 동일 오류를 같은 근거로 정정 — 코드 주석과 SoT 문서가 함께 정합해졌다. 잘못된 주석보다 정확한 주석이 유지보수성에 명백히 유리한 케이스.

- **[INFO]** 장기 누적형 리서치/plan 문서의 다층 날짜별 정정 오버레이가 가독성을 서서히 낮춤
  - 위치: `plan/research/competitive-analysis-n8n-flowise.md`(v1→v2→v2.1→v2.3 표기가 본문에 순차 누적, 취소선+인라인 정정 다수), `plan/complete/ai-agent-tool-payload-budget-guardrail.md`·`plan/complete/rag-dynamic-cut.md`(각 체크박스 항목에 최초 판정 뒤 "⚠️ 부분 (날짜)" → "✅ 종결 (날짜, grooming)" 식으로 여러 겹 갱신 노트가 쌓임).
  - 상세: 각 정정 자체는 근거를 남기려는 좋은 의도지만, 항목 하나를 이해하려면 2~3개의 시간순 오버레이를 순서대로 읽어야 하는 구조가 반복된다(예: `parallel-p2-followups.md` §2~4 항목이 최초 서술 → 2026-06-20 재검증 → 2026-07-16 grooming 종결까지 3단 중첩). 코드의 "중첩 깊이" 에 대응하는 문서 버전의 "정정 레이어 깊이" 문제로 볼 수 있음.
  - 제안: 이번 PR 처럼 항목이 최종 종결되는 시점에는, 과거 오버레이를 완전히 지우진 않더라도 "최종 결론"을 문단 맨 위(또는 체크박스 라벨)로 승격하고 과거 이력은 접이식/하위 인용으로 내리는 편집을 권장 — 이미 일부 항목(`rag-dynamic-cut.md` §10 등)은 이 패턴을 잘 따르고 있어 나머지도 동일 스타일로 통일하면 좋음. 차단 사유 아님.

- **[확인 — 문제 없음]** spec 문서 정정(파일 23, 24, 29)은 유실된 커밋먼트·모순된 gate 서술을 근거와 함께 명시적으로 해소해 문서 부채를 실제로 줄임
  - `10-parallel.md`: 유실된 `parallel-p2-followups.md §2-E` 참조를 "데이터 마이그레이션 없음" 확정 결정 + 근거 + 이력으로 대체 — 고아 커밋먼트를 제거.
  - `11-mcp-client.md`: `_(비채택 won't-do)_` 표기 + 전용 `R-wontdo-cached-capabilities` Rationale 절이 기존 `6-websocket-protocol.md`(`R-wontdo-rawws-rest`) 관례를 정확히 재사용 — 네이밍·구조 일관성 양호.
  - `spec-impl-evidence.md §4.2`: 게이트 동작 설명 자체의 오류를 실측으로 교정.

### 요약
이번 변경 묶음은 애플리케이션 코드가 아니라 plan/spec 문서 정리(grooming) 위주이며, 유일한 코드 변경(`spec-link-integrity.test.ts` 주석)도 실제 동작에 맞춘 정확한 정정이라 순수하게 개선이다. 문서 차원에서도 유실된 커밋먼트 해소·won't-do 표기 컨벤션 일관 적용·gate 서술 self-drift 교정 등 유지보수성을 실질적으로 높이는 변경이 다수다. 다만 (1) plan 파일 이동마다 이를 참조하는 여러 spec 문서를 수작업으로 동기화해야 하는 구조적 결합 비용, (2) 완료된 plan 문서 내부에서 동일 정책 값·근거가 여러 절에 근접 중복 서술되는 SSOT 산발, (3) 장기 리서치/plan 문서에 정정 오버레이가 여러 겹 누적되어 가독성이 서서히 저하되는 경향은 이번 diff 자체가 유발한 새 문제라기보다 이 저장소의 plan 운영 방식에서 반복적으로 관찰되는 저위험 패턴으로, 참고용으로 기록한다. 코드 복잡도·중첩 깊이·매직 넘버·순환 복잡도 등 전형적 코드 유지보수성 지표는 이번 diff 범위에 해당 코드가 없어 평가 대상이 아니다.

### 위험도
LOW
