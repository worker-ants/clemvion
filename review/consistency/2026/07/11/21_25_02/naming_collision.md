# 신규 식별자 충돌 검토 — spec-draft-graph-rag-kb-token-stats-wontdo

## 대상
`plan/in-progress/spec-draft-graph-rag-kb-token-stats-wontdo.md` (target) → `spec/5-system/10-graph-rag.md` 편집안.

## 사전 확인 요약
target 이 실제로 "새로" 도입하는 식별자는 많지 않다 (요구사항 ID·엔티티명·API endpoint·이벤트명·env var 는 전부 기존 재사용 또는 무변경):

- 요구사항 ID `KB-GR-EX-07` / `KB-GR-OB-01` / `NF-GR-05` — 전부 기존 ID (신규 부여 아님, status 값만 변경). `spec/`, `plan/` 전체 grep 결과 세 ID 모두 `spec/5-system/10-graph-rag.md` 내에서만 사용 — 다른 의미로 중복 정의된 곳 없음 → 충돌 없음.
- `LLMUsageLog` → `LlmUsageLog` casing 정정 — `spec/1-data-model.md` §2.24 의 canonical 명칭이 `LlmUsageLog` 이며, 오기 `LLMUsageLog` 는 `spec/` 전체에서 target 이 고치려는 정확히 그 두 라인(`10-graph-rag.md:142`, `:170`)에만 존재. 정정 후 잔여 오기 없음 → 충돌 없음, 오히려 기존 casing 불일치를 해소.
- API endpoint / 이벤트명 / env var / 파일 경로 — target 은 신규 도입 없음 (기존 파일 본문 편집, 신규 spec 파일 없음). `plan/in-progress/spec-draft-graph-rag-kb-token-stats-wontdo.md` 파일명도 기존 `spec-draft-*` 컨벤션(`spec-draft-g1-withdraw-ws-start-gate.md`, `spec-draft-webchat-execution-residuals.md`)과 일치.

아래 1건만 실질 충돌 후보로 발견됨.

## 발견사항

- **[WARNING]** `⛔` 상태 아이콘이 target 이 부여하려는 "비목표(won't-do)" 의미와, 기존 spec/plan 이 이미 쓰는 "취소됨(cancelled)"·"BLOCKED/WITHDRAWN" 의미로 겹친다
  - target 신규 식별자: `⛔ 비목표` — `spec/5-system/10-graph-rag.md` 요구사항 상태 테이블에 KB-GR-EX-07 행의 값으로 신규 도입 예정 (target 본문 §변경안 1번, "`✅` → `⛔ 비목표`")
  - 기존 사용처:
    - `spec/2-navigation/0-dashboard.md:88` — "상태 | 실행 status 별 아이콘: ✅ completed / ❌ failed / ⏳ running·pending / **⛔ cancelled** / ✋ waiting_for_input"
    - `spec/2-navigation/14-execution-history.md:86` — "Status | 상태 아이콘 + 텍스트 (`✅ Completed`, `❌ Failed`, `⏳ Running`, **`⛔ Cancelled`**, `🙋 Waiting`)"
    - `plan/in-progress/execution-engine-residual-gaps.md:45` — `### G2 — ... — ⛔ BLOCKED` (plan 항목 상태 마커)
    - `plan/complete/spec-draft-g1-withdraw-ws-start-gate.md:56` — `G1 헤딩 ⛔ BLOCKED → ⛔ WITHDRAWN` (plan 항목 상태 마커)
  - 상세: `⛔` 는 이미 이 리포에서 (a) 실행(execution) 상태 "취소됨" 아이콘, (b) plan 항목 상태 "BLOCKED/WITHDRAWN" 마커로 확립돼 있다. target 은 이를 **세 번째 의미**("요구사항이 비목표로 확정됨")로 `10-graph-rag.md` 의 요구사항 상태 컬럼에 도입하려 한다. `10-graph-rag.md` 자체 요구사항 테이블은 현재 `✅`/`❌` 두 값만 쓰고 있어(예: §8 `P2+ (후속) | ❌ | §8 미결 항목`) `⛔` 는 이 파일에도 처음 등장하는 값이며, 다른 `_product-overview.md` (`spec/2-navigation/_product-overview.md:38` 범례: "✅ 구현 완료 · 🚧 백엔드만 존재 · ❌ 미구현")에도 상응하는 선례가 없다. `spec/7-channel-web-chat/_product-overview.md` 는 "비목표"를 이미 표기하지만(§2 목표/비목표) 요구사항-ID-테이블의 emoji 상태값이 아니라 산문 섹션으로 표현한다 — 즉 이 리포에는 "요구사항 테이블에서 비목표를 마킹하는" 기존 컨벤션 자체가 없고, target 이 임의로 고른 새 glyph 가 하필 다른 도메인에서 이미 확정 의미로 쓰이는 `⛔` 다. 독자가 spec/ 전체를 SoT 로 훑을 때 "취소됨"/"차단됨" 과 "비목표(설계상 도입 안 함)" 는 의미가 다르다 — 후자는 애초에 시도조차 안 하는 결정이고 전자는 실행되다 중단/차단된 상태라 혼동 시 오독 소지가 있다.
  - 제안: 새 glyph 도입 대신 `10-graph-rag.md` 자체가 이미 쓰는 기존 값 `❌` 를 재사용하고 괄호 텍스트로 의미를 구분하라 — 이 파일·다른 spec 문서에 이미 선례가 있는 패턴이다(예: 같은 파일 §8 `❌` 사용, `spec/*_product-overview.md` 의 `❌ (v2)` 패턴). 즉 `KB-GR-EX-07` 상태값을 `❌ (비목표 — data-flow §7 참조)` 형태로 두면 (1) 기존 "미구현/미도입" 의미와 자연스럽게 합류하고 (2) 실행 상태·plan 상태에서 이미 쓰는 `⛔` 와 충돌하지 않는다. 새 glyph 를 꼭 쓰고 싶다면 `10-graph-rag.md` 본문(또는 `spec/0-overview.md` 문서 컨벤션 절)에 "비목표" 전용 범례를 신설·공지해 다른 두 용법과 명시적으로 분리해야 한다.

## 요약
target 이 새로 부여하는 요구사항 ID·엔티티명은 없으며 (기존 3개 ID 의 status 변경 + 오기 casing 정정뿐), `LLMUsageLog`→`LlmUsageLog` 정정은 오히려 기존 casing 불일치를 해소하는 방향이라 충돌이 아니다. API endpoint·이벤트명·env var·파일 경로도 신규 도입이 없다. 유일한 실질 충돌 후보는 상태 표기용 `⛔` glyph 재사용으로, 이미 실행(execution) 상태 "취소됨"과 plan 항목 상태 "BLOCKED/WITHDRAWN" 두 가지 의미로 확립된 동일 아이콘을 요구사항 상태(비목표)라는 세 번째 의미로 겹쳐 쓰려는 것이다. 시스템적 충돌(런타임/API)은 아니지만 spec/ 을 SoT 로 참조하는 독자에게 동일 glyph 가 문서마다 다른 의미로 읽혀 혼선을 줄 수 있어 명명 정정을 권고한다.

## 위험도
LOW
