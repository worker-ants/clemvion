# Rationale 연속성 검토 — spec/5-system/ (EIA masking follow-ups, 2026-08-17 10:50 라운드)

## 조사 방법
- prompt_file 은 컨텍스트 예산 초과로 diff 원문(`<git diff origin/main...HEAD -- code_areas>`)과
  다수 `spec/5-system/*.md` 본문이 절단돼 있어(⚠️ 명시됨), 워크트리(HEAD, cwd 가 실제로 이
  worktree 였음을 `pwd`/`git rev-parse --show-toplevel`/`git branch --show-current` 로 확인)에서
  `git diff origin/main...HEAD -- spec/ codebase/` 를 직접 조회해 대체했다.
- 이 브랜치는 이미 4라운드 이상의 `rationale_continuity` 검토를 거쳤다
  (`review/consistency/2026/08/16/{22_22_36,23_10_41,23_49_05}/`,
  `review/consistency/2026/08/17/{00_22_23,00_47_04,00_59_32,01_17_49}/`). 가장 최근 완료본인
  `01_17_49/rationale_continuity.md` 가 낸 WARNING 1건·INFO 1건이 이후 커밋들
  (`39cb0bf1a` — 01:17:42, 해당 리뷰와 거의 동시점 / `83436ed45` — 10:26 / `09286d542` — 10:50)에서
  해소됐는지를 우선 재확인하고, 그 이후 변경분에 새 Rationale 연속성 문제가 있는지 점검했다.

## 발견사항

- **[WARNING]** (이월, 미해소) EIA §R17 egress 마스킹과 webhook ingestion-마스킹 Rationale의
  "whack-a-mole" 논거가 여전히 이름 붙여 반박되지 않음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "언제 가리는가 —
    ingestion-time 과 egress-time 이 공존한다" 절 (라인 1601-1612 부근)
  - 과거 결정 출처: `spec/5-system/12-webhook.md` `## Rationale` → "민감 헤더 마스킹 —
    ingestion(저장) 시점 채택 (2026-07-07)" — "display(응답) 시점 마스킹"을 **명시적으로 기각**하며
    두 근거를 든다: (a) DB 잔존 = 유출 표면, (b) *"표면별 마스킹의 whack-a-mole 을 원천 차단"*.
  - 상세: 현재 target 텍스트는 (a) 논거에는 정면으로 응답한다("그 대가로 얻는 진단 가치와
    저울질한 결과가 egress-only"). 그러나 (b) whack-a-mole 논거는 여전히 이름 붙여 반박되지
    않는다. 이 우려는 이 브랜치 자체에서 재차 실증됐다 — `01_17_49` 시점 이후에도 추가
    라운드가 있었다: 노드 레벨 `inputData` 카브아웃을 한 번 더 잘못 확대했다가(WS↔REST
    flip-flop CRITICAL) `83436ed45` 에서 되돌리고, 트래커·유저가이드·DTO 5곳을 stale 상태로
    남겼다가 `09286d542` 에서 재동기화했다. 즉 whack-a-mole 패턴(표면이 하나씩 발견되고,
    되돌리고, 문서가 뒤처지는 사이클)이 `01_17_49` 리뷰 **이후**에도 최소 2 라운드 더
    관측됐다 — 이 finding 이 지목한 리스크가 계속 유효함을 재확인한다.
  - 이번 라운드에서 새로 확인한 완화 요인: `83436ed45`/`09286d542` 는 재발할 때마다 캐너리
    테스트를 "개수 나열"에서 "방향별 표"로 바꾸는 등 구조적 수렴 시도를 거듭했고, 마스킹
    자체는 소수의 공유 관문(`toResponseExecution`·`WebsocketService.emitExecutionEvent`/
    `emitNodeEvent`·`toTerminalErrorPayload`)에 계속 수렴돼 있다(코드 확인:
    `MASKED_INPUT_DATA_REASON`·`WIRE_PRESERVED_FIELDS` 심볼이 실제로 존재). 따라서 whack-a-mole
    이 표면 자체(어디를 가릴지)에서는 반복되고 있지만, 각 표면이 가려지는 **메커니즘**은
    산발적 패치가 아니라 계속 같은 소수 관문으로 모이고 있다 — 이는 §R17 이 아직 텍스트로
    명시하지 않은 반박 논거이며, 이번에도 여전히 빠져 있다.
  - 제안 (이전 라운드와 동일, 아직 미채택): §R17 "언제 가리는가" 절에 "webhook Rationale 의
    (b) whack-a-mole 우려는 표면 발견 자체에서는 이 브랜치에서도 반복 관측됐으나, §R17 은 이를
    산발적 호출부 패치가 아니라 소수의 공유 관문으로 수렴시켜 새 emit/read 경로가 관문만
    통과하면 마스킹을 구조적으로 상속하게 한다"는 취지의 한 문장을 추가하면 닫힌다. CRITICAL
    로 올리지 않는 이유는 이전 라운드와 동일 — 데이터 클래스 구분·(a) 논거 반박은 이미 존재하고
    타당하며, 이 finding 은 named 논거 하나를 마저 닫으라는 보완 요청이다.

- **[INFO]** (이월, 미해소) `boundary masking parity` 원칙 인용의 원 출처 표기가 여전히 한 홉
  생략돼 있음
  - target 위치: `spec/5-system/6-websocket-protocol.md` 라인 195 — "`execution:<id>` 구독
    인가가... EIA §R17 의 boundary masking parity 원칙과 같은 근거다"
  - 과거 결정 출처: 원 출처는 `spec/2-navigation/14-execution-history.md` R-5. EIA §R17 자신도
    "R-5 의 직접 대상은 Config 탭이라... 원칙을 원용한 것이지 기존 판정이 아니다"라고 스스로
    명시해 뒀다(14-external-interaction-api.md 라인 1509-1511).
  - 상세: WS 문서는 이를 "EIA §R17 의" 원칙으로 인용해 인용의 인용이 마치 EIA 가 직접 확립한
    원칙인 것처럼 읽힌다. 결론(같은 수신 인구 → 같은 보호 필요)은 매 단계에서 타당하게
    재적용되므로 실질적 오류는 아니다.
  - 제안: 급하지 않음. WS §4.1 캐비엇에 "(원 출처 [실행 내역 R-5](../2-navigation/14-execution-history.md#r-5))"
    한 홉만 추가하면 계보가 완전해진다.

## 확인했지만 문제 없음으로 판정한 항목 (이번 라운드 재검증)

- `node-output.md` Principle 7 "config 그대로 echo" 원칙과 신규 egress 값-마스킹의 관계 —
  "절대 echo 금지" 목록을 egress 에서 집행하는 backstop 으로 명시 정합화(신규 예외 아님으로
  스스로 규정, 라인 314-323). WS §4.1 에도 동일 캐비엇이 원용돼 있어 두 문서가 정합.
- `Execution.inputData` 카브아웃(재제출-오염 회피)이 `NodeExecution.inputData`/WS `input` 로
  잘못 확대됐던 초판을 `83436ed45` 가 "레벨" 축으로 재작성하며 명시적으로 되돌림 — 사유
  (WS↔REST flip-flop CRITICAL, 실측 소스 코드 라인 인용)를 새 Rationale 로 함께 적어 뒀으므로
  "결정의 무근거 번복" 에 해당하지 않음. `13-replay-rerun.md`/`1-data-model.md`/
  `6-websocket-protocol.md` 세 곳 모두 표로 방향을 일치시켜 mirror drift 없음.
- `llmCalls` strip-only 결정(WS Rationale, 2026-06 확정)은 새 값-패턴 마스킹에서
  `WIRE_PRESERVED_FIELDS` 로 명시 제외 유지 — "이 결정은 유지된다" 캐비엇이 별도로 박혀 있고
  코드(`websocket.service.ts`)로도 확인됨.
- `spec/2-navigation/14-execution-history.md` R-5 의 "R-5 의 대상 범위" addendum(2026-08-16)이
  자신의 boundary masking parity 근거가 write-시점(config echo) 전용이고 `Execution.error`/
  `outputData` egress 마스킹과는 별개 정책임을 스스로 경계 지어 둬, 두 정책이 하나로 오독될
  여지를 차단.
- `spec/5-system/13-replay-rerun.md` §14.2 "raw config echo 정책 — Re-run 의 핵심 전제"는
  워크플로 정의의 `rawConfig`(엔진 컨텍스트) 를 가리키고, 새로 추가된 "config 값-마스킹" 은
  이미 실행된 `NodeHandlerOutput.config`(응답/emit 전용) 대상이라 직접 참조 대상이 달라 충돌
  없음 — Re-run 은 이전 실행의 emit 된 config 를 소비하지 않고 현재 워크플로 정의에서 다시
  구한다.
- `spec/5-system/3-error-handling.md`·`6-websocket-protocol.md` 의 `nodeName`→`nodeLabel` 정정은
  이전 PR 이 "본 PR scope 밖 — 별도 정합 필요"로 명시적으로 유보해 둔 항목을 이번 PR 이
  이어받아 완결한 것으로, 과거 결정을 뒤집는 것이 아니라 예정된 후속 작업.
- `spec/5-system/12-webhook.md` §5.3 신규 캐비엇("스코프는 알려진 민감 헤더 key 한정")은
  ingestion 마스킹 Rationale 의 적용 범위를 좁히는 게 아니라 그 범위를 더 명확히 문서화한
  것 — 기존 Rationale 채택 근거(단일 소스 커버)와 충돌 없음.

## 요약

이번 라운드는 새 CRITICAL 을 만들지 않았다. `01_17_49` 라운드가 지목한 WARNING(webhook
ingestion-마스킹 Rationale 의 "whack-a-mole" 기각 근거가 §R17 egress 마스킹에서 이름 붙여
반박되지 않음)은 이후 두 라운드(`83436ed45`·`09286d542`)를 더 거치는 동안에도 텍스트로
해소되지 않았고, 오히려 그 사이 whack-a-mole 패턴이 한 번 더 관측(노드 레벨 카브아웃 오확대
→ 되돌림 → 문서 5곳 재동기화)돼 이 우려의 유효성을 재확인시켰다. 다만 표면 발견은 반복돼도
마스킹 메커니즘 자체는 계속 소수의 공유 관문으로 수렴하고 있어(코드로 확인), CRITICAL 로 볼
사안은 아니다. 그 밖의 이번 브랜치 변경(레벨 축 재정리, config raw-echo 와의 관계, R-5 boundary
parity 원용, nodeLabel 정정)은 전부 과거 결정을 명시적으로 인용·검증하며 진행됐고, 번복이
있었던 곳(inputData 노드 레벨 카브아웃)도 새 Rationale 을 동반해 정당하게 되돌렸다.

## 위험도

LOW
