# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `rotateBotToken` 비-UUID `:id` 응답이 500→400 으로 바뀐다 — 공개 API 인터페이스의 관측 가능한 행위 변경
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string,`)
  - 상세: `ParseUUIDPipe` 추가로 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 이 비-UUID `:id` 를 즉시 `400 VALIDATION_ERROR` 로 거부한다. 종전엔 그 값이 `findById` 까지 흘러가 Postgres `22P02` → `GlobalExceptionFilter` 미분류 → `500 INTERNAL_ERROR` 로 마스킹됐다. 이는 실제 API 계약(응답 status)의 변경이라, 5xx 를 재시도·알림 트리거로 쓰는 외부 소비자가 있다면 그 신호가 사라진다. `CHANGELOG.md`(`Unreleased — Behavior change`)에 breaking change 로 명시 disclosure 되어 있고 저장소 내 유일한 소비자(프런트엔드 토스트)는 status 분기를 안 해 영향 없음을 확인했다고 적혀 있다 — 하지만 그 확인은 **저장소 안의 소비자에 한정**된 것이고, 이 엔드포인트는 "API flow (automation / CI)" 로 문서화된 공개 REST 엔드포인트(`telegram.mdx` §6 curl 예시)라 저장소 밖 자동화 스크립트/모니터링에는 여전히 영향이 미칠 수 있다. 코드 자체의 결함이 아니라 **의도된 개선**이지만, 부작용 관점에서는 "인터페이스 변경이 기존 사용자에 미치는 영향"에 정확히 해당하므로 기록한다.
  - 제안: 이미 CHANGELOG·spec(`15-chat-channel.md §5.4` 신규 400 행, `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커)에 후속 등재가 되어 있으므로 추가 조치는 불필요. 배포 노트에 이 status 변경을 눈에 띄게 유지할 것.

- **[INFO]** 신규 repo-guard 가 테스트 실행 시점에 `src/modules` 전체를 동기 파일시스템 스캔
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`scanUuidParams` 함수, `fs.readFileSync` 호출부) · `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:55` (`collectTsFiles(SCAN_ROOT)`)
  - 상세: 컨트롤러 35개 파일을 매 테스트 실행마다 AST 파싱한다. 쓰기 부작용은 없고(read-only), 저장소에 이미 존재하는 형제 가드(`dto-class-name-collision` 등)와 동일한 패턴이라 새로운 부작용 클래스는 아니다.
  - 제안: 없음 (기존 관례 준수 확인용 기록).

- **[INFO]** 신규 HTTP 왕복 테스트가 실제 Nest `INestApplication` 인스턴스를 생성·종료
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:245` (`beforeAll` 의 `moduleRef.createNestApplication()` / `app.init()`), `:263` (`afterAll` 의 `app.close()`)
  - 상세: `supertest` 로 실제 요청을 태우기 위해 인-프로세스 HTTP 서버를 띄운다. `TriggersService` 는 `useValue` mock 이라 DB·Redis 등 외부 리소스 접근은 없고, `afterAll` 에서 `app.close()` 로 정리되어 프로세스에 잔존 리소스를 남기지 않는다.
  - 제안: 없음 (정상적으로 정리되는 테스트 전용 부작용).

- **[INFO]** 그 외 파일(`auth.controller.ts` 의 `@ApiParam` 보강, MDX 문서 4곳, `backend-labels.ts`/`.test.ts` 의 주석·항목 재배치, `plan/**` 문서, `CHANGELOG.md`)은 전부 문서·주석·Swagger 메타데이터·테스트 데이터 재배치 수준이며, 전역 상태·환경 변수·네트워크 호출·이벤트/콜백에 영향을 주는 실행 코드 변경이 없다. `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 정정도 문서 텍스트만 바뀌고 실제 env var 참조 코드는 이 diff 에 없다.

## 요약

이번 변경 세트의 유일한 실질적 부작용은 `rotateBotToken` 엔드포인트에 `ParseUUIDPipe` 를 추가해 비-UUID `:id` 응답을 500→400 으로 바꾼 것이며, 이는 함수 시그니처(타입)는 그대로 두면서 HTTP 계약만 바꾸는 의도된 개선이다. 개발자가 CHANGELOG·spec 트래커에 소비자 영향(저장소 내부는 무영향, 외부 소비자는 5xx 신호 상실 가능)까지 명시적으로 적어 두어 disclosure 는 충분하다. 새로 추가된 repo-guard 와 HTTP 왕복 테스트는 파일 읽기·인-프로세스 서버 기동/종료 수준의 부작용만 가지며 모두 test-scoped 로 격리·정리된다. 나머지는 문서·주석·테스트 데이터 재배치로 실행 시 부작용이 없다. 전역 변수 신설/수정, 예상치 못한 파일시스템 쓰기, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 관측되지 않았다.

## 위험도

LOW
