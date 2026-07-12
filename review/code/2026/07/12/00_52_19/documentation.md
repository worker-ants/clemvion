# 문서화(Documentation) 리뷰 결과

## 대상
- `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`
- `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `plan/in-progress/kb-websocket-emit-compile-guard.md` (신규)

## 요약된 변경 내용
`emitEvent(event: string, …)` → `emitEvent(event: KbEventType, …)` 로 파라미터를 좁히고
`event as Parameters<typeof emitKbEvent>[1]` 캐스트를 제거한 순수 타입 강제 강화. 계약 멤버(11종
union)는 불변이며 런타임 동작 변화 없음.

### 발견사항

- **[INFO]** private `emitEvent` 헬퍼 자체에는 함수 수준 JSDoc 없음
  - 위치: `embedding.service.ts:397-410`, `graph-extraction.service.ts:926-938`
  - 상세: 두 파일의 `private emitEvent(...)` 메서드는 함수 docstring 없이 호출부 위 인라인 주석
    (`event 는 KbEventType 로 좁혀 …`)만으로 의도를 전달한다. 다만 같은 파일의 다른 private 헬퍼
    (`capErrorMessage`, `safeSlice` 등)도 동일하게 독스트링이 없어 기존 코드 스타일과 일관적이며,
    캐스트 제거의 "왜"는 인라인 주석이 정확히 설명하고 있어 실질적 정보 손실은 없다.
  - 제안: 조치 불필요 (기존 스타일과 정합, 인라인 주석으로 충분).

- **[INFO]** `websocket.service.ts` 의 `KbEventType` JSDoc 갱신이 실제 시그니처 변경과 정확히 일치
  - 위치: `websocket.service.ts:1306-1308` (KbEventType JSDoc 블록)
  - 상세: 새로 추가된 문장 "emit 경로도 이 union 을 컴파일타임에 강제한다 — `Embedding/GraphExtractionService`
    의 private `emitEvent(event: KbEventType, …)` 시그니처가 union 밖 이벤트명을 build 에러로
    차단한다" 는 실제 diff (두 서비스의 시그니처 변경)와 정확히 부합한다. 오래된 주석/거짓 서술 없음.
    "총 11종 = embedding 6 + graph 5" 서술도 이번 변경으로 union 멤버가 바뀌지 않아 여전히 정확.
  - 제안: 없음 (참고용 긍정 확인).

- **[INFO]** CHANGELOG 미갱신
  - 위치: `CHANGELOG.md` (변경 없음)
  - 상세: 이번 변경은 순수 컴파일타임 타입 강제 강화로 런타임 동작·API·계약 멤버가 전혀 바뀌지
    않는다 (plan 문서 "범위 밖" 절에 명시). 프로젝트의 최근 유사 사례(PR #920 "reaper/engine DRY
    + WebChat naming 리팩터" — behavior-preserving 리팩터)도 CHANGELOG 에 별도 항목을 추가하지
    않은 선례가 있어(grep 확인), 이번 누락은 관례에 부합하며 문제로 보지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** spec 문서(`6-websocket-protocol.md` §4.3 등) 미갱신도 정합
  - 위치: `spec/5-system/6-websocket-protocol.md:722` 등
  - 상세: spec 은 이미 "backend 권위 정의는 `WebsocketService` 의 `KbEventType` union" 이라고
    서술하고 있으며, 이번 변경은 그 권위 정의가 emit 지점에서도 실제로 강제됨을 코드 레벨에서
    보강한 것뿐이라 spec 본문에 새 사실이 추가되지 않는다. plan 의 "spec 본문 변경 불필요" 판단과
    일치.
  - 제안: 조치 불필요.

- **[INFO]** 신규 plan 문서(`kb-websocket-emit-compile-guard.md`) 자체의 문서 품질 양호
  - 위치: `plan/in-progress/kb-websocket-emit-compile-guard.md`
  - 상세: 배경/근본원인 → 목표 → 변경대상 → 범위 밖 → impl-prep 판단 → 검증 체크리스트 구조가
    plan-lifecycle 스키마와 정합하며, "왜"(과거 `document:graph_error` 되살아남 리스크)를
    구체적 사례로 설명해 근거가 명확하다. `spec_impact: none` 형식도 프로젝트 컨벤션(YAML 값)에
    부합.
  - 제안: 없음.

CHANGELOG·README·spec 미갱신에 대한 근거 확인용 조회:
`grep -n "reaper\|DRY\|naming" CHANGELOG.md` → PR #920(behavior-preserving 리팩터)도 별도
CHANGELOG 항목 없이 병합된 선례 확인. `grep -rn "emitKbEvent" codebase/backend/src` → 캐스트가
남아있는 잔존 호출부 없음(전량 정합).

### 요약
이번 변경은 스코프가 매우 좁은 순수 타입 강제 강화(런타임 무변경, union 멤버 불변)이며, 문서화
측면에서 결함이 발견되지 않았다. 인라인 주석이 "왜 `as` 캐스트를 제거했는지"를 두 서비스 파일 모두에서
정확하고 일관되게 설명하고, `websocket.service.ts` 의 `KbEventType` JSDoc 도 새로 강제되는 컴파일타임
계약을 정확히 반영하도록 갱신되었다. CHANGELOG·README·spec 본문 미갱신은 모두 프로젝트 관례(순수
behavior-preserving 변경은 사용자 대면 변경 로그 대상이 아님)와 plan 문서의 명시적 "범위 밖" 판단에
부합해 누락으로 보기 어렵다. 신규 plan 문서도 배경·근거·검증 체크리스트를 충실히 갖춰 추적 가능성이
높다.

### 위험도
NONE
