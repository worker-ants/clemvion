# Rationale 연속성 검토 — `plan/in-progress/planner-doc-batch.md`

## 발견사항

- **[CRITICAL] `spec_impact` 9건 중 4건(conventions 계열)의 Rationale 이 payload 에서 통째로 누락 — 정확히 target 이 스스로 경계한 그 실패 모드**
  - target 위치: `plan/in-progress/planner-doc-batch.md` frontmatter `spec_impact` 전체 9건, 특히 `spec/conventions/node-output.md`(B1) · `spec/conventions/egress-masking.md`(B2) · `spec/conventions/chat-channel-adapter.md`(B6) · `spec/conventions/conversation-thread.md`(B4)
  - 과거 결정 출처: 이번 호출의 `_prompts/rationale_continuity.md` 자체(= 본 검토의 입력 payload)
  - 상세: `_prompts` 청크를 `@bundle-file` 마커로 전수 스캔하면 `spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md`·provider 3종(`telegram`/`slack`/`discord`)·`4-nodes/6-presentation/5-template.md` 등 총 76개 `#### spec/...` 헤더가 실린다. 그러나 `spec/conventions/node-output.md`·`egress-masking.md`·`chat-channel-adapter.md`·`conversation-thread.md` 는 이 76개 헤더 목록 어디에도 **헤더 자체가 없다** — `spec/5-system/4-execution-engine.md` 등 다른 대형 문서처럼 "본문 생략됨 — 컨텍스트 예산 초과" placeholder 조차 없이, 아예 번들에서 빠졌다. 정작 target 은 이 정확한 실패 모드를 알고 있어 작업 체크리스트 첫 항목에 "`/consistency-check --spec` — `_prompts` 청크 헤더로 `spec/conventions/` 적재 확인(이 저장소가 기록한 예산 절단 이력)" 을 명시했는데, 지금 이 rationale-continuity 서브체크 자체가 그 우려를 실증한다(`spec/conventions/` prefix 는 grep 상 `.md#`(cross-link) 형태로만 등장하고 `#### \`spec/conventions/...\`` 헤더로는 한 번도 등장하지 않음). B1(Principle 0 wire-only 키 각주)·B2(egress-masking §2 파이프라인 순서)·B6(chat-channel-adapter 사본→정본 링크)·B4(conversation-thread frontmatter)는 정확히 이 4개 문서의 본문 편집인데, 그 문서들 자신의 `## Rationale`(기각된 대안·설계 원칙)을 이 검토가 한 줄도 보지 못했다.
  - 제안: (a) 이 SUMMARY 를 소비하는 쪽(merge-coordinator/뒤이은 orchestrator)이 "Rationale 연속성 CRITICAL/WARNING 0건" 을 "B1/B2/B4/B6 은 안전하다" 로 오독하지 않도록 이 갭을 명시적으로 전달할 것. (b) B1/B2/B4/B6 착수 직전 planner 가 해당 4개 conventions 파일의 `## Rationale` 을 **직접(Read 도구로) 열어** 기각된 대안·명시 invariant 유무를 수동 확인 — target 의 "검증 기준" 문단이 이미 "미러 스윕은 주장 기반" 이라 요구한 정신과 정합. (c) 가능하면 orchestrator 쪽 번들러가 `spec_impact` 목록에 든 파일은 예산 절단 대상에서 **우선 제외**하도록 개선 검토(반복 재발 항목 — `feedback_consistency_spec_mode_budget.md`).

- **[WARNING] B6 "사본 4곳 → 정본 링크" 통합이 이 저장소가 과거에 철회한 "mirror dedup" 판단과 같은 형태일 위험 — 근거 문서(chat-channel-adapter.md Rationale) 미확인 상태로 실행하면 안 됨**
  - target 위치: `plan/in-progress/planner-doc-batch.md` 표 B6 행 + `## 작업` 체크리스트 `B6 사본 4곳 → 정본 링크`
  - 과거 결정 출처: 이 저장소는 과거 cafe24/makeshop provider 문서의 대량 중복(~1,600줄)에 대해 "DRY 재발견은 spec 의도를 무시한 오탐" 으로 통합 시도를 철회한 선례가 있음(동일 부류의 "여러 문서에 흩어진 반복 서술을 한 곳으로 합친다" 류 리팩터). 다만 이번 대상은 cafe24/makeshop 이 아니라 "래퍼/도메인 구분" 서술 4곳이라 **동일 사안은 아니다** — 성격이 다를 수 있음.
  - 상세: 이 번들에서 확인 가능한 범위 안에서는 `chat-channel-adapter.md` 를 향한 참조가 R-CCA-8(native form modal 예외)·§1.3(`ChatChannelInternalEvent`)·§3.1(execution-failed 분류)·§4.1(file 검증 divergence) 등 여러 spec 에서 "정본"으로 인용되고 있어, chat-channel-adapter.md 자체가 이미 여러 SoT 항목의 원천 역할을 하는 구조로 보인다. 그러나 "사본 4곳" 이 의도적 중복(각 문서가 로컬 컨텍스트에서 재진술해야 하는 이유가 있는 경우)인지, 단순 drift(정정 대상)인지는 chat-channel-adapter.md 자신의 `## Rationale` 에 적힌 근거를 봐야 판정 가능한데 위 CRITICAL 항목대로 그 본문이 이번 payload 에 없다.
  - 제안: B6 착수 시 "사본 4곳" 각각에 대해 (i) 그 문서가 왜 사본을 두었는지 원 커밋/PR 사유를 `git log -S`로 역추적 (ii) chat-channel-adapter.md 의 Rationale 에 "이 서술은 각 provider/문서에 반드시 재진술돼야 한다" 는 명시적 근거가 있는지 확인 후 통합. 근거가 없다면 통합 진행, 있다면 target 의 "정본 링크로 대체" 를 그 근거에 맞게 조정(예: 요약은 남기고 상세만 링크).

- **[INFO] B5(`background:run:{id}` 를 WS §3.2 채널 패턴 표에 추가)는 기존 Rationale 과 정합 — 별도 조치 불필요**
  - target 위치: `plan/in-progress/planner-doc-batch.md` 표 B5 행
  - 과거 결정 출처: `spec/4-nodes/1-logic/12-background.md` `## Rationale` § "WebSocket 채널 격리 결정"
  - 상세: `background.md` Rationale 은 `background:run:<id>` 채널을 `execution:<id>` 와 별도로 격리 운영하기로 한 결정과 그 근거(메인 흐름 구독자 오염 방지·본문 종료 시 자동 close·backgroundRunId 를 아는 사람만 구독 가능)를 이미 명시하고 있다. WS §3.2 표에 이 채널이 없는 것은 문서 간 미러링 누락(drift)이지 설계 재검토 대상이 아니므로, target 이 이를 "고친다" 로 다루는 것은 기존 Rationale 과 충돌하지 않는다.
  - 제안: 없음(정보성 확인).

- **[INFO] B7(provider 3곳 `output.rendered` 판정)은 WS §4.4 wire caveat Rationale·2026-08-13 갱신 문단이 세운 "판정은 문장의 주어에 따라 갈린다" 원칙과 정합 — 선제적 결론 없이 판정만 수행하는 접근이 적절**
  - target 위치: `plan/in-progress/planner-doc-batch.md` `## B7 은 "고친다" 가 아니라 "판정한다"` 절
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` § "§4.4 wire 필드 caveat" 및 그 안의 (2026-08-13 갱신) 문단("같은 규칙이 입력 사정에 따라 다른 결론을 낸 것이지 번복이 아니다")
  - 상세: target 은 `#1209` 에서 동일 판단을 보류했던 전례를 인정하고, "표 전체를 읽고 판정" 하며 "현행 유지로 나와도 근거를 남긴다" 고 명시해 무근거 번복을 하지 않겠다는 태도를 보인다. 이는 WS Rationale 이 여러 차례(§4.4 wire caveat, R14 범위 명확화 등) 보여준 "판정 범위를 정확히 좁히고 그 근거를 기록한다" 패턴과 일치한다.
  - 제안: 없음(정보성 확인). 다만 판정 결과가 "wire 기준으로 정정" 쪽으로 나올 경우, WS §4.4 의 "직접 재작성 대신 caveat + 오너십 분리" 패턴(EIA §6.2 를 SoT 로, WS 는 caveat 만)을 참고해 provider 문서에도 동일한 caveat 스타일을 적용할지 검토할 가치가 있다.

## 요약

target 의 B3·B5·B7(및 B4)은 이번 payload 에 실린 Rationale(주로 `6-websocket-protocol.md`·`12-background.md`·`14-external-interaction-api.md`·provider 3종)과 충돌하지 않으며, 오히려 기존에 명시된 결정(background 채널 격리, wire caveat 판정 원칙)을 정확히 따르는 문서 정합화 작업으로 보인다. 그러나 이 검토의 신뢰도에는 구조적 한계가 있다 — target 이 직접 편집을 예고한 spec_impact 9건 중 4건(정확히 `spec/conventions/` 하위 node-output.md·egress-masking.md·chat-channel-adapter.md·conversation-thread.md)의 `## Rationale` 이 이번 payload 조립 과정에서 예산 초과로 완전히 누락됐다 — 다른 대형 문서처럼 "생략됨" placeholder 조차 없이 빠졌다. 이 4건이 각각 B1·B2·B4·B6 항목의 직접 대상이라, 그 항목들에 대해서는 "기각된 대안 재도입" 여부를 이 검토가 사실상 확인하지 못했다. 특히 B6(사본→정본 링크 통합)은 이 저장소가 과거 유사 리팩터(cafe24/makeshop 미러)를 "의도된 중복" 근거로 철회한 선례가 있어, 근거 문서 미확인 상태로 실행하면 CRITICAL 급 오탐/재발 위험이 있다.

## 위험도

MEDIUM
