# Code Review 통합 보고서 — discord-gaps (1·2·5)

## 전체 위험도
**LOW** — 기능 정확성·호환성 양호. Critical 0. WARNING 8(SPEC-DRIFT 1·TESTING 3·USER-DOCS 1·SECURITY 1·MAINTAINABILITY 1·REQUIREMENT 1).

## Critical
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| 1 | SPEC-DRIFT | `chat-channel-adapter.md §2.3` botIdentity 스니펫에 `publicKey?` 누락 | FIX (convention 갱신) |
| 2 | TESTING | extractFormTitle direct vs config.title 우선순위 케이스 부재 | FIX |
| 3 | TESTING | openFormModal title 미지정 + languageHints.formModalTitle 경로 미검증 | FIX |
| 4 | TESTING | extractFormFields minLength=0 허용 / maxLength=0 거부 독립 검증 부재 | FIX |
| 5 | USER-DOCS | discord.mdx/discord.en.mdx 에 formModalTitle + 길이 제약 동반 갱신 누락 | FIX (KO/EN) |
| 6 | SECURITY | cross-verify 가 expectedPublicKey 빈 문자열 시 silent skip | FIX (warn 로그) |
| 7 | MAINTAINABILITY | dispatcher IIFE spread 스타일 불일치 | FIX (변수 추출) |
| 8 | REQUIREMENT | hooks title spread 빈 문자열 보호 없음 | FIX (조건 강화) |

## 참고 (INFO) — 처리 방침

| # | 항목 | 조치 |
|---|------|------|
| 3 | languageHints jsdoc formModalTitle/replyModalTitle/replyModalLabel 미등재 | FIX |
| 11 | validateFormSubmission 서버측 minLength/maxLength 검증 부재 | FIX (spec §3.3 "submit 후 어댑터 검증" 의도) |
| 12 | reply modal title 45자 truncate 미적용 | FIX (일관성) |
| 13/14 | extractFormFields/openFormModal JSDoc 미갱신 | FIX |
| 15 | discord.md §5.1 "slash 만 동작" stale | FIX |
| 16 | extractFormTitle 우선순위 spec 미명시 | FIX (spec 1줄) |
| 1,2,4,5,17 | refactor(공통 resolver·discordMeta 분리·상수 추출·regex 위치·IIFE perf) | 수용 (현 규모 낮은 우선순위) |
| 6,7,8,9,10,18 | 추가 통합 테스트·중복 정리·frontmatter form-mode.ts | 일부 FIX, 일부 수용 |

## 에이전트별 위험도
security LOW · requirement LOW(SPEC-DRIFT) · testing LOW · maintainability LOW · user_guide_sync LOW · 그 외(performance·architecture·scope·side_effect·dependency·database·concurrency·api_contract) NONE.

## 라우터 결정
router 선별 — security·requirement·scope·side_effect·maintainability·testing·documentation·api_contract·user_guide_sync·architecture·performance 등 실행. backward-compatible additive 변경.
