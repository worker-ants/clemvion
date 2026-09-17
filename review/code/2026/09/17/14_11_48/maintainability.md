# 유지보수성(Maintainability) 리뷰 — `trigger-save-partial-patch` (2라운드)

## 범위 요약

이번 diff 는 1라운드(`review/code/2026/09/17/13_44_39`)의 처분(W1~W5 전부 수용·수정, INFO 다수 반영)을 적용한 결과물이다. 실제 코드 변경은 4개 파일(`triggers.service.ts`, `triggers.service.spec.ts`, `trigger-transaction-mock.ts`, 신규 `test/trigger-update-save-window.e2e-spec.ts`)과 문서 2건(`CHANGELOG.md`, 신규 plan), 그리고 1라운드 자신의 산출물(`review/code/**`, `review/consistency/**`)이 committed 되어 diff 에 실렸다. 후자는 과거 리뷰 리포트 기록물이지 신규 애플리케이션 코드가 아니므로 유지보수성 관점 대상에서 제외했다 — 저장소 관례상 이런 산출물은 committed 되고 재검토 대상이 아니다.

`triggers.service.ts` 의 `TriggersService.update()` 전체(551~769행)를 직접 `Read` 로 열어 diff 만으로는 안 보이는 함수 전체 길이·중첩·변수 수를 확인했고, 신규 e2e-spec 파일과 mock 파일도 전체를 열어 확인했다. 저장소 트리에 아무것도 쓰지 않았다 — 순수 읽기 검증만 수행했다(`git status --short` 불필요, 뮤테이션 없음).

## 발견사항

- **[INFO]** `TriggersService.update()` 가 여전히(그리고 이번 PR 로 더) 길고 여러 책임을 한 메서드에 담고 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 메서드 전체(551행~769행, 약 219줄)
  - 상세: 이번 PR 의 실질 로직 변경은 707~717행(부분 객체 `patch` 구성 → `save` → `Object.assign` → `updatedAt` 보정)뿐이지만, 그 자리에 딸린 주석이 28줄 이상 추가돼 메서드가 계속 커지고 있다. 한 메서드 안에 (1) schedule 타입 필드 화이트리스트 검증, (2) notification/chatChannel 안전성 검증, (3) inboundSigningRef 보존, (4) authConfigId 검증, (5) advisory lock 획득 + 재읽기 + config 병합, (6) 부분 객체 `save` + 응답 재구성, (7) 감사 로그, (8) schedule 역동기화, (9) secret 정규화, (10) chatChannel setup + 재조회 — 10가지 책임이 섞여 있고, 그 경로를 오가는 엔티티류 로컬 변수도 `trigger`·`fresh`·`target`·`patch`·`written`·`saved`·`result` 7개에 달해 각각이 어느 시점의 값을 담고 있는지 추적하는 데 비용이 든다. 다만 이 지적은 **1라운드 SUMMARY INFO#6 에서 이미 지적됐고 비차단으로 처분됐다** — 신규 결함이 아니라 기존에 트래킹된 상태가 이번 diff 로 소폭 더 나빠졌다는 관측이다.
  - 제안: 처분 그대로 — 지금 당장 쪼갤 필요는 없다(트랜잭션 콜백 안에서 `target`·`config`·lock 을 공유하는 구조라 분리 시 파라미터 전달이 늘어난다). 다음에 이 메서드를 다시 손댈 일이 생기면 `buildTriggerUpdatePatch()`/`applyWrittenTimestamp()` 류 헬퍼 추출을 우선 검토할 것.

- **[INFO]** Postgres SQLSTATE 매직 스트링이 신규 e2e 파일에 두 번 리터럴로 등장
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` — `① 재읽기 뒤 workflow 삭제` describe 블록의 두 `it` (`'23503'`, `'23502'` 리터럴)
  - 상세: 1라운드 SUMMARY INFO#7 에서 이미 지적됐고 "낮은 우선순위"로 비차단 처분됐다. 이번 라운드에서도 그대로 남아 있음을 확인했다 — 새로 생긴 문제는 아니다.
  - 제안: 처분 그대로 유지. 우선순위를 올릴 근거(예: 같은 코드가 더 늘어난다)가 생기면 그때 지역 상수화.

- **[INFO]** 신규 e2e 파일의 두 helper(`saveAfterCascade`, `saveAfterColumnWrite`)가 "트랜잭션 A 재읽기 → 연결 B 경합 커밋 → A 저장" 골격을 각자 다시 구현한다
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` — `describe('① …')` 안 `saveAfterCascade` 함수, `describe('② …')` 안 `saveAfterColumnWrite` 함수
  - 상세: 둘 다 "트리거 생성 → 트랜잭션 열기 → `rereadLikeWindow1` → 창 B 의 경합 쓰기(`db.query`) → `m.save(Trigger, build(fresh))`" 순서를 반복한다. 차이는 경합 쓰기 내용(FK CASCADE 삭제 vs 컬럼 UPDATE)과 트랜잭션 실패 처리(①은 `.catch` 로 에러를 받아야 하고 ②는 정상 커밋을 기대) 뿐이라 완전한 통합은 오히려 분기 파라미터가 늘어 가독성이 떨어질 수 있다. 중복이지만 각 `describe` 가 스스로 완결된 characterization test 라는 이 파일의 설계 의도(파일 머리말 "이 파일이 단언하는 것은 TypeORM·Postgres 의 동작")를 고려하면 의도적인 명시성-중복 트레이드오프에 가깝다.
  - 제안: 지금 통합할 필요는 없다. 세 번째 유사 helper 가 추가되는 시점에 공용 러너 추출을 재검토.

- **[INFO]** `if (written.updatedAt) target.updatedAt = written.updatedAt;` 방어 분기의 존재 근거가 코드 자체에는 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:716` 부근(diff 상 신규 라인)
  - 상세: 1라운드에서 5개 reviewer(그중 하나가 maintainability)가 공통으로 지적했고 INFO#1 로 이미 수용·주석 보강까지 됐다(715행 "가드는 단위 대역이 넘긴 객체를 돌려줄 때... 지우지 않으려는 것이다"). 지금 다시 읽어도 근거 주석이 남아 있어 재차 지적할 만큼 악화되지 않았다 — 처분이 유효함을 확인한 것으로 기록만 남긴다.
  - 제안: 조치 불요(이미 처리됨, 회귀 없음 확인).

## 요약

핵심 프로덕션 코드 변경(`triggers.service.ts` 의 부분 객체 `save`)은 작고 국소적이며, 1라운드에서 지적된 유지보수성 결함(payload 중복 작성)은 `const patch` 로 정확히 고쳐졌고 재확인했다. 남은 유지보수성 관측은 전부 기존에 트래킹된 항목(메서드 길이·매직 SQLSTATE·방어 분기 근거)의 연장이거나 낮은 우선순위의 신규 관측(e2e helper 소폭 중복)이며, 어느 것도 이번 PR 을 막을 사유가 아니다. 코드베이스 전반의 "설계 근거를 조밀한 주석으로 남긴다"는 확립된 스타일(CHANGELOG·JSDoc·서비스 주석 모두 동일 패턴)과 일관성이 유지되고 있다.

## 위험도
LOW
