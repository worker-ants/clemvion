# RESOLUTION — 하네스 Workflow 계약 fix

대상 SUMMARY: `./SUMMARY.md` (**HIGH**, Critical 3, Warning 10)

> **이 리뷰는 수정 대상 워크플로 자신이 수행했다** — 실전 검증을 겸한다. 부수 확인:
> `routing=done: 8 reviewers run, 6 skipped`(router 정상 동작) · `8/8 usable` ·
> `forced_missing=[]` · `recovered=[]`. 종전이라면 가짜 success 가 섞였을 자리다.

## 조치 항목

| SUMMARY # | 카테고리 | 판정 | 조치 | commit |
| --- | --- | --- | --- | --- |
| C1 | 요구사항 | **fix** | `merge-coordinate.js` 에 동일 P0 결함 잔존 — **정확한 지적**. 통합 게이트라 review/consistency 와 동급 이상 안전-critical 인데, 같은 거짓 음성을 그쪽에만 남길 이유가 없다. shared block·인라인 전달·`has_report`/`recovered` 동일 적용 | `1c9e2a3` |
| C2 | 문서정합성 | **fix (조사 결과 양립)** | 아래 §C2 참조 | `1c9e2a3` |
| C3 | 테스트 | **fix (처방은 변경)** | 아래 §C3 참조 | `1c9e2a3` |
| W3 | Plan위생 | **fix** | P0~P2 세부 체크박스가 미체크로 커밋돼 완료 여부의 단일 진실을 흐림 — 실제 상태로 정정 | `1c9e2a3` |
| W1 | 아키텍처 | **수용(현행 유지)** | 신규 CLI 가 `code_review_orchestrator.py` 에만 있고 consistency SKILL 이 이웃 스크립트를 호출하게 안내하는 건 사실. 두 orchestrator 의 `_retry_state.json` 은 동일 계보 스키마이고 `--sync-from-disk` 는 `subagent_invocations` 만 읽어 동작이 실측 확인됐다. 공용 `_lib` 승격은 두 스킬의 기존 **"완전 복제" 컨벤션**을 바꾸는 별개 결정이라 후속 | — |
| W2 | 거버넌스 | **부분 조치 · 후속** | "hook 강제 없는 산문 의무는 압력 앞에 무너진다" — 이 PR 을 촉발한 사고와 동형이라는 지적이 날카롭다. Workflow 경로는 `forced_missing[]` 을 **구조적으로 계산**해 반환하므로 산문이 아니다. fallback 경로의 hook 강제는 `review_guard` 를 건드려야 하고 그러면 **기존 커밋된 세션 전부가 재평가**되어 blast radius 가 크다 → 사용자 판단 필요 | — |
| W4~W10 | 유지보수성 외 | **부분 조치** | 주석 중복은 C3 의 shared-block + drift guard 로 구조적 해소. 나머지는 리뷰어가 "선택/후속" 으로 표기 | — |

## C2 — 상충하는 두 "확정 진단": **둘 다 옳았다**

리뷰어 지적: `orchestrator-workflow-migration.md` 가 "차단은 `worktree.bgIsolation` 이고
**filename is irrelevant**" 를 5-probe 로 못박아 뒀는데, 본 PR 의 §7 은 정반대(basename 기반)를
주장하며 상호 조정이 없다 — 5월에 기각된 가설의 재탕 아닌가.

**조사 결과 — 가드는 둘이고 서로 모순되지 않는다:**

1. **bgIsolation 가드**: 부모가 `EnterWorktree` **툴**로 격리하지 않은 bg 세션 → **모든**
   sub-agent write 차단. 파일명·position 무관. ← 5월 문서가 **옳게** 규명한 것.
2. **report-file 가드**: `SUMMARY.md` 계열 basename 만 차단. ← 본 PR 이 규명한 것.

5월 probe 는 **①이 활성인 세션**에서 수행됐다. 그 상태에선 모든 write 가 차단되므로
**파일명 규칙을 관측할 수 없다** — `detail.md` 와 `SUMMARY.md` 가 "동일하게" 차단된 것은
파일명이 무관해서가 아니라 ①이 둘 다 삼켰기 때문이다. "filename is irrelevant" 는
**교란된 결론**이었다.

본 실측은 `EnterWorktree` 로 격리된 interactive 세션(①비활성)이라 ②가 드러난다 —
**같은 workflow·같은 세션**에서 `notes.md`·`cross_spec.md`·`RESOLUTION.md` 는 성공하고
`SUMMARY.md`·`summary.md`·`REPORT.md`·`findings.md` 는 차단된다. 거부 메시지도 ①이 아니라
②의 것이다(`"not write report files"`).

**조치**: 양 문서에 상호 참조 + **실측 조건(격리 여부) 명기**. 5월 문서의 "Corrected design
(summary 가 자기 파일을 직접 쓴다)" 은 격리 세션에서도 성립하지 않음을 명시(코드는 애초에
그 설계를 채택하지 않았다 — doc↔code 불일치도 함께 해소).

**5월이 옳게 지적한 context-cost 는 유효**하므로 되살리지 않았다: 전문은 main 이 아니라
**summary sub-agent 에게만** 인라인 전달하고, main 반환에는 `{name, status, has_report}` 만 싣는다.

## C3 — 처방을 바꿨다: **모듈 추출→import 는 이 샌드박스에서 불가능**

리뷰어 처방은 "`_lib/agent-return.mjs` 로 추출해 두 워크플로가 import". 실측으로 확인:

| 시도 | 결과 |
|---|---|
| 정적 `import {x} from '...'` | `SyntaxError: import call expects one or two arguments` (launch 거부) |
| 동적 `await import('...')` | `Error: import() is not available in workflow scripts.` |

**중복은 환경이 강제하는 것**이라 없앨 수 없다. 그래서 이 저장소가 이미 쓰는
**소스텍스트 guard** 관행(`no-raw-execution-href.test.ts` 선례)으로 해결했다:

- `_lib/agent-return.mjs` = **canonical 텍스트 + 유닛 테스트 대상**(워크플로는 import 하지 않음)
- 3개 워크플로가 마커 블록(`>>> SHARED-BLOCK`)을 **verbatim 미러**
- `test_workflow_scripts.py` 가 drift 시 build fail + `test_agent_return.mjs`(node:test) 유닛 11건
- CI `harness-checks.yml` 에 `.claude/workflows/**` paths + `node --test` step 추가

### 부수 발견 — `node --check` 는 이 파일들의 유효한 게이트가 아니다

워크플로는 `export const meta`(ESM 전용)와 top-level `return`(CJS 전용)을 동시에 가져 어느
모듈 종류로도 유효하지 않다. 그래서 `node --check` 가 **중복 `const` 조차 exit 0** 으로
통과시킨다(일반 파일에선 정상 검출됨을 대조 확인). 실제로 블록 주입 시 `usable` 이 두 번
선언됐는데 `node --check` 는 OK 를 줬다 — **이 PR 이 고치는 false green 과 같은 클래스**다.
하네스 VM 의 async 래핑을 재현하는 검사를 테스트로 고정하고, 그 검사가 vacuous 하지 않음을
자체 sabotage 테스트로 증명한다.

## TEST 결과

- **lint**: 해당 없음 (변경 set 에 `codebase/**` 없음 — JS 는 워크플로 샌드박스용이라 eslint 대상 아님)
- **unit**: 통과 — 하네스 **220** OK (신규 가드 5 포함) · workflow 유닛 **11/11** (`node --test`) · 프로덕트 `run-test.sh unit` PASS
- **build**: 해당 없음 (`codebase/**` 무변경)
- **e2e**: **면제** — PROJECT.md §e2e 면제 화이트리스트 인용: "`spec/**` · `plan/**` · `review/**` …" (96행), "`.claude/**` (skills, hooks, agents 정의)" (97행), "`.github/**` (CI 정의는 e2e 가 검증 대상 아님)" (101행). 본 변경 set 은 `.claude/**` + `plan/**` + `review/**` + `.github/workflows/harness-checks.yml` 로 **화이트리스트의 부분집합**이며 `codebase/**` 는 한 줄도 없다 — docker 스택이 실행할 제품 코드가 없다.

mutation 검증(테스트가 진짜 가드인지): scope 가드 무력화 → 5건 red / 복원 → green.
워크플로 문법 검사에 중복 `const` 주입 → 검출 / 원복 → green.

## 보류·후속 항목

| 항목 | 사유 |
| --- | --- |
| W2 — fallback 경로의 `--verify-coverage` hook 강제 | `review_guard` 변경은 기존 커밋된 전 세션을 재평가해 blast radius 가 크다. Gate C 식 cutoff grandfather 패턴이 필요 → 사용자 판단 |
| W1 — `_sync_from_disk`/`_verify_coverage` 를 `skills/_lib` 로 승격 | 두 orchestrator 의 "완전 복제" 컨벤션을 바꾸는 별개 결정 |
| `code-review-summary` 등 3개 agent 정의의 "terminal" 오기 | 본 PR 은 SoT 문서(§7)와 워크플로를 정정. agent 정의 8개 파일 일괄 교체는 범위가 커 후속 (SUMMARY C2 제안) |
