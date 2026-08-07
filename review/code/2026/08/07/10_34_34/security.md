# 보안(Security) 리뷰

## 리뷰 범위 요약
이번 diff 는 애플리케이션 소스 코드를 건드리지 않는다.

- `codebase/frontend/package.json` — devDependencies 4개 추가 (`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`)
- `plan/in-progress/harness-review-gate-ci-backstop.md` — plan 문서(서술형 텍스트)만 추가
- `pnpm-lock.yaml` — 위 devDependency 추가 반영 + pnpm 이 peer-dependency 해소 문자열을 재정규화(포맷 변경, 실질 버전 변경 아님)

세 파일 모두 인젝션·인증/인가·입력 검증·암호화·에러 처리와 같은 런타임 공격 표면을 갖지 않는다(로직 변경 없음). 따라서 이번 리뷰는 주로 8번 관점(의존성 보안)에 국한된다.

### 발견사항

- **[INFO]** 신규 devDependency 4종은 저위험 · 개발 전용 패키지
  - 위치: `codebase/frontend/package.json:79,88,91,92`
  - 상세: `@types/mdast`(타입 전용), `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string` 는 모두 `devDependencies` 에만 추가됐고, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`(spec 문서 링크 무결성 검사용 테스트 유틸)에서만 쓰인다. 프로덕션 런타임 번들에 포함되지 않고 사용자 입력이나 외부 신뢰 경계를 처리하지 않는다. 오히려 plan 문서(부록 #6)가 설명하듯, 이 패키지들은 이미 코드에서 import 되고 있었는데 어느 매니페스트에도 선언되지 않았던 것을 정식으로 선언한 것이다 — 워크트리 중첩이 `node-linker=isolated` 를 우회해 로컬에서만 조용히 해소되던 미선언 의존성 결함의 수정. 공급망 무결성 관점에서는 개선.
  - 제안: 없음(정상 처리).

- **[INFO]** 기존 전이 의존성 `@aws-sdk/core@3.977.4` 에 deprecation 경고가 lockfile 메타데이터로 노출됨
  - 위치: `pnpm-lock.yaml:918-920` (게이트 숫자 기준)
  - 상세: `deprecated: Deprecated due to Document number parsing bug in JSON, see https://github.com/aws/aws-sdk-js-v3/issues/8246. Newer version available.` 이 diff 는 이 패키지의 실제 버전을 바꾸지 않는다(재해소로 메타데이터만 새로 드러남). 이 프로젝트가 `@aws-sdk/client-s3` 를 통해 이 패키지를 전이적으로 사용 중이므로(backend), 향후 `@aws-sdk/client-s3` 업그레이드 시 이 deprecation 을 해소하는 편이 좋다. 이번 diff 가 만든 문제는 아니다.
  - 제안: 별도 후속 티켓으로 `@aws-sdk/client-s3` 버전 갱신 추적(이번 diff 의 필수 조치 아님).

- **[INFO]** 알려진 취약 override 하한(`fast-uri`, `undici`)이 plan 문서에 명시적으로 기록됐으나 이번 diff 는 미처분 상태를 유지
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:491-493` (문서 서술), `pnpm-lock.yaml:15,25` (`overrides:` 섹션 — 이번 diff 로 변경되지 않음, 컨텍스트 확인용)
  - 상세: plan 문서가 `fast-uri`(GHSA-7p8r-x3mc-p8w7)·`undici` 의 `pnpm-workspace.yaml` override 하한이 낡아 취약 버전이 다시 해소될 수 있다고 명시적으로 적어 두었다(부록 #7, "미처분"). `pnpm-lock.yaml` diff 를 직접 대조한 결과 `overrides:` 섹션(lines 8-37, 전체 파일 컨텍스트 기준)은 이번 변경으로 건드려지지 않았다 — 즉 이 diff 가 만들거나 악화시킨 결함이 아니라 기존 상태의 재확인/기록이다. 다만 plan 자체가 "의존성 거버넌스 턴으로 분리" 라고 명시했으므로 이번 PR 범위에서 고칠 의무는 없지만, 실제 override 값 갱신이 아직 반영되지 않았다는 사실은 남아 있는 리스크로 별도 트래킹이 필요하다.
  - 제안: 이번 PR 은 문서화만으로 충분(작성자 스스로 별도 트랙으로 분리한다고 명시). 후속 PR 에서 `pnpm-workspace.yaml` override 값과 `check-pnpm-security-config.py` 를 동시 갱신할 것.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 에 실제 비밀정보 없음
  - 위치: 파일 전체
  - 상세: 신규 추가분(부록 섹션)을 검토했으나 API 키·토큰·비밀번호·인증서 등 하드코딩된 시크릿은 없다. 내부 경로(`/Volumes/project/private/clemvion/...`)가 예시로 노출돼 있으나 이는 로컬 개발 환경 경로이고 민감 정보가 아니다.
  - 제안: 없음.

## 요약
이번 diff 는 프론트엔드 devDependency 4종 선언 + 그에 따른 lockfile 재생성(및 pnpm 의 peer-dep 해소 문자열 포맷 정규화)과 계획 문서 갱신으로만 구성돼 있고, 애플리케이션 런타임 코드·인증/인가 로직·사용자 입력 처리 경로를 전혀 건드리지 않는다. 새로 선언된 패키지는 devDependencies 범위의 저위험·널리 쓰이는 마크다운 유틸리티이며 오히려 기존의 미선언 의존성(공급망 무결성 결함)을 바로잡는 수정이다. lockfile 재해소 과정에서 드러난 `@aws-sdk/core` deprecation 과 plan 문서가 기록한 `fast-uri`/`undici` override 하한 낙후 이슈는 모두 이번 diff 가 만든 것이 아니며, 후자는 작성자가 이미 별도 트랙으로 명시적으로 분리해 두었다. Critical/Warning 급 발견사항 없음.

## 위험도
NONE
