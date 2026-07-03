# Plan 정합성 검토 — impl-prep (`spec/5-system/`)

검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
검토 관점: (1) 미해결 결정과의 충돌, (2) 선행 plan 미해소, (3) 후속 항목 누락

---

## 발견사항

### [WARNING] `spec-code-cross-audit-2026-06-10.md` V-09 미해결 결정이 target §1.5.3 을 그대로 두고 있음

- **target 위치**: `spec/5-system/1-auth.md` §1.5.3 "흐름 (이미 가입한 사용자가 다른 워크스페이스에 초대된 경우)" (L251-262) — "로그인되어 있고 본인 이메일과 토큰 이메일이 일치 → 수락 페이지에 **[수락] 버튼** 노출" 이라고 명시.
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §"결정 옵션 (2026-06-13)" V-09 (L59-65) — `accept-invitation-content.tsx` 가 실제로는 마운트 즉시 `acceptInvitation` 을 **자동 호출**(버튼·불일치 UI 없음)한다는 코드↔spec 갭이 아직 "코드 구현 vs spec 하향" 미결 상태로 남아 있음(같은 파일 L34 "잔여: V-04·V-05·V-09·V-10·…·V-18 (major/minor — 결정 대기)"에 V-09 포함).
- **상세**: target 문서는 이 결정이 아직 열려 있다는 사실을 전혀 반영하지 않고, 마치 §1.5.3 버튼 확인 흐름이 이미 확정·구현된 것처럼 서술한다. 이번 --impl-prep 검토가 이 영역(§1.5.3 인접 초대 흐름)에서 구현에 착수한다면, 실제 코드(자동 수락)와 spec(버튼 확인) 중 어느 쪽이 SoT 인지 아직 정해지지 않은 상태에서 작업을 시작하게 되는 위험이 있다.
- **제안**: 코드 변경이 §1.5.3 인접 영역(초대 수락 흐름)에 해당한다면 구현 착수 전에 V-09 결정(코드 구현 vs spec 하향)을 먼저 확정해야 한다(project-planner 위임). 무관한 영역(§1.1~§1.4, §2~§4, graph-rag) 작업이라면 이 항목은 참고용으로만 취급하고 진행해도 무방하다.

### [WARNING] `1-auth.md` frontmatter `pending_plans` 목록이 실제 미해결 항목을 다 포함하지 않음

- **target 위치**: `spec/5-system/1-auth.md` frontmatter (L11-12) — `pending_plans: [plan/in-progress/spec-sync-auth-gaps.md]` 만 등재.
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-09(§1.5.3, 위 항목)가 이 spec 문서를 대상으로 한 미해결 결정이지만 frontmatter 에 역참조가 없다.
- **상세**: `pending_plans` 필드는 "이 spec 문서에 영향을 주는 진행 중 plan" 을 추적하는 목적인데, LDAP/SAML(§1.3) 갭만 등재되고 V-09(§1.5.3) 관련 미결 항목은 빠져 있다. 향후 이 spec 을 읽는 개발자가 pending_plans 만 보고 "§1.5.3 은 확정된 내용" 이라고 오판할 수 있다.
- **제안**: `1-auth.md` frontmatter `pending_plans` 에 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 추가를 검토(또는 V-09 항목을 별도 소규모 spec-sync 플랜으로 분리해 등재). project-planner 트랙.

### [INFO] `exec-intake-queue-impl.md` 의 "auth Critical 2건" 잔여 항목이 stale — 이미 해소됨

- **target 위치**: `spec/5-system/1-auth.md` §1.4.3/§5 (WebAuthn availability 응답 포맷, L173/L463 — 이미 `{ enabled: boolean }` 로 통일 서술) · §1.5.4 (초대 에러코드 lower_snake_case, L275 — historical-artifact 예외로 이미 등재).
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` L20 — `[ ] **(분리·무관)** auth Critical 2건은 본 작업과 무관 — 별도 항목으로 사용자/planner 위임` (미체크 상태로 잔존). 근거: `review/consistency/2026/06/04/08_46_26/SUMMARY.md` 가 원 지적한 2건(초대 에러코드 casing·WebAuthn availability 응답 포맷 불일치).
- **상세**: 두 Critical 모두 현재 target 문서에서 이미 해소된 상태로 확인된다(§1.4.3/§5 정합 각주, §1.5.4 historical-artifact 등재). `exec-intake-queue-impl.md` 의 체크박스만 갱신되지 않아 "auth 에 미해결 Critical 2건이 있다"는 stale 신호를 계속 내보내고 있다 — target 자체와는 충돌하지 않으나 plan 위생 문제.
- **제안**: `exec-intake-queue-impl.md` L20 을 체크(`[x]`)하고 해소 근거(§1.4.3/§5·§1.5.4 반영 확인)를 한 줄 추가 — developer/project-planner 트랙, 이번 --impl-prep 의 차단 사유는 아님.

### [INFO] `rag-dynamic-cut.md` 의 graph-rag 후속 표기 항목이 이미 target 에 반영됨(체크 누락)

- **target 위치**: `spec/5-system/10-graph-rag.md` §3.5 KB-GR-SR-05(L909-910 상당, 본 검토 payload 기준) · §4.1 step [7] · SQL 주석(LIMIT 부분) — 모두 "최종 생성 주입 청크 수는 [RAG 검색 §3.4] 동적 점수 컷… 이 결정한다(고정 topK 아님)" 로 이미 갱신되어 있음(git 커밋 `295197aac`, PR #500 에서 반영).
- **관련 plan**: `plan/in-progress/rag-dynamic-cut.md` §"비차단 후속" (L45-47) — `10-graph-rag KB-GR-SR-05(topK→동적 컷 표현)` 를 미반영 후속 항목으로 열거.
- **상세**: 코드·git history 대조 결과 이 표기 갱신은 이미 완료된 상태다. plan 문서의 "비차단 후속" 목록이 실제로는 완료된 항목을 여전히 미완료로 나열하고 있어 향후 재작업 시도를 유발할 수 있다.
- **제안**: `rag-dynamic-cut.md` 의 해당 줄을 제거하거나 완료 표기로 갱신(project-planner/developer, 비차단).

---

## 요약

이번 --impl-prep 검토 범위(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)에서 가장 실질적인 리스크는 `spec-code-cross-audit-2026-06-10.md` 의 V-09 미해결 결정(초대 수락 자동화 vs 버튼 확인, §1.5.3)이 target 문서에 전혀 반영되지 않은 채 "이미 확정된 사양"처럼 서술돼 있다는 점이다 — 이 영역을 건드리는 구현이라면 착수 전 결정이 선행돼야 한다. 이 외에는 frontmatter `pending_plans` 등재 누락(WARNING) 한 건과, 이미 해소됐음에도 plan 체크박스만 stale 로 남은 두 건(INFO, `exec-intake-queue-impl.md`·`rag-dynamic-cut.md`)이 발견됐으나 target 문서 자체의 정확성에는 영향이 없다. graph-rag 문서는 관련 in-progress plan(rag-dynamic-cut, rag-quality-improvement, competitive-analysis)과 실질적 충돌이 없으며 P0~P2 구현 완료 상태가 plan 들의 진행 상황과 일치한다.

## 위험도

MEDIUM
