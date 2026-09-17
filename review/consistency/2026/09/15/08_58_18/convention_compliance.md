# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep)

## 점검 개요

- **검토 모드**: 구현 착수 전 검토 (`--impl-prep`, scope=`spec/5-system/`)
- **대상 PR 맥락**: `plan/in-progress/trigger-lock-followups.md` — `codebase/backend` 의 트리거 락
  관련 5건(이름·JSDoc·검증·계약·테스트) 정리. **`spec_impact: none`** — spec 변경 계획 없음.
- **번들 상태**: prompt 번들이 컨텍스트 예산으로 `spec/5-system/` 18개 중 15개(`4-execution-engine.md`
  등 대용량 파일)와 `spec/conventions/` 27개 중 다수를 절단했다(`⚠️ 본문 생략됨` 마커). 완전히
  포함된 것은 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`audit-actions.md` 뿐이다.
  절단된 파일 중 규약 관련성이 높은 `spec/conventions/error-codes.md`·`swagger.md`·`redis-keys.md`
  와 `spec/5-system/4-execution-engine.md` 의 advisory-lock 관련 절은 `Read` 도구로 저장소에서
  직접 열어 교차 확인했다.

## 확인 절차

1. 완전 포함된 3개 spec 문서(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)와
   `audit-actions.md` 전문을 읽고 `## Overview` / 본문 / `## Rationale` 3섹션 구조·명명 규약·
   출력 포맷 규약 준수 여부를 확인했다.
2. 이번 PR 이 이름을 바꾸려는 식별자(`findByIdForUpdate`, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`,
   `acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`)가 `spec/` 어디에서도 참조되지
   않음을 `grep -rn` 으로 확인했다(0건) — spec 쪽 drift 위험이 없다는 `spec_impact: none` 주장과
   일치한다.
3. 트리거 관련 advisory lock 패턴이 스스로 신규 발명인지 확인하기 위해 `4-execution-engine.md`
   에서 기존 `pg_advisory_xact_lock` 선례(§8 admission gate, per-workspace 직렬화)를 확인했다 —
   이번 PR 이 쓰는 DB-level advisory lock 과 같은 계열의 기존 패턴이다. `redis-keys.md` 는 Redis
   키 규약만 다루므로 이 잠금(Postgres advisory lock)에는 애초에 적용 대상이 아니다(오적용 없음).
4. 에러 코드(`error-codes.md` §1~§5)·감사 액션(`audit-actions.md` §1~§3)·Swagger DTO/데코레이터
   패턴(`swagger.md` §1~§6) 을 직접 읽고, 트리거 도메인 관련 항목(`1.9`~`1.11` 트리거 에러 코드,
   trigger 감사 액션 3종, `TRIGGER_ENDPOINT_PATH_CONFLICT` details 형태)이 각 규약과 정합함을
   확인했다.

## 발견사항

이번 패스에서 CRITICAL/WARNING 급 위반은 발견하지 못했다. 아래는 INFO 성격의 관찰이다.

- **[INFO]** 번들 절단으로 인한 검증 커버리지 한계
  - target 위치: 번들 전체(`spec/5-system/4-execution-engine.md` 등 15개 파일,
    `spec/conventions/*.md` 다수)
  - 위반 규약: 해당 없음 (프로세스 관찰)
  - 상세: 이 특정 호출의 prompt 번들은 컨텍스트 예산 때문에 `spec/5-system/` 18개 중 15개와
    `spec/conventions/` 다수를 `⚠️ 본문 생략됨` 으로 절단했다. 이 리뷰는 `Read` 로 규약
    관련성이 높은 일부(`error-codes.md`·`swagger.md`·`redis-keys.md`, `4-execution-engine.md`
    의 advisory-lock 절)를 직접 열어 보완했지만, 나머지 절단분(예: `6-websocket-protocol.md`·
    `14-external-interaction-api.md`·`chat-channel-adapter.md` 전문)까지 전수 대조하지는
    못했다. 이번 PR 이 `spec_impact: none` 이고 관련 식별자가 spec 어디에도 없음을 확인했으므로
    본 PR 자체의 위험은 낮다고 판단하지만, 이 사실을 "해당 영역에 위반이 없다"의 근거로 삼지는
    않는다.
  - 제안: 이 gap 은 이미 알려진 이슈다(운영 메모 `feedback_consistency_spec_mode_budget.md`).
    `spec/5-system/` 전역에 대한 완전한 규약 준수 감사가 필요하면 파일 단위로 쪼개
    `--impl-prep` 을 재실행하거나 `/spec-coverage` 로 보완하는 편이 낫다.

- **[INFO]** advisory lock 패턴의 spec 미문서화 (drift 아님, 참고용)
  - target 위치: 해당 없음 — `codebase/backend/src/modules/triggers/triggers.service.ts` 등
    (spec 밖)
  - 위반 규약: 해당 없음
  - 상세: 이번 PR 이 다루는 `acquireTriggerConfigLock`/`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는
    트리거 행 삭제/갱신 시 Postgres advisory lock 을 쓰는 구현 세부이며, `spec/5-system/` 어디
    에도 이름으로 등장하지 않는다. `plan/in-progress/trigger-lock-followups.md` 가 명시한 대로
    `spec_impact: none` 이고 순수 코드 정리(이름·JSDoc·방어 심도·테스트)라 spec 갱신 의무가
    발생하지 않는다 — CLAUDE.md 의 "spec 변경 → project-planner" 규칙 위반이 아니다. 다만
    `4-execution-engine.md §8` 이 이미 같은 계열의 `pg_advisory_xact_lock` 패턴(워크스페이스
    admission gate)을 문서화해 둔 선례가 있으므로, 향후 트리거 락에 **spec 문서화가 필요해지는
    시점**(예: 동시 PATCH 경쟁이 사용자 가시적 계약이 되는 경우)이 오면 그 선례의 서술 형태를
    참고할 수 있다는 점만 남긴다.
  - 제안: 조치 불요 — 정보성 기록.

- **[INFO]** 트리거 도메인 규약 정합 확인 (positive finding)
  - target 위치: `spec/5-system/3-error-handling.md` §1.9~§1.11(트리거 에러 코드) ·
    `spec/conventions/audit-actions.md` §3(trigger 행)
  - 위반 규약: 없음 — 정합 확인
  - 상세: 트리거 에러 코드 3종(`TRIGGER_ENDPOINT_PATH_CONFLICT`, `AUTH_CONFIG_NOT_FOUND` 등)은
    모두 `UPPER_SNAKE_CASE`(`error-codes.md §1`)를 따르고, `details[].code` 사용 시 "field 를
    실으면 code 도 싣는다"(2026-09-11 규약)를 만족한다. 트리거 감사 액션(`created`/`updated`/
    `deleted`, `notification_secret_rotated`/`chat_channel_bot_token_rotated`/
    `interaction_token_revoked`)은 `audit-actions.md` §2.1 과거분사 패턴 + §1 언더스코어 토큰
    규칙을 만족한다.
  - 제안: 조치 불요.

## 요약

완전히 로드된 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 와
`spec/conventions/audit-actions.md` 는 모두 `## Overview` / 본문 / `## Rationale` 3섹션 구조를
갖추고 있고, 에러 코드 명명(`UPPER_SNAKE_CASE` + historical-artifact 예외 레지스트리 등재)·
감사 액션 시제 분류·Swagger DTO/응답 wrapping 패턴이 `spec/conventions/**` 와 정합했다. 이번
developer 작업(`trigger-lock-followups`)이 손대는 코드 식별자는 `spec/` 어디에도 참조되지
않아 spec-코드 drift 위험이 없고, PR 의 `spec_impact: none` 선언과 일치한다. 다만 이번 호출의
prompt 번들이 컨텍스트 예산으로 `spec/5-system/` 대부분과 다수 conventions 파일을 절단했으므로,
그 절단분에 대한 전수 규약 준수는 이번 패스로 확정되지 않았다(직접 `Read` 로 보완한 일부만
확인). CRITICAL/WARNING 급 위반은 발견되지 않았다.

## 위험도

LOW
