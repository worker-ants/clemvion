# 보안(Security) 코드 리뷰

## 검토 범위

`trigger-lock-followups` PR — `trigger.config` lost-update 방지 advisory lock(`#1334`)의 developer 범위 후속
5건. 핵심 변경은 `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(+테스트) 와
`triggers.service.ts` 의 private 메서드 개명이며, 나머지는 CHANGELOG·plan·consistency-check 산출물이다.

## 검증 절차 메모 (뮤테이션 규약 준수)

가설 검증을 위해 저장소 파일은 고치지 않고 `Read`/`grep`/`git diff`/`git status` 로만 확인했다.

**관측된 이상 상태(투명성 보고 의무)**: 검토 도중 `git diff` 한 번이 `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 에 아래 diff 를 보였다 —

```
-    if (result.affected === 0) return false;
     return true;
```

즉 이 PR 의 핵심 수정(§아래 "④" 항목)이 그 순간 워킹트리에서 사라져 있었다. 직후 재확인(`git status --short`, `grep -n affected`)에서는 원래 의도된 코드(`if (result.affected === 0) return false;` 존재)로 복귀해 있었다. 이 파일을 나는 건드리지 않았다 — 정황상 프롬프트가 경고한 "병렬 fan-out reviewer 의 뮤테이션"(plan 체크리스트의 M4a `affected 검사 제거` 뮤턴트와 정확히 일치)이 다른 세션에서 진행 중이었고, 그 세션이 스스로 원복한 것으로 보인다. **보고 시점 기준 워킹트리는 clean 하고 의도된 수정이 존재**하므로 아래 발견사항은 모두 이 정상 상태를 기준으로 작성했다. 다만 이 관측 자체가 "리포트 의무는 면제되지 않는다"는 규약에 해당해 기록한다.

## 발견사항

- **[INFO]** `SET LOCAL lock_timeout` 문자열 보간 지점이 정수로 안전하게 좁혀졌다 (긍정 확인)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `toLockTimeoutMs()` (라인 29~55), 사용처 라인 88
  - 상세: `manager.query()` 는 파라미터 바인딩이 불가능한 `SET LOCAL` 자리라 값이 문자열 템플릿으로 그대로 보간된다. 종전엔 `Math.trunc()` 만 거쳐 `NaN`/`Infinity`/음수가 그대로 `'NaNms'` 처럼 SQL 에 실릴 수 있었다. 이번 수정은 `Number.isFinite` 로 비유한값을 거부(예외 throw)하고, 유한값은 `[1, 60000]` 범위로 clamp 한다. 결과값은 항상 이 범위의 정수이므로 문자열에 따옴표·세미콜론 등 SQL 메타문자가 실릴 수 없다 — 인젝션 표면이 실질적으로 닫혔다.
  - 실측 확인: 현재 호출부 2곳(`triggers.service.ts:1038`, `schedules.service.ts:315`) 모두 리터럴 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(`=5_000`)만 전달함을 직접 확인했다 — 사용자 입력이 `timeoutMs` 에 닿는 경로는 현재 0건이라 이번 변경은 "현재 익스플로잇 방어"가 아니라 **미래 호출부를 위한 방어 심도**다. PR 문서의 주장과 일치한다.
  - 제안: 없음 — 이미 반영됨. 향후 `timeoutMs` 를 계산식/사용자 입력으로 넘기는 호출부가 생겨도 이 함수가 형태를 계속 보장한다.

- **[INFO]** advisory lock 키(`hashtext($1)`)는 파라미터 바인딩 유지 (긍정 확인)
  - 위치: `trigger-config-lock.ts` `acquireTriggerConfigLock()` 마지막 두 줄(`manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [...])`)
  - 상세: `triggerId` 가 SQL 문자열에 직접 보간되지 않고 파라미터 배열로 전달된다. 인젝션 경로 없음.

- **[INFO]** `rewriteTriggerConfigLocked` 의 `affected===0` 판정이 CASCADE 로 인한 orphaned-secret 회귀를 닫는다 (긍정 확인, 보안 관련 결함 수정)
  - 위치: `trigger-config-lock.ts` 라인 239~241(`const result = await m.update(...); if (result.affected === 0) return false; return true;`)
  - 상세: `Trigger` 행을 지우는 경로가 `TriggersService.remove()` · `SchedulesService.remove()` cascade · **`Workflow`/`Workspace` 삭제의 FK `onDelete: 'CASCADE'`**(advisory lock 을 아예 잡지 않는 DB 레벨 경로) 셋임을 실측으로 확인했다(`trigger.entity.ts` 의 두 `@ManyToOne`). 세 번째 경로가 `findOne` 재읽기와 `UPDATE` 사이에 커밋되면 0행 매치가 되는데, 종전 코드는 이때도 `true` 를 돌려줘 호출부가 "썼다"고 오신뢰했다. 이 경로가 열려 있으면 `rotateBotToken`(`triggers.service.ts:1318` 호출, 반환값 `wrote` 는 라인 1354 `if (!wrote) this.throwTriggerNotFound();` 로 확인) 은 트리거가 이미 삭제됐는데도 200 을 응답하고, 새로 발급한 bot token 만 secret store 에 orphan 상태로 남는다 — 시크릿 관리 정합성 결함이었다. 나머지 두 호출부(`revokePerTriggerToken` 라인 1154/1354 인접, `promoteChatChannelSecretsToV2` 라인 1449)도 반환값을 확인해 동일하게 처리함을 소스에서 직접 검증했다.
  - `null`/`undefined`(드라이버 미보고)를 0 과 구분해 `true` 로 유지하는 것도 확인 — "모른다"를 "없다"로 오판해 정상 쓰기를 실패로 뒤집는 회귀를 막는다.
  - 제안: 없음 — 이미 반영·테스트됨(`trigger-config-lock.spec.ts` 의 "UPDATE 가 0행에 매치되면 false" / "affected 를 보고하지 않는 드라이버에서는 true 를 유지한다" 두 케이스, 서로 다른 입력·출력으로 실제 분기점을 구별).

- **[WARNING]** 창 1(`TriggersService.update()` 의 인라인 `save()`)이 같은 CASCADE 레이스에 이론상 여전히 노출되며, 이번 PR 은 그 표면을 검증하지 않았다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 라인 632~680 (`const saved = await this.triggerRepository.manager.transaction(...)`, `const target = this.assertTriggerFound(fresh);` 라인 678, `return m.save(Trigger, target);` 라인 680)
  - 상세: 이 창은 `acquireTriggerConfigLock` 을 공유하지만 `rewriteTriggerConfigLocked` 를 거치지 않는 유일한 예외로 문서화돼 있다(`trigger-config-lock.ts` JSDoc). 락 안에서 `m.findOne` 으로 재읽어 `null` 이면 `assertTriggerFound` 로 즉시 404 를 던지지만, 그 **재읽기와 `m.save()` 사이**의 창은 이번 PR 이 발견한 3번째 삭제 경로(FK CASCADE)에 대해 검증되지 않았다. TypeORM 의 `save()` 는 저장 직전 PK 기준으로 재조회해 행이 없으면 INSERT 로 처리한다는 것이 이 파일 자신의 JSDoc 서술이다 — 그 시점에 CASCADE 가 이미 부모(Workflow/Workspace)를 지웠다면 재-INSERT 는 이제 존재하지 않는 `workflow_id`/`workspace_id` 를 참조하게 되어 **FK 제약 위반으로 트랜잭션이 실패**할 가능성이 높다(즉 조용한 성공이 아니라 500 에러로 귀결될 것으로 추정된다). 다만 이는 TypeORM 내부 동작에 대한 추정이며 이번 세션에서 재현·확정 테스트를 하지 않았다 — `rewriteTriggerConfigLocked` 의 "조용한 성공" 급 심각도는 아니지만, 가용성 관점의 미검증 표면으로 남아 있다.
  - 제안: PR 자신의 plan(`trigger-lock-followups.md`)이 이미 "①②는 뮤턴트가 존재하지 않는다"처럼 범위를 스스로 좁혀 적었듯, 이 창도 스코프 밖으로 명시적으로 남기되, 후속 항목으로 등재해 `m.save()` 재조회 시점의 CASCADE 레이스를 직접 재현(예: `freshFindOne` 을 두 번째 호출에서만 `null` 로 바꾸는 fixture)해 실제 실패 모드(에러 vs 조용한 orphan)를 확정하는 것을 권고한다.

- **[INFO]** `normalizeNotificationSecretRef` 는 `rewriteTriggerConfigLocked` 반환값을 확인하지 않는다 (이 PR 이 만든 회귀 아님, 잔여 표면)
  - 위치: `triggers.service.ts` 라인 841~886(`normalizeNotificationSecretRef`), 특히 라인 876 `await rewriteTriggerConfigLocked(...)` 호출부는 반환값을 변수에 담지 않는다. 호출자는 라인 505(`create()`)·705(`update()`) 둘.
  - 상세: 이 메서드는 `secretRef` 발급 직후(`this.secrets.rotate(ref, ...)`, 이미 secret store 에 plaintext 를 기록한 뒤) config 재작성을 시도한다. 트리거가 그 사이 삭제되면(이번 PR 이 다루는 것과 같은 3-경로 중 하나) `rewriteTriggerConfigLocked` 는 이제 정확히 `false` 를 돌려주지만 이 호출부는 그 값을 버린다 — 앞서 고친 `rotateBotToken`(라인 1354) 과 **같은 클래스**의 orphaned-secret 이 여기서는 여전히 무시된다. 다만 이 패턴은 이번 diff 가 건드리지 않은 기존 코드이고, 이전에도(항상 `true` 를 돌려주던 시절에도) 반환값을 쓴 적이 없어 **이번 PR 이 새로 만든 회귀는 아니다** — 심각도를 상향할 근거는 없지만, PR 이 명시적으로 다루는 주제(트리거 삭제 레이스로 인한 secret store 정합성)와 정확히 같은 범주라 후속 정리 대상으로 기록해 둘 가치가 있다.
  - 제안: 후속 plan 항목으로 등재해 `create()`/`update()` 경로에서도 반환값을 확인하고 skip 시 처리(로그만 남길지, 예외를 던질지는 create/update 트랜잭션 커밋 이후 시점이라 별도 설계 필요)를 결정할 것.

- **[INFO]** 인가(authorization) 회귀 없음 — 순수 개명 확인
  - 위치: `triggers.service.ts` `findByIdForPatchValidation`(라인 542~549, 종전 `findByIdForUpdate`), 호출부 라인 557
  - 상세: 개명 전후로 `where: { id, workspaceId }` 스코핑이 그대로 유지됨을 직접 대조했다 — cross-workspace 접근 차단 로직에 변화 없음. 이름이 암시하던(그러나 실제로는 없던) `FOR UPDATE` 행 잠금 관련 오해는 이번 개명으로 해소됐고, 이는 향후 개발자가 "이미 잠겨 있다"고 오신하고 별도 동시성 보호를 생략하는 위험(정보성 아닌 잠재적 동시성 결함 유발 경로)을 낮춘다.

- **[INFO]** 에러 메시지 정보 노출 없음
  - 위치: `trigger-config-lock.ts` 라인 46~50 (`throw new Error(...받은 값: ${String(value)})`)
  - 상세: 이 예외는 `timeoutMs` 가 비유한값일 때만 발생하며, 현재 모든 호출부가 모듈 상수만 전달하므로 사용자 요청으로 도달 불가능하다. 도달하더라도 노출되는 값은 호출자가 넘긴 숫자뿐이라 민감정보 노출 아님.

## 요약

핵심 변경(`toLockTimeoutMs` 유한성 검사+clamp, `rewriteTriggerConfigLocked` 의 `affected===0` 판정)은 모두 실제 보안/정합성 결함(SQL 보간 방어 심도, 삭제된 트리거에 대한 secret orphan·거짓 성공 응답)을 겨냥한 진짜 하드닝이며, 코드·테스트를 직접 대조한 결과 주장대로 구현·검증돼 있다. 인가 스코핑은 개명 과정에서 변화 없음을 확인했다. 새로 도입된 취약점, 하드코딩된 시크릿, 인젝션 벡터는 발견하지 못했다. 다만 이번 PR 이 스스로 발견한 "3번째 삭제 경로(FK CASCADE)"가 명시적으로 스코프 밖에 둔 창 1(`TriggersService.update()` 인라인 `save()`)과 이번 diff 가 건드리지 않은 `normalizeNotificationSecretRef` 호출부에도 이론상 같은 계열의 레이스가 남아 있어 WARNING/INFO 로 각각 기록했다 — 둘 다 이번 PR 이 새로 만든 회귀는 아니며 기존부터 존재하던 잔여 표면이다. 검토 중 워킹트리에서 핵심 수정 라인이 일시적으로 사라졌다가 복원되는 것을 관측했는데(병렬 리뷰 뮤테이션으로 추정), 보고 시점 기준으로는 의도된 코드가 정상 반영돼 있다.

## 위험도

LOW
