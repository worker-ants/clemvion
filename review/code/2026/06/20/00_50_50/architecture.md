# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[INFO]** 모노레포 의존성 관리 레이어 중앙화 — overrides 분산 제거
  - 위치: `package.json` (신규), `codebase/backend/package.json`, `codebase/frontend/package.json`, `codebase/channel-web-chat/package.json`
  - 상세: 이전에는 보안 취약점 override 가 backend/frontend/channel-web-chat 세 곳에 분산되어 있었고, 각 패키지가 독립 lockfile 을 가져 "정책이 어디에 있는가"가 불명확했다. 이번 변경으로 `pnpm.overrides` 가 루트 `package.json` 으로 통합되고 단일 `pnpm-lock.yaml` 이 SoT 가 되어 의존성 정책 레이어가 명확하게 분리된다. 단일 책임 원칙(SRP) 관점에서 "전이 의존성 버전 정책" 책임이 루트로 귀속되는 구조적 개선이다.
  - 제안: 현행 유지. 다만 `package.json` 의 `//overrides`·`//swagger-pin`·`//onlyBuiltDependencies` 주석 필드가 비표준 필드(`//` 키)로 인라인되어 있는데, 이 방식은 pnpm이 무시하지만 일부 도구가 경고를 낼 수 있다. 별도 `README` 섹션으로 문서화하는 것도 고려할 수 있다(현재 구조는 허용 가능).

- **[INFO]** 내부 패키지 경계 명확화 — `file:` → `workspace:*` 프로토콜 전환
  - 위치: `codebase/backend/package.json`, `codebase/frontend/package.json`, `codebase/packages/web-chat-sdk/package.json`
  - 상세: `file:../packages/*` 는 설치 시 경로 해석이 호출 위치(CWD)에 의존하여, worktree 환경에서 경로 불일치로 install 충돌이 발생하던 구조적 취약점이었다. `workspace:*` 는 pnpm workspace 프로토콜로 경로 독립성이 보장되어 모듈 경계가 도구(패키지 매니저) 수준에서 강제된다. 모듈 경계 관점의 향상.
  - 제안: 현행 유지.

- **[INFO]** Dockerfile 의존성 설치 레이어 단순화
  - 위치: `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile`
  - 상세: 이전 Dockerfile 은 각 공유 패키지를 순서에 의존하는 명령 시퀀스(npm ci → build → prune per package)로 설치하여 스크립트가 설치 오케스트레이션 책임을 직접 맡고 있었다. 변경 후 `pnpm install --frozen-lockfile --filter "<app>..."` 단 한 줄로 수렴하고, `prepare` 스크립트가 내부 패키지 빌드를 처리하게 된다. Dockerfile 의 책임이 "앱 빌드" 로 좁아지고, 의존성 설치 오케스트레이션은 pnpm workspace 메커니즘으로 위임된다(레이어 책임 분리 개선).
  - 제안: 현행 유지.

- **[WARNING]** backend Dockerfile runner 스테이지에 devDependencies 포함 — 이미지 크기 증가 가능성
  - 위치: `codebase/backend/Dockerfile` runner 스테이지 (주석: "devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제")
  - 상세: 이전 Dockerfile 은 `npm prune --omit=dev` 로 devDependencies 를 제거했다. 현재 변경에서는 builder 에서 runner 로 `/app` 전체를 `COPY --from=builder` 하므로 devDependencies 포함 상태로 이미지가 생성된다. 주석에 명시된 대로 알려진 회귀이나, production 이미지에 불필요한 dev 패키지가 포함되는 것은 공격 표면과 이미지 크기 측면에서 보안·운영 위험이다. 아키텍처 관점에서는 "빌드 레이어" 와 "런타임 레이어" 의 책임 분리가 현재 약화된 상태다.
  - 제안: 후속 PR 에서 `pnpm deploy --prod` 또는 `pnpm install --prod` 를 runner 스테이지에 추가하여 devDependencies 분리를 복원해야 한다. 현재 PR 의 "마이그레이션 우선" 목표를 감안하면 허용 가능하나, 별도 plan 항목으로 추적해야 한다.

- **[INFO]** docker-compose.e2e.yml playwright-runner 볼륨 마운트 — 워크스페이스 루트 전체 노출
  - 위치: `docker-compose.e2e.yml` playwright-runner 서비스 volumes 섹션
  - 상세: pnpm workspace 전환으로 playwright-runner 가 `./:/app` (레포 루트 전체)을 마운트해야 한다. 이전에는 `./codebase/frontend:/app/frontend` 만 마운트했다. 마운트 범위가 넓어졌으나, anonymous volume 으로 `node_modules` 경로들을 가려 호스트 바이너리 누수를 방지하는 패턴은 유지된다. 보안 경계 관점에서 컨테이너 안에 레포 전체(`.git`, secrets 등 포함)가 노출될 수 있음을 인지해야 한다. e2e 전용 격리 컨테이너이므로 허용 가능하나, 레포에 민감 파일이 포함될 경우 주의 필요.
  - 제안: `.dockerignore` 또는 bind-mount 범위를 필요한 하위 경로로 제한하는 방안을 고려. 현재 구조는 e2e 특성상 허용 가능하다.

- **[INFO]** `_ensure_deps` 함수의 단순화 — 멱등성 개선
  - 위치: `.claude/test-stages.sh`
  - 상세: 이전 `_ensure_web_chat_deps` 는 패키지별 `node_modules` 디렉터리 존재 여부를 각각 체크하는 복합 조건이었다. 새 `_ensure_deps` 는 루트 `node_modules` 만 체크하여 단순화되었다. 이는 pnpm workspace 가 단일 설치로 수렴함에 따른 논리적 단순화이고 정확하다. 단, `node_modules` 가 부분적으로만 존재하는 부패 상태(corrupted)에서는 검사를 통과할 수 있다 — 이는 `pnpm install --frozen-lockfile` 이 실제로 무결성을 검증해줄 것이므로 현실적 문제는 없다.
  - 제안: 현행 유지.

- **[INFO]** `node-linker=hoisted` 선택 — pnpm strict 모드 미채택
  - 위치: `.npmrc`
  - 상세: pnpm 의 기본 symlink(isolated) 모드 대신 hoisted 를 선택한 이유가 주석에 명확하게 서술되어 있다(NestJS reflection, Next.js standalone file-tracer, native module 호환). 이는 phantom-dependency 허용이라는 아키텍처 트레이드오프를 의도적으로 수용한 것이며, 주석에 "그린 확인 후 점진 strict 화 가능" 이라 명시되어 있어 향후 개선 경로가 열려 있다. 설계 의도가 명확하게 문서화된 양호한 사례이다.
  - 제안: 현행 유지. 점진적 strict 전환을 plan 항목으로 등록 권장.

- **[INFO]** `next.config.ts` 의 `outputFileTracingRoot` 경로 수정 — 경로 상수 하드코딩
  - 위치: `codebase/frontend/next.config.ts`
  - 상세: `path.join(import.meta.dirname, "../..")` 로 두 단계 상위를 가리키는 것이 workspace 루트임을 의미한다. 디렉터리 구조 변경 시 깨지기 쉬운 하드코딩이지만, Next.js 의 `outputFileTracingRoot` 는 정적 설정이 요구되어 환경 변수화가 어렵다. 주석에 "두 단계 위가 workspace 루트" 라는 근거가 서술되어 수용 가능하다.
  - 제안: 현행 유지. 구조 변경 시 이 값을 반드시 갱신해야 함을 주석에 명시하는 것이 좋으나 현재도 충분히 서술되어 있다.

## 요약

이번 변경은 모노레포의 의존성 관리 아키텍처를 "패키지별 독립 설치 + file: 링크 수동 관리" 에서 "pnpm workspace 단일 설치 + workspace: 프로토콜" 로 전환하는 인프라 레이어 재구성이다. SOLID 관점에서 의존성 관리·버전 정책·보안 override 의 단일 책임이 루트 `package.json` 으로 명확하게 귀속되어 응집도가 향상되었다. 모듈 경계 관점에서는 `file:` 의 경로 의존성이 제거되어 worktree 환경에서의 결합도 취약점이 해소되었다. Dockerfile 과 CI 워크플로의 레이어 책임도 단순화되어 유지보수성이 높아졌다. 유일한 실질적 우려는 backend Docker runner 스테이지의 devDependencies 포함 상태인데, 이는 커밋 메시지와 인라인 주석에 명시된 알려진 회귀이며 별도 후속 작업으로 분리 추적하는 것이 적절하다. 전체적으로 아키텍처 관점에서 긍정적 방향의 인프라 리팩터링이다.

## 위험도

LOW
