# 요구사항(Requirement) 충족 리뷰 — 창 1(`TriggersService.update()`) 부분 객체 `save` 전환

## 검토 방법

- `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 전체(551~745행 부근)를 직접 `Read`,
  `entities/trigger.entity.ts`(컬럼·관계 cascade 옵션), `dto/update-trigger.dto.ts`(허용 필드),
  `trigger-config-lock.ts`(형제 창 `rewriteTriggerConfigLocked` 의 `m.update()` 패턴)를 대조해
  "이 PR 이 유일하게 통째 `save` 를 쓰던 자리를 부분 객체로 좁혔다"는 CHANGELOG/plan 서술이
  코드와 line-level 로 일치하는지 확인했다.
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(신규/수정 테스트 2건),
  `__test-utils__/trigger-transaction-mock.ts`(mock 의 async화), `test/trigger-update-save-window.e2e-spec.ts`
  (신규, 실제 Postgres 특성 테스트)를 대조해 단언이 실제 코드 동작·실측값과 맞는지 확인했다.
- `git diff --stat origin/main...HEAD` 로 `spec/` 미변경(정확히 `spec_impact: none`과 일치)임을 확인하고,
  `spec/2-navigation/2-trigger-list.md §3` 의 관련 ⚠️ 문단을 직접 열어 코드와의 정합/괴리를 판정했다.
- `review/consistency/2026/09/17/13_04_39/*` (이번 세션 자체 `--impl-prep` 산출물)를 읽어 이미 지목된
  항목과 내 발견이 중복되지 않도록 대조했다.
- 저장소에 뮤테이션은 가하지 않았다(정적 분석·Read/Grep 만 사용).

## 발견사항

- **[SPEC-DRIFT] WARNING** `spec/2-navigation/2-trigger-list.md §3` ⚠️ 문단이 이번 PR 의 코드 변경으로
  이미 사실과 다르다 — 코드는 옳고 spec 서술이 낡았다
  - 위치: `spec/2-navigation/2-trigger-list.md:203-205`
  - 상세: 해당 문단은 "PATCH 의 기본 저장 경로(**엔티티 통째 저장**)는 ① 재읽기와 저장 사이의
    CASCADE 창에서의 실패 방식, ② 락 밖 컬럼 한정 갱신과의 경합이 **확인되지 않았다**" 라고
    말한다. 그런데 `triggers.service.ts:707-713`(창 1)은 이미 통째 엔티티가 아니라
    `{ id, ...defined, config: mergedConfig }` **부분 객체**를 저장하도록 바뀌었고, ①②는
    `test/trigger-update-save-window.e2e-spec.ts` 로 실제 Postgres 에서 측정까지 끝났다(①=23503/
    ①b=23502 롤백·부활 없음, ②=통째면 되돌아감/②b=부분이면 보존). 즉 이 ⚠️ 문단의 전제("엔티티
    통째 저장", "미검증")가 이 PR 이 머지되는 순간 거짓이 된다.
  - 판단: 이것은 코드 결함이 아니다 — plan(`plan/in-progress/trigger-save-partial-patch.md` "## 이
    PR 이 안 하는 것" §1)이 이미 이 지점을 정확히 짚어 "spec 정정은 developer 권한 밖이라 별도
    planner PR 로 분리한다"고 명시했고, 이번 세션 자신의 `--impl-prep` cross_spec/
    rationale_continuity 체커도 같은 자리를 INFO#2 로 이미 지목했다(`review/consistency/2026/09/17/13_04_39/
    cross_spec.md` "참고 — 이번 세션 스코프 밖으로 확인한 것", `rationale_continuity.md` 참조).
    역할 경계(developer 는 spec 쓰기 금지)를 정확히 지킨 것이므로 이 발견을 이 PR 의 블로커로
    보지 않는다. 다만 "관련 spec 본문 일치 여부" 관점에서 **현재 시점 기준으로는 명백한 불일치**이므로
    누락 없이 기록한다 — 머지~planner PR 착수 사이의 창에서 이 문서만 읽는 사람은 오독한다.
  - 제안: 코드 유지 + spec 반영. plan 이 이미 예고한 대로, 머지 직후 planner 턴에서
    `2-trigger-list.md §3` 203~205행을 "① 시끄러운 실패(23503/23502)로 실측 완료, ② 실결함이었고
    부분 객체 `save` 로 수정됨" 으로 교체하고, `code:` frontmatter 에
    `test/trigger-update-save-window.e2e-spec.ts` 를 등재한다(같은 consistency 세션 WARNING#1이
    이미 지목).

- **[INFO]** 신규 단위 테스트("save 반환값의 null 이 재읽은 값을 덮지 않는다")가 실측한 세 개의
  null 필드 중 하나만 단언한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3886-3918`
  - 상세: mock `repo.save.mockImplementation` 은 `endpointPath`·`notificationSecretV2`·
    `chatChannelTokenV2` 세 nullable 컬럼을 전부 `null` 로 채워 반환하도록 실측 모양을 흉내내는데
    (3896-3902행), 뒤따르는 `expect` 는 `result.endpointPath` 만 검사하고 나머지 두 필드는
    검사하지 않는다. 다만 production 코드(`triggers.service.ts:707-713`)는 `written` 에서
    `updatedAt` 하나만 조건부로 취하고 나머지는 전부 `target`(재읽은 값) 기준이라, `endpointPath`
    하나만으로도 "반환값을 통째로 덮는" 클래스의 뮤턴트(예: `Object.assign(target, ..., written)`)는
    잡힌다 — 값 하나만 선택적으로 되살리는(`notificationSecretV2`만 골라 덮는) 부자연스러운
    뮤턴트까지 잡지는 못한다는 좁은 틈이다. 기능 결함은 아니고 테스트 커버리지 폭의 여유분이다.
  - 제안: 여유 있을 때 `notificationSecretV2`·`chatChannelTokenV2` 도 같은 `not.toBeNull()` 단언에
    추가해 커버리지를 대칭으로 만들면 좋다(선택 사항, 블로킹 아님).

## 검증했으나 문제 없음 (참고)

- `update()` 의 부분 객체 `{ id: target.id, ...defined, config: mergedConfig }` 는 `UpdateTriggerDto`
  에 `id`/`workspaceId`/`config` 키 충돌이 없어(별도 destructure) 키 충돌·의도치 않은 컬럼 유출
  위험이 없다.
- `Trigger.workflow` 관계는 `@ManyToOne(() => Workflow, { onDelete: 'CASCADE' })` 에 `cascade` 옵션이
  없어(entity.ts:46-48), 통째 엔티티든 부분 객체든 관련 `Workflow` 행에 의도치 않은 cascade 쓰기가
  나가지 않는다 — 부분 객체 전환이 이 축에서 새 위험을 만들지 않는다.
- `written.updatedAt` 트루시 체크는 `@UpdateDateColumn` 이 항상 값을 채우므로 실사용에서 분기가
  거짓이 되는 경로가 없다(방어적 코드, 버그 아님).
- CASCADE 창 ①/①b 의 "23503 vs 23502" 코드 차이(통째=FK 위반, 부분=INSERT 시 NOT NULL 위반)는
  둘 다 롤백+행 0으로 귀결됨을 e2e 가 확정적으로 검증했고, 이 설명이 코드 주석·CHANGELOG·plan
  세 곳에서 일관된다.
- `rewriteTriggerConfigLocked`(형제 창)가 이미 `m.update()` 로 컬럼 한정 갱신을 쓰고 있어, 창 1 만
  통째 `save` 를 쓰던 비대칭이 이 PR 로 해소됐다는 CHANGELOG 의 주장이 코드와 일치한다.
  (`grep` 결과 `triggers.service.ts` 안에서 `.save(Trigger`/`.save(trigger`/`.save(entity)` 형태는
  `create()`(신규 INSERT, lost-update 무관)와 창 1 두 곳뿐이다.)
- `spec_impact: none` 은 bare 리터럴로 Gate C 스키마를 만족하고, 실제로 `git diff --stat` 상
  `spec/**` 변경이 0 이라 서술과 실제가 일치한다.
- TODO/FIXME/HACK/XXX 류 미완성 마커는 diff 전체에서 검출되지 않았다.
- 반환값 경로: `update()` 는 트랜잭션 성공 시 `target`(재읽은 엔티티 + 요청 변경 + `updatedAt`),
  실패 시 `rethrowEndpointPathConflict` 가 던지거나 재던짐 — 모든 경로에서 값을 반환하거나 명시적
  예외를 던진다(누락 경로 없음).

## 요약

이번 PR 의 핵심 변경(창 1 `TriggersService.update()` 의 저장을 통째 엔티티에서 "이 요청이 바꾸는
필드 + config" 부분 객체로 좁히고, 응답은 재읽은 엔티티에 `save` 반환값의 `updatedAt` 하나만
얹는 방식)은 TypeORM `save()` 의 실측된 diff 동작(넘기지 않은 컬럼은 비교에서 빠져 락 밖 커밋을
보존하되, 반환값의 넘기지 않은 nullable 컬럼은 `null` 로 채워진다)과 정확히 맞물려 구현돼 있고,
단위 테스트(키 집합 단언·반환값 null 방어)와 신규 e2e 특성 테스트(실제 Postgres, CASCADE/컬럼
경합/0행 update 세 시나리오)가 그 근거를 문장이 아니라 관측으로 고정한다. 코드 자체에서 CRITICAL
급 결함은 발견하지 못했다. 유일하게 기록할 만한 항목은 `spec/2-navigation/2-trigger-list.md §3`
의 ⚠️ 문단이 이번 코드 변경으로 이미 사실과 어긋나게 된 SPEC-DRIFT인데, 이는 개발자 권한 경계상
의도적으로 미수정 상태로 남겨져 있고 plan 문서 자신이 후속 planner PR 로 명시 위임해 뒀다(이번
세션의 `--impl-prep` consistency 체크도 같은 자리를 이미 INFO로 지목). 그 외에는 반환값 커버리지의
아주 좁은 여유분(INFO) 하나뿐이다.

## 위험도

LOW
