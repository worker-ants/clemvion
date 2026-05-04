## 발견사항

### [WARNING] `requestPayload` / `responsePayload` 필드 제거로 인한 WS 페이로드 파괴적 변경
- **위치**: `execution-engine.service.ts` diff, `-requestPayload: resumeState.lastTurnRequest` 제거 라인
- **상세**: `execution.ai_message` 이벤트의 `waiting_for_input` 분기에서 `requestPayload`, `responsePayload` 필드가 제거되고 `llmCalls[]` + `durationMs`로 대체됨. 데이터 자체는 유실되지 않고 `llmCalls[n].requestPayload` / `llmCalls[n].responsePayload` 안으로 이동했으나, 기존 구조에 의존하던 프론트엔드 코드가 있다면 조용히 `undefined`를 받게 됨.
- **제안**: 프론트엔드에서 flat `requestPayload` / `responsePayload`를 직접 참조하는 코드가 없는지 확인. 이미 이전 커밋(`fd9aa3f`)에서 terminal emit 분기가 동일 구조로 마이그레이션되어 있고, 이번 변경이 그것을 동기화하는 의도라면, 프론트엔드도 이미 `llmCalls[last]`를 보도록 수정되어 있어야 함.

### [WARNING] `durationMs` 값 출처 변경
- **위치**: `buildAiMessageDebugFromResumeState` 함수 내 `lastTurnDebug?.totalDurationMs`
- **상세**: 이전: `resumeState.lastTurnDurationMs` (단일 플랫 필드) → 이후: `turnDebugHistory` 배열 마지막 항목의 `totalDurationMs`. 두 필드가 동일한 계산 경로에서 세팅된다면 동치지만, `lastTurnDurationMs`는 최신 턴 전체에 대한 값이고 `turnDebugHistory[last].totalDurationMs`도 같은 의미여야 함. 실제 `resumeState`를 채우는 AI 핸들러 코드에서 두 값이 항상 일치하는지 확인 필요.
- **제안**: AI 핸들러가 `resumeState`를 갱신하는 지점에서 `lastTurnDurationMs`와 `turnDebugHistory[last].totalDurationMs`가 동일한 값으로 세팅되는지 단위 테스트 또는 코드 추적으로 검증.

### [INFO] 새 public export 추가
- **위치**: `execution-engine.service.ts` — `export function buildAiMessageDebugFromResumeState`
- **상세**: 이전에는 없던 export가 추가됨. 의도적이며(테스트에서 직접 임포트), 모듈 외부 계약 확대는 미미한 수준.
- **제안**: 이 함수가 라이브러리·패키지 경계를 넘어 외부로 노출되지 않는 한 문제 없음.

### [INFO] unsafe `as` 캐스트 다수
- **위치**: `buildAiMessageDebugFromResumeState` 함수 내 `as unknown[] | undefined`, `as number | undefined`
- **상세**: `Record<string, unknown>` 입력에 대해 런타임 타입 검증 없이 캐스트. `llmCalls`가 배열이 아닌 값(예: `null`, 빈 문자열)이면 `result.llmCalls`에 잘못된 값이 실릴 수 있음. 단, 테스트 케이스 5개가 경계 케이스(빈 배열, 누락 필드)를 충분히 커버하고 있어 현실적 위험은 낮음.

---

## 요약

이번 변경은 `execution.ai_message` WebSocket 이벤트의 `waiting_for_input` 분기를 terminal emit 분기와 동일한 페이로드 구조(`llmCalls[]` + `durationMs`)로 통일하는 리팩토링이다. 함수 자체는 순수 함수(pure function)이고 전역 상태·파일시스템·네트워크 부작용은 없다. 핵심 부작용은 WS 이벤트 페이로드에서 `requestPayload` / `responsePayload` 최상위 필드가 제거된 것으로, 데이터는 `llmCalls[n]` 내부로 이동했으나 기존 소비자에게 파괴적 변경이 될 수 있다. 이미 terminal 분기에서 동일 변경이 선행 커밋(`fd9aa3f`)에 적용되어 있으므로 프론트엔드가 그에 맞게 수정된 상태라면 실질적 위험은 낮다.

## 위험도

**LOW** — 구조적 파괴 없음, 데이터는 보존됨, 프론트엔드 선행 마이그레이션 전제 시 안전. 단, 프론트엔드 동기화 여부를 반드시 확인해야 함.