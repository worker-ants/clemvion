# 의존성(Dependency) 리뷰

## 발견사항

### [INFO] 새 외부 패키지 없음 — 변경 전체가 내부 모듈 재편
- 위치: 전체 diff
- 상세: 이번 변경(파일 1~9)은 `package.json` / `package-lock.json` / `yarn.lock` 수정을 포함하지 않는다. 새로 추가된 외부 패키지가 없음.
- 제안: 해당 없음.

### [INFO] 기존 `rxjs` 의존성 신규 활용 — 추가 설치 불필요
- 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 상단 import
- 상세: `firstValueFrom`, `take`, `toArray` 를 `rxjs` 에서 가져오는 import 가 신규 추가되었다. 그러나 `rxjs` 는 이미 `codebase/backend/package.json` 에 `"rxjs": "^7.8.1"` 로 고정(caret 범위)되어 있고, `WebsocketService` 자체가 기존부터 `Observable` / `Subject` 를 사용하므로 런타임 번들·빌드 시간 영향은 없다. 테스트 파일에서 `rxjs` 연산자를 import 하는 것은 Jest 환경에서만 실행되어 프로덕션 번들 크기에도 무관하다.
- 제안: 해당 없음.

### [INFO] 내부 모듈 의존 방향 — 기존 구조 유지
- 위치: `execution-event-emitter.service.ts` → `websocket.service.ts` (기존 의존), `execution-engine.service.ts` → `execution-event-emitter.service.ts` (기존 의존)
- 상세: 새로 추가된 `registerExecutionRouting` / `releaseExecutionRouting` 메서드는 `WebsocketService`(하위 레이어) → `ExecutionEventEmitter`(파사드) → `ExecutionEngineService`(상위 레이어) 순의 기존 단방향 의존 방향을 그대로 따른다. 역방향(순환) 의존이 도입되지 않았다.
- 제안: 해당 없음.

### [INFO] `ExecutionRoutingContext` 인터페이스 — 내보내기 범위 확인
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (신규 export interface)
- 상세: `ExecutionRoutingContext` 가 `export interface` 로 선언되어 `execution-event-emitter.service.ts` 가 이를 가져다 쓴다. 프로젝트 내부 모듈 간 의존이므로 외부 패키지 공개 여부와 무관하나, 해당 타입이 의도치 않게 frontend API 경계로 노출될 가능성은 없는지 점검이 필요하다. 현재 코드 상 이 타입은 backend 내부 module 간 공유에만 사용되고 있어 실제 위험은 낮다.
- 제안: 특별한 조치 불필요. 향후 이 타입이 DTO 레이어로 올라가게 될 경우 Swagger/OpenAPI 노출 범위를 재점검한다.

### [INFO] `null` sentinel 패턴 — 타입 안전성 범위 내
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`
- 상세: `inflight` Map 의 타입이 `Map<string, Promise<ServerEntry>>` 에서 `Map<string, Promise<ServerEntry | null>>` 로 변경되었다. 이는 외부 패키지 추가 없이 TypeScript 타입 조정만으로 처리된 변경이며, 의존성 측면에서 문제가 없다.
- 제안: 해당 없음.

## 요약

이번 변경(chat-channel 라우팅 컨텍스트 등록 API 추가 + MCP 프로바이더 silent skip 패턴 적용)은 외부 패키지를 새로 도입하지 않는다. 유일하게 추가된 import는 `rxjs`의 `firstValueFrom`·`take`·`toArray` 로, 해당 패키지는 이미 `package.json`에 `^7.8.1`로 고정되어 있는 기존 의존성이다. 내부 모듈 간 의존 방향은 기존 단방향 구조를 유지하며 순환 의존이 없다. 라이선스·취약점·번들 크기·호환성 관점에서 우려되는 사항이 발견되지 않았다.

## 위험도

NONE
