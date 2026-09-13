# 부작용(Side Effect) 리뷰

## 검토 방법

`origin/main` 대비 전체 diff(코드 실질 변경 22개 `codebase/**` 파일 + CHANGELOG/plan/review 산출물)를
대상으로 했다. 프롬프트가 절단한 파일(`llm-model-config.controller.spec.ts`,
`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`, `plan/in-progress/*.md`)은 저장소
원본을 `Read`/`Bash cat`으로 직접 열어 전문을 확인했다. 이 changeset 은 이전 세 리뷰 라운드
(`10_12_19`→`10_40_34`→`11_07_36`)의 처분을 거친 상태이며, 그 라운드들의 `side_effect.md` 가 이미
같은 핵심 표면을 LOW 로 판정해 두었다. 이번 라운드에서는 그 결론을 독립적으로 재검증했다 —
`grep -rn "testConnection("` 로 호출부 재확인, `LlmService.onModuleInit`/`onConfigInvalidatedListener`
직접 열람(누수 가능 타이머·인터벌 없음 확인), 신규 가드 2개 소스 전문 읽기(쓰기 없음 확인). 저장소
파일은 뮤테이션하지 않았다 — `Read`/`Bash`(`grep`/`cat`/`git diff`/`git log`)만 사용했고, 종료 시
`git status --short` 는 이 세션 자신의 출력 디렉터리(`review/code/.../11_33_23`)와 동시 실행 중인
다른 세션의 `review/consistency/.../11_33_51`(내가 만들지 않음)만 untracked 로 남아 있었다.

## 발견사항

- **[WARNING]** `LlmService.testConnection` 의 반환 필드 rename(`error`→`message`)은 저장소 내
  호출부·소비처와는 전부 정합하지만, 이 메서드가 노출하는 HTTP 응답 shape 자체가 저장소 밖에서
  직접 파싱될 수 있는 공개 API 표면이다 — 이는 실질적인 **breaking response shape 변경**이다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`, 반환 타입 선언
    게이트 326행 `Promise<{ success: boolean; message?: string; dimension?: number }>` 및
    `catch` 블록 게이트 354행 `return { success: false, message: sanitizeLlmErrorMessage(message) }`)
  - 상세: `grep -rn "testConnection("`로 내부 호출부를 재확인한 결과 유일한 소비처는
    `LlmModelConfigController.testConnection`(순수 위임, `llm-model-config.controller.ts:115`)이고
    프런트엔드(`model-config-manager.tsx:83`)는 이미 `result.message ?? ""`를 읽고 있어 저장소
    안에서는 깨지는 곳이 없다. 다만 `POST /api/model-configs/:id/test`는 인증된 워크스페이스
    사용자가 호출 가능한 실제 HTTP 엔드포인트이며, 이 리네임 전에는 실패 시 wire 응답이
    `{success:false, error:"<sanitized message>"}` 형태였다. 이 엔드포인트를 프런트엔드를 거치지
    않고 직접 호출하는 3rd-party/자동화 클라이언트가 `.error`를 파싱하고 있었다면 이번 변경으로
    조용히 깨진다 — 코드로 이 가능성을 완전히 배제할 수 없다.
  - 제안: `CHANGELOG.md`(게이트 22~24행)가 "`error`→`message` — 이름이 바뀌었다. `error`를 읽던
    코드가 있다면 옮겨야 한다"로 이미 명시 고지하고 있고, 세 차례의 이전 라운드가 저장소 내
    소비처 부재를 이미 확인한 채 LOW로 수렴시켰다 — 이번 라운드에서 새로 등급을 올릴 근거는
    없다. WARNING 으로 유지하는 이유는 "코드로 배제 불가능한 외부 영향"이라는 성격 자체가 다음
    사람이 재확인해야 할 사실이지 완전히 닫힌 사실이 아니기 때문이다(신호 유지, 차단 사유 아님).

- **[INFO]** 두 DTO(`ModelTestConnectionResultDto`, `TestConnectionResultDto`)에서 `latencyMs`
  제거, `TestConnectionResultDto`에서 `meta` 제거 + `code?: string` 추가 — OpenAPI 선언 층의
  인터페이스 변경이지만 실질 wire 영향은 없음을 재확인
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
    (게이트 52~57행), `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (게이트 460~481행)
  - 상세: `IntegrationTestResult` 인터페이스(`integrations.service.ts`)와 `LlmService.testConnection`
    반환문을 직접 대조한 결과 `latencyMs`/`meta`는 생산자가 0건이었고(제거는 실질 breaking change
    아님), 반대로 `code`는 `integrations.service.ts` 26곳에서 이미 발행 중이던 값을 뒤늦게
    선언한 것(additive)이라 하위 호환을 깨지 않는다. `swagger-dto-contract.spec.ts` allowlist에도
    이 세 필드명 참조가 없어(grep 0건) 갱신 불필요.
  - 제안: 없음.

- **[INFO]** 신규 가드 2개(`guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`)의
  파일시스템 접근은 `fs.readFileSync`뿐이다 — 쓰기·삭제·전역 상태 변경 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`,
    `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`
  - 상세: 두 파일 전문을 직접 읽어 확인했다. `collectBackendTokens`/`scanErrorCodeCitations`는
    인자를 받아 새 `Set`/배열을 반환하는 순수 함수이고, `walkTree(...).map((f) =>
    fs.readFileSync(...))`는 `codebase/backend/src`+`codebase/packages`를 읽기 전용으로 순회한다.
    모듈 스코프에 새 가변 전역(let/var)이 도입되지 않았다(정규식 리터럴은 상수, `lastIndex`는
    매 호출 전 리셋).
  - 제안: 없음.

- **[INFO]** 신규 컨트롤러 HTTP 왕복 테스트가 실제 NestJS 앱을 기동하지만 외부 네트워크 호출은
  발생하지 않는다
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
    (`describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')`)
  - 상세: `beforeAll`의 `app.init()`과 `afterAll`의 `app.close()`가 정확히 짝을 이루고,
    `LLMClientFactory.create`는 `useValue` mock으로 `{testConnection: clientTestConnection}`
    (jest.fn)만 반환하도록 대체돼 있어 실제 LLM provider로의 네트워크 호출 경로가 없다.
    `ModelConfigService`/`LlmUsageLogService`도 전부 mock이라 실 DB 접근도 없다. `supertest`는
    `app.getHttpServer()`가 만든 인메모리 HTTP 서버에만 접속한다. 실제로 주입되는 것은
    `LlmService`뿐인데(자매 단위 spec과 같은 설계 — "필드 이름 축에서 vacuous 해지지 않기 위해"),
    그 서비스의 `onModuleInit`이 구독하는 `onConfigInvalidated`도 mock(`jest.fn()`)이라 실제
    리스너 등록/타이머/인터벌이 생기지 않는다(`LlmService`에 `setInterval`/`OnModuleDestroy` 없음,
    직접 확인).
  - 제안: 없음.

- **[INFO]** 이번 diff가 `review/code/**`·`plan/in-progress/**` 하위에 이전 리뷰 세션 산출물과
  plan 갱신을 다수 포함한다 — 런타임 부작용이 아니라 저장소 명시 관례를 따르는 커밋 대상
  - 위치: `review/code/2026/09/13/{10_12_19,10_40_34,11_07_36}/**`,
    `plan/in-progress/{guide-error-code-truth.md,spec-draft-nullable-notation-followups.md}`
  - 상세: `spec-draft-nullable-notation-followups.md`의 변경은 developer가 자신이 앞서 등재한
    "처분 예고" 문장(`LLM_CONNECTION_ERROR`로 통일)을 실측(§A 항목 자체가 코드를 전혀 내지 않음)
    으로 반증하고 취소선+정정을 추가한 것 — CLAUDE.md의 "자기-반증형 소정정"과 성격이 같은
    plan 문서 편집이며 `spec/`가 아니라 `plan/`이라 그 조항의 적용 대상도 아니다. 코드 실행
    경로·전역 상태와 무관.
  - 제안: 없음.

## 요약

이번 diff의 실질 프로덕션 변경은 여전히 `LlmService.testConnection` 응답 필드 rename
(`error`→`message`) 1건과 두 DTO의 미발행 필드 제거(`latencyMs`×2, `meta`×1)·생산자만 있던 필드의
뒤늦은 선언(`code`×1)뿐이다. 저장소 내부 호출부·프런트엔드 소비처는 전부 새 shape과 이미 정합함을
`grep`으로 재확인했고, 전역 상태·파일시스템 쓰기·환경변수 읽기/쓰기·의도치 않은 네트워크 호출은
발견되지 않았다. 신규 가드(`guide-error-code-*`)와 신규 통합 테스트(`llm-model-config.controller.spec.ts`)
는 read-only 파일 스캔 또는 정상적으로 생명주기가 관리되고 전 의존이 mock 처리된 인메모리 Nest 앱
기동에 그친다. 유일하게 코드로 완전히 닫을 수 없는 위험은 "저장소 밖 3rd-party API 소비자가
`.error` 필드를 직접 파싱하고 있었을 가능성"인데, 이는 CHANGELOG에 "⚠️ 배포 시 확인"으로 명시
고지돼 있고 세 차례의 이전 라운드가 이미 이 사실을 인지한 채 LOW로 수렴시켰다 — 신호는 WARNING으로
유지하되(다음 사람이 재확인할 사실), 이번 라운드의 재검증도 그 결론을 뒤집을 새로운 부작용을
도입하지 않았다.

## 위험도

LOW
