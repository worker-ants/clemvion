# Rationale 연속성 검토 — spec/5-system/ (eia-inputdata-marker-guard)

## 점검 대상
- diff-base `origin/main` → HEAD, scope `spec/5-system/`
- 핵심 변경: `Execution.inputData` egress 마스킹 **카브아웃 폐지**(2026-08-16 결정의 번복) — 프런트 마커 가드(폼 프리필 스킵·Re-run 모달 제출 차단·에디터 히스토리 로드 차단)가 서면서 "round-trip 되는 값은 마스킹 제외" 축을 닫음.
- 변경 파일: `spec/5-system/14-external-interaction-api.md`(R17), `6-websocket-protocol.md`, `12-webhook.md`, `13-replay-rerun.md`, `1-data-model.md`, `3-workflow-editor/3-execution.md`, `4-nodes/1-logic/12-background.md`.

## 발견사항

- **[INFO]** R17 헤딩에 2026-08-20 결정 미반영
  - target 위치: `spec/5-system/14-external-interaction-api.md:1392` (`### R17. ... (결정 2026-06-25, conversationThread reload 노출 재조정 2026-07-09)`)
  - 과거 결정 출처: 같은 R17 항목 자체(카브아웃 도입 2026-08-16 / 확장 2026-08-17 / 폐지 2026-08-20)
  - 상세: R17 은 여러 날짜의 하위 결정(2026-08-16 카브아웃 도입, 08-17 token 확장, 08-20 카브아웃 폐지)이 본문에 인라인으로 계속 추가돼 온 항목이다. 이번 08-20 반전은 스펙 표(§R17 표)·인접 5개 파일의 서술을 모두 사실대로 갱신했지만(아래 확인), 항목 헤딩 자체는 여전히 "2026-06-25 / 2026-07-09" 만 표기해 최신 실효 결정 날짜를 헤딩만 보고는 알 수 없다. 다만 이는 이미 08-16/08-17 갱신 때도 헤딩을 안 건드린 것과 같은 기존 관례라 새로 생긴 결함은 아니다.
  - 제안: (선택) R17 헤딩 괄호에 "`Execution.inputData` 마스킹 카브아웃 폐지 2026-08-20" 를 추가하면 이 항목의 grep/스캔 탐색성이 개선된다. 강제 조치는 아님.

## 정합성 확인 (문제 없음으로 판정한 항목)

1. **번복에 새 Rationale 동반 (criterion 3)** — `14-external-interaction-api.md` R17 안에서 "잔여 ②" 불릿을 직접 개정해 "카브아웃 폐지" 결정과 근거(마커 가드 3곳 표, "강제"를 안내로 낮추지 않은 이유, 값-마스킹 부분치환의 감지 한계)를 인라인으로 명시했다. 축 재정의("외부 노출 여부" 단일축 → "외부 노출 + 미러 유지비" 2축)까지 서술해 이전 판단 기준이 왜 무너졌는지 근거를 남겼다 — 무근거 번복이 아니다.
2. **전파 정합성** — `1-data-model.md`(§Execution.input_data, §NodeExecution.input_data), `3-workflow-editor/3-execution.md`(§2.2 inputData 데이터 흐름 — 기존 "WS 에는 inputData 미포함" 이라는 stale 서술도 함께 정정), `4-nodes/1-logic/12-background.md`, `12-webhook.md`(§5.3 "갭을 덮는 후속 층 없음" → "생겼다"), `13-replay-rerun.md`(§10.2 모달 caveat), `6-websocket-protocol.md`(§4.1 레벨 카브아웃 서술) 6개 파일 전부가 과거형("2026-08-20 이전에는 카브아웃")으로 통일되게 갱신됐다. `grep` 으로 `"마스킹 대상이 아니"`, `MASKED_INPUT_DATA_REASON`(옛 구현 정본 상수), `"가르는 축은 필드 이름이 아니라 레벨"` 을 현재형으로 남긴 잔존 서술이 있는지 전수 확인했으며 전부 폐기 명시 또는 제거돼 있다.
3. **타 spec 의 기각된 대안과의 충돌 없음 (criterion 1)** — `12-webhook.md` Rationale 은 과거 "display(응답) 시점 마스킹" 대안을 whack-a-mole 우려로 기각했다(헤더 key 마스킹 맥락). 이번 R17 추가분은 이 기각 사유를 직접 인용("webhook Rationale 의 whack-a-mole 우려에 대한 답")하며, 자신의 egress 값-패턴 마스킹이 "호출부 산발 패치"가 아니라 소수 공유 관문(`toResponseExecution`/`emitExecutionEvent`/`toTerminalErrorPayload`)으로 수렴된 구조라 그 우려가 구조적으로 봉쇄됨을 설명한다. 헤더-key(구조화 필드, ingestion 이 옳음)와 자유 텍스트 값-패턴(egress 만 가능)을 축으로 구분해 두 결정이 상충하지 않음을 명시적으로 논증했다 — 기각된 대안의 무단 재도입이 아니다.
4. **구현-스펙 정합** — `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `MASKED_MARKERS`(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)·`MAX_MARKER_SCAN_DEPTH=10` 이 backend `sanitize-error-message.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MAX_REDACT_DEPTH` 와 정확히 일치 — spec 이 요구하는 "SoT 미러 동기화" 서술이 실제로 지켜지고 있다. Re-run 모달의 3-조건(터치+무마커+구조필드 JSON 파싱 성공) 차단 로직도 spec §10.2 표 서술과 커밋 이력(라운드4 "무효 JSON 으로 마스킹 차단이 풀렸다" 처분)에서 실제로 반영된 것으로 확인된다.
5. **won't-do 항목 불가침** — 이번 diff 는 `R-wontdo-rawws-rest`(raw-WS 서브프로토콜 인증·in-band 토큰 갱신 비채택)·R5(외부 WebSocket 채널 보류) 등 기존 "비채택" Rationale 을 건드리지 않았고, 재도입 시도도 없다.

## 요약
이번 PR 은 `Execution.inputData` egress 마스킹 카브아웃(2026-08-16 결정)을 정면으로 뒤집는 큰 결정 번복이지만, `spec/5-system/14-external-interaction-api.md` §Rationale R17 을 직접 개정해 번복 사유(프런트 마커 가드 완성, "값싸다"는 이전 전제의 붕괴, 2축 판단 기준 재정의)를 명시했고, 이 카브아웃을 참조하던 6개 인접 spec 파일 전부를 과거형으로 일관되게 동기화했다. 옛 결정을 현재형으로 남긴 잔존 서술이나 옛 구현 상수(`MASKED_INPUT_DATA_REASON`) 참조는 발견되지 않았다. 더 나아가 `12-webhook.md` 의 기각된 대안(display-time 마스킹의 whack-a-mole 우려)까지 교차 인용해 이번 결정이 그 우려를 재도입하는 것이 아님을 논증한 점은 Rationale 연속성 관점에서 모범적이다. 유일한 지적은 R17 헤딩이 최신 결정 날짜(2026-08-20)를 반영하지 않아 탐색성이 다소 떨어진다는 INFO 수준 제안뿐이다.

## 위험도
LOW
