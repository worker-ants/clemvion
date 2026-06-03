# 의존성(Dependency) 리뷰

리뷰 대상: `channel-web-chat` 로컬 데모 호스트 + dev 포트 분리 (feat-web-chat-demo)
리뷰 일자: 2026-06-03

---

## 발견사항

### [INFO] 이 PR에서 새로운 외부 의존성 추가 없음
- 위치: `codebase/channel-web-chat/package.json`
- 상세: 변경된 `package.json`은 `dev` 스크립트(`source .env 2>/dev/null; next dev --port ${PORT:-3013}`) 수정만 포함한다. `dependencies` 및 `devDependencies` 목록은 변경 전후 동일하다. 신규 추가 패키지 없음.
- 제안: 해당 없음.

### [INFO] 기존 의존성 버전 고정 혼재 — 확인 필요 수준
- 위치: `codebase/channel-web-chat/package.json`
- 상세: `dependencies` 에서 `dompurify: "3.4.7"`, `react: "19.2.4"`, `react-dom: "19.2.4"` 는 정확한 버전으로 고정되어 있으나, `next: "^16.2.6"` 는 semver range(`^`)를 사용한다. `devDependencies` 는 대부분 range 사용(`^6`, `^16`, `^22` 등). `vitest: "^4.1.8"` 는 range이나 현재 최신은 4.1.8 (5.x beta는 별도). 이 PR이 직접 변경한 부분이 아닌 기존 상태이므로 블로커는 아니나, 보안상 민감한 `dompurify`·`marked` 는 정확한 버전으로 고정되어 있어 긍정적이다.
- 제안: `next: "^16.2.6"` 도 정확한 버전(`"16.2.6"` 또는 `"16.2.7"`)으로 고정하는 것이 빌드 재현성 측면에서 권장된다. 현재 latest는 `16.2.7`이다.

### [INFO] `next: "^16.2.6"` — Next.js 16.x는 매우 최신 메이저 버전
- 위치: `codebase/channel-web-chat/package.json` `dependencies.next`
- 상세: Next.js 16.x(latest: 16.2.7)는 2025년에 출시된 최신 메이저 버전이다. `react: "19.2.4"` 와 `react-dom: "19.2.4"` 는 Next.js 16.x의 peer dependency 요건(`^18.2.0 || ^19.0.0`)을 충족한다. 호환성 문제 없음. 이 PR이 직접 변경한 부분이 아닌 기존 상태이다.
- 제안: 해당 없음 (호환성 정상).

### [INFO] 라이선스 이상 없음
- 위치: `codebase/channel-web-chat/package.json`
- 상세: 핵심 의존성 라이선스 확인 결과: `dompurify@3.4.7 (MPL-2.0 OR Apache-2.0)`, `marked@18.0.4 (MIT)`, `next@16.2.6 (MIT)`, `react@19.2.4 (MIT)`, `react-dom@19.2.4 (MIT)`. `dompurify`의 MPL-2.0 OR Apache-2.0 듀얼 라이선스는 상용 프로젝트에서 Apache-2.0 조건을 선택하면 제약이 없다. 모든 라이선스가 일반적인 상업 소프트웨어와 호환된다.
- 제안: 해당 없음.

### [INFO] npm audit 취약점 없음 (0건)
- 위치: `codebase/channel-web-chat/`
- 상세: `npm audit` 실행 결과 info 0, low 0, moderate 0, high 0, critical 0. 알려진 보안 취약점 없음. prod 19개, dev 503개, optional 115개 의존성 전체 클린.
- 제안: 해당 없음.

### [INFO] `overrides.next.postcss` 패치는 기존 트랜지티브 충돌 회피 용도로 적절
- 위치: `codebase/channel-web-chat/package.json` `overrides`
- 상세: `overrides: { next: { postcss: "^8.5.14" } }` 는 Next.js 내부 `postcss` 트랜지티브 의존성 버전 충돌을 회피하기 위한 기존 패치다. 이 PR에서 변경되지 않았다.
- 제안: 해당 없음.

### [INFO] `dev` 스크립트의 `source .env` — shell 의존성 확인
- 위치: `codebase/channel-web-chat/package.json` `scripts.dev`
- 상세: `source .env 2>/dev/null; next dev --port ${PORT:-3013}` 는 bash/zsh 에서 동작하는 패턴이다. Windows cmd/PowerShell 환경에서는 `source` 명령이 없어 실패한다. 그러나 이 프로젝트의 `engines: { node: ">=20" }` 설정만 있고 OS 제약 명시는 없다. 프로젝트가 macOS/Linux 중심 개발 환경이라면 문제없으나, 크로스 플랫폼 지원이 필요한 경우 `dotenv-cli` 또는 `cross-env` 같은 도구가 권장된다. 단, 이는 의존성 추가를 요구하므로 현재 프로젝트 규모에서는 허용 가능한 단순화다.
- 제안: 크로스 플랫폼 지원이 필요한 경우 `dotenv-cli`(`dotenv -e .env -- next dev --port 3013`) 방식 검토. 현재 macOS 개발 환경이므로 즉각 변경 필요 없음.

### [INFO] `demo-host.tsx` — 내부 모듈 의존관계 정상
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx`
- 상세: `demo-config.ts` 가 `@/widget/host-bridge` 에서 `BootMessage` 타입만 import 한다. `demo-host.tsx` 는 React 훅(`useCallback`, `useEffect`, `useRef`, `useState`)만 사용하며 외부 패키지를 추가로 사용하지 않는다. 새 내부 모듈(demo-config, demo-host, page.tsx)은 `src/app/demo/` 내에 자기완결적으로 격리되어 있어 기존 위젯 코드와 단방향 의존 관계를 유지한다.
- 제안: 해당 없음.

---

## 요약

이 PR은 `channel-web-chat`의 `package.json` 의존성 목록을 전혀 변경하지 않는다. 새로운 외부 패키지 추가가 없으며, `dev` 스크립트 수정(포트 3013 고정 + `.env` 로드)과 `/demo` 라우트 소스 파일 추가만 이루어졌다. 기존 의존성(`dompurify`, `marked`, `next`, `react`, `react-dom`)은 npm audit 클린 상태이고 라이선스도 상업 프로젝트에 적합하다. `next: "^16.2.6"` semver range 사용과 `dev` 스크립트의 `source` 명령 shell 의존성이 미미한 주의 사항으로 남지만, 두 항목 모두 이 PR이 새로 도입한 것이 아니거나 개발 환경에 제한적인 영향이다. 의존성 관점에서 이 변경은 안전하다.

---

## 위험도

NONE
