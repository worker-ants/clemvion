STATUS=success scope review complete — 0 CRITICAL, 1 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17, boolean 우회 수정 라운드)

## 검토 방법

브랜치는 origin/main 대비 4개 커밋이다. 이전 스코프 리뷰(`review/code/2026/08/21/00_03_57/scope.md`)는 앞 3개
커밋(`3e96f4b44` 스펙 초안, `871d3fcb0` 스펙 impl-prep 정정, `137a48200` 최초 구현)을 이미 검토해 **NONE** 판정을
냈다. 이번 세션은 그 리뷰의 CRITICAL/WARNING 을 적용한 **네 번째 커밋 `50f799efd`**(`fix(security): boolean
파라미터가 마커 가드를 통째로 우회했다`)가 새로 추가한 델타를 중심으로, 브랜치 전체를 재확인했다.
`git show --stat 50f799efd`, `git show <path>` 로 실제 코드 diff 를 직접 열어 `RESOLUTION.md` 의 서술과
대조했고, `git log -p --follow -- spec/5-system/14-external-interaction-api.md` 로 spec 파일의 각 hunk 가
어느 커밋에서 유래했는지 커밋 단위로 역추적했다.

## 발견사항

- **[WARNING]** `fix(security)` 커밋(developer/resolution-applier 턴)이 `spec/5-system/14-external-interaction-api.md`
  를 직접 수정했다 — 이 저장소 규약상 `spec/` 은 developer 에게 read-only 이고 변경은 `project-planner` 위임
  대상이다.
  - 위치: `spec/5-system/14-external-interaction-api.md:1573`(파일 56, 게이트 기준 — 표 행
    `| **서버 (Manual 실행 경로)** | ... **재제출만이 아니라 fresh 입력도 대상**이다(아래 범위 캐비엇) | 2026-08-20 |`)
  - 상세: `.claude/skills/developer/SKILL.md:28` 은 `spec/` 을 "Read only — 수정 시 `project-planner` 위임"
    으로 명시하고, CLAUDE.md 도 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 이라고
    못박는다. 정식 우회로는 SKILL.md:92 의 SPEC-DRIFT 경로뿐이다 — `resolution-applier` 가
    `plan/in-progress/spec-update-<area>.md` draft 를 만들고 `ESCALATE=spec` 로 반환한 뒤,
    `/consistency-check --spec` 이 `BLOCK: NO` 를 낸 다음에야 spec 에 반영된다.
    `git log -p --follow` 로 이 파일의 이력을 역추적한 결과, 표 행(§R17 caveat 표) 아래의 캐비엇 문단
    ("**가드의 범위 — Manual 실행 경로 전체다**...")은 정상적으로 planner 턴 `871d3fcb0`(`docs(spec)`)에서
    작성됐다. 그런데 그 문단과 짝을 이루는 **표 행 라벨 자체**("서버 (재제출 API)" → "서버 (Manual 실행
    경로)" + "재제출만이 아니라 fresh 입력도 대상" 문구 추가)는 `871d3fcb0` 에는 없었고, 이후
    `137a48200`(구현) 에도 없었으며, **이번 리뷰 대상인 `fix(security)` 커밋 `50f799efd` 에서 처음
    바뀌었다.** `RESOLUTION.md` 는 이를 "WARNING 7 — §R17 표 행이 아래 캐비엇과 다른 그림 — **수정**"
    으로 기록하지만 planner 위임이나 SPEC-DRIFT 경로를 거쳤다는 언급이 없고, `plan/in-progress/` 및
    `plan/complete/` 어디에도 이 항목에 대응하는 `spec-update-*.md` draft 가 없다(`find plan -iname
    '*spec-update*'` 로 확인, 관련 파일 없음). 즉 코드 리뷰(00_03_57)가 낸 WARNING 을 developer 가 코드
    수정과 같은 커밋에서 spec 까지 직접 고친 것으로 보인다.
  - 제안: 내용 자체는 이미 planner 가 확정한 캐비엇 문단과 동일한 사실을 표 행에 동기화하는 것뿐이라
    실질 리스크는 낮지만, 절차상으로는 이 한 줄만 별도로 `project-planner` 턴(또는 SPEC-DRIFT
    escalation)으로 처리하거나, 최소한 `RESOLUTION.md`/커밋 메시지에 "SPEC-DRIFT 경로로 사전 승인됨"
    같은 근거를 남겨야 한다. 반복되면(이 프로젝트 메모리에 이미 유사 사례가 기록돼 있다) 가드가
    구멍 나 있다는 뜻이므로, 필요하면 `guard_review_before_push.py` 류가 developer 커밋의 `spec/` diff
    를 탐지하도록 강화하는 것도 고려할 만하다.

- **[INFO]** 나머지 코드 변경(`reject-masked-resubmission.ts`/`.spec.ts`, 두 호출부, CHANGELOG, 트래커
  체크박스)은 `RESOLUTION.md` 가 서술한 CRITICAL 1 + WARNING 7 항목과 1:1로 대응하며, 무관한 리팩토링·
  기능 확장·포맷팅·주석·임포트 변경은 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`(raw 우선
    2단 검사로 재구성), `.../reject-masked-resubmission.spec.ts`(boolean/number/JSON-string/defaultValue
    캐너리 + 왕복 통합 테스트 추가), `codebase/backend/src/modules/executions/executions.service.ts:493-503`·
    `codebase/backend/src/modules/workflows/workflows.controller.ts:311-317`(호출부가 4줄 복붙에서 1줄
    호출로 축약), `CHANGELOG.md`(신규 Unreleased 항목), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    (W6 체크박스 종결)
  - 상세: `git show 50f799efd` 로 각 파일의 실제 diff 를 확인한 결과 새 함수·테스트·주석 전부 "검사
    시점을 raw 우선으로 교정" 이라는 단일 원인에서 파생됐다. import 변경(`resolveTriggerParameters`→
    `resolveTriggerParametersRejectingMasked`)도 실제 사용처와 정확히 일치하며 미사용 임포트가 남지
    않았다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/21/00_03_57/**`(RESOLUTION.md 포함 11개 신규 파일)가 같은 커밋에 함께
  커밋됐다.
  - 위치: `review/code/2026/08/21/00_03_57/*.md`, `_retry_state.json`, `meta.json`
  - 상세: `RESOLUTION.md` 는 developer 의 명시적 쓰기 권한 대상(`review/**/RESOLUTION.md`)이고, 나머지
    리뷰어 산출물(`SUMMARY.md`/`api_contract.md`/`architecture.md`/...)은 `/ai-review` 워크플로가 이미
    생성해 둔 것을 그대로 커밋에 편입한 것으로, 이 저장소가 반복적으로 지켜온 관행(리뷰 산출물은
    `review/` 아래 보존, gitignore 대상 아님)과 일치한다. 임의로 끼워 넣은 무관한 파일이 아니다.
  - 제안: 조치 불요.

## 요약

네 번째 커밋(`50f799efd`)의 코드 변경 자체는 이전 라운드 리뷰(CRITICAL 1 + WARNING 7)가 지적한 항목에
정확히 대응하는 좁고 명료한 수정으로, 무관한 리팩토링·기능 확장·포맷팅·주석·임포트·설정 변경은 없다.
다만 같은 커밋 안에서 `spec/5-system/14-external-interaction-api.md` 의 표 행 한 줄을 developer 턴이
직접 고쳤는데, 이는 이 저장소가 명시한 "`spec/` 은 developer read-only, 변경은 `project-planner`
위임" 규약과 SPEC-DRIFT escalation 절차(플랜 draft + `--spec` consistency-check) 를 우회한 것으로 보인다
— 내용 자체는 이미 planner 가 승인한 캐비엇 문단과 동일한 사실의 동기화라 실질 리스크는 낮지만, 절차
위반이므로 WARNING 으로 기록한다.

## 위험도

MEDIUM
