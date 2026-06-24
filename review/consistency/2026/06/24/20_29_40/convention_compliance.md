# 정식 규약 준수 검토 결과

검토 대상: `03-maintainability M-2 — frontend API_BASE_URL 분산 정의 통합 + 3001 to 3011 fallback 정정`  
검토 기준: `spec/conventions/**`  
검토 모드: `--impl-done`, diff-base=`origin/main`

---

## 발견사항

### [INFO] `WS_BASE_URL` 식별자 — 기존 로컬 변수명 `WS_URL` 과의 차이는 규약 범주 아님

- target 위치: `codebase/frontend/src/lib/api/constants.ts:23`, `codebase/frontend/src/lib/websocket/ws-client.ts:3`
- 위반 규약: `spec/conventions/` 에 frontend 내부 상수 명명 규약 문서 없음
- 상세: 구버전 `ws-client.ts` 의 로컬 상수명은 `WS_URL`, 신규 `constants.ts` 의 export 명은 `WS_BASE_URL`. `API_BASE_URL` 의 패턴(접두어 없이 `_BASE_URL` 접미)과 대칭이므로 일관성 있음. 정식 규약(`spec/conventions/`) 에 frontend 내부 상수 명명 지침이 없으므로 규약 위반이 아니라 INFO 수준 관찰.
- 제안: 현 명명 유지. 만약 향후 frontend 상수 명명 규약을 conventions 에 추가한다면 `<scope>_BASE_URL` 패턴을 예시로 포함할 것.

### [INFO] `webhook-url.ts` 가 `process.env.NEXT_PUBLIC_API_URL` 을 직접 참조 — M-2 범위 의도적 제외

- target 위치: `codebase/frontend/src/lib/utils/webhook-url.ts:30`
- 위반 규약: 해당 없음 (spec 규약 위반 아님)
- 상세: `webhook-url.ts` 는 `NEXT_PUBLIC_API_URL` 을 URL origin 추출 목적(후행 `/api` 제거)으로 사용하며, 단순 base URL import 가 아닌 변환 로직이 필요해 `constants.ts` 의 `API_BASE_URL` 직접 재사용이 불가능하다. 별도 `NEXT_PUBLIC_WEBHOOK_BASE_URL` override 지원을 포함한 전용 로직이므로 M-2 범위(`5개 파일 모두 교체`) 에서 의도적으로 제외된 것으로 판단된다. 계획(`plan/in-progress/refactor/03-maintainability.md §M-2 개선 방안`) 에도 해당 파일이 교체 대상으로 열거되지 않았다.
- 제안: `webhook-url.ts` 는 변환 로직을 내장한 별도 경로이므로 현 상태 유지가 적절. 내부에 `3001` 리터럴 참조가 없는지 확인은 이미 `grep 3001` 0건 검증으로 충족된다 (`webhook-url.ts` 는 3001 사용 없음).

### [INFO] `constants.ts` 파일 위치 — `lib/api/` 내 배치와 `lib/constants/` 경계 언급

- target 위치: `codebase/frontend/src/lib/api/constants.ts:1-2` (첫 주석)
- 위반 규약: `spec/conventions/` 에 frontend 내부 폴더 구조 규약 없음
- 상세: 파일 첫 주석에 "비-API 전역 상수는 `lib/constants/` 에 둔다" 고 명시해 경계를 자체 선언했다. 이는 규약 문서 부재를 코드 주석으로 보완한 것으로 긍정적이다. `spec/conventions/` 에 해당 경계를 공식화한 문서는 없으므로 위반이 아니다.
- 제안: 필요 시 `spec/conventions/` 에 frontend 모듈 경계 규약 문서를 신설할 수 있으나 현 변경 범위에서는 불필요.

---

## 요약

M-2 변경은 `spec/conventions/` 의 정식 규약 중 직접 관련된 항목인 `error-codes.md`(에러 코드 rename 금지), `swagger.md`(DTO·Controller 패턴), `audit-actions.md`(감사 액션 명명), `spec-impl-evidence.md`(frontmatter 증거) 등의 어느 것도 건드리지 않는다. 변경 대상이 frontend 내부 URL 상수의 단일화로서, 식별자 명명(`API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl`, `LOCAL_API_FALLBACK`)은 모두 UPPER_SNAKE_CASE 상수 / camelCase 함수 관용 패턴을 따르며, 테스트 파일도 기존 `__tests__/` 디렉토리 내 `<module>.test.ts` 패턴에 부합한다. 정식 규약 직접 위반(CRITICAL) 및 주의 수준(WARNING) 발견사항 없음. 지적 사항은 모두 INFO(사소한 관찰) 이며 규약 자체의 갱신이나 코드 수정이 필요한 항목 없다.

---

## 위험도

NONE
