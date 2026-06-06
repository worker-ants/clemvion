# RESOLUTION — fix-webchat-envelope-unwrap (review/code/2026/06/06/02_51_10)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 SCOPE/역할 규약 | 문서화 | — (코드 변경 없음) | spec 3건 수정은 동일 PR 내 project-planner 위임 경로(commit 84b5fa07)로 수행됐음. SDD 일괄 처리 — 별도 PR 분리는 작업 컨텍스트 분산 위험이 더 큼. RESOLUTION 에 근거 명시로 해소. |
| #2 TESTING | 코드 | `86f23b9b` | `unwrapData` export(테스트 전용) + describe 7케이스 추가: `{data:null}`, null 입력, 배열, 원시형, 봉투없음 객체, `{data:[]}` |
| #3 TESTING | 코드 | `86f23b9b` | `interact` describe 의 mock 에 "body 미소비 → 봉투 무관" 주석 추가 |
| #4 DOCUMENTATION | 코드 | `86f23b9b` | `getStatus` JSDoc 에 "응답은 전역 TransformInterceptor 봉투(`{ data }`)를 언랩한 상태 객체 반환(EIA §5.3)" 명시 |
| #5 DOCUMENTATION | 코드 | `86f23b9b` | `refreshToken` JSDoc 에 "응답 봉투(`{ data }`) 언랩 후 `{ token, expiresAt }` 반환(EIA §5.5)" 명시 |
| #6 SPEC frontmatter | 코드 | `86f23b9b` | `spec/5-system/14-external-interaction-api.md` `pending_plans:` 에 `plan/in-progress/fix-webchat-envelope-unwrap.md` 추가 |

## TEST 결과

- lint  : 통과 (channel-web-chat 직접. 전체 wrapper 는 backend @eslint/js 패키지 미설치 pre-existing 환경 결함으로 실패 — 본 변경과 무관)
- unit  : 통과 (150 passed — channel-web-chat, +7 unwrapData edge케이스)
- e2e   : 통과 (174/174) — `_test_logs/e2e-20260606-030308.log`

## 보류·후속 항목

- INFO-7 (`use-widget.test.ts` startConversation mock): `use-widget.test.ts` 는 `refreshDelayMs` 순수 함수만 테스트 — `startConversation` mock 없음. 회귀 탐지력 저하 없음. 별도 조치 불필요.
- INFO-13 (SPEC-DRIFT): `spec/5-system/14-external-interaction-api.md §4.1` 봉투 주석 — 코드가 옳고 spec 이 이미 commit 84b5fa07 에서 갱신됨. 추가 조치 없음.
- side_effect reviewer 출력 파일 미존재: 본 변경은 순수 함수 `unwrapData` 추가 + 기존 3개 메서드 반환값 언랩으로 외부 부작용 표면(DB 쓰기·emit·side-channel) 없음.
- WARNING-1 역할 규약: spec 3건 변경은 developer 가 아닌 project-planner 위임 경로(commit 84b5fa07)로 수행됨. 동일 PR 포함은 SDD 일괄 처리 — 코드·spec revert 없이 근거 명시로 해소.
- INFO #1~#12, #14~#17: 기존 기술 부채·선택적 개선 항목 — 별도 plan 에서 처리 대상.
