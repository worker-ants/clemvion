# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 순수 의존성 버전 범프 — 신규 공격 표면 없음
  - 위치: `codebase/backend/package.json:44` (`"@nestjs/typeorm": "^11.0.3"` → `"^12.0.1"`), `pnpm-lock.yaml` (해당 importer/packages/snapshots 블록)
  - 상세: 이번 diff 에서 실행 코드(`codebase/**/*.ts`) 변경은 0줄이다. `@nestjs/typeorm` 은 `TypeOrmModule.forRoot/forFeature`, `@InjectRepository` 등 DI 배선만 제공하는 얇은 래퍼이고, 실제 쿼리를 만드는 `typeorm` 코어(`^0.3.31`)·DB 드라이버(`pg`/`mysql2`)·`@nestjs/common`·`@nestjs/core` 는 전부 불변(11.1.27 고정)이다. 따라서 SQL 인젝션·인증 우회·직렬화 취약점 등이 새로 생길 표면이 없다.
  - 제안: 없음(정보성).

- **[INFO]** 공급망(supply-chain) 무결성 — 레지스트리와 lockfile 해시 실측 일치, 알려진 CVE 없음
  - 위치: `pnpm-lock.yaml` (`'@nestjs/typeorm@12.0.1':` 블록, `resolution.integrity`)
  - 상세: lockfile 에 기록된 `integrity: sha512-7dsdaD/PSiwCAAhv78+ScS3e6lW41BOMZ8LB7/v5p/hovSUc1wUH1DBXhLgqYx0ChXYLzDybBIADN6lvBhiM6w==` 를 `registry.npmjs.org` 실측치와 직접 대조했다 — **바이트 단위로 일치**한다. 패키지는 `nestjscore` npm 계정이 배포·서명(2개 `signatures` 존재)했고 MIT 라이선스다. OSV(`api.osv.dev`) 조회 결과 `@nestjs/typeorm@12.0.1`·`typeorm@0.3.31` 모두 등록된 advisory 없음(`{}` 응답). dependency confusion/타이포스쿼팅 정황 없음.
  - 제안: 없음(정보성 — 검증 완료).

- **[INFO]** 인가(authorization) 회귀 검증 — reflection 기반 가드에 대한 fail-open 회귀를 실측으로 배제
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(§C, "업그레이드 전 기준값"), `plan/in-progress/deps-typeorm12.md`(§C)
  - 상세: `@nestjs/typeorm` 변경이 `RolesGuard`/`@WorkspaceId()` 의 reflection 경로와 직접 관계는 없지만, 이 저장소는 `@nestjs/*` 업그레이드를 "보안 회귀 우선조사 트리거"로 명문화해 뒀고 이를 그대로 이행했다. 판별자(mutation, `handlerConsumesWorkspaceId` 를 항상 `false` 로)를 업그레이드 전/후 동일하게 주입해 「테스트 통과」가 아니라 「의도한 fail-closed 경로를 실제로 타는지」를 검증했다(전 9건 RED / 후 9건 RED, cross-tenant 결함 클래스 `#1103` 회귀 없음 확인). fail-open 방향 가드에서 "그린 = 안전"이라는 함정을 스스로 피한 모범적 절차다.
  - 제안: 없음(모범 사례로 확인). 다만 이 검증이 매 업그레이드마다 사람이 `cp` 로 수행하는 수작업 절차로만 존재한다는 점(이미 이전 라운드 INFO로 지적·후속 등재됨)은 재확인 — 코드화된 mutation-canary 로 전환하면 다음 담당자의 누락 가능성을 줄일 수 있다.

- **[INFO]** ESM-only 패키지의 암묵적 런타임 결속(`require(esm)`) — 코드 취약점 아님, 가용성 관련 결속
  - 위치: `PROJECT.md` "Node 지원 floor" 항목, `pnpm-lock.yaml`(`@nestjs/typeorm@12.0.1` 의 `engines: {node: '>=20.19.0'}`)
  - 상세: `@nestjs/typeorm@12.0.1` 은 `type: module`(순수 ESM)이고, 이 저장소의 CJS 런타임은 Node 의 native `require(esm)` 에 의존해 이를 로드한다. 현재 `engines.node >=24` 로 충분히 커버되고 e2e 로 검증됐으나, 이는 보안 취약점이 아니라 향후 Node floor 를 낮추는 변경 시 "설치는 성공하지만 부팅 시점에 조용히 깨지는" 가용성 리스크다. 해당 결속은 이번 라운드에 `PROJECT.md` 에 명시적으로 문서화되어(전 라운드 WARNING #3 조치) 추적 가능한 상태다.
  - 제안: 없음 — 이미 문서화 완료. 향후 Node floor 하향 PR 의 체크리스트 항목으로 남겨두는 편이 적절(전 라운드 권고와 동일).

- **[INFO]** 하드코딩 시크릿 전수 grep — 매치 없음(패키지명/감사 액션명만 검출)
  - 위치: 이번 라운드 diff 전체(`git diff origin/main...HEAD`)
  - 상세: `api[_-]?key|secret|password|token|BEGIN ... KEY|AKIA...` 패턴으로 diff 전체를 재검색했다. 매치는 이전 라운드 `review/code/2026/09/24/18_22_23/security.md` 본문에 인용된 문자열(`jsonwebtoken` 패키지명, `notification_secret_rotated` 감사 액션 이름)뿐이며, 실제 시크릿 값·자격증명은 없다.
  - 제안: 없음.

- **[INFO]** 리뷰 산출물(`_retry_state.json`)에 로컬 절대경로가 커밋됨 — 민감정보 아님, 낮은 심각도
  - 위치: `review/code/2026/09/24/18_22_23/_retry_state.json`, `review/consistency/2026/09/24/17_31_27/_retry_state.json`
  - 상세: `session_dir`/`prompt_file`/`output_file` 필드에 `/Volumes/project/private/clemvion/...` 형태의 로컬 절대경로가 그대로 남아 커밋된다. 사용자명·자격증명·내부 IP 등 민감정보는 포함하지 않으며, 이 저장소의 `review/**` 보존 관례에 따른 것으로 이미 전 라운드 security.md 에서 같은 관측이 있었다(재발 아님, 조치 불요로 이미 처분됨).
  - 제안: 없음(조치 불요, 참고용 재확인).

## 요약

이번 diff(`nestjs12-upgrade` worktree, 2라운드)는 `@nestjs/typeorm` `^11.0.3` → `^12.0.1` 단일 의존성 범프와 그에 따른 `pnpm-lock.yaml` 최소 재계산(15줄, 전부 typeorm 관련), 그리고 plan 문서·1라운드 코드리뷰/consistency-check 산출물의 커밋으로 구성된다. 애플리케이션 실행 코드(`src/**`)는 한 줄도 변경되지 않았고, 인가에 관여하는 `@nestjs/common`·`@nestjs/core`·`typeorm` 코어·DB 드라이버는 모두 불변이다. lockfile 의 integrity 해시를 npm 레지스트리 실측과 직접 대조해 공급망 조작 정황이 없음을 확인했고, OSV 조회 결과 대상 패키지에 등록된 알려진 취약점도 없다. reflection 기반 인가 가드(`RolesGuard`/`@WorkspaceId()`)에 대한 fail-open 회귀 여부를 업그레이드 전/후로 부트 캐너리·테스트 스위트·판별자 뮤테이션 3중으로 실측 비교한 절차는 "테스트 통과=안전" 함정을 스스로 회피한 모범적 접근이다. 하드코딩 시크릿·인젝션·인증 우회로 이어질 수 있는 코드 변경은 발견되지 않았다.

## 위험도

NONE
