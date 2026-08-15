# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지/버전/라이선스 변경 없음 — 순수 내부 모듈 리팩터
  - 위치: 전체 diff (`package.json` / `package-lock.json` / `pnpm-lock.yaml` 무변경 — `git diff origin/main...HEAD --stat -- '**/package.json' '**/package-lock.json' '**/pnpm-lock.yaml'` 결과 0건 확인)
  - 상세: 이번 diff(98개 파일)는 코드 파일 27개(순수 TypeScript import 경로 조정 + `execution-event-emitter.service.ts` 1건의 모듈-스코프 상수 승격), `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 1줄 추가, 나머지는 `plan/`·`review/code/**`·`review/consistency/**` 문서다. `websocket.service.ts` 가 함께 export 하던 이벤트 enum·타입 선언(`ExecutionEventType`, `NodeEventType`, `BackgroundRunEventType`, `NotificationEventType`, `ExecutionChannelEvent`, `KbEventType` 등)을 신규 `websocket-events.types.ts`(import 0줄 확인 — `Read` 로 직접 열어 상단 import 문 없음을 대조)로 분리하고, 소비 지점들의 import 를 재배선했다. 새 외부 라이브러리 추가, 버전 고정 변경, 라이선스 이슈, 알려진 취약점 관련 사항 전무.
  - 제안: 해당 없음.

- **[INFO]** 내부 모듈 의존 그래프 재구성 — 순환 의존성(circular import) 해소 목적, 이전 라운드 지적(`websocket.gateway.ts` 누락)도 이번 diff 에서 해소됨
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts`(신규, 전체) / `codebase/backend/src/modules/websocket/websocket.service.ts`(상단 re-import, `export {...}`/`export type {...}` 블록) / `codebase/backend/src/modules/websocket/websocket.gateway.ts:23`
  - 상세: `websocket.service ↔ websocket.gateway ↔ execution-engine/retry-turn ↔ event-emitter` ES-module 순환 위에서 enum 을 모듈 스코프에서 평가하면 `undefined` 가 되는 실측 회귀(#1174, 72 suites 실패)를 근본 차단하기 위해 값·타입 선언을 import 0줄인 별도 모듈로 옮겼다. `websocket.service.ts` 는 하위호환을 위해 값/타입을 그대로 re-export. 직전 리뷰 라운드(`review/code/2026/08/15/19_27_37/architecture.md`)가 지적했던 "`websocket.gateway.ts` 가 옛 경로(`./websocket.service`)로 `ExecutionEventType` 을 계속 import 한다"는 WARNING 은 이번 diff 의 파일 24(`websocket.gateway.ts:23`)에서 `from './websocket-events.types'` 로 이미 전환되어 있음을 확인했다 — 내부 의존 관계(8번 항목) 재구성이 이번 라운드에서 완결됨.
  - 제안: 없음.

- **[INFO]** 하위호환 re-export 경로가 여전히 잠재적 순환 재유입 표면 — 정적 가드(예: `no-restricted-imports`) 부재는 이전 라운드와 동일하게 남아 있음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `export { ExecutionEventType, NodeEventType, BackgroundRunEventType, NotificationEventType };` / `export type {...}` 블록
  - 상세: `websocket.service.ts` 가 여전히 enum 값들을 재-export 하므로, 향후 신규 코드가 부주의로 이 값들을 `websocket.service` 에서 값으로 import 하면 다시 순환 경로에 올라탈 수 있다. `tsc` 는 이런 런타임 모듈-평가-순서 버그를 잡지 못하며, 현재는 "모듈 스코프 상수(`TERMINAL_SHAPE`)를 캐너리로 남긴다"는 문서화된 관찰 방식 + `websocket-events.types.spec.ts` 의 순환 재편입 정적 검사에 의존한다. lint 레벨 자동 가드는 여전히 없음(이전 라운드 대비 변화 없음).
  - 제안: 이번 PR 범위 밖 개선 제안 — 후속 작업에서 `eslint no-restricted-imports` 로 `websocket.service` 경로에서 enum 값을 import 하는 것을 금지하고 `websocket-events.types` 직접 import 를 강제하는 규칙을 고려. Critical/Warning 아님.

## 요약

이번 변경은 새 외부 의존성 추가, 버전 고정 변경, 라이선스·취약점 이슈가 전혀 없는 순수 내부 모듈 의존 관계 리팩터다(`package.json`/lockfile 무변경 실측 확인). `websocket.service.ts` 가 안고 있던 ES-module 순환 위 값 평가 순서 문제(#1174 회귀의 근본 원인)를 import-0줄 전용 타입/enum 모듈(`websocket-events.types.ts`)로 분리해 실제로 해소했고, 직전 리뷰 라운드가 지적했던 유일한 실측 갭(`websocket.gateway.ts` 가 옛 경로를 계속 참조)도 이번 diff 에서 새 경로로 전환되어 닫혔다. 유일한 잔여 리스크는 하위호환용 re-export 가 향후 실수로 다시 순환 경로를 태울 수 있다는 것인데, 정적 가드가 아직 없다는 INFO 수준 관찰일 뿐 이번 PR 을 막을 사유는 아니다.

## 위험도

NONE
