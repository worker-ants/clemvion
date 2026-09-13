# Plan 정합성 검토 — spec/conventions/ (impl-done, diff-base origin/main)

## 검토 범위 요약

- target scope(`spec/conventions/`) 델타: **0개 파일** — 이 브랜치는 spec 을 고치지 않는다(`plan/in-progress/guide-identifier-existence.md` frontmatter `spec_impact: none` 과 일치).
- 실제 코드 diff(5파일/1112줄, `guide-error-code-{existence,scan}` 삭제 → `guide-identifier-{existence,scan}` 신설 + `guide-sanitized-message-parity.test.ts` 소폭 수정 + `CHANGELOG.md`/`PROJECT.md`)는 `guide-identifier-existence.md` 라운드 1~6 을 통해 이미 6회의 code-review·consistency 라운드(`review/{code,consistency}/2026/09/13/{14_41_14…16_28_53}`)를 거쳤다.
- 이번 라운드(라운드 7, 현재 세션)는 그 plan 이 스스로 예고한 정지 지점("`/ai-review`+`--impl-done` 이 Critical 0·WARNING 0 이면 멈춘다")에 해당하는 세션이다.

## 확인한 사실관계 (직접 절대경로로 재검증)

1. `spec/conventions/user-guide-evidence.md §2` — 현재도 "가드 3건"(`impl-anchor-existence`·`integrations-coverage`·`triggers-coverage`)만 등재돼 있고, `guide-identifier-existence`/`guide-sanitized-message-parity` 는 없다. `PROJECT.md:300` 은 이 문서를 SoT 로 지목하지만 실제로는 미등재 — **plan 이 이미 알고 있고 planner 항목으로 옮겨져 있다**: `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274` (미체크, planner 소유, `guide-identifier-*` 리네임 후 이름·frontmatter `code:` 갱신·Rationale 요구까지 명시). `guide-identifier-existence.md` 의 체크리스트 항목("planner 등재 갱신")이 가리키는 곳이 정확히 여기이고 내용도 일치한다.
2. `spec/conventions/cafe24-api-metadata.md §4` Principle 7→0 오인용 건 — `guide-identifier-existence.md §D#4` 가 "이번 plan 과 무관한 선재 결함"으로 분류하고 별도 planner 항목으로 등재했다고 주장. 실측: `spec-draft-nullable-notation-followups.md:3406-3414` 에 동일 내용이 planner 항목으로 정확히 등재돼 있음(무관계·선재 확인 포함). 일치.
3. 리네임(`guide-error-code-*` → `guide-identifier-*`) 전방 참조 — `PROJECT.md`·`CHANGELOG.md`(각주 보존)·`spec-draft-nullable-notation-followups.md`(각주 보존, 옛 이름은 "당시"/"리네임 전" 명시)까지 검색했으나 **비-역사 문맥에서 옛 이름을 쓰는 현재 유효 참조는 없음**. `plan/complete/guide-error-code-truth.md` 는 완료 문서라 갱신 대상 아님.
4. "허용목록 없음" 원칙 번복 — 이 주장을 전제로 삼는 다른 in-progress plan 은 없음(`grep`: `guide-identifier-existence.md`/`spec-draft-nullable-notation-followups.md` 외 0건). 번복이 다른 plan 의 후속 항목을 무효화하는 사례 없음.
5. `#1331` PR 번호 placeholder 치환 미체크 항목 — push 전 상태이므로 미체크가 정상. 다만 plan 이 적어 둔 "grep 이 10곳을 낸다"는 안내 숫자가 현재 실측(`plan/` 전체 11곳: 대상 파일 7 + `guide-identifier-existence.md` 자기서술 4)과 어긋난다. 그러나 치환 절차 자체는 숫자가 아니라 명시된 grep 커맨드(`grep -n '#1331' plan/in-progress/spec-draft-nullable-notation-followups.md`)로 정의돼 있어 실행에는 영향 없음.

## 발견사항

- **[INFO]** `#1331` 총계 안내 숫자가 최신 plan 본문과 어긋남
  - target 위치: 해당 없음(target `spec/conventions/` 은 이 숫자와 무관)
  - 관련 plan: `plan/in-progress/guide-identifier-existence.md:274` ("`grep -rn '#1331' plan/` 은 **10곳**을 낸다")
  - 상세: 현재 `plan/` 전체에서 `#1331` 은 11곳(대상 파일 `spec-draft-nullable-notation-followups.md` 7곳 + `guide-identifier-existence.md` 자기서술 4곳)이다. 안내 숫자(10)는 이 체크리스트 항목 자체가 나중에 더 길어지면서(라운드 서술 추가) 자기참조 카운트가 늘어난 결과로 보인다. 치환 실행 절차는 파일 지정 grep 커맨드로 고정돼 있어 실무 영향은 없음(치환 실수를 유발하지 않음).
  - 제안: PR 번호 확정 후 `#1331` 일괄 치환하는 김에 이 안내 숫자도 재실측해 갱신(강제 아님, cosmetic).

발견된 CRITICAL/WARNING 없음. 나머지 두 검토 관점(미해결 결정과의 충돌, 선행 plan 미해소)에 해당하는 사례를 찾지 못했다 — target 델타 0 이고, 이 배치가 필요로 하는 spec 갱신(§2 가드 3건 목록 확장, cafe24-api-metadata.md §4 오인용 정정)은 모두 developer 권한 밖 항목으로 정확한 planner 트래커(`spec-draft-nullable-notation-followups.md`)에 이미 등재돼 있고, 등재 문구 자체도 리네임 이후 이름·요구사항과 일치한다.

## 요약

이 배치는 spec/conventions/ 자체를 고치지 않으며(spec_impact: none), 그로 인해 발생하는 두 개의 spec 갱신 필요 항목(user-guide-evidence.md §2 가드 목록 확장, cafe24-api-metadata.md §4 오인용 정정)은 developer 권한 밖이라는 것을 스스로 인지하고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정확한 내용·이름으로 등재해 두었다 — 직접 대조 결과 누락이나 불일치가 없다. 6라운드에 걸친 code-review/consistency-check 이력이 이미 이 plan 과 target 문서 사이의 개념적 충돌(허용목록 원칙 번복, 3축→백틱 전수 교체, 파일명 리네임 전방 참조)을 스스로 찾아 각주·planner 등재로 해소했으며, 이번 검토에서 새로 발견되는 미해소 선행 조건이나 후속 항목 누락은 없었다. 유일한 관찰은 체크리스트 안내 숫자(10 vs 11)의 사소한 drift로, INFO 등급이며 실행 절차에는 영향이 없다.

## 위험도

NONE
