# 의존성(Dependency) 리뷰 결과

## 발견사항

### 새 의존성

- **[INFO]** 외부 npm 패키지 신규 추가 없음
  - 위치: 전체 변경셋
  - 상세: 이번 변경은 전적으로 내부 모듈 간 의존 관계 재구성(ISP 적용)이며, `package.json` / lockfile 변경 없음.
  - 제안: 없음.

### node_modules 심링크 (파일 14)

- **[WARNING]** `node_modules` 가 절대 경로 심링크(`/Volumes/project/private/clemvion/node_modules`)로 diff에 포함됨
  - 위치: `node_modules` (diff 파일 14)
  - 상세: diff에 `node_modules` 새 심링크가 포함되어 있다. 이는 일반적으로 `.gitignore`에서 제외해야 할 항목이다. 심링크가 절대 경로를 가리키므로 다른 환경에서 클론 시 해당 경로가 없으면 broken symlink가 된다. 실제 커밋에 포함된다면 빌드 재현성 문제를 야기한다.
  - 제안: `.gitignore`에 `node_modules` 항목 포함 여부를 확인하고, 해당 심링크를 커밋 대상에서 제외할 것.

### 내부 의존성 — ISP 분해

- **[INFO]** `EngineDriver` 단일 인터페이스를 소비자별 부분 인터페이스로 분해
  - 위치: `engine-driver.interface.ts`
  - 상세: `CoreEngineDriver` → `InteractionEngineDriver` / `ReentryStateDriver` → `AiTurnEngineDriver` / `RetryEngineDriver` → `EngineDriver` 계층 구조. 런타임 바인딩(`ENGINE_DRIVER` useExisting)은 그대로이므로 DI 토큰·구현체는 불변. 컴파일 타임 가시성만 좁혀짐.
  - 제안: 없음. ISP 방향으로 올바른 개선.

- **[INFO]** `RetryTurnService`가 `execution-engine.module.ts` exports에 추가됨
  - 위치: `execution-engine.module.ts` (exports 섹션)
  - 상세: `WebsocketGateway`·`ContinuationExecutionProcessor`가 `RetryTurnService`를 직접 주입받도록 모듈 export 확장. engine→Retry 역방향 순환 DI를 제거하고 단방향(Retry→engine)으로 정리한 결과. DI 그래프를 단순화한다.
  - 제안: 없음.

- **[INFO]** `ExecutionEventEmitter`에 `forwardRef(() => WebsocketService)` 추가
  - 위치: `execution-event-emitter.service.ts`
  - 상세: retry-turn.service import 위치 이동으로 ws.service↔gateway↔event-emitter ES-module 순환이 더 짧은 경로로 노출됨에 따라 `forwardRef`로 주입을 지연 해석. 런타임 동작 불변. 순환 해소를 위한 표준 NestJS 패턴.
  - 제안: 없음. 다만 중장기적으로 ws.service와 event-emitter 간 단방향 의존 구조 정리 검토 가능(현 범위 밖).

- **[INFO]** `WebsocketGateway`에 `forwardRef(() => RetryTurnService)` 주입 추가
  - 위치: `websocket.gateway.ts`
  - 상세: 기존 `ExecutionEngineService.retryLastTurn` delegator 제거 후 `RetryTurnService`를 직접 주입. websocket 모듈과 execution-engine 모듈의 기존 양방향 `forwardRef` 패턴과 일관됨.
  - 제안: 없음.

### 버전 고정 / 라이선스 / 취약점 / 번들 크기

- **[INFO]** 신규 외부 패키지가 없으므로 해당 점검 항목 전부 N/A
  - 상세: 모든 변경이 내부 모듈 재배선 및 타입 인터페이스 개편. 기존 `@nestjs/common`·`@nestjs/bullmq`·`typeorm`·`bullmq` 등은 이미 프로젝트에 존재하는 의존성이며 변경 없음.

## 요약

이번 변경(C-1 후속 ④ ISP)은 외부 패키지를 일체 추가하지 않았으며, 내부 모듈 간 의존 관계를 단방향으로 정리하고 `EngineDriver` 인터페이스를 소비자별 최소 표면으로 분해한 순수 리팩터링이다. 의존성 관점의 실질적 위험은 없다. 유일한 주의 사항은 `node_modules` 절대경로 심링크가 diff에 포함된 점으로, 이것이 실제 커밋 대상이라면 `.gitignore` 누락 또는 의도치 않은 스테이징이므로 확인이 필요하다.

## 위험도

LOW
