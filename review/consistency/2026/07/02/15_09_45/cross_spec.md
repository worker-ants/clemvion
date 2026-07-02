# Cross-Spec 일관성 검토 — `spec/5-system/4-execution-engine.md` (impl-done)

## 검토 대상 확인

- 검토 모드: `--impl-done`, scope=`spec/5-system/4-execution-engine.md`, diff-base=`origin/main`
- 실제 코드 diff: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`, `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (M-7 클러스터 — `z.custom<T>()` 를 이용한 zod 스키마 타입 sharpening)
- **`spec/**` 자체의 변경분은 diff 에 없음** (`git diff origin/main...HEAD --stat -- spec/` 결과 없음) — 이번 변경은 spec 본문을 건드리지 않는 순수 코드 리팩터다.

## 발견사항

해당 없음 (Cross-Spec 충돌 없음).

### 점검 관점별 확인 근거

1. **데이터 모델 충돌** — 없음. 변경은 `resumeStateSchema` (zod, in-memory 전용) 의 `messages`/`turnDebugHistory`/`allPresentations` 필드를 `z.unknown()` → `z.custom<ChatMessage>()`/`z.custom<PresentationPayload[]>()` 로 sharpening 한 것뿐이다. `ChatMessage`(`spec/5-system/7-llm-client.md` §3.2/Message 표기)와 `PresentationPayload`(`spec/4-nodes/3-ai/1-ai-agent.md` §7.10 "단일 진실" 타입 정의)는 이미 spec 전역에서 참조되는 기존 canonical 타입이며, 이번 변경은 새 타입을 도입하거나 기존 타입 정의와 다른 shape 을 선언하지 않았다. `spec/1-data-model.md` 의 엔티티 정의와도 무관 (DB 컬럼 변경 없음).
2. **API 계약 충돌** — 없음. endpoint/HTTP 계약 변경 없음. `PresentationPayload` 를 소비하는 EIA(`spec/5-system/14-external-interaction-api.md`)·WebSocket(`spec/5-system/6-websocket-protocol.md`)·Chat Channel(`spec/5-system/15-chat-channel.md`) 문서들이 참조하는 SoT 타입(§7.10)은 그대로다.
3. **요구사항 ID 충돌** — 신규 요구사항 ID 부여 없음.
4. **상태 전이 충돌** — 없음. `spec/5-system/4-execution-engine.md` §7.5 (rehydration/graceful-reset) 의 상태 전이 규칙(`RESUME_INCOMPATIBLE_STATE` 등)은 변경되지 않았고, 코드 주석이 명시적으로 "본 enrich 는 §7.5 의 '런타임 미검증' 계약(#783)을 그대로 유지한다"고 밝히고 있다. 실제로 `z.custom<T>()` 는 zod 런타임 validator 를 추가하지 않으므로(모든 값 통과), 기존 "malformed checkpoint 를 기본값으로 graceful 하게 보강" 행위(behavior-preserving)를 깨지 않는다. 코드 주석 자체가 `spec/5-system/4-execution-engine.md §1.3, impl-prep I-8` 를 정확히 인용하고 있어 spec 라이프사이클 구분(ResumeState/ResumeCheckpoint/RetryState)과 정합한다.
5. **권한·RBAC 모델 충돌** — 해당 없음. 이번 변경은 RBAC/권한 로직과 무관하다.
6. **계층 책임 충돌** — 없음. 변경은 execution-engine 모듈 내부(`utils/resume-state.schema.ts`) 와 AI 노드 실행기(`nodes/ai/ai-agent/ai-turn-executor.ts`) 사이의 기존 책임 분할을 유지한 채 domain 캐스트(`as ChatMessage[]` 등)를 제거하는 내부 타입 정리다. 새 계층 경계나 모듈 간 책임 이전이 없다.

## 요약

이번 변경분은 `spec/5-system/4-execution-engine.md` 의 본문을 전혀 수정하지 않았고, 실제 코드 diff 도 zod 스키마의 `z.unknown()` 필드를 기존에 spec 전역에서 canonical 로 참조되는 `ChatMessage`/`PresentationPayload` 타입으로 `z.custom<T>()` sharpening 한 behavior-preserving 리팩터에 그친다. 런타임 검증 강도(배열 여부만 체크, 원소 미검증)는 그대로이며, §7.5 rehydration/graceful-reset 계약과 명시적으로 정합성을 유지한다고 코드 주석에서 스스로 근거를 제시한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 충돌하는 지점을 찾지 못했다.

## 위험도

NONE
