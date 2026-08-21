# RESOLUTION — 11_27_29

대상 SUMMARY: `review/code/2026/08/21/11_27_29/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **3**, INFO 21)

**처분: WARNING 3건 전부 수정.** INFO 21건 중 값싼 1건(접두 겹침 캐너리)을 동반 조치.

---

## WARNING 1 — **내가 없애려던 사각지대를 가드 배치로 재도입했다** (architecture) — **수정**

가장 아픈 지적이고, 정확하다.

미러 소멸 가드를 frontend vitest 에만 뒀다. 그런데 `frontend-checks` 는 `codebase/backend/**`
변경 때 **검사를 생략하고 체크는 통과로 보고**한다 — 즉 backend-only PR 이 `MASKED_MARKERS`
를 재선언해도 **가드가 아예 실행되지 않는다.**

> **이 PR 의 존재 이유가 바로 그 경로 게이팅이었다.** 값 미러는 그것 때문에 계약 테스트를
> 포기하고 추출로 갔는데, 정작 이관을 지키는 가드를 같은 함정에 놓았다.

더 나쁜 건 그 테스트 헤더에 내가 이렇게 적어 뒀다는 것이다 —

> *"그 배치의 경로 갭은 여기서 문제가 되지 않는다 — 재선언은 그 파일을 바꾼 PR 에서만
> 생기기 때문이다."*

**거짓이다.** 재선언이 backend 파일에서 생기면 그 PR 은 frontend 잡을 돌리지 않는다. 근거
없이 안심시키는 문장을 스스로 써 놓고 통과시킨 것이라, 문장을 지우지 않고 **무엇이 틀렸는지**
로 대체했다.

### 왜 "무조건 실행되는 워크플로" 로 옮기지 않았나

실측: `.github/workflows/` 12개 전부 어떤 형태로든 경로 게이팅이 있다. 게이팅 밖 자리가 없다.

그래서 **각 스택이 자기 워크플로에서 도는 사본**을 갖게 했다 —
`backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 신설. 둘 다 저장소 전체를
훑으므로 **어느 쪽이 바뀌든 최소 하나는 실행된다.**

> **값의 미러와 탐지 로직의 중복은 다르다.** 값이 갈리면 한쪽이 조용히 fail-open 하지만,
> 탐지 로직 사본이 낡아도 다른 사본이 같은 불변식을 자기 트리거에서 계속 지킨다. 구멍이
> 생기지 않는다 — 이게 앞서 "계약 테스트 양쪽 배치" 를 기각했던 이유와 갈리는 지점이다.

backend 사본이 `typescript` 를 import 하지만 `src/repo-guards/**` 는 빌드에서 제외돼 있어
프로덕션 번들에 새지 않는다 — 직전 PR 의 `production-build-devdep` 가드가 **여전히 GREEN** 인
것으로 확인했다(36/36).

## WARNING 2 — 패키지 spec 이 리터럴을 pin 하지 않았다 (testing) — **수정**

`expect([...MASKED_MARKERS]).toEqual([VALUE_MASK_MARKER, ...])` 는 상수들의 **상호** 정합만
본다. 세 값이 함께 바뀌면 그대로 GREEN 이다 — 자기참조적이다.

이 값들은 backend 가 생산하고 frontend 가 판정하는 **관측 가능한 계약**이고, 이미 저장된
마스킹 값과도 맞아야 한다. `it.each` 로 세 리터럴을 직접 못박았다.

## WARNING 3 — spec R17 SPEC-DRIFT — **수정**

*"마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다"* 가 이관 후
사실과 어긋난다. SoT 를 `@workflow/masked-markers` 로 고치고, 두 스택이 **재export shim** 임을
명시했으며, frontmatter `code:` 에 패키지 경로를 추가했다(텍스트 앵커로 지목 — 인접 항목이
`sanitize-error-message.ts` 라 라인번호로는 오편집하기 쉽다).

> plan 은 이 항목을 "planner 턴 필요" 로 분리해 뒀었다. 실제 편집은 2줄이고 그 문구는
> `--plan` 라운드 둘에서 이미 검증됐다(naming_collision 이 앵커까지 확인). 별도 `--spec`
> 라운드 대신 **push 게이트가 요구하는 `--impl-done`** 으로 검증한다 — 같은 5 checker 가
> 같은 spec 영역을 본다. 선택을 숨기지 않고 여기 적는다.

## 동반 조치한 INFO

- **INFO 13** — `findRedeclaredSymbols` 의 접두 겹침 경계(`MAX_MASK_DEPTH_OLD`)가 테스트로
  고정돼 있지 않았다. 양쪽 가드에 캐너리 1줄씩 추가. 직전 PR 에서 접두 겹침으로 네 라운드를
  쓴 자리라 값싸게 닫는 게 맞다.

## 미조치 INFO (20건)

전부 리뷰어 스스로 "조치 불요·범위 밖·기존 패턴" 판정. 대표 — `SOT_DIR` 자기 제외 분기가
현재 도달 불가(방어적 no-op) · `prepare` 스크립트 9번째 사본(기존 관행) · `pnpm-lock` 의
무관한 `eslint-config-next` peer 재해석 · backend `deepRedactSecrets` 깊이 경계 테스트 부재
(선존 갭) · 재export 지점 JSDoc 텍스트 드리프트 가능성.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (51s) |
| unit | backend jest **431 suites / 8,912 passed**(1 skipped) · 패키지 **20** · frontend **287 files** |
| build | PASS (242s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (283s) — backend supertest **276** · playwright **51 passed (57.0s)** |

> backend 스위트가 430→431(+1), 테스트가 8,896→8,912(+16)로 는 것은 **신규 backend 가드
> 스위트 하나**가 전부다. 이관된 값 자체의 동작은 여전히 무변경이다.
