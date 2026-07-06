### 발견사항

- **[WARNING]** spec §2.3 의 Cafe24 call-phase `errors[]` 서술이 이번 코드 변경 이후에도 "Planned" 로 남아 실제 구현과 모순
  - 위치: `spec/5-system/11-mcp-client.md:81` (§2.3 Internal Bridge 절, "에러 처리" 단락)
  - 상세: 해당 라인은 "현재 이 call-phase 실패는 `tool_result.error` + `IntegrationUsageLog`(§8.3) 로 표면화되며, `mcpDiagnostics.errors[]` 로의 누적은 **Planned**"라고 서술한다. 그러나 이번 diff 의 `cafe24-mcp-tool-provider.ts`(및 `makeshop-mcp-tool-provider.ts`)는 정확히 이 call-phase 실패 시 `mcpErrorDelta`(phase=`tools/call`)를 반환해 `errors[]` 에 누적하도록 구현을 완료했고, 같은 문서의 §6.2(라인 360-361)는 이미 "call 단계 — 서버측 실패. provider 가 `AgentToolResult.mcpErrorDelta` 로 보고 … Internal Bridge 는 `CAFE24_*`/`MAKESHOP_*` vocabulary" 라고 구현 완료 상태로 갱신되어 있다. 즉 같은 spec 문서 내에서 §2.3 과 §6.2 가 서로 다른(과거/현재) 상태를 말하는 self-contradiction 이 발생했다. `plan/in-progress/mcp-client-diagnostics-followups.md` 의 ① 항목도 "§2.3 Cafe24 errors[] 서술도 '누적됨' 으로 복원" 을 명시적 작업 항목으로 적어두었으나 실제 diff 에는 반영되지 않았다.
  - 제안: §2.3 라인 81 을 "call-phase 실패는 `tool_result.error` + `IntegrationUsageLog`(§8.3) 로 표면화되며, 동시에 `mcpDiagnostics.errors[]` 에도 (phase=`tools/call`, Cafe24 vocabulary) 로 누적된다" 로 갱신해 §6.2 서술과 정합시킨다.

- **[INFO]** `mcp-diagnostics.ts` 파일 헤더의 stale 주석은 이미 갱신됨(확인됨) — 우수 사례
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts:13-19`
  - 상세: 과거 "call-phase errors[] 누적은 별도 follow-up" 서술이 이번 diff 에서 "build-phase 와 call-phase 양쪽의 서버측 실패를 granular code + phase 로 누적한다 (#840 build-phase + 후속 call-phase)" 로 정확히 갱신되었다. 실제 코드 상태와 주석이 일치하는 모범 사례로, 위 §2.3 이슈와 대비된다.
  - 제안: 해당 없음(확인용).

- **[INFO]** CHANGELOG.md 에 이번 변경 관련 엔트리 부재
  - 위치: `CHANGELOG.md` (루트)
  - 상세: 이 리포지토리는 `CHANGELOG.md` 를 PR 단위로 적극 유지하는 컨벤션이 확인된다(최근 항목들이 알림 파이프라인 PR1~3, 스케줄 트리거 딥링크 등 최근 머지된 기능 단위로 1:1 대응). 이번 PR 은 (a) 외부 노출 API 값 변경(`TestConnectionResult.code` 에 `MCP_TIMEOUT` 추가로 일부 케이스의 반환 코드가 `MCP_CONNECT_FAILED` → `MCP_TIMEOUT` 로 바뀜, api_contract 리뷰에서도 지적), (b) 보안 관련 개선(에러 메시지 시크릿 redaction), (c) `meta.mcpDiagnostics.errors[]` 신규 call-phase 확장이라는 세 가지 사용자 대면/보안 성격 변경을 포함하는데도 CHANGELOG 엔트리가 diff 에 없다. 프로젝트의 최근 관행과 비교하면 이 정도 규모의 변경은 통상 엔트리가 동반된다.
  - 제안: 다른 최근 항목들과 같은 포맷(변경 배경 + spec SoT 링크)으로 CHANGELOG.md 에 짧은 Unreleased 섹션 추가를 고려.

- **[INFO]** `redactMcpSecrets`/`sanitizeMcpErrorMessage`(mcp-error-codes.ts) 의 JSDoc 은 상세하고 정확함 — 우수 사례
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:37-49, 305-349`
  - 상세: 신규 함수 `redactMcpSecrets` 의 JSDoc 이 (1) 무엇을 하는지, (2) 왜 공용 `SECRET_LEAK_PATTERNS` 와 분리했는지(SoT 파편화 방지), (3) 어느 sink 에 적용되는지(`mcpDiagnostics.errors[].message`/`IntegrationUsageLog`/`Integration.last_error`), (4) cap 값이 공용(200)과 다른 이유(2048, MCP 서버 에러가 더 길 수 있음)까지 근거를 모두 명시한다. "redact 후 clamp" 순서 결정도 인라인 주석(`Redact before clamping so a truncated tail can't leave a token half-exposed.`)으로 방어적 설계 의도를 남겨 유지보수자가 순서를 실수로 바꾸는 것을 방지한다.
  - 제안: 해당 없음(확인용, 참고 사례로 특기).

- **[INFO]** `agent-tool-provider.interface.ts` 의 `mcpErrorDelta` 필드 JSDoc — client-side/server-side 경계를 명확히 문서화
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts:622-628`
  - 상세: 새 optional 필드 `mcpErrorDelta`의 JSDoc 이 "언제 set 해야 하는가"(서버 RPC 실패)와 "언제 set 하면 안 되는가"(`INVALID_TOOL_ARGUMENTS`·`MCP_UNKNOWN_TOOL` 등 client-side 실패)를 명시적으로 구분해 provider 구현자가 실수로 잘못된 케이스에 delta 를 채우는 것을 문서 차원에서 방지한다. build-phase(`ctx` 경유)와의 대칭 관계, spec 절 앵커(§6.2/§8.1)도 함께 인용되어 추적성이 좋다.
  - 제안: 해당 없음(확인용).

- **[INFO]** `mcp-client.service.ts` connect() 의 신규 인라인 주석은 복잡한 타이밍 로직을 잘 설명
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts:145-156`
  - 상세: `timedOut` 플래그가 도입된 이유(자체 deadline 발동 abort vs SDK/네트워크 자체 abort 구분), AbortController 를 유지하는 이유(`withTimeout`의 soft-deadline 과 달리 실제로 in-flight fetch 를 취소함)를 정확하고 간결하게 설명한다. 코드 리뷰(architecture.md, maintainability.md)에서도 이 주석의 충실성이 긍정적으로 언급됨.
  - 제안: 해당 없음(확인용).

- **[INFO]** `mcp-tool-provider.ts` `errorResult()` 신규 5번째 파라미터(`errorDelta`) 의 JSDoc — 위치는 다소 어색하나 내용은 충실
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:1168-1173`
  - 상세: 파라미터 바로 위에 붙은 JSDoc 이 "call-phase 서버측 실패일 때만 전달"·"client-side 실패는 넘기지 않는다"는 계약을 정확히 설명해 문서 품질 자체는 좋다. 다만 (maintainability.md 리뷰에서도 지적되었듯) 포지셔널 optional 파라미터가 5개까지 늘어나며 호출부가 `undefined` 자리채움을 필요로 하는 구조적 이슈는 문서화로 완전히 상쇄되지 않는다 — 이는 이미 별도 리뷰(architecture/maintainability)에서 다뤄진 사안이라 문서화 관점에서는 중복 지적하지 않는다.
  - 제안: 해당 없음(문서화 자체는 양호, 구조 개선은 타 리뷰 항목 참고).

- **[INFO]** 신규 테스트 파일들의 서술적 한글 `it()` 명칭 + spec 절 인용 병기 — 예제 코드 대체 효과
  - 위치: `mcp-error-codes.spec.ts`, `mcp-client.service.spec.ts`, `mcp-test-connection.service.spec.ts`, `mcp-tool-provider.spec.ts`, `cafe24-/makeshop-mcp-tool-provider.spec.ts`, `ai-turn-executor.spec.ts` 전반
  - 상세: 테스트 케이스가 "무엇을 검증하는지" + "spec 몇 절 근거인지"(예: "§8.1", "§8.2", "§9")를 함께 담아, 별도 사용법 예제 문서 없이도 `mcpErrorDelta`/`TimeoutError`/`redactMcpSecrets` 의 기대 동작을 테스트 자체가 실행 가능한 예제로 기능한다. `client-side 실패는 mcpErrorDelta 를 보고하지 않는다` 류의 "하지 않아야 하는 것"까지 케이스로 남긴 점도 API 계약 문서화 효과가 있다.
  - 제안: 해당 없음(확인용, 우수 사례).

- **[INFO]** README/설정 문서 업데이트 불필요 확인
  - 위치: 해당 없음
  - 상세: 이번 변경은 신규 환경변수·설정 옵션·외부 노출 README 대상 기능을 추가하지 않는다(connect timeout 은 기존 `connectTimeoutMs` 설정값을 재사용할 뿐 신규 설정이 아님). README 갱신 필요성 없음.
  - 제안: 해당 없음.

### 요약

문서화 품질은 전반적으로 높다 — 신규 함수(`redactMcpSecrets`)·신규 인터페이스 필드(`mcpErrorDelta`)·복잡한 타이밍 로직(`timedOut` 클로저)에 대한 JSDoc/인라인 주석이 "무엇을" 뿐 아니라 "왜"까지 충실히 설명하고, 테스트 케이스명이 spec 절 인용과 함께 실행 가능한 예제 문서 역할을 겸한다. 다만 spec 문서 내부에서 명백한 불일치가 하나 발견됐다: `spec/5-system/11-mcp-client.md` §2.3(라인 81)이 여전히 Cafe24 call-phase `errors[]` 누적을 "Planned"로 서술하는 반면, 같은 문서 §6.2 는 이미 이를 구현 완료로 갱신했고 실제 이번 diff 의 `cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts` 코드가 이를 구현했다 — plan 문서에도 "§2.3 복원" 이 작업 항목으로 명시되어 있었으나 반영 누락된 것으로 보인다. 이는 spec 을 읽는 다음 개발자에게 "아직 구현 안 됨"이라는 잘못된 정보를 줄 수 있어 WARNING 으로 분류한다. 그 외에는 이 정도 규모(보안 관련 redaction, 응답 코드값 변경)의 변경치고 CHANGELOG.md 엔트리가 없다는 점이 프로젝트의 최근 관행과 다소 어긋나 보이나 차단 사유는 아니다.

### 위험도
LOW
