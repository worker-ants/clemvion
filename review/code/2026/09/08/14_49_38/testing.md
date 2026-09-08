# 테스트(Testing) 리뷰 — 배치 B (5라운드, push-gate freshness 확인)

## 검증 방법

이 배치는 이미 4라운드(`12_53_08`→`13_34_28`→`14_01_56`→`14_29_12`) testing 리뷰를 거쳐 Critical
0 을 유지해 왔고, 이번 5라운드는 4라운드 fix(`d80583700`·`ead63d797`·`76bd51aab`) 이후 push 게이트
freshness 확인 라운드다. `git log origin/main..HEAD` 로 6커밋 전부가 이미 이 워킹트리에 있음을
확인했고, 저장소를 뮤테이션하지 않고 실행 검증만 했다(종료 시점 `git status --short` 로 잔여물
없음 확인).

- `npx jest src/common/__test-utils__/source-scan.spec.ts src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts src/repo-guards/__tests__/user-entity-exposure.spec.ts src/repo-guards/__tests__/production-build-devdep.spec.ts src/common/filters/http-exception.filter.spec.ts` → **5 suites / 109 tests 전부 통과**
- `npx jest src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts src/common/db/pg-error.spec.ts src/modules/workspaces/workspaces.service.spec.ts` → **4 suites / 168 tests 전부 통과**
- `enclosingScopeName` 구현(`source-scan.ts`)을 직접 열어 신설 `describe('enclosingScopeName')`(`source-scan.spec.ts`)의 세 갈래(메서드 우선·변수 fallback·`'<module>'`)가 실제 판정 순서와 일치함을 대조
- 신설 `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/`fixture.ts` 를 열어 양성/음성 대조군(래핑 없음·`.catch` 있으나 다른 일을 함·이름만 언급·변수 경유 wrap·다른 리포지토리)이 실제 판정 로직과 1:1 대응함을 확인
- `.claude/tests/test_typecheck_ratchet.py`·`test_install_gate_flags.py` 헤더를 읽어 `_cmd_typecheck_ratchets()` 배선 자체가 harness 자동 테스트 커버리지 밖임을 재확인(아래 참고 항목)

## 발견사항

이번 라운드에서 새로 발견한 Critical/Warning 급 결함은 없다. 4라운드에 걸쳐 이미 식별·처분된
두 항목만 재확인 차원에서 기록한다 — **재지적이 아니라 "여전히 유효한 처분"의 확인**이다.

- **[INFO]** (재확인, 처분 유지) `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets()` → `cmd_build()` 배선 자체는 harness 자동 테스트로 보호되지 않는다
  - 위치: `.claude/test-stages.sh` `_cmd_typecheck_ratchets()` 함수 정의부, `cmd_build()` 안의 `_cmd_typecheck_ratchets &&` 호출부
  - 상세: `scripts/_typecheck_ratchet.py` 판정 코어는 `test_typecheck_ratchet.py` 로 두텁게 커버되지만(baseline 증가·감소 둘 다 실패, 빈 스캔 방지 등), "`cmd_build` 가 실제로 두 스크립트를 호출하는가" 라는 배선 자체는 `.claude/tests/*.py` 어디에서도 검증하지 않는다. 이 배치의 동기(`#1292` — 로컬 14라운드 통과 후 CI 에서 처음 걸림)가 정확히 "배선 누락을 아무도 못 본다"는 문제였다는 점에서 완전히 무관하지는 않다. 다만 1라운드 RESOLUTION(`review/code/2026/09/08/12_53_08/RESOLUTION.md` INFO#8)이 이미 이 지적을 검토해 **won't-do** 로 처분했고, 근거도 타당하다 — 이 저장소의 다른 `cmd_lint`/`cmd_unit`/`cmd_e2e` 조합도 전부 동일하게 미검증이라 이 한 자리만 스텁 테스트로 고정하면 규약이 아니라 예외가 되고, 이번 PR 은 실제 `run-test.sh build` 실행으로 두 ratchet 이 도는 것을 로그(`OK: backend 타입 진단 197건/36파일` 등)로 실측 확인했다.
  - 제안: 조치 불요(기존 처분 유지). 참고용 힌트만 남긴다 — `test_install_gate_flags.py` 가 이미 이 저장소에 "셸 스크립트 안의 특정 호출이 존재하는가"를 grep 으로 정적 대조하는 선례(5개 `pnpm install` 사이트를 플래그로 대조)를 갖고 있으므로, 나중에 `cmd_build` 조합 전체를 검증 대상으로 승격하기로 결정하면 새 패턴을 만들 필요 없이 그 선례를 그대로 확장하면 된다.

- **[INFO]** (재확인, 처분 유지) `TriggerSaveSite` 스캔은 `this.triggerRepository.save(...)` 형태만 잡고, 구조분해 별칭(`const { triggerRepository } = this; triggerRepository.save(...)`) 경유는 놓친다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` — `findTriggerRepositorySaves` 내부 `isPropertyAccessNamed(receiver, TRIGGER_REPOSITORY)` 판정(수신자가 `ts.isPropertyAccessExpression` 이어야 함, 단순 식별자는 매칭되지 않는다)
  - 상세: `receiver` 가 `this.triggerRepository` 처럼 프로퍼티 접근 표현식일 때만 잡히고, 구조분해로 뽑아낸 로컬 변수를 통해 호출하면 스캔에서 빠진다. `review/code/2026/09/08/14_01_56` RESOLUTION 이 이미 이 갭을 INFO#4 로 defer 처리했다 — 저장소 전체(`grep -rn 'const.*{.*triggerRepository.*}.*=.*this'`) 에 그 형태가 0건이고, 가드 자신의 JSDoc(`isWrappedByConflictCatch` 헤더)이 "단일 파일 AST 만 보는 좁고 눈먼 술어"임을 이미 명시하고 있어, 형태가 실재하지 않는 한 새 결함으로 격상할 근거가 없다.
  - 제안: 조치 불요(기존 defer 유지). 실측 재확인: `grep -rn "triggerRepository" codebase/backend/src/modules/triggers/triggers.service.ts` 결과 전부 `this.triggerRepository.*` 형태이고 구조분해 별칭 사용처는 없다.

## 잘 된 점 (참고)

- `enclosingScopeName` 승격 과정에서 3~4라운드가 반복한 "죽은 분기는 지우고, 실재하는 분기는 테스트를 붙인다"는 판단 기준이 실제로 지켜졌다 — `isFn` 우선 분기는 뮤테이션(값을 `false` 로 바꿔도 24/24 GREEN)으로 죽은 코드임을 실측한 뒤 **삭제**했고, 변수 fallback·`'<module>'` 두 갈래는 실재 형태(모듈 스코프 로드)라 `source-scan.spec.ts` 에 `describe('enclosingScopeName')` 로 직접 테스트를 붙였다. 직접 실행해 세 `it` 블록이 실제 판정 순서(메서드 > 변수 > `<module>`)와 정확히 대응함을 확인했다.
- `endpoint-path-conflict-wrap-guard`/`.spec`/`fixture` 3분할은 "현재 저장소가 규칙을 지킨다"와 "이 함수가 위반을 실제로 잡는다"를 분리하는 이 저장소의 확립된 패턴을 정확히 따른다 — fixture 의 `catchButNotWrapping`(체인 존재만으로 통과시키지 않음)·`mentionsButDoesNotCall`(텍스트 매칭이 아니라 호출식 요구, fail-open 방지)·`wrappedViaVariable`(변수 선언 경유 wrap 도 놓치지 않음) 세 대조군이 각각 이전 라운드에서 실제로 발견된 결함 형태를 회귀 고정한다.
- cafe24/makeshop `raceErrorSurfaces` 파라미터화는 1라운드 INFO(callsite 가 `pgErrorConstraint()` 의 wrap 된 표면(`driverError.constraint`)을 검증하지 않음)를 정확히 닫았다 — `it.each` 로 flat/wrapped 두 표면이 동일 callsite 를 통과함을 확인하며, `pgErrorConstraint()` 자신의 유닛 테스트(두 표면 커버)와 "이 호출부가 그 헬퍼를 올바르게 배선했는가"라는 별개 주장을 구분한다는 점을 주석이 명시한다.
- `http-exception.filter.spec.ts` 의 신설 두 테스트("raw 표면 23505 → 409"/"raw 표면 non-23505 → 500 유지")는 넓히는 방향과 좁히는 방향을 각각 잡는 의도된 대조쌍이다. 실행 확인 결과 `isPostgresUniqueViolation` 경로는 `Logger.error`/`warn` 을 호출하지 않아 첫 테스트가 로거 mock 없이도 안전하고, 두 번째(23502→500)는 `mapHttpErrorLike` 가 null 을 반환해 `logger.error` 로 흐르므로 정확히 스파이+`mockRestore` 를 사용한다 — mock 사용이 실제 코드 경로와 어긋나지 않는다.
- `workspaces.service.spec.ts` 의 `listMembers` 투영 테스트는 "반환 키가 좁다"(JS 매핑 축)와 "쿼리가 `select` 로 요청했다"(DB 축)를 의도적으로 분리했다 — CHANGELOG·plan 이 명시한 대로 투영을 되돌려도 반환 키 단언만으로는 초록이 되는 함정을, `opts.select?.user` 가 **객체**(불리언 아님)인지까지 확인하는 별도 단언으로 막는다.
- `webhook-trigger.e2e-spec.ts` B4 는 unit mock 이 원리적으로 검증 못 하는 실 DB UNIQUE 제약 경로를 짚었고, `crypto.randomUUID()` 로 다른 테스트의 `endpointPath` 와 격리되며, `details` 두 키(`field`+`code`)를 함께 단언해 부분 유실을 놓치지 않는다.

## 요약

5라운드째 이 배치를 검토한 결과 새로운 Critical/Warning 급 테스트 결함은 발견되지 않았다. 프로덕션
코드 변화(전역 예외 필터 raw-surface 회귀 수정, `listMembers` DB 투영 전환, 트리거
`endpointPath` 충돌 래핑 AST 래칫, `pgErrorConstraint` SoT 통합, `enclosingScopeName` 승격)
전부에 신규/갱신 테스트가 동반됐고, 핵심 테스트 스위트를 직접 실행해 277건(109+168) 전부 통과를
확인했다. 남은 두 항목(harness 배선 자동 테스트 부재·구조분해 별칭 스캔 갭)은 모두 1·3라운드에서
이미 검토되어 타당한 근거와 함께 명시적으로 defer/won't-do 처분됐고, 이번 라운드에서 그 근거를
반증하는 새 증거를 찾지 못했으므로 재지적하지 않고 확인만 한다. 동작 결함은 5라운드 내내 0건이다.

## 위험도

NONE
