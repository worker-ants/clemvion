# Architecture Review

## 발견사항

### **[INFO]** 빌드 컨텍스트 경계 확장 — 의도적 결합 증가
- 위치: `codebase/frontend/Dockerfile` deps 스테이지 (lines 37–40)
- 상세: `deps` 스테이지의 `--filter` 대상이 `frontend...` 단독에서 `channel-web-chat...` · `@workflow/web-chat...` 까지 확장됐다. 이는 frontend 이미지의 빌드 컨텍스트가 위젯 패키지 deps 전체를 포괄하게 됨을 의미한다. "의도적 결합"이므로 아키텍처적 위반은 아니지만, 향후 위젯 패키지 deps 가 증가할 때 frontend 이미지 빌드 시간이 함께 증가하는 점을 인지해야 한다.
- 제안: 현 상태 수용. 단 `codebase/channel-web-chat/package.json` 과 `codebase/packages/web-chat-sdk/package.json` 의 devDependency 증가가 frontend 빌드 캐시를 무효화하는 경로임을 팀이 공유하면 충분하다.

### **[INFO]** builder 스테이지 책임 범위 확대 — 단일 책임 경계 이완
- 위치: `codebase/frontend/Dockerfile` builder 스테이지 (lines 54–58)
- 상세: builder 스테이지가 기존에는 "frontend Next.js 빌드" 단일 책임이었으나, 이번 변경으로 "위젯 SPA 빌드 + frontend Next.js 빌드" 두 산출물을 생성하는 책임을 갖게 됐다. Docker 멀티스테이지 빌드에서 스테이지 분리는 재빌드 단위이기도 하므로, 위젯만 변경될 때와 frontend 코드만 변경될 때 모두 builder 전체가 재실행된다.
- 제안: 현 수준에서는 합리적 트레이드오프(빌드 단순화 우선). 위젯 빌드 빈도가 높아져 캐시 미스가 문제가 되면 `FROM deps AS widget-builder` → `COPY --from=widget-builder` 패턴으로 위젯 빌드를 별도 스테이지로 분리하는 것을 검토할 수 있다.

### **[INFO]** 레이어 책임 문서화 일관성 — spec·k8s·Dockerfile 삼중 동기화
- 위치: `spec/7-channel-web-chat/0-architecture.md §4.1`, `k8s/README.md §6`, `codebase/frontend/Dockerfile` 헤더
- 상세: 빌드 방식 변경이 세 파일에 동시 반영됐으며 서로 일관적이다. 그러나 빌드 방식의 SoT(단일 진실)가 세 곳에 분산된 형태다. 현재는 Dockerfile 헤더가 주 SoT 로 명기되어 있으나, spec 과 운영 README 에도 동일 설명이 중복 서술되어 향후 drift 발생 가능성이 존재한다.
- 제안: 현 수준에서는 허용 범위. spec §4.1 과 k8s README §6 는 Dockerfile 헤더를 SoT 로 명시하며 cross-reference 를 유지하고 있어 drift 감지가 가능한 구조다. 추가 조치 불필요.

### **[INFO]** `build:widget` 스크립트 암묵적 의존 — 추상화 불투명성
- 위치: `codebase/frontend/Dockerfile` line 57: `RUN pnpm --filter frontend build:widget`
- 상세: `build:widget`(copy-widget.mjs)이 내부적으로 어떤 패키지를 어떤 순서로 빌드하는지가 Dockerfile 에서 불투명하다. deps 스테이지에서 설치한 패키지와 builder 스테이지에서 COPY 한 소스가 `build:widget` 의 암묵적 전제와 정확히 일치해야만 빌드가 성공한다. 만약 `copy-widget.mjs` 가 새 패키지를 참조하게 되면 Dockerfile의 `--filter` 목록과 `COPY` 목록도 함께 갱신해야 하는데, 이 연결이 명시적으로 문서화되지 않는다.
- 제안: Dockerfile 의 deps/builder 스테이지 주석에 "이 목록은 `codebase/frontend/scripts/copy-widget.mjs` 가 참조하는 패키지 목록과 동기화 필요"라는 안내를 추가하면 유지보수성이 높아진다.

## 요약

이번 변경은 "호스트 선행 빌드 전제" 패턴을 "Dockerfile 자급 빌드" 패턴으로 교체한 인프라 아키텍처 결정이다. 빌드 재현성(reproducibility)과 CI 진입 장벽 제거라는 관점에서 방향은 올바르며, spec · k8s README · Dockerfile 세 문서가 일관적으로 갱신된 점도 긍정적이다. 단일 책임 관점에서 builder 스테이지가 두 산출물을 책임지게 된 점과 `build:widget` 스크립트의 암묵적 패키지 목록 의존은 향후 유지보수 부담 요인이나, 현재 규모와 복잡도에서는 합리적 트레이드오프 범위 내에 있다. Critical 또는 Warning 수준의 아키텍처 위반은 발견되지 않았다.

## 위험도

NONE
