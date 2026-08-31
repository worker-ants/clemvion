# 변경 범위(Scope) 리뷰

## 조사 방법

프롬프트에 실린 37개 파일 항목(일부는 diff 생략)을 검토하고, `git log --oneline`(9개 커밋,
base `ead37afd4` → HEAD `0883c4e43`), `git show --stat`, `git diff origin/main...HEAD --stat`,
`git diff origin/main...HEAD -M --summary`(rename 감지) 로 실제 저장소 상태를 직접 대조했다.
이번 라운드는 직전 리뷰(`review/code/2026/08/31/18_30_55`)가 Warning 5건을 낸 뒤 그 fix 커밋
(`0883c4e43`)이 새로 얹힌 상태다 — 그 fix 커밋 자체가 범위를 지켰는지가 이번 라운드의 핵심
점검 대상이다. 저장소 파일을 뮤테이션하지 않았다(`git status --short` 로 clean 확인, read-only
명령만 사용).

## 발견사항

- **[INFO]** fix 커밋(`0883c4e43`)은 직전 리뷰가 지목한 Warning 5건에 정확히 대응하며, 그 외
  아무것도 건드리지 않았다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
    (`_SCOPE_HITS_DISPLAY_LIMIT` 상수 추출, gate 479-482줄) · `.claude/tests/test_consistency_scope_census.py`
    (21줄 신규 fixture 2건) · `codebase/backend/src/modules/websocket/{websocket-events.types.ts,websocket.service.ts,websocket.service.spec.ts}`
    · `spec/5-system/6-websocket-protocol.md` · `spec/data-flow/8-notifications.md:192`
  - 상세: 커밋 diff(`git show --stat 0883c4e43`)를 직전 리뷰 SUMMARY 의 Warning #1~#5 목록과
    1:1 대조했다 — §4.x bare 프로즈 인용 12곳 정정(§4.5/§4.6/§4.7 각 대상 절 확인, 사용자
    입력 대기 상세를 가리키는 §4.4 는 건드리지 않음), 매직넘버 `20`→모듈 상수, 절단 분기
    fixture 2건(20/25건 케이스) 추가, blank-line 관례(2줄) 복원. 커밋 메시지 자체가 "INFO
    1·2·4·6·9 는 이 라운드에서 조치하지 않는다"고 명시하고 실제로 그 항목들에 대응하는 코드
    변경이 diff 에 없다 — 미조치 사유와 실제 diff 범위가 일치한다.
  - 제안: 조치 불요 — 모범적인 targeted fix.

- **[INFO]** 리뷰 prompt 가 동일 plan 파일을 두 항목(있음/없음)으로 이중 표기하는 하니스
  아티팩트를 확인했다 — 실제 저장소 변경은 범위 위반이 아니다.
  - 위치: 프롬프트 "파일 11"(`plan/complete/harness-consistency-summary-downgrade-rule.md`) vs
    "파일 15"(`plan/in-progress/harness-consistency-summary-downgrade-rule.md`, diff 생략);
    "파일 13"(`plan/complete/spec-sync-stop-editor-and-forbidden-routes.md`) vs "파일 19"
    (`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`, 전체 삭제로 표시)
  - 상세: `git diff origin/main...HEAD -M --summary` 로 확인하면 두 쌍 모두 **단일 rename**이다
    (`rename plan/{in-progress => complete}/harness-consistency-summary-downgrade-rule.md (89%)`,
    `rename plan/{in-progress => complete}/spec-sync-stop-editor-and-forbidden-routes.md (87%)`).
    각각 `c1ae464d7`·`b0452f74b` 커밋에서 "그 plan 항목의 마지막 체크박스를 완료하며 `complete/`
    로 이동"한 것으로, CLAUDE.md 의 plan lifecycle 관례("체크와 `complete/` 이동은 한 동작")를
    정확히 따른다. 그런데 이 리뷰 prompt 를 조립한 하니스는 이를 delete+add 두 개의 별개 파일
    항목으로 표기해, "같은 파일이 두 경로에 동시에 존재하나?"로 오독될 여지를 만든다.
  - 제안: 코드 변경 자체는 조치 불요. 다만 이 prompt-조립 하니스(`consistency-checker` 또는
    `code-review-agents` 쪽 diff 수집 로직)가 `-M`(rename 감지) 없이 diff 를 뜨는 경로가 있다면,
    후속 라운드에서 리뷰어가 "파일이 두 곳에 존재" 로 오판할 근거가 된다 — 별도 harness 백로그로
    등재할 가치가 있다(이번 라운드의 실제 코드 범위 판정에는 영향 없음).

- **[INFO]** (직전 라운드 이월, 미해소) `spec/5-system/6-websocket-protocol.md`(§4 절번호
  재배치) · `spec/5-system/14-external-interaction-api.md`(§8.2 HMAC 화이트리스트 정정) 두
  spec 편집이 CLAUDE.md 의 developer 자기-반증형 소정정 예외(조건 2: "예고·트리거 문장 한정,
  제품 정의·API 계약은 해당 없음") 를 문면상 충족하는지 diff 만으로는 여전히 확정할 수 없다.
  - 위치: `spec/5-system/6-websocket-protocol.md`(커밋 `50caf1a85`, `0883c4e43` 후속 정정),
    `spec/5-system/14-external-interaction-api.md`(커밋 `d743251b0`)
  - 상세: 직전 라운드 scope 리뷰(`review/code/2026/08/31/18_30_55/scope.md`)가 이미 이 질문을
    INFO 로 등재했고, 이번 fix 커밋(`0883c4e43`) 메시지도 "INFO 6(spec 편집이 planner 트랙이었는지)은
    … 별도 확인 대상이 아니다"라고 스스로 적어 두었을 뿐 근거(예: `--spec` 게이트 로그, planner
    턴 전환 기록)를 새로 제시하지는 않는다. `review/consistency/2026/08/31/` 하위 세션 3건을
    확인했으나 모두 다른 대상(`spec-draft-lockout-and-alertrule.md`, `spec-draft-auth-errorcode-drift.md`)
    이라 이 두 spec 편집을 커버하는 `--spec` 게이트 실행 흔적은 찾지 못했다. 다만 두 편집 모두
    (a) 이미 확정된 문서 내부 모순(§8.2 vs §R12, `### 4.4` 중복 헤딩) 정정이라 새 제품 결정을
    내리지 않고, (b) 커밋 메시지에 실측 근거가 충실하며, (c) 같은 브랜치에서 developer 트랙
    코드 변경(controller, 주석)과 병행돼 있어, "developer 가 권한 밖에서 spec 을 직접 고쳤다"
    는 위반 단정도 마찬가지로 불가능하다.
  - 제안: 이 diff·이번 리뷰 범위에서 CRITICAL/WARNING 으로 올릴 근거는 없다(2 라운드 연속
    INFO 유지). 머지 전 통합 조율자 또는 `--impl-done`(scope 에 `spec/5-system`, `spec/data-flow`
    포함) 게이트가 이 두 편집의 트랙(project-planner vs 자기-반증형 소정정 5조건)을 별도 확인할
    것을 권고.

## 파일별 확인 결과 (요약, 직전 라운드 이후 추가분)

| 코드 변경 | 대응 plan 항목 / 근거 |
|---|---|
| `_SCOPE_HITS_DISPLAY_LIMIT` 상수화 + 절단 분기 fixture 2건 | 직전 리뷰 W4·W5 (1:1) |
| `websocket-events.types.ts`/`websocket.service.ts`/`websocket.service.spec.ts` §4.4→§4.5 | 직전 리뷰 W3(요구사항 지적 항목) + 커밋이 스스로 찾은 2건 추가(`.spec.ts:1268` 등) |
| `spec/5-system/6-websocket-protocol.md` bare 프로즈 인용 6곳 | 직전 리뷰 W1(documentation) 1:1 |
| `spec/data-flow/8-notifications.md:192` | 직전 리뷰 W1(공통 지적, requirement/maintainability/documentation 3인) 1:1 |
| `spec-sync-external-interaction-api-gaps.md`/`spec-sync-websocket-protocol-gaps.md` 갱신 | fix 작업의 plan 기록 — 코드 변경 아님, 정상 |
| `review/code/2026/08/31/18_30_55/*` 8개 파일 신규 커밋 | CLAUDE.md 관례대로 리뷰 산출물을 `review/code/**` 에 보존 — 정상 |

플랜 항목·직전 리뷰 Warning 항목과 무관한 drive-by 수정(불필요한 리팩토링·미사용 임포트
정리·포맷팅-only 변경·설정 파일 변경)은 이번 fix 커밋에서도 발견하지 못했다.

## 요약

이번 라운드(`18_46_06`)는 직전 라운드(`18_30_55`)가 낸 Warning 5건에 대한 단일 fix 커밋
(`0883c4e43`)이 얹힌 상태를 재검토한 것이다. 그 fix 커밋은 지목된 5건에 정확히 대응하고,
스스로 명시한 미조치 항목(전역 스코프·기존 갭 재확인용 INFO) 은 실제로 손대지 않아 범위가
깨끗하다. 두 개의 "이중 파일 표기"는 실제로는 CLAUDE.md plan lifecycle 관례를 따르는 단일
git rename 이며, 리뷰 prompt 조립 하니스의 표시 방식 문제일 뿐 코드 변경의 범위 위반이 아니다.
유일하게 미해소로 남는 것은 developer 트랙에서 두 `spec/**` 문서(WS 절번호, EIA HMAC
화이트리스트)를 직접 편집한 것이 CLAUDE.md 의 좁은 예외를 충족하는지 diff 만으로는 확정할 수
없다는 점인데, 이는 직전 라운드에서도 동일하게 INFO 로 판정된 사안이고 이번 라운드에서 그
판단을 바꿀 새 증거(위반이든 정당화든)를 찾지 못했다.

## 위험도

LOW
