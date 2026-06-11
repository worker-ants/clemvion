# RESOLUTION — 12_05_01 (최종 incremental 리뷰, prod-fail-closed-guards)

리뷰 세션: `review/code/2026/06/11/12_05_01/` (fix 커밋 `8ae64c58` 스코프, router 선별 7명).
위험도 **LOW · Critical 0 · Warning 0 · INFO 12**. 리뷰는 위험도 LOW + 0 Critical/Warning 으로
**자동 resolved** — 본 RESOLUTION 은 INFO 처분과 다세션 체인 기록용.

## 리뷰 체인 (본 PR 의 review 이력)

| 세션 | 스코프 | 결과 | 처리 |
| --- | --- | --- | --- |
| 10_52_27 | 전체 branch (router 선별 3명) | LOW · W3 | RESOLUTION 수용 (설계/형식) |
| 11_25_15 | 전체 branch (router 실패 → fallback-all 14명) | MEDIUM · W10 | resolution-applier: W3/W7+INFO 코드 fix(`640fba79`), 나머지 수용/draft 위임 |
| 11_53_22 | fix 커밋(`640fba79`) | LOW · W2 | W2(테스트 fragility)+INFO 코드 fix(`8ae64c58`) |
| **12_05_01** | fix 커밋(`8ae64c58`) | **LOW · W0** | 본 RESOLUTION — INFO 전부 수용/후속 |

## 조치 항목 (Warning 0 — INFO 처분)

| INFO # | 분류 | 처리 | 근거 |
| --- | --- | --- | --- |
| 1 | SPEC-DRIFT | spec draft 추가 | `1-auth.md §"Production fail-closed 가드"` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 누락. 코드 유지(올바름), spec 갱신은 planner — `plan/in-progress/spec-fix-prod-guards-prose.md` 에 항목 추가. |
| 2 | Testing | 수용(후속) | `MIN_JWT_SECRET_LENGTH` 경계값(31/32) 테스트 — 현 32자/24자 케이스로 양방향 분기 커버됨. 정확한 경계 핀고정은 가치 있으나 LOW, 후속. |
| 3 | Testing | 수용(설계) | `beforeAll` 미할당 시 `undefined` — `readFileSync` 실패는 Jest 가 beforeAll 실패로 처리해 해당 describe 만 fail. definite assignment(`!`)는 표현 개선 선택. |
| 4 | Testing | 수용(후속) | `beforeAll` I/O 실패 진단 메시지 — `.env.example` 은 repo 고정 자산, 실패 가능성 낮음. 후속. |
| 5,9 | Testing/Doc | 수용(후속) | stub 모드 Set-sync 불필요 이유 주석·docblock 보완 — 선택. stub 은 `isFlagOn` 논리로 처리(Set 블랙리스트 아님)라 동기화 대상 아님. |
| 6 | Testing | 수용(중복) | `OAUTH_STUB_MODE='false'` pass — 이미 다수 케이스가 stub off 기본 경로를 통과시킴. |
| 7,8 | Doc | 수용(후속) | README **환경변수 목록**(주의 callout 아님)에 stub·MCP 항목 추가 — callout 은 이미 정확. 목록 보완은 선택. |
| 10 | Doc | 수용(후속) | `jwt.config.ts` 모듈 JSDoc — 별 파일(본 PR 미수정), 후속. |
| 11 | Security | 수용(차단됨) | `jwt.config.ts` dev fallback 평문 리터럴 — `INSECURE_JWT_SECRETS` 등재로 production 차단(테스트로 검증). 실질 위험 없음. |
| 12 | Testing | 수용(안전) | `process.env` try/finally 복원 — Jest 파일 내부 직렬 실행이라 안전. |

## TEST 결과

- **lint**: 통과
- **unit**: 통과 (backend 6547 passed — fix 커밋 후)
- **build**: 통과 (`nest build`)
- **e2e**: 통과 (dockerized, 188 — NODE_ENV=test 라 가드 미발동·정상 부팅)

## 보류·후속 항목

- **spec 갱신 (INFO-1 SPEC-DRIFT + 11_25_15 의 W5/W8/W9/W10)**: `plan/in-progress/spec-fix-prod-guards-prose.md` — project-planner 별 PR.
- **테스트/문서 INFO (경계값·README 목록·jwt.config JSDoc 등)**: LOW 선택 항목. 별 정비 시 일괄.
- **INTEGRATION_ENCRYPTION_KEY production 검증** (11_53_22 W1): 기존 로직·본 PR 범위 외 — 별도 보안 이슈로 추적.
