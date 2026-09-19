# 변경 범위(Scope) 리뷰

대상: `origin/main...HEAD` (44 files, +3189/-224) — Database · HTTP 통합 연결 테스트 실접속 구현
(commit `9e91352d8` 본체 + 후속 `0aec343e4`/`00e244de6`/`eebf0286a`/`edd468476`, spec 은 planner 커밋 `74087dff6`).

## 발견사항

- **[INFO]** 노드 핸들러 로직을 신규 공유 모듈로 추출(리팩토링)했으나 목적이 명확하고 diff 로 검증됨
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` (함수
    `buildPgConnection`/`buildMysqlSsl`/인터페이스 `DbCredentials` 제거), 대응 신규 파일
    `codebase/backend/src/nodes/integration/database-query/database-connection.ts`.
    같은 패턴이 `http-request.handler.ts` → 신규 `http-credentials.ts`/`http-redirect.ts` 에도 있다.
  - 상세: `git diff --ignore-all-space` 결과가 공백 무시 여부와 무관하게 동일해 순수 코드 이동/재구성이며
    포맷팅 잡음은 없다. `http-request.handler.ts` 리다이렉트 루프는 `authentication === 'integration'` 게이트를
    그대로 유지했고, 홉 상한 `5` → `MAX_REDIRECT_HOPS` 상수도 값이 같다 — 동작 변경 없이 테스터와 노드가
    같은 함수를 쓰도록 추출했을 뿐이다. 계획 문서(`plan/in-progress/integration-db-http-testers.md` `## 설계`)가
    "순환 import 회피" 근거를 명시하고 있어 이 작업과 무관한 정리가 아니라 이번 기능이 요구하는 전제조건이다.
  - 결론: 문제 아님 — 참고로만 기록.

- **[INFO]** `IntegrationsService.rotate()` 부분 저장 리팩토링 + 동시성 상한 도입은 리팩토링처럼 보이지만
  이번 기능이 유발한 버그 수정이다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`rotate()` 의 `entity.credentials = merged; ... await this.integrationRepository.save(entity)` → 부분 컬럼 `save({ id, ...changes })` + `Object.assign`,
    `connectionTestLimit`/`CONNECTION_TEST_MAX_CONCURRENCY` 신설).
  - 상세: 연결 테스트가 실제 네트워크 호출로 바뀌면서(수 초 소요) rotate 도중 `logUsage` 의 원자적 `update` 결과를
    엔티티 전체 `save` 가 되돌리는 경합, 그리고 `dns.lookup` 이 libuv 스레드풀을 고갈시키는 문제가 새로 생겼다 —
    커밋 로그(`eebf0286a`, `edd468476`, "연결 테스트 리뷰 1라운드")가 이를 명시한다. 즉 "관련 없는 리팩토링"이
    아니라 이번 변경이 만든 결함을 같은 PR 안에서 되짚어 고친 것이다.
  - 결론: 문제 아님.

- **[INFO]** `review/consistency/2026/09/19/{13_03_41,13_21_00}/**` (2개 세션, 17개 파일) 과
  `spec/2-navigation/4-integration.md` 가 이 커밋 셋에 포함되어 있음
  - 상세: 전자는 `--spec`/`--impl-prep` 의무 게이트 산출물이고(`CLAUDE.md` "정보 저장 위치" 표에 정식 위치로
    등재), 후자는 `74087dff6`(planner 커밋)에서만 수정되고 developer 커밋에서는 손대지 않았음을
    `git log origin/main..HEAD -- spec/2-navigation/4-integration.md` 로 확인했다 — developer 가 spec 경계를
    넘지 않았다. 두 항목 모두 "무관한 파일" 이 아니라 SDD 워크플로가 요구하는 표준 산출물이다.
  - 결론: 문제 아님 — 스코프 외 파일로 오인하지 않도록 근거를 남긴다.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 새 백로그 6건 추가 + 기존 항목 1건 체크
  - 위치: 해당 파일 라인 3592(체크) · 4760~4818(신규 6건, rotate 400/422 · SMTP CGNAT · HTTP `none`/`default_headers`
    레지스트리 갭 · Google 자동갱신 · Google/GitHub 필수 필드 · 4xx 안내 미노출 · 지역화 사전 누락).
  - 상세: 전부 "developer, 2026-09-19 등재 · 이 PR 의 `/ai-review`(`13_58_22`)·spec draft 리뷰(`13_03_41`) 발견을
    비대상으로 미룬다" 는 출처 각주가 붙어 있고, 실제 코드 변경은 없다 — 트래커에 기록만 하고 이번 PR 스코프에서는
    구현하지 않았다. 프로젝트 관례(발견한 이슈는 그 턴에 plan 에 등재)를 따른 것이라 기능 확장이 아니다.
  - 결론: 문제 아님.

- **[INFO]** `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` 의 기존 fixture 한 줄 수정
  - 위치: `credentials.base_url: 'https://api.example.com'` 제거(주석으로 사유 명시).
  - 상세: rotate 가 이제 실제 HTTP GET 을 보내므로, broadcast 를 검증하려는 기존 e2e 가 의도치 않게 외부
    네트워크에 의존하게 되는 것을 막기 위한 최소 수정이며 diff 4줄. 무관한 영역 수정이 아니라 이번 변경의
    직접 파급 효과.
  - 결론: 문제 아님.

## 검증 방법

- `git diff origin/main...HEAD --stat` 로 44개 변경 파일 전수 확인, `--ignore-all-space` 비교로 포맷팅-only
  변경이 실질 변경에 섞여 있지 않음을 확인(라인 수 동일).
- `git diff origin/main...HEAD -- codebase/backend | grep 'TODO|FIXME|console.log|debugger'` — 0건, 디버그
  잔재 없음.
- `p-limit` 신규 import 는 `codebase/backend/package.json` 에 이미 등재돼 있던 기존 의존성(다른 5개 모듈이
  이미 사용 중)임을 확인 — 무단 의존성 추가 아님.
- `git log origin/main..HEAD -- spec/2-navigation/4-integration.md` — planner 커밋 1개만 그 파일을 건드림,
  developer 커밋은 관여하지 않음.
- 저장소 뮤테이션 없음(read-only 조사만 수행, `git status --short` 는 세션 시작 시 스냅샷과 동일 — 이 세션이
  추가로 건드린 파일 없음).

## 요약

44개 파일, +3189/-224 라인의 변경 전체가 "Database · HTTP 통합 연결 테스트가 실제로 접속하게 한다"는 단일
의도(및 그로부터 파생된 review-round 버그 수정 2건)로 수렴한다. 노드 핸들러에서 커넥션/자격증명 로직을
공유 모듈로 뽑아낸 부분은 리팩토링처럼 보이지만 순환 import 회피와 "테스터와 노드가 같은 로직을 써야
테스트 통과가 실행 성공을 보장한다"는 계획서에 명시된 설계 요구이며, `--ignore-all-space` 대조로 순수
이동임을 확인했다. `rotate()` 부분 저장·동시성 상한은 이번 기능이 새로 노출한 결함의 직접 수정이다.
`review/consistency/**`·spec 파일·plan 백로그 갱신은 모두 이 저장소의 정식 SDD 워크플로 산출물이며 developer
가 spec 경계를 넘지 않았음을 커밋 이력으로 확인했다. 의미 없는 포맷팅, 미사용 임포트, 무관한 설정 변경,
주석 잡음, 요청 밖 기능 확장은 발견되지 않았다.

## 위험도

NONE
