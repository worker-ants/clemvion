# 테스트(Testing) 리뷰

## 스코프 확인

`git diff origin/main... -- codebase/` 를 직접 열어 대조한 결과, 실행 코드 5개 파일
(`expression-resolver.service.ts`, `expression-resolver.service.spec.ts`,
`secret-resolver.service.ts`, `code.handler.ts`, `code.handler.spec.ts`)의 변경은 **전부
주석**이다. 독립 검증:

```
git diff origin/main... -U0 -- codebase/ | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE '^[+-][[:space:]]*//' | grep -vE '^[+-][[:space:]]*$'
```
→ 출력 0줄. `throw new Error(...)`, `{ cause: err }`, assertion 라인 모두 diff 전후 바이트
단위로 동일함을 확인했다(RESOLUTION.md 의 동일 주장과 일치).

추가로 대상 두 spec 파일을 직접 실행해 회귀를 재확인했다:
```
npx jest expression-resolver.service.spec.ts code.handler.spec.ts --silent
→ Test Suites: 2 passed, 2 total / Tests: 133 passed, 133 total
```
`_test_logs/unit-20260829-012310.log` 도 backend 전체(434 suites / 9035 tests, 1 skipped)가
통과했음을 보여준다 — RESOLUTION.md 의 TEST 결과 주장을 신뢰할 근거가 있다.

나머지 파일(`plan/...md`, `review/code/2026/08/29/01_07_51/**`,
`review/consistency/2026/08/29/01_30_29/**`)은 plan 문서·이전 리뷰 라운드의 산출물이며 실행
코드가 아니므로 테스트 관점의 직접 대상이 아니다. 다만 그 산출물이 스스로 주장하는 조치
내역(WARNING #1 fix, realm 귀속 정정)을 아래에서 실제 코드와 대조했다.

## 발견사항

- **[INFO]** WARNING #1 fix 확인 — 정상 반영됨.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:144` (게이트 기준)
  - 상세: 이전 라운드에서 지적된 "C2 서술이 한정어(`민감`)를 잃고 `속성이 붙지 않는다`로 과잉
    일반화됐다"는 WARNING 이 이번 diff 에서 `...밖에 **민감** 속성이 붙지 않는다`로 정정됐고,
    형제 구현 파일(`expression-resolver.service.ts:318`, `code.handler.ts:456`)과 문구가 일치함을
    `Read` 로 직접 대조 확인했다. 코드 실행 경로는 변하지 않았으므로 회귀 위험 없음.
  - 제안: 없음(확인 완료).

- **[INFO]** C2 기준이 여전히 자동 assertion 으로 강제되지 않는다 (기존 갭의 연속, 신규 아님).
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:147-162`, `codebase/backend/src/nodes/data/code/code.handler.spec.ts:205-234`
  - 상세: 두 테스트 모두 `cause instanceof Error`(또는 `toBeDefined`)와
    `thrown.message.toContain(cause.message)`만 단언하며, 주석이 주장하는 "`cause` 의 own
    property 가 `code`/`position`(또는 `message`/`stack`) 뿐이다"는 어떤 assertion 으로도
    검증되지 않는다. `grep -n "enumerable\|getOwnPropertyNames" *.spec.ts` 로 확인 — 관련 캐너리
    없음. 이 갭은 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 에 "C2 를 단언으로
    잠그기"(INFO #1)로 이미 등재돼 있고, developer SKILL §수렴 예외 (a)~(d) 조건을 근거로 이번
    턴에 고치지 않기로 한 처분이 RESOLUTION.md 에 기록돼 있다 — spec-linked 파일(`spec.ts`)을
    다시 건드리면 방금 통과한 리뷰·`--impl-done` 이 재무장되는 비용을 근거로 든다. 처분 자체는
    합리적이나, "테스트가 커버하지 못하는 경로"라는 사실 관계는 여전히 유효하므로 테스트
    관점에서 재확인해 둔다.
  - 제안: 후속 턴에 `Object.keys(cause).filter(k => !['message','stack'].includes(k))`
    (isolated-vm 케이스) / `code`·`position` 화이트리스트 비교(expression-resolver 케이스) 형태의
    캐너리를 추가해 C2 를 실측 가능한 불변식으로 전환. plan 에 이미 등재돼 있으므로 추가 등재는
    불필요.

- **[INFO]** `cause` 비노출 전역 불변식의 계측 지점 부재 (기존 갭, 이번 diff 는 악화시키지 않음).
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` (§2, "cause 비노출 불변식의 계측
    지점" 항목, 후속으로 남긴 것 블록)
  - 상세: `cause` 부착이 안전하다는 결론 전체가 "저장소 안에 `.cause` 소비자가 없다"는 전역
    부재(negative) 사실에 의존한다. 이 불변식을 지키는 회귀 테스트가 `GlobalExceptionFilter`나
    공용 직렬화 유틸 어디에도 없다 — 향후 APM/구조적 로깅 유틸이 `Error` 를 own-property
    포함해서 직렬화하면 조용히 깨질 수 있는 지점이다. 이미 plan 에 INFO #2 로 등재돼 스코프
    밖(다른 표면을 여는 작업)으로 유예된 상태다.
  - 제안: `GlobalExceptionFilter` 표면을 여는 별도 작업에서 "cause 를 클라이언트 응답에
    노출하지 않는다" 캐너리 1건 추가를 검토(스코프 밖, plan 그대로 유지 권장).

- **[INFO]** realm 귀속 정정(`code.handler.spec.ts:219-231`, `code.handler.ts:454-460`)이 실제
  동작과 일치하는지는 이 diff 자체로는 검증 불가 — 코멘트 텍스트 변경일 뿐 어떤 assertion 도
  이 인과관계("isolate 경계가 아니라 Jest 의 vm 샌드박스 realm 이 원인")를 직접 검증하지
  않는다.
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts:219-231`
  - 상세: 테스트가 검증하는 것은 여전히 "`cause` 가 정의돼 있고 message 를 갖고 원본 message 를
    포함한다"는 관측 가능한 사실뿐이며, 그 원인이 isolate realm 인지 Jest realm 인지는
    assertion 대상이 아니다(그럴 필요도 없다 — 인과 설명은 유지보수자를 위한 문서이지 계약이
    아니다). 다만 이 서술이 다시 틀릴 경우 아무 테스트도 그것을 잡지 못한다는 점은 구조적으로
    당연하다(인과 설명은 테스트 대상이 아니므로 결함이 아니라 관찰).
  - 제안: 없음 — 인과 설명은 테스트로 잠글 성격의 명제가 아니다.

## 항목별 점검 결과

1. **테스트 존재 여부**: 실행 코드 3개 파일의 `cause` 부착/비부착 분기 모두 기존 회귀 테스트가
   존재(2개는 diff 대상 spec, 1개는 diff 밖 `secret-resolver.service.spec.ts:207-229`). 이번
   diff 는 주석만 바꿔 신규 테스트 요구 없음.
2. **커버리지 갭**: C2(민감 속성 부재) 미검증 갭이 유일하며 신규가 아니다(위 INFO). 그 외 코드
   로직 변경이 없어 새로 뚫린 경로 없음.
3. **엣지 케이스**: 변경 없음(주석만).
4. **Mock 적절성**: 해당 없음 — mock 구성 diff 대상 아님.
5. **테스트 격리**: 영향 없음. 두 spec 파일을 단독 실행해 133/133 통과 확인, 다른 스펙과의
   의존성 없음.
6. **테스트 가독성**: 테스트 케이스 앞에 10줄 안팎의 근거 주석이 붙어 다소 무겁지만, "정본
   포인터 + 로컬 근거만 서술"이라는 이번 PR 의 명시적 목적과 일치하며 assertion 자체는 여전히
   3줄 내외로 단순하다. 문제로 보지 않음.
7. **회귀 테스트**: 실행 코드가 diff 전후 바이트 단위 동일함을 직접 grep 으로 확인했고, 대상
   spec 파일을 실행해 133/133 통과, backend 전체 로그로 9035/9035(1 skipped) 통과를 확인했다 —
   회귀 없음.
8. **테스트 용이성**: 변경 없음.

## 요약

diff 5개 실행/스펙 파일은 전부 주석 전용이며 `throw`/`cause`/assertion 라인이 바이트 단위로
동일함을 grep·Read 로 직접 확인했다. 이전 라운드(01_07_51)의 유일한 WARNING(C2 서술 과잉
일반화)은 실제로 정정돼 형제 파일과 문구가 일치했고, 대상 spec 파일을 직접 실행해 133/133,
backend 전체 로그로 9035/9035 통과를 재확인했다 — 회귀 없음. 남은 테스트 갭(C2 미검증 캐너리,
`cause` 비노출 전역 불변식의 계측 부재)은 이번 diff 가 만든 것이 아니라 이전부터 있던 것이고,
이미 plan 에 INFO 로 등재돼 §수렴 예외 근거로 유예돼 있어 이번 라운드에서 추가로 요구할 사항은
없다. 저장소에 뮤테이션을 남기지 않았음을 `git status --short` 로 확인했다(review 세션 산출
디렉터리만 untracked로 존재, 정상).

## 위험도

NONE
