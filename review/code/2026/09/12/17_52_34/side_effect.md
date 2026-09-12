# 부작용(Side Effect) 리뷰

## 발견사항

없음 (CRITICAL/WARNING 없음).

아래는 참고용 확인 사항(비차단):

- **[INFO]** `TriggersController.rotateBotToken` 의 선언 반환 타입이 `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` 에서 `Promise<ChatChannelRotateBotTokenDto>` 로 바뀌었다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 함수 시그니처 (반환 타입 애노테이션)
  - 상세: TS 반환 타입 애노테이션은 런타임에 지워지므로 그 자체로는 부작용이 없다. `@nestjs/swagger` 의 `ApiOkWrappedResponse(ChatChannelRotateBotTokenDto, …)` 는 데코레이터에 **명시적으로 넘긴 클래스 참조**로 스키마를 등록하며 TS 반환 타입 리플렉션(`design:returntype`)에 의존하지 않는다 — 저장소 내 `common/interceptors/**` 도 `design:returntype` 을 읽지 않음을 확인했다. `TransformInterceptor` 는 서비스가 반환한 plain object 를 클래스 인스턴스 변환 없이 `{ data }` 로 감쌀 뿐이므로, 실제 HTTP 응답 바이트는 이 타입 변경 전후로 동일하다(런타임 직렬화 로직 변경 없음).
  - 제안: 조치 불요 — 순수 컴파일타임 안전장치. 다만 `TriggersService['rotateBotToken']` 반환 형태가 앞으로 `ChatChannelRotateBotTokenDto` 와 구조적으로 어긋나면 `tsc` 가 이 자리를 잡아준다는 의도된 설계이므로 향후 필드 추가 시 두 자리(서비스 반환 타입 · 응답 DTO)를 함께 갱신할 것.

- **[INFO]** `chat-channel-input-rules.ts` 에 신규 module-private 함수 3개(`throwInvalidField` · `hasField` · `rejectBlockedField`)가 추가됐다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — 파일 상단, `export` 되지 않은 3개 함수 선언부
  - 상세: 셋 다 `export` 되지 않아 이 파일 밖에서 import 할 수 없다 — 공개 API 표면에 변화 없음. 기존 export 함수(`assertChatChannelInputSafe` 오버로드 3종·`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·`stripChatChannelPlaintext`·`assertInboundSigningPlaintextByProvider`·`translateSetupChannelError`)의 시그니처는 diff 전후로 문자 하나까지 동일함을 `git diff`로 확인했다. 각 함수가 던지는 `BadRequestException` 의 `{ code, message, details: { field, code } }` 형태도 헬퍼 추출 전후 동일 — 순수 리팩터(동작 보존)다.
  - 제안: 조치 불요.

- **[INFO]** `dto-class-name-collision-guard.ts` / `dto-class-name-collision.spec.ts` / fixture 3파일(alpha·beta·decoy) 신규 추가.
  - 위치: `codebase/backend/src/repo-guards/__tests__/**`
  - 상세: `fs.readFileSync` 로 기존 파일을 읽기만 하고, 파일시스템 쓰기·환경 변수 읽기/쓰기·네트워크 호출이 전혀 없음을 grep 으로 확인했다(`writeFile`/`process.env`/`fetch`/`http.`/`exec(` 매치 0건). fixture 클래스들(`alpha.dto.ts`·`beta.dto.ts`·`decoy.dto.ts`)은 `src/repo-guards/__tests__/fixtures/dto-class-collision/` 아래에 있어 (a) 가드 자신의 스캔 대상(`SCAN_ROOTS = ['modules','common']`)에 안 들고 (b) 어떤 Nest 모듈에도 등록되지 않으므로 `SwaggerModule.createDocument` 스캔에도 걸리지 않는다 — 즉 프로덕션 swagger 문서 생성 경로에 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `@ApiUnauthorizedResponse` / `@ApiNotFoundResponse` / `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto, …)` 데코레이터가 `rotateBotToken` 핸들러에 추가됐다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 함수 상단 데코레이터 블록
  - 상세: 세 데코레이터 모두 OpenAPI 문서 메타데이터만 등록하며 요청 처리 파이프라인(가드·인터셉터·실제 인가 로직)에는 관여하지 않는다 — 인증/인가 동작 자체는 기존 `@Roles('editor')` 가드가 그대로 담당하고 변경되지 않았다. 이 라우트에 대한 기존 `@ApiOkResponse`/200 문서가 없었으므로 신규 등록과 충돌하는 기존 데코레이터도 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 (1) `chat-channel-input-rules.ts` 의 11곳 반복 에러 봉투를 module-private 헬퍼 3개로 추출한 순수 리팩터(export 표면·던지는 예외 형태 불변, 신규 헬퍼는 비공개), (2) `rotateBotToken` 엔드포인트의 swagger 문서화 보강(신규 응답 DTO + 데코레이터 3종, 컨트롤러 반환 타입 애노테이션 교체 — 전부 컴파일타임/문서 생성 메타데이터이며 런타임 직렬화·인가 로직 변경 없음), (3) 순수 함수형 신규 repo-guard(파일시스템 읽기 전용, 프로덕션 스캔 경로 밖의 fixture)로 구성된다. 전역 상태·환경 변수·네트워크 호출을 새로 만들거나 건드린 곳이 없고, 기존 공개 함수/엔드포인트의 시그니처·응답 바이트는 보존됨을 diff 대조로 확인했다. 저장소 파일에 대한 뮤테이션 검증 실험은 수행하지 않았다(정적 대조만으로 충분히 판정 가능했음) — `git status --short` 로 리뷰 중 어떤 저장소 파일도 건드리지 않았음을 확인했다(유일한 미추적 항목은 이 리뷰 자신의 산출물 디렉터리).

## 위험도

NONE
