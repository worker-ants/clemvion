# 유지보수성(Maintainability) 리뷰

## 검토 범위

- `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` — JSDoc 추가만
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `NotificationEventType` → `InAppNotificationEventType` 개명 + JSDoc 갱신
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 개명에 따른 import/re-export/사용처 갱신
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` — `hasDefaultExport` 헬퍼 추출 + 캐너리 갱신 + 합성 소스 테이블 테스트 추가
- `plan/in-progress/ws-event-types-extract.md` — 진행 기록 갱신 (문서, 코드 아님)
- `review/code/**`, `review/consistency/**` 신규 파일 다수 — 이전 라운드의 생성된 리포트/상태 산출물(로그성 아티팩트). 애플리케이션 코드가 아니므로 가독성/중복/복잡도 관점의 실질 대상이 아니라고 판단해 상세 분석에서 제외.

실 소스 4파일은 `Read` 로 전체 파일을 직접 열어 diff 문맥 밖의 주변 코드까지 확인했다(프롬프트가 예산 초과로 파일 본문을 절단했기 때문).

## 발견사항

- **[INFO]** `InAppNotificationEventType` 의 JSDoc 이 17줄로 길다 (enum 하나의 문서치고는 이례적으로 큼)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:209-225` (해당 enum 선언부 JSDoc 블록)
  - 상세: 개명 배경·이전 disambiguation 시도의 실패 이유·자매 enum 명명 규칙까지 한 docblock 에 담겨 있다. 다만 이는 이번 diff 에 포함된 `review/code/2026/08/29/23_01_15/RESOLUTION.md` 에서 이미 INFO#4 로 다뤄졌고 "개명 반성의 근거 문서화됨" 을 사유로 won't-do 처분됐다. 독립적으로 다시 봐도 그 판단에 동의한다 — 근거가 실제로 향후 재발(동일 개명 논쟁 반복)을 막는 정보이며, 장식적 나열이 아니다.
  - 제안: 조치 불요. 다만 앞으로 이 파일의 다른 enum 에도 같은 두께의 JSDoc 이 쌓이기 시작하면, 그때는 별도 컨벤션 문서(`spec/conventions/**`)로 배경 설명을 분리하고 코드 주석은 요약+링크로 줄이는 것을 고려할 만하다.

- **[INFO]** `websocket-events.types.spec.ts` 의 `hasDefaultExport` 추출은 중복 제거 관점에서 바람직하다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 의 `hasDefaultExport` 함수 (180-194행) 및 그 호출부 `describe('websocket-events.types — ES-module 순환 재편입 방지 …')` 내 `it('두 모듈 어디에도 export default 가 없다 …')` (357행), 그리고 새 `describe('hasDefaultExport — 합성 소스 테이블')` 블록 (440-461행)
  - 상세: 종전에는 default-export 판정 로직이 `it()` 본문에 인라인 arrow 로 박혀 있어 재사용도, 단위 테스트도 불가능했다. 이번 변경으로 (a) 이름 있는 함수로 추출해 의도(3가지 AST 형태 전수 소진)를 JSDoc 표로 명시했고, (b) `it.each` 합성 소스 테이블로 헬퍼 자체를 저장소 상태와 무관하게 회귀 고정했다. 함수명·JSDoc 스타일도 이 파일의 기존 헬퍼(`importLeavesValueEdge`, `insideFunction` 등)와 일관된다.
  - 제안: 없음 — 모범 사례로 판단.

- **[INFO]** `plan/in-progress/ws-event-types-extract.md` 가 502줄까지 누적됐고, 중첩 인용(`>`) 블록이 여러 세션에 걸쳐 계속 덧붙는 구조다
  - 위치: `plan/in-progress/ws-event-types-extract.md` 전체 (문서, 코드 아님)
  - 상세: "그 밖" 섹션 등에서 세션별 경과 기록이 인용 블록으로 계속 쌓여 항목 하나를 이해하려면 여러 세션의 각주를 순서대로 읽어야 한다. 다만 이 역시 같은 diff 안 `RESOLUTION.md` INFO#5 에서 "plan 문서 정보 밀도 — 근거는 문서에 남긴다 채택 컨벤션" 으로 이미 won't-do 처분됐고, `CLAUDE.md` 의 plan 라이프사이클 규약과도 부합한다(plan 은 완료 후 `plan/complete/`로 봉인되며, 근거를 코드가 아니라 문서에 남기는 것이 이 프로젝트의 명시적 선택이다).
  - 제안: 조치 불요. 코드 자체의 유지보수성에는 영향이 없다.

## 요약

핵심 변경(enum 개명 4파일)은 rename 이 전수 일관되게 적용됐고(전 소비처 grep 재확인 — frontend 참조 0건, backend 잔존 구참조 0건), 새로 추출된 `hasDefaultExport` 헬퍼는 중복 제거·테스트 가능성·문서화 세 축 모두에서 개선이다. 네이밍은 파일 내 자매 enum(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`KbEventType`) 규칙과 일관되고, JSDoc 스타일도 기존 헬퍼 함수들과 통일돼 있다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 새로 도입된 위험은 없다. 유일하게 짚을 만한 것은 JSDoc/plan 문서의 정보 밀도(길이)인데, 둘 다 같은 diff 안에서 이미 검토·처분(won't-do, 근거 명시)됐고 그 판단에 재검토해도 동의한다. 전반적으로 이번 변경은 유지보수성을 개선하는 방향의 리팩터다.

## 위험도

NONE
