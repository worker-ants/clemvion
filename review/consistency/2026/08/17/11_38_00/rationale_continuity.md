# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 검토 방법
프롬프트 번들이 컨텍스트 예산 초과로 `spec/5-system/` 14개 파일(특히 masking 작업의 핵심인
`14-external-interaction-api.md`)을 절단했으므로, 해당 파일 및 상호 인용되는 파일들을
`Read` 로 직접 열어 검토했다:

- `spec/5-system/14-external-interaction-api.md` (§R17 마스킹 카탈로그 전문, §6.4)
- `spec/5-system/6-websocket-protocol.md` (§4.1 값-패턴 마스킹 캐비엇, §Rationale `llmCalls` strip-only)
- `spec/5-system/12-webhook.md` (§5.3 ingestion 마스킹, §Rationale whack-a-mole 기각 근거)
- `spec/2-navigation/14-execution-history.md` (R-5 boundary masking parity)
- `spec/conventions/node-output.md` (Principle 7 config-echo 원칙)
- `spec/3-workflow-editor/4-ai-assistant.md` (workflow-assistant 자체 마스킹 규칙)
- `spec/1-data-model.md` §2.14 (`Execution.error`/`NodeExecution.error` 구조·응답 마스킹 행)
- `spec/4-nodes/1-logic/12-background.md` §8.2 (자매 표면)
- 번들에 포함된 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`
  전문(§Rationale 포함)

## 발견사항

이번 회차(2026-08-17 기준, `eia-masking-round2`)에서 검토한 범위 내에서 **CRITICAL/WARNING
급 Rationale 연속성 위반은 발견되지 않았다.** 오히려 대상 문서군은 반복된 이전 라운드의
지적을 흡수해 이례적으로 촘촘한 연속성 관리를 하고 있다:

- **번복 시 신규 Rationale 동반**: `Execution.error` egress 마스킹 확대(4곳→6곳)·
  `inputData` 카브아웃 범위(노드 레벨 포함 → `Execution.inputData` 한 컬럼으로 축소, 2026-08-17)
  등 모든 결정 번복에 날짜·이전 서술·정정 사유가 함께 기록됨(예: §R17 "잔여 ②" 블록,
  `1-data-model.md` §2.14 "종전 이 자리는 emit 경로를 '미포함' 으로 단언했으나 더 이상
  사실이 아니다").
- **기각 대안 재검증**: `12-webhook.md` §Rationale 의 "whack-a-mole"(display-time 마스킹
  기각 근거)을 §R17 이 직접 인용하며 "같은 우려가 유효하지만 공유 관문 수렴으로 다르게
  해소했다"고 명시적으로 구분 — 과거 기각 논리를 무시하지 않고 대조 후 자기 결정을 정당화함.
- **원칙 충돌의 명시적 해소**: `node-output.md` Principle 7(config raw-echo 원칙)과 §R17
  값-마스킹이 충돌 소지가 있는데, 양쪽 문서 모두 "backstop 이지 새 예외가 아니다"로
  상호 인용해 정합화(2026-08-17 갱신 표시).
- **적용 범위 열거주의**: §R17 이 스스로 "적용 범위는 총칭이 아니라 열거다"를 반복 강조하고,
  `1-data-model.md`·`background.md` 등 파생 문서가 그 열거를 그대로 참조(값 재기재 금지)해
  카운트 drift(4→6)를 예방하는 구조.
- **선례 미번복 확인**: WS §Rationale `llmCalls` strip-only 결정에 "이 결정은 유지된다
  (2026-08-16 보강)" 캐비엇을 추가해, 새 값-패턴 마스킹이 그 결정을 대체하는 게 아니라
  병존함을 명시.

### [INFO] 다수의 "잔여(미해소)" 항목이 이번 라운드 범위 밖으로 열려 있음
- target 위치: `14-external-interaction-api.md` §R17 — `nodeOutput` 일반 키 allowlist(미구현·
  잔여), `SECRET_LEAK_PATTERNS`(CONNECTION_STRING_PATTERN/STACK_TRACE_PATTERN 잔여 갭, 의도),
  잔여 ③ workflow-assistant 카브아웃(범위 밖 유지)
- 과거 결정 출처: 같은 §R17 내 자기 서술
- 상세: 위반은 아니며, 각 항목이 "왜 지금 안 닫는지" 근거(별건 분리 사유)를 갖추고 있다.
  다만 `eia-masking-round2` 착수 시 이 중 하나를 건드리게 되면, 반드시 §R17 의 해당 불릿을
  "해소"로 갱신하고 표면 열거 카운트(현재 "여섯"/"둘")를 함께 정정해야 한다 — 이 문서가
  이미 두 차례(4→넷→여섯) 겪은 낡은-숫자 재발 패턴이다.
- 제안: round2 작업 계획에 "§R17 열거 카운트 동반 갱신" 체크리스트 항목을 명시적으로 넣을 것.

## 요약
`spec/5-system/14-external-interaction-api.md` §R17 을 정점으로 한 egress 마스킹 결정
네트워크(WS §4.1/§4.4, webhook §5.3, api-convention §5.3/§5.4, node-output Principle 7,
execution-history R-5, data-model §2.14, background §8.2, ai-assistant 마스킹 규칙)를 상호
대조한 결과, 기각된 대안의 무단 재도입이나 합의 원칙의 무근거 위반은 발견되지 않았다.
오히려 모든 결정 번복·범위 확장이 날짜·이전 서술·정정 사유를 갖춘 상태로 교차 인용되어
있어 Rationale 연속성이 매우 양호하다. 유일한 관찰 사항은 다수의 의도적 "잔여" 항목이
열려 있다는 점이며, 이는 위반이 아니라 round2 작업 시 표면 열거를 동반 갱신해야 한다는
운영상 유의사항이다.

## 위험도
NONE
