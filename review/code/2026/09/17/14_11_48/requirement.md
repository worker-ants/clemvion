# 요구사항(Requirement) 리뷰 — `trigger-save-partial-patch` (2라운드, `14_11_48`)

## 범위

1라운드 리뷰(`review/code/2026/09/17/13_44_39`, C0·W5·LOW)의 처분(payload 단일화·낡은 머리말 정정·mock 재측정 60·뮤턴트 표 정정)을 반영한 diff. 핵심 기능 변경(`TriggersService.update()` 창 1의 통째 엔티티 `save` → 부분 객체 `save`)은 이번 라운드가 아니라 직전 커밋(`0b43da885`)에서 이미 들어갔고, 이번 diff는 그 수정을 문서·테스트·mock 레벨에서 마무리하는 정정 라운드다.

## 발견사항

- **[INFO]** 리뷰 중 저장소 공유 워킹트리에서 `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` 에 대한 **일시적 미커밋 뮤테이션**을 두 차례 관측했다 — 이번 diff 의 일부가 **아니다**.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (`withTransactionMock` 함수 본문, `if (triggerRepoMock.manager) return triggerRepoMock;` 바로 아래)
  - 상세: `git status --short` 로 처음엔 `M codebase/backend/.../trigger-transaction-mock.ts` 를 봤고, 실제로 `return { ...triggerRepoMock, manager: { transaction: jest.fn(() => Promise.resolve(undefined)) } }; return { ... 원본 ... }` 형태(도달 불가 코드가 섞인)의 뮤턴트가 파일에 그대로 있었다. 잠시 뒤 재확인하니 그 형태는 사라지고 `transaction: jest.fn((cb) => Promise.resolve(false && cb({...})))` 형태의 **다른** 뮤턴트로 바뀌어 있었다(`git diff --stat` = 1 insertion/1 deletion). 두 형태 모두 이 라운드의 diff(원본 `_prompts/requirement.md`)에는 없는 내용이다 — 커밋 `6d845d8a2` 위에 얹힌 순수 워킹트리 상태였다. 이는 **다른 리뷰어(아마 testing 계열)가 이 PR의 W4 "60 RED" 재측정 주장을 이 순간 직접 뮤턴트로 검증 중**인 것으로 보인다(리뷰 payload 가 경고한 "병렬 fan-out 중 공유 워킹트리 오염" 시나리오와 정확히 일치).
  - 조치: **아무것도 건드리지 않았다** — `git checkout`/`git restore` 를 쓰지 않았고, 파일에 쓰기도 하지 않았다. 이 관측 시점 이후 재확인은 하지 않았으므로 지금 이 순간의 파일 상태는 이 보고서 작성 시점과 다를 수 있다. 통합 SUMMARY 작성자는 다른 reviewer(특히 `trigger-transaction-mock.ts` 를 대상으로 하는 reviewer)가 **뮤턴트가 남아 있는 상태**를 실제 코드로 오인해 보고했을 가능성을 감안해야 한다.

- **[WARNING] [SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md` §3 의 ⚠️ 문단이 이 PR(및 직전 커밋)로 이미 사실과 다르다 — **1라운드에서 이미 지적·수용된 항목의 재확인**이며 새 발견은 아니다.
  - 위치: `spec/2-navigation/2-trigger-list.md:203-205` (`> ⚠️ **실측되지 않은 잔여**: PATCH 의 기본 저장 경로(엔티티 통째 저장)는 ① 재읽기와 저장 사이의 CASCADE 창에서의 실패 방식, ② 락 밖 컬럼 한정 갱신과의 경합이 확인되지 않았다`)
  - 상세: "엔티티 통째 저장"은 이 PR로 부분 객체 저장으로 바뀌었고, ①②는 `test/trigger-update-save-window.e2e-spec.ts` 로 실측 완료됐다(① 통째=23503/부분=23502 롤백·부활 없음, ② 통째=락 밖 컬럼 되돌림 실결함 확인/부분=보존). 코드는 옳고 spec 본문 표현만 낡았다.
  - 제안: 코드 유지. `plan/in-progress/trigger-save-partial-patch.md` "이 PR이 안 하는 것" §1 에 이미 planner 후속으로 정확히 등재돼 있다(⚠️ 교체 + 신규 e2e `code:` frontmatter 등재 + `15-chat-channel.md §5.4` 404 사유 각주). 이 라운드의 diff는 spec 파일을 건드리지 않았으므로 정정은 developer 권한 밖 그대로이고 처리도 올바르다 — 다만 spec 텍스트 자체는 아직 낡은 채로 남아 있어 병합 후 별 PR 이 필요하다는 사실은 재확인해 둔다.

- **[INFO]** 창 1(`update()`)의 CASCADE 창 실패가 spec §3 이 다른 락 보유 창(`rotate-bot-token` 등)에 대해 서술하는 "0행 매치 → 쓰지 못한 것으로 취급(404)" 패턴과 다르게, 시끄러운 미분류 실패(23503/23502 → 일반 500)로 노출된다 — **이 PR 이 만든 회귀가 아니고, 이 PR 의 주장 범위 밖**이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 의 `.catch((err: unknown) => this.rethrowEndpointPathConflict(err))` (변경 없음, 함수명·동작 그대로)
  - 상세: `spec/2-navigation/2-trigger-list.md:199` "락으로 막을 수 없는 삭제 경로가 있다 — workflow·workspace 삭제의 FK CASCADE. 그래서 락 안에서도 행 부재를 판정한다: 재읽기가 비면 쓰지 않고, 병합 쓰기가 0행에 매치되면 쓰지 못한 것으로 취급한다(rotate-bot-token 은 이때 404)." 는 일반 원칙인데, 창 1 은 재읽기가 성공한 뒤 CASCADE 로 행 자체가 사라지는 경합에서 `rewriteTriggerConfigLocked` 류의 "0행 판정" 경로를 타지 않고 `save()` 의 재조회-후-INSERT 시맨틱을 그대로 타 FK/NOT-NULL 위반으로 실패한다(`trigger-update-save-window.e2e-spec.ts` ①/①b 로 실측). 결과적으로 클라이언트는 404/409 대신 무차별 500 을 본다.
  - 제안: 조치 불요 — CHANGELOG·plan 모두 이 갭을 정확히 서술하고("트리거가 되살아나지 않는다"까지만 보장, 에러 코드 정합은 다루지 않음) `15-chat-channel.md §5.4` planner 후속으로 이미 이월했다. `/ai-review` 1라운드 INFO#2 와 동일 항목이라 중복 차단 사유 아님.

- **[INFO]** W4 "mock `transaction` 콜백 미실행 뮤턴트 → 60 RED(321건 중)" 재측정 수치는 CHANGELOG·plan·mock JSDoc 세 곳에서 서로 일치해 문서 내적 정합성은 확인했으나, 이번 리뷰에서 **내가 직접 재실행해 재검증하지는 못했다** — 위 첫 항목에서 관측한 것처럼 검증 시도 시점에 그 파일이 다른 리뷰어의 활성 뮤테이션 상태였기 때문이다.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:62-69`
  - 제안: 조치 불요(문서 자체는 일관됨). 통합 단계에서 `testing` reviewer 산출물의 재측정 결과와 대조해 이 수치의 최종 확인을 맡길 것.

## 요구사항 충족 확인 (문제 없음, 근거만 기록)

- **핵심 수정 정확성**: `triggers.service.ts` 의 `update()` 를 라인 단위로 추적 — 락 안 재읽기(`fresh`) → `assertTriggerFound` (null이면 404, save 도달 자체를 막아 "행이 사라졌으면 저장하지 않는다"를 실제로 구현) → `patch = {...defined, config: mergedConfig}` 단일 구성(1라운드 W5 반영 확인) → `m.save(Trigger, {id: target.id, ...patch})` → `Object.assign(target, patch)` → `if (written.updatedAt) target.updatedAt = written.updatedAt` 순서가 CHANGELOG/plan 서술과 정확히 일치.
- **단위 테스트 일치**: `triggers.service.spec.ts` 신규 두 테스트를 수동 트레이스 — ① 키 집합 단언(`['config','id','name']`)이 실제 `patch` 구성과 일치, ② `save` 반환값 null-채움 흉내 테스트의 `reread()`/`row()` 픽스처가 만드는 `endpointPath='hook-l'` 등 값이 최종 `result` 단언과 정확히 대응함을 확인(로직을 직접 재현해 손으로 계산 후 대조).
- **e2e 특성 테스트**: `trigger-update-save-window.e2e-spec.ts` 의 ①(FK CASCADE, 통째=23503/부분=23502)·②(락 밖 컬럼 갱신, 통째=되돌림/부분=보존)·②c(반환값=재조회 아님, `updatedAt` 만 실값)·③(`affected:0`) 이 CHANGELOG·plan 표와 SQLSTATE·컬럼명까지 정확히 일치.
- **함수/식별자 실재성 확인**: CHANGELOG·plan 이 언급하는 `rotateNotificationSecret`, `cleanupRotatedChatChannelTokens` 등은 grep 으로 실재 확인 — 지어낸 근거 아님.
- **TODO/FIXME/HACK/XXX**: 이번 diff 7개 코드/문서 파일에서 미완성을 시사하는 주석 없음.
- **반환값**: `update()` 는 정상 경로·chatChannel 분기·에러 재throw(`rethrowEndpointPathConflict`) 모두에서 `Trigger` 또는 예외로 귀결 — 값 없이 빠지는 경로 없음.
- **1라운드 W1~W5 처분 재확인**: W2(뮤턴트 표 M1 "2→1 RED" 정정), W3(창 1 머리말·`withRef` 픽스처 JSDoc 모순 해소), W5(payload 단일화)를 코드에서 직접 대조해 실제로 반영됐음을 확인.

## 요약

이번 라운드의 diff는 새 기능이 아니라 직전 커밋에서 이미 들어간 핵심 수정(창 1의 통째 `save` → 부분 객체 `save`, lost-update 실결함 수정)에 대한 1라운드 리뷰 처분(W2/W3/W4/W5)을 문서·테스트·mock 레벨에서 마무리하는 것이다. 코드를 라인 단위로 추적한 결과 CHANGELOG·plan 서술과 실제 구현·테스트가 정확히 일치했고, 새로운 기능적 결함이나 TODO/미완성 표식은 발견되지 않았다. `spec/2-navigation/2-trigger-list.md §3` 의 ⚠️ 문단은 SPEC-DRIFT 상태(코드가 옳고 spec 표현이 낡음)이지만 이미 1라운드에서 발견·수용되어 plan 에 planner 후속으로 정확히 이월돼 있어 이번 라운드가 새로 만든 문제는 아니다. 리뷰 도중 이 diff와 무관한 공유 워킹트리 파일(`trigger-transaction-mock.ts`)에서 다른 리뷰어의 것으로 보이는 두 차례의 일시적 미커밋 뮤테이션을 관측했으며, 손대지 않고 그대로 보고한다 — 통합 단계에서 같은 파일을 대상으로 한 다른 reviewer 산출물이 있다면 이 오염 가능성을 감안해 대조할 것.

## 위험도

LOW
