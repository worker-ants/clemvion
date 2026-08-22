### 발견사항

- **[INFO]** 신규 테스트가 기존 테스트와 동일한 "reasons 추출" try/catch 보일러플레이트를 반복한다 (중복 코드)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:341-351` (신규) — 기존 동형 블록은 같은 파일 `:295-307` (`[캐너리] raw 에서 걸리면 coerce_failed 가 섞이지 않는다`)
  - 상세: 두 테스트 모두 `resolveTriggerParametersRejectingMasked(...)` 를 호출해 던진 `TriggerParameterValidationException` 을 잡고 `err_.errors.map((e) => e.reason)` 으로 `reasons` 배열을 얻는 동일한 7줄짜리 try/catch 패턴을 그대로 복붙했다. 이 파일은 이미 상단에 `rejectedFields`(필드만 추출) 같은 헬퍼로 테스트 본문의 반복을 줄이는 관행을 갖고 있는데(파일 1-44행), 이번에 추가된 "전체 reason 추출" 용도는 그 관행을 따르지 않고 두 번째 사본을 만들었다. 지금은 2곳뿐이라 심각하지 않지만, 이 파일이 마커 관련 회귀·경계 테스트를 계속 누적하는 성격(파일당 이미 22개 테스트)이라 다음에 유사 검증이 하나 더 필요해지면 3번째 복붙이 될 가능성이 있다.
  - 제안: `rejectedFields` 옆에 `validationReasons(schema, raw): string[]` 같은 헬퍼(필터 없이 전체 `reason` 반환)를 추가해 두 테스트가 공유하도록 하면 다음 유사 테스트도 헬퍼를 재사용하게 된다. 지금 당장 리팩터하지 않아도 무방한 수준(INFO)이나, 이 PR 이 새 사본을 만드는 시점에 헬퍼로 흡수했으면 더 좋았다.

- **[INFO]** 신규 테스트 docstring 이 14줄로 매우 길다 — 단, 파일 기존 관행과 일치
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:313-326`
  - 상세: 이 JSDoc 블록은 트레이드오프의 배경·왜 고정할 가치가 있는지·"바꾸려면 무엇을 읽어야 하는지"까지 담아 길다. 다만 같은 파일의 다른 캐너리/경계 테스트들(예: `:215-227` "스택 회귀", `:229-238` "왕복 통합")도 동일하게 근거·인용·경고를 담은 장문 JSDoc 을 쓰고 있어, 이 파일 고유의 확립된 컨벤션(결정을 코드 옆에 고정하고 "바꾸려면 무엇을 갱신해야 하는지" 명시)을 정확히 따른 것이다. 파일 일관성 관점에서는 문제 삼을 이유가 없다.

### 요약

리뷰 대상의 실질 코드 변경은 `reject-masked-resubmission.spec.ts` 에 캐너리 테스트 1건을 추가한 것이 전부이고, 나머지는 plan 문서(`masked-marker-test-gaps.md`, `spec-sync-external-interaction-api-gaps.md` 갱신)와 자동 생성된 consistency-check 산출물(`review/consistency/2026/08/22/20_57_25/**`)이라 유지보수성 관점에서 다룰 표면이 넓지 않다. 신규 테스트는 파일이 이미 확립한 네이밍(`[캐너리]`/`[경계]`/`[통합]`/`[회귀]` 태그), 헬퍼 재사용(`rejectedFields`), 결정을 근거와 함께 docstring 으로 고정하는 관행, 대조군을 명시해 vacuous 통과를 막는 패턴을 모두 그대로 따르고 있어 가독성·네이밍·일관성 면에서 흠잡을 곳이 없다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 모두 테스트 코드로서 정상 범위이며, 유일한 지적 사항은 "reasons 추출" try/catch 블록이 기존 테스트와 한 벌 더 중복된다는 점인데 2곳뿐이라 경미하다(INFO). plan 문서 2건도 기존 트래커 컨벤션(체크박스+인용 커밋 해시+블록쿼트 근거)을 그대로 따르며 구조적 문제가 없다.

### 위험도
NONE
