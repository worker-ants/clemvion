# 보안(Security) 리뷰 — lockfile libc 진동 해소 (pnpm 10.23.0 → 10.34.5)

## 검토 범위

- `CHANGELOG.md` (문서, 신규 항목 추가)
- `codebase/frontend/Dockerfile.playwright-e2e` (corepack 폴백 pnpm 버전 문자열)
- `package.json` (`packageManager` 필드 값)
- `plan/in-progress/lockfile-libc-pin.md` (신규 plan 문서)
- `review/consistency/2026/09/25/11_14_19/*` (선행 consistency-check 산출물 — 읽기 전용 리포트)

변경 실체는 pnpm 버전 핀을 `10.23.0` → `10.34.5` 로 올리는 두 자리(`package.json:6`, `codebase/frontend/Dockerfile.playwright-e2e:21`)뿐이고, 나머지는 그 결정을 기록하는 문서(CHANGELOG·plan)와 사전 consistency-check 리포트다. 저장소 파일을 뮤테이션하지 않았고 `git status --short` 는 리뷰 세션 자신의 산출물(`review/code/2026/09/25/11_35_37/`)만 보여준다 — 원복할 것이 없다.

## 발견사항

- **[INFO]** corepack 폴백 경로가 무결성 검증 없이 npm 레지스트리에서 pnpm 을 설치한다
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e:21` (`RUN corepack enable || npm i -g pnpm@10.34.5`)
  - 상세: `corepack enable` 실패 시 폴백이 버전 문자열만으로 `npm i -g` 를 실행한다. 체크섬/lockfile 고정 없이 레지스트리를 신뢰하는 구조라 이론상 레지스트리·네임스페이스 탈취 시 공급망 위험의 표면이 된다. 다만 이는 **이번 diff 가 만든 것이 아니라 기존 패턴을 그대로 유지**한 것이고(버전 문자열만 10.23.0→10.34.5로 교체), corepack 경로가 성공하는 한 이 폴백 자체는 실행되지 않는다. 회귀는 아니다.
  - 제안: 해당 없음(이번 PR 범위 밖). 별도로 다룰 경우 `npm i -g pnpm@10.34.5 --integrity=<sha>` 또는 corepack 자체의 서명 검증 경로 강화를 고려할 수 있다.

- **[INFO]** 의존성 버전 상향(OWASP A06 관점) — 방향은 안전 측
  - 위치: `package.json:6`, `codebase/frontend/Dockerfile.playwright-e2e:21`
  - 상세: pnpm 을 더 오래된 10.23.0 에서 더 최신 patch(10.34.5)로 올리는 변경이라 "오래되고 취약한 컴포넌트" 리스크는 완화되는 방향이다. plan 문서(`plan/in-progress/lockfile-libc-pin.md`)가 `--frozen-lockfile --strict-peer-dependencies` 로 lockfile 무변경을 실측하고, 빌드가 차단되는 네이티브 패키지 목록(6개)이 기존과 동일함을 확인했다고 기록하고 있어 — 핀 상향이 새로운 네이티브 코드 실행 경로를 열지 않았음을 함께 보여준다. 알려진 CVE 매핑까지는 본 리뷰에서 별도로 조회하지 않았으나, 이 diff 자체에서 관측 가능한 정보로는 우려할 변경이 아니다.
  - 제안: 없음(정보 제공용).

인젝션·하드코딩 시크릿·인증/인가·입력 검증·암호화·에러 처리 관점에서는 이 변경 집합(버전 문자열 2곳 + 문서)에 해당 표면이 존재하지 않는다. `review/consistency/**` 산출물에서도 시크릿·자격증명 문자열은 발견되지 않았다(`secret-store` 는 명명 규약 문서명을 가리키는 것이지 실제 시크릿이 아니다).

## 요약

이번 변경은 순수 빌드 도구 버전 핀 상향(pnpm 10.23.0 → 10.34.5)과 그 결정을 설명하는 CHANGELOG/plan 문서로 구성되며, 애플리케이션 코드·인증/인가 로직·사용자 입력 처리 경로를 전혀 건드리지 않는다. 유일하게 언급할 만한 지점은 Dockerfile 의 corepack 폴백이 무결성 검증 없이 npm 레지스트리에서 패키지를 설치한다는 것인데, 이는 기존부터 있던 패턴이며 이번 diff 가 새로 만든 리스크가 아니다. 버전 상향 자체는 오래된 컴포넌트 리스크를 완화하는 방향이고, plan 문서가 frozen-lockfile 무변경·차단 패키지 목록 불변을 실측으로 뒷받침하고 있어 공급망 관점에서도 퇴행이 없다.

## 위험도

NONE
