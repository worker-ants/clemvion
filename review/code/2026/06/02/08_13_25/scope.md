# 변경 범위(Scope) 리뷰

## 발견사항

### 핵심 의도 파악

본 PR 의 의도는 `plan/in-progress/channel-web-chat-followups.md` 에 기록된 다음 항목들이다:

- **D#3**: 임베드 allowlist soft 검증 — 백엔드 `EmbedConfigService` + `GET /hooks/:endpointPath/embed-config` + 위젯 부팅 시 BLOCKED phase 연결
- **D#4**: rich presentation 렌더 — carousel/table/chart/template 전용 inline 렌더러
- **D#5**: per_execution 토큰 auto-refresh — `use-widget` 자동 갱신 스케줄러
- **D#6**: M2 BYO-UI headless client 정식 패키징 — `examples/byo-ui-headless.ts` 를 실제 ClemvionClient 사용으로 전환 + README
- **D#7**: CI 테스트 오케스트레이션 wiring — `.claude/test-stages.sh` + `.github/workflows/web-chat-checks.yml` 편입

---

### [INFO] plan 파일 갱신 — 의도된 범위 내 정상

- 위치: `plan/in-progress/channel-web-chat-followups.md`
- 상세: D#3~D#7 완료 표기 + 워크플로우 측 비용 가드(§2) 설계 질문 상세 추가 + spec-fix-public-webhook-security.md 삭제. 모두 plan 관리 의무 범위(developer `plan/**` 쓰기 권한)다.
- 제안: 없음(정상).

### [INFO] review/code/2026/06/02/01_32_03/ 산출물 포함 — 이전 리뷰 사이클 RESOLUTION 완결

- 위치: `review/code/2026/06/02/01_32_03/RESOLUTION.md`, `_resolution_state.json`, `_retry_state.json`, 개별 리뷰 파일 다수
- 상세: 이전 리뷰 사이클(01_32_03)의 resolution 이 이번 PR 에서 완결돼 파일들이 추가됐다. `review/code/**` 쓰기는 `code-review-agents` 역할 산출물이자 `developer` 가 `review/**/RESOLUTION.md` 를 쓸 수 있는 허용 범위다. 이전 PR 코드 대상 산출물이나 해당 사이클 완결 처리로 포함된 것이다.
- 제안: 없음(정상).

### [INFO] `plan/in-progress/spec-fix-public-webhook-security.md` 삭제 — 이전 사이클 spec draft 정리

- 위치: 파일 27 (삭제)
- 상세: 이전 리뷰 사이클에서 생성한 spec draft 임시 파일을 삭제했다. RESOLUTION.md 에서 spec 위임 처리 완결에 따른 정리이며 plan 관리 범위 내 정상 조치다.
- 제안: 없음(정상).

### [INFO] `widget-app.test.tsx` — 기존 테스트 시그니처 async/await 전환

- 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx`
- 상세: D#3 구현으로 boot 흐름이 embed-config fetch 를 포함하게 됐고, 기존 테스트 2개의 `boot` 호출이 `async/await` 로 변경됐다. D#3 의 필수 연동 수정이며 관련 없는 리팩토링이 아니다.
- 제안: 없음(정상).

### [INFO] `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` — 전체 재작성

- 위치: 파일 25
- 상세: 파일 전체 재작성이지만 D#6 의 "examples/byo-ui-headless.ts: 의사코드 → 실제 ClemvionClient 사용" 항목과 정확히 일치한다. 의도된 변경이다.
- 제안: 없음(정상).

### [WARNING] `widget-app.test.tsx` — `document.referrer` 조작 복원이 테스트 실패 시 누수 가능

- 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx`, 라인 1435 (Object.defineProperty 복원)
- 상세: "임베드 불허 host" 테스트가 `document.referrer` 를 조작한 뒤 test body 마지막 라인에서 복원하지만, `try/finally` 가 아니어서 어설션 실패 시 복원이 건너뛰어진다. 이후 테스트에서 오염된 `referrer` 가 잔류할 수 있다. 범위 이탈은 아니나 테스트 격리 결함이다.
- 제안: `afterEach` 또는 `try/finally` 로 복원 보장 권장. 단순 수정이므로 현 PR 내 해결 가능.

### [INFO] 로컬 worktree 에 미커밋 package-lock.json 변경 잔존

- 위치: `codebase/backend/package-lock.json`, `codebase/frontend/package-lock.json` (git status 에서 M)
- 상세: 현재 worktree git status 에 두 파일이 수정됨으로 표시되나 이번 PR diff 에는 포함되지 않았다. 의도하지 않은 lock 변경이 커밋에 섞이지 않았는지 확인이 필요하다.
- 제안: `git diff codebase/backend/package-lock.json codebase/frontend/package-lock.json` 으로 내용 확인 권장. 커밋에 포함된 내용은 아니므로 현재 PR 범위 이탈은 아니나 관리 주의 사항.

---

## 요약

본 변경은 `channel-web-chat-followups` plan 의 D#3(임베드 allowlist soft 검증), D#4(rich presentation 렌더), D#5(토큰 auto-refresh), D#6(M2 BYO-UI 정식화), D#7(CI 오케스트레이션) 5개 완료 항목에 집중되어 있다. 43개 파일 모두 각 작업 의도 내에서 설명된다. 백엔드 embed-config 서비스·컨트롤러·모듈 추가, 위젯 presentation 렌더러, BLOCKED phase 추가, use-widget 기능 확장, SDK README/예제 갱신, 테스트 스테이지/CI 편입, plan/review 산출물 갱신이 모두 각 D# 계획과 일대일 대응된다. 불필요한 리팩토링, 무관한 파일 수정, over-engineering 은 발견되지 않았다. 경미 사항으로 `widget-app.test.tsx` 의 `document.referrer` 복원이 `try/finally` 로 보호되지 않은 점(테스트 격리 결함)과 로컬 worktree 에 미커밋 package-lock.json 변경이 잔존한다는 관리 사항이 있다.

## 위험도

LOW

---

STATUS=success ISSUES=2
