# API 계약(API Contract) 리뷰

## 검토 범위

`guide-error-code-truth` 배치 4라운드 최종 상태(`origin/main...HEAD`, `codebase/` 21개 파일).
핵심은 `POST /api/model-configs/:id/test` 실패 응답 필드명 정정(`error`→`message`), 두 자매
DTO(`ModelTestConnectionResultDto`/`TestConnectionResultDto`)의 값-선언 불일치 해소(`latencyMs`·
`meta` 제거, `code` 추가), 이를 고정하는 계약 테스트, 유저 가이드 에러 코드 표 정정이다. 이미
3라운드의 `/ai-review`(`10_12_19`·`10_40_34`·`11_07_36`)와 `/consistency-check --impl-prep`
(`01_15_40`)가 API 계약 관점을 반복 검토해 발견을 처분했으므로, 이번 라운드는 그 처분이 실제로
소스에 반영됐는지 재확인하고 잔여 신규 결함을 찾는 데 집중했다. 저장소 파일은 뮤테이션하지
않았다(`Read`/`grep` 만 사용, `git status --short` 로 확인).

## 발견사항

- **[INFO]** (재확인 완료) 이전 라운드가 지목한 "형제 엔드포인트 `TestConnectionResultDto` 가
  실제로 나가는 `code` 를 선언하지 않는다"는 이번 최종 상태에서 해소돼 있다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto`, 게이트 472~477행 `code?: string` 선언)
  - 상세: `spec/2-navigation/4-integration.md` §9.1(`798행`)이 `200 + { success:false,
    code:'INTEGRATION_INCOMPLETE' }`를 이미 문서화하고 있음을 직접 확인했고, DTO 선언이 이제
    그 shape 과 일치한다. 같은 diff 에서 생산자 0건이던 `latencyMs`(게이트 460~463행 주석+
    삭제)·`meta`(게이트 482~488행 주석 + 삭제)도 함께 제거해 "선언만 있고 안 나가는 키"와
    "나가는데 선언이 없는 키" 양방향을 한 배치에서 닫았다.
  - 제안: 없음. 남은 MCP 전용 3필드(`capabilities`/`serverInfo`/`preview`) 미선언과 그
    엔드포인트 성공 경로에 `assertMatchesContract` 미배선은
    `plan/in-progress/spec-draft-nullable-notation-followups.md:3266` 에 developer 명의로 이미
    등재돼 있어 스코프 밖으로 적절히 위임됨을 확인했다.

- **[INFO]** `error`→`message` 리네임은 하위 호환성 실질 영향이 없고, 계약 검증이 서비스
  단위·컨트롤러 HTTP 왕복 두 층에 배선돼 있다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts`(`testConnection`, 게이트 323~356행),
    `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`(`POST
    /model-configs/:id/test — 와이어 계약 (HTTP)` describe, 215~261행)
  - 상세: 프런트엔드 소비처(`model-config-manager.tsx`)가 이미 `result.message`를 읽고
    있었고 저장소 전수 검색으로 `.error` 소비처가 없음을 확인했다 — 리네임 이전 상태가 실은
    깨진 계약(토스트가 빈 사유를 냄)이었고, 이번 리네임이 그것을 고치는 방향이다. 컨트롤러
    테스트는 `@nestjs/testing` + 진짜 `LlmService` + 전역 `TransformInterceptor`를 태워
    `res.body.data`의 키를 전수(`Object.keys(...).sort()`)로 고정하므로, 서비스 반환과 실제
    와이어 사이의 인터셉터 층 변형까지 잡는다. `@Roles('editor')` 메타데이터 확인 테스트도
    유지돼 있어 이번 diff 로 인가 계약 회귀는 없다.
  - 제안: 없음.

- **[INFO]** 유저 가이드가 새로 적은 에러 코드 토큰 전량을 backend 소스와 대조 — 전부 실재,
  퇴역/지어낸 이름은 전부 소스에서 0건으로 재확인
  - 위치: `codebase/frontend/src/content/docs/**` (`integrations{,.en}.mdx`,
    `error-handling{,.en}.mdx`, `run-results{,.en}.mdx`, `models{,.en}.mdx`)
  - 상세: `grep -rn` 으로 직접 확인 — `LLM_TIMEOUT`(`nodes/core/error-codes.ts:48`),
    `MAKESHOP_404`/`MAKESHOP_UNKNOWN_OPERATION`/`MAKESHOP_MISSING_FIELDS`/
    `MAKESHOP_INVALID_SHOP_UID`/`MAKESHOP_UNRESOLVED_PATH_PARAM`
    (`makeshop.handler.ts`/`makeshop-mcp-tool-provider.ts`), `DB_HOST_BLOCKED`/
    `EMAIL_HOST_BLOCKED`/`CODE_MEMORY_LIMIT`/`SUB_WORKFLOW_QUEUE_FAILED`/
    `WORKFLOW_FORBIDDEN_WORKSPACE`(`error-codes.ts`) 전부 실재. 퇴역 처리한
    `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`, 지어낸 `MAKESHOP_API_ERROR`,
    `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND` 는 backend/packages 전수 검색에서 0건 —
    CHANGELOG·plan 의 주장과 실측이 일치한다. `models{,.en}.mdx` 의 `<ImplAnchor
    symbol="testConnection">` 도 실제 컨트롤러 메서드명과 일치함을 확인했다.
  - 제안: 없음.

- **[INFO]** API 버전 관리 체계 부재는 이번 PR 이 만든 상태가 아니며, 필드 제거는 CHANGELOG
  고지 + 실측(생산자 0건)으로 완화됐다
  - 위치: `CHANGELOG.md` "⚠️ 배포 시 확인" 절
  - 상세: 이 저장소는 URL/헤더 기반 API 버전 관리를 쓰지 않으므로 응답 필드 제거
    (`latencyMs`/`meta`)는 형식상 breaking change 카탈로그에 속하지만, 두 필드 모두 저장소
    전수 검색상 생산자 0건이었다는 실측이 있어 외부 클라이언트가 실질적으로 이 값을 받아본
    적이 없다. CHANGELOG 항목이 그 사실과 리네임된 필드(`error`→`message`)를 구분해 정확히
    적고 있다.
  - 제안: 없음.

## 확인했으나 문제로 등재하지 않은 사항

- `ModelTestConnectionResultDto.message`/`TestConnectionResultDto.message` 는 둘 다
  `@ApiPropertyOptional({ nullable: true })` + TS 타입 `string | null` 로 선언돼 있는데,
  서비스는 실제로 `undefined`(필드 생략)만 반환하고 `null` 을 명시적으로 채우는 경로는 없다.
  이 선언은 이번 diff 이전부터 존재했고(diff 는 `latencyMs` 제거·`code` 추가만 손댐), TS 의
  `?:` optional modifier 가 `undefined` 를 이미 허용하므로 실질적으로 값을 잘못 거부하지
  않는다 — 스코프 밖·저위험으로 판단해 신규 항목으로 등재하지 않는다.
- URL/경로 설계, 페이지네이션: 이번 diff 에 라우트 추가/변경이나 목록 API 변경이 없어 해당
  없음.
- 요청 검증: 이번 diff 는 응답 shape 만 바꿨고 요청 파라미터/바디 검증 로직 변경이 없다.

## 요약

이번 diff 의 핵심(`POST /api/model-configs/:id/test` 응답 필드 3층 불일치 수정, 형제
`/api/integrations/:id/test` DTO 의 값-선언 양방향 정합화)은 3라운드에 걸친 이전 리뷰가 이미
찾아낸 결함들을 실제로 소스에 반영해 닫았음을 이번 라운드에서 직접 재확인했다 — `code` 필드
선언, `assertMatchesContract` 의 서비스 단위 + 컨트롤러 HTTP 왕복 배선, 유저 가이드 에러 코드
전량의 실재성이 모두 실측과 일치한다. 인증/인가 데코레이터는 변경되지 않았고, 필드 제거는
생산자 0건 실측 + CHANGELOG 고지로 하위 호환성 리스크가 낮다. 남은 갭(MCP 전용 3필드 미선언,
그 엔드포인트 성공 경로 계약 검사 미배선, `testConnection` 응답 shape 의 spec §3 미문서화)은
모두 developer/planner 백로그에 이미 올바르게 위임돼 있어 이번 PR 을 막을 사유가 아니다. 이번
라운드에서 새로 발견된 CRITICAL/WARNING 급 API 계약 결함은 없다.

## 위험도

LOW
