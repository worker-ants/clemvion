# 보안(Security) 코드 리뷰

## 검토 대상 요약

`TriggersService.update()` 의 advisory lock 안 저장 방식을 "재읽은 엔티티 통째 `save`" 에서
"이 요청이 바꾸는 필드(`defined`) + `config`(병합 결과) 만 담은 부분 객체 `save`" 로 좁힌 lost-update
수정이다. 락 밖에서 커밋되는 컬럼 중에는 `notification_secret_v2`(secret 회전 상태)·
`chat_channel_token_v2`(cron 정리) 등 보안 성격 컬럼이 포함된다. 이번 라운드(`14_34_56`)의 diff 는
직전 두 라운드(`13_44_39`→`14_11_48`) 의 리뷰 처분(payload `const patch` 통합, 낡은 주석 정정,
mock 재측정치를 고정 숫자 대신 "형태 의존" 서술로 교체)만 담고 있고, 핵심 저장/응답 로직 자체는
`14_11_48` 라운드 이후 동작 변경이 없다.

`codebase/backend/src/modules/triggers/triggers.service.ts`(551~730행 전체), 관련 DTO
(`update-trigger.dto.ts`), 신규 e2e 특성 테스트(`test/trigger-update-save-window.e2e-spec.ts`),
공용 트랜잭션 mock(`trigger-transaction-mock.ts`)을 직접 열어 이전 라운드 판정을 재확인했다.

## 발견사항

- **[INFO]** 테넌트 격리(workspaceId 스코프) 및 PK/화이트리스트 우회 경로 없음 — 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `TriggersService.update()`,
    `const patch = { ...defined, config: mergedConfig }; const written = await m.save(Trigger, { id: target.id, ...patch });`
  - 상세: `defined` 는 `dto`(`UpdateTriggerDto`)에서 `notification`/`interaction`/`chatChannel`/`config`
    를 뺀 나머지(`name`·`isActive`·`endpointPath`·`authConfigId`)만 담는다. `UpdateTriggerDto` 전체를
    직접 읽어 확인한 결과 `id`/`workspaceId` 필드는 존재하지 않고, 전역 `ValidationPipe` 가
    `whitelist:true, forbidNonWhitelisted:true` 로 걸려 있어(이전 라운드 side_effect 리뷰에서 확인,
    이번 라운드도 DTO 무변경) 요청 바디로 PK/테넌트 필드를 주입할 경로가 없다. `patch` 스프레드
    순서(`{ id: target.id, ...patch }`)도 `patch` 안에 `id` 키가 없으므로 `target.id`(재읽기 결과,
    workspaceId 로 스코프됨)가 항상 우선한다 — 부분 객체로 좁힌 이번 변경이 PK 주입/권한 상승
    벡터를 새로 열지 않는다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** 이번 수정은 보안 성격의 lost-update 를 실제로 닫는다 — 방향 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (창 1, `defined`·`patch`·
    `m.save` 자리), `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `describe('②
    재읽기 뒤 락 밖 컬럼 한정 갱신')`
  - 상세: 되돌아가던 컬럼 중 `notification_secret_v2`(`rotateNotificationSecret` 이 쓰는 24h grace
    회전 상태)와 `chat_channel_token_v2`(cron 정리의 null-write)는 시크릿 수명주기와 직결된다.
    통째 저장이었을 때는 락 밖에서 방금 커밋된 회전/정리 결과를 재읽기 이전 값으로 되돌릴 수
    있었다(옛 시크릿이 다시 "유효"해 보이는 창) — 부분 객체 전환이 이를 실제 Postgres+TypeORM
    조합(e2e ②/②b)으로 재현·검증하며 닫는다. 새 취약점이 아니라 기존 lost-update 의 수정이다.
  - 제안: 없음 (수정 방향이 올바름을 확인).

- **[INFO]** 신규 raw SQL(e2e 특성 테스트)은 전부 파라미터 바인딩 — 인젝션 벡터 없음
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `saveAfterCascade`
    (`db.query('DELETE FROM workflow WHERE id = $1', [workflowId])`), `saveAfterColumnWrite`
    (`db.query("UPDATE trigger SET notification_secret_v2 = 'v2-from-B', last_triggered_at = now() WHERE id = $1", [triggerId])`)
    등 파일 전체(237행)를 직접 확인.
  - 상세: 모든 raw SQL 이 `$1` 위치 파라미터를 쓰고, `SET` 절의 상수 문자열(`'v2-from-B'` 등)은
    테스트 코드가 고정한 값이지 사용자/외부 입력이 아니다. SQL 인젝션 벡터 없음.
  - 제안: 없음.

- **[INFO]** e2e 신규 파일의 DB 비밀번호 fallback 은 기존 관행과 동일 — 신규 위험 아님
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `beforeAll` 블록
    (`password: process.env.DB_PASSWORD ?? 'clemvion-e2e'`)
  - 상세: 같은 패턴이 저장소 e2e 스위트 전반(`test/helpers/db.ts` 등)에 이미 확립된 로컬
    docker-compose 전용 자격증명 컨벤션이며, 이 PR 이 새로 도입한 패턴이 아니다. 프로덕션 경로에
    영향 없음.
  - 제안: 조치 불요.

이전 두 라운드(`review/code/2026/09/17/13_44_39/security.md`, `.../14_11_48` 처분)에서 이미
CRITICAL/WARNING 없이 종결된 사안이며, 이번 라운드 diff(payload 통합·주석 정정·mock JSDoc 재측정
서술 변경)는 보안 로직 자체를 건드리지 않아 새로 발견된 이슈가 없다.

## 요약

이번 diff 는 `TriggersService.update()` 창 1 이 재읽은 엔티티를 통째로 `save` 하면서 락 밖에서
커밋된 컬럼(시크릿 회전·토큰 정리 상태 포함)을 옛 값으로 되돌리던 lost-update 를 부분 객체 `save`
로 좁혀 수정한 PR 의 3라운드 째 처분(payload 조립 통합, 주석 정정, 뮤턴트 재측정 서술 방식 변경)이다.
저장 payload 의 `id` 는 workspaceId 로 스코프된 재읽기에서 오고 `UpdateTriggerDto` 에 `id`/
`workspaceId` 필드가 없어 PK/테넌트 주입 경로가 없음을 직접 확인했다. 신규 e2e raw SQL 은 전부
파라미터 바인딩되어 있고, DB 비밀번호 fallback 은 저장소 전반의 기존 로컬 e2e 컨벤션과 동일하다.
새로운 취약점을 도입하지 않으며, 오히려 시크릿 회전 상태와 관련된 기존 lost-update 결함을 닫는
방향의 변경이다. 저장소 뮤테이션 검증은 수행하지 않았다 — 코드 직접 대조만으로 판단 가능했고,
`git status --short` 로 확인한 결과 이 리뷰 과정에서 저장소 파일을 건드리지 않았다.

## 위험도
NONE
