# Plan 정합성 검토 — spec/conventions/ (impl-done, diff-base origin/main, 라운드 8)

## 검토 범위 요약

- target scope(`spec/conventions/`) 델타: **0개 파일** — `plan/in-progress/guide-identifier-existence.md` frontmatter `spec_impact: none` 과 일치. 이 배치는 spec 을 고치지 않는다.
- 실제 코드 diff 는 `guide-identifier-existence.md` 라운드 1~7 을 거쳐 이미 7회의 `/ai-review`+`--impl-done` 세션(`review/{code,consistency}/2026/09/13/{14_41_14…16_56_35}`)을 통과했다. HEAD(`1a2e78519`, "라운드 7")는 라운드 6 이후 발견된 `BACKTICK` 축 CRITICAL(부분 매치만 검사, 혼합 스팬 6종 미검사)을 고친 커밋이며, 이번 검토는 그 직후 상태를 본다(라운드 6 consistency `16_56_35` 와 코드 변경 없이 동일 시점).
- 직전 라운드(`review/consistency/2026/09/13/16_56_35/plan_coherence.md`)가 이미 같은 세 관점에서 NONE 판정을 냈다. 이번 라운드는 그 판정이 라운드 7 수정 이후에도 유지되는지 재검증한다.

## 확인한 사실관계 (절대경로 직접 재검증)

1. **`user-guide-evidence.md §2` 미등재 (developer 권한 밖)** — 현재도 "가드 3건"만 등재돼 있고 `guide-identifier-existence`/`guide-sanitized-message-parity` 는 없다. `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274` 에 planner 항목으로 정확한 이름(`guide-identifier-*`)·frontmatter `code:` 갱신 요구·Rationale 요구까지 미체크(`- [ ]`) 상태로 등재돼 있다. 신규 미등재나 불일치 없음.
2. **`cafe24-api-metadata.md §4` Principle 7→0 오인용** — 현재도 §4 "용어 주의" 박스가 "Principle 7" 로 오인용 중(실제 5필드 invariant 정의는 `node-output.md` Principle 0 소유, `node-output-redesign/README.md:83,91` 로 번호 체계 재확인). `spec-draft-nullable-notation-followups.md:3406-3414` 에 developer 가 등재한 planner 항목으로 동일 내용(무관·선재 확인 포함)이 정확히 있음. 일치.
3. **리네임 전방 참조** — `guide-error-code-*` → `guide-identifier-*` 리네임 이후 비-역사 문맥에서 옛 이름을 쓰는 현재 유효 참조 없음(`PROJECT.md`·`CHANGELOG.md`·트래커 모두 각주/역사 표기로 보존).
4. **라운드 7 신규 등재 항목** — `guide-identifier-scan.ts` 의 `lastIndex` 리셋 보일러플레이트 4곳 복제 건이 `spec-draft-nullable-notation-followups.md:3416-3429` 에 developer 항목으로 새로 등재됐다(권한·소유 경계 정상 — 코드 리팩터라 developer 소유).
5. **`#1331` PR 번호 placeholder** — 대상 파일(`spec-draft-nullable-notation-followups.md`) 안 실제 발생 **7곳**(실측 grep 일치, plan 이 명시한 숫자와 일치). 라운드 7 이 "총계를 아예 쓰지 않는다"로 방침을 바꾼 뒤, 자기서술 문서(`guide-identifier-existence.md`) 안의 총계 주장은 모두 과거 오류를 설명하는 역사 서술로 바뀌어 있고 살아있는 카운트 주장은 없음 — 라운드 7 이전에 있었던 자기참조 인플레이션 결함(직전 라운드가 INFO 로 지적)이 이번 라운드에서 근본 원인 방식(총계 미기재)으로 해소됨.
6. **"허용목록 없음" 원칙 번복** — 이 전제에 의존하는 다른 in-progress plan 없음(전체 grep: `guide-identifier-existence.md`/`spec-draft-nullable-notation-followups.md` 외 0건). 다른 plan 의 후속 항목을 무효화하는 사례 없음.

## 발견사항

발견된 CRITICAL/WARNING/INFO 없음. 세 관점(미해결 결정과의 충돌 · 선행 plan 미해소 · 후속 항목 누락) 모두에서 새로운 사례를 찾지 못했다 — target 델타가 0이고, developer 권한 밖 spec 갱신 2건(§2 가드 목록, cafe24-api-metadata.md §4)이 정확한 이름·내용으로 planner 트래커에 이미 등재돼 있으며, 라운드 7 이 새로 만든 항목(`lastIndex` 리팩터)도 올바른 소유자(developer)로 등재됐다. 직전 라운드가 지적한 유일한 INFO(총계 10 vs 11 drift)는 "총계 자체를 안 쓴다"는 구조적 수정으로 해소됐다.

## 요약

라운드 7 수정(HEAD `1a2e78519`) 이후에도 spec/conventions/ 와 plan/in-progress/ 사이의 정합성은 유지된다. 이 배치가 필요로 하는 두 건의 spec 갱신(user-guide-evidence.md §2 가드 목록 확장, cafe24-api-metadata.md §4 오인용 정정)은 developer 권한 밖임을 스스로 인지하고 `spec-draft-nullable-notation-followups.md` 에 정확한 이름·요구사항으로 등재해 두었으며, 이번 검토에서 직접 대조한 결과 누락·불일치가 없다. 라운드 7 이 새로 만든 코드 항목(`lastIndex` 보일러플레이트)도 올바른 소유자로 등재됐고, 직전 라운드가 지적한 자기참조 카운트 drift 는 "총계 미기재" 방침으로 근본 해소됐다. 새로 발견되는 미해소 선행 조건이나 후속 항목 누락은 없다.

## 위험도

NONE
