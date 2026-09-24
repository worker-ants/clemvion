# 유지보수성(Maintainability) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정 (3라운드)

이 diff 는 `review/code/2026/09/24/08_09_57`(1라운드) → `06aa6d5e1`/`44d5dc429`(조치) →
`review/code/2026/09/24/08_46_47`(2라운드) → `24f7a1ddf`(조치)를 모두 포함한 전체 변경분이다.
1·2라운드 모두 위험도 LOW로 수렴했고, 이번 3라운드의 실질적 신규 변경분은 `24f7a1ddf` 하나뿐이다
(2라운드 W1이 지적한 완전 중복 단위 테스트 블록 제거). 아래는 그 신규분과 전체 diff를 함께
독립적으로 재확인한 결과다.

## 발견사항

- **[INFO]** `24f7a1ddf`(중복 테스트 제거)는 새 결함을 만들지 않았다 — 검증 완료.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (`'진 쪽은 404 이고 감사를 남기지 않는다'` 블록의 JSDoc, `'DELETE 시점에 행이 사라졌으면 404 다'` 블록 삭제)
  - 상세: 2라운드 W1이 지적한 대로 두 블록(`재조회=null`)이 mock·단언까지 완전 동일했다. 삭제된 쪽 대신 남은 블록의 JSDoc에 "왜 중복이 생겼는지"와 "이 블록이 맡는 역할 둘"을 적어 정보 손실 없이 정리했다. 커버리지 손실도 뮤턴트(`if (still) → if (true)`, 예측 1/실측 1)로 직접 확인했다 — 근거가 반증 가능한 형태로 남아 있다.
  - 제안: 조치 불요.

- **[INFO]** `removeMember()` DELETE 문 앞 인라인 주석(24줄, `workspaces.service.ts:830~853`)이 메서드 JSDoc(`:802~809`)의 "동시성 보장" 요약과 상당 부분 겹친다 — 실행 코드는 5줄(`:854~858`)인데 앞선 주석이 그 5배에 가까워 함수 흐름(가드 → DELETE → 0-분기 → 감사)을 눈으로 좇기 전에 긴 서술을 통과해야 한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:830-853` (인라인) vs `:805-809` (JSDoc)
  - 상세: 완전 중복은 아니다 — JSDoc은 "무엇을 막는가"(둘: 감사 중복·owner 삭제)를 요약하고, 인라인은 "왜 이 문장 하나로 원자적인가"(EvalPlanQual)와 `4-execution-engine.md §8`과의 차이를 상세히 설명한다. 다만 저장소 다른 곳(`concurrency.ts`의 `raceUnderHeldLock`/`VACUITY_GUARD_MS` 등)도 근거·선례·기각 사유를 인라인에 남기는 것이 확립된 컨벤션이라, 이 파일만의 이례적 편차는 아니며 일관성 위반도 아니다. 2라운드에서 이미 같은 관찰이 있었고 이번 라운드에서 변경되지 않았다.
  - 제안: 조치 불요. 이 메커니즘(EvalPlanQual 근거)이 바뀌면 JSDoc·인라인 주석·`plan/in-progress/member-owner-toctou.md §B` 세 곳을 동시에 갱신해야 한다는 점만 인지할 것.

- **[INFO]** 재진입 락 오케스트레이션 보일러플레이트가 두 e2e 파일(`integration-rotate-concurrency.e2e-spec.ts`, `member-remove-concurrency.e2e-spec.ts`)에 여전히 손으로 복제돼 있다 — 신규 결함이 아니라 기존에 등재된 유예 항목의 재확인.
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:231-275`(`BEGIN → FOR UPDATE → 발사 → 공허성가드 → mutate → COMMIT → finally ROLLBACK+드레인`)
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md`(재진입 보일러플레이트 항목)에 "세 번째 자리가 생기면 그때 뽑는다"는 숫자 임계값과 후보 이름(`reenterUnderHeldLock`)까지 이미 등재돼 있고, 지금(둘뿐)은 파라미터화 비용이 공유 이득보다 크다는 근거(`#1377`의 `raceUnderHeldLock` 설계 판단 인용)도 함께 남아 있다. 이번 라운드에서 세 번째 자리가 새로 생기지 않았으므로 상태 변화 없음.
  - 제안: 조치 불요 — 세 번째 자리가 실제로 생길 때 재확인.

## 확인한 양호 사항

- `throwCannotRemoveOwner()` 추출(`workspaces.service.ts:349-360`)은 바로 위 `throwMemberNotFound()` 세 벌 복제 선례를 명시적으로 인용해 같은 실수를 예방한다.
- `removeMember()`는 여전히 같은 파일의 `deleteWorkspace`·`transferOwnership`과 비슷한 크기이고, 분기 수(멤버 부재·자가탈퇴 위임·owner 조기가드·0-affected 이유 판별)도 5개 내외라 과도한 순환 복잡도는 아니다.
- `VACUITY_GUARD_MS` export(1라운드 W5 조치)가 두 e2e 파일에서 그대로 유지되고 있어 매직 넘버 재발이 없다.
- 단위 테스트 중복 제거(`24f7a1ddf`) 이후 남은 세 블록(진 쪽 404 / owner 승격 403 / 강등 후에도 403)이 서로 다른 뮤턴트를 겨냥해 명확히 분리돼 있고, 겹치는 부분이 없다.
- 워크트리 오염 없음 — 이번 리뷰는 `Read`/`grep`/`git status`로만 확인했고 저장소 파일을 수정하지 않았다(`git status --short` 결과 `review/code/2026/09/24/09_10_41/`만 표시, 다른 변경 없음).

## 요약

이번 3라운드 diff의 실질 신규분(`24f7a1ddf`)은 직전 라운드가 지적한 완전 중복 단위 테스트 블록을 근거(뮤턴트 재확인 포함)와 함께 정리한 것으로, 유지보수성 관점에서 개선이며 새로운 결함을 만들지 않았다. 전체 diff를 다시 훑어도 함수 길이·중첩 깊이·네이밍·매직 넘버·컨벤션 일관성 모두 이 저장소 기존 규모에 부합하고, 남은 관찰(JSDoc/인라인 주석의 정보 중첩, 재진입 보일러플레이트 2회 복제)은 전부 이미 근거·임계값과 함께 문서화된 상태로 병합을 막을 사유가 아니다.

## 위험도

LOW
