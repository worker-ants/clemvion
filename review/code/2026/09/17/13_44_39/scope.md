# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main..HEAD`(14 files, +1017/-17)와 프롬프트 번들의 unified diff/전체 파일 컨텍스트를 대조해, 프롬프트에 실린 변경분이 실제 diff 전체와 일치함을 먼저 확인했다. 대상은 코드 4건(`triggers.service.ts`·`triggers.service.spec.ts`·`trigger-transaction-mock.ts`·신규 e2e-spec), 문서 2건(`CHANGELOG.md`·신규 plan), 하네스 산출물 8건(`review/consistency/2026/09/17/13_04_39/**`, `--impl-prep` consistency-check 결과)이다.

## 발견사항

### [INFO] 공용 테스트 mock(`trigger-transaction-mock.ts`)의 `save` 동작 변경이 diff에 없는 3개 소비 파일에 영향
- 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:124-133`
- 상세: `save` mock 을 동기 forwarding 에서 `async` + `result ?? target` 반환으로 바꿨다. 파일 상단 JSDoc(변경되지 않은 기존 컨텍스트, 41-47행)에 따르면 이 헬퍼는 `triggers.service.spec.ts` 외에도 `triggers.web-chat.spec.ts`·`schedules.service.spec.ts`가 같은 트랜잭션 mock 경로를 쓴다. 이번 diff 에는 이 3번째 소비처들의 spec 파일 변경이 포함돼 있지 않다 — 즉 공용 유틸의 동작을 프로덕션 코드 수정(반환값의 `updatedAt` 소비)에 맞춰 넓혔는데, 그 여파가 다른 두 spec 파일에 실제로 관측되는지는 이 diff 만으로는 확인할 수 없다.
- 다만 이 변경 자체는 scope 이탈이 아니다 — 주석(128-130행)이 왜 필요한지(`TypeError` 방지)를 명확히 설명하고, 대응하는 plan 체크리스트(`plan/in-progress/trigger-save-partial-patch.md` 150-151행)가 "`run-test-all.sh` 4단계 ALL PASS(unit 14·e2e 314)"를 실측으로 기록해 다른 소비처가 깨지지 않았음을 이미 검증한 것으로 보인다. 범위 판단상 이 사실을 짚어 두는 정도의 INFO다.
- 제안: 별도 조치 불요. 리뷰 기록 목적의 참고 사항.

## 범위 준수로 평가되는 지점 (긍정 관찰)

- `triggers.service.ts` 변경은 단일 hunk(`update()` 창 1의 `save` 호출부)에 국한되며, import·설정·무관 로직 변경이 없다.
- `triggers.service.spec.ts`도 단일 hunk로 대상 동작(저장 필드 범위·반환값 처리)에 직접 대응하는 두 테스트만 수정/추가했다.
- `CHANGELOG.md`는 기존 저장소 관례(직전 커밋들과 동일한 "## Unreleased — …" 서사 포맷)를 그대로 따르며 포맷팅 변경이 섞여 있지 않다.
- 신규 e2e 파일은 이번 수정의 근거(락 밖 컬럼 갱신·CASCADE·반환값 모양)만 검증하며, 인접 파일(`trigger-config-lost-update.e2e-spec.ts`)과의 책임 경계를 JSDoc에 명시해 중복 테스트를 만들지 않았다.
- plan 파일이 `## 이 PR 이 안 하는 것` 섹션에서 spec(`2-trigger-list.md`) 수정을 명시적으로 **제외**하고 role 경계(`developer`는 자신이 쓰지 않은 예고 문장을 못 고침)에 따라 planner 턴으로 미뤘다 — scope 규율이 스스로 문서화돼 있다.
- `review/consistency/2026/09/17/13_04_39/**` 8개 파일은 프로젝트 규약상 `--impl-prep` 의무 게이트의 산출물이며 코드 스코프 밖 "임의 확장"이 아니다.
- 주석·문서가 길지만 전부 이번 버그(락 밖 컬럼 되돌림, 반환값 오해로 인한 회귀)의 원인·근거·실측을 설명하는 데 쓰였고, 무관한 리팩토링·주석 잡담은 발견되지 않았다.

## 요약

이 PR은 "창 1의 통째 `save`가 락 밖에서 커밋된 컬럼을 되돌린다"는 단일 결함과 그 수정 과정에서 스스로 낸 회귀(반환값 오해)만을 다루며, 코드 변경이 정확히 그 지점(하나의 hunk)에 국한돼 있다. 테스트 유틸·단위테스트·e2e·CHANGELOG·plan 문서 변경은 모두 그 수정에 직접 대응하고, spec 변경은 role 경계를 지켜 의도적으로 이번 PR 범위에서 제외했다고 명시했다. 유일하게 짚을 점은 공용 mock 변경이 diff에 없는 다른 spec 파일에도 영향을 줄 수 있다는 것인데, plan에 기록된 전체 테스트 스위트 통과 실측이 이를 뒷받침한다. 전반적으로 범위 이탈·불필요한 리팩토링·무관한 수정은 발견되지 않았다.

## 위험도
NONE
