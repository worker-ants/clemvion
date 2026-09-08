# RESOLUTION — `review/code/2026/09/08/12_53_08`

**처리 방식**: main 직접 조치 (`resolution-applier` 미위임). Critical **0** · Warning **1** ·
INFO 14 로 분량이 작고, 조치 대상이 전부 이번 배치가 만든 자리라 컨텍스트 이관 이득이 없었다.

**forced coverage**: `--verify-coverage` → **7/7 on disk** (documentation · maintainability ·
requirement · scope · security · side_effect · testing). router 는 architecture · concurrency ·
dependency · user_guide_sync 를 skip — forced 아니므로 정상.

---

## WARNING (1/1 해소)

### W1. `CHANGELOG.md` 미갱신 — **수정함**

이 저장소는 `CHANGELOG.md` 를 *"개발 노트가 아니라 보안 공지"* 로 취급하고, 직전 두 커밋
(`08fbf133d`·`bfa124920`)이 같은 성격 변경에 `## Unreleased` 항목을 남겼다. 지적이 맞다.

`## Unreleased — 가장 넓은 fallback 이 가장 좁았다 (raw 23505 가 500 이었다) + 멤버 목록 투영`
을 최상단에 추가했다. **B-3 과 B-4 만** 적었다 — 나머지 여섯은 리뷰어 판단대로 순수
리팩터/테스트/harness 라 전례상 CHANGELOG 대상이 아니다.

- B-3: 두 표면 대조표 + *"blast radius 실측 0 — 구조적 불일치이지 드러난 버그는 아니었다"*
- B-4: 검출→강제 전환, **쿼리 레벨 투영 ≠ 엔티티 전역 `select: false`** 구분(`12_21_11`
  rationale_continuity INFO#5 가 요구한 문구), wire 계약 불변, 뮤테이션 결과

---

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1 | 전역 필터 매칭 폭 확대 — 릴리스 노트 권장 | **반영** (W1 의 CHANGELOG 항목이 이것이다) |
| 2 | `listMembers` 투영 — 조치 불요 | 확인만 |
| **3** | `production-build-devdep.spec.ts` 반복 `it()` 파라미터화 | **수정** ↓ |
| **4** | 같은 파일 `resolveBuildFileNames()` 반복 호출 | **수정** ↓ |
| 5 | 두 ratchet 순차 실행으로 build wall-clock 증가 | **won't-do** ↓ |
| **6** | `isWrappedByConflictCatch` 가 "이름 등장" 만 본다 | **수정** ↓ |
| **7** | `pgErrorConstraint()` callsite 에 wrap 표면 회귀 없음 | **수정** ↓ |
| 8 | `_cmd_typecheck_ratchets` 배선 자체 미검증 | **won't-do** ↓ |
| 9 | `WorkflowVersionDetailProjection` JSDoc 분량 | 조치 불요 (기존 관례 일치) |
| 10 | `production-build-devdep.spec.ts` 파일 헤더 이력 미요약 | **수정** (INFO#3 과 같은 자리라 겸행) |
| 11 | `--impl-prep` 산출물 동봉 | 정상 워크플로 산출물 |
| 12 | B-1/B-8 문서 재작성 분량 | 조치 불요 |
| 13 | `WorkflowVersionDetailProjection` 개명 영향 0 | 확인만 |
| 14 | `__test-utils__` exclude 안전성 | 확인만 |

### INFO#3 · #4 · #10 — 세 번 복제된 `it()` 을 접었다

같은 형태가 세 번 반복됐다: `repo-guards`(최초) → `shared/testing`(2026-08-27, **exclude 만
추가되고 단언은 안 생겼다**) → `__test-utils__`(2026-09-08). 리뷰어 지적대로 **이 파일 자신의
주석이 "세 번째 자리가 또 생긴다" 고 예견**하고 있었다.

`it.each([['repo-guards', …], ['shared/testing', …], ['__test-utils__', …]])` 로 접고,
`resolveBuildFileNames(backendDir)` 를 `describe` 최상단에서 **1회** 계산해 공유한다
(종전 `it` 마다 `tsconfig.build.json` 재파싱 + 800여 파일 glob 재해석).

> **부수 소득 — `shared/testing` 축은 단언이 아예 없었다.** 2026-08-27 에 exclude 만 추가되고
> 대응 `it` 은 만들어지지 않아, 그 항목이 지워져도 devDep 축이 잡을 때까지 아무도 몰랐다.
> 파라미터화하면서 그 축이 처음 생겼다. 21 → **22 tests**.

### INFO#6 — 술어가 fail-**open** 이었다 (내가 쓴 JSDoc 이 그것을 fail-safe 라 불렀다)

`isWrappedByConflictCatch` 가 `.catch(...)` **전체 텍스트**에 `rethrowEndpointPathConflict` 가
들어 있는지만 봤다. 그러면 **주석·문자열에 이름만 적어 두고 정작 안 부르는 콜백이 "래핑됨"
으로 통과**한다 — 미검출 방향이다. 그 함수의 JSDoc 은 스스로를 *"fail-safe 방향으로
시끄러워진다"* 고 적고 있었는데, **이 케이스에서는 반대였다.**

`cur.arguments.some((arg) => callsConflictWrapper(arg, sf))` 로 좁혔다 — 콜백 인자 안에 그
이름의 **호출식**이 있어야 한다. 이름 해석은 여전히 안 한다(단일 파일 AST).
fixture 에 `mentionsButDoesNotCall` 대조군을 넣어 경계를 고정했다. 6 → **7 tests**.

### INFO#7 — callsite 가 flat 표면만 태우고 있었다

`pgErrorConstraint()` 는 두 표면(`err.constraint` / `err.driverError.constraint`)을 흡수하는데,
cafe24·makeshop callsite 테스트는 **flat 만** 태웠다 — 실전에서 TypeORM 이 주는 것은 wrap 된
쪽이다. 헬퍼 유닛 테스트가 두 표면을 보장해도 *"이 호출부가 헬퍼를 쓰는가"* 는 별개 주장이다.

두 spec 을 `it.each(raceErrorSurfaces)` 로 파라미터화. 96 → **98 tests**.

**뮤테이션으로 비-vacuous 확인**: `pgErrorConstraint` 를 `return e.constraint;` (flat only)로
바꾸면 **정확히 새 2건만** RED, 나머지 96 은 GREEN. 원복 후 98/98 GREEN.

### INFO#5 — won't-do (두 ratchet 병렬화)

측정하지 않은 최적화다. `build` 단계는 이미 docker 이미지 빌드가 지배하고(전체 172s), 두
ratchet 은 그 안에서 순차로 돌아도 유의미한 비중이 아니다. 병렬화하면 두 프로세스의 stderr 가
섞여 **어느 쪽이 깨졌는지** 진단이 나빠진다 — ratchet 은 실패 시 파일 목록을 뱉는 도구다.
필요가 실측으로 드러나면 그때 한다.

### INFO#8 — won't-do (배선 자체의 자동 테스트)

`cmd_build()` 안의 `_cmd_typecheck_ratchets` 배선이 harness 테스트로 고정돼 있지 않다.
리뷰어도 적었듯 **이 저장소의 다른 `cmd_*` 조합도 전부 동일하게 미검증**이라, 이 한 자리만
스텁으로 고정하면 규약이 아니라 예외가 된다. 대신 **이번 PR 에서 실제 실행으로 확인**했다 —
`run-test.sh build` 로그에 `OK: backend 타입 진단 197건 / 36파일` ·
`OK: frontend 타입 진단 52건 / 15파일` 두 줄이 남았다.

---

## 검증 (fix 후 재수행)

| 단계 | 결과 |
|---|---|
| lint | PASS |
| unit | PASS — backend **453 suites / 9,505 passed**(fix 전 9,501 → +4), frontend **289 files / 6,347 passed** |
| build | PASS — ratchet 2개 포함, 둘 다 OK |
| e2e | PASS — backend **300 passed**, playwright **51 passed** |

> e2e 는 fix 전 라운드에서 통과했고, 이번 fix 는 **테스트·문서만** 건드렸다(프로덕션 코드
> 0줄 — `CHANGELOG.md` · `*.spec.ts` · fixture · 가드 판정 로직). 그럼에도 4단계를 다시 돌렸다.
