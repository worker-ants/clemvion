# 보안(Security) 코드 리뷰

## 범위

트리거 삭제(트리거/스케줄/워크플로/워크스페이스 4경로) 시 secret_store 잔존 비밀·외부 자원(schedule job, chat-channel provider 등록, listener registry)이 정리되지 않던 결함을 고치는 PR. 새 협력 모듈 `trigger-resource-release.ts`(순수 함수, SoT)와 `TriggerResourceReleaserService`(DI 배선)가 4경로 + 5개 "락 밖 쓰기 vs 삭제" 경합 보상 지점에 배선된다. `codebase/backend/**` 17개 파일 + e2e 1개 + plan/review 문서 9개.

## 발견사항

- **[INFO]** 워크스페이스 삭제의 소유자 재검사에 좁은 TOCTOU 창
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `deleteWorkspace()`(권한 검사 후 `releaseExternalForParent` 호출) 및 `assertWorkspaceDeletable()`
  - 상세: `deleteWorkspace()`는 (1) 잠금 없이 `assertWorkspaceDeletable`로 선검사 → (2) 통과하면 `releaseExternalForParent`(provider teardown·schedule job 해제 등 되돌릴 수 없는 외부 부수효과)를 먼저 실행 → (3) 트랜잭션 안에서 `pessimistic_write`로 재검사. 요청자가 (1) 시점엔 owner였지만 (1)과 (3) 사이에 role이 바뀌면(예: 다른 관리자가 소유권을 이전) (3)이 던져 트랜잭션은 롤백되지만 (2)의 외부 자원(웹훅 등록 해제 등)은 이미 되돌릴 수 없이 실행된 뒤다. 결과적으로 트리거 행·비밀은 살아 있는데 provider 콜백·schedule job만 정지된 "반쯤 삭제된" 가용성 저하가 남을 수 있다. 코드 자체가 이 창을 "동시 역할 변경과 삭제가 겹치는 좁은 창"으로 이미 문서화하고 e2e로 403 케이스(선검사가 외부 해제보다 먼저임)는 검증했지만, "선검사 통과 → 역할 박탈 → 외부 해제 실행" 케이스 자체는 테스트 대상이 아니다.
  - 제안: 이미 인지·감수된 트레이드오프이고 영향이 가용성(외부 등록 해제)에 국한돼 기밀성·데이터 손실로 번지지 않으므로 즉시 조치는 불필요하나, 재발 방지를 원하면 (1)과 (2) 사이 창을 좁히거나(예: (1)도 `pessimistic_write` 없는 대신 매우 짧은 TTL 토큰으로 owner 확정), 최소한 이 창을 plan의 알려진 리스크 목록에 명시적으로 남겨두는 것을 권장.

- **[INFO]** 커밋 뒤 비밀 삭제 실패는 예외를 던지지 않고 로그로만 남음 — 고아 암호문 잔존 가능
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit()`
  - 상세: 설계상 의도된 트레이드오프(행 삭제가 이미 커밋됐으므로 500을 주면 클라이언트 재시도가 404가 되는 문제를 피함)이며 JSDoc·plan에 명시돼 있다. 다만 `secrets.deleteByPrefix` 실패가 반복/영구적이면(예: DB 연결 장애가 길게 지속) `secret_store`에 암호화된 비밀이 무기한 고아로 남고, 이를 감지하는 것은 `logger.error` 호출 뒤 사람이 로그를 보고 수동 정리하는 것에 전적으로 의존한다. 자동 sweeper/재시도 큐가 없다.
  - 제안: 이 PR의 스코프 밖이며 실제로 plan(`review/consistency/.../SUMMARY.md` WARNING #2)이 "사후 정리(sweeper) 필요 여부는 구현 뒤 재판단"을 이미 트래킹 대상으로 지적했다 — 그 후속 트래커 항목에서 알림/사후 정리(sweeper)를 검토할 것을 재확인.

- **[INFO]** 로그 메시지가 원본 오류의 `message`를 그대로 포함
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts` `describeError()` 사용 지점들(`deleteTriggerSecretsAfterCommit`, `undoAbsentTriggerWrite`), `TriggersService.remove()`/`SchedulesService.remove()`의 실패 로그
  - 상세: 하위 라이브러리(HTTP 클라이언트·provider SDK 등)의 오류 메시지를 그대로 로그에 남기는 기존 저장소 관례를 그대로 따른 것으로, 이 PR이 새로 도입한 패턴은 아니다(`TriggersService: teardownChannel 실패` 등 기존 로그와 동일 형태). `ChatChannelConfig`가 `botToken` 평문이 아니라 `botTokenRef`만 들고 다니므로(SUMMARY#26 이후) 이 흐름에서 로그로 평문 비밀이 흘러들어갈 새 경로는 확인되지 않았다.
  - 제안: 조치 불요(기존 관례 답습, 새 위험 없음). 다만 provider adapter(`teardownChannel` 구현체, 본 diff 범위 밖)가 하부 HTTP 오류 메시지에 요청 URL을 포함시키는 SDK를 쓴다면 그쪽에서 별도로 점검할 가치는 있음(이번 PR의 diff에는 해당 코드 없음).

## 긍정적으로 확인한 사항 (오탐 방지용 기록)

- `triggerSecretPrefix(triggerId)`로 조립하는 `secret://triggers/<id>/` prefix는 `Trigger.id`가 `@PrimaryGeneratedColumn('uuid')`라 사용자 입력이 섞이지 않고, 하부 `SecretResolverService.deleteByPrefix`(본 diff 밖, 기존 코드)가 `%`/`_`/`\` LIKE 메타문자를 이미 거부해 SQL 인젝션·과잉 삭제 경로 둘 다 막혀 있다.
- 모든 신규 DB 접근은 TypeORM `Repository`/`EntityManager`(파라미터 바인딩) 또는 `pg.Client.query(sql, params)`(플레이스홀더) 형태이며, e2e 신규 파일(`trigger-deletion-releases-resources.e2e-spec.ts`) 포함 문자열 결합 SQL은 없음.
- `WorkflowsService.remove`/`WorkspacesService.deleteWorkspace`가 `TRIGGER_RESOURCE_RELEASER`를 `ModuleRef.get(token, { strict: false })`로 못 찾으면 **던진다**(no-op으로 삼키지 않음) — 정리 협력자 배선이 깨졌을 때 비밀·외부 자원이 조용히 미정리 상태로 남는 것을 fail-closed로 막는 설계로, 보안적으로 바람직한 선택.
- 외부 자원 해제(`releaseExternalForParent`)는 워크스페이스 삭제 흐름에서 **권한 검사(비잠금) 통과 후에만** 실행되도록 순서가 잡혀 있고, 403 케이스는 e2e로 "권한 검사가 외부 해제보다 먼저"임을 검증함 — 미인가 요청이 provider 등록·schedule job을 먼저 뜯는 경로는 없음.
- `trigger-deletion-releases-resources.e2e-spec.ts`의 `DB_PASSWORD` 기본값(`'clemvion-e2e'`) 등은 이미 `app.e2e-spec.ts`·`trigger-update-save-window.e2e-spec.ts`에도 쓰이는 기존 로컬 e2e 전용 테스트 자격증명 패턴이며, 이 PR이 새로 도입한 하드코딩된 운영 시크릿이 아님.
- `triggers.service.spec.ts`의 `'xoxb-fake-token'`은 이 PR 이전부터 있던 테스트 픽스처 가짜 값이며 이 diff의 변경분(providers 배열에 `TriggerResourceReleaserService` 추가)과 무관.
- Trigger/Workflow/Workspace 삭제 경로 모두 `findById(id, workspaceId)` 형태로 워크스페이스 스코프를 먼저 검증한 뒤 정리 협력자를 호출해, 다른 워크스페이스의 트리거 자원을 정리 대상에 끌어들이는 IDOR류 경로는 확인되지 않음(대조군 트리거의 비밀이 남는 것을 검증하는 e2e도 함께 추가됨).

## 요약

이 PR은 보안적으로는 순수 리스크 추가가 아니라 오히려 **결함 수정**(CWE-459류: 트리거 삭제 시 secret_store에 남는 고아 암호화 비밀 및 미해제 외부 등록/BullMQ job)에 가깝다 — 기존에는 트리거 화면 직접 삭제만 비밀을 정리했고, 스케줄/워크플로/워크스페이스 삭제(FK CASCADE)는 비밀을 전혀 지우지 않았다. 새로 도입된 정리 경로는 파라미터 바인딩만 쓰고, 삭제 대상 접두(prefix) 조립은 UUID PK + 기존 LIKE 메타문자 거부 가드로 이중 방어되며, 정리 협력자를 못 찾으면 fail-closed(throw)로 설계돼 있다. 발견한 항목은 모두 INFO 등급으로 — (1) 워크스페이스 삭제의 아주 좁은 TOCTOU 창(가용성 영향만, 문서화·테스트로 이미 절반 커버), (2) 커밋 뒤 비밀 삭제 실패 시 자동 재시도가 없어 사람이 로그를 보고 수동 정리해야 하는 잔여 리스크(이미 plan에 sweeper 후속 트래커로 등재됨) — 신규 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화는 발견되지 않았다.

## 위험도

LOW
