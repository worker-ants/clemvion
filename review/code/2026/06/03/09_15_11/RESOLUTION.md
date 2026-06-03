# RESOLUTION — Channel Web Chat 데모 호스트 + 포트 분리

리뷰: `review/code/2026/06/03/09_15_11/SUMMARY.md` — RISK **LOW**, Critical **0**, Warning **4**.
조치 방식: 수동(main). Warning 4건 + 테스트/유지보수성 INFO 일부를 본 review-fix commit 에서 해소.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 위치 |
|---|---|---|---|
| W1 | 테스트 | `demo-host.test.tsx` 신설 — boot 버튼 enabled/disabled, `wc:ready`→`wc:boot` 핸드셰이크, **잘못된 source/origin 무시(I6)**, open 명령 전달까지 4 케이스 | `src/app/demo/demo-host.test.tsx` |
| W2 | 아키텍처 | same-origin 하드코딩은 **단기 허용**(리뷰 명시). 의도(데모=동일 dev origin 임베드, 별도 CDN origin 은 SDK 담당, 확장 시 `NEXT_PUBLIC_WIDGET_ORIGIN` 단일소스화)를 코드 주석으로 명문화. 후속 개선은 plan 후속 항목 등록 | `src/app/demo/demo-host.tsx` `WIDGET_SRC` 주석 |
| W3 | 문서화 | `.env.example` `NEXT_PUBLIC_BASE_PATH` 주석 spec 참조를 전체 경로 `spec/7-channel-web-chat/0-architecture.md §4` 로 교체 | `codebase/channel-web-chat/.env.example` |
| W4 | 문서화 | plan 작업 항목 체크박스를 실제 통과 단계 기준 `[x]` 로 갱신 | `plan/in-progress/channel-web-chat-demo.md` |
| INFO #5 | 유지보수성 | `buildBootConfig` 필드별 `.trim()` 1회 추출(중복 제거) | `src/app/demo/demo-config.ts` |
| INFO #4 | 유지보수성 | 매직넘버 `MAX_LOG_ENTRIES`/`PANEL_WIDTH` 상수화 | `src/app/demo/demo-host.tsx` |
| INFO #6 | 유지보수성 | `update` 헬퍼 `useCallback` 적용(핸들러 메모이제이션 일관성) | `src/app/demo/demo-host.tsx` |
| INFO #8~#11,#15 | 테스트 | `demo-config.test.ts` 케이스 보강 — 탭 구분자·whitespace `primaryColor`·`isDemoEnabled({})`·whitespace `apiBase` | `src/app/demo/demo-config.test.ts` |
| INFO #13,#14 | 문서화 | `DemoHost`/`DemoFormState` JSDoc 추가 | 양 파일 |

미반영(의도): INFO #2(apiBase URL 검증)·#16(next semver 고정)·#17/#1(`source .env` 격리)·#7(dir 의미 타입) — 운영 SDK/별도 티켓 영역이거나 dev-only 허용 범위. 아래 후속에 W2 와 함께 기록.

## TEST 결과

- lint: **통과** (`channel-web-chat` eslint, 0 error)
- unit: **통과** (`vitest` 12 files / **128 tests** — 데모 16건 포함)
- build: **통과** (`next build` static export — `/demo` 는 production 에서 notFound 로 제외 확인)
- e2e: **보류** — 저장소 `cmd_e2e`=`make e2e-test`(backend supertest)는 본 변경(독립 정적 SPA `channel-web-chat` 의 dev 전용·prod 제외 `/demo` 페이지, backend 무접촉)에 커버리지/신호 없음. **사용자 명시 승인**(2026-06-03, AskUserQuestion "e2e 처리" → "보류 승인 (권장)"). channel-web-chat 자체 e2e 하니스 부재(전용 CI `web-chat-checks.yml` 은 lint/typecheck/test/build).

> 검증 스코프 근거: `channel-web-chat` 은 backend/frontend file:dep 에 묶이지 않은 독립 패키지로, 전용 CI(`web-chat-checks.yml`)와 동일하게 패키지 스코프로 lint/unit/build 수행. 전체-monorepo `run-test.sh`(backend+frontend+docker 이미지 재빌드)는 본 변경에 무관한 영역까지 재빌드하므로 비채택.

## 보류·후속 항목

- **W2 후속(별도 개선)**: 데모를 별도 CDN origin 위젯에 붙이는 경로가 필요해지면 `NEXT_PUBLIC_WIDGET_ORIGIN` 으로 발신 targetOrigin·수신 origin 필터를 단일소스화. (현재 same-origin 데모엔 불필요 — 단기 허용)
- **consistency-check W1~W5(spec 갭)**: `plan/in-progress/channel-web-chat-demo.md §후속(project-planner, 본 PR 밖)` 에 이관 — SSE 재연결 시나리오·재로드 복원 시퀀스·`WEB_CHAT_WIDGET_ORIGINS` env 문서화·`4-security.md` Rationale·spec-impl-evidence INCLUDE_PREFIXES.
