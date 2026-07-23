# 요구사항(Requirement) 리뷰 — isConversationOutput 이월 처분 최종 diff (output-shape.ts / output-shape.test.ts / plan / review 산출물)

## 검증 방법 (직접 재현)

- `codebase/frontend/src/components/editor/run-results/output-shape.ts` 를 직접 Read — `isConversationOutput`
  본문(163~222행)이 3라운드 리뷰 이력이 주장하는 대로 **실행 로직 무변경**임을 확인. `endReason` 2단
  조회(202~204행: `(result?.endReason as string|undefined) ?? (output.endReason as string|undefined)`)와
  그 우선순위가 JSDoc(134~143행)의 서술과 line-level 로 정확히 일치.
- `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` 의 신규 fixture
  3건(`rejects … endReason key is absent entirely` / `detects … output.endReason, not result.endReason` /
  `prefers result.endReason over output.endReason …`)을 실제 분기(top-level 게이트 →
  `unwrapNodeOutput` → `hasResultMessages`/`endReason`/`looksLikeConversationEnd`)로 손 트레이스 —
  세 fixture 모두 `expect` 기대값과 실제 반환값이 일치함을 확인:
  - 키 완전 부재 → `endReason=undefined` → `false` (일치)
  - `output.endReason` 만 존재 → fallback 성립 → `"completed"` → `true` (일치)
  - `result.endReason="bogus_value"` + `output.endReason="completed"` 동시 존재 → `??` 좌항이 이겨
    `"bogus_value"` → 화이트리스트 밖 → `false` (일치, `??` 좌우 교환 mutation 을 정확히 노출)
- `plan/complete/output-shape-comment-followups.md` 전문 Read — 체크리스트 11항목 전부 `[x]`, 3라운드
  리뷰(C0/W0, C0/W1→반영, C0/W0) 및 최종 TEST WORKFLOW(lint/unit/build/e2e 4단계 PASS) 기록 확인.
- spec 인용 전수 대조:
  - `spec/conventions/conversation-thread.md:632` — Inv-8 행 실재, 서술("렌더 층 도달성", `result.status`
    비게이트) 인용과 일치.
  - `spec/conventions/swagger.md:107,352-358` — `interactionType`(EIA `getStatus.context`) unsound
    discriminator 판정 실재, plan 의 NO-GO 근거 인용과 일치.
  - `spec/5-system/2-api-convention.md` 실재 — plan 문서의 링크가 이전 라운드(1차 INFO 5)에서 지적된
    `spec/conventions/` 오류 경로에서 `spec/5-system/2-api-convention.md` 로 정정돼 있음을 확인, 현재는
    "관련 규약 — 직접 논거 아님" 으로 격도 낮춰 적합성까지 개선됨(2차 INFO 3 반영).
  - `spec/4-nodes/3-ai/1-ai-agent.md:552,622,886` — `endReason` 필드는 spec 상 항상 `output.result.endReason`
    위치로만 문서화돼 있고 `output.endReason`(봉투 밖) 위치는 spec 에 존재하지 않는다 — 코드의 JSDoc 이
    이 fallback 을 "생산자 없음, 방어적 유지" 로 스스로 표시한 것과 정합적이다(spec 위반이 아니라 spec 이
    다루지 않는 legacy 방어 경로임을 코드가 인정).
  - `@workflow/ai-end-reason` 의 `CONVERSATION_END_REASONS` import(output-shape.ts:12) 및 `"completed"`
    포함 여부 확인 — fallback 테스트 fixture 의 유효성 뒷받침.
- `grep -n "TODO\|FIXME\|HACK\|XXX"` — `output-shape.ts` / `output-shape.test.ts` / plan 문서 3파일
  전부 0건.

## 발견사항

- **[INFO]** `result.endReason: null`(명시적 null) 케이스는 여전히 미고립 — 사전 인지·근거 있는 이월
  - 위치: `output-shape.ts:202-203`
  - 상세: `??` 는 `null` 과 `undefined` 를 동일하게 다음 단으로 내려보내므로, 이번 3라운드가 고정한
    fixture(키-부재/fallback 존재/우선순위) 는 전부 `undefined`(키 자체 부재) 케이스만 다루고
    `result.endReason: null` 로 명시된 입력이 fallback 을 타는지는 어떤 fixture 로도 관측되지 않는다.
    plan 문서와 14_48_38 라운드 requirement 리뷰가 이미 이 갭을 실측 확인했고(`node -e` 로 `??` 의
    null/undefined 동치성 확인), backend producer 가 `endReason: null` 을 내는 경로가 없음(spec 필드
    표 전수 확인 결과 리터럴 문자열만 등장)을 근거로 비차단 이월 처리했다. 독립적으로 spec 을 재확인한
    결과도 동일 결론(위 "검증 방법" §spec 인용 참조) — 근거는 타당하다.
  - 제안: 병합 차단 아님. 다음에 `endReason` 관련 분기를 편집할 기회에 `null` 고립 fixture 1건 추가 검토.

- **[INFO]** 과거 라운드 RESOLUTION.md(`14_19_49`, `14_34_01`) 에 남은 "e2e 재실행 불요" 서술은
  이후 커밋(`b400e0848`)에서 틀렸다고 정정됐으나 원문은 소급 수정되지 않음 — 의도된 감사-이력 보존
  - 위치: `review/code/2026/07/23/14_19_49/RESOLUTION.md`, `review/code/2026/07/23/14_34_01/RESOLUTION.md`
    (둘 다 "테스트-only 라 e2e 재실행 불요") vs `plan/complete/output-shape-comment-followups.md` §TEST
    WORKFLOW ("e2e 면제 자가판단은 오류였다") 및 `review/code/2026/07/23/14_48_38/RESOLUTION.md` (같은
    정정 포함)
  - 상세: `PROJECT.md` §e2e 면제 화이트리스트("회색지대도 화이트리스트 아니므로 e2e 수행")와 §53("자가
    판단은 면제 사유 아님")을 뒤늦게 재확인해 앞선 두 판단이 규약 위반이었음을 스스로 정정했다. 실제
    e2e 는 최종적으로 실행되어 PASS(backend supertest 256 + playwright 51)했으므로 **기능적 결함은
    아니다** — 다만 과거 스냅샷 문서에는 오류 서술이 그대로 남아, 그 파일만 단독으로 읽으면 잘못된
    결론(e2e 불요)을 얻는다. plan 문서가 "감사 무결성상 소급 수정하지 않고 최종 RESOLUTION 이 대체"
    라고 명시적으로 밝혀 정책적으로 의도된 처리이며, 이 프로젝트의 append-only 리뷰 산출물 관례와
    부합한다.
  - 제안: 조치 불요(정책 부합). 기록 목적 INFO — 향후 이 이력 폴더를 참조할 사람은 최종 라운드
    RESOLUTION 을 SoT 로 봐야 함을 상기.

- **[INFO]** JSDoc "Stage 5 이후 종결" bullet 의 서술이 함수 전체의 무조건 반환값 주장처럼 읽힐 여지
  (문서적 단순화, 기능 결함 아님)
  - 위치: `output-shape.ts:141-143` ("화이트리스트에서 빠진 endReason 은 미리보기 탭을 통째로 없앤다")
  - 상세: 실제로는 OR-체인의 다른 3분기 중 하나가 참이면 `looksLikeConversationEnd=false` 여도 여전히
    `true` 를 반환한다(216-221행). 이 문장은 "이 분기만 유효한 Stage-5 전용 페이로드에서" 라는 암묵
    전제로 읽어야 하며, Stage 5 페이로드가 다른 분기를 동시에 충족시키는 필드를 갖지 않는다는 실무
    전제와 부합해 오도 위험은 낮다. 14_48_38 라운드 requirement 리뷰가 이미 동일하게 지적·기록했다.
  - 제안: 없음(기록용). 원한다면 "(다른 분기가 동시에 참이 아닌 한)" 단서 추가 가능하나 필수 아님.

## 항목별 점검 요약

1. **기능 완전성** — plan 문서가 정의한 4개 이월 항목 중 실제 코드 변경이 필요한 2건(§2 endReason 키
   부재 음성 테스트, §3 주석 정리)만 반영됐고, 그 과정에서 리뷰 3라운드가 실측으로 발견한 안전망 구멍
   2건(`output.endReason` fallback 미고립, `??` 우선순위 미고립)을 추가 fixture 로 닫아 39→42 로 수렴.
   NO-GO 판정 2건(union 재설계, `it.each` 전환)은 diff 에 흔적이 없어 판정과 실제 코드가 일치. `git diff`
   상 `output-shape.ts` 는 이번 커밋 range 전체에서 non-comment 변경 0줄임을 직접 재확인.
2. **엣지 케이스** — 신규 3개 fixture 가 endReason 2단 조회의 관측 가능한 표면(좌항/우항/순서/키부재)을
   전부 고립. 잔여 갭(`null` 명시값)은 근거 있는 이월(위 INFO 1).
3. **TODO/FIXME** — 0건.
4. **의도와 구현 간 괴리** — JSDoc(134-143행)의 2단 조회·우선순위 서술이 실제 코드(202-204행)와
   정확히 대응. "JSDoc=근거 SoT, 테스트 주석=고립조건" 위임 원칙도 3라운드에 걸쳐 일관 적용 확인.
5. **에러 시나리오** — 순수 함수, 예외 경로 없음. 무관.
6. **데이터 유효성** — `typeof`/`Array.isArray` 가드 무변경, `unknown` 입력에 대한 방어적 내로잉 유지.
7. **비즈니스 로직** — `CONVERSATION_END_REASONS` 값 도메인 SoT(`@workflow/ai-end-reason`) 무변경, 이번
   diff 는 정책을 문서화했을 뿐 값 도메인을 건드리지 않음.
8. **반환값** — 모든 경로에서 `boolean` 반환, 변경 없음.
9. **spec fidelity** — 인용된 모든 spec 앵커(conversation-thread.md §9.9 Inv-8, swagger.md §1-4,
   api-convention.md §5.4, ai-agent.md endReason 필드표)가 실재하고 서술과 부합. `isConversationOutput`
   자체의 상세 동작(2단 조회 등)을 규정하는 spec 문서는 없음 — frontend 방어적 파싱 내부 로직으로
   spec 이 침묵하는 영역(회색지대, INFO 대상이지 SPEC-DRIFT 대상 아님: 이번 diff 는 코드 동작을 바꾸지
   않았으므로 spec 이 뒤처질 새로운 동작 자체가 없다). Critical 급 spec 불일치 없음.

## 요약

이번 diff(3라운드 `/ai-review` 이력 + 최종 TEST WORKFLOW 정정 커밋 포함)는 `isConversationOutput` 의
실행 로직을 전혀 바꾸지 않고 JSDoc 한국어화·근거 SoT 명문화, 그리고 mutation 실측으로 뒷받침된 신규
음성 테스트 3건(endReason 키 부재·fallback 존재·우선순위) 추가로 구성된다. 소스 코드를 직접 읽고
신규 fixture 를 손으로 트레이스한 결과 모든 `expect` 기대값이 실제 함수 동작과 일치했고, JSDoc 이
서술하는 2단 조회·우선순위도 코드와 line-level 로 정확히 대응했다. plan 문서가 인용하는 spec 근거
(Inv-8, unsound discriminator, endReason 필드 위치)도 전부 실재하며 사실과 부합해 spec fidelity 관점의
Critical/Warning 은 없다. 잔여 사항은 전부 INFO 수준이다 — `null` 명시값 미고립(근거 있는 의도적 이월),
과거 라운드 RESOLUTION 문서에 남은 정정 전 e2e 판단(감사-이력 보존 정책상 의도적 미소급수정, 최종
라운드가 대체), JSDoc 문장의 경미한 단순화(오해 위험 낮음). 세 라운드 모두 Critical 0 / 최종 Warning 0
으로 수렴했고, 본 라운드의 독립 재검증에서도 새로운 Critical/Warning 사유를 발견하지 못했다.

## 위험도
NONE
