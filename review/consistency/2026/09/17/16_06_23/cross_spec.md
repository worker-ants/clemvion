# Cross-Spec 일관성 검토 — 창 1 실측 결과를 spec 에 반영 (draft)

## 검토 방법

번들이 `spec_impact` 두 문서 본문 대부분과 인접 112개 spec 파일을 컨텍스트 예산 초과로
생략했으므로, orchestrator 노트에 따라 대상 spec 본문·근거 코드를 절대경로로 직접 `Read`/`grep`
했다:

- `spec/2-navigation/2-trigger-list.md` (전체 — §3 「동시 쓰기 직렬화」 블록, §4.3 cascade 표 포함)
- `spec/5-system/15-chat-channel.md` §5.4 / §5.4.1 / §5.4.1.1 / §5.4.1.2 / §5.5
- `spec/5-system/3-error-handling.md` §1.1·§1.10·§1.11·§1.12 (에러 코드 카탈로그)
- `spec/5-system/2-api-convention.md` §5.3 (상태코드별 기본값 표)
- `spec/5-system/14-external-interaction-api.md` (EIA-AU-07 행, `notification_secret_v2` 서술)
- `spec/1-data-model.md` (`last_triggered_at`/`notification_secret_v2` 컬럼 정의)
- `spec/data-flow/15-external-interaction.md` (revoke-token 시퀀스)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`m.save(Trigger, { id, ...patch })`,
  `rotateBotToken`/`revokePerTriggerToken` 의 `throwTriggerNotFound()` 호출부, `findById` 현재 줄번호)
- `codebase/backend/src/common/filters/http-exception.filter.ts` + 관련 spec (`23505` 만 409 매핑,
  `23502`/`23503` 은 500 폴스루)
- `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` (23503/23502 롤백 단언)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (draft 가 닫으려는 트래커 항목 원문)

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 카탈로그 상 신규 코드 없음 — 확인만
  - target 위치: A3 (§3 ⚠️ 교체), B (chat-channel §5.4 404 행)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.1(시스템 에러)·§1.12(Chat Channel 회전 에러 카탈로그), `spec/5-system/2-api-convention.md` §5.3(상태코드별 기본값)
  - 상세: target 은 CASCADE 창 실패가 "일반 500 `INTERNAL_ERROR`" 로 나간다고 서술한다. §5.3 은 `5xx=INTERNAL_ERROR` 를 기본값으로, `404=RESOURCE_NOT_FOUND` 도 기본값으로 이미 선언해 두었고, §1.12 Chat Channel 회전 에러 카탈로그에도 이 두 코드는 override 대상이 아니라서 별도 행이 없다(카탈로그 등재 의무는 override 코드에만 걸린다 — §error-handling.md 서두). target 이 새 코드를 신설하지도, 카탈로그 정합을 깨지도 않는다. `workspace-context.util.ts` 의 기존 주석("22P02 → 500 INTERNAL_ERROR 로 마스킹")과 같은 패턴이라 선례와도 일치.
  - 제안: 조치 불필요. 다음에 이 CASCADE 500 을 전용 코드(404/409)로 승격하기로 결정하면(target 의 Rationale 이 이미 "별 결정" 이라 적어 둠) 그때 §1.1/§1.12 카탈로그 등재가 함께 필요해진다는 점만 후속 항목에 기록해 두면 된다.

- **[INFO]** `revoke-token` 쪽 에러 표 부재는 target 의 주장대로 사실 — 신설 안 하는 판단도 근거 있음
  - target 위치: 「(a) «0행이면 404» 는 rotate-bot-token 한 곳이 아니다」 절, Rationale 「revoke-token 쪽에 에러 표를 만들지 않은 이유」
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` EIA-AU-07 행, `spec/data-flow/15-external-interaction.md` §1.1
  - 상세: 두 문서 모두 `POST /api/triggers/:id/interaction/revoke-token` 을 요구사항/시퀀스 수준으로만 서술하고 전용 에러 응답 표가 없음을 grep 으로 확인했다(EIA-AU-07 행은 요구사항 텍스트 한 줄, data-flow 문서는 시퀀스 다이어그램). target 이 §3 괄호 한 곳에만 두 endpoint 를 병기하고 EIA 쪽에 새 표를 만들지 않기로 한 판단은 기존 문서 상태와 모순되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 필드명 표기(camelCase vs snake_case)는 기존 관례와 일치
  - target 위치: A3 ⚠️ 교체 문단의 `notificationSecretV2`, `lastTriggeredAt`
  - 충돌 대상: `spec/1-data-model.md §2.8`(`notification_secret_v2`, `last_triggered_at` DB 컬럼), `spec/5-system/12-webhook.md`(`lastTriggeredAt` API/엔티티 표기)
  - 상세: target 은 API/엔티티 레벨 camelCase 를 썼고, 데이터 모델 문서의 DB 컬럼 snake_case 와는 표기만 다를 뿐 동일 필드를 가리킨다. `2-trigger-list.md` §2.3.1 자신도 이미 "API 응답 시 camelCase, DB 컬럼은 snake_case" 규약을 명시하고 있어 target 의 표기는 그 규약을 따른 것이다.
  - 제안: 조치 불필요.

## 교차 검증한 코드 사실 (모두 target 서술과 일치)

- `triggers.service.ts:711` — `const written = await m.save(Trigger, { id: target.id, ...patch });` (부분 객체 저장, target 전제 1 의 근거와 일치)
- `triggers.service.ts:408` — `async findById(...)`. target 이 지적한 대로 `:122` 는 낡은 줄 번호(발견 (b))이며 target 은 이미 심볼만 남기기로 수정안을 냄
- `triggers.service.ts:1391` (`rotateBotToken`) / `:1204` (`revokePerTriggerToken`) — 둘 다 `rewriteTriggerConfigLocked` 의 `false` 를 `this.throwTriggerNotFound()` 로 승격 (발견 (a) 의 "둘" 주장과 일치)
- `http-exception.filter.ts` + `pg-error.ts`/`http-exception.filter.spec.ts` — `23505` 만 409 매핑, `23502`(not-null)/그 외는 500 `INTERNAL_ERROR` 로 폴스루 (target 의 "500 은 계약이 아니라 매핑 부재의 기본값" 서술과 일치)
- `trigger-update-save-window.e2e-spec.ts` — `23503`(통째 save)/`23502`(부분 객체 save) 롤백·부활 없음 단언 존재, 컬럼 보존 단언 존재 (target 의 e2e 등재 사유와 일치)

## 요약

target 은 신규 엔티티·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임을 새로 도입하지 않고,
이미 구현·테스트된 동작(부분 객체 `save`, CASCADE 창의 500 폴스루, `rotate-bot-token`·
`revoke-token` 두 곳의 0행→404)을 두 spec 문서(`2-trigger-list.md` §3, `15-chat-channel.md`
§5.4)에 사실대로 반영하는 좁은 범위의 문서 정정이다. 두 대상 문서의 현재 문면, 인접 카탈로그
문서(`3-error-handling.md`, `2-api-convention.md`, `14-external-interaction-api.md`), 그리고
근거 코드(`triggers.service.ts`, `http-exception.filter.ts`, e2e 스펙)를 직접 대조한 결과 어떤
모순도 발견하지 못했다 — 500 은 이미 §5.3 이 정의한 기본값 매핑이라 새 카탈로그 등재가
필요하지 않고, `revoke-token` 쪽에 에러 표를 만들지 않기로 한 판단도 EIA/data-flow 문서의
현재 상태와 부합한다. 유일한 잠재 미래 이슈(CASCADE 500 을 전용 코드로 승격할 경우 카탈로그
등재가 필요해진다는 점)는 target 스스로 "별 결정" 으로 유예해 두었고 이번 draft 의 범위 밖이다.

## 위험도

NONE
