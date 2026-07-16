# Plan 정합성 Check — Cafe24 카탈로그 규모 실측 정정 + 대형 카탈로그 allowlist 경고 명문화 (spec draft)

## 발견사항

- **[WARNING]** D4 가 처분(3) 이 요구한 "제약 각주"를 충족하지 못함 — "규모 병기"로 축소 대체
  - target 위치: draft `## D4. spec/0-overview.md §6.1 Cafe24 행 — 규모 병기` (target 문서 L76-81) → 실제 반영 대상 `spec/0-overview.md:79`
  - 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 2 `처분 (3)`: "`spec/0-overview.md` §6.1 '구현 완료' 서술에 **제약 각주**." (L30)
  - 상세: plan 의 처분(3) 은 §6.1 의 "…모두 구현 완료" 서술 옆에 **제약(caveat) 을 알리는 각주**를 요구한다 — Critical 2 자체가 "'구현 완료' 라고만 적혀 있어 대형 카탈로그가 `AI_AGENT_TOOL_COUNT_MAX` 기본값을 상시 초과한다는 사실이 안 보인다"는 문제의식에서 출발했기 때문이다. 그런데 D4 는 "카테고리당 평균 ~27 operation, 485 endpoint" 라는 **규모 숫자만** 병기하고, COUNT_MAX 초과·allowlist 필수라는 **제약 자체는 §6.1 어디에도 남기지 않는다** (D4 자신의 근거란도 "각주 대신 규모 병기가 자연스럽다"고 명시적으로 각주를 배제). 결과적으로 §6.1 만 읽는 독자는 (D1~D3 적용 후에도) Cafe24/MakeShop 이 기본 설정으로는 AI Agent 에 안전하게 연결되지 않는다는 사실을 여전히 알 수 없다 — MakeShop 행(161 op, 역시 128 초과)도 동일하게 무각주 상태로 남는다. draft 자신의 "검토 요청 관점 4"("처분(2)(3)(4)가 본 draft 로 전부 소진되는가")에 대한 답은 **아니오** — (3)은 형태만 다른 안내로 대체됐을 뿐 내용상 미해소.
  - 제안: (a) target 을 갱신해 D4 에 §4.2 경고(D2)로의 각주/링크를 추가한다 (예: "…485 endpoint†"+"† 기본 `AI_AGENT_TOOL_COUNT_MAX`(128) 상시 초과 — [§4.2 대형 카탈로그 주의](../4-nodes/3-ai/1-ai-agent.md#42-도구-정의-payload-예산-tool-definition-payload-budget) 참조"), 또는 (b) plan 의 처분(3) 문구 자체를 "규모 병기로 충분함(각주 불요)"으로 재확정하는 결정을 기록한다. 어느 쪽이든 plan 문서(§아래 finding)에 결정 근거를 남겨야 후속 독자가 처분(3)이 "축소 이행"됐음을 알 수 있다.

- **[WARNING]** D2 위치가 처분(2)이 지정한 §1/§2 가 아니라 §4.2 — mcpServers 설정 지점에서 새 경고에 대한 discoverability 없음
  - target 위치: draft `## D2. spec/4-nodes/3-ai/1-ai-agent.md §4.2 — 대형 카탈로그 경고` (target 문서 L60-66) → 실제 반영 대상 `spec/4-nodes/3-ai/1-ai-agent.md` §4.2 (L316-336 부근)
  - 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 2 `처분 (2)`: "`1-ai-agent.md` **§1/§2** 에 '…allowlist 설정 사실상 필수' 경고 명문화." (L29)
  - 상세: D2 의 문안("대형 카탈로그 서버는 `mcpServers[].enabledTools`…로 실제 필요한 operation 만 노출하는 것이 사실상 필수")은 plan 처분(2)의 지시 문구와 표현까지 거의 일치해 의도는 정확히 반영했지만, **배치 위치**가 plan 이 명시한 §1(설정 config 표)/§2(설정 UI) 가 아니라 §4.2(도구 정의 payload 예산 — 내부 메커니즘 절)다. §1 의 `mcpServers` 필드 설명 행(현재 Internal Bridge 링크만 보유, L48 부근)에는 §4.2 신설 note 로의 교차링크가 없다 — 즉 Cafe24/MakeShop 을 `mcpServers` 에 실제로 등록하려는 사용자가 §1 표를 읽는 시점에는 이 경고를 만나지 못하고, 이미 "도구 정의 payload 예산"이라는 내부 메커니즘 절까지 찾아가야 발견한다. plan 이 굳이 §1/§2 를 지목한 이유(설정 시점 가시성)가 무력화된다.
  - 제안: §1 의 `mcpServers` 행 설명 또는 §2 설정 UI 절에 §4.2 신설 note 로의 짧은 교차링크 1줄을 추가하거나, target 을 갱신해 §1/§2 에도 요약 각주를 병기한다. 최소한 plan 처분(2)의 "§1/§2" 지정과 draft 의 "§4.2" 배치가 의도적 재배치임을 draft 근거란에 명시해야 한다 (현재는 "count_max 표 아래" 라고만 되어 있어 왜 §1/§2 를 벗어났는지 설명이 없다).

- **[WARNING]** plan 문서 자체가 이번 draft 의 처분 결과·핵심 재발견(383≠485)을 기록하지 않아 durable 추적 목적이 무력화될 위험
  - target 위치: draft 전체 (특히 헤더 L24-26 "사용자 결정(2026-07-17)")
  - 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 전체, 특히 헤더(L9-14: "그 plan 이 complete 로 이동하면 유일한 durable 텍스트가 소실되므로… 별도 in-progress 앵커로 분리한다")와 Critical 2 처분 체크박스(L28-30)
  - 상세: 이 plan 파일은 스스로 "durable 추적 앵커" 임을 자처하며 만들어졌다 — 관련 정보가 다른 plan 이 complete 로 이동할 때 소실된 전례(4회 연속 WARNING)를 명시적으로 언급한다. 그런데 이번 draft 가 만들어낸 두 가지 핵심 사실 — ① 2026-07-17 사용자 결정("경고 명문화만, 기본값 무변경") ② plan 자신의 전제였던 "Cafe24 383개 실측"(L26, L28)이 실은 **granted-scope 필터된 특정 계정 값**이고 카탈로그 전량은 **485**라는 재발견 — 은 현재 target(spec 파일)에만 반영되고 `spec-drift-ai-agent-outport-countmax.md` 자체는 갱신 대상에 없다. draft 적용 후 이 plan 파일의 처분(1)(2)(3) 체크박스가 그대로 미체크 상태로 남으면, 향후 재발견자가 "383" 이 카탈로그 총량이라는 잘못된 전제를 다시 따라갈 위험이 있다(이 plan 파일이 만들어진 이유와 정확히 같은 종류의 정보 유실).
  - 제안: 이번 draft 적용과 같은 PR(또는 후속 커밋)에서 `spec-drift-ai-agent-outport-countmax.md` 의 처분(1)(2)(3) 체크박스를 `[x]` 로 갱신하고, "383 은 계정별 granted-scope 값이며 카탈로그 총량은 485(2026-07-17 재측정)" 라는 정정 note 와 "사용자 결정(2026-07-17): 기본값 무변경, 경고 명문화만" 을 plan 본문에 남긴다. Critical 1(out-port SoT)은 여전히 open 이므로 plan 파일 자체는 in-progress 로 유지.

## 참고 (문제 없음으로 확인된 부분)

- D1 의 485 수치(및 resource 별 분포: store 105·order 104·product 62·…·personal 5)는 `plan/in-progress/cafe24-backlog-residual.md` G-1-remaining 완료 기록(전 18 resource·485 op, `_overview.md §5` coverage=485, `catalog-sync`/`catalog-docs-drift` green)과 합산치까지 정확히 일치 — cross-plan 교차검증 통과.
- D2 의 "128 은 #828 대응 2차 sanity cap, 1차는 bytes" 서술은 `1-ai-agent.md §12.15` Rationale 원문과 그대로 연속 — 번복 아님.
- D3 의 "권장→사실상 필수" 강도 조정은 `spec/5-system/11-mcp-client.md §5.6` 기존 서술("서버가 노출하는 모든 도구… 노출(기본)")과 상충하지 않으며, 기존에 "allowlist 는 선택적 최적화" 류의 명시적 반대 결정이 없어 결정 번복에 해당하지 않음.
- `ai-agent-tool-connection-rewrite.md`(별도 in-progress plan, `toolNodeIds`/일반 도구 연결 재설계)는 `mcpServers`/MCP 도구와 도구 계열이 달라(prefix `tool_*` vs `mcp_*`) 본 draft 와 교차 영향 없음.
- "백로그(비포함)"로 언급된 compact-schema 모드는 `plan/complete/ai-agent-tool-payload-budget-guardrail.md` §백로그(L55)에 정확히 "별도 plan" 으로 예고돼 있어 draft 의 인용이 정확함 (다만 해당 "별도 plan" 은 아직 in-progress 로 생성되지 않은 상태 — 이번 draft 범위 밖이라 문제 아님).
- draft 의 "검토 요청 관점 4" 문항이 사용한 "처분(2)(3)(4)" 넘버링은 plan 원문(Critical 2 내부는 (1)(2)(3) 까지만 존재)과 문자 그대로는 어긋나지만, Critical 1 의 무번호 "처분"을 (1)로 이어 붙이는 재넘버링으로 해석하면 (2)(3)(4)=Critical2 의 (1)(2)(3) 로 정합적으로 매핑됨 — INFO 수준 표기 혼선이며 위 세 WARNING 과 별개로 별도 조치 불요(단, plan 체크박스 갱신 시 이 매핑을 명시해 두면 향후 혼동 방지).

## 요약

Draft 는 plan `spec-drift-ai-agent-outport-countmax.md` Critical 2 의 처분(1)(2)를 정확한 재측정(485, 383 과의 레이어 구분 포함)과 정합적인 문구로 충실히 이행하고, 두 곳 모두 기존 spec 의 Rationale·서술과 연속성을 유지해 "결정 번복" 은 없다. 다만 처분(3)("제약 각주")은 "규모 병기"로 형태가 축소돼 원래 문제의식(§6.1 "구현 완료" 만 읽으면 대형 카탈로그 allowlist 필수를 알 수 없음)이 실질적으로 남아 있고, 처분(2)의 지정 위치(§1/§2)가 §4.2 로 옮겨져 설정 시점 발견 가능성이 약화됐으며, 이번 draft 가 만들어낸 핵심 재발견(383≠485)과 사용자 결정(2026-07-17)이 durable 추적을 표방하는 plan 파일 자체에는 기록되지 않아 그 plan 이 애초에 방지하려던 정보 유실 패턴이 재발할 위험이 있다. 세 건 모두 CRITICAL(미해결 결정 우회)은 아니며 후속 반영이 필요한 WARNING 수준이다.

## 위험도

MEDIUM
