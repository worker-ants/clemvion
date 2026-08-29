# 요구사항(Requirement) 리뷰 결과

## 검증 방법

이번 diff 는 이전 리뷰 라운드(`review/code/2026/08/29/01_07_51`)의 유일한 WARNING(#1: C2 서술
과잉 일반화 — "message·name 밖 속성이 없다" 로 한정어 "민감" 이 탈락)과, 그 라운드에서 함께 밝혀진
"realm 귀속 오류"(`code.handler` cross-realm 설명)에 대한 수정(RESOLUTION.md 기재)이 실제
소스에 반영됐는지, 그리고 5곳의 `cause` 부착/비부착 판단 주석이 `spec/5-system/3-error-handling.md`
§6.3.1 과 line-level 로 정확히 일치하는지를 저장소를 직접 열어 대조했다 (읽기 전용, 뮤테이션 없음).

- `spec/5-system/3-error-handling.md` §6.3.1 원문(C1: 감싼 message 가 원본을 이미 포함, C2: `err`
  가 message·name **밖의 민감 정보를 속성으로 들고 있지 않다**)을 직접 Read.
- `expression-resolver.service.ts:316-321`, `expression-resolver.service.spec.ts:136-146`,
  `code.handler.ts:454-460`, `code.handler.spec.ts:198-231`, `secret-resolver.service.ts:86-100`
  현재 상태를 Read 하여 diff 반영 여부와 spec 대조.
- `packages/expression-engine/src/errors.ts` 를 열어 `ExpressionError` 의 실제 own property(
  `code: ErrorCode`, `position?: number`)가 주석의 실측 서술과 정확히 일치하는지 확인.
- `secret-resolver.service.spec.ts:201-229` 를 열어 비부착 사례(§6.3.1 지목)의 회귀 테스트가
  `cause` 부재를 실제로 단언하는지 확인.
- `grep -rn "밖 속성이 없다\|밖에 속성이 없다\|밖의 속성이 없다"` 로 전 저장소에 한정어 탈락형
  잔존이 없는지 확인 — 0건.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 가 인용하는 `plan/complete/spec-draft-error-cause-criterion.md`,
  `review/consistency/2026/08/29/01_30_29`(BLOCK: NO) 경로를 직접 `ls`/Read 로 실측 대조 — 전부 일치.
- `RESOLUTION.md` 가 인용하는 `_test_logs/lint-20260829-012213.log` 등 3개 로그 파일의 실존과
  backend 유닛 테스트 스위트 결과(434 suites / 9035 tests, 1 skipped 9034 passed)를 확인.
- `git status --short` 로 뮤테이션 없음 확인(리뷰 세션 자신의 출력 디렉터리만 untracked).

## 발견사항

- **[INFO]** C2 조건("message·name 밖 민감 속성 없음")이 여전히 자동 단언으로 강제되지 않는다 —
  `cause`(`ExpressionError`/`isolated-vm` `SyntaxError`)의 own enumerable key 목록을 검증하는
  캐너리가 없어, 향후 이 두 예외 타입에 민감 속성이 추가돼도 RED 가 나지 않는다. 이는 신규 결함이
  아니라 이전 라운드(01_07_51)에서 이미 INFO #1 로 지적되고 `plan/in-progress/deps-peer-gating-and-eslint10.md`
  §2 에 `[ ]` 로 등재된 항목이 그대로 남아있는 상태다(수렴 예외 (a)(b)(c)(d) 근거 제시됨 — spec-linked
  파일을 다시 건드리면 방금 통과한 리뷰·`--impl-done` 이 freshness 로 재무장되는 비용 때문에 후속으로
  미룸). 재지적이 아니라 상태 확인 차원에서 기록.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (해당 `it` 블록), `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (해당 `it` 블록)
  - 제안: 조치 불필요(이미 후속 트래커에 등재·정당화됨). 다음에 이 파일들을 열 때 캐너리 추가 검토.

- **[INFO]** 관련 spec 본문(`spec/5-system/3-error-handling.md` §6.3.1) 대조 결과, 5곳(소스 3 +
  spec 2)의 주석이 C1/C2 정의·비부착 정본 사례(`SecretResolverService.resolve`)를 line-level 로
  정확히 반영하고 있음을 확인 — spec fidelity 이상 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316-321`,
    `codebase/backend/src/nodes/data/code/code.handler.ts:454-460`,
    `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:89-99`
  - 제안: 없음(확인 기록).

이전 라운드가 지목한 WARNING(#1, C2 한정어 탈락)과 그 확장(자매 2곳)은 현재 소스에서 모두
"민감" 한정어를 포함한 정확한 서술로 교정돼 있음을 확인했다(예:
`expression-resolver.service.spec.ts:142`의 "message·name 밖에 **민감** 속성이 붙지 않는다" +
"한정어 없이 '속성이 없다' 로 적으면 거짓이다 — `ExpressionError` 는 `code`/`position` 을 갖는다").
`code.handler.ts`/`code.handler.spec.ts` 도 동일 패턴으로 교정됐고, `secret-resolver.service.ts`
에는 "C1 이 거짓이므로 C2 는 판정 불요" 한 줄이 추가돼 형제 3곳과 형식이 통일됐다. 별도 회귀로
남길 CRITICAL/WARNING 은 발견되지 않았다.

## 요약

이번 변경분(codebase 5개 파일 + plan 1개 + review 산출물 19개)은 실행 로직을 전혀 바꾸지 않는
주석/문서 정리이며, 핵심은 이전 리뷰 라운드가 지적한 "C2 서술이 spec §6.3.1 원문의 '민감' 한정어를
떨어뜨려 과잉 일반화됐다"는 WARNING 을 수정 커밋(`8d7ce96a7`)이 정확히 고쳤는지 검증하는 것이었다.
소스를 직접 열어 대조한 결과 3곳(spec.ts 1 + code.handler 계열 2)이 모두 한정어를 회복했고,
`ExpressionError`/`isolated-vm` 예외의 실제 own property 서술도 `packages/expression-engine/src/errors.ts`
실물과 정확히 일치한다. `code.handler` 의 cross-realm 귀속 정정(“isolate 경계”→“Jest realm”)도
plan·주석·RESOLUTION.md 세 곳이 일관되게 반영돼 있다. plan 파일의 자기반증 정정(“등재됐다고 한 것이
거짓이었다”)도 실제로 대응 항목이 §2 에 다시 등재돼 있음을 확인했다. 기능적 결함, 의도-구현 괴리,
spec 불일치는 발견되지 않았다. 유일한 잔여 사항(C2 미검증 캐너리 부재)은 이미 이전 라운드에서
INFO 로 식별돼 정당한 근거로 후속 트래커에 등재된 상태이므로 이번 라운드에서 새로 지적할 사항이
아니다.

## 위험도
NONE
