### 발견사항

- **[INFO]** `result.endReason` ?? `output.endReason` 의 **우선순위(전자가 후자를 이긴다) 자체**를 고립시키는 fixture 가 없음 — 순서를 뒤바꾸는 mutation 이 잡히지 않음
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` (`const endReason = (result?.endReason as string | undefined) ?? (output.endReason as string | undefined);`), 대응 테스트 `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:552`(`detects post-Stage-5 …`)·`:665`(`detects a terminal whose endReason sits at output.endReason …`)
  - 상세: 이번 라운드가 닫은 갭(직전 리뷰 INFO 3 — fallback 단이 어떤 fixture 로도 고립되지 않던 문제)은 `output.endReason` **단독**으로 참이 되는 fixture(665행)로 정확히 닫혔다(직접 vitest 41/41 green, tsc clean 재검증 완료). 그런데 전체 41개 테스트를 `grep -n "endReason"` 으로 훑어본 결과 **`result.endReason` 과 `output.endReason` 이 동시에, 그것도 서로 다른 값으로 존재하는 fixture 는 하나도 없다**(각 테스트는 항상 둘 중 하나만 채운다). 그 결과 `?? ` 좌우를 통째로 뒤바꾼 `(output.endReason as string|undefined) ?? (result?.endReason as string|undefined)` 형태의 mutation 은 현재 41개 테스트 전원 green 을 유지한다 — 각 fixture 가 한쪽만 채우므로 nullish-coalescing 의 평가 순서가 결과에 영향을 주지 못하기 때문이다. `??` 는 "먼저 있는 값을 신뢰"하는 연산이라 순서가 곧 우선순위 정책인데, 그 정책 자체(신형 `result.endReason` 이 구형 `output.endReason` 보다 우선해야 한다는 JSDoc 서술 — "한 단계 위에 실린 마이그레이션 이전 페이로드")를 지키는 회귀 안전망이 없다. 이 함수가 방금 겪은 정확히 같은 계열의 실패 모드(생존 mutation → 미리보기 소실 위험)이므로 남겨두면 다음 라운드에 또 발견될 성격의 갭이다.
  - 제안: `result.endReason` 에 **화이트리스트 밖의(bogus) 값**을 넣고 `output.endReason` 에 **유효한(whitelisted) 값**을 동시에 넣는 fixture 1건을 추가해 `expect(...).toBe(false)` 로 고정(= `result.endReason` 이 존재하면 그 값이 무효하더라도 `output.endReason` 으로 "새어나가지" 않아야 함을 검증). 이 fixture 는 우선순위 뒤집기 mutation 뿐 아니라 "필드 존재 시 무조건 우선 사용, 실패하면 폴백" 이라는 잘못된 OR-semantics 리팩터(`??` → `has(a) ? a : (has(b) ? b : undefined)` 류)도 함께 잡는다.

- **[INFO]** mock/stub 불필요 — 순수 함수 테스트로 적절
  - 위치: `output-shape.test.ts` 전체
  - 상세: `isConversationOutput`/`unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata` 모두 순수 함수(부수효과·외부 의존성 없음)이며, 테스트는 in-memory 객체 리터럴만으로 전량 커버한다. mock/stub/spy 가 전혀 없고 필요하지도 않다 — 실제 동작과의 괴리 위험이 구조적으로 0에 가깝다.
  - 제안: 없음 (모범적).

- **[INFO]** 테스트 격리·회귀 실측 재검증 — 통과
  - 위치: `output-shape.test.ts`
  - 상세: 직접 `pnpm exec vitest run src/components/editor/run-results/__tests__/output-shape.test.ts` 실행 → **41 passed**. 각 테스트가 독립된 `raw` 객체 리터럴을 지역 변수로 생성하고 전역/module-level 상태를 공유하지 않아 실행 순서 의존성이 없다. `src/components/editor/run-results` 전체(16 files/274 passed)와 `tsc --noEmit` 도 clean 재확인 — RESOLUTION.md 의 "348 passed/19 files"(run-results + `src/lib/conversation/`) 주장과 정합.
  - 제안: 없음.

- **[INFO]** 신규/기존 테스트 주석의 mutation 서술 중복(plan 문서와)은 maintainability/testing 두 관점 모두 이미 이월 인지된 상태이며 이번 diff 로 신규 도입된 문제가 아님
  - 위치: `output-shape.test.ts:629-663`(`rejects result.messages when the endReason key is absent entirely`) vs `plan/in-progress/output-shape-comment-followups.md` "측정 1"
  - 상세: 직전 라운드 SUMMARY INFO 2 로 이미 지적됐고 RESOLUTION.md 도 "정보 손실 없이 결론 요약 + 포인터로 축약"을 반영했다고 기록했으나, 실제로 읽어보면 해당 테스트 주석은 여전히 "지키는 대상은 …conjunct 의 존재가 아니다"는 결론 서술 위주로 축약돼 있고 R1/R2/R3 수치표 자체는 plan 문서에만 있어 실질적으로는 이미 개선된 상태다(중복은 서사 수준이지 수치 재기재가 아님). 병합 차단 사유 아님.
  - 제안: 없음 (기록 목적).

### 요약

이번 라운드는 순수 주석/JSDoc/plan 문서 변경 + 신규 음성 테스트 1건("endReason 키 부재") 및 직전 라운드에서 발견된 `output.endReason` fallback 고립 fixture 1건 추가로 구성되며, `isConversationOutput` 판정 로직 자체는 무변경이다(직접 확인: 41/41 vitest green, tsc clean). 새 테스트들은 mock 없이 순수 객체 리터럴로 각 OR-분기를 정밀하게 고립시키고, 독립 실행 가능하며, 실제 mutation 실측(R1/R2/H 등)까지 근거로 남긴 드물게 엄밀한 사례다. 다만 손 트레이스 결과 이번에 새로 닫힌 fallback 테스트가 `output.endReason` **단독** 참 케이스만 고립시킬 뿐, `result.endReason`(bogus)과 `output.endReason`(valid)이 **동시에** 존재할 때의 우선순위 정책(`??` 의 좌변 우선)을 검증하는 fixture 는 여전히 없다 — 이는 좌우를 뒤바꾸는 mutation 이 현재 41개 테스트 전원 green 을 유지하는, 구체적으로 확인된 잔여 갭이다. 이 함수가 반복적으로 같은 계열(fallback/우선순위 미고립)의 회귀를 겪어온 이력을 감안하면 사소하지 않은 후속 항목으로 권장한다. 그 외 테스트 가독성·격리·회귀 안전성은 모두 양호하며 Critical/Warning 급 결함은 없다.

### 위험도
LOW
