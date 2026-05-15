# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** `WebsocketService` 내부 의존성 정상 제거
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` — 생성자 및 import 전체
  - 상세: 변경 전 `KbStatsHelper` 는 `WebsocketService` 를 생성자 주입으로 받았으나, 해당 경로가 `emitExecutionEvent` 의 채널 prefix 변환으로 인해 frontend 에 도달하지 못하는 dead path 로 확인되었다. 이번 변경으로 `WebsocketService` import 및 constructor 파라미터가 모두 제거되어 `KbStatsHelper` 의 의존 그래프가 `DataSource` 단일 의존으로 단순화되었다. 이는 올바른 방향이다.
  - 제안: 없음 — 제거가 적절히 수행되었음.

- **[INFO]** 외부 패키지 추가 없음
  - 위치: 변경된 3개 파일 전체
  - 상세: 이번 diff 에서 `package.json` 또는 lock 파일(`package-lock.json`)의 변경이 존재하지 않는다. `@nestjs/testing`, `typeorm` 의 `DataSource` 는 기존 프로젝트 의존성이며 신규 도입 패키지가 없다.
  - 제안: 없음.

- **[INFO]** 테스트 파일의 의존성 범위가 적절함
  - 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` — import 구문
  - 상세: 신규 작성된 spec 파일은 `@nestjs/testing` 의 `Test`/`TestingModule` 과 `typeorm` 의 `DataSource` 만 import 한다. `DataSource` 는 실제 인스턴스가 아닌 `{ query: jest.Mock }` 형태의 stub 으로 교체되어 테스트가 외부 DB 연결이나 추가 패키지 없이 실행 가능하다.
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 관계 단방향성 유지
  - 위치: `kb-stats.helper.ts` 생성자
  - 상세: 변경 전 `KbStatsHelper` → `WebsocketService` 의존이 존재했다. `KbStatsHelper` 는 `knowledge-base/graph` 도메인이고 `WebsocketService` 는 `websocket` 도메인으로, graph 도메인이 인프라 서비스를 참조하는 구조였다. 이번 제거로 `KbStatsHelper` 는 `DataSource`(TypeORM 인프라) 만 의존하게 되어 레이어 간 결합이 완화되었다.
  - 제안: 없음.

## 요약

이번 변경은 새 외부 의존성 추가 없이 기존 내부 의존성(`WebsocketService`)을 제거한다. `KbStatsHelper` 가 도달 불가한 WebSocket broadcast 경로를 위해 불필요하게 `WebsocketService` 를 주입받던 구조가 해소되었으며, 이에 따라 클래스의 의존 그래프가 `DataSource` 단일 의존으로 명확해졌다. 신규 테스트 파일도 `@nestjs/testing` 과 `typeorm` 이라는 기존 devDependency 만 활용하여 외부 패키지 영향이 없다. 버전 충돌, 라이선스 위반, 보안 취약점 관련 위험 요소는 전혀 존재하지 않는다.

## 위험도

NONE
