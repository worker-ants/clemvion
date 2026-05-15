---

### 발견사항

- **[INFO]** `zod` v4 사용 — `z.meta()` / `z.toJSONSchema()` API 적법
  - 위치: `ai-agent.schema.ts` 전반
  - 상세: `package.json` 에서 `"zod": "^4.3.6"` 확인. `z.meta()` 와 `z.toJSONSchema()` 는 Zod v4 정식 API로 버전 정합성 문제 없음.
  - 제안: 없음.

- **[INFO]** `handler.ts` 의 `toolName()` 함수가 사실상 데드 코드 상태
  - 위치: `ai-agent.handler.ts:110-112`, `1341-1353`
  - 상세: `buildTools()` 안에서 `toolNodeIds`를 항상 `[]`로 강제(feature-out)하므로 `toolName(nodeId)` 호출 경로 자체가 도달 불가. 함수 선언과 `normalTools` 빌드 블록이 남아 있어 미래 개발자가 오해할 여지가 있음.
  - 제안: feature 재작성(복원) 시점까지 주석 처리하거나, 복원 PR에서 함께 되살리도록 TODO 주석 추가.

- **[INFO]** 테스트 파일이 실행 엔진 내부 모듈에 직접 의존
  - 위치: `ai-agent.handler.spec.ts:4` — `import { adaptHandlerReturn } from '../../../modules/execution-engine/handler-output.adapter'`
  - 상세: 핸들러 단위 테스트가 `execution-engine` 모듈의 어댑터를 직접 가져오는 cross-module 의존. 어댑터 인터페이스 변경 시 이 테스트도 함께 깨질 수 있음. 단, 해당 import는 프로덕션 회귀 검증(line 599: `adaptHandlerReturn` 호출 시 throw 여부 확인) 목적으로 의도적으로 추가된 것으로 보임.
  - 제안: 현 수준에서 수용 가능. 다만 `adaptHandlerReturn`의 시그니처 변경 시 이 테스트 케이스도 갱신 대상임을 유지 주석으로 명시하면 좋음.

- **[INFO]** `WebsocketService` 의존성이 선택적(optional) 생성자 파라미터로 처리됨
  - 위치: `ai-agent.handler.ts:253-254`
  - 상세: NestJS DI 컨텍스트 밖(테스트, 직접 인스턴스화)에서 `websocketService` 없이도 핸들러가 정상 동작하도록 optional로 선언. 의존성 방향 자체는 단방향(handler → websocket)이며 순환 없음.
  - 제안: 없음. 테스트 편의성과 backward compatibility 측면에서 적절한 설계.

- **[INFO]** 모든 외부 패키지 의존성이 `@nestjs/common`, `zod` 두 가지로 한정
  - 위치: `handler.ts:1`, `schema.ts:1`
  - 상세: 새로 추가된 외부 패키지 없음. 기존 프레임워크/스키마 라이브러리만 사용하며, 불필요한 의존성 추가 없음. 라이선스 리스크 없음.
  - 제안: 없음.

---

### 요약

세 파일 모두 외부 의존성 추가 없이 기존 `@nestjs/common`과 `zod v4` 범위 내에서 구현되었으며, 내부 모듈 간 의존 방향도 단방향으로 순환이 없다. 주요 관심 사항은 feature-out으로 인한 `toolName()` 데드 코드와 테스트 파일의 실행 엔진 어댑터 직접 참조인데, 전자는 향후 복원 시 혼란의 여지가 있고 후자는 의도적 회귀 테스트로 현재는 수용 가능한 수준이다.

### 위험도
**LOW**