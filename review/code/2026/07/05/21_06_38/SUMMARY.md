# AI Review SUMMARY — ResultDetail waiting props 공용 hook 추출 (V-05 후속)

세션: `review/code/2026/07/05/21_06_38` · 대상 커밋 `b6a9c6cf5` (refactor) + 후속 resolution.
경로: 직접 Agent fan-out (6 reviewer), 명시 diff 컨텍스트(`refactor2.diff`).

## 위험도: LOW · Critical 0 · Warning 1 (해결됨)

## Reviewer 결과

| Reviewer | risk | Critical | Warning | 요지 |
|---|---|---|---|---|
| maintainability | none | 0 | 0 | 중복(selector 11+콜백 4+ai_form_render 파생 규칙) 진짜 제거. `deriveFlags` non-hook closure 가 문제에 정확. docstring 정확. |
| scope | none | 0 | 0 | 7파일 모두 단일 의도 종속. registry 동반 변경=최소. plan 체크박스 1개만 정확 갱신. (INFO: 표 (e) 레터 갭) |
| side-effect | none | 0 | 0 | Rules of Hooks 준수(selector before early return, deriveFlags after). 소비처별 isSelectedWaiting·isLiveConversation 보존. deriveFlags 공식 byte-identical(ai_form_render→conversation 포함). page 의 waitingInteractionType drop 무영향. |
| testing | low | 0 | 0 | hook test 4값+뉘앙스+게이팅 커버. REGISTRY_SITES 갱신이 exhaustiveness invariant 보존. (INFO: 일부 부분 assertion·null-state 누락) |
| convention (impl-done) | low | 0 | 1 | rule 3 프로즈=실제 배열 정합, `code:` frontmatter hook 미등재=기존정책 일관. (**WARNING: §1.2 (d)→(f) 레터 갭**) |
| cross-spec (impl-done) | low | 0 | 0 | 매트릭스 vs 코드 정합. 타 spec 4건 drawer/page 를 파생 site 로 지목하는 stale 참조 없음. (INFO: rule 3 "TS 로만 커버" 문구 부정확·§12.5 사후 서술 historical) |

## Warning (해결)

**W-1 (convention)**: §1.2 매트릭스가 old (d)drawer+(e)page 를 hook (d) 로 병합하면서 `(e)` 가 소거돼 `(d)→(f)` 레터 갭 발생 — "누락 항목"으로 오독 위험.
→ **해결**: (f)→(e), (g)→(f) 로 재번호해 (a)~(f) 연속화. §1.2 4개 행 + rule 3 + resume 노트 (g)참조 동시 갱신. `grep (g)`=0 확인.

## INFO (반영)

- **cross-spec**: rule 3 의 drawer `isLiveConversation` "TS 로만 커버" → 부정확(plain `||`, assertNever 아님). "두 가드 어느 쪽도 아닌 subset 소비처, 신규 enum 은 non-live 로 자동 처리(의도적 binary)" 로 정정.
- **testing**: buttons·ai_conversation·ai_form_render 케이스를 full `toEqual` 배타성 단언으로 강화 + `interactionType=null` 케이스 추가(5→6 cases).
- **cross-spec (§12.5 historical), scope (레터 갭=W-1 로 승격 처리)**: 별도 조치 불필요/W-1 로 흡수.

## 재검증

resolution batch = spec doc(whitelisted) + hook test(test-only). production 코드 delta 0 → e2e 는 커밋 `b6a9c6cf5`(production 동일)에서 이미 PASS(236). lint·unit(48) 재통과.
