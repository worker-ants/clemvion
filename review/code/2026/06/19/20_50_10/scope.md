# 변경 범위(Scope) 리뷰

## 발견사항

### 코드 변경 (파일 1–17)

변경 의도: C-1 후속 ④ — `EngineDriver` ISP 분할(부분 인터페이스 계층 도입) + engine→Retry 순환 DI 제거 + 외부 진입점의 `RetryTurnService` 직접 호출 전환.

- **[INFO]** `execution-event-emitter.service.ts` — `forwardRef` 추가
  - 위치: 파일 8 (`events/execution-event-emitter.service.ts`)
  - 상세: `WebsocketService` 주입을 `@Inject(forwardRef(() => WebsocketService))` 로 변경. 변경 이유는 인라인 주석에 명시됨 — engine→Retry DI 제거로 ES-module 순환 경로가 짧아지면서 기존에 숨어 있던 `ws.service↔gateway↔event-emitter` 순환이 표면에 드러났고, 이를 `forwardRef` 로 견고화한다는 취지. 직접적인 ISP 분할 범위에는 속하지 않으나, 이번 DI 재구조화가 유발한 부작용 수정이므로 **범위 내 필요 변경**이다.

- **[INFO]** `execution-engine.module.ts` — `RetryTurnService` export 추가
  - 위치: 파일 9
  - 상세: engine→Retry 역방향 주입 제거의 결과로 외부 진입점이 `RetryTurnService` 를 직접 소비해야 하므로 module export 에 추가. ISP 분할의 필수 후속 조치이며 범위 내다.

- **[INFO]** `execution-engine.service.ts` — `retryLastTurn` / `applyRetryLastTurn` delegator 제거
  - 위치: 파일 11
  - 상세: 기존 thin delegator 2개(~90줄) 삭제 및 `RetryTurnService` import·DI 필드 제거. 이번 PR 의 핵심 목적인 순환 DI 해소를 위한 변경이며 범위 내다.

- **[INFO]** JSDoc/주석 변경 (파일 2, 4, 7, 11, 15)
  - 위치: 서비스 파일들의 클래스 수준 JSDoc
  - 상세: `EngineDriver` → `AiTurnEngineDriver` / `InteractionEngineDriver` / `RetryEngineDriver` 타입명 갱신 및 ISP 설명 추가. 코드 변경과 직접 연동되는 문서 갱신이므로 범위 내다. 불필요한 주석 정리나 무관 내용 추가는 없다.

- **[INFO]** `engine-driver.interface.ts` — `EngineDriver` 인터페이스 분해 + `EngineDriver` 합집합 유지
  - 위치: 파일 7
  - 상세: 단일 12-멤버 인터페이스를 `CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver`, `EngineDriver`(합집합) 6개로 재구조화. ISP 분할 자체가 이번 PR 의 목적이므로 범위 내다. `contextKeyOf` 가 `CoreEngineDriver` 로 이동한 것도 다른 부분 인터페이스에서 공통으로 필요하므로 자연스럽다. 새 멤버 추가나 시그니처 변경은 없다.

- **[INFO]** `review/consistency/` 파일들 (파일 18–24)
  - 위치: `review/consistency/2026/06/19/17_39_03/` 하위 파일들
  - 상세: 구현 착수 전 `--impl-prep` consistency check 산출물. CLAUDE.md 규약상 `developer` 착수 전 의무 검토 산출물이며 `review/consistency/**` 위치에 적절히 저장됨. 범위 내다.

### 범위 일탈 가능성 있는 항목

없음. 검토한 17개 코드 파일과 7개 review 산출물 전체가 다음 하나의 작업 목적에 수렴한다:
- ISP 분할로 소비자별 타입 노출 축소
- engine→Retry 역방향 DI 제거 (순환 해소)
- 외부 진입점의 delegator 우회 (직접 호출)
- 위 변경에서 파생된 ES-module 순환 견고화 (`forwardRef`)
- 관련 테스트의 mock 타입 및 호출 대상 동기화

무관한 파일 수정, 불필요한 리팩토링, 포맷팅 전용 변경, 사용하지 않는 import 추가/정리, 의도하지 않은 설정 변경은 발견되지 않았다.

## 요약

이번 변경은 "C-1 후속 ④ — EngineDriver ISP 분할 + engine→Retry 순환 DI 제거"라는 단일 목적에 완전히 집중되어 있다. 수정된 17개 코드 파일은 (1) `engine-driver.interface.ts` 의 인터페이스 계층화, (2) 각 소비 서비스의 타입 참조 갱신, (3) 엔진의 thin delegator 제거와 그에 따른 외부 진입점 리와이어링, (4) 파생된 ES-module 순환 대응(`forwardRef`)으로 깔끔하게 분류되며, 변경 의도 외의 추가 수정·리팩토링·기능 확장은 없다. 테스트 파일들도 대응 mock 타입과 assertion 대상만 교체했고 테스트 로직 자체는 변경하지 않았다. review/ 산출물은 프로젝트 규약 상 착수 전 의무 검토 결과물이다.

## 위험도

NONE
