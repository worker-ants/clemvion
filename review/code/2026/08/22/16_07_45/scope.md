### 발견사항

- **[WARNING]** 이 작업(`backend-redact-depth-boundary`)의 명시 목표는 backend `deepRedactSecrets` 깊이 경계 테스트 추가뿐인데, 같은 커밋 계열(`5d5d4565f`)에서 완전히 무관한 신규 결정 — 두 Manual 엔드포인트(`re-run`/`execute`)의 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일하는 **breaking change 결정**을 트래커에 새로 기록했다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 프롬프트 게이트 `765`~`780` (`> **결정됨 (2026-08-22, 사용자)**: **INVALID_TRIGGER_PARAMETERS 로 통일**한다 …` 부터 `> 집행은 별 PR — 이 항목은 그 PR 에서 닫는다.` 까지)
  - 상세: 이 결정은 re-run/execute 두 엔드포인트의 에러 코드 드리프트를 다루는 것으로, redact 깊이 경계 테스트와 아무 관련이 없다. 실제 코드 변경은 없고 "집행은 별 PR" 이라 명시돼 있어 즉각적 리스크는 낮지만, 이 트래커 문서 자신이 바로 아래(게이트 `834`) 인용하는 관행 권고 — *"기능 PR 에서 저장소 전역 정책 가드가 부산물로 파생되면 별도 PR 로 분리하는 편이 낫다"* — 와 같은 원리가 적용되는 사례다. `/ai-review` 를 이 작업의 diff 로 트리거했을 때 함께 검토돼야 할 변경 범위 밖의 내용이 슬쩍 들어갔다.
  - 제안: 이런 무관 결정 기록은 별도의 아주 작은 planner/plan 전용 커밋으로 분리하거나, 최소한 커밋 메시지·PR 설명에서 "이 PR 은 redact 깊이 경계 테스트 + 트래커 grooming(무관 결정 1건 포함)" 임을 명확히 알린다.

- **[WARNING]** 같은 커밋(`5d5d4565f`)에서 트래커의 **미체크 항목 37건 전부**를 재판정하는 절을 새로 추가했다 — "backend 깊이 경계 테스트가 여전히 유효한 백로그 항목인가" 확인에 필요한 범위를 넘어, `result.outputs` 미구현, 분산 SSE fan-out, HMAC §8.2, `EIA-AU-09`, `TERMINAL_DURATION_MS_SQL`, Re-run 순수 함수 추출 등 이 작업과 무관한 항목들을 함께 재검토·재서술했다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 프롬프트 게이트 `846`~`875` (`### 미체크 항목 재판정 (2026-08-22, backend-redact-depth-boundary)` 절 전체)
  - 상세: consistency-check(`15_35_56`) 의 WARNING #2 는 "L192 항목만 `[x]` 로 갱신하면 되고 plan 이동조차 불필요"라고 명시했는데(파일7 SUMMARY.md 게이트 34/58 참조), 실제로는 그보다 훨씬 넓게 트래커 전역을 grooming 했다. 문서화가 잘 돼 있고 코드 리스크는 없지만, "이 작업의 diff" 관점에서는 요청 범위를 벗어난 부수 작업이다.
  - 제안: 백로그 재판정 자체는 유용하지만, 이번처럼 규모가 크면(37건) 별도 `chore(plan)` PR로 분리하거나 최소한 PR 설명에 "부수 작업"으로 명시해 리뷰어가 필요한 diff 만 집중해서 볼 수 있게 한다.

- **[INFO]** `plan/in-progress/masked-marker-shared-package.md`, `plan/in-progress/mirror-guard-single-copy.md` 두 plan 문서를 `plan/complete/` 로 이동(각각 `a0797d264`, `dfb427dce`)한 것은 이 작업이 닫으려는 후속 체크리스트 항목이 그 두 문서에 있고, 두 문서가 가리키는 PR(#1190/#1191)이 이미 `origin/main` 에 머지돼 있음에도 로컬 상태(`status: in-progress`)가 stale 했기 때문이다.
  - 위치: `plan/complete/masked-marker-shared-package.md`(신규), `plan/complete/mirror-guard-single-copy.md`(신규), `plan/in-progress/masked-marker-shared-package.md`(삭제), `plan/in-progress/mirror-guard-single-copy.md`(삭제) — 프롬프트 파일 2~5
  - 상세: 커밋 메시지에서 근거(머지 커밋 SHA·`/ai-review` 라운드 수)를 실측해 명시했고, 이 작업의 목표 체크리스트 항목("backend 깊이 경계 테스트")을 올바른 위치(`complete/`)에서 닫기 위한 선행 조건으로 정당화된다. 범위 확장이긴 하나 목적과 직접 연결돼 있고 투명하게 문서화됐다.
  - 제안: 없음(현재 처리로 충분). 다만 향후 유사 사례에서는 "stale plan 이동"과 "핵심 작업"을 별도 커밋으로 나누는 지금의 방식(4개 개별 커밋)을 유지하면 리뷰가 쉽다 — 이미 그렇게 하고 있다.

- **[INFO]** `review/consistency/2026/08/22/15_35_56/**` (SUMMARY.md·`_retry_state.json`·`convention_compliance.md`·`cross_spec.md`·`meta.json`·`naming_collision.md`·`plan_coherence.md`·`rationale_continuity.md`) 는 CLAUDE.md 가 요구하는 `consistency-check --impl-prep` 의무 절차의 산출물이며, `review/` 는 gitignore 대상이 아니라 커밋되는 것이 정책이다.
  - 위치: 프롬프트 파일 7~14
  - 상세: 스코프 리뷰 관점에서 문제 없음 — 코드 변경이 아니라 필수 워크플로 증적이다.
  - 제안: 없음.

- **[INFO]** 핵심 코드 변경인 `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 는 순수 테스트 추가(+149줄)이고 프로덕션 코드·import·설정 변경이 전혀 없다. `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER` 를 import 해 사용해 리터럴 하드코딩을 피했고, 새 테스트 스위트는 작업 목표(깊이 경계 고정)에 정확히 대응한다.
  - 위치: 프롬프트 파일 1, 게이트 `7`(신규 import), `274`~`383`(신규 `describe` 블록)
  - 상세: 불필요한 리팩토링·포맷팅 잡음·무관한 주석 변경 없음. 마지막 커밋(`bfe950512`)은 prettier 가 강제한 줄바꿈 정정으로, 자기 자신의 신규 코드에 대한 lint 수정이라 범위 내.
  - 제안: 없음.

### 요약

이 작업의 실질 프로덕션/테스트 diff(`origin/main..HEAD`, `review/**` 제외)는 정확히 4개 파일 — 핵심 테스트 1개(`sanitize-error-message.spec.ts`, 목표에 정확히 부합)와 plan 문서 3개다. 코드 자체는 스코프 이탈이 전혀 없고 매우 깔끔하다. 다만 plan 트래커 커밋(`5d5d4565f`)에서 (1) 이 작업과 무관한 "두 Manual 엔드포인트 error.code 통일" 신규 사용자 결정을 함께 기록하고 (2) consistency-check 가 요구한 범위(L192 항목 1건 갱신)를 넘어 미체크 37건 전체를 재판정한 것은 명백한 부수 확장이다. 둘 다 코드가 아닌 계획 문서 텍스트이고 "집행은 별 PR" 로 명시돼 즉각적 리스크는 낮지만, 이 작업의 diff 안에 "요청하지 않은 무관 결정"과 "요청 범위를 넘는 백로그 grooming"이 섞여 있다는 점에서 순수 스코프 관점의 감점 요인이다. plan 파일 이동(2건)은 목표 체크리스트 항목을 올바른 위치에서 닫기 위한 정당한 선행 작업으로 판단된다.

### 위험도

LOW
