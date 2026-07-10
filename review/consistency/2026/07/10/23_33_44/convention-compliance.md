# 정식 규약 준수 검토 — llm-usage-attr-hardening-4648ca (`--impl-done`)

- **대상 커밋**: `5e6f70b76` fix(nodes/ai) + `bc1810eb3` chore(review)
- **diff base**: `git diff origin/main...HEAD` (merge-base `cc3dafa8c`)
- **실 코드 변경 2파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`(+9/-1), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts`(+48, append-only)
- **나머지 17파일**: `review/consistency/2026/07/10/22_52_18/**`(--impl-prep 산출물, 선행 커밋 `5e6f70b76`에 동봉) + `review/code/2026/07/10/23_20_30/**`(ai-review 산출물, `bc1810eb3`)

## 발견사항

### [Warning] RESOLUTION.md 섹션 헤더가 developer SKILL 의 `RESOLUTION.md schema` 와 리터럴 불일치

- target 위치: `review/code/2026/07/10/23_20_30/RESOLUTION.md` 전체 — 실제 헤더는 `## 1. W1 — plan 체크박스 미갱신에 durable 추적 부재 (documentation)`(10행), `## 2. INFO#3 — 대칭 커버리지 갭 (testing)`(47행), `## 3. 조치 불요로 종결한 INFO`(68행), `## 4. 재검증`(80행)
- 위반 규약: `.claude/skills/developer/SKILL.md:109-115` §RESOLUTION.md schema — 표에 `## 조치 항목`(✓ 필수, SUMMARY # ↔ fix commit hash 매핑), `## TEST 결과`(✓ 필수), `## 보류·후속 항목`(있을 때) 3개 섹션명이 명시돼 있고, 같은 문서 117-121행 "push 전 자가 검증" 체크리스트 1번째 항목이 `## 조치 항목`·`## TEST 결과` 두 섹션의 **리터럴 존재**를 요구한다. `.claude/agents/resolution-applier.md:76,116,133` 도 동일 헤더명(`## 보류·후속 항목`, `## TEST 결과 → e2e`)을 참조 대상으로 인용한다.
- 상세: 이번 RESOLUTION.md 는 번호식 자유 서술 구조를 택해 위 3개 헤더 중 어느 것도 리터럴로 등장하지 않는다. 내용상 "## 4. 재검증"이 `## TEST 결과`에, "## 1"·"## 2"가 `## 보류·후속 항목`에 상응하지만, `## 조치 항목`(fix commit 매핑표)에 해당하는 섹션은 통째로 빠져 있다 — 이번 세션은 Critical 0·fix commit 0건(전량 defer/조치불요)이라 매핑표가 공집합이 되는 경우인데, "해당 없음" 표기조차 없이 섹션 자체가 없다. `guard_review_before_push.py`→`review_guard._summary_is_resolved()`(`.claude/hooks/_lib/review_guard.py:355-364`)는 `RESOLUTION.md` **파일 존재 여부**만 확인하므로 기계적 push 차단은 발생하지 않지만, SKILL.md 가 명시한 사람 대상 self-check 항목은 문면 그대로 불충족.
- 제안: RESOLUTION.md 를 `## 조치 항목`(빈 매핑표 + "해당 없음 — Critical 0, Warning 1건은 §아래 defer" 명시) / `## TEST 결과`(현 "## 4. 재검증" 내용을 이 헤더 아래로 이동, e2e 줄은 4형식 중 하나 그대로 유지) / `## 보류·후속 항목`(현 "## 1"·"## 2"·"## 3" 내용 이동) 3분류로 재구성 권고. 혹은 번호식 자유 서술이 실제로 더 낫다는 판단이면 SKILL.md §RESOLUTION.md schema 쪽을 갱신하는 것이 적절 — 문서가 실제 관행을 못 따라가는 case 로 보임.

### [Warning] Warning "defer" 처리가 developer SKILL 의 명문 규정(ISSUE FIX 정책/완료 정의)과 정확히 대응하는 예외 카테고리가 없음

- target 위치: `review/code/2026/07/10/23_20_30/RESOLUTION.md:12` (W1 판정: "defer — 단, ... durable 추적 부재 자체는 본 RESOLUTION 으로 해소")
- 위반 규약: `.claude/skills/developer/SKILL.md:131-133` §ISSUE FIX 정책("Warning 이상·테스트 누락은 지시 범위 밖이라도 **해결**. ... **spec 자체 문제는 멈추고 project-planner 위임**" — spec-issue 외의 defer 경로가 명문에 없음) + `.claude/skills/developer/SKILL.md:103` §완료 정의("SUMMARY 의 Critical/Warning 0 (애초에 없었거나, resolution-applier/수동으로 **fix** + RESOLUTION.md)" — "fix" 로 0 도달을 명시, "defer" 문언 없음) + `.claude/agents/resolution-applier.md:62-65` §1 분류(SPEC-DRIFT / spec 관련 / 코드 관련 3분류뿐 — "plan 추적 merge 충돌 회피" 류의 process-only Warning 을 위한 4번째 defer 카테고리 미정의, `sensitive-fix` 가드도 DB 마이그레이션·인증·API 계약 등 열거된 항목에 한정돼 이 case 를 포함하지 않음)
- 상세: 저장소의 실제 관행(예: 기존 다수 code-review 세션 — `review/code/2026/07/03/21_48_56/**`, `.../06/21/18_38_11/**` 등 — 이 전부 "plan 체크박스 = 실제 상태" 를 근거로 **동일 PR 안에서 체크 갱신**을 권고했지, "defer 후 RESOLUTION 근거 기록"을 대안으로 받아들인 선례는 검색 범위 안에서 발견되지 않음)에 비춰볼 때, 이번 W1 판정은 **드문 형태의 defer**다. 다만 이번 case 는 통상 사례(단순 누락)와 달리 구체적 기술 근거(동시 진행 중인 PR #898 이 같은 plan 파일의 인접 리스트 항목을 편집 중이라 git 3줄 context 안에서 hunk 충돌 개연성이 실측됨, `--impl-prep` 단계에서 `plan-coherence.md`(`review/consistency/2026/07/10/22_52_18/plan-coherence.md:18-21`)가 이미 이 옵션(B)을 사전 승인)와 명확한 종결 조건(spec_impact 리스트까지 특정)을 갖춰, 순수 방치와는 성격이 다르다. 또한 push-gate `plan_guard.py` 관점에서는 이 plan(`resume-llm-usage-attribution.md`, `worktree: elastic-shannon-e52824`)이 현재 worktree(`llm-usage-attr-hardening-4648ca`)와 frontmatter 불일치라 애초에 "연결된 plan" 으로 자동 판정되지 않아(`.claude/docs/plan-lifecycle.md §3` 연결 판정 기준), 기계적 차단 대상도 아니다.
- 제안: (a) 이 세션의 실질 판정 자체를 되돌릴 필요는 낮다고 보이나, (b) `developer/SKILL.md` §ISSUE FIX 정책 또는 §RESOLUTION.md schema 에 "process/tracking 성격 Warning(spec 결함도 sensitive-fix 대상도 아닌, 근거가 명확한 동시-PR merge 충돌 회피 등)은 durable 근거 기록을 조건으로 defer 허용" 이라는 3번째 예외 카테고리를 명문화할 것을 권고 — 규약 문서가 실제 필요를 못 따라가는 gap.

### [Info] `--impl-done` consistency-check 산출물이 본 세션 호출 이전에는 부재 — 지금 이 세션이 그 갭을 메우는 중 (위반 아님, 관찰 기록)

- target 위치: 본 세션(`review/consistency/2026/07/10/23_33_44/`) 자체
- 관련 규약: `.claude/skills/developer/SKILL.md:93` "(post-impl 일관성 검토 — spec 연결 코드 변경 시 의무) ... `/consistency-check --impl-done <spec/영역>` 호출은 **의무**"
- 상세: `ai-turn-executor.ts`(`spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 매칭) · `information-extractor.handler.ts`(`spec/4-nodes/3-ai/3-information-extractor.md` frontmatter `code:` 매칭, 단 이번 diff 는 `.spec.ts` 만 건드려 그 자체는 glob 미대상)의 spec 연결로 인해 `--impl-done` 산출물이 push 전 요구된다. 호출 시점(이 세션 시작 전)에는 `review/consistency/**` 아래 `--impl-prep`(22_52_18) 산출물만 존재하고 `--impl-done` 산출물은 없었다 — 그러나 이는 정확히 "push 직전 의무 호출" 모드로 지금 이 세션이 생성하는 중인 것이므로 프로세스 위반이 아니라 정상 순서(구현 → ai-review → impl-done consistency-check → push). 5개 checker 전원이 `BLOCK: NO` 로 수렴해야 이 의무가 완결된다.
- 제안: 없음 — 본 세션 완료 + `BLOCK: NO` 확인만 남음.

### [Info] RESOLUTION.md 의 "background task chip 등록" durability 주장은 저장소 아티팩트로 독립 검증 불가

- target 위치: `review/code/2026/07/10/23_20_30/RESOLUTION.md:33` "**background task chip 등록** — 세션 밖에서도 독립적으로 착수 가능한 self-contained 후속 작업으로 스폰"
- 상세: durable 추적 3중 해소 주장 중 ①RESOLUTION.md 커밋, ②PR 설명 언급은 diff·git history 로 확인 가능하나, ③"chip 등록"은 리포지토리 파일로 남는 아티팩트가 아니라(out-of-band 스폰 메커니즘) `git diff`/`grep` 으로 독립 검증할 수 없는 prose 주장이다. 실제로 스폰되지 않았어도 이 리뷰에서는 판별 불가.
- 제안: 없음(차단 사유 아님) — 참고로만 기록. 필요하면 PR 설명에 chip id/task 참조를 남겨 사후 추적 가능하게 하는 편이 더 강한 증거가 된다.

### [Info] 명명·mock·import·주석 컨벤션 — 위반 없음 (재확인)

- target 위치: `information-extractor.handler.spec.ts:1022-1049`(신규 `it`), `ai-turn-executor.ts:11-14,2596-2609`(import + 타입 주석)
- 상세: 이미 `review/consistency/2026/07/10/22_52_18/convention-compliance.md`(--impl-prep) 및 `review/code/2026/07/10/23_20_30/{documentation,testing,scope}.md`(ai-review) 두 라운드에서 각각 독립적으로 검증됨 — (a) 테스트 헬퍼(`retryState`/`finalizeCall`) 재사용 + `describe('collection retry loop')` 블록 관례 일치, (b) `mock.calls[n][idx]` + `expect.objectContaining` 조합은 backend spec 스위트 전역 관용구(64개 중 43개 파일이 병용, 실측 확인됨), (c) import 스타일은 `@typescript-eslint/consistent-type-imports` 가 backend eslint.config.mjs 에 미등록이라 lint-safe, 자매 파일(plain)과 로컬 파일 관례(inline `type`)가 서로 다른 방향을 가리키나 어느 쪽도 `spec/conventions/**` 에 명문 규정이 없어 위반 아님. 신규 재검증 결과 동일 결론 — Critical/Warning 없음.
- 제안: 없음.

### [Info] CHANGELOG / 유저 가이드 / i18n 동반 갱신 — 의무 미발생 (재확인, 정상)

- target 위치: `PROJECT.md:111-138` §변경 유형 → 갱신 위치 매핑 표
- 상세: 표의 모든 트리거(신규 노드·schema 변경·신규 UI 문자열·통합 변경·API 추가·BullMQ 큐·warningCode/errorCode·cross-cutting enum·backend ui.label·handler output field·AuthConfig enum·user-guide GUI 절) 중 이번 변경(기존 파일의 타입 주석 1줄 + 테스트 1건 추가, 런타임 동작 무변경)에 매칭되는 행이 없다. `CHANGELOG.md` 관련 규칙도 `spec/conventions/**`·`PROJECT.md`·양 SKILL.md 어디에도 build-gate 로 존재하지 않음(판단형 code-review 체크리스트 항목뿐). i18n dict/user-guide 갱신도 사용자 가시 표면 변경이 없어 트리거되지 않음 — 두 차례(--impl-prep, ai-review) 독립 확인과 동일 결론.
- 제안: 없음.

## 검토 관점별 결론

1. **명명 규약** — 위반 없음. 테스트 제목·mock fixture id(`exec-attr-2`/`wf-attr-2`/`nodeexec-row-2`/`node-def-2`)는 기존 `-1` 계열과 grep 충돌 없이 구분되도록 명명(이전 naming-collision INFO 반영 확인).
2. **출력 포맷 규약(review/ 산출물)** — 경로 스키마(`review/code/<Y>/<M>/<D>/<hh>_<mm>_<ss>/`, `review/consistency/<...>/`)는 두 세션(22_52_18, 23_20_30) 모두 정확히 준수. SUMMARY.md 는 위험도/Critical·Warning·Info 표/에이전트별 결론/라우터 결정 섹션을 충실히 갖춤. **RESOLUTION.md 만 스키마 헤더 불일치**(위 Warning #1).
3. **RESOLUTION 의 Warning defer 허용 여부** — 자동 게이트(`review_guard.py`) 관점에서는 파일 존재만으로 통과하나, SKILL.md 명문 규정("Warning 해결", "fix + RESOLUTION")과는 문언상 어긋나는 드문 case (위 Warning #2). 근거 자체(merge 충돌 회피, impl-prep 사전 승인, 종결 조건 명시)는 상세하고 구체적이라 실질적으로는 합리적 판단으로 평가되나, 규약 문서에 이 defer 유형이 정식 카테고리로 등재돼 있지 않다.
4. **developer SKILL DoD 산출물** — TEST WORKFLOW 결과(RESOLUTION §4 재사용), `/ai-review` SUMMARY, RESOLUTION.md 모두 존재. `--impl-done` consistency-check 산출물은 본 세션이 지금 생성 중(Info, 위반 아님) — 완료 시 DoD 충족.
5. **CHANGELOG/유저 가이드/i18n** — 의무 미발생 확인, 정상.

## 요약

이번 diff(타입 주석 1줄 + import, 회귀 테스트 1건)는 `spec/conventions/**` 관점에서 실질적 위반이 없고, 명명·mock·import·CHANGELOG/i18n 항목은 두 차례(--impl-prep, ai-review) 독립 검증과 동일하게 재확인 결과 Critical/Warning 없음이다. 다만 review 산출물 형식 축에서 두 건의 Warning 을 발견했다 — (1) `RESOLUTION.md` 가 developer SKILL 이 명시한 3-헤더 스키마(`## 조치 항목`/`## TEST 결과`/`## 보류·후속 항목`)를 리터럴로 쓰지 않고 번호식 자유 서술을 택해 push 전 self-check 체크리스트를 문면상 불충족시키는 점, (2) Warning 1건(W1, plan 체크박스 durable 추적)의 "defer" 처리가 SKILL.md ISSUE FIX 정책·완료 정의가 명시하는 "fix 로 0 도달" 문언과 정확히 대응하는 예외 카테고리 없이 이뤄진 점. 두 건 모두 자동 push-gate 는 통과하며(파일 존재·plan frontmatter 불일치로 인한 gate 미연결), 실질 판단 근거는 상세하고 합리적이라 되돌릴 필요는 낮지만, 규약 문서(developer SKILL.md)가 실제 필요한 예외 케이스를 아직 명문화하지 못한 gap 으로 남는다.

## 위험도

LOW

STATUS: DONE
