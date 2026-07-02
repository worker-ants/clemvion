# 정식 규약 준수 Check — `spec/4-nodes/3-ai/1-ai-agent.md`

검토 모드: --impl-done (diff-base=origin/main)
diff 범위: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 단일 파일 (private `narrowResumeState()` 헬퍼 추출 — `state as ResumeState` 반복 캐스트를 단일 진입점으로 통합)

## 검토 경과

diff 를 확인한 결과, 이번 변경은 `AiTurnExecutor` 내부에서 in-memory `_resumeState`(`Record<string, unknown>`)를 `ResumeState` 타입으로 좁히는 **순수 리팩터링**(M-7)이다. 새 필드·명명·출력 포맷·API endpoint·에러 코드의 도입/변경이 전혀 없다. target spec 문서(`spec/4-nodes/3-ai/1-ai-agent.md`) 자체도 이번 diff 로 수정되지 않았다 (diff 대상 파일 목록에 `.md` 없음).

target 문서 §7.4(`_resumeState` shape·필드 표), §Rationale, `spec/conventions/node-output.md` Principle 0 / 4.2 / 4.2.1(`_resumeState`/`_resumeCheckpoint`/`_retryState` internal top-level 필드 허용 예외 규약)을 대조했다.

- `narrowResumeState(state: Record<string, unknown>): ResumeState { return state as ResumeState; }` 는 컴파일 타임 전용 캐스트이며 런타임 no-op — `_resumeState` 의 shape·필드명·strip 정책·top-level 위치 등 §7.4/§Principle 4.2.1 이 규정한 어떤 계약도 변경하지 않는다.
- `buildAiNodeRefFromState`/`threadHolderFromState` 시그니처가 `Record<string, unknown>` → `ResumeState` 로 좁혀졌으나, 이는 이미 §7.4 표에 문서화된 필드(`rawConfig`, `conversationThreadRef` 등)에 대한 접근이며 새 필드 도입이 아니다.
- diff 주석은 spec §6.1 의 캐스트 정책(도메인 unknown 필드 `rawConfig`/`model`/`ragLastDiagnostics` 는 domain 캐스트 유지)과 일치하게 유지되고 있다.

## 발견사항

없음. 명명 규약, 출력 포맷 규약, 문서 구조 규약(Overview/본문/Rationale — 본 문서군은 서두 산문 + 번호 섹션 + `## 12. Rationale` 패턴을 `spec/4-nodes/3-ai/` 내 다른 노드 spec 과 일관되게 따름), API 문서 규약, 금지 항목 — 5개 관점 모두에서 target 문서 및 이번 diff 가 `spec/conventions/**` 를 위반하는 지점을 찾지 못했다.

## 요약

이번 변경분은 spec 문서 텍스트에 영향이 없는 내부 타입 캐스트 리팩터링이며, target spec 문서(`1-ai-agent.md`)가 규정하는 `_resumeState` 계약과 `spec/conventions/node-output.md` 의 internal top-level 필드 규약(Principle 0/4.2/4.2.1) 모두와 정합한다. 문서 구조(번호 섹션 + Rationale)도 동일 영역의 다른 spec 문서와 일관되어 정식 규약 준수 관점에서 위반 사항이 없다.

## 위험도

NONE

STATUS: OK
