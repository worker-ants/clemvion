# RESOLUTION — `12_05_39`

리뷰 결과: **CRITICAL 0 / WARNING 2 / RISK LOW**. reviewer 9명 실행, 강제 8명 전원 결과 확보
(`forced_missing: []`, `unfinished: []`).

WARNING 2건 모두 조치했다. 다만 **2번은 지적의 전제가 틀렸고**, 그 사실을 확인한 뒤 조치
내용을 바꿨다 — 아래에 근거를 남긴다.

---

## WARNING #1 (testing) — `HttpResponseLike` 방어를 검증하는 테스트 없음 → **수정**

**지적은 정확했다.** 기존 4건은 전부 캐시 **미스** 경로(`get` → null)만 돌고, mock 이
`status: jest.fn()` + `statusCode: 200` 을 **항상** 갖춘 형태라 이번 diff 가 좁힌 두 자리
(`typeof res.status`, `typeof res.statusCode`)가 한 번도 실행되지 않았다. 하필 그 두 `typeof`
가 "express `Response` 를 박지 않은 이유" 로 코드 주석에 적어 둔 근거라, 검증 없이 두면
**주석이 주장만 하고 아무것도 지키지 않는 상태**가 된다.

`responseOverride` 를 mock 에 추가하고 5건을 더했다 (4 → 9):

| 테스트 | 고정하는 것 |
|---|---|
| 같은 key + 같은 body → 캐시 재생 | 캐시 히트 경로 자체 + `res.status(201)` 호출 + downstream 핸들러 미실행 + 재적재 안 함 |
| 같은 key + 다른 body → 409 | `IDEMPOTENCY_KEY_CONFLICT` |
| 4xx 는 캐시 제외 | Spec EIA §R8 |
| **`status`/`statusCode` 없는 응답 → 200 으로 적재** | `statusCode` optional 방어 |
| **캐시 히트 재생 시 `status` 없어도 throw 안 함** | `status` optional 방어 |

**GREEN 만으로 끝내지 않고 판별력을 실측했다** — 가드를 한 줄씩 무력화해 RED 를 확인:

| 뮤턴트 | 결과 |
|---|---|
| `if (typeof res.status === 'function')` 제거 → 무조건 호출 | **1 failed / 8 passed** |
| `typeof res.statusCode === 'number' ? … : 200` → `res.statusCode` 직접 | **1 failed / 8 passed** |

두 경우 모두 **기존 4건은 전부 GREEN** 이고 신규 1건만 RED 다 — 커버리지가 실제로 늘었다는
증거이며, 동시에 기존 테스트가 이 자리를 전혀 안 보고 있었다는 확인이기도 하다.

## WARNING #2 (documentation) — README `lint` 설명 → **수정하되 전제는 기각**

**지적**: `--max-warnings 0` 도입으로 동작이 "report-only" 에서 "warning 게이팅" 으로 바뀌었는데
README 의 "report-only" 문구가 갱신되지 않아 **사실과 반대되는 문서**로 남았다.

**전제 확인 결과 — "사실과 반대" 는 틀렸다.** `git log -S "report-only" -- codebase/backend/README.md`
로 그 문구의 출처를 찾으면 `ef010a49b` (`#651`) 한 건이고, 그 커밋의 주제가 바로
**`lint` 스크립트에서 `--fix` 를 제거**한 것이다. 같은 hunk 에서:

```diff
-| `npm run lint` | ESLint |
+| `npm run lint` | ESLint (report-only — 자동 수정 안 함) |
+| `npm run lint:fix` | ESLint + 자동 수정 (`--fix`) |
```

즉 여기서 "report-only" 는 **"트리를 고치지 않는다"** 는 뜻이고, 바로 옆 괄호(`자동 수정 안 함`)
가 그 정의이며, 같이 추가된 `lint:fix` 행이 대조군이다. **"warning 이 게이트를 실패시키지
않는다" 는 뜻으로 심어진 문구가 아니다.** 그 성질은 `--max-warnings` 부재의 결과였을 뿐
이 표가 주장한 적이 없다. 리뷰어가 말한 "과거 리뷰가 의도적으로 심어 둔" 것도 사실이지만,
심은 의도는 게이팅이 아니라 mutation 이었다.

**그래도 고쳤다 — 이유가 다르다.** "report-only" 는 영어 관용상 "보고만 하고 실패시키지 않는다"
로도 읽히는 **중의적** 표현이고, warning 이 실제로 게이팅하게 된 지금은 그 오독이 실질적으로
해롭다. 그래서 *거짓을 정정* 하는 게 아니라 *중의성을 제거* 하는 편집을 했다 — 원래 참이던
"자동 수정 안 함" 은 보존하고 게이팅 사실을 병기한다:

```
| `npm run lint` | ESLint — 트리를 고치지 않음(`--fix` 없음). **warning 1건도 실패**(`--max-warnings 0`) |
```

> **왜 이 구분을 남기는가.** 리뷰어 문안대로 "예전 설명이 틀렸으니 바로잡는다" 로 커밋했다면
> 저장소 이력에 **없던 과오**를 기록하는 셈이고, 다음 사람이 `#651` 의 판단을 실수로 오해한다.
> 이 저장소 메모리의 "문서화됐는데 미구현은 폐기된 규칙일 수 있다 — 되살리기 전 `git log -S`
> 로 이력 확인" 과 같은 형태의 함정이었다.

---

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1 | dispatcher `logFn` 분기 `.handle()` 경유 미도달 | **유예** — 이번 diff 는 그 삼항식의 *타입* 만 바꿨고 분기 조건·본문은 불변이다. 커버리지 공백은 선재이며 plan 에 남긴다 |
| 2 | `executions.service.ts` snapshotCache evict 테스트 전무 | **유예** — 동일. evict 로직 자체는 이번 diff 가 건드리지 않았다(단언 추가뿐, emit md5 동일) |
| 3 | `execution-engine.service.ts` admission `Array.isArray` 미검증 | **유예 유지** — plan `§후속` 에 이미 등재됨. 이번 라운드에서 **파일명 오기(`migrate-node-output-refs.ts` → `execution-engine.service.ts`)를 정정**했다 |
| 4 | `getResponse<T>` 좁히기 스타일 3갈래 | **조치 불요** — 선재 비일관. 통일은 그 자리를 실제로 만질 때 |
| 5 | migrate 정규식 pass 6곳 시그니처 반복 | **조치 불요** — 이전 라운드와 동일 판정 |
| 6 | `Array.isArray` 주석 2파일 반복 | **조치 불요** — 3번째 등장 시 재검토 |
| 7 | lint 게이팅 전환으로 stale `node_modules` drift 노출 증가 | **조치 불요** — plan 에 기록됨, CI 는 clean install |
| 8 | Pass 2 테스트가 "타입 주석만" 범위 초과 | **조치 불요** — 직전 RESOLUTION 에 disclosure 됨 |
| 9 | 직전 리뷰 산출물이 누적 diff 의 4배 | **조치 불요** — 별도 커밋 분리, 저장소 표준 워크플로 |
| 10 | 캐너리 `as object` 제거 안전성 | **확인** — 리뷰어 판정이 내 실측(emit md5 동일 + 양성 검출 단언)과 일치 |
| 11 | 의존성 표면 변경 없음 | **조치 불요** |

## 검증 (조치 후)

- eslint **errors 0 / warnings 0** (`--max-warnings 0` 게이트 통과)
- 타입체크 ratchet **199건 / 38파일 baseline 일치** — 신규 테스트 코드가 진단을 늘리지 않았다
- backend unit **418 suites / 8517 passed / 1 skipped** (8512 → 8517, 정확히 신규 5건)
