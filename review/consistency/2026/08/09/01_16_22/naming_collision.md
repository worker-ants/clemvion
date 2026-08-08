STATUS=success naming_collision: 0 findings (no new identifiers introduced)

# 신규 식별자 충돌 검토 — backend-lint-gate-broken-on-main

## 검토 범위 확인

- 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- `git diff origin/main...HEAD` 전량(코드 68개 파일)을 확인한 결과 **전부 `codebase/backend/**` 기존 파일의 in-place 수정**이며, 다음 특성을 가진다:
  - `new file mode` / `rename from` / `deleted file mode` 항목 **0건** — 신규 파일·경로 없음
  - `spec/` 하위 어떤 파일도 diff 에 포함되지 않음(spec/data-flow/ 포함 전 영역) — `spec_impact: none` (plan frontmatter)과 일치
  - diff 내용은 전량 (1) prettier 3.9.6 업그레이드로 인한 union 타입 포맷팅(`|` 줄바꿈 제거), (2) `@typescript-eslint/no-unnecessary-type-assertion` 회귀 처분(불필요 `as` 제거, 로드베어링 assertion 복원 + 근거 주석 + `eslint-disable-next-line`), (3) 고아 `import` 제거 뿐이다.
  - `mcpConfig`/`oauthConfig` 의 `registerAs(...)` 블록과 `MCP_*`/`CAFE24_*`/`GOOGLE_*`/`GITHUB_*`/`OAUTH_STUB_MODE`/`FRONTEND_URL`/`APP_URL` 등 ENV 참조는 **기존에 이미 존재하던 식별자**로, 이번 diff 에서는 줄바꿈 스타일만 바뀌었다(신규 도입 아님).
- 새 요구사항 ID, 새 엔티티/DTO/인터페이스명, 새 API endpoint, 새 webhook/queue/SSE 이벤트명, 새 ENV var·config key, 새 spec 파일 경로 — **어느 항목도 diff 에 존재하지 않는다.**

## 결론

본 target(`spec/data-flow/`)은 이번 PR 에서 **변경되지 않았다** — bundle 에 포함된 것은 리뷰 컨텍스트 제공용이며, 실제 구현 diff 는 순수 lint 게이트 복구(포맷팅 + 불필요 타입 단언 정리)로 신규 식별자를 전혀 도입하지 않는다. 따라서 신규 식별자 충돌 관점에서 점검할 대상 자체가 없다.

### 발견사항

(없음)

### 요약

이번 PR 은 `origin/main` 에서 깨져 있던 backend lint 게이트를 복구하기 위한 prettier 재포맷 + `no-unnecessary-type-assertion` 회귀 처분으로 구성되며, 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·spec 파일 경로 중 어느 것도 새로 도입하지 않는다(신규/삭제/이동 파일 0건, `spec/` 변경 0건, `spec_impact: none`과 일치). 신규 식별자 충돌 관점에서 보고할 항목이 없다.

### 위험도

NONE
