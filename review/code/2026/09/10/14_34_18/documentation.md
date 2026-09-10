# 문서화(Documentation) 리뷰 — `trigger-workflow-ref-canary`

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.{ts,spec.ts}`,
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`,
`plan/in-progress/{trigger-workflow-ref-canary.md, spec-draft-nullable-notation-followups.md}`,
`review/consistency/2026/09/10/13_48_39/**`

## 방법

프롬프트에 실린 unified diff·전체 파일 컨텍스트를 게이트 숫자로 인용하되, 사실관계 검증은
전부 워킹트리의 실제 파일을 `Read`/`Bash`(grep/cat/python)로 직접 열어 대조했다. 저장소 파일은
전혀 수정하지 않았다(`git status --short` 로 매 단계 확인, 최종적으로도 clean).

## 발견사항

### [WARNING] 컨벤션이 "반드시" 요구하는 `SUMMARY.md` 가 이 세션 디렉터리에 없다

- 위치: `review/consistency/2026/09/10/13_48_39/`(디렉터리 — 파일 누락이라 게이트 인용 불가)
- 상세: `.claude/skills/consistency-checker/SKILL.md` (§3 SUMMARY 기록 + 결과 확인)는
  *"**반드시** `summary_markdown` 을 `summary_output` 에 Write 한다 — … 디스크 단일 진실의
  유일한 경로가 main 의 이 Write"* 라고 명시한다. 그런데 이 PR 이 커밋한
  `review/consistency/2026/09/10/13_48_39/` 에는 `cross_spec.md`·`rationale_continuity.md`·
  `convention_compliance.md`·`plan_coherence.md`·`naming_collision.md`·`meta.json`·
  `_retry_state.json` 은 있지만 **`SUMMARY.md` 자체가 없다**(`git ls-files`로 확인, `.gitignore`
  는 `review/**/_prompts/` 한 줄만 제외하므로 gitignore 문제가 아니다). 개별 checker 산출물은
  실제로 존재하고 정확하지만(아래 검증 참고), 이 세션이 실제로 도달한 최종 `BLOCK: YES/NO` 판정을
  기록한 단일 진입점이 저장소에 없다 — SKILL.md 자신이 그 단일 진입점이라고 부르는 바로 그
  파일이다.
- 제안: 커밋 전에 `summary_markdown` 을 `SUMMARY.md` 로 Write 하거나, 이미 누락된 채 머지됐다면
  최소한 plan 트래커에 "`SUMMARY.md` 미기록, 개별 checker 산출물이 대체 근거" 라고 명시해
  다음 감사자가 빈 자리를 결함으로 재조사하지 않게 한다.

### [WARNING] 커밋된 `_retry_state.json` 이 plan 이 주장하는 "5/5 성공" 과 모순되는 prepare 스냅샷이다

- 위치: `review/consistency/2026/09/10/13_48_39/_retry_state.json:37-46`
  (`"agents_pending": [...5개 전부...]`, `"agents_success": []`, `"agents_fatal": []`)
- 상세: 5개 checker 파일(`cross_spec.md` 등)은 실제로 실행 완료된 실질 내용을 담고 있고,
  `plan/in-progress/trigger-workflow-ref-canary.md:263`도 *"(5/5)"* 로 완료를 주장한다. 그런데
  커밋된 `_retry_state.json` 은 5개 전부가 여전히 `agents_pending` 에 있고 `agents_success` 는
  빈 배열이다 — 즉 **"준비만 하고 아직 하나도 성공하지 못한" 상태의 스냅샷**이 최종 상태로
  잘못 커밋됐다. 이는 이 저장소가 이미 한 번 겪은 정확히 같은 결함 클래스다 — 같은 SKILL.md
  §3 근처 문구가 그 사고를 이렇게 설명한다: *"종전에는 `--update` 미호출로 `_retry_state.json`
  이 prepare 스냅샷에 멈춘 채 커밋돼, 같은 세션 SUMMARY 의 '5/5 성공' 과 **모순되는 증거**가
  남았다."* 이번 세션이 그 패턴을 다시 재현했다. `_retry_state.json` 은 `/loop --resume` 검증의
  SoT 이므로, 이 상태로 남으면 나중에 `--resume` 을 돌릴 때 이미 끝난 5개 checker 를 전부
  불필요하게 재실행시킬 수 있다.
- 제안: `--update`(또는 `--summary-state`)를 호출해 `_retry_state.json` 을 실제 완료 상태로
  재동기화한 뒤 재커밋하거나, 이 파일이 review 산출물 성격상 "시점 기록" 이라 사후 수정하지
  않는다는 예외를 적용한다면 그 판단을 어딘가에 남긴다.

### [WARNING] plan 트래커의 "Warning 2" 집계가 실제 checker 산출물의 WARNING 4건과 불일치한다

- 위치: `plan/in-progress/trigger-workflow-ref-canary.md:265` (`Warning 2 · INFO 다수 반영`)
- 상세: 실측(`grep -c '\[WARNING\]' review/consistency/2026/09/10/13_48_39/*.md`) 결과 WARNING
  태그가 붙은 발견사항은 **4건**이다 — `convention_compliance.md:42`(PROJECT.md 헬퍼 배치
  규칙 문서화 공백), `plan_coherence.md:45`(it() 개수 19→18 재실측), `naming_collision.md:36`
  (접두어-only 충돌 잠재 위험), `rationale_continuity.md:51`(조건 2 애매함 — §3 문장이 예고인지
  계약인지). 넷 다 실제로 이 PR 에 반영됐다(전자 셋은 코드/plan 에 직접 반영, 넷째는 planner
  후속 항목으로 명시 이관) — **누락된 조치는 없다.** 다만 트래커의 요약 숫자 자체가 실제 건수와
  다르다는 점은, 이 저장소가 반복해서 지적받은 "정량 기록 재검산" 클래스와 같은 결이라 표기해
  둔다.
- 제안: "Warning 2" 를 "Warning 4" 로 정정하거나, 어떤 기준으로 2로 묶었는지("직접 반영 3 +
  후속 이관 1" 처럼) 한 절로 명시한다.

## 실측으로 확인 — 정확함 (반증되지 않음)

아래는 프롬프트가 지목한 핵심 주장들을 워킹트리 실제 파일과 대조한 결과다. 전부 **현재
시점에 참**이고, 별도 후속으로 이관된 것을 제외하면 조용히 낡을 위험도 낮다.

- **`tsconfig.build.json` 이 `src/shared/testing/**` 를 디렉터리 단위로 exclude** — 실제 파일
  `exclude` 배열에 `"src/shared/testing/**"` 존재, 주석도 "devDependency(`@nestjs/testing`)
  격리" 이유를 정확히 설명한다.
- **unit jest `rootDir: 'src'`, e2e jest `testRegex: '.e2e-spec.ts$'`** — `codebase/backend/
  jest.config.ts` (`rootDir: 'src'`), `codebase/backend/test/jest-e2e.json`
  (`testRegex: ".e2e-spec.ts$"`) 둘 다 그대로 확인. 즉 `test/helpers/*.spec.ts` 로 self-spec 을
  두면 어느 러너에도 안 걸린다는 결론이 구조적으로 맞다.
- **`PROJECT.md` 가 신규 e2e 헬퍼를 `test/helpers/` 로 지정** — `PROJECT.md:315`
  (`- 신규 헬퍼: codebase/backend/test/helpers/<name>.ts`) 그대로. `trigger-workflow-ref.ts` 는
  이 문면과 실제 강제 메커니즘(jest 러너)이 어긋나는 이유를 헬퍼 docstring 에 직접 남겼다
  (`trigger-workflow-ref.ts:33-39`) — `convention_compliance.md` WARNING 이 요구한 대로 실제로
  반영돼 있다.
- **자매 헬퍼가 다른 깊이를 검증** — `schedule-trigger-ref.ts` 의
  `expectNarrowedScheduleTriggerRef` 는 `ScheduleDto.trigger` **참조 객체 전체의 키셋**을
  등가 비교하는 반면(`REF_KEYS_WITH/WITHOUT_WORKFLOW`), 신규 `expectTriggerWorkflowRef` 는
  `TriggerDto` 전체 중 `workflow` 필드의 **유무 + nested shape** 만 문다 — JSDoc 설명과 코드
  동작이 일치.
- **e2e 파일의 4-경로 표** — `triggers.controller.ts` 를 grep 하면 `TriggerDto`/
  `PaginatedResponseDto<TriggerDto>` shape 을 실제로 내보내는 엔드포인트는 `POST /triggers`·
  `GET /triggers`·`GET /triggers/:id`·`PATCH /triggers/:id` 4개뿐이고, `history`(→
  `TriggerHistoryItemDto`)·`DELETE`(→ 204 no content)·rotate/revoke 3종은 별도 반환형이다 —
  "history·DELETE·rotate 3종은 대상 밖" 서술과 정확히 일치.
- **`catch` 가 provider 실패를 삼킨다** — `triggers.service.ts` 의 `setupChatChannel` 은
  `adapter.setupChannel(...)` 을 try 로 감싸고 `catch (err)` 에서 `chatChannelHealth: 'degraded'`
  로 갱신 후 정상 반환(재throw 없음). `CCH-SE-01` 태그도 `telegram-client.ts`·
  `chat-channel.dispatcher.ts` 등 다른 자리와 일관되게 사용됨.
- **5초 timeout × 3회 + 백오프 1s/2s** — `telegram-client.ts:200` 주석이 그대로 명시(`CCH-SE-01`).
  산수도 맞다: 5×3=15초 + (1+2)=3초 = 18초/호출.
- **`review/code/2026/09/06/01_13_50` W4·W6 인용** — 실제 파일
  `review/code/2026/09/06/01_13_50/RESOLUTION.md` 에 W4("문서한 보장이 구현보다 넓었다")·
  W6("단언 헬퍼 자신에게 테스트가 없었다") 존재, 인용 요지도 일치. `review-citations.md` §2 의
  "권장" 형태(전체 경로 + W번호)를 그대로 따른다.
- **JSDoc citation guard 스코프 = `dto/responses/**` 뿐** — `swagger-dto-contract-guard.ts`
  의 `isResponseDtoFile`(`file.includes('/dto/responses/')`)이 유일한 판정 술어이고,
  `dto-jsdoc-citation-guard.ts` 가 그 함수를 그대로 재export 해 쓴다. `shared/testing/**`·
  `test/**` 는 이 술어 밖 — 신규 파일 3개의 인용은 AST 가드가 못 보지만, `review-citations.md`
  §3 표는 `codebase/**` 코드·테스트 주석 전반에 규약을 적용하므로(예외는 DTO/컨트롤러 JSDoc과
  `plan/**`·`review/**` 뿐) 규약은 여전히 적용되고, 위에서 확인했듯 형태도 이미 준수한다.
- **`webhook-trigger.e2e-spec.ts` 의 `it()` 18개** — `grep -n "it("` 로 정확히 18개 확인. GET
  목록·GET 단건·일반 PATCH 테스트 없음, 유일한 `.patch(...)` 는 410 케이스(C) 준비용
  `isActive:false` 토글(줄 293) 하나뿐 — 서술과 일치.
- **"52 suites / 305 tests"** — `find … -iname '*.e2e-spec.ts' | wc -l` = 52(기존 51 + 신규 1).
  `it(`/`it.each(` 정적 매치 304줄인데 그중 `terminal-duration-sql.e2e-spec.ts:143` 의
  `it.each([...2개 항목...])` 하나가 1줄에서 2개 테스트를 만들어 낸다 — 304 - 1 + 2 = **305**,
  claim 과 정확히 일치.
- **두 타입체크 ratchet baseline "backend 197건/36파일 · frontend 52건/15파일"** —
  `scripts/backend-typecheck-baseline.json` 의 `total=197`/`files` 키 36개, `scripts/
  frontend-typecheck-baseline.json` 의 `total=52`/`files` 키 15개, 둘 다 정확히 일치.
- **"세 checker 가 독립적으로 같은 CRITICAL 을 올렸다"** — `convention_compliance.md:8`·
  `plan_coherence.md:7`·`rationale_continuity.md:8` 세 파일 모두 "조건 1 — 대상 문장은
  developer 가 아니라 planner 가 썼다" 는 동일 사안을 각자 CRITICAL 로 독립 기재. `cross_spec`
  은 NONE, `naming_collision` 은 LOW — 5개 checker 위험도 분포도 plan 서술과 일치.
- **`TriggerWorkflowRefDto` 필드 = `['id','name']`** — 실제 DTO 선언과 `WORKFLOW_REF_KEYS`
  상수가 정확히 일치. `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto` 두 DTO 가 이미
  "접두어 하나 차이, 갈아 끼우지 말 것" 경고를 스스로 갖고 있어(`trigger-response.dto.ts:14-21`
  근방), 신규 헬퍼가 같은 패턴이 함수명 레벨에서 재현될 수 있다고 예고한 것은 근거 있는 추정이지
  허구가 아니다.

## Staleness 점검 — §3 외 다른 문서

- `spec/2-navigation/2-trigger-list.md §3`(*"자매 스케줄 축과 달리 이 축에는 캐너리가 아직
  없다"*, 줄 182)은 이 PR 로 사실이 아니게 됐다. 저자가 이미 인지하고 planner 후속 항목
  1번으로 명시 이관했다(`trigger-workflow-ref-canary.md` §후속으로 넘기는 것) — 누락 아님.
- 같은 문서 frontmatter `code:` 미등재(`spec/2-navigation/2-trigger-list.md:6-19`, 신규
  `trigger-workflow-ref.ts`/`.e2e-spec.ts` 없음)도 저자가 후속 2번으로 이관 — 누락 아님.
- `PROJECT.md:315`(§e2e 파일 위치·명명)도 저자가 후속 3번으로 이관 — 누락 아님.
- `plan/complete/spec-draft-schedule-trigger-ref-nav.md:153`(*"트리거(`TriggerDto.workflow`):
  0건"*)은 이 PR 로 사실이 아니게 되는 또 하나의 문장이지만, 이 문서는 **완료된 plan**이고
  그 표는 "註를 쓰다가 재봤다" 는 시점 측정을 명시적으로 담고 있다 — `plan-lifecycle.md`/
  `review-citations.md §3` 이 이런 시점 기록 문서를 사후 편집 대상에서 제외하는 것과 같은
  논리다. 액션 필요 여부는 낮지만, 다음에 그 plan 을 근거로 재인용하는 사람이 오독하지 않도록
  참고용으로 남긴다(조치 불요).
- 그 외 README·CHANGELOG·`.claude/config/doc-sync-matrix.json` 표의 어떤 행도 이번 변경
  유형(behavior 변경 없는 test-only 캐너리 추가, `spec_impact: none`)에 해당하지 않는다 —
  `PROJECT.md §변경 유형 → 갱신 위치 매핑` 전체 표를 대조했고, API/DTO shape·i18n 문자열·신규
  enum·환경변수 등 어느 트리거 조건도 이 PR 에는 없다. CHANGELOG 항목 미작성은 결함이 아니다.
- `codebase/backend/src/shared/testing/`·`codebase/backend/test/` 어느 쪽에도 인덱스용
  README 가 없어 갱신 누락 여지 자체가 없다.

## 요약

새로 추가된 헬퍼·spec·e2e 파일의 JSDoc 은 대단히 촘촘하게 근거를 달고 있고, 그 근거들
(tsconfig exclude, jest rootDir/testRegex, PROJECT.md 문면, 자매 헬퍼와의 깊이 차이,
4-경로 표, catch-swallow 동작, 5s×3+백오프 타이밍, 리뷰 인용 W4/W6, plan 의 it() 개수·
52 suites/305 tests·두 ratchet baseline·"세 checker 독립 CRITICAL" 주장)를 실제 파일과
전부 대조한 결과 **하나도 반증되지 않았다** — 이 저장소의 반복 실패 유형("다음 커밋이 스스로
반증하는 주석")에 해당하는 사례는 새 코드/plan 서술에서 찾지 못했다. §3 의 비대칭 문장이
낡는 것은 저자가 이미 인지하고 planner 후속으로 정확히 이관했다. 대신 이번 리뷰가 새로
찾아낸 문제는 코드 서술이 아니라 **동봉된 review 산출물 자체의 내적 정합성**이다 —
`--impl-prep` 세션이 SKILL.md 가 "반드시" 요구하는 `SUMMARY.md` 없이 커밋됐고,
`_retry_state.json` 은 "5/5 성공" 이라는 plan 의 주장과 모순되는 prepare-단계 스냅샷 그대로
남아 있으며(이 저장소가 이미 학습한 결함 클래스의 재발), plan 트래커의 "Warning 2" 집계는
실제 4건과 어긋난다(조치 자체는 다 됐다). 셋 다 커밋 전 정정 가능한 경미한 문제이지 이 PR 의
착수를 막을 사안은 아니다.

## 위험도

LOW — 코드·테스트 파일의 문서화 품질과 사실관계는 검증된 만큼 문제가 없다. 발견된 세 건은
전부 동봉된 review 산출물(consistency-check 세션 파일)의 정합성 문제로, 실질 피해보다는
추적성 저하 위험이며 병합 전 가벼운 정정으로 해소 가능하다.
