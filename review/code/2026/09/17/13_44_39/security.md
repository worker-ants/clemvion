# 보안(Security) 코드 리뷰

## 검토 대상 요약

`TriggersService.update()` 의 창 1(advisory lock 안 재읽기 → 저장) 을, 재읽은 엔티티
전체를 `save` 하던 방식에서 **이번 요청이 바꾸는 필드만 담은 부분 객체**를 `save` 하는
방식으로 좁힌 변경이다. TypeORM `save` 는 저장 시점 DB 값과 **엔티티가 다른 컬럼만**
UPDATE 하므로, 통째 저장은 재읽기 이후 락 밖에서 커밋된 컬럼(`notification_secret_v2`
회전 상태, `chat_channel_token_v2` null-write, `last_triggered_at`, schedule 동기화의
`name`/`is_active`)을 옛 값으로 덮어썼다 — 이번 커밋이 고치는 자리다. 함께 `test/
trigger-update-save-window.e2e-spec.ts` (실제 Postgres+TypeORM 특성 테스트), 단위 테스트
갱신, plan/consistency 산출물이 포함됐다.

## 발견사항

- **[INFO]** e2e 테스트의 DB 비밀번호 fallback 은 기존 관행과 동일 — 신규 위험 아님
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:82` (`password: process.env.DB_PASSWORD ?? 'clemvion-e2e'`)
  - 상세: 하드코딩된 문자열이 소스에 있지만, 같은 패턴이 이미 `codebase/backend/test/helpers/db.ts:13`, `codebase/backend/test/app.e2e-spec.ts:46` 등 기존 e2e 스위트 전반에 존재하는 확립된 컨벤션이다(로컬 docker-compose e2e 전용 자격증명, 프로덕션 시크릿 아님). 이 PR 이 새로 도입한 패턴이 아니므로 신규 결함으로 등재하지 않는다 — 인지 목적의 INFO.
  - 제안: 조치 불요. (참고: 프로덕션 경로에는 영향 없음)

- **[INFO]** 이번 변경은 보안 성격의 lost-update 를 실제로 수정한다 — 회귀 방향 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:707-714` (`const written = await m.save(Trigger, { id: target.id, ...defined, config: mergedConfig });`)
  - 상세: 되돌아가던 컬럼 중 `notification_secret_v2`(`rotateNotificationSecret` 이 쓰는 24h grace 회전 상태)와 `chat_channel_token_v2`(cron 정리의 null-write)는 명백히 보안 성격이다 — 통째 저장이 이 컬럼들을 되돌리면 회전이 끝났어야 할 구 시크릿이 "여전히 유효"한 것처럼 되살아나거나, 정리됐어야 할 v2 토큰이 재노출될 잠재적 창이 있었다. 이번 부분 객체 `save` 로의 전환은 그 창을 닫는 방향이며, `trigger-update-save-window.e2e-spec.ts` ②/②b 가 실제 Postgres 로 재현·검증했다. 새로운 취약점이 아니라 **기존 잠재 취약점의 수정**이므로 위험도에 반영하지 않되, 다음 리뷰어가 "왜 이 diff 가 보안 관련 커밋인가"를 바로 이해하도록 기록한다.
  - 제안: 없음 (수정 방향이 올바름을 확인).

- 테넌트 격리(workspaceId 스코프) 회귀 없음을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:641-644` (`m.findOne(Trigger, { where: { id: trigger.id, workspaceId }, relations: ['workflow'] })`) 및 `:707-711`
  - 상세: 부분 저장 페이로드의 `id` 는 `dto`(사용자 입력)가 아니라 workspaceId 로 스코프된 재읽기 결과(`target.id`)에서 취한다. `UpdateTriggerDto`(`codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`)에는 `id`/`workspaceId` 필드가 없어 `defined` 스프레드를 통한 PK/테넌트 필드 주입 경로가 없다. 인젝션/권한상승 관점에서 회귀 없음.
  - 제안: 없음 — 확인 목적의 기록.

- SQL 파라미터화 확인 (신규 e2e 특성 테스트)
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `saveAfterCascade`/`saveAfterColumnWrite` 내 `db.query('DELETE FROM workflow WHERE id = $1', [workflowId])`, `db.query("UPDATE trigger SET notification_secret_v2 = 'v2-from-B', last_triggered_at = now() WHERE id = $1", [triggerId])`
  - 상세: 신규 raw SQL 은 모두 `$1` 파라미터 바인딩을 쓰고, `SET` 절의 상수 문자열은 테스트 코드가 직접 박아 넣은 고정값이지 사용자/외부 입력이 아니다. SQL 인젝션 벡터 없음.
  - 제안: 없음.

## 요약

이번 diff 는 `TriggersService.update()` 창 1 이 재읽은 엔티티를 통째로 `save` 하면서 락 밖에서 커밋된 컬럼(`notification_secret_v2` 회전 상태, `chat_channel_token_v2` 정리 상태 등 보안 성격 컬럼 포함)을 옛 값으로 되돌리던 lost-update 결함을 부분 객체 `save` 로 좁혀 수정한다. 저장 페이로드의 `id` 는 workspaceId 로 스코프된 재읽기에서 오고 DTO 에 `id`/`workspaceId` 필드가 없어 테넌트 격리·권한 상승 관점의 새 취약점은 발견되지 않았다. 신규 raw SQL(e2e 특성 테스트)은 전부 파라미터 바인딩되어 인젝션 벡터가 없다. 유일하게 눈에 띄는 것은 e2e 테스트 파일의 하드코딩된 DB 비밀번호 fallback인데, 이는 저장소 전반에 이미 확립된 로컬 e2e 전용 컨벤션이라 이 PR 이 새로 만든 위험이 아니다. 전반적으로 이 변경은 취약점을 도입하지 않고, 오히려 시크릿 회전 상태와 관련된 실제 잠재적 데이터 무결성/보안 결함을 수정하는 방향이다.

## 위험도
NONE
