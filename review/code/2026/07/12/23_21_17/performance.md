# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** prod-deps 스테이지가 native addon 컴파일·internal package prepare(tsc)를 중복 수행 (빌드시간 증가)
  - 위치: `codebase/backend/Dockerfile` L41-43 (`FROM builder AS prod-deps` → `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)
  - 상세: `deps` 스테이지에서 이미 `pnpm install --frozen-lockfile --filter "backend..."` 로 devDeps 포함 전체 설치(및 bcrypt/isolated-vm native 컴파일 + 내부 `@workflow/*` 패키지 `prepare`(tsc) 실행)를 1회 완료했다. 신설된 `prod-deps` 스테이지는 node_modules 를 지우고 `--prod` 로 재해소하면서, PR 코멘트 자체가 명시하듯 native 컴파일과 내부 패키지 prepare 를 **다시** 실행한다. 이는 런타임 성능이 아니라 **Docker 이미지 빌드(CI 파이프라인) 소요 시간**을 늘리는 트레이드오프다 — bcrypt/isolated-vm 같은 native addon 의 node-gyp 컴파일은 통상 이미지 빌드 중 비교적 무거운 단계이며, 이를 2회 수행하게 된다.
  - 제안: 이미 plan 문서(`plan/in-progress/pnpm-migration-followups.md`)에 "이미지 1.4GB → 1.23GB, e2e 무회귀" 로 측정·검증됐고 트레이드오프가 의도적으로 채택된 것으로 보인다. 추가 개선을 원한다면 CI 환경에서 BuildKit cache mount(`RUN --mount=type=cache,target=<pnpm store 경로>`)로 pnpm store 를 스테이지 간·빌드 간 재사용해 재컴파일에 드는 네트워크/캐시 미스 비용을 줄이는 정도가 옵션이나, 필수는 아님(현재도 store 는 동일 이미지 파일시스템 내 존재해 네트워크 재요청은 없고 CPU 재컴파일만 발생).

- **[INFO]** 런타임 이미지 크기 축소 — 긍정적 성능 영향
  - 위치: `codebase/backend/Dockerfile` L119-123 (`runner` 스테이지가 `builder` 대신 `prod-deps` 에서 COPY)
  - 상세: devDeps 제거로 이미지가 1.4GB → 1.23GB(~170MB↓)로 축소됨(plan 문서 기재). 이는 이미지 pull 시간, 컨테이너 콜드스타트, 디스크/레지스트리 사용량, 공격 표면 모두에 긍정적이다. 런타임 메모리 사용량 자체(Node 프로세스 힙)에는 직접 영향 없으나 파일시스템 레이어 크기 감소는 배포 성능 관점에서 유의미한 개선.
  - 제안: 없음(개선 확인).

- **[INFO]** plan 문서 변경분(`plan/in-progress/pnpm-migration-followups.md`)은 순수 문서 갱신으로 성능 영향 없음.

## 요약

이번 변경은 애플리케이션 코드가 아닌 Docker 멀티스테이지 빌드 구조 변경으로, 런타임 관점에서는 프로덕션 이미지에서 devDependencies 를 제거해 이미지 크기를 약 170MB(1.4GB→1.23GB) 줄이는 순수 개선이다. 다만 이를 달성하기 위해 신설된 `prod-deps` 스테이지가 native addon(bcrypt/isolated-vm) 컴파일과 내부 워크스페이스 패키지의 `prepare`(tsc) 실행을 `deps` 스테이지 대비 한 번 더 반복하므로, 런타임 성능이 아닌 **CI/Docker 빌드 시간**이 다소 늘어나는 트레이드오프가 있다. 이는 PR 작성자가 이미 인지하고 plan 문서에 실측치(이미지 크기, e2e 253 무회귀)로 근거를 남긴 의도된 결정이며, 애플리케이션 런타임 알고리즘·쿼리·캐싱·메모리 구조에는 어떤 코드 변경도 없다.

## 위험도
NONE
