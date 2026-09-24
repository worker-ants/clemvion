# 보안(Security) 리뷰

## 검토 방법

`git diff origin/main...HEAD --stat -- codebase/` 로 실제 애플리케이션/코드 변경분을 확정했다.
실질 코드 변경은 4개 파일뿐이며 전부 backend Jest 테스트 러너 설정이다:

- `codebase/backend/jest.config.ts` — `transformIgnorePatterns` 를 손유지 ESM allowlist 정규식에서
  jest 기본값(`['/node_modules/']`)으로 되돌림
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 5개
  npm script 에 `node --experimental-vm-modules` 플래그 추가
- `codebase/backend/test/jest-e2e.json` — 동일 원칙 적용(허용목록 → 기본값)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` — 신규 가드 테스트(순수 테스트
  코드, 실행 대상은 로컬 `package.json`/`jest-e2e.json` 파일 읽기뿐)

나머지 변경 파일(`PROJECT.md`, `plan/in-progress/*.md` 2건, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 추가 항목, `review/code/**`·`review/consistency/**` 다수)은 문서·리뷰
산출물이며 런타임 코드가 아니다. 하드코딩된 시크릿 여부를 `git diff origin/main...HEAD` 전체에 대해
`api[_-]?key|secret|password|token|bearer|-----BEGIN|aws_access|private_key` 패턴으로 스윕했고,
매치된 것은 모두 consistency-check 리포트 안에서 필드명·엔드포인트명을 서술하는 산문(예:
`password_hash`, `INVALID_PASSWORD`, "webhook HMAC secret 회전")이었다 — 리터럴 시크릿 값은
없었다.

## 발견사항

없음. 위 4개 코드 변경 모두 검토했으나 본 리뷰 관점(인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증,
OWASP Top 10, 암호화, 에러 처리, 의존성 보안)에 해당하는 이슈가 없다.

- **인젝션**: 신규 테스트(`esm-native-load.spec.ts`)는 `fs.readFileSync`/`path.resolve` 를
  `__dirname` 기준 고정 상대경로에만 사용한다(사용자 입력 없음). npm script 문자열은 정적 리터럴이고
  셸 변수 확장·서브셸 호출이 없어 커맨드 인젝션 표면이 없다.
- **하드코딩된 시크릿**: 신규/변경 파일 어디에도 API 키·비밀번호·토큰·인증서가 없다.
- **인증/인가**: 이번 diff 는 `RolesGuard`·`@WorkspaceId()` 등 인가 관련 런타임 코드를 전혀 건드리지
  않는다. 다만 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C 는 후속(별도) PR 인
  `@nestjs/*` v12 동반 업그레이드가 `RolesGuard`/`@WorkspaceId()` 가 의존하는 Nest 비공개 API
  (`ROUTE_ARGS_METADATA`)를 깨뜨릴 경우 **fail-open**(멤버십 검증이 조용히 사라짐)이 되는 위험을
  선제적으로 문서화하고 착수 전 필수 검증 체크리스트를 남겨 두었다 — 이는 이번 PR 의 코드가 아니라
  향후 작업에 대한 예방적 문서이므로 현재 diff 에 대한 결함은 아니다(INFO 로만 기록).
- **입력 검증 / OWASP Top 10**: 사용자 입력을 받는 경로가 diff 에 없다.
- **암호화**: 해시/암호화 관련 코드 변경 없음.
- **에러 처리**: `esm-native-load.spec.ts` 의 `expect()` 실패 메시지는 jest 내부 진단용이며 운영
  환경에 노출되지 않는다.
- **의존성 보안**: `package.json` 의 `dependencies`/`devDependencies` 버전은 이 diff 로 변경되지
  않았고(`pnpm-lock.yaml` 도 포함 안 됨), 새로 추가된 외부 패키지도 없다. `--experimental-vm-modules`
  는 Node 내장 실험적 플래그이며 서드파티 의존성이 아니다 — SemVer 로 보증되지 않는 Node 내부 API
  (`vm.SourceTextModule.prototype.hasAsyncGraph`)에 테스트 구동이 결합된다는 유지보수 리스크는 있으나
  보안 취약점은 아니다(plan 문서가 실측·트레이드오프를 이미 기록함).

## 요약

이번 변경분은 backend Jest 테스트 러너의 모듈 로딩 방식(손유지 ESM allowlist → `--experimental-vm-modules` 네이티브 로드)만 다루는 순수 테스트 인프라 리팩터이며, 프로덕션 런타임 코드·인증/인가
로직·의존성 버전·시크릿을 전혀 건드리지 않는다. 함께 포함된 다수 파일은 plan 문서와 이전 라운드
리뷰/consistency-check 산출물로 코드가 아니다. 유일하게 보안과 맞닿은 대목은 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 가 향후 NestJS v12 동반 업그레이드 시 reflection 기반 인가
가드의 fail-open 회귀 가능성을 미리 문서화해 둔 것으로, 이는 이번 PR 의 결함이 아니라 다음 작업을
위한 안전장치다. 이번 diff 자체에서 CRITICAL/WARNING 급 보안 이슈는 발견되지 않았다.

## 위험도

NONE
