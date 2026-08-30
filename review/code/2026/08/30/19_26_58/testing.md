# 테스트(Testing) 리뷰 — `raw-update-guard-scope-0e154c` (19_26_58, 3라운드)

## 범위 및 검증 방법

`origin/main...HEAD` 누적 diff(42개 파일)를 대상으로 했다. 실질 코드 변경은 `1a12088f2`(트랜잭션
래핑 도입 + 회귀 테스트 2건 신설)뿐이고, 이후 두 커밋(`519671792`, `9d5e001bf`)은 JSDoc/주석/
plan/spec 문서 정정과 직전 두 리뷰 라운드(`17_36_15`, `18_10_28`)의 산출물 커밋이다. 이 두 라운드가
이미 이 정확한 코드(`updateExecutionStatus` else 분기 트랜잭션화 + 신규 테스트 2건)를 테스트 관점
에서 심층 검토했고(`review/code/2026/08/30/17_36_15/testing.md`, `.../18_10_28/testing.md`) —
직접 뮤테이션 검증(트랜잭션 제거 → RED 2, throw 삼킴 → RED 2)까지 실측해 vacuous 아님을 확인해
뒀다. `9d5e001bf`(이번 라운드가 반영하는 유일한 신규 커밋)는 `execution-engine.service.ts` 의
JSDoc 15줄만 고쳤다 — **테스트 코드·프로덕션 로직 변경 없음**(`git show --stat 9d5e001bf` 로 확인:
`execution-engine.service.spec.ts` 미포함).

저장소 파일은 쓰지 않았다(`Read`/`grep`/`git diff`/`git show`만 사용, 뮤테이션 없음). 직접
재실행으로 회귀 여부만 재확인했다:

```
npx jest src/modules/execution-engine/execution-engine.service.spec.ts
→ Tests: 456 passed, 456 total   (2회 연속 실행, 둘 다 456/456, 8.8~9.5s)
```

`18_10_28` testing.md 가 기록한 "6회 중 1회 간헐 실패(재현 안 됨)" 는 이번 2회 실행에서
재현되지 않았다 — 표본이 더 늘었을 뿐 결론을 바꾸지 않는다(계속 기록만, 재조사 트리거는
"반복 관측"이지 이번처럼 재현 실패가 아니다).

## 발견사항

이번 라운드가 반영하는 델타(`9d5e001bf`)는 테스트 대상 코드를 건드리지 않아 신규 Critical/Warning
없음. 아래는 3라운드째 남아 있는 기존 INFO 항목의 상태 확인이며, 전부 이전 라운드에서 이미
"조치 불요"로 처분된 항목이라 재지적이 아니라 **소멸 확인**으로 기록한다.

- **[INFO]** self-deadlock 회귀를 구조적으로 잠그는 테스트가 없다 — JSDoc 서술뿐이다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `public async updateExecutionStatus` 위 JSDoc(`9d5e001bf` 로 "20곳, 전부 트랜잭션 콜백
    밖" 으로 정정된 문단)
  - 상세: `updateExecutionStatus`/`EngineDriver.updateExecutionStatus` 호출부가 이미 열린
    `dataSource.transaction`/`manager.transaction` 콜백 안에서 불리면 self-deadlock 이 된다는
    사실은 JSDoc 산문으로만 기록돼 있고, 이를 강제하는 lint 규칙·정적 가드·회귀 테스트는
    저장소 어디에도 없다(`grep -rln "self-deadlock\|자기.*교착" codebase/backend/src
    codebase/backend/test` → 이 서비스 파일 1건뿐). 향후 어떤 호출부가 자신의 트랜잭션
    콜백 안에서 `updateExecutionStatus`(또는 driver 경유)를 부르도록 바뀌어도, 현재 테스트
    스위트에는 그것을 잡아낼 항목이 없다 — 순수 unit mock 구조상 진짜 커넥션 잠금 대기를
    재현할 수 없어 구조적으로 닫기 어려운 갭이라는 점은 인지하고 있다.
  - 제안: 이미 `17_36_15`/`concurrency.md` INFO 2 · `RESOLUTION.md` 가 "JSDoc 경고로 충분,
    호출부 20곳 전수 대조로 현재 트리거 없음 확인" 으로 명시 처분한 항목이라 **재요청은
    아니다**. 다만 이 처분이 "문서화됐으니 안전"으로 굳어지지 않도록, 다음에 `EngineDriver`
    소비 서비스가 하나라도 자체 트랜잭션을 열고 그 안에서 driver 메서드를 부르게 바뀌는 PR
    에서는 이 JSDoc 문구(호출부 수·"전부 콜백 밖")를 그 PR 이 재검증해야 한다는 점만
    기록해 둔다 — 검증 수단이 사람의 재확인(JSDoc 갱신)뿐이라는 사실 자체가 갭이다.

- **[INFO]** 신규 테스트 2건이 놓인 `describe` 블록명이 여전히 내용과 무관하다 — 미해결, 재확인만
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4491`
    (`describe('admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)', ...)`) 안에
    `it('shape 위반 throw 가 트랜잭션 manager 를 경유해 밖으로 전파된다 (롤백 전제조건)', ...)`
    (`:4812`)와 `it('정상 경로도 트랜잭션 manager 를 경유한다 — 위 롤백 테스트가 공허하지
    않다', ...)`(`:4842`)가 여전히 그대로 있다.
  - 상세: `17_36_15` testing INFO 3 이 지적한 상태 그대로다(동작 영향 없음, 코드 리뷰 3라운드
    모두 "급하지 않음"으로 처분). 새 리더가 `updateExecutionStatus` 트랜잭션 테스트를
    admission/queue-wait-timeout 스펙 안에서 찾아야 하는 가독성 비용은 그대로 남아 있다.
  - 제안: 이전 처분 유지(급하지 않음) — 다음에 이 영역을 손댈 때 하위 `describe` 분리를
    권장. 이번 라운드에서 새로 요구하지 않는다.

## 잘 된 점

- 두 신규 회귀 테스트(롤백 전제조건 + 공허 방지 대조)는 이전 라운드의 뮤테이션 실측(트랜잭션
  제거 → RED 2, throw 삼킴 → RED 2)이 이번 델타(JSDoc-only)로 인해 무효화될 이유가 없다 —
  직접 재실행으로 456/456 유지를 재확인했다.
- `mockTxManagerQuery` → `mockExecutionRepo.query` 위임 설계를 코드로 재확인: `manager.query(sql,
  paramsArray)` 가 정확히 2-인자 호출이라 `(sql, ...rest)` 로 받은 `rest`(1-요소 배열)를
  `mockExecutionRepo.query(sql, ...rest)` 로 재전개하면 원래 시그니처가 그대로 복원된다 — 델리게이션이
  인자 형태를 깨지 않는다.
- `mockExecutionRepo`/`mockTxManagerQuery` 모두 `beforeEach` 에서 매번 새로 생성돼(각각 라인
  275·294 근방) 두 신규 테스트가 명시적으로 재할당하는 `mockExecutionRepo.query = jest.fn(...)`
  가 이전 테스트의 잔여 mock 상태와 섞이지 않는다 — 테스트 격리 문제 없음.
- 테스트 이름(`"...트랜잭션 manager 를 경유해 밖으로 전파된다 (롤백 전제조건)"`)이 `17_36_15`
  testing INFO 1(과대주장 우려)을 반영해 이미 좁혀져 있고, JSDoc 이 "실 DB ROLLBACK 은 mock
  으로 증명 불가" 경계를 명시한 상태 그대로 유지되고 있다.

## 요약

이번 라운드(`19_26_58`)가 반영하는 유일한 신규 커밋(`9d5e001bf`)은 JSDoc 문구 정정(호출부
11→20, "확인의 종류"를 어휘적 범위로 한정)뿐이라 테스트 코드·프로덕션 로직에 변경이 없다.
핵심 변경(`updateExecutionStatus` else 분기 트랜잭션화 + 회귀 테스트 2건)은 직전 두 라운드가
이미 뮤테이션 검증까지 마쳤고, 이번에 직접 2회 재실행해 456/456 유지·이전에 관측된 1회성
간헐 실패 비재현을 확인했다. 신규 Critical/Warning 은 없다. 남은 INFO 두 건(self-deadlock
불변식이 JSDoc 산문으로만 존재하고 구조적 테스트 잠금이 없다는 점, 신규 테스트의 `describe`
배치가 여전히 내용과 무관하다는 점)은 3라운드 연속 관측된 기존 항목으로, 이전 라운드에서
이미 "조치 불요/급하지 않음"으로 명시 처분됐다 — 여기서는 새 조치를 요구하지 않고 상태만
재확인한다.

## 위험도

NONE — 이번 라운드 델타는 테스트 관점에서 영향이 없는 문서 정정뿐이며, 핵심 코드의 테스트
커버리지는 기존 뮤테이션 실측으로 이미 견고함이 확인돼 있다.
