# Plan 정합성 검토 — plan_coherence

## 검토 범위 메모

- target scope(`spec/conventions/`) 델타: **0개 파일** — 이번 라운드도 `spec/conventions/` 를 바꾸지 않는다. 정상(코드 전용 PR).
- 이번 라운드(라운드 6 대상)에서 실제로 바뀐 것: 직전 커밋 `7420cede1`("라운드 5") — `codebase/` 변경 **0**, 변경은 전부 `plan/in-progress/harness-review-gate-followups.md`·`plan/in-progress/spec-conventions-engine-error-code-surface.md`·`plan/in-progress/trigger-canary-hardening.md` 세 plan 문서와 `trigger-workflow-ref.spec.ts` 헤더 주석(round 5 반영: 자리 수 SoT 를 e2e 파일로 이관)뿐이다.
- 이 라운드가 실제로 다루는 것은 **직전(`13_04_59`) 라운드가 남긴 INFO 2건이 이번 커밋에서 어떻게 처리됐는가**다. 원문·diff 대조로 확인했다.

## 발견사항

### [INFO] 직전 라운드 INFO#4(harness corpus 굶주림 역방향 포인터) — 처리 확인, 문제없음

- target 위치: 없음 (target=`spec/conventions/`)
- 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §"승격은 됐는데 굶는다 …" / `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목("`--impl-prep`/`--spec` 번들이 `spec/` 코퍼스를 통째로 절단한다")
- 상세: `13_04_59` 라운드가 지적한 "역방향 교차참조 부재"를 이번 커밋이 정확히 해소했다 — `harness-review-gate-followups.md` 에 "두 번째 사례가 다른 트래커에 등재됐다 (2026-09-14)" 포인터가 추가됐고, 인용된 출처(`plan_coherence INFO#4`)도 `13_04_59/SUMMARY.md` 의 실제 테이블 번호와 일치한다(대조 완료). 두 모드(`--spec`/`--impl-prep`)가 같은 근본원인인지 "미확정"이라고 정직하게 남긴 것도 과잉 병합을 막는 적절한 처분이다.
- 제안: 없음 — 조치 완료로 확인.

### [INFO] 직전 라운드 INFO#5(repo-guard 개수 7/8 vs 14/5/9 교체 제안) — 채택 대신 반박, 근거 타당

- target 위치: 없음 (target=`spec/conventions/`, repo-guard 등재 관례는 여전히 어느 spec 에도 없음 — (b) 결정 미해결 상태 유지)
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` §"관련" 말미 / `plan/in-progress/spec-draft-nullable-notation-followups.md` "신규 repo-guard 가 spec `code:` 에 미등재" 항목
- 상세: `13_04_59` checker 는 "7/8 을 14/5/9 로 교체"를 제안했으나, 이번 커밋은 그 처방을 **채택하지 않고** 대신 "두 수치는 다른 질문의 답(파일-쌍 개수 vs code: 등재 개수)"이라는 근거를 담은 포인터만 추가했다. 원문 대조 결과 이 반박은 사실관계상 옳다 — `7`/`8` 은 `*-guard.ts`/`*.spec.ts` **파일 쌍 개수**(2026-09-04 실측)이고, `14`/`5`/`9` 는 **`code:` frontmatter 등재 여부** 기준 개수(2026-09-14 전수 실측)로, 같은 대상을 다른 축으로 센 것이 아니라 애초에 묻는 질문이 다르다. 교체했다면 오히려 정보 손실이었을 것이므로, 이 반박·거절은 checker 제안을 무조건 수용하지 않고 재검증한 건전한 사례다. (b) 결정 자체는 여전히 미해결이며, 두 plan 모두 "결정 턴에 함께 볼 것"이라는 상호 포인터를 유지해 미해결 상태를 정직하게 보존하고 있다.
- 제안: 없음 — checker 제안의 기계적 수용보다 근거 있는 반박이 더 정확하므로 현 상태 유지 권장.

## 그 외 확인했으나 문제없음으로 판정한 항목 (기록용)

- `trigger-workflow-ref.spec.ts`/`trigger-workflow-ref.e2e-spec.ts` "다섯 자리 vs 여섯 형태" 수치 불일치(round 5 대상)는 두 문서 어느 쪽도 숫자를 재조정하지 않고 self-spec 쪽 숫자 서술을 **제거**하고 e2e 파일을 단일 SoT 로 지정하는 구조적 처분으로 닫혔다 — grep 확인: self-spec 은 더 이상 "다섯/여섯" 수치를 자체 주장하지 않고, e2e 헤더의 "여섯 형태"만 남았다. 복제 제거 원칙과 일치.
- `trigger-workflow-ref.e2e-spec.ts` teardown 주석(round 5 는 미변경, round 이전 처분 유지)의 "이것은 테스트 인프라 한정 판단이고 `secret-store.md §R4` 와 충돌하지 않는다" 서술은 `secret-store.md:426~428`(§R4, 프로덕션 FK cascade 미채택 규율) 원문과 대조해도 스코프가 갈려 충돌 없음 — 기존 판정 유지.
- `spec-draft-nullable-notation-followups.md` 의 트래커 4건(`[x]`) 체크박스·실측 각주와 `trigger-canary-hardening.md` 체크리스트 서술이 양쪽 문서에서 일치함을 재대조 완료(비밀 컬럼 가드 · schedule `workflow` 세 자리 · 캐너리 주석 정리 · teardown 근거 정정).
- 신규 발견 4건(`TriggersService.delete()` 오기 3곳 · `2-trigger-list.md code:` 누락 · repo-guard `code:` 미등재 (a)/(b) · 단건 조회 양성 커버리지 0) 모두 owner(planner/developer)·근거·인접 항목 상호참조가 명시돼 있어 "후속 항목 누락"에 해당하지 않음.
- 미해결 결정("(b) repo-guard 등재를 규약으로 세울 것인가", "ARCH#5 ⑤ 세 번째 자매 const 재개 신호") 중 어느 것도 이번 라운드의 코드/plan 변경이 우회하거나 일방적으로 확정하지 않았다 — 둘 다 여전히 열린 채로 정확히 보존됨.

## 요약

이번 라운드는 `spec/conventions/` 델타 0의 코드 전용 변경(직전 라운드 대비 실질 변경은 `codebase/` 0줄, `plan/**` 포인터 보강뿐)이며, 직전(`13_04_59`) `plan_coherence` 가 남긴 INFO 2건을 각각 (1) 정확한 역방향 포인터 추가, (2) 기계적 수용 대신 근거 있는 반박으로 적절히 처리했다. 미해결 결정을 우회하거나 선행 plan 의 전제를 깨뜨린 곳, 후속 항목이 누락된 곳은 발견되지 않았다. `plan/in-progress/trigger-canary-hardening.md` 와 `spec-draft-nullable-notation-followups.md` 는 6라운드에 걸친 자기 감사 이력을 시종 정합되게 유지하고 있다.

## 위험도

NONE
