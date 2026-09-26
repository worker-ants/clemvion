# 테스트(Testing) 리뷰 — canvas-save-typed (2R, 머지 후 재검토)

## 검증 방법

이번 라운드는 `04f603996`(feat) → `2ca8a7767`(test: I 케이스 노드 수 고정) → `ce7d36183`/`ba88b7318`(docs: plan·RESOLUTION)
까지 누적된 전체 diff 를 대상으로 한다. 1R(`review/code/2026/09/26/22_05_52`)의 testing 리뷰가 낸 **WARNING 1건**
(e2e `I` 가 `saved.body.data.nodes` 개수를 고정하지 않아 vacuous 통과 여지)이 이번 diff 에 실제로 반영됐는지를
저장소 파일 직접 열람으로 확인했다(뮤테이션 없음, 읽기만 수행 — `git status --short` 변경 없음 확인).

- `codebase/backend/test/workflow-crud.e2e-spec.ts:609` — `expect(saved.body.data.nodes).toHaveLength(5);` 가
  restore 호출 **전**에 존재함을 직접 확인. RESOLUTION.md 가 조치 커밋으로 적은 `2ca8a7767` 의 내용과 일치한다.
- `_test_logs/e2e-20260926-221832.log:621` — `Tests: 413 passed, 413 total`(backend Jest e2e), `:801` —
  `51 passed`(frontend Playwright e2e). `_test_logs/unit-20260926-221417.log:1254` — `10295 passed`(unit, 1 skipped
  — 이 PR 과 무관). RESOLUTION.md/plan 이 적은 수치와 실제 로그가 일치해 "실측했다" 주장이 근거 있다.

## 발견사항

- **[INFO]** 1R WARNING(e2e `I` 노드 수 미고정)이 해소됨을 확인
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — `it('I. 버전 복원 → …')` 블록, `saved.body.data.nodes`
    단언 줄(파일 내 608~609번째 줄, `saved` 응답 직후)
  - 상세: 조치 전에는 `restored.body.data.edges` 만 `toHaveLength(2)` 로 고정하고 `nodes` 는 고정하지 않아, `idsOf`
    비교가 "`saved` 가 반드시 5개를 돌려준다"는 이 테스트 자신이 검증하지 않는 가정에 기댔다. 이제 `saved` 시점에서
    바로 `toHaveLength(5)` 를 추가해 C 케이스와 동일한 vacuous-방지 패턴을 적용했고, 주석("아래 id 대조는 양쪽이 빈
    배열이어도 통과한다 — 원소 수를 먼저 고정한다")도 왜 필요한지 명확히 설명한다. C·I 두 e2e 모두 이제 자기 완결적으로
    빈 배열 회귀를 잡는다 — 더 이상 C 케이스의 간접 방어에 의존하지 않는다.
  - 제안: 조치 완료, 추가 작업 불필요.

- **[INFO]** 1R 이 이미 지적한 스코프 밖 갭들은 이번 라운드에도 그대로 유효 — 재조치 불요
  - `workflow-response.dto.spec.ts` 의 `it.each` 캐너리는 `type`/`$ref`/`required` 만 보고 `nullable` 조합은 다루지
    않는다(기존 §5.4 drift, 별도 트래커로 이미 처분). `ExportWorkflowDto` 도 같은 무제약 배열 패턴이지만 인덱스
    정규화 포맷이라 재사용 불가 — 별도 트래커 항목으로 등재됨(`spec-draft-nullable-notation-followups.md:1313`).
    두 항목 모두 이번 diff 범위 밖이라는 plan/1R 처분이 여전히 타당하다.

- **[INFO]** e2e `I` 의 "최신순" 가정은 검증되지 않는 전제이지만, 실패 형태가 자기-교정적이다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:611-618` (`versions[0]` 선택 및 그 위 주석)
  - 상세: `GET /workflows/:id/versions` 의 응답이 최신순으로 온다는 가정에 기대 `versions[0]` 을 곧 방금 저장한
    5노드 스냅샷으로 취급한다. 이 가정이 깨지면(정렬이 바뀌거나 이 워크플로우에 다른 버전이 섞이면) 잘못된 버전을
    복원하게 되는데, 그 경우 `idsOf(restored.body)).toEqual(idsOf(saved.body))` 단언이 실패하므로 조용히 통과하는
    형태는 아니다 — 다만 실패 메시지만으로는 "정렬 가정이 틀렸다"는 원인이 바로 드러나지 않는다.
  - 제안: 조치 불요(현재 위험도 낮음, 자기-교정적). 다만 향후 이 리스트 엔드포인트에 다중 버전 정렬 테스트가
    생기면 이 e2e 의 암묵적 가정도 명시적으로 주석에 남겨두면 다음 사람이 실패 원인을 더 빨리 좁힐 수 있다.

## 회귀 테스트 확인

- 기존 C 케이스(`duplicate`)는 이번 diff 로 계약 대조 3줄만 추가됐을 뿐 기존 단언은 그대로다 — 회귀 없음.
- 신규 unit(`workflow-response.dto.spec.ts`)·e2e(`I`) 는 순수 추가이며 기존 스펙을 수정하지 않는다.
- `buildFiveNodeGraphPayload()` 를 C·I 양쪽이 공유해, "5노드·엣지 2" 라는 매직 넘버가 두 곳에서 독립적으로
  하드코딩되지 않는다 — 픽스처 드리프트 위험이 낮다.

## 요약

1R 이 낸 유일한 WARNING(e2e `I` 케이스의 vacuous 통과 여지)은 제안된 대로 정확히 조치됐음을 소스 직접 열람과
테스트 로그(`e2e-20260926-221832.log` 413/413, `unit-20260926-221417.log` 10295 passed)로 확인했다. C·I 두
e2e 모두 이제 원소 수를 먼저 고정한 뒤 `assertMatchesContract` 로 대조하는 동일한 vacuous-방지 패턴을 따르고,
서로 다른 코드 경로(생성 vs 갱신)를 각각 커버한다. 신규 unit 캐너리는 스코프 내에서 필요충분하고, 남은 스코프 밖
갭(`nullable` drift, `ExportWorkflowDto`)은 모두 트래커에 등재돼 추적 누락이 아니다. 테스트 관점에서 이번 diff 를
막을 이유가 없다.

## 위험도

NONE
