# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-draft-webchat-execution-residuals.md`
검토 모드: spec draft 검토 (--spec)

## 검증 방법

target 이 신규 도입/재사용하는 식별자를 목록화한 뒤 실제 spec/codebase 코퍼스를 grep 으로 대조했다.

| 신규/재사용 식별자 | 종류 | 대조 결과 |
|---|---|---|
| `EIA-RL-07` | 요구사항 ID (신규) | `spec/5-system/14-external-interaction-api.md` §3.4 에 `EIA-RL-01`~`EIA-RL-06` 만 존재. `EIA-RL-07` 미사용 — 다음 빈 슬롯 맞음. 충돌 없음 |
| `error.code='CHANNEL_IDLE_TIMEOUT'` | 에러 코드 (신규) | 전체 `spec/`·`codebase/` grep 0건. 기존 `EXECUTION_QUEUE_WAIT_TIMEOUT`(§8 큐 대기)과만 이웃하며 문자열 자체는 겹치지 않음. 충돌 없음 |
| `cancelledBy='timeout'` | enum 값 (재사용, 확장 아님) | 기존 3값 union(`user`\|`system`\|`timeout`) 그대로 재사용 — C1 반영으로 신규 4번째 값 도입을 이미 철회함(review 이력 확인). 충돌 없음 |
| `EIA-AU-05` 앵커 `#33-인증` | 앵커 fix | `spec/5-system/14-external-interaction-api.md` 의 실제 섹션은 `### 3.3 인증`(line 85) → `#33-인증` 정확. 문서 본문(§B-2, line 119)도 이미 수정 반영됨. 충돌 없음 |
| `spec-draft-webchat-execution-residuals.md` | plan 파일명 | `plan/in-progress/` 내 유일. 동일 `spec-draft-*` prefix 기존 사례(`spec-draft-pr874-deferred-docs.md`)와 명명 컨벤션 일치. 충돌 없음 |
| widget-app.md 신규 `### R9.` | Rationale 섹션 번호 (신규) | 기존 최대 번호는 `R8`(line 180, "presentation 렌더"). `R9` 미사용 — target 의 "R8 까지 사용 중 — 번호 충돌 없음" 주장과 grep 결과 일치. 충돌 없음 |
| `POST /api/external/executions/:executionId/cancel` (§5.4) | API endpoint (재사용, 신규 아님) | `spec/5-system/14-external-interaction-api.md` §5.4(line 482)·EIA-IN-05(line 75)에 이미 정의된 기존 endpoint. target 은 신규 endpoint 를 만들지 않고 이를 재사용 — 정합. 충돌 없음 |
| `execution_token.exp_at`, `revokeAllForExecution`, `auth_config_id IS NULL` | 필드/함수명 (재사용) | `spec/1-data-model.md` §2.8 Trigger, `spec/5-system/14-external-interaction-api.md` §7.3/§9.3 의 기존 스키마·함수명과 정확히 일치. 충돌 없음 |
| 새 요구사항 ID 경쟁(동시 slot 선점) | 병렬 세션 충돌 | `plan/in-progress/*.md` 전체에서 `EIA-RL-0[7-9]`·`widget-app.*R9` 재검색 — target 문서 자신 외 참조 0건. `git log` 상 `14-external-interaction-api.md`/`1-widget-app.md` 최근 커밋(#914·#909·#904·#901·#899)도 본 작업과 무관. 경쟁 없음 |

## 발견사항

- **[INFO]** auth-session.md 편집 대상 앵커가 이중 후보로만 지정됨
  - target 신규 식별자: 변경안 (6) `spec/7-channel-web-chat/3-auth-session.md` — "**§3.1 '토큰 만료/서버 타임아웃' 행**(또는 §R6)"
  - 기존 사용처: `spec/7-channel-web-chat/3-auth-session.md` §3.1(line 60, "재로드 복원 시퀀스")·§R6(line 109, "토큰 저장 — sessionStorage")
  - 상세: 현재 §3.1 에는 "토큰 만료/서버 타임아웃" 이라는 이름의 행/표가 존재하지 않는다(§3.1 은 번호 목록 시퀀스이지 표가 아님). §R6 은 이미 "토큰 저장소 선택 근거"라는 확립된 주제를 가진 기존 Rationale 섹션이다. 두 후보 중 어느 쪽도 신규 식별자를 만들지는 않으므로 CRITICAL/WARNING 성격의 "충돌"은 아니지만, 실제 편집 시 §R6 에 무관한 내용(B-2 backstop cross-ref)을 얹으면 R6 의 기존 주제 범위가 흐려질 수 있다.
  - 제안: 편집 시 §R6 본문에 이질적 문단을 추가하기보다 §3.1 시퀀스의 8번(종료/완료) 또는 §3.1-3 storage 정리 문단 인접에 1줄 cross-ref 로 두는 쪽이 기존 R6 주제 경계를 보존한다. (식별자 충돌 자체는 없음 — spec 정확성 검토 관점에서 별도 확인 권장.)

- **[INFO]** 신규 backstop 스케줄러의 env/서비스명 미확정
  - target 신규 식별자: B-2 "grace window(env, 예: 토큰 exp 이후 추가 N — 기본값은 developer 가 결정)" / 주기 scheduled job 명 미지정
  - 기존 사용처: `codebase/backend/.env.example` 의 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, `spec/5-system/14-external-interaction-api.md` 의 `terminal-revoke-reconciler.service.ts`(EIA-RL-06 sweep, 별도 목적)
  - 상세: target 은 구체적 env var 명·서비스 클래스명을 아직 확정하지 않고 developer 위임으로 남겼다. 현재 시점엔 충돌 대상이 없으나, 기존 `EXECUTION_*_MS` / `*-reconciler.service.ts` 명명 패턴과 겹치지 않는 이름(예: `CHANNEL_IDLE_GRACE_MS`, `channel-idle-reaper.service.ts` 류)을 developer 세션에 명시적으로 권고할 필요가 있다 — 특히 `terminal-revoke-reconciler`(EIA-RL-06, 토큰 revoke sweep)와 신규 idle-wait reaper(EIA-RL-07, execution cancel sweep)는 목적이 다른 별개 스케줄러이므로 이름이 혼동되지 않게 구분해야 한다.
  - 제안: developer 위임 메모에 "기존 `terminal-revoke-reconciler.service.ts` 와 구분되는 새 서비스 파일/클래스명을 쓸 것" 을 1줄 명시하면 향후 실제 구현 단계에서의 명명 혼동을 예방할 수 있다.

## 요약

target 문서가 신규로 도입하는 식별자(`EIA-RL-07` 요구사항 ID, `error.code='CHANNEL_IDLE_TIMEOUT'`, widget-app `### R9.` Rationale 섹션, 파일명 `spec-draft-webchat-execution-residuals.md`)는 모두 실제 spec 코퍼스 grep 대조 결과 기존 사용처와 충돌하지 않으며, 이미 직전 consistency-check(16_45_01, I1·I2)에서 슬롯 lock·앵커 정정까지 반영된 상태다. 재사용 식별자(`cancelledBy='timeout'`, EIA §5.4 cancel endpoint, `execution_token.exp_at`, `revokeAllForExecution`, `auth_config_id`)도 기존 정의와 정확히 일치해 의미 왜곡 없이 재사용되고 있다. 유일한 잔여 사항은 CRITICAL/WARNING 급이 아닌 INFO 2건 — auth-session.md 편집 대상 앵커의 이중 후보 표기(§3.1 vs §R6, 신규 식별자 생성은 아님)와, 아직 미확정인 backstop env/서비스명이 향후 구현 단계에서 기존 명명 패턴과 혼동되지 않도록 하는 사전 권고다.

## 위험도

LOW
