# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] .dockerignore 에서 `**/dist` 제외가 web-chat-sdk prepare 스크립트와 교차 작용
- 위치: `codebase/frontend/Dockerfile` deps 스테이지, `.dockerignore`
- 상세: `.dockerignore` 에 `**/dist` 가 명시되어 있다. `codebase/packages/web-chat-sdk` 의 `prepare` 스크립트는 `[ -d dist ] || tsc` 로 dist 가 없으면 자동 빌드한다. 빌드 컨텍스트에서 `dist/`가 dockerignore 로 제외되므로, deps 스테이지의 `COPY codebase/packages ./codebase/packages` 이후 `pnpm install` 시 `prepare` 가 재실행되어 이미지 내부에서 dist 를 생성한다. 이는 의도된 동작이며 기존 동작과 동일하다. 그러나 새로 추가된 `channel-web-chat` 은 `prepare` 스크립트가 없고 소스 COPY 가 builder 스테이지에서만 이루어지므로, deps 스테이지에서 소스 없이 `package.json` 만 있는 상태로 `pnpm install --filter "channel-web-chat..."` 가 실행된다. channel-web-chat 자체 deps 설치가 목적이므로 문제없으나, 혹여 channel-web-chat 에 `prepare` 훅이 추가되면 소스 부재로 실패할 수 있다.
- 제안: 현재 channel-web-chat 에 prepare 스크립트가 없으므로 즉각적 부작용은 없다. 향후 prepare 훅 추가 시 deps 스테이지에도 소스 COPY 를 추가하거나 `--ignore-scripts` 옵션을 검토한다.

### [INFO] 이미지 빌드 시간 증가 및 레이어 캐시 무효화 범위 확장
- 위치: `codebase/frontend/Dockerfile` builder 스테이지
- 상세: `COPY codebase/channel-web-chat ./codebase/channel-web-chat` 가 추가되어 channel-web-chat 소스 변경 시 builder 스테이지 캐시가 무효화된다. 기존에는 frontend 소스 변경만이 builder 캐시를 무효화했으나, 이제 channel-web-chat 소스 변경도 동일하게 무효화한다. 이는 의도된 동작이다(위젯 소스가 바뀌면 재빌드가 필요). 단, channel-web-chat 의 빈번한 변경이 frontend의 `next build` 캐시를 반복 무효화하는 부작용이 생긴다.
- 제안: 부작용 수준에서 문제는 없다. 성능이 이슈가 된다면 channel-web-chat COPY 를 frontend COPY 보다 앞에 두는 현재 순서(변경 빈도 낮은 것 먼저)가 이미 최적이다.

### [INFO] `build:widget` 실행 중 `rmSync → cpSync` 비원자적 파일시스템 조작
- 위치: `codebase/frontend/scripts/copy-widget.mjs` (기존 코드, 변경 없음)
- 상세: copy-widget.mjs 는 `rmSync(dest, { recursive: true, force: true })` 후 `cpSync` 로 교체하는 비원자적 조작을 한다. 이번 변경으로 이 스크립트가 이제 이미지 내부 빌드 컨텍스트에서도 실행된다. 이미지 빌드는 단일 단계로 실행되고 서빙 중이 아니므로, 스크립트 자체 주석("빌드타임 전용 스텝(배포의 `next build` 앞단계) — 앱이 서빙 중일 때 실행하지 않는다")에 부합한다. 신규 부작용 없음.
- 제안: 해당 없음.

### [INFO] NEXT_TELEMETRY_DISABLED 환경 변수가 `channel-web-chat` 빌드에도 전파
- 위치: `codebase/frontend/Dockerfile` builder 스테이지 (51번 줄)
- 상세: builder 스테이지에 `ENV NEXT_TELEMETRY_DISABLED=1` 이 설정되어 있고, 이제 동일 스테이지에서 `pnpm --filter frontend build:widget` 가 실행되며 그 안에서 channel-web-chat 의 `next build` 가 호출된다. `NEXT_TELEMETRY_DISABLED` 는 channel-web-chat Next.js 빌드에도 자동 전파된다. 이는 의도한 부수 효과이며(원격 측정 비활성화), 동작에 문제없다.
- 제안: 해당 없음.

### [INFO] `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` build-arg 가 channel-web-chat 빌드에 노출
- 위치: `codebase/frontend/Dockerfile` builder 스테이지 (49~50번 줄)
- 상세: builder 스테이지에 `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL`, `ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL` 가 설정된다. `pnpm --filter frontend build:widget` 내부에서 channel-web-chat 의 `next build` 가 실행될 때 이 환경 변수들이 채널 위젯 SPA 빌드 환경에도 노출된다. channel-web-chat 소스가 `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` 를 사용하지 않는다면 문제없으나, 실수로 사용할 경우 frontend 용 API URL 이 위젯에 하드코딩되는 부작용이 생길 수 있다.
- 제안: channel-web-chat 소스에서 `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` 참조 여부를 확인한다. 위젯이 `apiBase` 를 런타임 주입(boot 옵션)으로 받는 설계(spec §4 플레이스홀더)라면 현재 문제없다.

## 요약

이번 변경은 Dockerfile 빌드 단계를 재구성하는 것으로, 프로그램 런타임 상태·전역 변수·외부 서비스 호출·이벤트/콜백에는 영향을 주지 않는다. 변경의 부수 효과는 모두 빌드 컨텍스트 내부(Docker 레이어)에 한정된다. deps 스테이지에서 `channel-web-chat` 와 `@workflow/web-chat` 의존성이 추가 설치되고, builder 스테이지에서 `channel-web-chat` 소스가 COPY 되며 `build:widget` 이 이미지 내부에서 실행된다. 이미 존재하는 copy-widget.mjs 의 파일시스템 조작 방식(비원자적 rmSync→cpSync)은 이미지 내부 빌드 환경에서만 실행되므로 운영 서빙 중 경쟁 조건 위험이 없다. `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` ENV 가 channel-web-chat 빌드에 전파되는 점은 위젯이 해당 변수를 참조하지 않는 한 무해하며, spec 상 위젯의 API base 는 런타임 주입 설계이므로 현재 구조에서 문제없다. 문서(k8s/README.md, spec §4.1) 변경은 기존 잘못된 호스트 사전 빌드 지침을 제거하여 오히려 운영 실수 가능성을 낮춘다.

## 위험도

LOW
