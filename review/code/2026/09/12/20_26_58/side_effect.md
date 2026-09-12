# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 비-UUID `:id` 응답이 500 → 400 으로 바뀐다 (의도된 공개 HTTP 계약 변경)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string,`), 서술: `CHANGELOG.md:59-74`
  - 상세: `ParseUUIDPipe` 추가로 파싱 불가 `:id` 가 이제 컨트롤러 진입 전에 `BadRequestException`(400)으로
    끊긴다. `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:132-153`)의
    `getCodeFromStatus(400)` 가 `VALIDATION_ERROR` 를 반환하므로 CHANGELOG 주장(500 마스킹 →
    400 VALIDATION_ERROR)은 코드로 실측 확인된다. 이것은 순수한 내부 리팩터링이 아니라 **공개 REST
    엔드포인트의 관측 가능한 응답 코드 변경**이다 — 부작용 관점에서 "인터페이스 변경"에 해당한다.
    저장소 안의 유일한 소비자(`codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:393-394`)는
    `onError: () => toast.error(...)` 로 status 를 분기하지 않으므로 내부 영향은 없음을 직접 확인했다.
    다만 이 엔드포인트를 직접 호출하는 **외부(제3자) API 소비자**가 5xx 를 재시도/알림 트리거로 쓰고
    있었다면 그 신호가 사라진다 — CHANGELOG 가 이 리스크를 "배포 시 확인" 항목으로 이미 명시적으로
    고지하고 있어 은폐된 부작용은 아니다.
  - 제안: 추가 조치 불필요. 배포 노트/릴리스 공지에 이 CHANGELOG 항목이 그대로 실리는지만 확인.

- **[INFO]** `@ApiParam({ format: 'uuid' })` 2곳 추가는 생성되는 OpenAPI 스키마를 변경한다
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:436-440` (`switchWorkspace`),
    `codebase/backend/src/modules/triggers/triggers.controller.ts:265` (`rotateBotToken`)
  - 상세: 런타임 동작 변경은 없고(문서 전용 데코레이터), `SwaggerModule` 이 생성하는 OpenAPI 문서의
    해당 파라미터에 `format: 'uuid'` 필드가 추가된다. 저장소 안에 커밋된 정적 `swagger.json`/OpenAPI
    산출물이나 그로부터 codegen 되는 클라이언트 SDK 가 있는지 확인했으나 없음(`find` 결과 0건,
    `SwaggerModule`/`createDocument` 호출부는 `main.ts`·probe 유틸뿐) — 따라서 stale 산출물이나
    하위 호환 문제는 없다.
  - 제안: 없음 (확인 완료, 순수 문서 강화).

- **[INFO]** 신규 가드(`param-uuid-pipe-guard.ts`)가 매 테스트 실행마다 `src/modules` 하위
  `*.controller.ts` 전체를 `fs.readFileSync` + AST 파싱으로 스캔한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` 함수 `scanUuidParams`
    (파일 신규 생성 — 게이트 124-187), 소비처 `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`
  - 상세: 파일시스템 읽기는 테스트 프로세스 안에 격리되어 있고 쓰기는 없다. 같은 디렉터리의 형제 가드들과
    동일한 패턴(`collectTsFiles` 재사용)이라 새로운 부작용 클래스는 아니다. CI 실행 시간에 미미한 증가만
    있고, 이는 이미 존재하는 `swagger-dto-contract`·`nullable-type-lie-cast` 같은 `src/` 전수 스캔
    가드들과 같은 급이다.
  - 제안: 없음.

- **[NONE 확인]** `codebase/frontend/src/lib/i18n/backend-labels.ts` / `backend-labels.test.ts` 변경은
  런타임 동작에 영향 없음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:605-613` (`ERROR_KO` 의 `TRIGGER_NOT_FOUND`
    항목 — 값 불변, 주석만 재배치), `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:339-346`
    (`LOCALIZED_ERROR_CODES` 배열 안 `"TRIGGER_NOT_FOUND"` 재배치)
  - 상세: 두 파일 모두 `TRIGGER_NOT_FOUND` 문자열 값·매핑은 그대로 두고 **소속 주석 블록만 이동**한다.
    `LOCALIZED_ERROR_CODES` 는 `.filter()` 로만 소비되어(`backend-labels.test.ts:354`) 배열 순서에
    의존하지 않으므로 테스트 판정 로직에 영향 없다.
  - 제안: 없음.

- **[NONE 확인]** MCP 문서의 env var 이름 정정(`MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL`)은
  순수 오탈자 수정
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx`
  - 상세: `grep -rn "MCP_INSECURE_URL_ALLOWED" codebase/` 결과 0건 — 옛 이름은 코드베이스 어디에도
    존재한 적이 없고, 실제 env var 는 `codebase/backend/src/common/config/mcp.config.ts:41-42` 등에서
    `MCP_ALLOW_INSECURE_URL` 로 확정된다. 동작 변경이 아니라 문서만 사실에 맞춘 것이다. (본 PR 의
    핵심 스코프인 트리거 UUID 작업과는 무관한 곁다리 수정이지만, 부작용은 없다 — 스코프 판단은
    다른 리뷰 관점 소관.)
  - 제안: 없음.

전역 변수 도입/수정, 예상치 못한 파일 생성·삭제, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 배선
변경은 발견되지 않았다. `plan/in-progress/*.md` 2개 변경은 트래킹 문서 갱신으로 부작용 범위 밖이다.
저장소 트리에 대한 뮤테이션(쓰기·삭제)은 이번 리뷰에서 수행하지 않았으며 `git status --short` 로 확인한
결과 리뷰 산출물 디렉터리 외 변경 없음을 확인했다.

## 요약

이번 diff 의 유일한 실질적 부작용은 `rotateBotToken` 엔드포인트가 비-UUID `:id` 에 대해 500 대신 400
을 반환하도록 바뀐 것인데, 이는 `GlobalExceptionFilter`/`ParseUUIDPipe` 상호작용을 코드로 직접 추적해
CHANGELOG 의 주장과 일치함을 확인했고, 유일한 내부 소비자가 status 를 분기하지 않음도 확인했다 —
공개 API 계약 변경이지만 은폐되지 않고 명시적으로 고지·검증된 변경이다. 나머지(`@ApiParam` 문서 축
추가, 신규 가드/픽스처/테스트, mdx·i18n 주석 정정)는 순수 가법적 문서·테스트 변경이거나 값 불변의
주석 재배치로, 전역 상태·파일시스템·환경 변수·네트워크·이벤트 배선에 대한 의도치 않은 영향은 발견되지
않았다.

## 위험도

LOW
