# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상: `03-maintainability M-2` — frontend `API_BASE_URL` 분산 정의 + 3001→3011 포트 fallback 정정

## 발견사항

발견된 문제 없음 — 아래는 정합성 확인 결과를 요약한 INFO 항목들이다.

### [INFO] 03-maintainability.md M-2 의 상태가 target 과 완전 일치
- target 위치: 구현 범위 설명 전체
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` §M-2
- 상세: plan M-2 가 `lib/api/constants.ts` 신규 생성 + `client.ts`·`assistant.ts`·`auth-providers.ts`·`login-form.tsx`·`register-form.tsx`·`ws-client.ts` 6파일 교체를 명시(개선 방안 1~3). target 의 구현 범위("6파일 교체")가 plan 기재와 1:1 일치. `getServerApiBaseUrl()` 별도 export 유지 지시(개선 방안 2)도 일치.
- 제안: 조치 불요.

### [INFO] M-2 는 "미착수" 상태 — 선행 조건 없음
- target 위치: 구현 범위 전체
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` §M-2 (`- [ ] 미착수`)
- 상세: M-2 는 어떤 다른 plan 에도 선행 조건을 두지 않는다. `spec 변경 불요` 명시 — planner 위임 없이 developer 단독 착수 가능. 선행 미해소 항목 없음.
- 제안: 조치 불요.

### [INFO] 06-concurrency m-3 (`ws-client.ts` 동시 `connect()`) 은 독립 항목 — 범위 미충돌
- target 위치: ws-client.ts 교체 포함
- 관련 plan: `plan/in-progress/refactor/06-concurrency.md` §m-3 (`- [ ] 미착수 — ws-client.ts:23-30`)
- 상세: 06-concurrency m-3 은 `ws-client.ts` 의 pending 가드 미존재(동시 `connect()` 경쟁)를 다루고, 03 M-2 는 같은 파일의 `API_BASE_URL` 하드코딩 교체를 다룬다. 변경 대상 라인이 다르고(URL 정의부 vs `connect()` 로직부), M-2 가 m-3 의 미해결 결정을 우회하는 내용이 없다. 동일 파일 수정이지만 병행 PR merge conflict 는 동시 작업 직렬화 문제로 plan 정합성 검토 범위 밖이다.
- 제안: 조치 불요.

### [INFO] README.md P1 #12 항목이 본 작업에 해당 — 완료 후 plan 갱신 필요
- target 위치: (없음 — 구현 완료 후 후속)
- 관련 plan: `plan/in-progress/refactor/README.md` L60 `12. frontend API_BASE_URL 3001 fallback 수정 → [03] M-2 *(잔여)*`
- 상세: 구현 완료 후 03-maintainability.md §M-2 체크박스와 README 표(03 행 완료 카운트·P1 #12)를 갱신해야 한다. 이는 구현 중 plan 정합성 위반이 아니라 구현 완료 후의 표준 plan 갱신 절차이다.
- 제안: 구현 완료 후 plan 갱신 — 착수 차단 아님.

## 요약

target(03-maintainability M-2: frontend `API_BASE_URL` + 3001→3011 포트 fallback 정정)은 `plan/in-progress/refactor/03-maintainability.md` §M-2 가 명시한 개선 방안(단일 `constants.ts`, `getServerApiBaseUrl()` 별도 export, 6파일 교체, spec 갱신 불요)과 완전히 일치한다. 미해결 결정과의 충돌 없음: C-3/M-4 는 사용자 결정 대기 중이지만 M-2 의 frontend URL 상수화 작업과 교차점이 없다. 선행 plan 미해소 항목 없음. 후속 항목 중 ws-client.ts 를 다루는 06-concurrency m-3 은 변경 라인이 달라 본 작업과 충돌하지 않는다. 구현 착수에 차단 사유 없음.

## 위험도

NONE
