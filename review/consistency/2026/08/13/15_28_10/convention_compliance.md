# 정식 규약 준수 검토 — `spec-draft-eia-notification-payload-contract.md`

대상: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
검토 모드: spec draft 검토 (`--spec`)
비교 대상: `spec/conventions/**` (특히 `chat-channel-adapter.md`, `spec-impl-evidence.md`, `node-output.md`, `error-codes.md`)

## 발견사항

- **[WARNING]** 신설되는 "미구현 (Planned)" 약속이 `pending_plans:` 추적 메커니즘에 연결되지 않음
  - target 위치: `## 무엇을 쓸 것인가` §1 ("`result.outputs`·`durationMs` 는 **'미구현 (Planned)'** 마커 + 후속 등재") 및 `## 후속 (developer)` 체크리스트, `## 체크리스트`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1/§3 (`status: partial` spec 은 `pending_plans:` 로 "자기를 책임지는 plan" 을 가리켜야 함, R-5) — 및 EIA 스펙 자신이 이미 확립한 로컬 관행(예: EIA 본문 line 830/897/1104/1117-1118 의 `Planned — §R10` 패턴, 그리고 `spec/5-system/14-external-interaction-api.md` 의 `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`, `6-websocket-protocol.md` 의 `spec-sync-websocket-protocol-gaps.md`)
  - 상세: EIA §6.3/§6.4/WS §4.1 에 새로 "미구현 (Planned)" 마커(`durationMs`·`result.outputs` 미충전, `error` 문자열→객체 미통일)를 추가하는데, 이 draft 는 그 gap 을 자신의 `## 후속 (developer)` 체크리스트에만 적어두고 (a) EIA/WS 의 기존 `pending_plans:`(각각 `spec-sync-external-interaction-api-gaps.md`/`spec-sync-websocket-protocol-gaps.md`)에 새 gap 을 등재하는 절차가 없고, (b) 이 draft 파일 자체를 `pending_plans:` 에 추가하는 절차도 없다. `spec-impl-evidence.md` R-5 는 정확히 이 형태의 "spec 이 plan 을 가리키지 않는 빈 약속" 이 텔레그램 chat-channel 케이스에서 영구 누락을 낳았다고 명시한다 — 같은 형태가 재발할 여지가 있다. build 가드(`spec-pending-plan-existence.test.ts`)는 `pending_plans:` 항목의 파일 존재만 검증하므로 즉시 CI 를 깨뜨리지는 않지만, "spec 약속 ↔ 책임 plan" 추적성이라는 규약의 의도를 벗어난다.
  - 제안: (1) 실제 spec 반영 시 `spec-sync-external-interaction-api-gaps.md`/`spec-sync-websocket-protocol-gaps.md` 에 "execution.completed/failed 종결 payload 미충전 필드(durationMs/result.outputs), error 객체 미통일" 항목을 추가하거나, (2) 이 draft 의 developer 후속 작업이 별도 `plan/in-progress/<name>.md` 로 분리되는 시점에 EIA/WS 프런트매터 `pending_plans:` 에 그 경로를 추가한다. `## 체크리스트`에 "pending_plans / gaps 트래커 갱신" 항목을 명시적으로 추가할 것을 권장.

- **[INFO]** 신설 "Planned" 마커에 Rationale 앵커 교차참조가 계획되지 않음
  - target 위치: `## 무엇을 쓸 것인가` §1, §2
  - 위반 규약: 엄격한 규칙 위반은 아니며, EIA 스펙 자신의 기존 문서 스타일(`spec/5-system/14-external-interaction-api.md` line 830, 897, 1104, 1117-1118 — `미구현 (Planned)` 뒤에 항상 `— §R10` 형태의 Rationale 앵커를 병기)과의 일관성 문제
  - 상세: 기존 EIA 문서는 "Planned" 라벨을 단독으로 쓰지 않고 항상 그 이유를 설명하는 Rationale 절(`§R10`)을 함께 인용한다. 이 draft 는 `durationMs`/`result.outputs` Planned 마커에 대해 그런 앵커를 계획하지 않았다(대신 "후속 (developer)" 절로 대체하려는 것으로 보이나 이는 plan 문서이지 spec 본문 Rationale 이 아니다).
  - 제안: 실제 spec 반영 시 §6.3/§6.4 Planned 마커 옆에 짧은 Rationale 절(또는 기존 Rationale 절 확장)을 붙여 "왜 아직 못 채웠는가/언제 채워지는가"를 EIA 문서 자체의 관행대로 앵커링할 것을 고려.

- **[INFO]** 컨텍스트 예산 절단으로 일부 conventions 본문이 assembled prompt 에서 생략됨 (검토 한계 고지)
  - target 위치: N/A (검토 절차상 한계)
  - 위반 규약: 해당 없음 — 검토 신뢰도 관련 메타 정보
  - 상세: `_prompts/convention_compliance.md` 번들에서 `conversation-thread.md`(78,317자)·`error-codes.md`·`execution-context.md`·`interaction-type-registry.md`·`node-output.md`·`node-cancellation.md`·`swagger.md`·`spec-impl-evidence.md` 등 다수 conventions 본문이 "본문 생략됨 — 컨텍스트 예산 초과"로 절단되어 있었다(기존에 알려진 `--spec` 모드 예산 이슈와 동일 증상). 본 검토는 해당 파일들을 저장소에서 직접 읽어 보완했으나, 번들 자체의 예산 이슈는 별개로 남아 있다.
  - 제안: 조치 불요(별도 harness 이슈로 이미 알려짐). 참고용으로만 기록.

## 준수로 확인된 점 (참고)

- `durationMs` 통일 결정(EIA `durationMs` ↔ WS `duration`)은 `spec/conventions/node-output.md` Principle 2(`meta.durationMs: number`)와 `spec/conventions/conversation-thread.md`(다수 `durationMs` 용례)가 이미 확립한 전역 명명 관행과 정확히 일치한다 — 규약 위반이 아니라 오히려 규약을 프로젝트 전역으로 일관되게 확장하는 결정이다.
- `chat-channel-adapter.md` §1.2 `EiaEvent` 를 EIA §6 최종형에 맞추는 결정은 그 컨벤션 파일 자신의 R3("EIA spec §6 이 SoT, 두 spec 간 drift 회피")를 정확히 따른다.
- "미구현 (Planned)" 마커 자체의 사용 패턴(약속을 지우지 않고 남기되 미구현임을 명시)은 `spec/conventions/node-cancellation.md`(`— 미구현(Planned, 추적 plan: ...)`)·`spec/conventions/audit-actions.md`(Planned 카탈로그)에서 이미 쓰이는 로컬 관행과 형태상 일치한다. 다만 위 WARNING 처럼 "추적 plan" 연결이 빠져 있다.
- 필드 삭제(`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`)를 "외부 계약이지만 실 소비자 0곳이라 breaking-change 공지 불요"로 정당화하는 논리는 EIA 스펙 자신의 기존 선례(`spec/5-system/14-external-interaction-api.md` line 353, §5.4 `STATE_MISMATCH` 정정 — "문서화된 동작은 바뀌지 않았으므로 breaking-change 공지 불요")와 같은 판단 축을 따른다.

## 요약

target draft 는 정식 규약을 크게 위반하지는 않는다 — 특히 필드 명명(`durationMs` 통일)과 `EiaEvent`/EIA §6 drift 회피 원칙은 `spec/conventions/node-output.md`·`chat-channel-adapter.md` 의 기존 규약을 정확히 따르며, "Planned" 마커 사용 패턴도 이 저장소의 확립된 문서 관행과 형태상 부합한다. 다만 새로 도입되는 "미구현 (Planned)" 약속(§6.3 `durationMs`/`result.outputs`, §6.4 `error` 객체 통일)이 `spec/conventions/spec-impl-evidence.md` 가 요구하는 spec→plan 추적 메커니즘(`pending_plans:` 또는 기존 `spec-sync-*-gaps.md` 등재)에 연결되지 않아, 이 컨벤션이 방지하려던 "책임 plan 없는 빈 약속" 패턴이 소규모로 재현될 위험이 있다. 이는 build 가드를 직접 깨뜨리지는 않으므로 WARNING 수준이며, 실제 spec 반영 단계 또는 developer 후속 착수 시점에 `pending_plans:` 갱신 절차를 명시하면 해소된다.

## 위험도

LOW
