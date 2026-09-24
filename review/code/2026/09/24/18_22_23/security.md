# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/backend/package.json` — `@nestjs/typeorm` `^11.0.3` → `^12.0.1` (단 한 줄)
- `pnpm-lock.yaml` — 위 범프에 따른 lockfile 갱신(+ 무관한 `libc:` 필드 제거는 pnpm 포맷터 재작성 산물로 보이며 패키지 실체 변경 없음)
- `plan/in-progress/deps-typeorm12.md` (신규), `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (갱신) — 계획/근거 문서
- `review/consistency/2026/09/24/17_31_27/**` (신규) — 이전 consistency-check 산출물(문서 프로세스 아티팩트)

애플리케이션 소스 코드(`src/**`)는 이 diff 에 포함되어 있지 않다. 뮤테이션 검증이 필요한 가설이 없어 저장소 파일을 고치지 않았고, `git status --short` 로 확인한 트리 상태는 변경 없음(리뷰 세션이 새로 만든 파일 없음).

## 발견사항

- **[INFO]** 순수 의존성 버전 범프 — 신규 인젝션/인증 표면 없음
  - 위치: `codebase/backend/package.json:44` (변경 후 게이트 기준)
  - 상세: 변경은 `@nestjs/typeorm` 하나의 caret 버전 상향뿐이다. `@nestjs/typeorm` 은 TypeORM 을 Nest DI 컨테이너에 연결하는 얇은 래퍼로 SQL 실행·인증·세션 로직을 직접 갖지 않으며, 실제 쿼리 실행을 담당하는 `typeorm` 본체(`^0.3.31`)와 DB 드라이버(`pg`, `mysql2`)는 이번 diff 에서 변경되지 않았다. 애플리케이션 코드도 함께 변경되지 않았으므로 SQL 인젝션·XSS·커맨드 인젝션·경로 탐색 표면에 실질적 변화가 없다.
  - 제안: 없음(정보 제공용).

- **[INFO]** 이 저장소의 `@nestjs/*` 보안 회귀 트리거를 실측으로 이행함 — 모범 사례로 확인
  - 위치: `plan/in-progress/deps-typeorm12.md`(§C) / `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(§C, "업그레이드 전 기준값")
  - 상세: `spec/5-system/1-auth.md` 가 명문화한 "`@WorkspaceId()` reflection 은 Nest 비공개 API(`ROUTE_ARGS_METADATA`)에 의존하고 파손 방향이 fail-open"이라는 위험을, developer 가 업그레이드 전/후 3중 지표(부트 캐너리 소비 라우트 수 142건, reflection 3스위트 48/48, `handlerConsumesWorkspaceId` 를 강제로 false 로 만드는 판별자 뮤턴트가 여전히 동일한 9건을 RED 로 만드는지)로 비교했고 전부 동일함을 확인했다. "그린 카운트만으로는 fail-open 회귀를 못 잡는다"는 점을 스스로 지적하고 판별자 뮤턴트로 별도 검증한 점이 이 리뷰가 통상 지적하는 결함(뮤테이션 검증 없는 "테스트 통과"만의 근거 제시)을 선제적으로 막았다.
  - 제안: 없음 — 절차가 이미 이 리뷰의 관심사(인증/인가 회귀)를 다뤘음을 확인.

- **[INFO]** peer dependency 범위와 실제 설치 버전의 불일치 — 취약점 아님, 문서화된 의도
  - 위치: `pnpm-lock.yaml` (`@nestjs/typeorm@12.0.1` 블록, peerDependencies `@nestjs/common: ^10.0.0 || ^11.0.0 || ^12.0.0`) / lockfile 상 실제로는 `@nestjs/common@11.1.27` 위에 결합
  - 상세: `@nestjs/typeorm@12` 를 `@nestjs/common@11` 위에서만 단독으로 올리는 조합은 peer 범위 내에 있고, `--strict-peer-dependencies --frozen-lockfile` 로 검증됐다고 plan 에 기록되어 있다. 나머지 `@nestjs/*` 는 11 유지이므로 이번 변경 자체가 인가/인증 레이어(`@nestjs/passport`, `@nestjs/jwt`, `RolesGuard` 등)를 건드리지 않는다.
  - 제안: 없음 — `spec/5-system/1-auth.md` §Rationale 의 `^11.0.1` 캐럿 인용은 이 PR 범위 밖(§consistency WARNING #3, plan 후속에 이미 등재)이므로 재지적하지 않음.

- **[INFO]** `review/consistency/2026/09/24/17_31_27/**` 신규 아티팩트에는 시크릿·자격증명 없음
  - 위치: `review/consistency/2026/09/24/17_31_27/*.md`, `meta.json`, `_retry_state.json`
  - 상세: 전수 grep(`api[_-]?key|secret|password|token|BEGIN ... KEY|AKIA...`) 결과 매치는 `jsonwebtoken` 패키지명, `notification_secret_rotated` 감사 액션 이름뿐이며 실제 시크릿 값은 없다. `_retry_state.json` 에 로컬 절대경로(`/Volumes/project/private/clemvion/...`)가 그대로 커밋되어 있으나, 이는 이 프로젝트의 리뷰 산출물 보존 관례(`review/consistency/**` 커밋)에 따른 것이고 사용자명 외 민감 정보를 담지 않는다 — 심각도 낮음, 조치 불요.

## 요약

이번 diff 는 `@nestjs/typeorm` 을 `^11.0.3` → `^12.0.1` 로 올리는 애플리케이션 코드 변경 없는 순수 의존성 범프이며, 나머지 변경은 plan 문서와 이전 consistency-check 산출물이다. TypeORM 본체·DB 드라이버·인증/인가 관련 패키지(`@nestjs/passport`, `@nestjs/jwt` 등)는 손대지 않았고, `typeorm` 래퍼 자체는 SQL 실행이나 인증 로직을 갖지 않으므로 인젝션·인증 우회·암호화·에러 노출 표면에 실질적 변화가 없다. 오히려 이 저장소가 `@nestjs/*` 업그레이드마다 요구하는 reflection 기반 워크스페이스 인가 가드의 fail-open 회귀 여부를 업그레이드 전/후 캐너리·스위트·판별자 뮤턴트 3중으로 실측 비교해 동일함을 확인한 절차가 문서화되어 있어, 오히려 모범적인 회귀 방지 사례로 보인다. 하드코딩된 시크릿이나 새로운 취약 라이브러리 도입도 발견되지 않았다.

## 위험도

NONE
