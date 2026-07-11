## 발견사항

해당 없음.

**분석 근거**: 매트릭스([`.claude/config/doc-sync-matrix.json`](.claude/config/doc-sync-matrix.json) `rows[]`, 20개 trigger) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재해 변경 file 목록을 대조했다. 변경 set(커밋 `f72a08963` "feat(web-chat): table 잘림 배너 총 개수 노출" + 선행 `4e1f665fc` "docs(spec): ...")은 다음으로 구성된다.

- `codebase/channel-web-chat/src/lib/presentation.ts` / `presentation.test.ts`
- `codebase/channel-web-chat/src/widget/components/presentations.tsx` / `presentations.test.tsx`
- `plan/in-progress/spec-draft-webchat-truncation-total-count.md`
- `spec/7-channel-web-chat/1-widget-app.md`
- `review/consistency/2026/07/11/22_58_26/**` (검토 산출물, 코드 아님)

매트릭스의 모든 trigger glob(`codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/`, `codebase/packages/expression-engine/**`, `codebase/backend/src/modules/auth/**`, `codebase/backend/src/nodes/core/error-codes.ts`, `spec/{2,3,4,5}-*/**`, `spec/conventions/**` 등)은 전부 `codebase/frontend`·`codebase/backend`·`codebase/packages` 또는 `spec/{2,3,4,5}-*`·`spec/conventions/` 범위이며, semantic-match 행(인증 흐름·표현식 언어·실행/디버깅 흐름·통합 provider 등) 역시 같은 영역을 대상으로 한다. 이번 변경은 전량 `codebase/channel-web-chat/**`(CLAUDE.md 정의: "임베드형 웹채팅 위젯 SPA, spec/7-channel-web-chat")과 `spec/7-channel-web-chat/**`에 국한되며, 두 경로 모두 doc-sync-matrix 의 어떤 trigger 에도 매칭되지 않는다. 특히 `spec/7-channel-web-chat/1-widget-app.md` 는 `spec-major-change` 행의 glob(`spec/2-*/**`~`spec/5-*/**`)에서 명시적으로 제외된다(`spec/7-*` 미포함).

`presentations.tsx` 에 추가된 신규 한국어 리터럴("총 {N}개 중 일부만 표시돼요." / "일부 행만 표시돼요.")은 표면적으로 매트릭스 항목 3 "신규 UI 문자열(TSX)"과 유사해 보이나, 해당 trigger 의 glob 은 `codebase/frontend/src/**/*.tsx` 로 한정되어 있고 실제 가드(`hardcoded-korean-ratchet.test.ts`)도 `SCAN_ROOTS = ["components","app","lib"]` 를 `codebase/frontend/src/` 기준으로만 스캔함을 직접 확인했다(`codebase/frontend/src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` L27-37) — `codebase/channel-web-chat` 는 스캔 범위 밖이다. 이는 같은 변경 set 에 포함된 plan 문서(`plan/in-progress/spec-draft-webchat-truncation-total-count.md`)의 명시적 서술과도 일치한다: "위젯은 i18n-userguide 하드코딩 빌드 가드(`hardcoded-korean-ratchet`) 스캔 밖이라 사전 분리는 강제 아님 — 기존 위젯 관례(인라인 한국어 + 해요체)를 따른다." 따라서 이 리터럴은 CRITICAL(i18n parity 누락)로 분류할 근거가 없다.

부가로, 이번 변경은 SDD 원칙(코드-spec 동시 갱신)을 이미 준수하고 있다 — `spec/7-channel-web-chat/1-widget-app.md` §2/§R8 이 같은 작업 흐름(선행 커밋) 안에서 코드 변경에 앞서 갱신됐고, `consistency-check --spec` 산출물(`review/consistency/2026/07/11/22_58_26/`)도 같은 changeset 에 포함되어 있다.

## 요약
매트릭스 trigger 20개 중 이번 변경(전량 `codebase/channel-web-chat/**` + `spec/7-channel-web-chat/**`)에 매칭되는 항목은 0건이다 — 모든 trigger 가 `codebase/frontend`/`codebase/backend`/`codebase/packages`/`spec/{2-5}-*`·`spec/conventions/` 범위로 스코핑되어 있어 web-chat 임베드 위젯 SPA 는 본 유저 가이드 동반 갱신 매트릭스의 관할 밖이다. 신규 한국어 UI 문자열도 `hardcoded-korean-ratchet` 가드 스캔 범위(`codebase/frontend/src/`) 밖임을 소스로 직접 확인해 i18n parity 위반이 아님을 검증했다. 누락 0건.

## 위험도
NONE