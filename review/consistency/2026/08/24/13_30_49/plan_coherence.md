# 발견사항

- **[INFO]** `egress-masking.md` §2 편집 시 인접 캐비엇 문단 보존 주의
  - target 위치: `plan/in-progress/planner-doc-batch.md` B2 (`egress-masking.md §2` 파이프라인 순서)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` 미체크 항목 `TerminalErrorPayload 를 채우는 호출부의 sanitizeErrorMessage 경유 여부 전수 확인`
  - 상세: 현재 `spec/conventions/egress-masking.md` §2 (line 68-77)는 `toFanoutEnvelope` 내부 순서(`maskWireEnvelope → stripExternalOnlyFields → attachRoutingContext`, 3단계)를 서술하고, 바로 아래 blockquote(line 77)가 "이 순서 계약이 확인된 범위는 `toFanoutEnvelope` 경로뿐이고, `TerminalErrorPayload` 를 채우는 다른 호출부가 같은 규율을 지키는지는 **아직 전수 확인되지 않았다**"라며 `ws-event-types-extract.md` 미체크 항목을 명시 참조한다. B2 는 이 순서 서술에 "nodeOutput allowlist" 단계를 끼워 넣는 작업인데, 편집 도중 이 인접 캐비엇 문단까지 "이제 확인됐다"는 식으로 건드리면 아직 열려 있는 선행 항목(`ws-event-types-extract.md`)을 무단 종결 처리하는 셈이 된다. B2 자체의 범위(파이프라인 순서 나열)와 그 캐비엇(다른 호출부의 규율 준수 여부)은 서로 다른 축이라 실제 충돌은 아니지만, 같은 절 안에 붙어 있어 실수로 같이 고칠 위험이 있다.
  - 제안: B2 작업 시 line 68-75(파이프라인 순서)만 갱신하고 line 77 캐비엇 문단은 `ws-event-types-extract.md` 해당 항목이 닫히기 전까지 그대로 둘 것.

- **[INFO]** 컨텍스트 예산 절단으로 `node-output-redesign/*` 26개 파일이 프롬프트에서 생략됨 — 직접 조회로 보완 확인
  - target 위치: `plan/in-progress/planner-doc-batch.md` (frontmatter `spec_impact: spec/conventions/node-output.md`)
  - 관련 plan: `plan/in-progress/node-output-redesign/README.md` 및 하위 26개 파일 (프롬프트 번들에서 "본문 생략됨 — 컨텍스트 예산 초과"로 절단)
  - 상세: 프롬프트 번들 자체는 이 노드별 plan 폴더를 헤더만 남기고 전부 절단했다(기존에 알려진 `--spec` 모드 예산 이슈). 실제 파일을 직접 읽어 확인한 결과 `README.md` 는 "본 plan 은 conventions 자체는 변경하지 않는다"고 명시하고 있어, B1(`node-output.md` Principle 0 에 wire-only 키 각주 추가)과 충돌하는 미해결 결정은 없음을 확인했다.
  - 제안: 조치 불요 — 참고용 기록. 다만 이후 유사 배치에서 이 절단이 실제 충돌을 가리는 경우가 있을 수 있으므로, `--spec` 예산 이슈가 재발하면 스코프 문서(`node-output.md`, `egress-masking.md` 등)를 직접 인용하는 plan 파일은 우선 적재하는 편이 안전하다.

# 요약

target `plan/in-progress/planner-doc-batch.md`(B1~B7)의 모든 항목은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 등재된 "planner 소관" 태그가 붙은 항목들과 문장 단위로 정확히 대응한다 — B1(wire-only 키 8개, Principle 0 각주), B2(egress-masking §2 순서), B3(WS §4.4 nodeType carve-out), B4(conversation-thread frontmatter), B5(background:run:{id} 채널 표/포인터 택일), B6(사본 4곳→정본 링크, 대상 4곳까지 일치), B7(provider spec CCH-MP-06 판정) 전부 소스 트래커의 실측·근거를 그대로 옮겨 놓았으며 새로 일방적 결정을 내리는 항목은 없다. baseline 커밋(`99b9bd908`)이 현재 `origin/main` HEAD 와 정확히 일치함도 확인했다. 인접 in-progress plan(`spec-sync-websocket-protocol-gaps.md`, `eia-context-schema-followups.md`, `eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`, `spec-update-node-cancellation-shutdown-classification.md`, provider별 Slack/Discord/SSR plan)을 전수 대조했으나 B1~B7이 다루는 절·문장과 실질적으로 겹치거나 반대 방향 결정을 내린 곳은 없었다. 유일한 주의점은 `egress-masking.md` §2 편집 시 인접한(아직 열려 있는) 캐비엇 문단을 실수로 건드리지 않는 것 정도다.

# 위험도

LOW
