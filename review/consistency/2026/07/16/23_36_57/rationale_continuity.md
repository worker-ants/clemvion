# Rationale 연속성 검토 결과

대상: `spec-draft-plan-grooming.md` (D1 9-rag-search / D2 11-mcp-client / D3 parallel-p2-followups 링크 갱신)

검토 방법: target draft 의 각 근거 주장을 실제 `spec/5-system/9-rag-search.md`·`spec/5-system/11-mcp-client.md`·
`spec/4-nodes/1-logic/10-parallel.md`(+ 관련 conventions 3편) 의 현재 `## Rationale` 원문, 그리고 인용된
plan 문서(`plan/in-progress/rag-quality-improvement.md`, `plan/complete/{rag-dynamic-cut,spec-sync-mcp-client-gaps,
parallel-p2-followups}.md`)의 실제 내용과 대조.

## 발견사항

- **[WARNING]** D3 — `waitAll:false` "별도 마이그레이션 작업" 약속이 추적 근거 없이 사라질 위험
  - target 위치: draft "D3. plan 링크 경로 갱신" 절, `10-parallel.md L211` 행 및 "**추가 정정 (stale 앵커)**" 문단
  - 과거 결정 출처: `spec/4-nodes/1-logic/10-parallel.md` §waitAll=false 근거(L211) — "옛 워크플로우 호환: DB 에
    `config.waitAll: false` 가 저장된 케이스는 실행 시점에 schema validate 가 reject … **별도 마이그레이션 작업은
    `parallel-p2-followups.md §2-E` 의 후속 항목**"
  - 상세: 실측 결과 `plan/complete/parallel-p2-followups.md` 에는 §2-E 가 없을 뿐 아니라(구조: §1/§2~4/§5/§6/§7),
    문서 전체에 `waitAll` 문자열이 **한 번도 등장하지 않는다**. 원 결정 라벨("결정 A/D/E/H/I/K")의 출처였던
    (지금은 저장소에서 완전히 사라진, archive 로도 미보존) `plan/(complete|in-progress)/parallel-p2.md` 가
    2026-05-30 "parallel-p2 finalize" 커밋에서 통째로 없어지며 §2-E 도 함께 유실된 것으로 보인다. 즉 이 "마이그레이션
    작업 후속" 약속은 단순 오기(stale anchor)가 아니라 **추적 주체가 완전히 사라진 미해결 커밋먼트**다. draft 의
    처방("정정하거나 절 참조를 제거한다")은 앵커만 고치거나 아예 참조를 지우는 두 옵션을 열어두는데, 후자를 택하면
    "옛 워크플로우 데이터 정합화" 라는 실질 작업 약속이 근거 기록 없이 조용히 증발한다 — 검토 관점 3(결정의
    무근거 번복) 에 해당.
  - 제안: 단순 링크 정정이 아니라 **판단**을 먼저 내려야 한다 — (a) 런타임 reject-and-ask-user-to-fix 가 이미
    영구적으로 충분한 처리(즉 "마이그레이션 작업"은 필요 없어졌다)라면 L211 문구에서 "별도 마이그레이션 작업 후속"
    문장 자체를 삭제하고 그 판단 근거를 `## Rationale`(§waitAll=false 근거)에 1~2문장으로 명시할 것. (b) 여전히
    유효한 요구라면 신규 plan(또는 기존 `node-output-redesign/parallel.md` 같은 후속 문서)에 항목으로 재등재하고
    그 경로로 링크를 갱신할 것. 어느 쪽이든 "왜 이 약속이 이렇게 처리됐는지" 를 Rationale 에 남겨야 검토 관점 3 을
    충족한다.

- **[INFO]** D2 — "절 단위 won't-do 표기 관례" 에 대한 draft 의 자문(自問)에 이미 답이 존재
  - target 위치: draft "검토 요청 관점" §3 — "won't-do 표기에 대한 정식 컨벤션이 있는가 … 관례 확인 요망"
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → `### R-wontdo-rawws-rest. raw-WS
    전제·REST 대체 항목 비채택 (결정 2026-07-08)` — 4개 §(§1.2/§1.3/§4.2/§8) 를 "Planned → 비채택 won't-do" 로
    정식 전환한 선례. 패턴: (1) 절 제목에 `_(비채택 won't-do — REST 대체)_` 접미, (2) 본문에 `**비채택 (won't-do)**`
    인라인 콜아웃 + 근거, (3) `## Rationale` 에 전용 anchor ID(`R-wontdo-rawws-rest`) 절 신설(전환 사유·폐기
    대안·전환 일자 포함), (4) 표/요약에 동일 표기 전파.
  - 상세: D2 가 제안하는 3.3 절 처리(제목 전환 + L144/L371 갱신 + Rationale 신규 절)는 이 선례와 **구조적으로
    이미 일치**하지만, draft 자체가 "관례 확인 요망" 이라 명시해 이 선례를 아직 참조하지 못한 상태다. 이는
    합의 원칙 위반이 아니라 — 오히려 기존에 합의된 (비록 정식 convention 문서화는 안 된) 패턴을 재발명 없이
    따를 기회다.
  - 제안: D2 §3.3 신규 Rationale 절에 `spec/5-system/6-websocket-protocol.md#r-wontdo-rawws-rest` 를 선례로
    명시 인용하고, 동일하게 전용 anchor(`R-wontdo-cached-capabilities` 등) 를 부여할 것. 여력이 되면
    `spec/conventions/spec-impl-evidence.md §3` (status 라이프사이클 표) 에 "절 단위 won't-do 표기는 `status:
    archived`(문서 폐기) 와 별개 — 본문에 `_(비채택 won't-do)_` + Rationale 전용 절로 표기" 한 줄을 정식 등재해
    두 사례(websocket-protocol, mcp-client)가 우연의 일치가 아니라 관례임을 SoT 화할 것.

- **[INFO]** D1 — `9-rag-search.md` §Rationale 4개 근거 항목 실측 대조 결과, 재도입·번복 없음 (확인 기록)
  - target 위치: draft "D1" 절 "근거" 문단 — 멀티-KB 리랭크·`ef_search` 정밀 튜닝·D2 정량 임계 A/B·재임베딩
    트리거 4건
  - 과거 결정 출처: `spec/5-system/9-rag-search.md` `## Rationale` — "v1 범위 — 단일 KB 한정"(멀티-KB 리랭크
    후속), "pgvector HNSW `ef_search`"(프로덕션 부하 정밀 튜닝 후속), "왜 D2 conditional escalate 를 지금
    도입하나"(P0 골든셋 A/B 확정 후속), "왜 이번 범위를 경고 노출로 한정했나"(재임베딩 트리거 후속)
  - 상세: 4건 모두 실제 spec 본문에 "후속" 으로 명시돼 있고, `plan/in-progress/rag-quality-improvement.md §7`
    이 그 중 최소 2건(D2 정량 임계=§7.C, `ef_search` 정밀 튜닝=§7.E)을 명시 추적한다(멀티-KB 리랭크·재임베딩
    트리거는 §7 머리말 문장에만 언급되고 §B~E 개별 체크박스는 없음 — 경미한 트래킹 밀도 차이이나 "SoT 승계"
    주장 자체를 무효화하지는 않음). `status: partial` 유지 + `pending_plans` 재배선은 spec-impl-evidence
    §3(c)/R-5 의 "spec 은 항상 책임 plan 을 가리켜야 한다" 원칙과 정합하며, 과거 어디에도 "`rag-dynamic-cut`
    종결 시 무조건 `implemented` 승격" 이라는 명시적 합의는 없어 draft 자신의 우려(검토 요청 관점 2)는
    기각해도 좋다.
  - 제안: (경미) `rag-quality-improvement.md §7` 에 멀티-KB 리랭크·재임베딩 트리거 두 건도 B~E 중 한 섹션에
    체크박스로 명문화하면 "SoT 승계" 주장이 문장 언급이 아니라 추적 가능한 항목으로 강화된다 — 이번 PR 의
    필수 차단 사유는 아님.

- **[INFO]** D2 — cross-spec 파급 없음 확인
  - target 위치: draft "검토 요청 관점" §1
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/2-navigation/4-integration.md` 및 전체 spec/`content/docs`
    MDX 를 `cached_capabilities`/`capabilities 캐시` 로 grep 한 결과 `spec/5-system/11-mcp-client.md` 단
    1곳에만 존재. `implemented` 승격이 다른 문서 서술과 충돌하지 않는다.

## 요약

target draft 의 3개 변경(D1/D2/D3) 은 대체로 근거가 실제 spec Rationale·plan 문서와 잘 대조되며, 기각된 대안을
이유 없이 재도입하거나 합의 원칙을 위반하는 사례는 발견되지 않았다 — D1 의 `partial` 유지는 spec-impl-evidence
R-5 "spec→plan 역방향 책임" 원칙을 오히려 충실히 따르는 사례이고, D2 의 §3.3 won't-do 전환은 `6-websocket-protocol.md`
`R-wontdo-rawws-rest` 에 이미 확립된 절 단위 won't-do 관례와 구조적으로 일치한다(다만 draft 는 아직 그 선례를
인지·인용하지 못했다). 유일하게 실질적인 위험은 D3 가 다루는 `10-parallel.md L211` 의 "별도 마이그레이션 작업"
약속이다 — 이 약속의 추적 주체(§2-E)가 plan 통폐합 과정에서 완전히 유실되어, 단순 링크 정정만으로는 "이 커밋먼트를
계속 살릴지 폐기할지"에 대한 의식적 결정과 새 Rationale 기록이 빠질 위험이 있다.

## 위험도

MEDIUM — CRITICAL 은 없음. WARNING 1건(D3 §2-E 유실 커밋먼트)이 "결정을 판단 없이 조용히 지울 위험"이라 승인
전 명시적 처분(유지/재등재 vs 폐기+Rationale 기록)이 필요하나, target 의 핵심 3개 결정(D1/D2) 자체는 Rationale
연속성을 해치지 않는다.
