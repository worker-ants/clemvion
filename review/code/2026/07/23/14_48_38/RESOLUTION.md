# RESOLUTION — review/code/2026/07/23/14_48_38 (최종 라운드, 수렴)

대상: branch `claude/isconversationoutput-refactor-dc0472` (base `origin/main`).
리뷰 시점 마지막 코드 커밋 `232825784`.

SUMMARY 판정: **RISK=LOW / CRITICAL=0 / WARNING=0 / INFO=15**. forced 7/7 전원 결과 확보.

> **디스크 기록 갭 확인**: 3라운드 모두 `summary_written=false`(write_blocked) 였으므로 main 이
> `SUMMARY.md` 를 직접 Write 했고, 매 라운드 `reviewers[]`(7) vs `ls *.md`(7) 대조로 누락 0 확인.

## 조치 항목

**Critical 0 / Warning 0** — 차단 사유 없음. INFO 15건 중 **2건 반영**(둘 다 comment·plan-only),
나머지는 양성 확인이거나 사전 존재 갭이거나 이미 합의된 결정이다.

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| INFO 11 | testing | **반영** — `prefers result.endReason over output.endReason` 테스트만 인접 테스트와 달리 "고립 조건 —" 불릿을 생략하고 산문으로 썼다. 동일 불릿 포맷으로 통일 |
| INFO 10 | maintainability | **반영** — plan 에 뮤턴트 라벨(R1~R3·H·I·A~G) → 변형 → 잡는 테스트 legend 표 추가. 4개 표를 오가며 대조할 필요 제거 |
| INFO 5 | requirement | **미조치 (근거 있음, 후속 이월)** — `result.endReason: null` 미고립. **실측 확인**: 현재 코드의 `??` 는 null 과 undefined 를 동일 취급하므로 null fixture 는 키-부재 fixture 와 **동작이 구별되지 않는다**. `!== undefined` 류 리팩터에서만 갈라지고 backend producer 도 null 을 내지 않는다. 리뷰어도 "병합 차단 아님 — 다음 편집 시" 로 분류. plan §후속 이월 에 기록 |
| INFO 6·7 | testing | **미조치 (사전 존재, diff 범위 밖)** — 최상위 타입가드 직접 테스트 / `Array.isArray` truthy-but-not-array 변형. 리뷰어가 "후속 이월, 필수 아님" 으로 분류. plan §후속 이월 에 기록 |
| INFO 9·12 | maintainability/doc | **미조치 (합의됨)** — JSDoc 포맷·언어 혼재. plan 항목 3 이 스코프를 `isConversationOutput` 으로 명시 한정. 1·2·3차 리뷰 모두 "의도된 결정, 조치 불요" 로 동의 |
| INFO 8 | requirement | **미조치** — JSDoc bullet 서술이 OR-체인의 동시 참 가능성을 엄밀히 반영하지 않는 문서적 단순화. 리뷰어 자신이 "버그 아님, 기록용" 판정 |
| INFO 13 | documentation | **반영** — plan 체크리스트의 `/ai-review` 항목 체크 |
| INFO 1·2·3·4·14·15 | 다수 | **조치 불요 (양성 확인)** — non-comment diff 0줄 실측, fixture 안전성, 격리성, mutation 재현 성공, review 산출물 규약 부합, **JSDoc SoT 위임 원칙 4곳 일관 적용** 확인 |

## 수렴 판정 (4차 리뷰 생략 근거)

- **CRITICAL 0 + 코드 WARNING 0.** 3차 반영분은 **테스트 주석 1곳 + plan 문서**뿐이며 fixture·
  assertion·소스 로직 무변경이다.
- 1·2차는 각각 **실측 재현되는 안전망 구멍**(H = fallback 단 미고립, I = 우선순위 미고립)을 짚었고
  둘 다 닫았다 — 그래서 라운드를 더 돌 가치가 있었다. 3차는 그런 항목이 **0건**이고 남은 INFO 는
  전부 양성 확인·사전 존재 갭·기합의 결정이다.
- 이 comment/plan-only 수정을 4차 full 리뷰에 다시 걸면 주석 문안·표 서식 같은 doc nit 만
  재표면화하는 **비수렴 doc-루프**가 된다(프로젝트 관례: 다회 리뷰는 Critical·Warning 0 이면
  INFO 비차단 수렴). 여기서 종결한다.

## 검증

### TEST WORKFLOW (wrapper 경유, 4단계 전부 재수행 — 2026-07-23 15:04~15:14)

| 단계 | 결과 |
|---|---|
| lint | **PASS** (52s) — backend + frontend + web-chat + channel-web-chat + INTERNAL_PACKAGES |
| unit | **PASS** (65s) — backend jest 8227 / **frontend vitest 281 files·5667** / web-chat 48 / channel-web-chat 22 files·394 / 내부 패키지 6종 |
| build | **PASS** (98s) |
| **e2e** | **통과** — `.claude/tools/run-test.sh e2e` (= `make e2e-test-full`), 246s. backend supertest **256 passed** + playwright **51 passed (57.9s)**, 실패 마커 0 |

> **e2e 판정 정정 (중요)**: 본 문서의 앞선 판(및 14_19_49·14_34_01 RESOLUTION)은 "테스트-only
> 추가라 재-e2e 불요" 로 적었으나 **그 판단은 틀렸다**. [`PROJECT.md`](../../../../../PROJECT.md)
> §e2e 면제 화이트리스트 는 *"회색 지대(예: `*.test.ts` 만 변경 …) 도 화이트리스트가 아니므로
> e2e 수행"* 이라고 명시하며, §53 은 *"자가 판단·'변경이 작아서' 는 모두 면제 사유가 아니다"* 로
> 못박는다. `output-shape.ts` non-comment diff 0줄은 **사실이지만 면제 사유로 인정되지 않는다**.
> 실제로 wrapper 로 실행했고 위와 같이 통과했다. 과거 스냅샷(14_19_49·14_34_01)은 감사 무결성상
> 소급 수정하지 않고, 본 최종 RESOLUTION 이 그 서술을 대체한다.
>
> **비-vacuity 확인**: wrapper 요약줄의 `tests=256` 은 PROJECT.md §38 대로 **backend jest 만**
> 센다. playwright 실행 여부는 로그의 `N passed (…s)` 줄로 확인했다 — `51 passed (57.9s)`
> (`_test_logs/e2e-20260723-151015.log:741`).

### 대상 스위트·정적 검사

- `output-shape.test.ts` → **42 passed**. run-results + conversation → **349 passed / 19 files**.
- `eslint` clean, `tsc --noEmit` clean, probe tsconfig 로 테스트 파일 타입체크 clean.
- mutation **12건 전수**(R1·R2·R3·H·I·A~G): R3(타입 차단) 외 11건 전부 정확히 대응 테스트 1건만
  red. 잔여 diff 0줄. 라벨 legend 는 plan §뮤턴트 라벨 legend.

### 리뷰 후 델타 (Stop 가드 대응)

3차 리뷰 세션(14:48:38) 이후 커밋된 `codebase/` 변경은 `output-shape.test.ts` 1건이며
**주석 전용**이다 — `git diff 232825784..HEAD -- codebase/` 의 non-comment `+/-` 라인 **0줄** 실증.
INFO 11(불릿 포맷 통일) 반영분으로 fixture·assertion·소스 로직 무변경. 리뷰를 처음부터 다시
돌리지 않고(가드 지시), 이 델타를 실증한 뒤 TEST WORKFLOW 4단계를 재수행했다.

## 최종 상태

`endReason` 표현식(`result?.endReason ?? output.endReason`)의 관측 가능한 표면이 전부 고정됐다:
좌항(C)·우항(H)·순서(I)·키 부재 시 의미(R1·R2). 여기에 #983 이 세운 OR-체인/AND-guard 7건(A~G)이
회귀 없이 유지된다. 테스트 39 → **42**.
