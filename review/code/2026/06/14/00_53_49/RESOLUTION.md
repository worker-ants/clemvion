# RESOLUTION — discord-gaps ai-review (2026-06-14/00_53_49)

RISK=LOW, Critical 0, Warning 8. 수동 조치 (코드 fix + spec/convention doc-sync + user-docs + 테스트).

## WARNING 처리

| # | 상태 | 조치 |
|---|------|------|
| W1 SPEC-DRIFT (chat-channel-adapter.md botIdentity) | ✅ FIXED | §2.3 botIdentity 타입 스니펫에 `publicKey?: string` + 주석 추가. |
| W2 TESTING (extractFormTitle 우선순위) | ✅ FIXED | `title`+`config.title` 동시 존재 → 직접 우선 테스트 추가. |
| W3 TESTING (languageHints.formModalTitle 경로) | ✅ FIXED | title 미지정 + formModalTitle → hint 사용 테스트 추가. |
| W4 TESTING (min=0/max=0 독립 검증) | ✅ FIXED | minLength=0 허용·maxLength=0 거부 독립 케이스 추가. |
| W5 USER-DOCS (discord.mdx/en.mdx) | ✅ FIXED | user-guide-writer 가 §5.3 필드 길이 제약 + §7.2 formModalTitle 키 (KO/EN parity) 추가. |
| W6 SECURITY (cross-verify 빈 문자열 silent skip) | ✅ FIXED | inboundSigningRef 있는데 expectedPublicKey/verify_key 비어 cross-verify skip 시 warn 로그(서명 검증 SoT 는 §6 inbound 유지). |
| W7 MAINTAINABILITY (dispatcher IIFE spread) | ✅ FIXED | IIFE 제거 → `modalTitle` 변수 추출 후 삼항 spread 로 통일. |
| W8 REQUIREMENT (hooks title 빈 문자열 보호) | ✅ FIXED | spread 조건을 `title && title.trim().length > 0` 으로 강화. |

## INFO 처리

| # | 상태 | 조치 |
|---|------|------|
| 3 languageHints jsdoc | ✅ FIXED | ChatChannelConfig.languageHints JSDoc 에 formModalTitle/replyModalTitle/replyModalLabel 등 키 등재. |
| 11 validateFormSubmission 서버측 길이 검증 | ✅ FIXED | minLength/maxLength 위반 시 오류 반환 분기 추가(Discord UI bypass 방어, spec §3.3 "submit 후 어댑터 검증" 의도) + 테스트. |
| 12 reply modal title 45자 truncate | ✅ FIXED | reply modal title 에도 `.slice(0,45)` 적용 (form modal 과 일관). |
| 13 extractFormFields JSDoc | ✅ FIXED | validation 정규화 동작 1줄 추가. |
| 14 openFormModal JSDoc | ✅ 인라인 주석 | title 3단계 fallback·45자 truncate·min/max 동작이 인라인 주석으로 문서화됨. |
| 15 discord.md §5.1 "slash 만 동작" stale | ✅ FIXED | (a) power user 보조 옵션·(b) v1 default 병존으로 갱신. |
| 16 extractFormTitle 우선순위 spec 명시 | ✅ FIXED | discord.md §3.3 modal title 주석에 "직접 title 우선" 명시(extractFormTitle). |
| 7 clamp 테스트 / 8 verify_key 부재 테스트 | ✅ FIXED | min/max 4000 clamp·verify_key 부재→publicKey undefined 테스트 추가. |
| 1,2,4,5 (공통 resolver·discordMeta 분리·상수 추출·regex 위치) | ⏭ 수용 | 현 규모 낮은 우선순위 refactor — 별도. |
| 6,9,10,17,18 (추가 통합테스트·중복정리·perf·frontmatter form-mode.ts) | ⏭ 수용 | 단위 테스트로 핵심 경로 커버, perf 무영향. |

## 검증
- chat-channel + hooks **538건 통과** (extractFormFields/Title·validateFormSubmission 길이·openFormModal title/min-max/clamp·setupChannel publicKey/verify_key 부재·discord reply 버튼). build·lint(0 error) 통과.

## 결론
Critical 0. Warning 8 전부 해소(코드·spec·convention·user-docs·테스트). 가치 INFO 9건 반영, refactor성 INFO 수용.
