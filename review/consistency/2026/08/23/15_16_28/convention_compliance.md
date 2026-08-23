STATUS=success convention_compliance review complete
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `masking-gate-consolidation` (impl-done)

## 검토 범위 메모

프롬프트 번들의 "Target 문서"는 `spec/5-system/` 로 표기돼 있으나, `git diff
origin/main...HEAD --stat` 실측 결과 이번 PR 이 실제로 건드린 spec 문서는
`spec/conventions/egress-masking.md` §3 (11줄 diff) **한 곳뿐**이다
(`spec/5-system/**` 는 diff 0). 코드 변경은 `codebase/backend/src/shared/utils/
redact-stored-error.ts`(신규 헬퍼 2개 추가) · `executions.service.ts` ·
`background-runs/background-runs.service.ts`(호출부 교체, 동작 무변경) 다. 아래는
이 실제 diff 를 1차 대상으로, 번들에 실린 `spec/5-system/*` baseline 은 이전 라운드
(`13_55_36`)에서 이미 점검됐으므로 재확인만 했다.

## 발견사항

이번 diff 로 인한 신규 CRITICAL/WARNING 위반은 발견하지 못했다.

- **[INFO] `egress-masking.md` frontmatter `code:` 가 새 중심 소비 파일을 나열하지 않음**
  - target 위치: `spec/conventions/egress-masking.md` frontmatter `code:` 목록
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` (`code:` = "본 spec 이 약속한
    surface 의 구현 경로")
  - 상세: 이번 통합으로 §3 addendum 이 이름으로 지목하는 `redactStoredFieldsForResponse`·
    `redactNodeExecutionRow` 는 `codebase/backend/src/shared/utils/redact-stored-error.ts`
    에 있는데, frontmatter `code:` 목록엔 그 파일이 없다(`sanitize-error-message.ts` 만
    등재). 다만 이는 **가드 위반이 아니다** — `spec-code-paths.test.ts` 는 `status:
    implemented` 문서가 글로브 ≥1개 매치만 요구하고(R-1, 이미 5개 파일 매치), 목록의
    완전성은 `/spec-coverage` standing audit 소관으로 명시돼 있다. §1 좌표계 표 자체도
    "이 표가 낡는 조건은 마스커가 늘거나 합쳐지는 것" 이라 규정하는데, `redact-stored-error.ts`
    는 `deepRedactSecrets`(표 2행 SoT 심볼, 이미 `sanitize-error-message.ts` 로 등재)를
    호출만 하는 한 겹 위 래퍼이지 새 마스커가 아니므로 이 문서 자신의 논리로도 등재 의무가
    없다고 읽힌다.
  - 제안: 선택 사항. 신규 호출부가 앞으로도 이 파일에 계속 모일 것이므로 향후 편의를 위해
    `code:` 에 한 줄 추가하는 정도 — 급하지 않음.

- **[INFO] `redactNodeExecutionRow` 만 `…ForResponse` 접미사가 없음 (명명 일관성)**
  - target 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` — 자매
    `redactStoredFieldsForResponse`/`redactStoredDataForResponse`/
    `redactStoredErrorForResponse` 셋은 `ForResponse` 접미사를 갖는데 `redactNodeExecutionRow`
    만 없음
  - 위반 규약: 명시적 conventions 문서는 없음(TS 함수 명명은 spec/conventions 범위 밖) —
    참고용 INFO
  - 상세: 이 관찰은 이미 `plan/complete/masking-gate-consolidation.md` "`/ai-review` 처분"
    절 INFO 항목으로 기록·처분됐다("우선순위 낮음으로 명시, 방금 4곳을 옮긴 직후의 추가
    이동이라 diff 를 넓히기만 함"). 새 조치를 요구하지 않는다 — 중복 지적 방지 목적으로만 기록.
  - 제안: 조치 불요(이미 의식적으로 defer 됨).

## 정합성 확인 (문제 없음 — 교차검증 근거로 기록)

- **§3 addendum 의 팩트체크**: `egress-masking.md §3` 이 새로 적은 "표 2행 소비처는
  `deepRedactSecrets` 이고 신규 래퍼가 그 위에 선다"는 주장을
  `codebase/backend/src/shared/utils/redact-stored-error.ts` 원문으로 직접 대조했다 —
  `redactStoredDataForResponse`/`redactStoredErrorForResponse` 둘 다 `deepRedactSecrets`
  를 그대로 호출한다. "표 5행 소비처(`stripExternalOnlyFields`)의 호출부는
  `websocket.service.ts`·`interaction.service.ts` 뿐" 이라는 주장도
  `grep -rl "stripExternalOnlyFields("` 로 실측 재확인했다 — 정확히 그 2개 파일만
  나온다. 정정 문구가 근거 없는 주장을 남기지 않았다.
- **문서 포맷 규약 준수**: §3 의 "예고는 틀렸다" 정정 패턴(취소선 원문 + 굵게 정정 도입부 +
  근거 bullet + 교훈 문단)은 `spec/conventions/node-cancellation.md` L213-227 의 기존
  선례(`"이 항목은 2026-08-15 에 두 번 정정됐다"` + `~~① 원문~~`/`~~② 1차 정정~~`)와
  형식이 동형이다. 이 저장소가 "틀린 예고/정정을 어떻게 문서화하는가"에 대해 이미 가진
  관행을 그대로 따랐다 — 신규 스타일을 도입하지 않았다.
  본 문서 자신이 §Overview 에서 선언한 "마커 리터럴을 적지 않는다"(값이 아니라 심볼
  **이름**만 인용)규칙도 이번 추가분에서 grep 0건으로 준수 확인됐다.
- **출력 포맷 규약(`2-api-convention.md §5.4` 부재 표현)과의 정합**: 신규
  `redactStoredFieldsForResponse` 는 부재 컬럼을 `null` 로 정규화해 반환한다 — §5.4 가
  규정한 "기본은 `null`(키 present)" 원칙과 정확히 일치한다. `redactNodeExecutionRow`
  쪽(입력을 그대로 보존, `maskIfPresent`)은 wire 상 키 유무를 바꾸는 것이 아니라 참조
  identity 보존(copy-on-change)이 목적이라 §5.4 의 적용 대상(응답 스키마의 null vs 키
  생략 선택)이 아니다 — 혼동해 위반으로 볼 사안이 아니다.
- **`spec-impl-evidence.md` Gate C (`spec_impact`) 준수**: 신규
  `plan/complete/masking-gate-consolidation.md` frontmatter 는 `started: 2026-08-23`
  (cutoff `2026-06-04` 이후)이고 `spec_impact: [spec/conventions/egress-masking.md]` 를
  YAML 리스트로 선언한다 — bare string/빈 배열이 아니라 Gate C 요건을 만족한다. `owner:
  developer`·`worktree`·`started`(ISO) 등 나머지 frontmatter 도 `plan-lifecycle.md §4`
  스키마와 일치하고, `status: complete` 는 `plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES`
  에 속해 디렉터리(`plan/complete/`)와 모순되지 않는다.
- **파일 명명**: `redact-stored-error.ts` 는 같은 디렉터리 자매 파일들
  (`sanitize-error-message.ts`, `strip-external-only-fields.ts`, `terminal-error-payload.ts`
  등)과 동일한 kebab-case + co-located `.spec.ts` 패턴을 따른다.
- 이전 라운드(`13_55_36`)가 발견한 두 항목 — `1-auth.md` WebAuthn URL 중첩 규칙 간극
  (WARNING)·`2-api-convention.md` Overview 절 부재(INFO) — 은 이번 diff 로 새로 생기거나
  악화되지 않았다(둘 다 diff 밖의 기존 상태, `spec/5-system/**` 는 이번 PR 에서 변경 0).
  중복 계상하지 않도록 본 라운드 발견사항에서 제외했다.

## 범위 밖으로 확인만 하고 넘긴 사안

- `developer` 가 `spec/conventions/egress-masking.md §3` 을 직접 편집한 것은 CLAUDE.md
  권한표(`spec/` read-only) 상 경계 사안이지만, 본 checker 의 검토 관점(명명·출력 포맷·
  문서 구조·API 문서·금지 항목) 밖이다. 이미 `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md` 에 planner 판단 항목으로 신규 등재됐고
  `/ai-review` 가 2라운드에 걸쳐 처분(정당한 정정, 게이트 경계만 후속 필요)했으므로 별도
  중복 기록하지 않는다.

## 요약

이번 PR 의 실질 spec 변경은 `egress-masking.md §3` 문장 정정 1건이며, 그 정정의 사실
주장(어느 심볼이 어느 함수를 부르는지) 을 코드 원문·grep 으로 직접 재확인한 결과 모두
정확했고, 정정 형식은 이 저장소가 이미 가진 `node-cancellation.md` 선례를 그대로 따랐다.
신규 코드(`redact-stored-error.ts` 헬퍼 2개, 호출부 교체)는 파일 명명·부재 표현(§5.4
null 정규화)·frontmatter `code:` 최소 요건을 모두 만족한다. CRITICAL/WARNING 급 위반은
없고, 발견한 2건은 모두 조치 불요로 판단되는 INFO 다(하나는 문서 자신의 논리로 등재
의무가 없고, 다른 하나는 이미 이전 라운드에서 의식적으로 defer 처리됨).

## 위험도

NONE
