# 신규 식별자 충돌 검토 — `spec/5-system` (--impl-prep)

## 사전 확인 — target 에 실제로 "신규" 식별자가 있는가

이번 호출의 실제 작업 범위(`plan/in-progress/race-helper-guard-tests.md`)는
`test/helpers/concurrency.spec.ts` 신설 + jest 설정(`roots` 추가) 뿐이며, 계획서 자체가
"프로덕션 코드 변경 0"·"`spec/5-system` 무관"을 명시한다. 실제로:

- `git diff origin/main...HEAD --stat -- spec/` → **0줄** (이 브랜치에서 `spec/` 변경 없음)
- `git status --short` → `review/consistency/**` 산출물 외 변경 없음

즉 target 으로 번들된 `spec/5-system/*.md` 는 이 작업이 "새로 도입"하는 문서가 아니라
**이미 main 에 존재하는, 대부분 `status: partial`+`code:` 매핑까지 걸린 기존 spec**이다.
아래는 그 전제 위에서, 번들에 포함된 본문(1-auth.md·2-api-convention.md·3-error-handling.md;
나머지 15개 파일은 컨텍스트 예산 초과로 절단됨)에서 식별 가능한 대표 식별자들을 실제
코드베이스·타 spec 사용처와 교차 검증한 결과다.

## 발견사항

교차 검증한 후보 전부 **충돌 없음** — 기존 사용처와 의미가 일치하거나, 표면별 이형(異形)이
스펙 안에서 이미 "의도적 분리"로 명문화되어 있었다.

- **[INFO]** `EXECUTION_QUEUE_WAIT_TIMEOUT` (에러 코드) vs `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` (env var)
  - target 신규 식별자: 없음 — 둘 다 기존 식별자
  - 기존 사용처: `spec/5-system/3-error-handling.md:149`(에러 코드) · `codebase/backend/src/modules/execution-engine/execution-limits.ts:82,92`(env var) · `codebase/backend/src/nodes/core/error-codes.ts:159`
  - 상세: 접두어가 완전히 같고 `_MS` 접미사만 다른 두 식별자가 서로 다른 역할(에러 코드 vs 타임아웃 설정값)을 가진다. 다만 `CODE_MEMORY_LIMIT`/`CODE_NODE_MEMORY_LIMIT_MB` 에서도 같은 명명 패턴(에러 코드 base + `_MB`/`_MS` 접미사로 관련 env var 파생)이 이미 쓰이고 있어, **이 저장소의 기존 컨벤션**이다. 충돌이 아니라 일관된 패턴.
  - 제안: 없음(현행 유지). 신규 유사 쌍을 추가할 때만 이 패턴을 따르라는 점을 규약 문서에 참고용으로 남길 수 있음.

- **[INFO]** `INVALID_STATE`(REST core, 422) / `INVALID_EXECUTION_STATE`(WS, 4-execution-engine·6-websocket-protocol) / `STATE_MISMATCH`(EIA REST, 409) — 동일 의미의 표면별 이형 3종
  - target 신규 식별자: 없음 — 세 코드 모두 기존 spec 에 이미 등재
  - 기존 사용처: `spec/5-system/3-error-handling.md:1669,1681,1750,1760`
  - 상세: "요구사항 ID/코드가 다른 의미로 재사용되는가" 관점에서 처음엔 의심되었으나, 문서가 `1681`·`1750`·`1760` 세 곳에서 "표면별 routing 분기 가시성을 위한 **의도적** 분리"라고 명시적으로 근거를 남겨 두었다. 새 충돌이 아니라 기존에 이미 검토·확정된 설계.
  - 제안: 없음.

- **[INFO]** `REAUTH_NOT_AVAILABLE` / `emailChangeToken` / `verifyReauth` (§1.1.B 이메일 변경 흐름)
  - target 신규 식별자: 없음(이미 구현·테스트·감사로그 소비처까지 존재)
  - 기존 사용처: `codebase/backend/src/modules/auth/sessions.service.ts:220-260`, `codebase/backend/src/modules/auth/auth.service.ts:801,837-902`, `codebase/backend/src/modules/users/dto/email-change-request.dto.ts:14`, `codebase/backend/src/modules/users/users.controller.ts:263,273`, `spec/2-navigation/9-user-profile.md:356`, `spec/data-flow/2-auth.md:203`, `spec/1-data-model.md:98`
  - 상세: 코드·spec·테스트 전 계층에서 동일 의미로 정합적으로 쓰이고 있다. 충돌 없음.
  - 제안: 없음.

컨텍스트 예산 초과로 절단된 15개 파일(`4-execution-engine.md` 외, 원문 최대 227,815자)은
본문을 열지 못했다 — 그 안에 이번에 실제로 새로 도입되는 식별자가 있다면 이 리포트에
반영되지 못했을 수 있다. 다만 위 "사전 확인"에서 확인했듯 이 작업의 diff 자체가
`spec/5-system` 을 전혀 건드리지 않으므로, 그 파일들에도 **target 이 새로 부여하는 식별자는
없다**(전부 기존 상태 그대로).

## 요약

이번 `--impl-prep spec/5-system` 호출의 실제 diff 범위는 `spec/5-system` 을 전혀 변경하지
않는 test-harness 전용 작업(`raceUnderHeldLock` 순수 함수 분기의 unit 테스트 추가)이라, "target
이 새로 도입하는 식별자"가 애초에 존재하지 않는다. 번들된 기존 spec 본문(가용한 3개 파일)에서
신규 식별자 충돌 관점으로 의심할 만한 후보(코드/env-var 접두어 중복, 표면별 동의어 코드)를
표본 교차 검증했으나 전부 이미 문서화된 의도적 설계이거나 코드베이스 전반과 정합했다. 신규
식별자 충돌 위험은 없다.

## 위험도
NONE
