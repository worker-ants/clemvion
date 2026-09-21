# Plan 정합성 검토 — target: `spec/5-system` (--impl-prep)

## 검토 대상 요약

이번 impl-prep 게이트는 `plan/in-progress/e2e-race-helper.md` (동시성 e2e 아홉 파일의
공용 헬퍼 `raceUnderHeldLock()` 추출, `spec_impact: none`, 프로덕션 코드 무변경)의 착수
직전 체크다. 이 plan 은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
"동시성 e2e 아홉 파일의 공용 헬퍼를 추출한다 — 테스트 전용 PR" 항목(아홉 번째 PR 착수
게이트 **결정 1**)을 집행하는 자식 plan이다.

## 발견사항

- **[INFO]** 부모 tracker 의 `integration-rotate-concurrency` 서브 결정이 아직 미반영
  - target 위치: 해당 없음 (target `spec/5-system` 자체에는 이 내용이 없음 — plan 간 정합)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5054-5055`
    (`integration-rotate-concurrency` 는 "삭제가 아니라 갱신 경합이라 **별도 판단**(같은
    가드를 쓰는지 먼저 볼 것)" 로 미결 상태 서술) vs
    `plan/in-progress/e2e-race-helper.md` §B "`integration-rotate-concurrency` 는
    **제외한다**" (판단 완료, 근거: 요청 1건만 발사·락과 가드 사이에 UPDATE 개입·
    `{settled: boolean}` 반환 형태 상이)
  - 상세: 자식 plan(`e2e-race-helper.md`)이 부모 tracker가 "먼저 볼 것"이라 미뤄둔 판단을
    이미 실측(코드 확인 결과 `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts`
    가 single-fire·update-merge 구조임을 실제로 확인)으로 내렸으나, 그 결론이 아직 부모
    tracker 본문에 미러링되지 않았다. 지금 이 라인만 읽으면 여전히 "미결" 로 보인다.
  - 제안: 충돌은 아니다(해소 방향 일치, 자식이 실제로 근거를 실측해 내림) — 다만
    `e2e-race-helper.md` 체크리스트의 마지막 항목("트래커 항목 해소")을 집행할 때
    `spec-draft-nullable-notation-followups.md:5054-5055` 문구도 같은 커밋에서
    "제외 확정" 으로 정정할 것. 지금 시점에 착수를 막을 이유는 아니다.

- **[INFO]** 헬퍼 시그니처가 tracker 초안과 달라짐 (근거 있는 정당한 개정)
  - target 위치: 해당 없음
  - 관련 plan: `spec-draft-nullable-notation-followups.md:5043-5050` (`fire: () => Promise<T>`,
    단일 콜백) vs `e2e-race-helper.md` §B (`fires: Array<() => Promise<T>>`, 배열)
  - 상세: 착수 전 실측(§B 표)에서 "10/11 은 같은 thunk 두 번이지만 webauthn 둘째 블록만
    서로 다른 thunk 를 쏜다"는 사실이 드러나 시그니처를 배열로 바꿨다. 이는 트래커가
    남겨둔 "결정 1"(추출 여부)을 우회한 것이 아니라 그 집행 중 발견한 세부 조정이며,
    plan 자신이 근거를 명시하고 있다.
  - 제안: 완료 시 tracker 미러링 문구(위 항목과 동일 커밋)에 최종 시그니처도 함께
    갱신해 다음 사람이 낡은 `fire` 단일 콜백 스케치를 참조하지 않도록 할 것.

- **[INFO, 참고 — 이 plan 과 무관한 기존 drift]** `spec/5-system/3-error-handling.md`
  §1.11 "이 저장소에서 유일한 예외다" 가 이미 반증된 채 미정정 상태
  - target 위치: `spec/5-system/3-error-handling.md` §1.11 (원문 인용: "이름은 `_NOT_FOUND`
    지만 404 가 아니다 — **이 저장소에서 유일한 예외다**")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4997-5027`
    (`3-error-handling.md §1.11` 항목, planner 소유, "중간" 우선순위, 아직 `- [ ]`)
  - 상세: 해당 plan 항목이 실측으로 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 두 번째 예외이며
    (그것도 더 나쁜 형태 — 동일 코드가 401/404 둘 다로 나감) §1.11 의 "유일한" 서술이
    거짓임을 이미 확정했고, target 문서(§1.11)는 아직 그 정정을 반영하지 않았다.
    `spec_impact` 목록에는 `spec/5-system/3-error-handling.md`·`1-auth.md` 가 이미
    올라 있어 "누락된 추적" 은 아니다 — planner 턴을 기다리는 중인 정상적인 미결 상태다.
  - 제안: 이번 `e2e-race-helper.md` (test-only, 프로덕션/spec 무변경)와는 무관하므로
    이 게이트를 막을 이유는 아니다. 별도 planner 턴에서 처리될 항목임을 재확인하는
    참고 메모로만 남긴다.

## 정합성 확인 (문제 없음으로 판정한 것들)

- **선행조건 충족 확인**: `e2e-race-helper.md` 가 전제하는 "아홉 번째 PR(#1376) 착수 게이트
  결정" 은 실제로 git 이력에 존재한다 — `3cbb4a1dc`(webauthn, 아홉 번째)·`890fcd9b7`
  (model-config, 여덟 번째)·`c9f0e1a75`(auth-configs, 일곱 번째) 모두 이 worktree HEAD 이전에
  머지됨. `spec-sync-auth-gaps.md:215-223` 이 서술하는 "남은 둘(ModelConfig·WebAuthn)" 도
  이 커밋들로 해소됐다.
- **결정 2(판별자 유틸 미추출)와 충돌 없음**: `e2e-race-helper.md` 는 프로덕션 코드를
  건드리지 않으므로 이미 "추출하지 않기로 결정" 된 `isDeleteMiss()` 류와 무관하다.
- **spec frontmatter 정합**: `1-auth.md` 의 `pending_plans: [spec-sync-auth-gaps.md]` 는
  §1.3 LDAP/SAML 미구현 surface 때문이며 여전히 유효하다. `spec-draft-nullable-notation-
  followups.md` 가 `1-auth.md`/`3-error-handling.md` 에 미치는 항목들은 §2.1 기준
  "미구현 surface" 가 아니라 문서 정정이라 `pending_plans` 의무 대상이 아니다(정상).

## 요약

`e2e-race-helper.md` 는 테스트 전용 리팩터(`spec_impact: none`)로 target `spec/5-system`
에 직접적인 변경이나 충돌을 일으키지 않는다. 이 plan이 전제하는 선행 조건(아홉 자리 동시
삭제 중복 감사 결함의 완료)은 git 이력으로 확인되며, 착수 게이트가 요구한 두 결정(헬퍼
추출 여부·`isDeleteMiss()` 판별자 유틸 미추출)도 이미 근거와 함께 내려져 있다. 남은 것은
사소한 문서 동기화뿐이다 — 부모 tracker(`spec-draft-nullable-notation-followups.md`)의
`integration-rotate-concurrency` 서브 결정과 헬퍼 시그니처 스케치가 자식 plan 의 최종
결론을 아직 미러링하지 않았는데, 이는 이 plan 자신의 마지막 체크리스트 항목("트래커 항목
해소")에서 자연히 닫히도록 설계돼 있어 착수를 막을 사안이 아니다. 이 검토와 무관하게
`3-error-handling.md §1.11` 의 "유일한 예외" 서술이 이미 반증된 채 별도 planner 턴을
기다리고 있다는 점은 참고로만 남긴다.

## 위험도

LOW
