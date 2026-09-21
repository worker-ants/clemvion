# Cross-Spec 일관성 검토 — `spec/5-system` (--impl-prep)

## 검토 전제

이번 target 은 신규/수정 draft 가 아니라 `spec/5-system` 디렉터리 전체(기존 merge 된 SoT)다.
연결된 작업(`plan/in-progress/race-helper-guard-tests.md`)은 `spec_impact: none` 이며, 직전
9개 커밋(`raceUnderHeldLock()` 도입 및 audit 중복 기록 수정 시리즈, #1369~#1377)도 `spec/**`
diff 가 0줄이었다(`git diff --stat` 확인). 즉 이번 호출은 **spec 변경을 검증하는 것이 아니라,
착수 예정 코드 변경(백엔드 test harness, `codebase/backend/**`)이 딛고 설 `spec/5-system` 자체가
다른 영역과 이미 충돌하고 있지 않은지 확인하는 baseline 게이트**다.

## 검토 범위와 한계

prompt 번들이 컨텍스트 예산 초과로 `spec/5-system/1-auth.md`·`2-api-convention.md`·
`3-error-handling.md` 세 파일만 전문을 포함했고, 나머지 15개 파일(4-execution-engine·
6-websocket-protocol·14-external-interaction-api 등)은 절단됐다. 이는 이미 알려진 반복
이슈([`feedback_consistency_spec_mode_budget`] 계열)다. 절단된 파일은 저장소에서 직접 열어
교차 확인했으나, 본 보고서의 "발견사항 없음" 판정은 **전문이 확보된 3개 파일 + 직접 grep/Read
로 확인한 교차 참조 범위**에 한정된다 — 절단된 15개 파일 내부의 상호 모순까지 전수 검증한
것은 아니다.

## 확인한 교차 참조 (모두 정합)

- **User 데이터 모델** — `1-auth.md` §1.1/§1.4 가 서술하는 `password_hash`(nullable)·
  `two_factor_enabled`·`totp_recovery_codes`·`webauthn_recovery_codes`·
  `email_verify_token`/`password_reset_token`/`email_change_token`(SHA-256 해시 저장) 은
  `spec/1-data-model.md` §2.1 User 표와 필드명·의미·nullable 여부가 모두 일치.
  §2.1.1 의 "응답 노출 금지 7컬럼" 목록도 `1-auth.md` 서술과 상충 없음.
- **RBAC 매트릭스 (§3.2)** — Model Config `Editor=CRUD`/Auth Config `Editor=R` 분리가
  `spec/2-navigation/6-config.md` (Auth Config 변경 버튼 Admin+ 전용, Model Config
  mutation Editor+) 와 방향·근거 모두 일치. System Status 전역 R 은
  `spec/5-system/16-system-status-api.md §4` 참조와 부합.
- **에러 코드 카탈로그** — `1-auth.md` 가 발행하는 `REAUTH_NOT_AVAILABLE`·`REAUTH_REQUIRED`·
  `PASSWORD_INVALID`·`PASSWORD_REQUIRED`·`TOTP_INVALID`·`WEBAUTHN_INVALID`·
  `WORKSPACE_ID_REQUIRED` 는 `3-error-handling.md` §1.2.1/§1.3 공용 카탈로그에 전부 등재되어
  있고 status code·발행처(`verifyReauth`/`verifyPasswordForUser`/`changePassword`)까지
  동일하게 교차 기술됨. `INVALID_PASSWORD` 은퇴 이력도 양쪽에서 일치.
- **감사 액션 카탈로그** — `1-auth.md` §4.1 이 나열하는 `auth_config.*`·`model_config.*`·
  `user.*`·`member.*` 액션은 `conventions/audit-actions.md`/`data-flow/1-audit.md` 와
  구현 SoT(`audit-action.const.ts`)를 일관되게 포인터로 참조하며 새 액션명 도입 없음.
  최근 병합된 동시-삭제 중복 기록 수정 시리즈(#1369~#1377)는 "액션이 정확히 한 번
  기록된다" 는 구현 디테일만 바꾼 것이라, 액션 카탈로그·이름 자체엔 영향이 없고
  spec 어디에도 "동시 삭제 시 중복 가능" 같은 상충 서술이 없음(grep 결과 0건) — spec
  본문을 갱신할 필요가 있는 종류의 변경이 아니었다는 `spec_impact: none` 판단과 부합.
- **테스트 하네스 배치** — 착수 예정 작업은 `codebase/backend/test/helpers/*.spec.ts` +
  `jest.config.ts` `roots` 조정이며, `spec/conventions/**` 에는 테스트 러너 설정을 규율하는
  문서가 없다(grep 0건) — 이는 애초에 spec 소관이 아니므로 계층 책임 충돌 아님.

## 발견사항

없음. CRITICAL/WARNING 급 cross-spec 모순을 찾지 못했다.

- **[INFO]** 컨텍스트 예산 절단으로 인한 부분 커버리지
  - target 위치: 번들 조립 메타(`### ⚠️ 컨텍스트 예산 초과로 생략된 파일 15개`)
  - 충돌 대상: 해당 없음 (충돌이 아니라 검토 커버리지 한계)
  - 상세: `spec/5-system` 18개 파일 중 15개(전체 크기 상위 파일들, 예: `4-execution-engine.md` 227,815자)가 본 프롬프트에서 절단되어 이번 호출만으로는 그 파일들 간 상호 모순 여부를 전수 확인하지 못한다. 이번 작업(`race-helper-guard-tests`)은 `codebase/backend/test/**` 만 건드리는 harness 변경이라 실질 위험은 낮지만, 이 스코프 자체가 `spec/5-system` 전체이므로 커버리지 갭을 기록해 둔다.
  - 제안: 이번 작업 자체에 대한 조치는 불요(spec_impact: none, 코드 변경도 테스트 전용). 다만 이 소스 문서군(특히 execution-engine·external-interaction-api 처럼 자주 걸리는 대형 파일)을 대상으로 한 향후 `--spec` 모드 호출에서는 청크 분할 재실행을 권고.

## 요약

이번 target 은 draft 가 아니라 `spec/5-system` 기존 SoT 전체이며, 연결된 작업은 spec 변경이 없는 test-harness 전용 변경(spec_impact: none)이다. 전문이 확보된 3개 핵심 파일(인증·API 규약·에러 처리)과 그것이 참조하는 데이터 모델·RBAC·에러 코드·감사 액션 카탈로그를 교차 확인한 결과 CRITICAL/WARNING 급 모순은 없었고, 기존 문서 자체가 이미 다수의 Rationale 절로 잠재 충돌을 명시적으로 해소해 둔 상태였다. 유일한 기록 사항은 컨텍스트 예산으로 15개 파일이 절단되어 전수 검증은 아니라는 커버리지 한계(INFO)다.

## 위험도

NONE
