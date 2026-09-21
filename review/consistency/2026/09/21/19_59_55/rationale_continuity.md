# Rationale 연속성 검토

## 검토 대상 요약

- 검토 모드: `--impl-prep`, scope=`spec/5-system`
- 실제 착수 대상 plan: `plan/in-progress/e2e-race-helper.md` (`raceUnderHeldLock()` 테스트 헬퍼 추출)
- 성격: **테스트 전용 리팩터** — `codebase/backend/test/` 아홉 e2e 파일의 동시성 가드
  보일러플레이트를 `codebase/backend/test/helpers/concurrency.ts` 로 추출. plan frontmatter
  `spec_impact: none`, 본문 §D 에 "프로덕션 코드 변경 0" 명시. 실측 확인 결과 해당 헬퍼 파일은
  아직 생성 전(순수 impl-prep 단계).
- bundle 에 전문 포함된 spec: `spec/5-system/1-auth.md` · `2-api-convention.md` ·
  `3-error-handling.md` (+ `0-overview.md`·`1-data-model.md`·`2-navigation/{1-workflow-list,
  2-trigger-list,3-schedule}.md` 의 Rationale 발췌). 나머지 `5-system/*` 는 헤더만(내용 없음).

## 점검 관점별 확인

1. **기각된 대안의 재도입** — 관련 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`
   §5029 이하)에 이 계열의 다른 추출 후보인 `isDeleteMiss()` 류 판별자 유틸이 "2026-09-21 추출하지
   않기로 결정"으로 **명시 기각**되어 있다(근거: 판별 헬퍼가 `!affected` 비교를 감춰 대조군 테스트의
   방어력을 약화시킨다 — `#1371` 에서 대조군 부재 시 뮤턴트 32건 생존 실측). `e2e-race-helper.md` 는
   `raceUnderHeldLock()` 추출만 다루고 `isDeleteMiss()` 류를 재도입하지 않는다 — 기각된 대안과
   무관한 스코프로 확인.
2. **합의된 원칙 위반** — `spec/5-system/4-execution-engine.md` Rationale(admission gate TOCTOU)과
   `2-navigation/2-trigger-list.md`(트리거 config) 등에서 이미 `pg_advisory_xact_lock` 을 확립된
   패턴으로 문서화하고 있고, `1-auth.md`(§1.4.4 "동시성 보호")는 `SELECT … FOR UPDATE` 패턴을
   확립하고 있다. plan §B 실측 표(행 락 6 · advisory lock 2)는 이 두 기존 패턴을 그대로 인정하고
   테스트에서 재현할 뿐, 새 락 전략을 도입하거나 기존 전략을 대체하지 않는다 — 원칙 위반 없음.
3. **결정의 무근거 번복** — plan §B 는 트래커에 이미 등재된 시그니처
   (`fire: () => Promise<T>` 단일 발사)를 `fires: Array<() => Promise<T>>` 로 **번복**한다. 다만
   이 번복은 실측 근거(§B 표: `member-remove`·`webauthn` 둘째 블록이 서로 다른 thunk 두 개를
   발사한다는 것 확인)와 함께 그 자리에서 명시적으로 재-Rationale 화되어 있다
   ("설계 — 트래커 등재분에서 `fire` 를 배열로 고친다(위 실측 때문)"). 형식 요건(번복 시 새
   Rationale 동반)을 충족한 사례로 확인 — 지적 대상 아님.
4. **암묵적 가정 충돌** — plan 은 프로덕션 코드·spec 을 변경하지 않으므로(§D, `spec_impact: none`)
   `1-auth.md` Rationale 에 기록된 시스템 invariant(예: §1.4.E counter 역행 시 강제 삭제, §1.4.D
   TOTP 자동 fallback 금지, §Production fail-closed 가드 등)를 우회하는 설계 요소가 없다. 헬퍼가
   감싸는 락·가드는 이미 병합된 프로덕션 수정(#1373~#1376)의 사후 테스트 재현이며, 헬퍼 자체는
   그 동작을 검증만 하지 변경하지 않는다.

## 부수 확인 (Rationale 연속성 범주는 아니나 교차 확인)

같은 트래커 §5132 항목("이 결함 클래스의 동시성 e2e 파일이 어느 spec 의 `code:` frontmatter 에도
없다")은 **owner: planner** 로 이미 별도 등재되어 있고, 집행 시점에 실재 파일을 다시 열거하라고
명시한다. 이번 `e2e-race-helper.md` 가 만들 `codebase/backend/test/helpers/concurrency.ts` 도
그 열거 대상에 자연히 포함될 것이나, 이는 spec-coverage/등재 문제이지 본 checker 의 네 관점
(기각 대안 재도입·원칙 위반·무근거 번복·invariant 충돌) 에 해당하는 결함은 아니다 — 새 발견사항
으로 올리지 않고 참고로만 남긴다.

## 발견사항

없음 — CRITICAL·WARNING·INFO 대상 모두 미검출.

## 요약

`plan/in-progress/e2e-race-helper.md` 는 이미 병합된 아홉 개 동시성 delete 버그 수정
(#1369~#1376)의 e2e 재현 코드를 정리하는 **테스트 전용, 스펙 불변** 리팩터다. `spec/5-system`
번들 전체(전문 포함 3 개 파일 + Rationale 발췌 5 개 파일)를 대조한 결과, 이 plan 이 기각된
대안(`isDeleteMiss()` 류)을 재도입하거나, 기존 락 전략(advisory lock·`FOR UPDATE`) 원칙을
어기거나, 무근거로 과거 결정을 뒤집는 지점은 없다. 유일한 결정 번복(단일 `fire` → `fires` 배열)은
실측 근거와 함께 plan 본문에 즉시 재-Rationale 화되어 있어 형식 요건을 충족한다. 프로덕션 코드·
spec 변경이 전무하므로 시스템 invariant 우회 위험도 없다.

## 위험도

NONE
