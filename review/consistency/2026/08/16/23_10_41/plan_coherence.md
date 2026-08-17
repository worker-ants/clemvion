# Plan 정합성 검토 — spec-draft-eia-fanout-masking.md

## 검토 대상
- target: `plan/in-progress/spec-draft-eia-fanout-masking.md` (project-planner draft, status: draft)
- 주요 관련 plan: `plan/in-progress/eia-fanout-and-internal-data-masking.md`(developer, 같은 worktree),
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커)
- 구현 커밋(로컬, origin/main 대비 미머지): `1b8fd5cc7`(WS fanout+wire 마스킹), `fe6a54c80`(내부 REST 6표면 egress 마스킹)

## 발견사항

- **[WARNING]** 같은 worktree 의 developer plan 최상단 "택일" 표가 이후 뒤집힌 결정을 반영하지 않는다
  - target 위치: (target 자체는 무관 — target 은 최종 결정을 정확히 반영함. 변경 1-a "wire 에도 건다 (boundary parity)")
  - 관련 plan: `plan/in-progress/eia-fanout-and-internal-data-masking.md` :18-24 (특히 :22 `| A | **fanout 브랜치에만** 값-패턴 마스킹 | 아래 §A |`)
  - 상세: 이 plan 문서 최상단 "**사용자가 2026-08-16 에 택일했다**" 표는 A 항목을 "fanout 브랜치에만" 마스킹한다고 적고 있다. 그런데 같은 문서의 §마커·checklist(:163-164, "사용자 재택일로 wire 도 마스킹(`llmCalls` 만 예외) — 초안의 'fanout 전용' 근거(*'wire 는 소유자 콘솔'*)가 `ExecutionChannelAuthorizer` 실측으로 반증됐다")와, 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 의 해소 노트(:252-259 "**사용자 택일: wire + fanout 둘 다 마스킹**")는 최종 결정이 wire+fanout 둘 다(`llmCalls` 만 wire 예외)임을 명시한다. 실제 구현(`1b8fd5cc7`)도 wire 를 마스킹한다. target 문서(변경 1-a "wire 에도 건다 (boundary parity)")도 이 최종 결정을 정확히 반영하고 있어 target 자체는 옳다. 다만 developer plan 의 요약 표(:22)가 초판 결정 그대로 남아 있어, 이 plan 문서만 훑는 독자는 "wire 는 원문 유지"로 오독할 수 있다. B 행(:23 "#1179 와 같은 구조로 닫는다")도 §마커 절이 "틀렸다"고 명시적으로 반박한 원판 서술이라 같은 종류의 staleness다(다만 §마커 절 자체가 바로 아래 있어 발견 가능성은 A 보다 낮다)
  - 제안: target 은 수정 불요(이미 최종 결정과 일치). `eia-fanout-and-internal-data-masking.md` 최상단 표의 A 행(및 필요시 B 행)에 target 이 이미 쓰고 있는 취소선+정정 패턴(예: 변경 1-b 의 "~~잔여 ①~~ 해소" 형식)과 같은 방식으로 "~~fanout 브랜치에만~~ → wire+fanout 둘 다(2026-08-16 재택일, 근거는 §마커/checklist 참조)" 주석을 추가해 자기모순을 없앨 것. (참고: 이 파일은 검토 시점에 실시간으로 갱신되고 있어 — checklist 항목들은 이미 [x]/정정 노트로 갱신됨 — 이 보고서 확인 시점엔 이미 해소됐을 수 있다)

- **[INFO]** developer plan 의 트래커 라인 인용(`:235`/`:240`/`:223`)이 이미 drift
  - target 위치: 해당 없음(target 은 인용하지 않음)
  - 관련 plan: `eia-fanout-and-internal-data-masking.md` :15 (`**A**(:235 ...)·**B**(:240 ...)·**D**(:223 ...)`) vs 실제 `spec-sync-external-interaction-api-gaps.md` 현재 위치는 D=:235, A=:252, B=:261
  - 상세: 같은 세션 중 트래커 파일에 새 항목(`SECRET_LEAK_PATTERNS` bare `token=` 갭, :172-181)이 추가되며 하단 항목들의 줄 번호가 밀렸다. 이 저장소가 이미 "라인 인용은 리팩터마다 stale 화돼 심볼로 고정" 을 알려진 리스크로 인지하고 있는 패턴과 동일한 재발이며, 기능적 영향은 없다(제목 문자열로도 특정 가능)
  - 제안: 낮은 우선순위. 다음 편집 시 심볼/제목 인용으로 대체하거나 줄번호를 갱신

## 정합성 확인 (충돌 없음 — 참고용)

- target 이 "잔여 ①·②" 는 flip 하고 "잔여 ③"(workflow-assistant LLM 도구)은 그대로 두는 것은, `spec-sync-external-interaction-api-gaps.md` 의 해당 항목(현재 :225-233, `[ ]` 상태, "두 마스킹 의미 중 이 표면에서 무엇이 우선인지가 **결정 항목**이다")이 여전히 미해결로 남아 있는 것과 정확히 일치한다 — target 이 이 미해결 결정을 우회하거나 선점하지 않는다.
- target 의 §R17 신규 불릿 삽입 위치("기존 `execution.failed` 불릿 뒤")·잔여 ①·② 취소선 대상(`:1515-1525`)은 현재 `spec/5-system/14-external-interaction-api.md` 실제 라인과 정확히 일치한다.
- target 의 "`nodeName` 4행 정정" 은 현재 `6-websocket-protocol.md` §4.1 의 기존 "Note (spec drift)" 문구(:191)가 스스로 지목한 정확히 그 4행(node.started/completed/failed/skipped, :186-189)과 일치하며, 미구현 `execution.paused`(:185, planned)는 의도적으로 제외해도 무모순이다.
- target 의 §12-webhook.md §5.3 캐비엇 삽입 위치(:319 부근)와, "display 시점 마스킹 기각(2026-07-07)" Rationale(:434-439)과의 구분 논리("ingestion=알려진 헤더 key / egress=임의 값-패턴")는 실제 spec 문구와 정확히 부합하며 기각된 대안을 번복하지 않는다.
- target 이 언급하는 "이미 이연된 `### 4.4` 절 번호 중복" 은 사전 세션(`review/consistency/2026/08/16/22_22_36/naming_collision.md` INFO)이 이미 확인한 기존 이연 항목이며, target 은 그 자리에 새 절을 만들지 않고 §4.1 표 직후에 캐비엇으로 붙여 중복을 늘리지 않는다.
- `spec-sync-external-interaction-api-gaps.md` 의 A/B 항목(현재 :252, :261)은 이미 `[x]` 해소 + 구현 커밋(`1b8fd5cc7`/`fe6a54c80`) 교차 참조로 갱신되어 있어, target 의 spec 반영이 착지하면 "정본 트래커가 여전히 미해결로 보인다" 는 후속 항목 누락 위험은 없다.
- target 참조 구현 커밋 `1b8fd5cc7`·`fe6a54c80` 는 실제로 이 브랜치(`claude/eia-masking-followups-3cd512`, origin/main 대비 3커밋 선행)에 존재하며 target 의 "이미 머지 대기 중" 서술과 부합한다.

## 요약
target(`spec-draft-eia-fanout-masking.md`)은 사전 `--impl-prep` 리뷰(`22_22_36`)의 spec 관련 WARNING 4건(①·② flip, ingestion/egress 상호참조, nodeName→nodeLabel, §R17 신규 불릿 표제 구분)을 정확한 소스 라인 근거와 함께 반영하고 있고, 정본 트래커의 미해결 결정 항목(잔여 ③ workflow-assistant)은 건드리지 않고 보존한다. 유일하게 발견된 문제는 target 이 아니라 **같은 worktree 의 sibling developer plan**(`eia-fanout-and-internal-data-masking.md`) 최상단 요약 표가 "wire 는 fanout 전용 마스킹"이라는 초판 결정을 그대로 두고 있어, 문서 하단(checklist·§마커)과 정본 트래커의 최종 결정("wire+fanout 둘 다")과 자기모순한다는 점이다 — target 자체의 내용은 최종 결정과 일치하므로 target 수정은 불요하고, sibling plan 의 요약 표만 정정하면 된다.

## 위험도
LOW
