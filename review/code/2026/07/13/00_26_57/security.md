# 보안(Security) 리뷰

## 발견사항

- **[INFO]** GitHub Actions 서드파티 action 이 mutable 태그로 pin
  - 위치: `.github/workflows/packages-checks.yml` (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v6`)
  - 상세: 커밋 SHA 가 아닌 major 버전 태그로 고정돼 있어, 해당 action 저장소가 침해되면 태그 재지정을 통한 공급망 공격에 이론적으로 노출된다. 다만 이는 신규 도입이 아니라 기존 `web-chat-checks.yml`/`frontend-checks.yml` 등 리포지토리 전역에서 이미 쓰이는 동일 패턴을 그대로 답습한 것이며, 이번 워크플로가 다루는 대상(내부 lint/test/build)도 secrets 를 전혀 사용하지 않는다.
  - 제안: 리포지토리 차원의 후속 하드닝(전체 workflow 의 action 을 commit SHA 로 재고정)을 고려할 수 있으나, 본 PR 단독으로 규모를 키울 필요는 없다. 비차단.

- **[INFO]** 신규 workflow 에 `permissions:` 블록 미지정
  - 위치: `.github/workflows/packages-checks.yml`
  - 상세: 명시적 최소권한(`permissions: contents: read` 등) 선언이 없어 default `GITHUB_TOKEN` 권한(리포지토리 설정에 따라 broader 할 수 있음)을 그대로 상속한다. 다만 이 워크플로는 secrets 사용·PR 코멘트/배포 등 쓰기 동작이 없고, `migration-recheck-on-main.yml` 을 제외한 기존 `*-checks.yml` 전부가 동일하게 `permissions` 를 생략하는 리포지토리 전역 패턴이라 이번 변경만의 회귀는 아니다.
  - 제안: 전역 하드닝 항목으로 별도 백로그화 가능. 비차단.

이 외 항목별 특이사항 없음:
- `pull_request_target` 미사용, PR 제목/본문 등 신뢰할 수 없는 GitHub context 값을 `run:` 셸 문자열에 직접 보간하는 곳 없음 → GitHub Actions 스크립트 인젝션 벡터 없음.
- 하드코딩된 시크릿/토큰/키/인증서 없음(모든 변경분에 리터럴 credential 부재).
- `.claude/test-stages.sh` 변경은 정적 `pnpm --filter <pkg> {lint,test,build}` 나열 추가뿐, 사용자 입력을 셸에 보간하는 부분 없음 → 커맨드 인젝션 벡터 없음.
- `codebase/packages/*/eslint.config.mjs` 신규 파일은 표준 flat config 보일러플레이트(eslint recommended + typescript-eslint recommended)이며 임의 코드 실행·network fetch 등 없음.
- `package.json` 변경은 devDependency 추가(`eslint`, `@eslint/js`, `globals`, `typescript-eslint`)뿐이고, 이들은 잘 알려진 ESLint/typescript-eslint 공식 패키지로 typosquatting 의심 없음. 전부 devDependency(런타임 미배포)라 실제 프로덕션 공격면 확대 없음.
- `pnpm-lock.yaml` 변경분은 위 devDependency 추가에 대응하는 lockfile 갱신뿐. 신규 의존성 트리에 알려진 이상 패키지명·버전 없음.
- `expression-engine/src/functions/date.ts`(미사용 `ManipulateUnit` 타입 제거) / `string.ts`(미사용 `FunctionError` import 제거)는 순수 dead-code 정리이며 로직·입력검증·에러 처리 변경 없음. 인젝션·검증 누락 위험 없음.
- 인증/인가, 세션 관리, 암호화, 에러 메시지 노출과 관련된 애플리케이션 코드 변경 없음(본 changeset 은 CI/lint/build 인프라 + 내부 packages devDependency 배선에 한정).

## 요약

본 변경은 내부 공유 패키지(expression-engine·graph-warning-rules·node-summary·chat-channel-validation·sdk)의 lint/test/build 를 harness 와 신규 CI 워크플로(`packages-checks.yml`)에 배선하고, 각 패키지에 표준 ESLint flat config 를 추가하는 순수 개발 인프라 변경이다. 시크릿 하드코딩, 인젝션 벡터, 인증/인가 로직 변경, 암호화 이슈는 발견되지 않았다. 유일하게 언급할 만한 사항은 신규 GitHub Actions 워크플로가 action 을 mutable 태그로 pin 하고 `permissions` 를 명시하지 않는다는 점이나, 둘 다 리포지토리 전역에 이미 존재하는 기존 패턴을 그대로 따른 것이라 본 PR 이 새로 도입한 리스크가 아니며 secrets 미사용 컨텍스트라 실질 위험은 낮다.

## 위험도
NONE
