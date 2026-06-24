# 문서화(Documentation) 코드 리뷰

## 발견사항

### [INFO] Dockerfile 헤더 주석 — 이전 "호스트 선행" 주의사항 완전 제거, 신규 설명 적합
- 위치: `codebase/frontend/Dockerfile` 헤더 (#1–#9 라인)
- 상세: 구 주석(`pnpm --filter frontend build:widget` 을 호스트에서 미리 실행해야 한다)이 정확히 삭제되고, 신규 "이미지 내부 자급 빌드" 설명으로 대체되었다. 설명에 SoT 링크(`spec/7-channel-web-chat/0-architecture.md §4.1`)가 포함되어 있어 단일 진실 소스를 참조한다.
- 제안: 이상 없음. 주석 정확성 양호.

### [INFO] Dockerfile 인라인 주석 — deps/builder 스테이지 설명 명확
- 위치: `codebase/frontend/Dockerfile` 라인 약 82–98
- 상세: `pnpm install` 3-filter 확장에 "build:widget 이 두 패키지를 빌드하므로 그 deps 가 필요하다" 설명, COPY channel-web-chat 에 "web-chat-sdk 소스는 deps 의 COPY codebase/packages 로 이미 존재" 설명, `RUN pnpm --filter frontend build:widget` 에 "동봉 위젯 산출(public/_widget)" 설명이 붙어 있다. 복잡한 빌드 순서 변경에 적절한 인라인 주석이 모두 달려 있다.
- 제안: 이상 없음.

### [INFO] k8s/README.md §6 — 이전 "사전 단계" 커맨드 제거 및 callout 갱신 완료
- 위치: `k8s/README.md` §3(로컬 빌드) 및 §6(NEXT_PUBLIC_* CI 파이프라인 예시)
- 상세: 로컬 이미지 빌드 섹션에서 `pnpm --filter frontend build:widget` 사전 실행 커맨드가 제거되었고, §6 callout 이 "호스트 선행 필수" → "docker build 만 하면 됨" 으로 정확히 갱신되었다. CI(Jenkins·GitHub Actions)와 pnpm 없는 빌드 노드에 대한 설명도 추가되어 운영자에게 유용하다.
- 제안: 이상 없음. README 갱신이 Dockerfile 변경과 완전히 정합된다.

### [INFO] spec/7-channel-web-chat/0-architecture.md §4.1 — 빌드 방식 변경 반영 완료
- 위치: `spec/7-channel-web-chat/0-architecture.md` §4.1 "동봉 방식" 항목
- 상세: 기존 "빌드 파이프라인 복사" 모호한 표현이 "build:widget(copy-widget.mjs)이 두 패키지를 빌드해 복사" 로 구체화되었고, 신규 "build:widget 실행 위치 = frontend Dockerfile builder 스테이지(이미지 내부 자급)" 항목이 추가되어 spec ↔ Dockerfile 구현이 정합된다. "과거 운영 회귀 사례" 언급은 누락 시 회귀 위험을 미래 독자에게 전달하는 유용한 역사적 맥락이다.
- 제안: 이상 없음.

### [WARNING] k8s/README.md §3 로컬 빌드 — "아래 §6 주의" 앵커 참조의 정확성
- 위치: `k8s/README.md` §3 코드 블록 주석 첫 줄: `"frontend 이미지는 동봉 웹채팅 위젯을 builder 스테이지에서 자급 빌드한다(아래 §6 주의)"`
- 상세: 인라인에서 "§6 주의" 라고 참조하지만, §6 의 제목은 "NEXT_PUBLIC_* — 환경별 frontend 이미지" 이며 위젯 빌드 callout 은 그 섹션 본문 내 blockquote 에 포함된다. 섹션 번호·제목이 일치하고 callout 이 해당 섹션에 있으므로 오해는 없으나, 코드 블록 주석에서 "§6 동봉 위젯 참고" 같이 섹션 내용을 간략히 명시하면 더 명확하다. 현재 "§6 주의" 표현만으로는 §6 전체가 위젯 전용인 것처럼 읽힐 수 있다.
- 제안: 주석을 `"frontend 이미지는 동봉 웹채팅 위젯을 builder 스테이지에서 자급 빌드한다(§6 동봉 위젯 callout 참고)"` 정도로 수정하거나 현행 유지. 기능에는 영향 없음.

### [INFO] CHANGELOG — 본 변경에 해당하는 항목 부재 (프로젝트 CHANGELOG 미관리)
- 위치: 저장소 루트 CHANGELOG 부재
- 상세: 이번 변경은 운영 404 근본 원인 해소라는 중요한 회귀 수정이다. 그러나 저장소에 CHANGELOG.md 가 없고 프로젝트 규약에도 CHANGELOG 관리가 명시되지 않으므로, git 커밋 메시지(`fix(web-chat): Dockerfile 동봉 위젯 자급 빌드 — 운영 라이브 미리보기 404 근본 해소`)가 사실상 CHANGELOG 역할을 하고 있다. 커밋 메시지 자체는 원인·수정 내용·검증 방법을 모두 포함해 충분히 상세하다.
- 제안: 현행 방식(커밋 메시지 기반) 유지 또는 추후 CHANGELOG 도입 시 이 항목을 포함할 것.

### [INFO] 예제 코드 — docker build 커맨드 예시가 README와 Dockerfile 모두에 일관성 있게 존재
- 위치: `k8s/README.md` §3·§6, `codebase/frontend/Dockerfile` 헤더
- 상세: `docker build -f codebase/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... -t clemvion/frontend .` 예시가 두 위치에 일관되게 제시되어 있으며, `pnpm --filter frontend build:widget` 사전 실행 예시가 완전히 제거되어 운영자 오해를 방지한다. 예제 코드의 정확성과 일관성이 양호하다.
- 제안: 이상 없음.

### [INFO] spec 문서 frontmatter `status: partial` — 본 변경과 무관하나 관찰
- 위치: `spec/7-channel-web-chat/0-architecture.md` frontmatter `status: partial`
- 상세: 이번 변경은 §4.1 을 실제 구현에 맞게 갱신했으나, frontmatter `status` 는 여전히 `partial` 이다. 이는 다른 미완성 섹션(pending_plans 에 4개 plan 이 참조됨)이 있어 `partial` 이 유지되는 것으로 보이며, 이번 변경 단독으로 `complete` 로 올려야 할 이유는 없다.
- 제안: 현행 유지. 다른 pending_plans 가 완료될 때 status 재검토.

## 요약

이번 변경(Dockerfile 동봉 위젯 자급 빌드)은 문서화 관점에서 매우 잘 처리되었다. Dockerfile 헤더 주석, k8s/README.md §3·§6, spec/7-channel-web-chat/0-architecture.md §4.1 세 곳 모두 "호스트 선행 필수" → "이미지 내부 자급" 으로 일관성 있게 갱신되었으며, 단일 진실 소스(spec §4.1) 참조 링크도 유지된다. 인라인 주석은 복잡한 빌드 단계 각각에 충분한 설명을 제공하며, 예제 커맨드에서 불필요한 사전 단계가 완전히 제거되어 운영자 혼선을 방지한다. k8s/README.md §3 의 "아래 §6 주의" 참조 표현이 미세하게 모호하나 기능·이해에는 지장 없으므로 LOW 수준의 미세 개선 사항에 불과하다.

## 위험도

LOW
