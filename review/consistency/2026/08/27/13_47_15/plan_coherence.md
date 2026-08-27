# Plan 정합성 검토 — `spec/5-system/` (masking-residuals, impl-done, `13_47_15`)

## 조사 방법
`origin/main...HEAD` 실제 diff(커밋 `348c2b3c`~`6af73b2c8`)를 절대경로 워크트리에서 직접
Read/grep 했다. target·plan 목록 모두 컨텍스트 예산 초과로 프롬프트에 본문이 생략되어 있어
아래 파일을 직접 열었다:

- `spec/5-system/{4-execution-engine,6-websocket-protocol,14-external-interaction-api}.md`
- `spec/conventions/{node-output,egress-masking}.md`
- `spec/2-navigation/14-execution-history.md` · `spec/4-nodes/3-ai/1-ai-agent.md` ·
  `spec/3-workflow-editor/4-ai-assistant.md`
- `plan/complete/masking-expression-egress-split.md` (신규, 이 세션에서 complete 로 이동)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (diff +95줄)
- `plan/in-progress/node-output-redesign/{http-request,send-email,ai-agent,README}.md`
- 직전 라운드 산출물: `review/consistency/2026/08/27/13_25_45/{plan_coherence,RESOLUTION}.md`
- 그 라운드를 해소한 최신 커밋 `6af73b2c8` (`git show`)

이 세션은 이미 한 차례 `--impl-done`(`13_25_45`)이 **BLOCK: YES**를 냈고, 그 CRITICAL·WARNING
2건을 `6af73b2c8`(planner 턴)이 처리했다. 본 라운드(`13_47_15`)는 그 수정 이후 상태를
독립적으로 재검증한다.

## 발견사항

없음. 아래 "확인했으나 문제 없음" 항목이 검토 근거다.

## 확인했으나 문제 없음으로 판정한 항목

- **직전 CRITICAL 완전 해소 확인** — `13_25_45`가 지적한 원칙명 개명(`boundary masking
  parity` → `egress masking parity`) 미전파 3곳(`14-execution-history.md:467`,
  `14-external-interaction-api.md:1530`, `6-websocket-protocol.md:196`)을 `spec/` 전체
  grep 으로 재확인: `boundary masking parity` **0건**, `egress masking parity` **4건** —
  커밋 메시지가 주장한 수치와 실측이 일치한다. `plan/in-progress/` 에도 옛 이름 잔존 0건.
- **직전 WARNING 2(node-output.md Principle 0) 해소 확인** — `config`: 정의가 이제
  "핸들러가 echo 한 **원문** 설정값 — 자격증명도 원문 그대로 담긴다... (Principle 7,
  2026-08-24 정정 — 종전 서술은 취소선)" 으로 Principle 7 신설 문단과 정합한다. 자기
  모순 해소.
- **선행 plan 미해소 없음** — `masking-expression-egress-split.md`(complete)는 착수 전
  `consistency-check --impl-prep`(`19_26_06`) **BLOCK: YES**(보안 Rationale 무효화)를
  거쳐 `spec_impact` 6개 spec 파일로 확장 후 진행했고, 실제 diff 대상 6개 spec 파일과
  **정확히 일치**한다. 미해결 결정을 우회한 흔적 없음.
- **후속 항목 누락 없음** — 이 변경이 만든 두 가지 대가(크로스-노드 자격증명 릴레이,
  safe-by-construction→safe-by-convention 이동)는 `spec/2-navigation/14-execution-history.md`
  R-5 본문에 명시되고, 그 처분은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  에 **"자격증명을 노드 config 에 평문으로 담는 노드 타입 — 참조 간접화 검토"** 항목으로
  정확히 등재되어 미판정으로 남아 있다(택일 강요 없음, 재개 조건 명시). `chatChannel` 라우팅
  컨텍스트의 좁은 마스커 항목, 리뷰 forced-coverage 자기검사 공허화, `DEEP_REDACT_CACHE`
  identity 캐시 항목도 각각 실측 기반으로 별도 등재되어 있다 — 결합 항목을 하나로 뭉개
  나머지를 조용히 흘리는 이 저장소의 재발 패턴이 이번엔 재현되지 않았다.
  `node-output-redesign/{http-request,send-email}.md` 가 독립적으로 문서화한
  "config.headers/body 자유 텍스트 credential 은 정적으로 안 보인다" 관찰은 새 등재 항목이
  겨냥하는 벡터와 정확히 같아 상호 보강이지 누락이 아니다.
- **다른 in-progress plan 과의 충돌 없음** — `plan/in-progress/` 전체를 `maskSensitiveFields`
  ·`handler-output.adapter`·`boundary masking parity`·`저장 시점에 이미 마스킹`·
  `adaptHandlerReturn boundary` 축으로 grep 했을 때, 위 정본 트래커 1개 파일 외에는 매치가
  없다 — 다른 plan 이 제거된 boundary 를 전제로 남아 있는 stale 참조는 없다.
- **완료 plan 의 spec_impact 소급 미수정은 의도적 관례** — `6af73b2c8` 이 편집한
  `14-external-interaction-api.md`/`6-websocket-protocol.md` 2곳은 `masking-expression-
  egress-split.md`(이미 complete)의 원 `spec_impact`(6개) 목록에 없지만, 이는 "완료 스냅샷은
  소급 수정하지 않는다"는 이 저장소의 기존 관례(코드리뷰 `12_52_43` INFO 7 과 동일 판단)를
  그대로 따른 것 — 커밋+RESOLUTION.md 로 근거를 남겼으므로 gap 이 아니다.

## 요약
이 라운드는 새로운 발견사항이 없다. 직전 `--impl-done`(`13_25_45`) 이 낸 CRITICAL(원칙명
미전파 3곳)과 WARNING(Principle 0 자기모순)은 `6af73b2c8` planner 턴에서 실측 근거와 함께
완전히 해소됐고, 본 라운드가 grep 으로 재확인한 결과와도 일치한다. `masking-expression-
egress-split` 완료 plan 은 착수 전 게이트(BLOCK:YES→해소)를 거쳤고 spec_impact 가 실제 diff
와 정확히 일치하며, 이 변경이 새로 만든 두 가지 보안 trade-off(크로스-노드 자격증명 릴레이·
safe-by-convention 이동)는 미해결 결정으로 방치되지 않고 정본 트래커(`spec-sync-external-
interaction-api-gaps.md`)에 재개 조건과 함께 미판정으로 정확히 등재됐다. 다른 in-progress
plan 에 제거된 마스킹 boundary 를 전제로 한 stale 참조도 없다 — 미해결 결정 우회, 선행 plan
미해소, 후속 항목 누락 모두 관측되지 않았다.

## 위험도
NONE
