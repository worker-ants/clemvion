# Rationale 연속성 검토 결과

대상: `spec/5-system/4-execution-engine.md` (impl-done, diff-base=origin/main)

## 조사 방법

payload 의 "관련 Rationale 발췌" 섹션은 `spec/0-overview.md` ~ `spec/2-navigation/4-integration.md` 까지만 포함하고 크기 제한으로 truncate 되어, 정작 이번 diff 와 직접 관련된 `spec/5-system/4-execution-engine.md` §7.5.1, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md` 의 Rationale/본문은 payload 에 없었다. 이 갭을 메우기 위해 워크트리에서 관련 spec 원문과 `git diff origin/main...HEAD -- spec/**` 를 직접 대조했다.

## 발견사항

### [INFO] `STATE_MISMATCH` nodeId 강제 정합 결정이 canonical `## Rationale` 대신 본문 inline 각주에만 존재

- target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 (line 350) — `> **STATE_MISMATCH 강제 정합 (2026-07)**: ...(nodeId=2026-07-14)` 블록쿼트
- 과거 결정 출처: 같은 문서 하단 `## Rationale` (line 943~) — `### R1.`~`### R19.` 식으로 굵직한 결정마다 전용 항목을 두는 이 문서 자체의 관례
- 상세: 이번 PR 은 "명령의 nodeId 가 실제 대기 노드와 다르면 종전엔 202 로 조용히 수용되던 결함을, 계약(EIA-IN-13/§5.1)이 원래 요구하던 409 STATE_MISMATCH 로 강제 정합시킨다" 는, 클라이언트 가시 동작을 바꾸는 결정을 내렸다. 근거 서술 자체는 명확하고 날짜(2026-07-10 표면 / 2026-07-14 nodeId)까지 명시해 "무근거 번복" 은 아니지만, 이 문서의 다른 유사 결정들(R17 처럼 "결정 2026-06-25" 라벨을 붙여 canonical Rationale 항목으로 등재)과 달리 이번 건은 본문 인라인 각주로만 존재하고 하단 `## Rationale` 목록에 대응 항목이 없다. `CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 원칙과도 위치상 어긋난다.
- 제안: `spec/5-system/14-external-interaction-api.md` 의 `## Rationale` 에 `### R20. STATE_MISMATCH nodeId 강제 정합 — 202 수용 결함 교정 (2026-07-14)` 류 항목을 신설해 본문 각주 내용을 요약 반영(선택 사항, 실질 리스크는 낮음).

## 정합성이 확인된 주요 항목 (참고용 — 발견사항 아님)

diff 가 건드리는 세 축 모두 target 문서 및 인접 spec 의 기존/동시 개정 Rationale 과 충돌 없이 정합했다:

1. **§7.5.1 nodeId 검사 재설계** (`resolveWaitingNodeExecutionId` 의 `expectedNodeId` optional 화 + `in_process_trusted` scope 단위 면제) — `spec/5-system/4-execution-engine.md` 의 `## Rationale` "### 대기 표면 ↔ 명령 매트릭스 publisher 사전 검증 (§7.5.1, 2026-07-11)" 항목이 이미 이 설계(진입점별 커버리지 표 포함)를 문서화하고 있고, 이번 diff 는 그 문서화된 설계를 §7.5.1 본문·코드에 정합시키는 후속 구현이다. `in_process_trusted` 면제는 `EIA-AU-08`(토큰 검증 우회) 이 이미 확립한 "in-process trusted caller 는 완화된 제약을 받는다" 원칙의 자연스러운 확장이며, 이를 뒤집는 과거 Rationale 은 없었다.
2. **`nodeId: 'chat-channel'` placeholder 제거** (HooksService) — 이 placeholder 를 의도적 설계로 채택했다고 명시한 과거 Rationale 항목은 spec 어디에도 없다(단순 `assertNodeId` 존재검사 통과용 구현 부산물). 제거 근거(오해 유발)는 코드 주석과 `spec/5-system/4-execution-engine.md` §7.5.1 커버리지 표·`spec/data-flow/15-external-interaction.md` 양쪽에 정합적으로 반영됐다.
3. **`surfaceMismatch` best-effort 안내(F-2) + telegram MarkdownV2 raw-send 검증(F-5)** — `spec/5-system/15-chat-channel.md` §4.1.1 이 이번 diff 와 함께(동일 PR) 갱신되어 `CCH-ERR-04` "silently swallow 금지" 원칙의 명시적 확장으로 프레이밍되어 있고, "왜 이 default 문구엔 문장부호가 없는가"·"PATCH 재검증 하위호환 함정" 까지 선제적으로 문서화했다. 기각된 대안 재도입이나 원칙 위반 없음.

## 요약

target(`spec/5-system/4-execution-engine.md`)과 이번 구현 diff 는 Rationale 연속성 관점에서 양호하다 — §7.5.1 의 재설계는 같은 문서에 이미 존재하는 2026-07-11 Rationale 항목을 구현으로 뒤따른 것이고, `in_process_trusted` 면제·`nodeId: 'chat-channel'` placeholder 제거·`surfaceMismatch`/MarkdownV2 안전성 로직 모두 인접 spec(`14-external-interaction-api.md`, `15-chat-channel.md`, `data-flow/15-external-interaction.md`)과 동일 PR 안에서 상호 참조되며 정합하게 갱신됐다. 유일한 아쉬운 점은 "202 오수용 결함 → 409 강제" 라는 동작 변경 결정이 문서 하단 canonical `## Rationale` 목록이 아니라 본문 인라인 각주에만 남아있다는 점으로, 실질적 충돌이 아니라 문서 구조상의 완결성 보완 여지다. payload 자체가 이번 diff 와 직접 관련된 spec 의 Rationale 발췌를 truncation 으로 누락한 점은 checker 운영상 개선 여지로 별도 보고한다.

## 위험도

LOW
