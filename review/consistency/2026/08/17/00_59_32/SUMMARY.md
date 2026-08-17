# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec checker 가 CRITICAL 2건을 발견했으며, 두 건 모두 근본 원인이 `spec/` 자체의 상호 모순/우선순위 미결정이라 developer 권한 밖입니다 (아래 §planner 인계 참조). 5개 checker 전원 전문 확보 완료 — "재시도 필요" 항목 없음.

## 전체 위험도
**CRITICAL** — 신규 egress 값-패턴 마스킹(WS `execution.node.*`/`execution.*` emit)이 (1) 같은 PR 이 REST 에서 의도적으로 비대상 처리한 `inputData` 를 WS 라이브 경로에서는 마스킹해 parity 원칙과 자기모순을 일으키고, (2) `conventions/node-output.md` Principle 7 의 `NodeHandlerOutput.config` raw-echo 계약을 흔한 실사용 패턴(`Authorization:` 헤더 코드)에서 부분적으로 침해할 수 있음을 target 이 스스로 작성한 코드/테스트 근거로 확인함.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | WS `execution.node.*` emit 의 `input` 필드가 값-마스킹 대상 payload 전체에 포함돼, 같은 PR 이 REST 에서 명시적으로 비대상 처리한 `NodeExecution.inputData` 를 WS 라이브 경로에서는 마스킹함 — "boundary masking parity" 근거와 자기모순. `websocket.service.spec.ts` 신규 테스트가 이 마스킹 자체를 단언(고정)함 | `spec/5-system/6-websocket-protocol.md` §4.1 신설 캐비엇 | `spec/5-system/13-replay-rerun.md`(inputData egress 비대상 캐비엇) · `spec/5-system/14-external-interaction-api.md` §R17 잔여② · `executions.service.ts` `MASKED_INPUT_DATA_REASON` | `WIRE_PRESERVED_FIELDS`(또는 별도 목록)에 `input` 추가해 REST 와 동일 비대상 처리하거나, 의도된 비대칭이면 그 근거를 WS §4.1 + EIA §R17 양쪽에 명시 |
| 2 | cross_spec | `outputData` REST 마스킹 + WS `output` 값-마스킹이 `NodeHandlerOutput.config`(Code 노드 소스, AI Agent 프롬프트 등) 의 "그대로 echo" 계약을 흔한 실사용 패턴(`Authorization:` 헤더 구성 코드 등)에서 부분 침해할 수 있음 — 정규식 `SECRET_LEAK_PATTERNS` 이 필드명이 아닌 값-패턴만 보므로 `config.code` 내부 리터럴도 매치됨 | `spec/5-system/14-external-interaction-api.md` §R17 (`outputData` 신규 편입) · `spec/1-data-model.md` · `spec/5-system/6-websocket-protocol.md` §4.1 | `spec/conventions/node-output.md` Principle 0/1.1/7 ("그대로 echo" — 이 diff 로 갱신 안 됨) | `preserveKeys`(`WIRE_PRESERVED_FIELDS`/`deepRedactSecretsPreserving`)를 `config` 하위 트리로 확장하거나, `node-output.md` Principle 7 을 값-마스킹 우선순위와 함께 갱신 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 2건 모두 근본 원인이 `spec/` 문서 간 상호 모순 정정 또는 `spec/conventions/` 우선순위 결정이며, 둘 다 developer 의 `spec/` read-only 권한 밖입니다. 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 유지됩니다 — 이 표는 차단 해제가 아니라 다음 행동(project-planner 턴)을 지정합니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `6-websocket-protocol.md` §4.1 이 신설한 "payload 전체" 마스킹 원칙과 `13-replay-rerun.md`/`14-external-interaction-api.md` §R17 의 `inputData` 비대상 결정 사이의 상호 모순 정정은 `spec/` 쓰기(project-planner 전용) 가 필요 | project-planner | WS §4.1 캐비엇에 `input` 필드 예외를 명시(`WIRE_PRESERVED_FIELDS` 확장과 동기화)하거나, 의도된 비대칭이라면 그 근거를 `6-websocket-protocol.md` §4.1 + `14-external-interaction-api.md` §R17 양쪽에 동시 기록 | `plan/in-progress/eia-fanout-and-internal-data-masking.md` 또는 `spec-sync-external-interaction-api-gaps.md` 신규 항목 |
| 2 | `conventions/node-output.md` Principle 7(raw-echo 계약)과 신규 `outputData`/WS `output` 값-마스킹의 우선순위 결정은 `spec/conventions/` 쓰기(project-planner 전용) 가 필요 | project-planner | (a) `config` 하위 트리를 값-마스킹 제외 대상으로 결정해 `14-external-interaction-api.md` §R17 에 반영, 또는 (b) `node-output.md` Principle 7 문구에 "값-패턴 마스킹 대상은 예외" 캐비엇 추가 — 어느 쪽이든 두 문서 동시 갱신 | `spec-sync-external-interaction-api-gaps.md` 신규 항목으로 등재 필요 (현재 미등재) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `Execution`/`NodeExecution` 엔티티 필드 표의 `output_data` 행이 신규 egress 마스킹을 언급하지 않아, 전용 관계 절을 따라가지 않는 독자는 원문이라고 오해할 수 있음 | `spec/1-data-model.md` line 472(§2.13), line 551(§2.14) | 같은 문서 "Execution.error ↔ NodeExecution.error 관계" 절(이번 diff 로 `outputData` 마스킹 언급이 추가됐으나 이 절에만 있음) | §2.13/§2.14 `output_data` 행에 "응답 마스킹은 [EIA §R17] 참조" 각주 추가, 또는 관계 절 범위를 `outputData` 까지 확장 |
| 2 | plan_coherence | 신규 emit 초크포인트 마스킹(`emitExecutionEvent` 공유)이 `USER_MESSAGE` 라이브 시그널에도 이미 적용되어 다른 plan 의 "미해소" 보안 노트를 실질적으로 닫았는데 그 plan 이 갱신되지 않음(문서 드리프트, 실질 위험 아님 — 오히려 보안 개선 방향) | `spec/5-system/6-websocket-protocol.md` §4.1 + `websocket.service.ts` `maskWireEnvelope` | `plan/in-progress/ie-resume-turn-boundary-cancel.md` "6차 라운드 추가 후속" 절(USER_MESSAGE 마스킹 비대칭 노트) | 해당 절에 "해소(2026-08-16/17, `emitExecutionEvent` 공유 초크포인트로 USER_MESSAGE 포함 전 execution 이벤트에 값-패턴 마스킹 적용됨 — EIA §R17/WS §4.1)" addendum 추가. 코드 변경 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `nodeOutput` 일반 키 allowlist 잔여 노트가 신규 emit 값-마스킹 층을 언급하지 않음(2라운드 연속 미반영, 결정 위반 아님) | `spec/5-system/14-external-interaction-api.md` §R17 말미 | "(2026-08-16 이후 값-패턴 마스킹 층 추가 — §4.1 참조)" 1줄 교차 참조 추가 |
| 2 | naming_collision | `redactStoredDataForResponse` 정의 파일명(`redact-stored-error.ts`)이 함수 의미(Error 가 아닌 Data 컬럼 마스킹)와 어긋남 — plan 문서가 의도적 배치임을 이미 명시, 충돌 아님 | `codebase/backend/src/shared/utils/redact-stored-error.ts:66` | 액션 불필요. 세 번째 `redactStored*ForResponse` 자매 추가 시 파일 리네임 고려 |
| 3 | naming_collision | `execution.paused`(미구현) 행에만 `nodeName` 잔존, 나머지 4개 emit 행은 `nodeLabel` 로 정정됨 — 이미 각주로 유예 처리됨 | `spec/5-system/6-websocket-protocol.md:185` | 액션 불필요. `execution.paused` 구현 착수 시 `nodeLabel` 로 동시 정정 |
| 4 | convention_compliance | `chat-channel-adapter.md` 의 "audit 비현실적" 판단과 신규 wire-level 값-마스킹 chokepoint 가 인접 주제를 다른 접근으로 설명(레이어가 달라 규약 위반은 아님) | `spec/conventions/chat-channel-adapter.md:552` | 차후 해당 문서 개정 시 "wire 레벨 값-마스킹 존재" 각주 추가 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | WS `input`/`output` 필드가 REST `inputData` 비대상 처리·`node-output.md` Principle 7 raw-echo 계약과 충돌 (2건) |
| rationale_continuity | LOW | 최신 커밋(`055ca996f`)이 자기 발생 drift(1-data-model §2.13) 정정 확인, 결정 무근거 번복 없음, INFO 1건 잔존 |
| convention_compliance | NONE | 명명·출력 포맷·문서 구조·API 문서·금지 항목 5축 전부 위반 없음 |
| plan_coherence | LOW | `ie-resume-turn-boundary-cancel.md` 문서 드리프트 WARNING 1건(실질 위험 없음), tracker/plan 정합 대체로 양호 |
| naming_collision | LOW | 신규 식별자 전부 기존 패밀리와 정합, INFO 3건(정보성) |

## 권장 조치사항
1. (BLOCK 해소 우선) project-planner 턴에서 §planner 인계 #1·#2 를 처리 — WS `input` 필드 마스킹 여부 결정(REST 와 동일 비대상 vs 의도된 비대칭 문서화) 및 `node-output.md` Principle 7 대비 `config` 마스킹 우선순위 결정, 관련 spec 문서 동시 갱신.
2. WARNING #1: `spec/1-data-model.md` §2.13/§2.14 `output_data` 행에 마스킹 각주 추가 (project-planner, 경미).
3. WARNING #2: `plan/in-progress/ie-resume-turn-boundary-cancel.md` 에 USER_MESSAGE 마스킹 해소 addendum 1줄 추가 (developer/planner 누구나 가능, 코드 변경 불요).
4. INFO 4건은 즉시 조치 불필요 — 향후 관련 파일 개정 시 참고.