# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: `codebase/frontend/Dockerfile`

- **[INFO]** 헤더 주석 밀도가 높아 첫인상이 무겁다
  - 위치: 파일 상단 주석 블록 (라인 1-10)
  - 상세: 파일 헤더가 7줄짜리 산문 주석으로 구성되어 있다. Dockerfile 관례상 헤더에 "무엇을 하는가"를 간결히 적고 상세 맥락은 SoT 참조로 위임하는 편이 변경에 덜 취약하다. 현재는 구현 결정(자급 빌드 이유·경로·행위)을 Dockerfile 헤더·spec·k8s/README 세 곳에 중복 서술하고 있다.
  - 제안: 헤더를 2-3줄로 축약하고 (`build:widget 자급 실행 — SoT: spec/7-channel-web-chat/0-architecture.md §4.1`) 구현 배경 서술은 spec SoT 한 곳으로 집약한다. 세 파일의 동일 내용을 동기화해야 하는 부담이 줄어든다.

- **[INFO]** `RUN pnpm --filter frontend build:widget` / `RUN pnpm --filter frontend build` 를 연속 두 `RUN` 레이어로 분리
  - 위치: builder 스테이지 라인 99-100
  - 상세: 두 명령을 분리하면 Docker 레이어가 하나 더 생기고 레이어 캐시 무효화 경계가 build:widget 산출물 변경에도 build 전체를 재실행하게 만든다. 위젯 빌드 산출물(`public/_widget`)은 next build 가 사용하므로 두 명령 사이에는 의존관계가 있다.
  - 제안: `RUN pnpm --filter frontend build:widget && pnpm --filter frontend build` 로 단일 레이어로 합치면 캐시 경계가 합리적으로 단순해진다. 단, 현재 형태도 기능상 문제 없으므로 선택 사항이다.

- **[INFO]** `COPY codebase/channel-web-chat` 와 `COPY codebase/frontend` 의 순서 의도가 주석 없이 암묵적
  - 위치: builder 스테이지 라인 96-97
  - 상세: channel-web-chat 를 먼저 COPY 하고 frontend 를 이후에 COPY 하는 순서는 Docker 레이어 캐시 최적화(frontend 변경이 잦을수록 channel-web-chat 레이어는 캐시 히트)를 의도한 것으로 보인다. 이 의도를 한 줄 인라인 주석으로 명시하면 이후 편집자가 순서를 임의로 바꾸지 않는다.
  - 제안: `# channel-web-chat 먼저 COPY — 변경 빈도 낮아 레이어 캐시 최적화` 인라인 주석 추가.

---

### 파일 2: `k8s/README.md`

- **[INFO]** §6 blockquote 가 세 파일(Dockerfile 헤더·k8s/README·spec §4.1) 중 가장 긴 서술을 담당
  - 위치: k8s/README.md §6 blockquote (라인 477-481)
  - 상세: spec/7-channel-web-chat/0-architecture.md §4.1 이 이미 SoT 로 지정되어 있음에도 k8s/README 의 blockquote 가 "빌드 노드에 pnpm 이 없어도 무방"까지 상세히 재서술한다. 동일 의미의 문장이 세 파일에 분산되어, 향후 빌드 방식 변경 시 세 곳을 모두 갱신해야 한다.
  - 제안: blockquote 를 한 문장 요약 + SoT 링크로 줄인다. (`frontend Dockerfile builder 스테이지가 위젯을 자급 빌드하므로 별도 선행 불필요. 상세: spec/7-channel-web-chat/0-architecture.md §4.1`) 유지보수 비용을 한 곳으로 집약.

- **[INFO]** 로컬 빌드 섹션 인라인 주석이 §6 을 참조만 함
  - 위치: k8s/README.md 로컬 이미지 빌드 코드블록 (라인 302)
  - 상세: `(아래 §6 주의)` 참조가 있어 독자가 스크롤해야 하지만, 현재 §6 주의사항의 핵심 메시지("docker build 만 하면 됨")는 이미 라인 302 인라인 주석에서 전달된다. 참조 형태가 적절하고 중복이 적다 — 큰 문제 없음.

---

### 파일 3: `spec/7-channel-web-chat/0-architecture.md`

- **[INFO]** §4.1 bullet 이 4개 항목으로 늘어나면서 단락이 길어짐
  - 위치: spec/7-channel-web-chat/0-architecture.md §4.1 추가 bullet (라인 545-549)
  - 상세: 새로 추가된 "build:widget 실행 위치" bullet 이 과거 운영 회귀 사례·외부 의존·pnpm 불필요까지 한 bullet 안에 서술한다. Spec 문서로서 내용이 충실하고, 중요 정보(과거 회귀 원인)를 명기한 점은 유지보수에 긍정적이다.
  - 제안: 단락이 길더라도 spec 의 SoT 역할상 허용 가능. 다만 "(과거 운영 회귀 사례)" 를 parenthetical 로 유지하는 것이 낫고, 인라인으로 "누락 시 ... 404 가 난다" 경고 문장은 별도 warning admonition(`> ⚠️`) 으로 분리하면 가독성이 높아진다.

---

## 전체 평가 (유지보수성 관점)

이번 변경의 핵심은 Dockerfile 빌드 방식 전환이며, 변경 내용 자체는 간결하고 의도가 명확하다. 가장 두드러진 유지보수성 리스크는 **동일한 설명이 세 파일(Dockerfile 헤더, k8s/README §6, spec §4.1)에 분산**되어 있다는 점이다 — 향후 빌드 방식이 다시 바뀔 때 세 곳을 모두 동기화해야 하는 부담이 남는다. spec §4.1 을 단일 SoT 로 명확히 지정하고 나머지 두 파일은 요약 + 링크로 위임하면 이 부담이 줄어든다. Dockerfile 의 `RUN` 레이어 분리, COPY 순서 주석 부재는 기능에 영향 없는 INFO 수준이다. 매직 넘버, 중복 로직, 과도한 중첩 등 전형적 유지보수성 결함은 없다.

## 위험도

LOW
