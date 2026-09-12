# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 비-UUID `:id` 처리 결과가 500→400 으로 바뀌는 공개 API 행위 변경 (의도됨·이미 완전 공시)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: `ParseUUIDPipe` 추가로 비-UUID `:id` 가 이제 핸들러 진입 전에 400 `VALIDATION_ERROR` 로 끊긴다. 종전엔 그 값이 `findById` 까지 흘러 Postgres SQLSTATE 22P02 → `GlobalExceptionFilter` 의 세 분기(HttpException·http-error-like·23505) 어디에도 안 걸려 500 `INTERNAL_ERROR` 로 마스킹됐다. 이는 실제 HTTP 계약을 바꾸는 "시그니처/인터페이스 변경"에 해당하지만, `CHANGELOG.md`·spec 문면·`@ApiBadRequestResponse` 설명에 전부 반영돼 있고, 저장소 안의 유일한 소비자(`chat-channel-card.tsx:394` `onError` → 고정 토스트 문자열)가 status 코드를 분기하지 않음을 직접 확인했다(`grep rotateBotToken` 전수 — 다른 소비처 없음). 저장소 밖 API 직접 호출자가 500 을 재시도/알림 신호로 쓰고 있었다면 그 신호가 사라지는데, CHANGELOG 가 이미 그 위험을 "⚠️ 배포 시 확인" 문구로 명시 공시했다.
  - 제안: 추가 조치 불필요 — 공시·검증 모두 충분. 향후 `GlobalExceptionFilter` 의 22P02 공용 분기(plan 에 이미 후속 항목으로 등재됨)가 들어갈 때 이 엔드포인트의 400 발신 경로가 중복되지 않는지만 확인.

- **[INFO]** 신규 대조군 fixture 가 `.controller.ts` 접미를 쓰지만 프로덕션 스캔 대상은 아님 (확인됨, 재발 아님)
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
  - 상세: 이 저장소에 `.controller.ts` 파일을 glob/`readdirSync` 로 자동 스캔해 NestJS 모듈에 등록하는 메커니즘이 없음을 확인했다(`app.module.ts` 등 전수 grep — 컨트롤러 등록은 전부 명시적 import). 따라서 이 fixture 가 실제 서버 라우팅에 끼어들 위험은 없다. 다만 `src/` 전체를 훑는 형제 가드(`swagger-dto-contract`, `nullable-type-lie-cast` 등)의 순회 대상에는 포함되며, 이는 파일 자신의 주석(`review/code/2026/09/12/20_01_18` side_effect INFO)에 이미 명시돼 있어 재발 발견이 아니다.
  - 제안: 없음(기존 인지 사항).

- **[INFO]** `param-uuid-pipe.spec.ts` / `param-uuid-pipe-guard.ts` 는 Jest 테스트 로드 시점에 `src/modules` 전체를 동기 `fs.readFileSync` 로 순회한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:55` (`collectTsFiles(SCAN_ROOT)` — `describe` 블록 최상위, `it` 밖)
  - 상세: 순수 read-only 파일시스템 접근이며 테스트 수집 시점에만 실행돼 런타임(프로덕션) 부작용은 없다. 이 저장소의 다른 `repo-guards`(`source-scan.ts` 공유 유틸)가 이미 쓰는 동일 패턴이라 신규 리스크가 아니다.
  - 제안: 없음.

- 나머지 파일(`auth.controller.ts` 의 `@ApiParam` 문서 보강, 4개 MDX 문서 정정, `backend-labels.ts`/`backend-labels.test.ts` 의 주석 재배치, `mcp-servers*.mdx` 환경변수명 오탈자 수정, `plan/**` 트래커 갱신)은 순수 문서·주석·테스트 리스트 재배치이며 실행 경로·전역 상태·환경변수 읽기쓰기·네트워크 호출·콜백을 바꾸지 않는다. `backend-labels.test.ts` 의 `TRIGGER_NOT_FOUND` 항목 재배치는 `LOCALIZED_ERROR_CODES.filter(...).toEqual([])` 형태(순서 무관 포함성 검사)라 위치 이동이 단언 결과에 영향을 주지 않음을 직접 확인했다.

## 요약

이 변경집합의 유일한 실질 부작용은 `rotateBotToken` 엔드포인트가 비-UUID `:id` 에 대해 500 대신 400 을 반환하도록 바뀌는 공개 API 행위 변경이며, 이는 의도된 수정이자 CHANGELOG·spec·Swagger 문서에 전부 공시되어 있고 저장소 내 유일한 소비자가 영향받지 않음을 직접 검증했다. 신규 repo-guard(순수 AST 판정 함수 + read-only 파일 스캔 테스트)와 fixture 컨트롤러는 프로덕션 라우팅에 개입하지 않으며, 나머지 변경은 문서·주석·플랜 파일 정리로 부작용이 없다. 전역 상태·환경변수·네트워크 호출·콜백 배선을 새로 건드리는 지점은 발견되지 않았다.

## 위험도

LOW
