# 변경 범위(Scope) 리뷰 — system-error-banner (4라운드 누적, `02_21_19`)

## 검토 절차

- `git log --oneline -10` 로 커밋 구성 확인 — 4개 커밋(`9869afd5c` 원 수정 → `6e35a30a6`
  `01_26_11` fix → `00d7c8584` `01_44_22` fix → `84ea70eb7` `02_02_18` fix), 베이스는
  `b541484c2`(=`origin/main` tip)로 별도 유입 커밋 없음.
- `git diff --stat origin/main...HEAD` 로 실제 변경 파일 37개 전수 확인 — 프롬프트에 제시된
  파일 목록과 정확히 일치(2415 insertions / 64 deletions).
- 핵심 3파일(`use-execution-events.ts`, `use-execution-events.test.ts`, `CHANGELOG.md`)은
  프롬프트 발췌가 아니라 `git diff origin/main...HEAD -- <path>` 원본 diff 를 직접 열어
  재확인.
- `plan/in-progress/system-error-banner-live-ws.md` 체크리스트(라인 51~63)와 실 diff 를
  항목별 대조.
- `git status --porcelain` 으로 워킹트리 clean 확인(이번 리뷰 라운드 자체 출력 디렉토리
  `review/code/2026/08/28/02_21_19/` 외 untracked 없음) — 프롬프트가 놓친 추가 변경 없음.

## 발견사항

없음 (CRITICAL/WARNING/INFO 없음 — 스코프 이탈 없음).

### 판단 근거

1. **프로덕션 코드 변경은 결함 수정 한 지점(`extractNodeErrorPayload`)과 그 두 호출부에
   국한** — `use-execution-events.ts` diff 는 124줄 전부가 (a) 신규 `asRecord` 헬퍼(2단
   중첩 접근의 가독성 최소 추출), (b) `extractNodeErrorPayload` 시그니처를
   `(rawError, rawOutput)` → `(rawOutput)` 으로 좁히고 unwrap 을 `rawOutput.output.error`
   로 정정, (c) JSDoc/인라인 주석 재작성, (d) `handleNodeFailed`/`handleNodeCompleted`
   호출부에서 실제 `payload.output` 을 넘기도록 배선 교정 — 이 네 가지에만 해당한다.
   plan 체크리스트 1·2·3번 항목과 1:1 대응. import·설정 파일 변경 없음, 포맷팅-only
   훅 없음.

2. **`direct` 분기(객체 `error`) 제거는 은닉된 확장이 아니라 문서화된 review-driven
   정리** — `01_26_11/RESOLUTION.md` W4 가 뮤테이션 실증(커버리지 0)과 "이 버그를 낳은
   계약을 그대로 인코딩" 을 근거로 명시한다. CLAUDE.md 는 "구현 완료 후 같은 턴의
   WARNING fix" 를 상시 승인된 의무로 규정하므로, 3라운드에 걸쳐 새 테스트·헬퍼가
   추가된 것은 원 결함(2줄 배선 오류) 대비 표면상 넓어 보여도 전부 그 라운드의 특정
   WARNING/INFO 에 대한 추적 가능한 대응이다.

3. **테스트 파일의 신규 요소(`wrapNodeHandlerOutput` 헬퍼, 캐너리 1건, 가드 2건, fixture
   5곳 정정)는 각각 근거가 있다** — `wrapNodeHandlerOutput` 은 `01_26_11` maintainability
   W3(fixture 손복제 5곳 → drift 위험)에 대한 테스트 전용 대응이고, 새 프로덕션 동작을
   만들지 않는다. 캐너리·가드 테스트는 각각 `01_44_22` W2(malformed 가드 커버리지 0)·
   `02_02_18` W1(`isMultiTurnAiContext` 단락 평가로 인한 무검증 분기)을 정확히 겨냥한다.
   테스트 diff 343줄을 직접 열람한 결과 이 범위를 벗어나는 새 `describe`/무관한 테스트
   추가는 없다.

4. **`CHANGELOG.md` 신규 섹션(19줄)은 diff 3파일(코드+plan) 범위 밖이지만 정당화된
   컨벤션 준수** — `git diff -- CHANGELOG.md` 로 확인한 결과 파일 최상단에 새 섹션 하나만
   추가했고 기존 항목(`## Unreleased — 노드 config echo 마스킹...` 등)은 건드리지 않았다.
   `01_44_22/RESOLUTION.md` W3 가 이 저장소의 선례(`CHANGELOG.md:485` 류)를 근거로
   제시한다 — 무관한 파일 수정이 아니라 "조용히 죽어 있던 경로를 되살려 사용자 관측
   동작이 바뀌는 변경은 CHANGELOG 에 기록한다"는 관례 이행.

5. **`plan/in-progress/system-error-banner-live-ws.md` 신규**는 작업 추적 컨벤션에 따른
   정상 산출물(`spec_impact: none`, 실제로 diff 에 spec 파일 없음과 일치).

6. **`review/code/2026/08/28/{01_26_11,01_44_22,02_02_18}/**` 33개 파일 동반 커밋**은
   코드가 아니라 이 PR 자신이 거친 3회 `/ai-review` 라운드의 산출물이며, 프로젝트
   컨벤션(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/**`", `developer` 쓰기 권한에
   `review/**/RESOLUTION.md` 명시)상 정상 커밋 대상이다. 각 `RESOLUTION.md` 가 해당
   라운드 WARNING/INFO 전부를 반영/유예 사유와 함께 기록해 코드 변경과 정확히 대응
   관계를 이룬다.

7. **포맷팅/임포트/설정 변경 없음** — 3개 커밋 전체에서 `.eslintrc`·`tsconfig`·
   `package.json`·CI 워크플로 등 설정 파일 변경 없음. 신규/삭제 import 없음. diff 훅
   전부가 의미 있는 코드·주석·문서 변경.

8. **워킹트리에 미커밋 잔여물 없음** — `git status --porcelain` 확인 결과 이번 리뷰
   라운드 자체 출력 디렉토리 외 untracked/modified 파일 없음(사용자 세션 초기
   git status 에 나타난 `.DS_Store`/`scratchpad_idem_backup.ts` 는 이 diff 에 포함되지
   않으며 이 worktree 와 무관).

## 요약

`git diff origin/main...HEAD` 전체(37파일, +2415/−64, 4커밋)를 원본으로 직접 확인한 결과,
실질 프로덕션 코드 변경은 `use-execution-events.ts` 한 파일의 `extractNodeErrorPayload`
언래핑 로직 정정과 두 호출부(`handleNodeFailed`/`handleNodeCompleted`)의 인자 배선
교정이라는 단일 결함(`system_error` 배너가 라이브 WS 경로에서 안 뜬다)에 국한되며,
`plan/in-progress/system-error-banner-live-ws.md` 체크리스트와 1:1 대응한다. 3회의
`/ai-review` 라운드를 거치며 늘어난 테스트 헬퍼·캐너리/가드 테스트·CHANGELOG 항목·
`direct` 분기 제거는 원 결함 대비 표면적으로는 넓어 보이지만, 전부 각 라운드의
`RESOLUTION.md` 에 근거가 명시된 review-driven 대응이며 이 프로젝트가 "구현 완료 후
같은 턴의 WARNING fix" 를 상시 승인된 의무로 규정한 워크플로에 정확히 부합한다.
무관한 파일·설정·포맷팅·불필요한 임포트 변경, 요청하지 않은 기능 확장은 발견되지
않았다. `review/code/**` 33개 산출물 동반 커밋도 프로젝트 컨벤션과 일치해 스코프
이탈이 아니다.

## 위험도

NONE
