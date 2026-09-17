# 변경 범위(Scope) 리뷰 — `trigger-lock-followups` (commit `79c3f79ce`)

## 검토 방법

`git diff --stat`/`git show --stat HEAD` 로 이 커밋(`main` 대비 최신 1개 커밋, 16개 파일)의
전체 변경 파일 목록을 확보하고, 프롬프트에 실린 unified diff·전체 파일 컨텍스트와 대조했다.
`plan/in-progress/trigger-lock-followups.md`(이 작업 자체의 계획 문서, 5개 항목 표)를 "의도된
범위"의 기준으로 삼았다.

## 발견사항

- **[INFO]** 진짜 결함 수정(④)과 순수 정리 4건이 한 커밋에 묶여 있음
  - 위치: 커밋 `79c3f79ce` 전체 (`trigger-config-lock.ts`의 `affected===0` 처리 vs.
    `findByIdForPatchValidation` 개명·JSDoc 일반화·`timeoutMs` 방어 코드·falsy 분기 테스트)
  - 상세: 항목④(`rewriteTriggerConfigLocked`가 0행 UPDATE를 `true`로 오보하는 lost-update
    변형)는 `plan/in-progress/trigger-lock-followups.md` 자신도 "«계약을 드러내는 정리»가
    아니라 «좁은 실결함»으로 성격이 바뀐다"고 명시한 실제 버그 수정이고, 나머지 4건(①②③⑤)은
    이름·주석·방어심도·테스트 커버리지 정리다. 일반적인 리뷰 관행이라면 버그 수정과 순수
    리팩토링을 커밋으로 분리하는 편이 리버트·bisect에 유리하다.
  - 다만 이는 이 저장소의 명시적 작업 단위 관행이다 — plan 문서가 "developer 범위 후속
    5건"을 하나의 트래커·하나의 PR로 닫도록 설계했고(`#1334`의 후속 표를 한 번에 정리),
    5건 모두 같은 파일(`trigger-config-lock.ts`)의 같은 리뷰 세션(`01_42_04`)에서 나온
    지적이라 응집도가 있다. 스코프 위반이라기보다 이 저장소의 "trailing 5-item batch"
    관행에 부합하는 선택으로 판단해 INFO로만 기록한다.
  - 제안: 조치 불요. 다만 향후 이런 batch PR에서 실결함과 순수 정리가 섞일 경우, CHANGELOG/plan
    양쪽에 이미 하듯 "성격이 바뀐다"는 구분을 명시적으로 남기는 관행을 유지할 것(이번 PR은
    실제로 그렇게 했다 — `trigger-lock-followups.md` §④ 문단 참조).

- **[INFO]** `trigger-transaction-mock.ts`(테스트 유틸)는 plan의 5개 항목 표에 명시적으로
  등재돼 있지 않지만, 항목④의 프로덕션 코드 변경(`m.update(...)`가 `.affected`를 읽게 됨)이
  기존 공용 mock의 `undefined` 반환과 충돌해 서비스 테스트 전부를 `TypeError`로 깨뜨렸기 때문에
  필요해진 종속 수정이다.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
    (`update: jest.fn(async (...) => ... return result ?? { affected: 1 }; ...)`)
  - 상세: plan 체크리스트 항목("- [x] `run-test-all.sh`...")에 "부수 발견"으로 명시적으로
    기록돼 있고, 프로덕션 코드를 `result?.affected`로 느슨하게 만드는 대신 테스트 대역을
    충실하게 고치는 선택 근거도 주석에 남아 있다. 의도 이상의 변경이 아니라 항목④의 직접적
    파급 효과를 막기 위한 필수 수정으로 판단된다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 수정은 이 작업의
  대상 코드와 무관해 보일 수 있으나, 실제로는 이 PR이 반증한 옛 전제("삭제 경로 2곳이 같은
  advisory lock을 공유해 실무적으로 닫혀 있다")를 살아있는 트래커 문서에서 취소선으로 정정하고
  (`--impl-prep 08_58_18` plan_coherence W3의 직접 처분) 새 planner 항목(5b, workflow CASCADE
  다이어그램 누락)을 등재하는 것이다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 표 행 5, 5b 추가)
  - 상세: `developer`는 `plan/**`에 쓰기 권한이 있고, 이 문서는 이 작업의 상위 트래커라
    무관한 파일이 아니다. 원문을 삭제하지 않고 취소선(`~~...~~`)으로 남긴 뒤 실측을
    덧붙이는 방식도 프로젝트 관례(자기-반증형 소정정 조건 4 "인접 서술은 건드리지 않는다")에
    부합한다.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/09/15/08_58_18/**` 7개 파일(`SUMMARY.md`,
  `_retry_state.json`, `meta.json`, `convention_compliance.md`, `cross_spec.md`,
  `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`)이 이 커밋에 포함돼
  있다.
  - 상세: 이들은 코드가 아니라 이 작업 착수 직전에 의무적으로 수행한
    `/consistency-check --impl-prep spec/5-system/`의 산출물이다. CLAUDE.md가 "developer는
    구현 착수 직전 `consistency-check --impl-prep` 의무"라고 명시하고 산출물 저장 위치도
    `review/consistency/**`로 지정하므로, 코드 리뷰 대상 커밋에 이 파일들이 포함되는 것은
    이 저장소의 정상 워크플로다. 내용을 훑어봐도(전체 6개 파일 확인) 이번 작업 범위
    바깥의 내용을 다루지 않는다.
  - 제안: 조치 불요.

## 점검 관점별 결론

1. **의도 이상의 변경**: 없음 — 5개 항목 표와 diff가 1:1로 대응한다.
2. **불필요한 리팩토링**: 없음 — `findByIdForUpdate` 개명은 이름이 "행 잠금"을 거짓 약속하던
   결함 수정이고, plan이 후보 이름(`…ForPatchPrecheck`)까지 토큰 충돌 검사를 거쳐 채택했다.
3. **기능 확장**: 없음 — `timeoutMs` clamp/유한성 검사는 방어 심도이지 새 기능이 아니며, 상한
   값도 기존 상수(`5_000`)를 그대로 쓴다.
4. **무관한 수정**: 없음 — 위 INFO 3건(`trigger-transaction-mock.ts`·트래커 문서·consistency
   산출물)은 모두 이 작업의 직접 파생물이거나 의무 산출물이다.
5. **포맷팅 변경**: 발견 안 됨 — 모든 hunk가 의미 있는 추가/치환이다.
6. **주석 변경**: `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 일반화(항목②)와 개명 근거 JSDoc
   추가(항목①)는 코드 변경(개명·검증 로직 추가)에 직접 결부된 주석이며, plan이 명시적으로
   등재한 항목이다. 무관한 주석 손질 없음.
7. **임포트 변경**: `trigger-config-lock.spec.ts`에 `acquireTriggerConfigLock` 임포트 추가는
   같은 파일에 새로 추가된 테스트가 그 함수를 호출하기 때문이며 정당하다. 미사용 임포트
   추가/제거 없음.
8. **설정 변경**: 없음 — `.eslintrc`·`tsconfig`·`package.json` 등 설정 파일 변경 없음.

## 요약

커밋 `79c3f79ce`는 `plan/in-progress/trigger-lock-followups.md`가 사전에 선언한 5개 항목
(개명·JSDoc 일반화·`timeoutMs` 방어 코드·`affected` 계약 수정·테스트 추가)에 정확히
대응하는 diff로 구성돼 있고, 코드 외 변경(테스트 대역 수정·plan 트래커 정정·
consistency-check 산출물)도 전부 그 5개 항목의 직접 파생물이거나 이 저장소의 의무 워크플로
산출물이다. 무관한 파일·불필요한 리팩토링·포맷팅 뒤섞임·미사용 임포트·설정 변경은 발견되지
않았다. 유일한 관찰은 "실결함 수정(④)과 순수 정리(①②③⑤)가 한 커밋에 묶여 있다"는 점인데,
이는 이 저장소의 batch-followup PR 관행에 부합하고 plan 문서가 그 성격 전환을 스스로
명시했으므로 INFO로만 기록한다.

## 위험도

NONE
