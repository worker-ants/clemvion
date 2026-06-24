# 요구사항(Requirement) 리뷰 — fix(web-chat): 라이브 미리보기·설치 스니펫 동봉 위젯 서빙 복구

리뷰 대상 커밋: `33ad66b65c97eddb7d057615e91f923a6b876083`

---

## 발견사항

### [INFO] proxy.ts 는 named export `proxy` — Next.js middleware 진입점 연결 확인 필요
- 위치: `codebase/frontend/src/proxy.ts` (전체 파일)
- 상세: Next.js middleware 진입점은 `src/middleware.ts`(또는 루트 `middleware.ts`) 에서 `export default` 로 함수를 내보내야 한다. `proxy.ts` 는 named export `proxy` 만 있고 `export default` 가 없다. 현재 codebase 에서 `proxy.ts` 를 import 하는 파일이 테스트(proxy.test.ts)뿐이다. 그러나 빌드 산출물(`functions-config-manifest.json`)에 `_widget` 이 포함된 matcher 가 정상 등록되어 있음이 확인됐다 — Next.js 16(`^16.2.3`)이 `proxy.ts` 를 middleware 로 연결하는 내부 규약이 다를 수 있거나, 별도 진입점이 있을 수 있다. spec `2-navigation/10-auth-flow.md §7` 은 `proxy.ts` 를 "Next 서버 미들웨어"로 지정한다. 이 wiring 의 실제 경로(middleware.ts 생략 여부, Next 16 규약)를 문서화하지 않으면 향후 버전 업그레이드·신규 기여자가 wiring 을 이해하기 어렵다.
- 제안: proxy.ts 가 어떻게 Next 서버 미들웨어로 연결되는지(Next 16 의 `src/proxy.ts` 직접 인식 여부, 또는 숨겨진 진입점 여부) 코드 또는 spec 주석에 한 줄 명시. 기능 오류로 보이지는 않음(빌드 manifest 에서 matcher 확인됨).

---

### [INFO] matcher 와 함수 내부 예외 — 이중 방어의 의도 명시 양호, 중복은 의도적
- 위치: `codebase/frontend/src/proxy.ts` L26–31 (함수 내부), L45–47 (matcher config)
- 상세: `/_widget` 은 matcher 에서 이미 제외되어 proxy 함수 자체가 실행되지 않을 것이나, 함수 내부에도 `pathname.startsWith("/_widget")` 방어가 추가됐다. 이는 "matcher 가 실수로 변경될 경우의 함수 레벨 방어"로 이중 안전장치 역할이며, 주석에 의도가 설명되어 있다. 기능 중복이지만 의도적 다층 방어로 적절하다.
- 제안: 없음 (현 상태 유지 적절).

---

### [INFO] rewrites `afterFiles` 위치 — 충돌 가능성 낮음, 단 명시적 `beforeFiles` 사용 고려
- 위치: `codebase/frontend/next.config.ts` rewrites()
- 상세: `return [...]` 형태로 반환하면 Next.js 는 이를 `afterFiles` rewrites 로 처리한다(빌드 산출물 `routes-manifest.json` 확인). `afterFiles` 는 Next.js 라우트 매칭 이후에 적용되므로 `/_widget/...` 경로가 Next 페이지 라우트로 해석되면 rewrite 가 무시될 수 있다. 단 `public/` 서빙 경로는 Next 페이지 라우트보다 우선 처리되어 실제 충돌 위험은 낮다. 위젯 경로가 향후 Next 페이지와 겹칠 경우를 대비해 `beforeFiles` 사용을 검토할 수 있다.
- 제안: 현 `afterFiles` 로 충분하나, spec §4.1 의 "rewrite" 요구가 명시됐고 실측(308→200)이 확인된 이상 즉각 변경 불필요. 향후 라우트 추가 시 검토.

---

### [INFO] spec `2-navigation/10-auth-flow.md §7` — `/_widget` 예외 미기재
- 위치: `spec/2-navigation/10-auth-flow.md` L433 (계층 1 서버 proxy 설명)
- 상세: auth-flow spec 의 proxy 계층 설명에 "public 경로(`/login`…)와 `/_next` · `/api` · 정적 자산은 제외"라고 기재되어 있으나, 이번 변경으로 추가된 **`/_widget` 예외**가 반영되어 있지 않다. `spec/7-channel-web-chat/0-architecture.md §4.1` 에는 정확히 기재됐으나 auth-flow spec 과 불일치한다.
- 판단: `spec/7-channel-web-chat/0-architecture.md §4.1` 이 갱신됐고, auth-flow spec §7 의 설명은 proxy 동작을 요약 서술한 것으로 코드가 명백히 옳다 → **`[SPEC-DRIFT]`**: 코드는 옳고 auth-flow spec §7 이 낡았다.
- 제안: 코드 유지 + `spec/2-navigation/10-auth-flow.md` §7 (계층 1 서버 proxy 행) 설명에 "`/_widget`(동봉 위젯 번들)" 을 제외 목록에 추가. `project-planner` 위임.

---

### [WARNING] [SPEC-DRIFT] spec `7-channel-web-chat/0-architecture.md §4.1` 이 developer 가 직접 수정 — 규약 일탈
- 위치: `spec/7-channel-web-chat/0-architecture.md` diff (6행 추가)
- 상세: `CLAUDE.md` 및 Skill 규약에 따르면 `spec/` 쓰기 권한은 `project-planner` 에게만 있으며, `developer` 는 `spec/` read-only다. 이번 커밋에서 developer 역할(커밋 메시지 `fix(web-chat):`)이 spec 파일을 직접 수정했다. spec 내용 자체는 구현 변경과 일치하고 정확하며(SPEC-DRIFT 보정 용도), 변경 후 consistency-check 없이 커밋됐을 가능성이 있다. 단 spec 내용의 정확성은 문제 없고, 프로젝트에서 SPEC-DRIFT 해소를 위한 spec 수정이 developer 커밋에 동봉되는 패턴이 과거에도 사용됐다(이전 리뷰 산출물 참조). 코드 버그는 아니며 프로세스 일탈 수준.
- 제안: spec 변경은 별도 `project-planner` 커밋 또는 규약 예외 명시(CLAUDE.md §5 "SPEC-DRIFT 해소" 허용 조항 여부 확인) 권장. 기능 오류 아님.

---

### [INFO] 테스트 환경 — `next/server` in jsdom 환경
- 위치: `codebase/frontend/src/__tests__/proxy.test.ts`
- 상세: vitest 환경이 `jsdom`으로 설정되어 있고 테스트가 `NextRequest` 를 직접 생성해 `proxy()` 를 호출한다. `next/server` 의 `NextRequest` 는 Node.js/Edge Runtime 대상이라 jsdom 에서 일부 동작이 다를 수 있으나(특히 `URL`, `Headers` 처리), 테스트 결과가 실측(dev curl)과 일치한다고 커밋 메시지에 기재되어 있어 실질적 오류 위험 낮음. `environment: "edge"` 또는 `"node"` 가 더 적합할 수 있다.
- 제안: 즉각 수정 불필요. 향후 proxy 테스트가 복잡해질 때 vitest environment 를 `node` 로 분리 고려.

---

### [INFO] rewrite 패턴 — trailing slash 없는 경로 처리
- 위치: `codebase/frontend/next.config.ts` rewrites() 첫 번째 항목
- 상세: `source: "/_widget/:segment*/app"` (trailing slash 없음)와 `source: "/_widget/:segment*/app/"` (있음) 두 가지를 모두 처리한다. Next.js의 `trailingSlash` 설정에 따라 둘 중 하나만 도달할 수도 있으나, 양쪽 모두 명시한 것은 방어적으로 적절하다. 실측 308→200 이 확인됐다.
- 제안: 없음.

---

## 요약

이번 변경은 동봉(co-deploy) 웹채팅 위젯의 라이브 미리보기·설치 스니펫이 인증 redirect(/login) 또는 404 로 깨지던 두 가지 실제 버그를 정확히 해결한다. (1) `proxy.ts` 의 `/_widget` prefix 인증 예외는 `includes(".")` 정적 파일 예외를 못 타던 디렉토리 경로(`…/app/`) 문제를 해소하고, matcher 에도 동봉 적용됐다(빌드 manifest 확인). (2) `next.config.ts` 의 rewrites 는 Next `public/` 디렉토리 index 자동 폴백 미지원 문제를 `/_widget/:segment*/app[/] → index.html` 로 해소하고, 빌드 산출물(`routes-manifest.json`)에 정상 등록됐다. 회귀 가드 테스트(`proxy.test.ts`)는 통과/실패 경로를 모두 포함한다. spec(`0-architecture.md §4.1`)도 구현과 일치하게 갱신됐다. CRITICAL·WARNING 수준의 기능 결함은 없다. 주요 사후 조치 사항은 `spec/2-navigation/10-auth-flow.md §7` 에 `/_widget` 예외 추가(SPEC-DRIFT, `project-planner` 위임)이며, proxy.ts 의 Next.js middleware 연결 방식(named export vs. default) 문서화와 spec 직접 수정의 프로세스 일탈 수준 경고가 부수적으로 남는다.

## 위험도

LOW
