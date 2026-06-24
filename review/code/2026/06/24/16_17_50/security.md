# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `execSync` 에 정적 리터럴 명령 사용 — 인젝션 위험 없음
  - 위치: `/codebase/frontend/scripts/copy-widget.mjs` 라인 42, 45
  - 상세: `run()` 함수가 `execSync`를 사용하지만 `cmd` 인자는 `WIDGET_PACKAGE`·`SDK_PACKAGE` 같은 모듈 내 정적 상수로만 구성된다. 사용자 입력이나 환경변수에서 파생된 값이 명령 문자열에 삽입되지 않으므로 커맨드 인젝션 표면이 없다. `env` 파라미터로 환경변수를 전달하는 방식 역시 셸 인터프리터를 거치지 않으므로 적절하다.
  - 제안: 현 상태 유지. 향후 이 함수를 수정해 외부 입력을 `cmd`에 포함할 일이 생기면 `execFile`(배열 args) 패턴으로 전환해야 한다.

- **[INFO]** 빌드 타임 `ARG`가 `ENV`로 전환되어 이미지 레이어에 고정됨
  - 위치: `codebase/frontend/Dockerfile` 라인 47–50 (`ARG NEXT_PUBLIC_API_URL` / `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL`)
  - 상세: `NEXT_PUBLIC_*` 값은 `--build-arg`로 주입되며 builder 레이어 ENV 에 고정된다. 이 두 값은 공개 API endpoint URL이므로 시크릿이 아니고, Next.js 정적 번들에 인라인되는 것이 설계 의도(k8s/README §6)이다. 민감 자격증명은 이 경로를 거치지 않는다.
  - 제안: 현 설계 유지. 만약 향후 `ARG`에 시크릿(API 키, DB 비밀번호 등)이 추가된다면 `--secret` 마운트 또는 runtime env 주입으로 분리해야 한다(`docker build --secret` 또는 k8s Secret).

- **[INFO]** runner 스테이지가 `node` 비루트 사용자로 실행됨 — 적절한 최소 권한
  - 위치: `codebase/frontend/Dockerfile` 라인 74 (`USER node`)
  - 상세: multi-stage 빌드에서 builder 단계는 root 로 실행되지만 runner 이미지에는 소스·빌드 도구가 없고, `USER node` 선언으로 프로세스가 비루트로 실행된다. k8s 매니페스트(Pod Security 섹션)도 `runAsNonRoot: true`, `runAsUser: 1000`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`을 명시한다. 이 변경이 기존의 보안 포스처를 변화시키지 않는다.
  - 제안: 이상 없음.

- **[INFO]** `.dockerignore`가 `.env*` 파일을 적절히 제외하고 있음
  - 위치: `/.dockerignore` 라인 5–6
  - 상세: `**/.env`, `**/.env.*` 패턴이 빌드 컨텍스트에서 시크릿 파일을 제외한다. `copy-widget.mjs` 및 Dockerfile은 환경변수를 `process.env`에서 상속하지만 이는 이미지에 파일로 포함되는 것이 아니라 빌드 실행 프로세스의 환경이다.
  - 제안: 현 상태 유지.

- **[INFO]** `channel-web-chat` 소스가 builder 스테이지에 추가되었으나 runner 이미지에서 제외됨
  - 위치: `codebase/frontend/Dockerfile` 라인 54 (`COPY codebase/channel-web-chat ...`)
  - 상세: 위젯 SPA 소스코드는 builder 스테이지에서만 사용되고, runner 스테이지는 `COPY --from=builder` 로 산출물(`public/_widget/...`)만 가져온다. 소스코드가 최종 이미지에 포함되지 않으므로 소스 노출 위험이 없다.
  - 제안: 이상 없음.

## 요약

이번 변경은 frontend Dockerfile의 빌드 방식을 "호스트 선행 빌드" 에서 "Dockerfile 내부 자급 빌드"로 전환한 것이다. 보안 관점에서 코드에 하드코딩된 시크릿이 없고, `execSync` 호출은 정적 리터럴만 사용해 커맨드 인젝션 표면이 없으며, multi-stage 빌드로 소스와 빌드 도구를 최종 이미지에서 제외하고, runner는 비루트 사용자로 실행된다. 변경된 세 파일(Dockerfile, k8s/README.md, spec) 모두 문서 정합성 갱신 성격이며, 새로운 보안 위협을 도입하지 않는다. `NEXT_PUBLIC_*` 빌드 인수는 공개 endpoint URL이므로 시크릿 취급 대상이 아니다. 전반적으로 보안 측면에서 안전한 변경이다.

## 위험도

NONE
