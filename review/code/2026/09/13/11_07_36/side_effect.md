# 부작용(Side Effect) 리뷰

## 검토 방법

`origin/main...HEAD` 전체 diff(82개 파일, 코드 실질 변경은 `codebase/**` 17개)를 대상으로 검토했다.
프롬프트가 절단한 파일(`llm-model-config.controller.spec.ts`, `guide-error-code-existence.test.ts`,
`guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts` 등)은 저장소 원본을 `Read`로
직접 열어 전문을 확인했다. `git log`로 이 diff 가 세 커밋(`911d9d7dd` 원 구현 → `a68457936` 리뷰
라운드 1 처분 → `de99def86` 리뷰 라운드 2 처분)으로 구성됨을 확인했고, 앞선 두 라운드의
`review/code/2026/09/13/{10_12_19,10_40_34}/side_effect.md` 가 이미 같은 핵심 표면(필드 rename·DTO
필드 제거/추가·신규 가드의 파일시스템 순회·신규 통합 테스트의 앱 생명주기)을 LOW 로 판정해 두었음을
확인하고, 그 결론이 라운드 2 증분(`TestConnectionResultDto.code` 추가, JSDoc 자기모순 정정,
`guide-sanitized-message-parity.test.ts` 신설, `LLM_RATE_LIMIT` 중복 제거, `nodeLabel` 정정, UI 실패
토스트 테스트 추가)에도 유지되는지 재검증했다. 저장소 파일은 뮤테이션하지 않았다 — `grep`/`Read`/`git
diff`/`git log` 만 사용했고, 종료 시 `git status --short` 는 이 세션 자신의 산출물 디렉터리
(`review/code/.../11_07_36`, `review/consistency/.../11_08_03`)만 untracked 로 남아 있었다.

## 발견사항

- **[INFO]** `LlmService.testConnection` 반환 필드 rename(`error`→`message`) — 유일한 내부
  호출부(`LlmModelConfigController.testConnection`, 순수 위임)와 유일한 프런트엔드 소비처
  (`model-config-manager.tsx` `result.message ?? ""`)가 이미 새 이름과 정합함을 `grep -rn
  "\.testConnection("` 로 재확인했다. 다만 이 리네임 전에는 실제 wire 응답이 `{success:false,
  error: "<sanitized message>"}` 형태였다 — 저장소 밖에서 `.error` 를 직접 파싱하는 API
  소비자가 있었다면(프런트엔드를 거치지 않는 3rd-party 클라이언트) 이번 변경으로 깨진다. 이
  가능성은 코드로 배제할 수 없으나, `CHANGELOG.md`(게이트 22~24행)가 "`error`→`message` — 이름이
  바뀌었다. `error` 를 읽던 코드가 있다면 옮겨야 한다" 로 명시 고지하고 있고, 앞선 두 라운드가
  이미 같은 결론(LOW, 저장소 내 소비처 없음)에 도달해 있어 이번 라운드에서 새로 등급을 올릴
  근거는 없다.
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`, 반환 타입 선언과
    `catch` 블록의 `return` 문)
  - 제안: 없음 — 기존 두 라운드의 확인을 재확인.

- **[INFO]** `TestConnectionResultDto`(integrations)에서 `latencyMs`/`meta` 제거 + `code?: string`
  추가 — 제거 두 필드는 `IntegrationTestResult` 인터페이스(`integrations.service.ts`)에 애초에
  생산자가 없었음을 재확인했고(`grep -n "latencyMs\|meta" codebase/backend/src/modules/integrations`
  결과 잔존 참조는 전부 이번 diff 의 근거 주석뿐), 추가된 `code` 는 이미 26곳에서 발행되고 있던
  값을 뒤늦게 선언하는 것이라 additive 이며 하위 호환을 깨지 않는다. `swagger-dto-contract.spec.ts`
  의 allowlist 에도 이 세 필드 이름에 대한 참조가 없어(grep 0건) 갱신이 불필요하다는 이전
  라운드의 확인과 일치한다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto`)
  - 제안: 없음.

- **[INFO]** 신규 파일 `guide-sanitized-message-parity.test.ts` — `fs.readFileSync` 로 backend
  `sanitize-error.util.ts` 1개 파일과 frontend mdx 2개 파일을 읽기만 한다. 쓰기·전역 상태 변경·
  네트워크 호출 없음. 같은 디렉터리의 자매 가드(`guide-error-code-existence.test.ts`,
  `impl-anchor-existence.test.ts`)와 동일한 read-only 패턴을 그대로 따른다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts`
  - 제안: 없음.

- **[INFO]** 신규 컨트롤러 HTTP 왕복 테스트(`llm-model-config.controller.spec.ts`)가 실제 Nest
  애플리케이션을 기동 — `beforeAll`(`app.init()`)/`afterAll`(`app.close()`) 쌍이 정확히 맞고,
  `LLMClientFactory`/`ModelConfigService`/`LlmUsageLogService` 는 전부 `useValue` mock 이라 실제
  DB·외부 LLM provider 네트워크 호출이 발생하지 않는다. `supertest` 는 인메모리 HTTP 서버에만
  접속한다.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:167-213`
  - 제안: 없음.

- **[INFO]** 라운드 2 증분(`nodeLabel` 정정, `LLM_RATE_LIMIT` 표 중복 제거, JSDoc 자기모순 정정,
  UI 실패 토스트 테스트 2건 추가)은 전부 MDX 산문/표 편집 또는 순수 텍스트·테스트 코드이며,
  전역 상태·파일시스템 쓰기·환경변수·네트워크 호출·시그니처를 건드리지 않는다. `git diff
  a68457936..de99def86 -- codebase` 에서 `process.env`/모듈 스코프 `let`·`var` 신규 도입을
  검색해 0건임을 확인했다.
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results{,.en}.mdx`,
    `codebase/backend/src/modules/llm/llm.service.ts`(JSDoc 블록 내부),
    `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx`
  - 제안: 없음.

- **[INFO]** 이번 diff 가 `review/code/**`·`review/consistency/**` 하위에 이전 리뷰/consistency
  세션 산출물을 다수 커밋한다(78개 md/json). 이는 런타임 부작용이 아니라 이 저장소의 명시 관례
  (`plan/complete/`·`review/**` 산출물은 커밋 대상)를 따르는 형태이며, 신규 코드 경로나 상태를
  만들지 않는다.
  - 위치: `review/code/2026/09/13/{10_12_19,10_40_34}/**`, `review/consistency/2026/09/13/{01_15_40,10_12_54,10_41_13}/**`
  - 제안: 없음.

## 요약

이번 diff(라운드 2 처분 포함)의 실질 프로덕션 변경은 여전히 `LlmService.testConnection` 응답
필드 rename(`error`→`message`) 1건과 두 DTO 의 미발행 필드 제거(`latencyMs` ×2, `meta` ×1)·
생산자만 있던 필드의 뒤늦은 선언(`code` ×1)뿐이며, 이번 라운드에서 재검증한 결과 내부 호출부·
프런트엔드 소비처 모두 이미 새 shape 과 정합하고 전역 상태·파일시스템 쓰기·환경변수·의도치 않은
네트워크 호출은 발견되지 않았다. 신규 가드(`guide-error-code-*`, `guide-sanitized-message-parity`)와
신규 통합 테스트는 read-only 파일 스캔 또는 정상적으로 생명주기가 관리되는 인메모리 Nest 앱
기동에 그친다. 유일하게 원론적인 위험은 "저장소 밖 3rd-party API 소비자가 `.error` 필드를 직접
파싱하고 있었을 가능성"인데, 이는 코드로 완전히 배제할 수 없으나 CHANGELOG 로 명시 고지돼 있고
앞선 두 라운드가 이미 이 사실을 인지한 채 LOW 로 수렴시켰다 — 이번 라운드의 증분도 그 결론을
뒤집을 새로운 부작용을 도입하지 않는다.

## 위험도

LOW
