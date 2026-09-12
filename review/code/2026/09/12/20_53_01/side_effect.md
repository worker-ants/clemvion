# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 `:id` 파이프 추가는 의도된 공개 API 행위 변경(500→400)이며, 영향 범위를 실측·문서화했다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 메서드의 `@Param('id', ParseUUIDPipe) triggerId: string` (unified diff 게이트 `287`행 부근, 컨텍스트 없어 함수명으로 특정)
  - 상세: 비-UUID `:id` 가 이전엔 Postgres SQLSTATE 22P02 → `GlobalExceptionFilter` 미분기 → `500 INTERNAL_ERROR` 로 마스킹되던 것이, 이제 Nest 파이프 단계에서 `400 VALIDATION_ERROR` 로 끊긴다. 이는 순수 내부 리팩터링이 아니라 **HTTP 응답 코드가 바뀌는 공개 인터페이스 변경**이므로 이 리뷰 관점(§5 인터페이스 변경)의 정의상 검토 대상이다. 다만 이미 `CHANGELOG.md`(파일 1, 게이트 3~24행)에 "Behavior change" 로 명시했고, 저장소 안의 유일한 소비자(프런트엔드 토스트)가 status 코드를 분기하지 않음을 확인했다고 적었다. 저장소 밖 클라이언트·모니터링이 5xx 를 재시도/알림 신호로 쓰고 있었다면 그 신호가 사라진다는 점도 CHANGELOG 에 명시적으로 경고돼 있다.
  - 제안: 이미 문서화·검증됐으므로 추가 조치 불요. 배포 노트/릴리스 공지에 이 CHANGELOG 항목이 실제로 전달되는지만 확인.

- **[INFO]** 형제 파이프 미적용 유닛 테스트는 이번 변경의 영향을 받지 않음(회귀 아님) — side-effect 관점에서 긍정적으로 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts` — 상단 `describe('TriggersController.rotateBotToken', ...)` (게이트 21~96행, `TRIGGER_ID = 'trig-1'`)
  - 상세: 이 describe 블록은 `new TriggersController(...)` 로 컨트롤러를 직접 인스턴스화해 Nest 파이프가 실행되지 않는 경로다. 비-UUID 값(`'trig-1'`)을 그대로 쓰고 있지만 `ParseUUIDPipe` 추가로 인한 부작용(회귀)이 없음을 코드 자체가 보증한다 — 새로 추가된 HTTP 왕복 describe(게이트 229~300행)가 이 사실을 docstring 으로 명시하고 실제로 다른 검증 층(파이프가 실행되는 경로)을 담당한다. 의도치 않은 상태 변경 없음.

- **[NONE]** 신규 가드(`param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`)의 파일시스템 접근은 읽기 전용이며 테스트 전용 경로에 국한
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` 의 `scanUuidParams` (게이트 131~194행, `fs.readFileSync` 호출은 게이트 141행)
  - 상세: `fs.readFileSync` 로 `*.controller.ts` 를 읽기만 하고 쓰기는 없다. 파일 수집은 기존 공유 유틸 `collectTsFiles`(`common/__test-utils__/source-scan.ts`, 이번 PR 미변경)를 재사용하며 `node_modules`/`dist` 를 제외하는 기존 안전장치를 그대로 물려받는다. `jest` 테스트 실행 시에만 동작하고 프로덕션 런타임 경로에는 없다. 새 전역 변수·프로세스 상태 변경 없음.

- **[NONE]** 신규 fixture 컨트롤러(`sample.controller.ts`)가 실제 애플리케이션에 자동 등록될 경로 없음을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (신규 파일 전체)
  - 상세: `@Controller('fixture')` 데코레이터가 붙은 클래스지만 어떤 `@Module({ controllers: [...] })` 에도 등록되지 않았고, `app.module.ts` 등에서 디렉터리 기반 자동 controller 스캔(`glob`/`require.context`/`readdirSync` 기반 동적 import) 패턴이 저장소에 존재하지 않음을 grep 으로 확인했다(0건). 따라서 이 fixture 가 실제 라우트로 노출되거나 프로덕션 OpenAPI 문서에 실릴 위험은 없다. 프로덕션 스캔 루트(`src/modules`)가 아닌 `src/repo-guards/__tests__/fixtures/` 아래에 있어 대상 가드(`param-uuid-pipe`)의 판정에도 걸리지 않는다 — 이는 파일 자체 주석(게이트 3~9행)이 명시하고, `swagger-dto-contract`·`nullable-type-lie-cast` 처럼 `src/` 전체를 훑는 형제 가드가 여전히 이 파일을 순회한다는 점까지 이미 적어 두어 새로운 은폐가 아니다.

- **[NONE]** HTTP 왕복 테스트의 Nest 애플리케이션 생명주기가 올바르게 스코프됨(리소스 누수 없음)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts` — `describe('POST /triggers/:id/chat-channel/rotate-bot-token — :id 파이프 (HTTP)', ...)` (게이트 229~300행)
  - 상세: `beforeAll` 에서 `moduleRef.createNestApplication()` + `app.init()`, `afterAll` 에서 `app.close()` 로 정확히 짝지어졌다. `app.useGlobalFilters(new GlobalExceptionFilter())` 는 이 테스트 전용 애플리케이션 인스턴스에만 적용되며 다른 describe 블록·다른 파일의 전역 상태에 영향을 주지 않는다. `beforeEach` 의 `rotateBotToken.mockClear()` 도 같은 파일 내 지역 mock 만 초기화한다.

- **[NONE]** `auth.controller.ts`·MDX·`backend-labels.ts`/`.test.ts`·`mcp-servers*.mdx` 변경은 순수 문서/주석/서술 정정으로 런타임 부작용 없음
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` (게이트 433~440행, `@ApiParam` 에 `format: 'uuid'` 추가), `codebase/frontend/src/lib/i18n/backend-labels.ts` (게이트 605~615행, 주석만 추가·`TRIGGER_NOT_FOUND` 값은 불변), `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (게이트 336~348행, 배열 내 순서 이동), 4개 MDX 파일
  - 상세: `auth.controller.ts` 변경은 `switchWorkspace` 의 `ParseUUIDPipe` 는 이미 존재하던 상태에서 Swagger 문서 메타데이터(`format` 필드)만 추가한 것이라 런타임 행위 변경이 없다. `backend-labels.ts` 는 `TRIGGER_NOT_FOUND` 항목의 **값**은 그대로 두고 주석(귀속 설명)만 재배치했다 — diff 를 값 단위로 대조한 결과 실제 문자열 변경 없음. `backend-labels.test.ts` 는 codes 배열 안에서 `TRIGGER_NOT_FOUND` 항목의 위치만 이동(중복 제거)했고 이 배열이 순서에 의존하는 단언(`toEqual` 등 순서 민감 비교)에 쓰이는지는 이번 diff 조각만으로는 판단할 수 없었으나, `Set`/`includes` 기반의 존재-검사 성격의 parity 테스트로 보이며 프롬프트에 실린 전체 파일 컨텍스트가 없어 100% 확답은 어렵다 — 다만 side-effect 관점의 위험(전역 상태·시그니처·네트워크)은 없다. `mcp-servers*.mdx` 의 환경변수명 수정(`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`)은 이미 코드가 쓰고 있는 실제 이름에 문서를 맞춘 것으로, 코드 쪽 변경은 없다(`.env.example`·`mcp.config.spec.ts`·`mcp-tool-provider.ts` 는 이번 diff 에 없음 — 문서만 후행 정정).

- **[NONE]** 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 배선 변경 없음
  - 상세: 17개 변경 파일 전체에서 `process.env` 접근, `fetch`/`http`/외부 SDK 호출, `EventEmitter`/`emit`/콜백 등록 변경은 발견되지 않았다. `plan/**` 두 파일은 순수 계획 문서다.

## 요약

이 PR 의 유일하게 실질적인 부작용은 `rotateBotToken` 엔드포인트가 잘못된 형식의 `:id` 에 대해 `500`(마스킹) 대신 `400`(명시적 검증 실패)을 반환하도록 바뀐 것으로, 이는 클라이언트가 관측 가능한 공개 인터페이스 변경이지만 CHANGELOG 에 breaking change 로 명시되고 저장소 내 유일한 소비자(프런트엔드)에 영향이 없음이 확인됐으며, 파이프 미실행 경로의 기존 유닛 테스트도 이 변경에 영향받지 않음을 코드 구조로 보증한다. 나머지 변경(신규 가드·fixture·HTTP 왕복 테스트·문서/주석 정정)은 읽기 전용 파일시스템 접근이나 테스트 스코프에 국한된 리소스 생성/해제로, 전역 상태·환경 변수·네트워크·이벤트 배선에 대한 의도치 않은 부작용은 확인되지 않았다. fixture 컨트롤러가 실제 앱에 자동 등록될 경로가 없음도 별도로 확인했다.

## 위험도

LOW
