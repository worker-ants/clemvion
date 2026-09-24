# 보안 리뷰 — jest ESM 네이티브 로드 전환 (deps-nestjs12-ci-4a7b2e)

## 검토 범위 요약

리뷰 대상 13개 파일 중 실제 실행 가능한 코드/설정 변경은 3개뿐이다:

- `codebase/backend/jest.config.ts` — unit 테스트 `transformIgnorePatterns` 를 손으로 유지하던 ESM 패키지 허용목록에서 jest 기본값(`['/node_modules/']`)으로 되돌림
- `codebase/backend/test/jest-e2e.json` — e2e 쪽도 동일하게 기본값으로 되돌림
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 스크립트에 `node --experimental-vm-modules` 를 추가

나머지 10개 파일(`plan/in-progress/*.md` 2개, `review/consistency/**` 7개, 그리고 diff 로 잡힌 나머지)은 모두 plan 문서·consistency-check 산출물(markdown/json)이며 실행되는 코드가 아니다. 이 리뷰는 production 런타임 코드나 API 엔드포인트를 전혀 건드리지 않는 **테스트 하니스(jest) 전용 변경**이다.

## 발견사항

- **[INFO]** `--experimental-vm-modules` 플래그 도입 — 범위가 테스트 스크립트에 한정됨을 확인
  - 위치: `codebase/backend/package.json:22`~`26` (`test`, `test:watch`, `test:cov`, `test:debug`, `test:e2e`)
  - 상세: Node 의 실험적 VM Modules API(`vm.SourceTextModule`)를 여는 플래그다. `package.json` 전체 컨텍스트를 대조한 결과 `start`(`nest start`)·`start:prod`(`node dist/main`) 등 production 실행 경로에는 이 플래그가 붙지 않았고, `nest build` 산출물(런타임)도 이번 diff 로 바뀌지 않는다. 즉 이 실험적 기능은 jest 프로세스 자체가 테스트 파일/의존성을 ESM 으로 로드하는 데만 쓰이고, 배포되는 서버 프로세스의 공격 표면을 넓히지 않는다.
  - 제안: 없음(현 상태로 충분). 다만 Node 가 이 API 를 stable 로 승격하기 전까지는 실험 배너(`ExperimentalWarning`)가 CI 로그에 계속 남는다는 점만 인지하면 된다 — plan 문서(`plan/in-progress/jest-esm-native-load.md` §C)에도 이미 고지돼 있다.

- **[INFO]** `transformIgnorePatterns` 를 손으로 관리하던 정규식 허용목록에서 jest 기본값으로 되돌림
  - 위치: `codebase/backend/jest.config.ts:39`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 이전 정규식(`node_modules/(?!(?:\.pnpm/[^/]+/node_modules/)?(?:uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble)/)`)은 명명 그룹이 없고 소유형(possessive) 정량자도 없어 ReDoS 로 이어질 만한 중첩 정량자 구조가 아니었다 — 제거 자체가 보안 결함을 고치는 것은 아니다. 새 값 `['/node_modules/']` 은 jest 문서상 기본값과 동일하며, 테스트 실행 시 `node_modules` 전체를 ts-jest 로 변환하지 않는다는 의미만 가진다. 이 값은 테스트 전용 설정 파일에만 있고 production 빌드/런타임 경로에는 영향이 없다.
  - 제안: 없음. 주석에 근거(왜 되돌렸는지, 페어링된 변경인지)가 상세히 남아 있어 추적성도 양호하다.

- **[INFO]** plan 문서가 향후 `@nestjs/*` 12 동반 업그레이드 시 reflection 기반 인가 가드(`RolesGuard`/`@WorkspaceId()`)의 보안 회귀 검증을 이미 선결 조건으로 명시함
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C ("착수 시 반드시 검증할 것 — reflection 보안 회귀")
  - 상세: 이번 diff 자체는 `@nestjs/typeorm` 등 의존성 버전을 올리지 않는다(참고 컨텍스트에 보이는 `@nestjs/*` 버전은 전부 기존 v11 그대로이며 diff 대상이 아니다). 다만 이 변경이 향후 `@nestjs/typeorm@12`(ESM-only, `import.meta.url` 사용) 도입을 가능하게 만드는 선행 작업이라서, 후속 PR 이 인가 우회(fail-open) 위험을 안고 있다는 점을 미리 문서화해 둔 것은 적절한 보안 프로세스로 판단된다. 이번 PR 의 코드 변경 범위 안에서는 그 위험이 실현되지 않는다.
  - 제안: 없음(추적용 정보). 후속 PR 리뷰 시 §C 체크리스트(부트 캐너리 소비 라우트 수 회귀·`workspace.decorator.spec.ts`/`roles.guard.spec.ts` 통과)가 실제로 수행됐는지 재확인할 것.

## 점검했으나 해당 없음

- **인젝션 취약점**: 변경분에 사용자 입력을 처리하는 코드가 없음(테스트 설정/스크립트뿐). 커맨드 인젝션 벡터 없음 — `package.json` 스크립트는 고정 문자열이며 외부 입력을 셸에 보간하지 않는다.
- **하드코딩된 시크릿**: 3개 파일 전체 diff·컨텍스트에 API 키/비밀번호/토큰 문자열 없음.
- **인증/인가**: 이번 diff 는 인증/인가 코드를 전혀 건드리지 않는다. (관련 우려는 위 INFO 항목에서 별도 plan 으로 이미 격리·추적됨.)
- **입력 검증**: 해당 없음(설정 파일 변경).
- **암호화**: 해당 없음.
- **에러 처리**: 해당 없음 — 런타임 에러 메시지 경로 변경 없음.
- **의존성 보안**: `package.json` 의 `dependencies`/`devDependencies` 버전은 이번 diff 로 바뀌지 않았다(스크립트 섹션만 변경). 새로 추가되거나 버전이 오른 패키지 없음.

## 요약

이번 변경은 backend jest 테스트 러너가 ESM-only 의존성을 손으로 관리하는 허용목록 대신 Node 의 `--experimental-vm-modules` 플래그로 네이티브 로드하도록 전환하는 순수 테스트 하니스/CI 설정 변경이며, production 코드·API·인증 경로·의존성 버전을 건드리지 않는다. 실험적 Node 플래그는 테스트 스크립트에만 한정되어 배포 런타임의 공격 표면에 영향을 주지 않음을 `package.json` 전체 컨텍스트로 확인했다. 동봉된 plan 문서들은 이 변경이 여는 후속 NestJS 12 동반 업그레이드가 reflection 기반 인가 가드에 대해 안고 있는 fail-open 위험을 이미 별도 plan(§C)으로 명문화해 선제 조치해 두었다. 저장소 파일에 대한 뮤테이션(수정/원복)은 수행하지 않았다 — `git status --short` 확인 불필요(정적 리뷰만 수행).

## 위험도

NONE
