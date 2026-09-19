# 변경 범위(Scope) 리뷰 — Database · HTTP 연결 테스터 (56 파일)

대상: `origin/main...HEAD` (커밋 `74087dff6`~`e6b98cd65`, 4라운드 `/ai-review` 수정 포함). 목적:
"Database · HTTP 통합의 연결 테스트가 실제로 접속하도록" 기능 추가 + 4라운드에 걸친 리뷰 수정.

## 검증 방법

프롬프트의 diff 는 대형 파일(9개)에서 절단돼 있어, `git diff origin/main...HEAD` 를 직접 열어
절단분(`integrations.service.ts`, `integrations.controller.ts`, `http-request.handler.ts`,
`spec-draft-nullable-notation-followups.md` 등)을 전문 대조했다. `git diff --stat` 로 56개 파일
전체가 프롬프트 파일 목록과 정확히 일치함을 확인했다(저장소 뮤테이션 없음, 읽기 전용 `git diff`만 사용).

## 발견사항

- **[INFO]** 노드 실행 로직을 공유 모듈로 추출하는 리팩토링이 3건 포함됨 — 그러나 전부 이 기능의 정합성 요건이 근거
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts` (신규),
    `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` (신규),
    `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (신규) — 각각
    `database-query.handler.ts`·`http-request.handler.ts` 에서 로직을 꺼내 옮김
  - 상세: `database-query.handler.ts` 에서 `DbCredentials` 인터페이스·`buildPgConnection`·`buildMysqlSsl` 이 삭제되고
    새 `database-connection.ts` 로 이동했다. `http-request.handler.ts` 에서도 `HttpCredentials`·자격증명 파싱
    스위치문·리다이렉트 추종 루프가 삭제되고 새 `http-credentials.ts`/`http-redirect.ts` 로 이동했다. 언뜻
    "관련 없는 리팩토링"으로 보일 수 있으나, 각 신규 파일 상단 docstring 이 "노드 실행과 통합 연결 테스트가 같은
    매핑/방식을 쓰지 않으면 테스트 통과가 실행 성공을 뜻하지 않는다"는 이 기능 고유의 정합성 요구를 명시하고 있고,
    실제로 `database-connection-tester.ts`/`http-connection-tester.ts` 가 그 함수들을 import 해 재사용한다. 순수
    리팩토링이 아니라 기능 요구사항(같은 코드 경로 보장)의 직접적 결과다 — 범위 이탈로 보지 않는다.
  - 제안: 조치 불요. (참고용 기록)

- **[INFO]** 기존 헬퍼(`clampMessage`)가 `integrations.service.ts` 밖으로 추출됨
  - 위치: `codebase/backend/src/modules/integrations/clamp-message.ts` (신규), `clamp-message.spec.ts` (신규)
  - 상세: 기존에 `integrations.service.ts` 내부 함수였던 `clampMessage`(MCP 에러 메시지 상한)가 별도 모듈로
    이동했다. 새로 추가된 `http-connection-tester.ts` 가 네트워크 예외 메시지를 클램프하는 데 같은 함수를 쓰기
    위함이며(docstring 에 "email · database · http testers 일관성"이라 명시), 순환 import 를 피하기 위한 구조적
    필요이기도 하다. DRY 목적의 무관한 정리가 아니라 신규 기능이 기존 유틸을 재사용하려는 배선이다.
  - 제안: 조치 불요.

- **[INFO]** 같은 PR 이 `rotate()` 의 저장 방식을 `save()`(전체 엔티티) → `update()`(부분 컬럼)로 바꿈 — 기능과
  직결된 동시성 수정이나, "연결 테스트 정확도"라는 원 스코프보다 넓어 보일 수 있음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 메서드
  - 상세: 커밋 로그(`48dfb2f0e`, `e6b98cd65`)와 인접 주석에 근거가 명시돼 있다 — 연결 테스트가 수 초(최대 26초)
    걸리게 되면서, 테스트가 도는 동안 다른 요청(`logUsage`)이 원자적 `update` 로 쓴 컬럼을 `save()` 가 덮어쓰는
    레이스가 새로 열렸기 때문이다. 이 문제는 "연결 테스트가 실제로 접속한다"는 기능 자체가 유발한 부작용이므로,
    별도 티켓으로 분리하기보다 같은 PR 에서 처리하는 것이 합리적이다 — 범위 이탈이 아니라 기능의 필연적 파급으로
    판단한다.
  - 제안: 조치 불요.

- **[INFO]** `integration-cache-invalidate.e2e-spec.ts` 수정은 무관해 보이지만 새 동작의 직접적 파급
  - 위치: `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts:77-86` 부근 — `base_url` 필드 제거
  - 상세: 이 e2e 는 rotate 뒤 캐시 무효화 broadcast 를 검증하는 테스트인데, rotate 가 이제 HTTP 연결 테스트를
    실제로 수행하므로 `base_url` 이 있으면 외부 네트워크에 의존하게 된다. 필드를 제거해 테스터가 호출 없이
    통과하도록 한 것은 새 기능이 기존 테스트를 깨뜨리지 않기 위한 필수 보정이다. 주석으로 사유가 명시돼 있다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` (기존 별도 트래커 plan)에 이 PR 과
  직접 관련 없는 항목 9개가 새로 추가됨
  - 위치: 해당 파일 하단, "SMTP SSRF 가드 CGNAT 누락" · "Google 자동 갱신 미구현" · "Google/GitHub 필수 필드 미확인"
    등 9개 신규 체크박스 항목
  - 상세: 이 PR 의 리뷰 라운드(`review/code/2026/09/19/13_58_22` 등) 도중 발견됐지만 이번 스코프에서 **고치지
    않고 트래커에만 기록**한 항목들이다. 코드 변경은 동반하지 않으며(`grep` 결과 해당 파일들에 실제 수정 없음),
    프로젝트 관례(트래커 plan 은 발견된 갭을 "지금 고치지 않음"으로 명시적으로 남기는 것이 정상 워크플로)와도
    부합한다. 실질적 범위 이탈이 아니라 오히려 범위 확장을 막기 위한 기록이다.
  - 제안: 조치 불요 — 스코프 위반 아님으로 기록만 남김.

- **[INFO]** `review/consistency/**` 3개 세션 디렉터리(31개 파일)와 `plan/in-progress/*.md` 3개가 diff 에 포함됨
  - 위치: `review/consistency/2026/09/19/{13_03_41,13_21_00,15_30_56}/**`,
    `plan/in-progress/{integration-db-http-testers,spec-draft-integration-connection-tests,spec-draft-integration-db-test-waits}.md`
  - 상세: 이들은 CLAUDE.md 가 규정한 "정보 저장 위치"(consistency 산출물 `review/consistency/**`, 진행 중 작업
    `plan/in-progress/**`)와 SDD 워크플로(`--spec`/`--impl-prep` 의무 실행 산출물)에 정확히 대응하는 필수
    프로세스 산출물이다. 코드 스코프를 벗어난 "무관한 파일 수정"이 아니라 이 저장소의 정식 개발 방법론이 요구하는
    동반 산출물로 판단한다.
  - 제안: 조치 불요.

- **[INFO]** 포맷팅/주석/임포트만 바뀐 무의미한 diff 없음
  - 상세: `console.log`/`debugger`/`TODO`/`FIXME` 등 디버그 잔재를 전체 변경 `.ts` 파일에서 검색했으나 0건.
    `p-limit` 신규 사용(`integrations.service.ts`)은 `package.json` diff 가 없어 기존 의존성 재사용임을
    확인했다(신규 의존성 추가 아님). Swagger 설명 문구·JSDoc 변경은 전부 실제 동작 변경(실제 접속 테스트)을
    반영하는 필수 갱신이며, 의미 없는 재포맷 구간은 발견되지 않았다.
  - 제안: 조치 불요.

## 요약

56개 파일에 걸친 대형 diff 이지만, `git diff origin/main...HEAD` 전문 대조 결과 모든 변경이 "Database·HTTP
연결 테스트가 실제로 접속한다"는 단일 기능과 그에 이은 4라운드 `/ai-review` 수정(동시 실행 상한, rotate 저장
방식, 소켓 종료 등)으로 추적된다. 노드 핸들러에서 공유 모듈로 로직을 꺼낸 3건의 리팩토링은 "테스트 통과 =
실행 성공"이라는 이 기능 고유의 정합성 요구가 근거이며 무관한 코드 정리가 아니다. `rotate()` 저장 방식 변경과
`integration-cache-invalidate.e2e-spec.ts` 수정은 연결 테스트가 실제 네트워크 I/O 를 하게 되면서 새로 열린
레이스·부작용에 대한 필연적 보정이다. `plan/`·`review/consistency/**` 동반 산출물은 이 저장소의 SDD 프로세스가
요구하는 정식 위치의 필수 문서이며, 별도 트래커에 추가된 9개 항목은 이번 스코프에서 고치지 않고 기록만 하는
"defer" 관례를 따른다. 디버그 잔재·무의미한 포맷팅·불필요한 의존성 추가는 발견되지 않았다. 범위 이탈로 볼
CRITICAL/WARNING 급 항목은 없다.

## 위험도

LOW
