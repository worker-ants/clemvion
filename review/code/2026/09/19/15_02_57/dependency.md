# 의존성(Dependency) 리뷰 — Database·HTTP 연결 테스터

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — `pg`·`mysql2`·`p-limit` 모두 기존 의존성 재사용
  - 위치: `codebase/backend/package.json` (diff 없음, `git diff origin/main -- codebase/backend/package.json codebase/backend/pnpm-lock.yaml` 결과 공집합)
  - 상세: `database-connection-tester.ts` 가 새로 import 하는 `pg`(`Client`)·`mysql2/promise`(`createConnection`)는 이미 `database-query.handler.ts` (Database 노드 실행)가 쓰던 드라이버이고, `integrations.service.ts` 에 새로 등장한 `import pLimit from 'p-limit'` 도 `parallel-executor.ts`·`mcp-client.service.ts`·`graph-extraction.service.ts`·평가 스크립트 두 곳에서 이미 쓰이는 패키지다. 이번 PR 은 `package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않았다 — 세 패키지 모두 버전 고정(`^8.23.0`/`^3.23.2`/`^7.3.2`)·라이선스(MIT, 프로젝트 `UNLICENSED` 와 호환)·최근 dependabot 상향/`audit 0건` 이력이 이 PR 이전에 이미 확정돼 있다(`6dcee50db` pg bump, `36e7b5590` p-limit bump, `d472443b0` mysql2 bump, `2886910de` audit 25→0).
  - 제안: 없음 — 새 패키지 추가·버전 변경이 필요 없는 재사용이 바람직한 설계다.

- **[INFO]** `modules/integrations` → `nodes/integration/*` 새 내부 의존 방향 (의도적, DRY)
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` (import `../../nodes/integration/http-request/http-safety`, `../../nodes/integration/database-query/database-connection`), `codebase/backend/src/modules/integrations/http-connection-tester.ts` (import `../../nodes/integration/http-request/{http-credentials,http-redirect,http-safety}`)
  - 상세: 이전에는 `modules/integrations` 의 이메일 SSRF 가드가 자체 모듈(`common/utils/smtp-host-guard.ts`)을 썼다(`git log -S "nodes/integration/http-request/http-safety" -- codebase/backend/src/modules/integrations` → 이번 PR 커밋만 히트). 이번 변경은 `modules/integrations` 가 `nodes/integration` 트리의 SSRF·리다이렉트·자격증명 로직을 직접 import 하는 새 방향의 결합을 만든다. 순환 import 위험은 두 신규 파일(`database-connection.ts`, `http-credentials.ts`)을 "의존성 없음"으로 설계하고, 역방향 참조(`integrations.service.ts` → 테스터)는 `import type` 으로만 걸어 컴파일 타임에 지워지도록 미리 회피해 뒀다 — 주석에 그 이유가 명시돼 있고 실제 diff 도 그 설계를 지킨다(두 신규 파일 모두 import 0건).
  - 제안: 결함 아님. 다만 `modules/integrations` ↔ `nodes/integration` 사이에 레이어 경계를 두는 컨벤션이 향후 생기면 이 새 결합 방향을 예외로 문서화해 둘 필요가 있다.

- **[INFO]** 빌드/번들 영향 미미
  - 상세: 이번 diff 로 늘어난 것은 신규 내부 파일 6개(`clamp-message.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`, `database-connection.ts`, `http-credentials.ts`, `http-redirect.ts`, 총 ~470줄) 뿐이고 외부 패키지 트리는 그대로다. Node 엔진 요구치(`>=24`)도 변경 없고, 새로 쓰는 `fetch`/`AbortSignal.timeout`/`node:dns/promises` 는 모두 Node 코어 API 라 추가 폴리필·패키지가 필요 없다.

## 요약

이번 변경은 의존성 관점에서 새로 추가되거나 버전이 바뀐 패키지가 전혀 없다 — `pg`·`mysql2`·`p-limit` 는 모두 프로젝트에 이미 존재하던 의존성을 다른 모듈에서 재사용한 것이고, `package.json`/lock 파일 diff 는 origin/main 대비 공집합이다. 라이선스·취약점·버전 고정 문제는 확인되지 않았으며, 유일하게 주목할 점은 `modules/integrations` 가 `nodes/integration/*` 로 향하는 새 내부 import 방향을 만든 것인데, 순환 참조를 `import type` + "무의존성 모듈" 추출로 사전에 차단해 둔 의도적이고 잘 문서화된 설계다.

## 위험도
NONE
