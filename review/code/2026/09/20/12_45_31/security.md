# Security Review — schedule-cron-flake (2026-09-20 12:45:31, 3라운드)

## 검토 범위

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 케이스 D(「PATCH cron → nextRunAt 재계산」) 의 시간창 판정 로직 교체 (실 코드 변경은 이 파일 하나).
- `plan/in-progress/schedule-cron-flake.md` (신규 plan 문서), `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 항목 추가) — 문서.
- `review/code/2026/09/20/11_54_10/**`, `review/code/2026/09/20/12_17_18/**`, `review/consistency/2026/09/20/11_21_16/**` — 선행 라운드 워크플로 산출물(SUMMARY·RESOLUTION·에이전트 리포트·`_retry_state.json`·`meta.json` 등). 모두 리뷰/컨시스턴시 harness 가 생성한 마크다운·JSON 보고서이며 실행 코드가 아니다.

`codebase/backend/test/schedule-trigger.e2e-spec.ts` 전체를 `Read` 로 확인. 변경분은 케이스 D 내부의 cron 리터럴 교체(`0 10 * * *` → `0 0 1 1 *`)와, `not.toBe(originalNext)` 단언을 제거하고 「PATCH 응답 시각이 요청 시점부터 1분 안(여유 30초)이고 초 자리가 0인가」로 판정을 바꾼 것뿐이다. 같은 파일의 `authHeaders()`(라인 59 부근)는 매 테스트 `registerAndLogin` 으로 발급받은 동적 토큰만 사용하며 이번 diff 밖이다 — 하드코딩된 자격증명 없음.

## 발견사항

없음.

- **인젝션**: 신규/변경 코드는 리터럴 cron 문자열 상수와 `Date`/`getTime`/`getUTCSeconds` 산술뿐. 사용자 입력을 조합해 쿼리·명령·경로를 구성하는 지점 없음.
- **하드코딩된 시크릿**: 변경 라인에 토큰·키·비밀번호 없음. `authHeaders()` 는 diff 밖이며 런타임에 발급된 `token` 변수를 사용.
- **인증/인가**: 이번 케이스도 기존과 동일하게 `authHeaders()`(Bearer 토큰 + workspace 헤더)를 사용해 요청하며, 인가 검증 로직 자체는 변경되지 않았다. 서비스 코드(`schedules.service.ts`) 변경 없음(plan 「비대상」 항목에서도 명시).
- **입력 검증**: 테스트 코드이며 외부 입력을 받지 않는다.
- **암호화/에러 처리**: 해당 없음(암호화 로직·에러 메시지 변경 없음).
- **의존성**: 신규 의존성 추가 없음.
- `review/**` 산출물(SUMMARY.md, RESOLUTION.md, `_retry_state.json`, `meta.json` 등)은 로컬 워크트리 절대경로만 담고 있어 민감정보 유출로 볼 수 없다 (선행 라운드 SUMMARY INFO 9 가 이미 "기존 관례" 로 처분).

## 뮤테이션/재현

이번 라운드는 판정 로직(시간창·비교 방식) 검토만으로 결론이 나 저장소 파일을 수정할 필요가 없었다. `git status --short` 로 사전 확인한 바 리뷰 시작 시점 워크트리는 clean 했고, 본 리뷰 중 어떤 파일도 쓰거나 되돌리지 않았다.

## 요약

이번 diff 는 e2e 테스트 한 케이스의 시각창 비교 로직 교체(대리 지표 `not.toBe` 제거 → 절대 시간창 + 분 경계 단언)에 국한되며, 서비스 로직·인증/인가·시크릿·의존성 표면을 전혀 건드리지 않는다. 함께 포함된 plan/review 산출물도 워크플로 관례에 따른 문서·메타데이터일 뿐 보안 관점 표면이 없다. 선행 두 라운드(11_54_10, 12_17_18)의 security 리뷰 결론(발견사항 없음)과 일치한다.

## 위험도

NONE
