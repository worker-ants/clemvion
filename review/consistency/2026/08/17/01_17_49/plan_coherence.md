### 발견사항

- **[WARNING]** 실행 plan 이 자신이 확립한 라운드-로그 관행을 이번 라운드(`00_59_32` BLOCK:YES)에만 깼다
  - target 위치: `spec/5-system/6-websocket-protocol.md:200-211`(§4.1 "REST `inputData` 비대상과의 비대칭은 의도된 것이다" 캐비엇) · `spec/5-system/14-external-interaction-api.md:1578-1587`(§R17 "emit 의 `input` 은 마스킹하는데…" 불릿) · `spec/conventions/node-output.md:314-323`(Principle 7 "egress 값-마스킹이 이 금지를 backstop 한다" 캐비엇) — 모두 HEAD 커밋(`39cb0bf1a`)이 신설
  - 관련 plan: `plan/in-progress/eia-fanout-and-internal-data-masking.md`(이 작업의 집행 plan, `## 작업 체크리스트` §209-265, 특히 `:256`·`:263`)
  - 상세: `review/consistency/2026/08/17/00_59_32/SUMMARY.md` 는 **BLOCK: YES**·CRITICAL 2건(모두 project-planner 권한 필요)을 냈다 — ① WS §4.1 신설 마스킹이 같은 PR 이 REST 에서 비대상 처리한 `inputData` 와 자기모순, ② `node-output.md` Principle 7 raw-echo 계약과 값-마스킹의 우선순위 미결정. HEAD 커밋 `39cb0bf1a`("마스킹의 두 계약 우선순위를 명문화")가 그 두 CRITICAL 을 정확히 해소했고, 커밋 메시지 자체도 "impl-done CRITICAL 2건" 이라 명시한다. 그런데 이 집행 plan 은 그동안 모든 리뷰/consistency 라운드(BLOCK:YES 로 끝난 것 포함 — 예: `:256` "`--impl-done` 1R (`23_49_05`) — **BLOCK: YES · CRITICAL 1**." 처럼 실패 라운드도 결과를 남기고 다음 줄에서 처방을 적는 패턴)를 빠짐없이 `[x]`/`[ ]` 체크리스트 항목이나 별도 절로 기록해 왔는데, 이번 `00_59_32` 라운드(BLOCK:YES·CRITICAL 2·project-planner 인계)만 plan 어디에도 등장하지 않는다. `:263` 의 `- [ ] `--impl-done` 재실행 (철회 반영본)` 항목이 그 시도였을 것으로 보이나, 실행 결과(BLOCK:YES→CRITICAL 2→`39cb0bf1a`로 해소)가 반영되지 않은 채 여전히 미체크 상태로 남아 있어 "재실행이 아직 한 번도 없었다" 로 오독된다. 이 파일 자신이 서두에서 "결정이 뒤집히면 요약 표가 가장 늦게 낡는다" 며 같은 클래스의 문제(`23_08_19` requirement W3 · `23_10_41` plan_coherence W2)를 이미 두 번 자기 지적한 이력이 있다 — 이번이 세 번째 재발이다.
  - 제안: `eia-fanout-and-internal-data-masking.md` 체크리스트에 `- [x] `--impl-done` 재실행 (`00_59_32`) — **BLOCK: YES · CRITICAL 2**(WS `input`/REST `inputData` 비대칭·`node-output.md` Principle 7 raw-echo 우선순위, 둘 다 project-planner 인계) → `39cb0bf1a` 로 WS §4.1·EIA §R17·`node-output.md` 세 곳에 캐비엇 신설해 해소` 형태의 항목을 추가하고, `:264` push 게이트 항목 앞에 "재실행 필요 여부(clean impl-done 재확인)"를 명시. 코드 변경은 불요 — plan 문서 갱신만 필요.

이 외에는 확인된 문제가 없다:
- `39cb0bf1a` 가 `plan/in-progress/ie-resume-turn-boundary-cancel.md`에 추가한 "해소 (2026-08-17)" addendum은 `00_59_32` plan_coherence 라운드가 지적한 WARNING(`USER_MESSAGE` 마스킹 비대칭 노트가 새 초크포인트로 실질 해소됐는데 plan이 안 갱신됨)을 제안 문구 그대로 정확히 반영했다 — 재확인 완료, 신규 이슈 없음.
- `spec/1-data-model.md` §2.13/§2.14 `output_data` 행에 마스킹 각주가 추가되어 `00_59_32` WARNING #1(마스킹 미언급으로 원문 오해 소지)도 해소됐다.
- `spec-sync-external-interaction-api-gaps.md`(정본 트래커)의 `[ ]` 미해결 결정 항목(`:225` workflow-assistant LLM 도구의 키-이름 vs 값-패턴 마스킹 우선순위 — "결정 항목" 으로 명시적 보류)은 이번 target 이 건드리지 않았고, 새 캐비엇(credential 값-마스킹이 raw-echo 를 backstop 한다)도 그 미결정 항목과 다른 축(서로 다른 마스킹 **방식** 간 우선순위 vs raw-echo **계약** 대비 마스킹의 존재 여부)이라 충돌하지 않는다.
- `plan/complete/spec-draft-eia-fanout-masking.md`(집행 완료 draft)의 `spec_impact` 에 `spec/conventions/node-output.md` 를 소급 추가한 것은 실제로 이번 라운드가 그 파일을 갱신했으므로 정합하다. 이 draft 서두의 "재집행 금지" 경고(`inputData` 철회 관련)도 이번 target 과 무관하게 그대로 유효하다.
- `pending_plans: spec-sync-external-interaction-api-gaps.md` 의존 관계는 여전히 유효하며 이번 target 이 그 선행 조건을 우회하지 않았다.

### 요약
target(`spec/5-system/**` + `spec/conventions/node-output.md` 최종 커밋 `39cb0bf1a`)은 직전 라운드(`00_59_32`)가 BLOCK:YES로 낸 CRITICAL 2건(WS emit `input` 마스킹과 REST `inputData` 비대상 처리의 자기모순, `node-output.md` Principle 7 raw-echo 계약과 값-마스킹의 우선순위 미결정)을 정확히 해소했고 인접 plan(`ie-resume-turn-boundary-cancel.md`)의 문서 드리프트도 함께 정리했다. 유일한 갭은 이 작업의 집행 plan(`eia-fanout-and-internal-data-masking.md`)이 매 라운드를 빠짐없이 기록해 온 자기 관행을 이번 BLOCK:YES 라운드에서만 놓쳐, "재실행이 있었고 CRITICAL 2건이 나왔다가 해소됐다"는 사실이 plan 문서 어디에도 남지 않은 것이다 — 코드·spec 정합성 자체에는 문제가 없는 순수 plan 문서 정합 이슈다.

### 위험도
LOW
