# 변경 범위(Scope) 리뷰

## 발견사항

없음. 변경 4개 파일(`embedding.service.ts`, `graph-extraction.service.ts`, `websocket.service.ts`, `plan/in-progress/kb-websocket-emit-compile-guard.md`) 모두 plan 문서에 명시된 "순수 타입 강제 강화" 의도와 1:1 로 대응하며, `git diff --stat origin/main...HEAD` 로 확인한 실제 changeset(4 files changed, 72 insertions, 14 deletions)도 리뷰 payload 에 제시된 4개 파일과 정확히 일치한다 — payload 밖에 숨겨진 변경 없음.

- **[INFO]** websocket.service.ts 의 JSDoc 4줄 추가
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `KbEventType` 타입 주석 블록
  - 상세: 코드 동작 변경은 없고 "emit 경로도 이 union 을 컴파일타임에 강제한다" 는 설명 문단만 추가됐다. plan 문서(`plan/in-progress/kb-websocket-emit-compile-guard.md`)에 "선택 항목 반영" 으로 사전에 명시된 항목이라 undocumented scope creep 은 아니다.
  - 제안: 없음(문서 그대로 승인 가능).

## 세부 확인

1. **의도 이상의 변경**: 없음. `emitEvent(event: string, ...)` → `emitEvent(event: KbEventType, ...)` 타입 좁히기 + `as Parameters<...>` 캐스트 제거가 embedding/graph 두 서비스에 동형으로만 적용됨. union 멤버(11종) 변경 없음, 신규 동작 없음.
2. **불필요한 리팩토링**: 없음. 캐스트 제거에 따라 `emitKbEvent(...)` 호출부가 3줄 캐스트 표현식에서 1줄로 줄어든 것은 타입 시그니처 변경의 직접적 귀결이지 별개 리팩토링이 아님.
3. **기능 확장**: 없음. 새 이벤트 타입, 새 API, 새 브랜치 없음. 순수 컴파일타임 계약 강화.
4. **무관한 수정**: 없음. 수정된 3개 코드 파일 모두 `KbEventType` emit 경로에 직접 관련. plan 문서는 신규 생성이며 관례(`plan/in-progress/<name>.md`, frontmatter 포함)를 따름.
5. **포맷팅 변경**: 없음. diff 는 실질 변경(타입 파라미터, import, 캐스트 제거)에 국한되며 개행/공백만 바뀐 라인 없음.
6. **주석 변경**: JSDoc 추가 2건(websocket.service.ts 1건 설명 + 각 서비스 emitEvent 내부 1줄 설명 주석 2건)은 전부 이번 타입 강제 변경 자체를 설명하는 내용으로, 무관한 주석 정리/삭제 아님.
7. **임포트 변경**: `import { WebsocketService, type KbEventType } from '../../websocket/websocket.service'` 추가만 있고, 두 심볼 모두 실제 사용됨. 미사용 임포트 없음.
8. **설정 변경**: 없음. `.eslintrc`, `tsconfig`, CI, package.json 등 설정 파일 변경 없음.

## 요약
diff 는 plan 문서(`kb-websocket-emit-compile-guard.md`)에 사전 정의된 좁은 목표 — private `emitEvent` 의 `event` 파라미터를 `string` 에서 `KbEventType` 으로 좁히고 unsafe cast 를 제거해 union 밖 이벤트명을 build 에러로 차단 — 를 정확히 그 범위 안에서만 구현했다. `git diff --stat origin/main...HEAD` 로 실제 changeset 을 대조해도 리뷰 payload 의 4개 파일 외 추가 변경이 없음을 확인했으며, union 멤버(11종) 불변·신규 API/동작 없음·불필요한 리팩토링/포맷팅/설정 변경 없음. websocket.service.ts 의 JSDoc 4줄 추가만 코드 동작과 무관한 문서화 성격이나, 이는 plan 에 "선택 항목" 으로 명시적으로 예고된 것이라 scope violation 으로 보지 않는다.

## 위험도
NONE
