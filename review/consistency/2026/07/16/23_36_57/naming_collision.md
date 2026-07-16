# 신규 식별자 충돌 검토 — plan grooming PR (①~⑤) spec draft

대상: `spec-draft-plan-grooming.md` (D1 `9-rag-search.md` pending_plans 재배선, D2 `11-mcp-client.md` §3.3 won't-do
flip + status 승격, D3 5개 spec 문서 plan 링크 경로 갱신)

target 문서 스스로도 "naming collision: 신규 식별자 0건(경로·status 값만 변경)" 이라고 명시한다. 실제 저장소
상태(git status, grep)와 대조 검증한 결과 이 판단은 정확하다 — 본 PR 은 **엔티티·DTO·endpoint·이벤트·ENV
var·요구사항 ID 를 신규 도입하지 않는다.** 아래는 검증 과정에서 확인한 사항이다.

## 발견사항

- **[INFO]** `won't-do` 표기는 신규 식별자가 아니라 기존 확립 컨벤션의 재사용
  - target 신규 식별자(로 보일 수 있는 것): D2 §3.3 제목·본문에 도입하는 "won't-do" / "비채택" 표기
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` (§1.2, §1.3, §4.2, §4.5, §8, `## Rationale` 절
    `### R-wontdo-rawws-rest`, 2026-07-08 결정), `spec/5-system/2-api-convention.md:309`,
    `spec/5-system/4-execution-engine.md:1272`, `spec/5-system/14-external-interaction-api.md:72,292`,
    그리고 plan 측 `plan/complete/parallel-p2-followups.md:26,46,74`,
    `plan/complete/resume-llm-usage-attribution.md:102`,
    `plan/in-progress/node-cancellation-inflight-followups.md:34`
  - 상세: 이미 최소 4개 spec 문서 + 3개 plan 문서에서 "won't-do(비채택)" 가 **정확히 동일한 의미**로
    일관되게 쓰이고 있다 — "언젠가 구현할 Planned 항목이 아니라 정식으로 도입하지 않기로 결정한 항목"이라는
    뜻이며, "미구현 (Planned)" 과 명시적으로 대비되는 상태다(`6-websocket-protocol.md` §Rationale:
    "'Planned' 표기는 잘못된 기대(언젠가 구현)를 남긴다. 명시적 won't-do 가 정직하다"). D2 가 `11-mcp-client.md`
    §3.3 `cached_capabilities` 를 "미구현 (Planned)" → "won't-do" 로 전환하려는 의도(정식 기각, 재개
    트리거 명시)는 이 기존 의미와 정확히 일치한다. **충돌 없음** — 오히려 target 문서 자신의 "검토 요청
    관점 3" ("won't-do 표기에 대한 정식 컨벤션이 있는가")에 대한 답이 이미 저장소 안에 있다: **있다.**
  - 제안(충돌 아님, 표기 일관성 권고): D2 §3.3 제목/본문에는 확립된 라벨 포맷 `_(비채택 won't-do)_` 를
    그대로 적용해 grep 검색(`grep -rn "won't-do" spec/`) 일관성을 유지할 것을 권장. `변경 2-4` 로 추가하는
    Rationale 절은 `6-websocket-protocol.md` 의 `### R-wontdo-*` 앵커-ID 관례를 따를지, 아니면
    `11-mcp-client.md` 자체 Rationale 절의 기존 서술형 제목 패턴(`### stdio transport 미지원 (§2.2)` 등,
    ID 앵커 없음)을 따를지는 파일별 관례가 다르므로 project-planner 재량. 어느 쪽이든 신규 식별자
    충돌 리스크는 없다.

- **[INFO]** D1/D3 파일 경로 치환 대상 — 실제 저장소 상태와 완전 일치, 충돌 없음
  - target 신규 식별자: 없음 (기존 경로 `plan/in-progress/*` → `plan/complete/*` 치환만)
  - 검증: `git status` 로 실측한 결과 `parallel-p2-followups.md` / `rag-dynamic-cut.md` /
    `spec-sync-mcp-client-gaps.md` 3건 모두 이미 `plan/in-progress/` → `plan/complete/` git rename 이
    staged 되어 있어 draft 의 전제와 일치한다. D3 의 dead-link 목록 5곳(`10-parallel.md:211,230`,
    `execution-context.md:45`, `node-cancellation.md:18`, `cross-node-warning-rules.md:20`)도
    `grep -rn "parallel-p2-followups" spec/` 결과와 정확히 일치 — 누락·초과 없음.
  - `plan/in-progress/rag-quality-improvement.md` 는 D1 이 "신규"라고 부르지만 파일 자체는 **이미
    존재하는 plan**(신규 생성 아님, 이미 `9-rag-search.md:400` 본문·`conventions/rag-evaluation.md:19,159`
    에서 링크 중)이며, `pending_plans` frontmatter 목록에 새로 등재되는 것뿐이다. 경로 문자열 자체가
    다른 의미로 이미 쓰이고 있는 사례는 없음 — 충돌 없음.
  - 목적지 파일명 충돌 여부도 확인: `plan/complete/parallel-p2-followups.md` (신규 rename 목적지)가
    기존 `plan/complete/parallel-p2-followups-done.md`(별개 파일, prefix 다름)와 이름이 겹치지 않음.

- **[INFO]** `cached_capabilities` 필드명 — 단일 사용처, 충돌 없음
  - `credentials.cached_capabilities` 는 `spec/5-system/11-mcp-client.md` (L144, 146, 148, 371) 에서만
    쓰이고 코드에는 미구현 상태다. D2 는 이 필드를 새로 도입하는 것이 아니라 기존에 "Planned" 였던
    표기를 "won't-do" 로 종결할 뿐이므로 신규 식별자 문제가 아니다.

## 요약

target 문서는 스스로 명시한 대로 신규 식별자를 도입하지 않는다 — frontmatter `pending_plans` 재배선,
`status: partial→implemented` 값 전환(기존 enum 값 재사용), 섹션 제목의 "won't-do" 표기 전환(기존 저장소
컨벤션 재사용), 그리고 plan 이동에 따른 dead-link 경로 문자열 치환뿐이다. 요구사항 ID·엔티티/DTO명·API
endpoint·이벤트명·ENV var·신규 spec 파일 경로 중 어느 것도 새로 만들어지지 않으며, 유일하게 "새로
보일 수 있는" 표기인 "won't-do" 는 `spec/5-system/6-websocket-protocol.md` 등 최소 4개 spec + 3개 plan
문서에서 이미 동일한 의미로 확립·사용 중인 컨벤션이라 의미 충돌이 없다. D1/D3 의 경로 치환 목록도 실제
저장소 상태(git status·grep)와 정확히 일치해 누락이나 오기재가 없다.

## 위험도
NONE
