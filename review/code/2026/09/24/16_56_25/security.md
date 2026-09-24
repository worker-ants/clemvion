# 보안(Security) 리뷰

## 검토 대상 요약

이번 diff 는 13개 파일로 구성되지만 실제 코드 변경은 4개뿐이고, 전부 **Jest 테스트 러너
설정/실행 스크립트**다 — 애플리케이션 런타임 코드(컨트롤러·서비스·가드·DB 접근 등)는 포함되어
있지 않다.

- `codebase/backend/jest.config.ts` — 수작업 ESM 패키지 allowlist(`transformIgnorePatterns`)를
  제거하고 기본값(`['/node_modules/']`)으로 되돌림
- `codebase/backend/test/jest-e2e.json` — 동일하게 `transformIgnorePatterns` 기본값 복원
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
  스크립트에 `node --experimental-vm-modules` 플래그 도입 (Jest 가 ESM 전용 의존성을 네이티브로
  로드하도록)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` — 위 설정 불변식을
  지키는 신규 가드 테스트

나머지 파일(`PROJECT.md`, `plan/in-progress/*.md`, `review/**`)은 문서·이전 리뷰 라운드 산출물이며
실행 코드가 아니다.

## 관점별 확인

1. **인젝션**: 해당 없음. 사용자 입력을 다루는 코드 경로가 diff 에 없다. 신규 테스트
   (`esm-native-load.spec.ts`)는 `path.resolve(__dirname, ...)` 로 고정된 상대경로만 읽고,
   외부 입력을 파일 경로에 조합하지 않는다 — 경로 탐색 벡터 없음.
2. **하드코딩된 시크릿**: 없음. diff 전체에서 password/secret/token/API key/인증서 패턴 검색
   결과 0건.
3. **인증/인가**: 이 diff 자체는 `RolesGuard`·`@WorkspaceId()` 등 인가 코드를 건드리지 않는다.
   다만 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (신규 plan 문서) 는 후속으로 예정된
   `@nestjs/*` v12 동반 업그레이드가 Nest 비공개 API(`ROUTE_ARGS_METADATA`) 에 의존하는
   reflection 기반 가드를 **fail-open** 방향으로 깨뜨릴 수 있음을 명시적으로 인지하고 착수 전
   검증 체크리스트(§C)를 걸어 두었다. 현재 코드에 결함은 없으나, 실제 upgrade PR 에서 §C 검증이
   빠지면 "모든 라우트가 워크스페이스 무관으로 판정" 되는 조용한 인가 우회로 이어질 수 있는
   민감한 지점이라는 점은 이 리뷰에도 기록해 둔다(다음 PR 리뷰에서 §C 이행 여부를 반드시
   확인할 것).
4. **입력 검증**: 해당 없음(테스트 인프라 전용 변경).
5. **OWASP Top 10**: 해당 사항 없음. 오히려 이 변경은 막혀 있던 dependabot 보안 업데이트
   PR(`@nestjs/typeorm`, `@nestjs/platform-express`)의 선행 조건을 해소하는 방향이라 장기적으로는
   의존성 보안에 긍정적이다.
6. **암호화**: 관련 코드 변경 없음.
7. **에러 처리**: 관련 코드 변경 없음.
8. **의존성 보안**:
   - `node --experimental-vm-modules` 플래그는 `test`/`test:watch`/`test:cov`/`test:debug`/
     `test:e2e` 스크립트에만 추가됐다. `start`/`start:dev`/`start:debug`/`start:prod`(운영 진입점,
     `codebase/backend/package.json`) 는 `nest start`/`node dist/main` 그대로이며 이 플래그의
     영향을 받지 않는다 — 실험적 Node 플래그가 프로덕션 런타임으로 전파되지 않음을 확인했다.
   - `transformIgnorePatterns` 를 기본값으로 되돌리는 것 자체는 취약점을 새로 만들지 않는다 —
     ts-jest 를 거치지 않고 `node_modules` 의 ESM 패키지를 네이티브로 로드하도록 바꾸는 것으로,
     실행되는 패키지 코드 자체는 동일하다.
   - `esm-native-load.spec.ts` 의 신규 가드 테스트가 npm script 문자열의 node 인자 구간을
     통째로 고정해, 향후 스크립트가 조용히 바뀌어 experimental 플래그가 의도치 않게 확장/누락되는
     것을 잡도록 설계되어 있다 — 안전장치로 타당하다.

## 발견사항

없음. Critical/Warning 급 보안 결함을 발견하지 못했다.

- **[INFO]** NestJS 12 동반 업그레이드가 인가 fail-open 위험을 내포함 (현재 diff 의 결함은 아님)
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C ("착수 시 **반드시** 검증할 것 —
    reflection 보안 회귀")
  - 상세: 이 plan 문서는 `RolesGuard`/`@WorkspaceId()` 가 Nest 비공개 API 에 의존하며, 향후
    v12 업그레이드가 이를 깨뜨리면 워크스페이스 멤버십 검증이 "조용히" 사라지는(fail-open)
    방향으로 실패할 수 있음을 스스로 명시하고 체크리스트를 걸어 두었다. 현재 이 PR 은 실제 v12
    업그레이드를 수행하지 않으므로 결함이 아니라 **적절히 문서화된 사전 경고**다.
  - 제안: 실제 `nestjs-v12-coordinated-upgrade` 작업 PR 을 리뷰할 때, 이 §C 체크리스트(부트
    캐너리 소비 라우트 수 전/후 비교 등)가 실제로 수행·기록됐는지 반드시 확인할 것.

## 요약

이번 변경은 Jest 테스트 러너가 ESM 전용 패키지를 네이티브로 로드하도록 전환하는 순수 테스트
인프라/빌드 툴링 변경이다. 애플리케이션 코드, 인증/인가 로직, 시크릿, 사용자 입력 처리 경로를
전혀 건드리지 않으며, 실험적 Node 플래그도 테스트 스크립트에만 국한되어 프로덕션 런타임에
영향이 없음을 확인했다. 새로 추가된 가드 테스트도 설정 표류를 막는 안전장치로 타당하다. 유일한
주목 포인트는 함께 커밋된 plan 문서가 예고하는 후속 NestJS 12 업그레이드의 인가 fail-open
리스크인데, 이는 이번 diff 의 결함이 아니라 다음 작업을 위해 잘 기록된 경고이므로 INFO 로만
남긴다.

## 위험도

NONE
