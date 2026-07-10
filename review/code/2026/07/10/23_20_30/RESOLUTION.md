# RESOLUTION — review/code/2026/07/10/23_20_30

- **대상 커밋**: `5e6f70b76`
- **Critical**: 0건 → fix 대상 없음
- **Warning**: 1건 → **defer (근거 기록 + durable 등록)**
- **Info**: 6건 → 5건 조치 불요, 1건 defer

---

## 1. W1 — plan 체크박스 미갱신에 durable 추적 부재 (documentation)

**판정: defer — 단, WARNING 이 지적한 "durable 추적 부재" 자체는 본 RESOLUTION 으로 해소한다.**

### 왜 지금 고치지 않는가

`plan/in-progress/resume-llm-usage-attribution.md` 의 INFO#1(74-75행) · INFO#4(78-79행) 는
선행 docs PR **#898** 이 편집한 INFO#3(76-77행) 과 **빈 줄 없이 인접**하다. git 기본 diff context(3줄)
안에서 hunk 가 겹치므로, 본 코드 PR 이 같은 블록을 편집하면 두 PR 중 나중 것이 merge conflict 를 낸다.

이 위험은 구현 착수 전 `--impl-prep` 의 `plan_coherence` checker 가 W1 으로 사전 경고했고
(`review/consistency/2026/07/10/22_52_18/plan-coherence.md`), 그 권고("#898 머지 후 rebase 하여 편집하거나,
순서 통제가 안 되면 본 PR 은 plan 파일을 건드리지 않는다")를 따라 **의도적으로** plan 파일을 제외했다.

즉 "체크박스 미갱신" 은 누락이 아니라 두 PR 의 머지 순서를 통제할 수 없는 상황에서의 정합한 선택이다.

### durable 추적 (WARNING 의 실제 요구)

reviewer 의 지적은 "결정 자체가 durable 하게 등록되지 않아 이 세션 산출물을 다시 읽지 않으면 stale 하게
방치된다" 였다. 이를 다음 3중으로 해소한다.

1. **본 RESOLUTION.md** — PR 커밋에 포함되어 저장소에 영구 기록된다 (`review/` 는 gitignored 아님).
2. **PR 설명** — "잔여" 절에 `#898` 머지 후 plan 종결 pass 가 필요함을 명시한다.
3. **background task chip 등록** — 세션 밖에서도 독립적으로 착수 가능한 self-contained 후속 작업으로 스폰.

### 종결 조건 (후속 pass 가 할 일)

`#898` 과 본 PR 이 모두 main 에 들어간 뒤:

- `plan/in-progress/resume-llm-usage-attribution.md` 의 INFO#1 · INFO#4 를 `[x]` 로 갱신.
- 그 시점에 잔여 follow-up 이 전부 소진되므로 `plan-lifecycle.md` 기준으로 `git mv` → `plan/complete/`.
- 이동 시 frontmatter `spec_impact` 를 **YAML 리스트**로 선언 (bare string 은 frontend Gate C unit 실패).
  #898 이 건드린 spec 5개 파일: `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`,
  `spec/data-flow/7-llm-usage.md`, `spec/data-flow/6-knowledge-base.md`, `spec/data-flow/13-agent-memory.md`.

---

## 2. INFO#3 — 대칭 커버리지 갭 (testing)

**판정: defer (비차단, 근거 기록)**

"attribution 이 애초에 `undefined` 인 기본 경로(`retryState()` override 없음)에서 2회차 chat 호출도
여전히 `undefined` 로 유지되는지" 의 역방향 assertion 이 없다.

defer 근거:

- 실제 프로덕션 리스크는 압도적으로 **"attribution 누락/오염"** 방향이고(회귀 #501 이 바로 그것),
  그 방향은 신규 테스트 + mutation 검증으로 견고히 닫혔다.
- 역방향("원래 없는데 재시도 시 값이 새어 들어감")은 `runTurnWithCollectionRetries` 가 루프 전체에서
  동일한 `params.llmContext` 참조 하나만 넘기는 구조상 발생 경로가 없다 — 값을 만들어낼 코드가 없다.
- 본 PR 의 명시적 제약이 "방금(#877/#879) 안정화된 attribution 코드의 churn 최소화" 이고,
  테스트 추가마다 fresh `/ai-review` 재트리거가 필요하므로 비용 대비 이득이 낮다.

재검토 조건: `runTurnWithCollectionRetries` 가 루프 내부에서 `llmContext` 를 **재계산/변형**하도록
바뀌면 즉시 이 assertion 을 추가한다 (그때 발생 경로가 생긴다).

---

## 3. 조치 불요로 종결한 INFO

| # | 사유 |
| --- | --- |
| 1 | import 스타일 — 수정 대상 파일의 로컬 관례(inline `type`)를 따른 의도적 선택. lint 규칙 부재로 위반 아님 |
| 2 | mock 셋업 반복 — 파일 내 기존 3곳의 확립된 패턴을 따른 것. 본 PR 이 도입한 문제 아님 |
| 4 | `expect.objectContaining` 초과 필드 미검출 — 저장소 전역 관용구. 본 PR 만 강화하면 오히려 불일치 |
| 5 | `as string \| undefined` 캐스팅 — 본 diff 이전부터 존재, 스코프 밖. 값이 서버 내부 식별자라 보안 영향 없음 |
| 6 | CHANGELOG — 런타임 무변경이라 규약상 의무 없음 |

---

## 4. 재검증

코드 변경이 발생하지 않았으므로(RESOLUTION 은 문서만) 테스트 재실행 불요.
직전 TEST WORKFLOW 결과가 그대로 유효: lint PASS · unit PASS (backend 7952 / frontend 5295) ·
build PASS · e2e PASS (249).
