# 보안(Security) 코드 리뷰

## 대상

이번 diff(review session `01_40_43`)는 아래 15개 파일로 구성된다. 실질적으로는 (a) 채팅 위젯 새로고침
multi-turn 히스토리 복원에 대한 **테스트 전용** 추가/보완(제품 런타임 코드는 JSDoc 주석 정정 1건 제외 무변경),
(b) 신규 plan 문서, (c) 직전 리뷰 세션(`review/code/2026/07/12/01_10_15/`)의 산출물(SUMMARY/RESOLUTION/
개별 reviewer .md/meta.json/_retry_state.json 등) 신규 커밋 — 즉 리뷰 아티팩트 자체가 diff 대상이다.

- `codebase/channel-web-chat/src/lib/widget-state.test.ts` — `mergeMessages` snapshot/local 병합 6케이스 신설(WARNING#1 fix 반영: `threadMessages` undefined 방어분기 코멘트 정정 + `waiting([])` 빈배열 케이스 추가)
- `codebase/channel-web-chat/src/lib/widget-state.ts` — `mergeMessages` JSDoc 정정만(로직 무변경, WARNING#2 fix)
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 새로고침 복원 통합(e2e-lite) 테스트 신설
- `plan/in-progress/webchat-multiturn-restore-test.md` — 신규 plan 문서
- `review/code/2026/07/12/01_10_15/{RESOLUTION,SUMMARY,documentation,maintainability,requirement,scope,security,side_effect,testing}.md`, `meta.json`, `_retry_state.json` — 직전 리뷰 세션 산출물(신규 커밋된 리뷰 아티팩트)

제품(런타임) 소스 로직 변경은 0건(주석/JSDoc 정정 1건 제외)이라 신규 공격 표면은 발생하지 않는다.

### 발견사항

- **[INFO]** mock 인증 토큰 문자열이 테스트 코드에 다수 등장
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `token: "iext_prev"`, `"iext_x"` 등 (`ENDPOINTS`/`installFetch`/`installControllableSse`/신규 "복원 통합" 테스트 전반)
  - 상세: `iext_` 접두 문자열은 fetch mock 이 반환하는 가짜 JSON 값이며 실제 발급 토큰과 형식·엔트로피가 무관하다. 기존 테스트 파일 전반에 이미 쓰이던 동일 패턴의 재사용(신규 도입 아님). 리포지토리 내 실제 API 키·DB 비밀번호 등 진짜 시크릿으로 오인될 소지 없음.
  - 제안: 조치 불필요.

- **[INFO]** `[user-input]...[/user-input]` 마커 strip 검증 — 긍정적 보안 회귀 테스트
  - 위치: `use-widget-eager-start.test.ts` "복원 통합: getStatus 다중 turn conversationThread…" 테스트, `expect(msgs[0].text).not.toContain("user-input")`
  - 상세: 서버(EIA)가 반환하는 `conversationThread` 텍스트에 내부 처리용 마커가 그대로 사용자에게 렌더링되지 않는지 확인 — 기존 `conversation.ts` sanitize 로직에 대한 유효한 회귀 가드다. 신규 취약점 아님. 다만 이 테스트는 HTML/스크립트 이스케이프까지는 검증하지 않음(마커 문자열 제거만 확인) — 실제 XSS 방어 지점은 렌더링 컴포넌트(본 diff 범위 밖)이며, 텍스트 노드 렌더링을 전제로 하는 한 우려 없음.
  - 제안: 조치 불필요(XSS 방어 지점 자체 검증은 이번 diff 스코프 밖).

- **[INFO]** 에러 메시지 일반화(정보 노출 방지) 전제 — 이번 diff 로 훼손되지 않음
  - 위치: `use-widget-eager-start.test.ts` (기존 테스트, 컨텍스트 내)
  - 상세: `err` 가 내부 예외/HTTP status 원문을 노출하지 않는지 검증하는 기존 CWE-209 방지 테스트가 이번 diff 로 영향받지 않았음을 확인.
  - 제안: 조치 불필요.

- **[INFO]** sessionStorage 에 execution 토큰 저장을 전제로 한 테스트(기존 설계 재확인)
  - 위치: `use-widget-eager-start.test.ts`, `window.sessionStorage.setItem("clemvion-web-chat:session:t1", JSON.stringify({ executionId, token, expiresAt, endpoints }))`
  - 상세: 위젯이 세션 토큰을 `sessionStorage`(탭 종료 시 소멸, `localStorage` 대비 XSS 지속성 낮음)에 저장하는 PR #874 확립 패턴을 신규 "복원 통합" 테스트가 그대로 전제. 신규 도입 아님.
  - 제안: 조치 불필요.

- **[INFO]** JSDoc 정정(`widget-state.ts` `mergeMessages`) — 로직 무변경, 정보노출/보안 영향 없음
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` (diff)
  - 상세: 실제 구현(`snapshot.length >= local.length ? snapshot : local`)과 일치하도록 주석만 정정. 조건문·반환값 변경 없음(직전 세션 WARNING#2 fix 반영분). 보안에 중립.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 세션 산출물(`review/code/2026/07/12/01_10_15/**`)에 시크릿·민감정보 없음
  - 위치: `RESOLUTION.md`, `SUMMARY.md`, `meta.json`, `_retry_state.json`, 개별 reviewer `.md` 8종
  - 상세: 전부 orchestrator 상태 메타데이터(파일 경로, 라우팅 사유, 위험도 등급 등)와 markdown 리뷰 텍스트로, API 키/토큰/자격증명·내부 인프라 엔드포인트 등 하드코딩된 시크릿은 포함하지 않음. `session_dir` 등 경로 값은 로컬 worktree 절대경로일 뿐 민감정보 아님.
  - 제안: 조치 불필요.

### 요약

이번 변경 셋은 채팅 위젯 새로고침 히스토리 복원 로직(`mergeMessages`, `seedWaitingFromStatus`)에 대한 테스트 보강(제품 로직은 JSDoc 정정 1건 제외 무변경)과 직전 리뷰 세션의 산출물 신규 커밋으로 구성되며, 인젝션·인증/인가 우회·하드코딩된 실 시크릿·안전하지 않은 암호화·민감정보 노출·취약 의존성 등 어느 항목에서도 신규 이슈가 발견되지 않았다. 오히려 신규/보강된 테스트는 마커 strip(정보 노출 방지)·에러 메시지 일반화 등 기존 보안 방어 로직을 회귀 검증하는 긍정적 성격을 가진다. 테스트 내 mock 토큰 문자열은 형식·용도상 명백한 fixture 이며 실제 시크릿 유출 근거가 없다.

### 위험도
NONE
