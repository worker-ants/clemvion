# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지/버전/라이선스 변경 없음 — 순수 내부 모듈 리팩터
  - 위치: 전체 diff (`package.json` / `package-lock.json` / `pnpm-lock.yaml` 미변경 확인)
  - 상세: 이번 변경 38개 파일 전부 TypeScript import 경로 조정 + plan/review 문서다. `websocket.service.ts` 가 함께 export 하던 이벤트 enum·타입 선언을 신규 `websocket-events.types.ts` (import 0줄, "의존성-프리 모듈")로 분리하고, 25개 소비 지점의 import 를 재배선했다. 새 외부 라이브러리 추가, 버전 고정 변경, 라이선스 이슈, 알려진 취약점 관련 사항 전무.
  - 제안: 해당 없음.

- **[INFO]** 내부 모듈 의존 그래프 재구성 — 순환 의존성(circular import) 해소 목적, 설계·검증 모두 양호
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` (신규, 전체) / `codebase/backend/src/modules/websocket/websocket.service.ts:14-19`(re-import), `:31-46`(re-export)
  - 상세: `websocket.service ↔ websocket.gateway ↔ execution-engine/retry-turn ↔ event-emitter` ES-module 순환 위에서 enum(`ExecutionEventType` 등)을 모듈 스코프에서 평가하면 `undefined` 가 되는 실측 회귀(#1174, 72 suites 실패)를 근본 차단하기 위해, 값·타입 선언을 import 0줄인 별도 모듈로 옮겼다. `websocket.service.ts` 는 하위호환을 위해 값/타입을 그대로 re-export. 타입만 쓰는 12곳은 신규 모듈을 직접 import 하도록 전환했고, 서비스+enum 둘 다 필요한 9곳은 import 를 분리했다(1차 시도가 66 suites 실패로 불충분함을 드러내 교정한 이력이 plan 문서에 남아 있음). 최종 425/425 통과 및 역재현(모듈 스코프 파생 되돌려도 안 터짐)까지 검증. dependency 관점에서 이는 **내부 모듈 간 의존 관계(8번 항목)의 정당한 재구성**이며 순환을 실제로 끊었다는 근거가 충분하다.
  - 제안: 없음 — 우수 사례로 판단.

- **[INFO]** 하위호환 re-export 경로가 여전히 잠재적 회귀 표면 — 정적 가드 부재
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:31-36` (`export { ExecutionEventType, NodeEventType, BackgroundRunEventType, NotificationEventType };`)
  - 상세: `websocket.service.ts` 가 여전히 enum 값들을 재-export 하므로, 향후 신규 코드가 (부주의로) 이 값들을 `'../websocket/websocket.service'` 에서 값으로 import 하면 다시 순환 경로에 올라탈 수 있다. `tsc` 는 이런 런타임 모듈-평가-순서 버그를 잡지 못하며, 현재는 "모듈 스코프 상수(`TERMINAL_SHAPE`)를 캐너리로 남긴다"는 문서화된 관찰(운영상 감지) 방식에 의존한다. lint 레벨의 `no-restricted-imports` 등 자동 가드는 아직 없다.
  - 제안: 이번 PR 범위 밖 개선 제안으로 — 후속 작업에서 `eslint no-restricted-imports` 로 `websocket.service` 에서 enum 값을 import 하는 것을 금지하고 `websocket-events.types` 직접 import 를 강제하는 규칙을 고려. Critical/Warning 아님.

## 요약

이번 변경은 새 외부 의존성 추가, 버전 고정 변경, 라이선스·취약점 이슈가 전혀 없는 **순수 내부 모듈 의존 관계 리팩터**다. `websocket.service.ts` 가 안고 있던 ES-module 순환 위 값 평가 순서 문제(#1174 회귀의 근본 원인)를 import-0줄 전용 타입/enum 모듈로 분리해 실제로 해소했고, 25개 소비 지점 재배선·역재현 검증까지 plan 문서에 기록돼 있어 dependency 관점에서 위험이 낮다. 유일한 잔여 리스크는 하위호환용 re-export 가 향후 실수로 다시 순환 경로를 태울 수 있다는 것인데, 이는 정적 가드가 아직 없다는 INFO 수준 관찰일 뿐 이번 PR 을 막을 사유는 아니다.

## 위험도

NONE
