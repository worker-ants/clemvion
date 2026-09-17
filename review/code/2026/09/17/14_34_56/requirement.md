# 요구사항(Requirement) 리뷰 — `trigger-save-partial-patch` (3라운드)

## 검토 범위

핵심 코드 변경은 `TriggersService.update()`(`codebase/backend/src/modules/triggers/triggers.service.ts:632-718`)의
창 1 저장 방식을 "재읽은 엔티티 통째 `save`" 에서 "이 요청이 바꾸는 필드 + `config` 만 담은 부분
객체 `save`" 로 좁힌 것이다. 이를 뒷받침하는 신규 e2e 특성 테스트
(`codebase/backend/test/trigger-update-save-window.e2e-spec.ts`), 단위 회귀 2건 및 기존 테스트 수정
(`triggers.service.spec.ts`), 공용 트랜잭션 mock 의 `save` 비동기화(`trigger-transaction-mock.ts`),
`jest.config.ts` 주석 예외 한 줄, `CHANGELOG.md`, `plan/in-progress/trigger-save-partial-patch.md`
를 대상으로 코드를 직접 열어(`Read`) diff 와 대조했다. 나머지 다수 파일(`review/code/2026/09/17/13_44_39/**`,
`review/code/2026/09/17/14_11_48/**`, `review/consistency/2026/09/17/13_04_39/**`)은 이전 두 라운드의
리뷰/일관성 검토 산출물로, 코드 변경이 아니라 이번 라운드가 리뷰 대상으로 삼을 신규 동작이 없다.

이 리뷰는 저장소 파일을 뮤테이션하지 않았다(`git status --short` 확인, 이 라운드 자신의 출력
디렉터리 외 변경 없음).

## 발견사항

- **[SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md §3` 의 ⚠️ "실측되지 않은 잔여" 문구가 이번 PR 로
  이중으로 낡았다 — 코드가 옳고 spec 문구 갱신이 아직 안 됨
  - 위치: `spec/2-navigation/2-trigger-list.md` §3, "⚠️ **실측되지 않은 잔여**: PATCH 의 기본 저장
    경로(엔티티 통째 저장)는 ① 재읽기와 저장 사이의 CASCADE 창에서의 실패 방식, ② 락 밖 컬럼
    한정 갱신과의 경합이 확인되지 않았다" 문장 (해당 문서 §3, `PATCH /api/triggers/:id` 동시 쓰기
    직렬화 문단 하단)
  - 상세: 이 문장은 두 가지 이유로 이제 사실이 아니다. (1) "엔티티 통째 저장" 이라는 전제 자체가
    이번 PR 로 깨졌다 — 저장 대상은 이제 부분 객체다(`triggers.service.ts:710-711`,
    `const patch = { ...defined, config: mergedConfig }; const written = await m.save(Trigger, { id: target.id, ...patch });`).
    (2) ①②는 "확인되지 않았다" 던 것이 이제 실제 Postgres+TypeORM 조합으로 확정 실측되고(①
    시끄러운 실패+부활 없음, ② 락 밖 컬럼이 옛 값으로 되돌아가는 실결함) 그 자리에서 수정까지
    됐다(`trigger-update-save-window.e2e-spec.ts` ①/①b/②/②b). 즉 spec 은 여전히 "미검증 위험"
    으로 서술하는데 코드는 이미 "검증 후 수정 완료" 상태다 — spec 이 코드보다 낡았다.
    이 불일치는 developer 의 실수가 아니다: 문장 자체가 `developer` 가 아니라 이전 `project-planner`
    턴이 spec 에 써 넣은 것이므로(트래커 참조: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    developer 항목 7), CLAUDE.md 의 "자기-반증형 소정정" 예외(조건 1: "대상 문장을 developer 자신이
    그 문서에 썼다")에 해당하지 않는다. 실제로 `plan/in-progress/trigger-save-partial-patch.md`
    "이 PR 이 안 하는 것" 절이 이를 명시적으로 planner 후속으로 등재해 두었고(⚠️ 교체 문안까지
    구체적으로 제시), 1·2라운드 리뷰(`review/code/2026/09/17/13_44_39`,
    `review/code/2026/09/17/14_11_48`)에서도 같은 항목이 이미 SPEC-DRIFT 로 지적되고 동일하게
    처분됐다 — 이번 라운드에서 새로 발견된 것이 아니라 아직 해소되지 않은 채로 남아 있는 항목이다.
  - 제안: 코드는 유지한다(옳다). spec 반영은 developer 권한 밖 — 머지 직후 planner 후속 PR 에서
    `spec/2-navigation/2-trigger-list.md §3` 의 ⚠️ 문장을 "① 시끄러운 실패로 실측됨(23503/23502) ·
    ② 실결함이었고 부분 객체 `save` 로 수정됨" 으로 교체하고, 그 실측/수정을 고정하는 e2e
    (`trigger-update-save-window.e2e-spec.ts`)를 frontmatter `code:` 에 등재한다(plan 이 이미
    이 작업 항목을 구체적으로 적어 두었다).

- **[INFO]** `written.updatedAt` truthy 가드는 실제 경로에서는 항상 참이라 사실상 죽은 분기다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `if (written.updatedAt) target.updatedAt = written.updatedAt;` (함수 `TriggersService.update()`, `m.save(...)` 바로 다음)
  - 상세: `Trigger` 엔티티의 `updatedAt` 은 `@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })` 로 선언돼 있어(`codebase/backend/src/modules/triggers/entities/trigger.entity.ts:162-163`) 실제 TypeORM 경로에서는 `save` 호출마다 항상 채워진다 — 코드 주석 자신도 이를 실측으로 명시한다. 이 `if` 가 방어하는 유일한 대상은 단위 테스트 mock 이 `updatedAt` 없는 객체를 돌려주는 경우뿐이다(주석에도 그렇게 적혀 있음). 기능적 결함은 아니며 이미 이전 라운드 산출물(`review/code/2026/09/17/13_44_39/maintainability.md`, `api_contract.md`)에서 같은 관찰이 INFO 로 보고·기록됐다.
  - 제안: 조치 불요(비차단). 필요하면 실측 근거를 `non-null assertion` 으로 승격해 "코드의 전제 = 실측 문장" 을 일치시키는 것을 고려할 수 있으나 이번 PR 스코프는 아니다.

## 반증되지 않은 나머지 관점

- **기능 완전성/비즈니스 로직**: 락(`acquireTriggerConfigLock`) 안 재읽기 → 병합 → 부분 객체 저장
  → 응답 재구성 흐름을 직접 대조했다. `defined`(rest 필드 중 `undefined` 제외)와 `config`
  만 저장 payload 에 실리므로, 형제 창(`rotateBotToken`·binder·웹훅 인입·스케줄 동기화)이 락
  밖에서 커밋한 컬럼이 이 저장으로 되써지지 않는다 — CHANGELOG 가 서술한 수정 목표와 코드가
  일치한다.
- **엣지 케이스**: PATCH 바디가 `rest` 필드를 하나도 안 실은 경우(`defined = {}`)에도 `config` 는
  항상 재읽은 값 기준으로 재계산돼 실리므로 안전하다(락 밖 쓰기를 되돌리지 않음). 재읽기 뒤
  `workflow` FK CASCADE 삭제 경합은 부분 객체가 INSERT 로 넘어가 `23502`(NOT NULL)로 시끄럽게
  실패·롤백함을 e2e ①b 로 확인했다 — 되살아난 고아 행 없음.
- **반환값**: 트랜잭션 콜백의 모든 경로(정상/`.catch` 예외 재던짐)가 값을 반환하거나 던진다 —
  누락 경로 없음.
- **spec fidelity (그 외)**: `patch`/`defined` 에 담기는 필드 목록(`name`·`isActive`·`endpointPath`·
  `authConfigId`·`config`)은 `spec/2-navigation/2-trigger-list.md §3` 이 명시한 PATCH 허용 top-level
  키 목록과 일치한다. Schedule 타입 트리거의 필드 제한 로직(562~577행)은 이번 diff 의 변경 대상이
  아니며 spec 문구와 그대로 일치한다.
- 저장 payload 리터럴 중복(`save`/`Object.assign` 각각에 `patch` 재사용) 문제는 이미 1라운드에서
  `const patch` 로 통합돼 해소됐음을 코드에서 직접 확인했다(재발 없음).

## 요약

핵심 변경(`TriggersService.update()` 창 1 의 부분 객체 `save`)은 의도한 lost-update 방지 기능을
정확히 구현하고 있고, 단위(신규 2건 + 기존 수정)와 e2e(신규 6케이스) 양쪽에서 실측 기반으로
검증돼 있다. TODO/FIXME/HACK 류 미완성 표식은 없으며 반환값·에러 경로도 모든 분기에서 정의돼
있다. 유일한 실질적 발견은 `spec/2-navigation/2-trigger-list.md §3` 의 ⚠️ 문구가 이 PR 로 낡았다는
SPEC-DRIFT 인데, 이는 코드의 결함이 아니라 이전 두 라운드에서도 동일하게 지적·확인된 항목이고
plan 이 이미 developer 권한 밖 planner 후속으로 명시 추적 중이라 이 PR 을 막을 사유는 아니다.
나머지 INFO(`written.updatedAt` 방어 분기) 도 실측상 실제로는 타지 않는 방어 코드로 비차단이다.

## 위험도
LOW — 요구사항 관점에서 이 라운드가 새로 발견한 차단급 결함은 없다. 유일한 발견(SPEC-DRIFT)은
이미 추적 중인 항목의 재확인이다.
