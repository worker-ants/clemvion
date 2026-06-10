# Scope Review

## 발견사항

### [INFO] 리뷰 대상 14개 파일은 모두 `spec/data-flow/` 문서
- 위치: 파일 1~14 전체 (`spec/data-flow/10-triggers.md` 외 나머지 13개)
- 상세: 이 PR 의 구현 범위는 "Trigger→Schedule 역방향 동기화 버그 수정"이다 (커밋 59231fd7, 2838fcc0). `spec/data-flow/10-triggers.md` 는 직접 연관된 spec 이지만, 나머지 13개 파일(`11-workflow.md`, `12-workspace.md`, `13-agent-memory.md`, `14-chat-channel.md`, `15-external-interaction.md`, `2-auth.md`, `3-execution.md`, `4-file-storage.md`, `5-integration.md`, `6-knowledge-base.md`, `7-llm-usage.md`, `8-notifications.md`, `9-observability.md`)은 이번 구현과 무관한 도메인들이다. 이 13개 파일의 변경은 커밋 79f1d849("spec↔code 전수 상호 감사")에 포함된 별도 spec 재구성 작업으로, 이 PR 의 구현 커밋(feat/test)과 다른 커밋에서 발생했다.
- 제안: 범위 측면에서는 이 13개 파일이 같은 PR 에 포함된 것이 과다해 보일 수 있으나, 해당 커밋은 브랜치가 갈라지기 이전 베이스(main) 의 연속으로 이미 이 워크트리에 포함된 선행 작업이다. 구현의 직접 범위인 `codebase/**` 변경(triggers.service.ts 등)과 독립적으로 병합된 것이므로 실질적 혼입은 아니다.

### [INFO] `spec/data-flow/10-triggers.md` — 구현 갭 문서화가 코드와 정합
- 위치: §1.4 구현 갭 callout, §3.1 `is_active false` 설명
- 상세: 이전 커밋(79f1d849)이 "역방향 미구현(구현 갭)" 으로 표기했고, 이번 feat 커밋(59231fd7)이 그 갭을 해소했으나 spec 문서의 갭 표기는 여전히 "구현 갭" 으로 남아 있다. 실제 코드는 이미 역방향 동기화를 구현했으므로 spec 의 갭 경고가 사실과 다를 가능성이 있다 — 단, 리뷰 대상 diff 는 79f1d849 기준이고 feat 커밋(8beb1742의 "impl-prep BLOCK 해소 — C-1 갭 표기 정렬") 에서 별도 spec 갱신이 이루어졌을 수 있으므로 이 시점 diff 단독으로는 최종 상태가 확인되지 않는다.
- 제안: 확인 필요 사항으로만 기록. 별도 spec 갱신 커밋(8beb1742)에서 §1.4 텍스트가 최종 수정되었는지 검토 권장.

### [INFO] `spec/data-flow/7-llm-usage.md` — LLM 호출 컨텍스트 attribution 갭 신규 명시
- 위치: §1.3 Caller 카탈로그, Rationale `llm_usage_log nullable` 섹션
- 상세: 이번 작업 범위(trigger-schedule 동기화)와 무관한 LLM 비용 attribution 문제를 spec 에 상세히 기술했다. 내용 자체는 코드 사실과 정합하고 유용하지만 이번 PR 범위를 벗어난 spec 추가 작업이다. 단, 79f1d849 의 "전수 감사" 커밋 목적과는 합치한다.
- 제안: 내용 품질은 문제없으므로 허용. 다만 이 변경이 본 PR 의 구현과 직접 연관되지 않음을 인지.

### [INFO] 신규 파일 2개(`13-agent-memory.md`, `14-chat-channel.md`, `15-external-interaction.md`) — 신규 data-flow 문서 추가
- 위치: 파일 4, 5, 6
- 상세: 이전에 존재하지 않던 data-flow 문서 3개가 신규 생성되었다. 이번 구현(trigger-schedule 역방향 동기화)과 직접 연관 없는 도메인들이다. 79f1d849 "data-flow 재구성" 작업의 일부이므로 범위 초과이나 해당 커밋의 취지에는 부합한다.
- 제안: 내용 자체의 정확성 문제는 없으나, 이 세 파일은 본 PR 의 구현과 무관한 별도 작업임을 기록.

## 요약

이번 PR 의 핵심 구현 범위는 `triggers.service.ts` / `schedules.module.ts` / `triggers.module.ts` 의 역방향 동기화 버그 수정과 대응 테스트(`triggers.service.spec.ts`, `schedule-trigger.e2e-spec.ts`) 및 plan 파일 3건이다. 리뷰 대상 14개 spec 파일은 별도 베이스 커밋(79f1d849 — "spec↔code 전수 상호 감사")에서 변경된 것으로, 구현 커밋과 다른 커밋에서 발생한 선행 spec 동기화 작업이다. 이 spec 변경들은 직접 구현과 혼재되지 않고 별도 커밋으로 분리되어 있으므로 범위 혼입의 실질적 리스크는 낮다. 각 spec 파일의 내용은 코드 현실을 정확하게 기술하고 있으며 불필요한 리팩토링, 포맷팅 전용 변경, 무관한 임포트 수정 등은 발견되지 않았다.

## 위험도

LOW
