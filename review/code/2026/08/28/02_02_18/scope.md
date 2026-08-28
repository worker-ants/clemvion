# 변경 범위(Scope) 리뷰 — system-error-banner (누적 diff, 3커밋)

## 검토 절차

- `git diff --stat origin/main...HEAD` 로 실제 변경 파일을 전수 확인 (`git merge-base HEAD origin/main` = `b541484c2` = origin/main tip, 별도 유입 커밋 없음 확인).
- `plan/in-progress/system-error-banner-live-ws.md` 체크리스트(라인 51~63)와 실 diff 를 항목별 대조.
- 프로덕션 코드(`use-execution-events.ts`)·테스트(`use-execution-events.test.ts`) 전체 diff 를 `git diff` 로 직접 재확인(프롬프트 발췌가 아니라 원본).
- `review/code/2026/08/28/01_26_11/`·`01_44_22/` 산출물이 이전에도 커밋되는 게 이 저장소 관례인지 `git log -- 'review/code/**/_retry_state.json'` 로 선례 확인.

## 발견사항

없음 (CRITICAL/WARNING 없음).

### 참고 (범위 판단 근거, 조치 불요)

- **[INFO]** 이번 diff 는 세 커밋(`9869afd5c` 원 수정, `6e35a30a6` `01_26_11` 리뷰 fix, `00d7c8584` `01_44_22` 리뷰 fix)의 누적이며, 두 리뷰 라운드 산출물(`review/code/2026/08/28/01_26_11/*`, `review/code/2026/08/28/01_44_22/*` — `RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/`<role>.md` 전체)이 함께 커밋됐다.
  - 위치: `git diff --stat` 상 26개 파일 중 22개가 `review/code/2026/08/28/{01_26_11,01_44_22}/**`.
  - 근거: `git log --oneline -- 'review/code/**/_retry_state.json'` 로 확인한 결과 `999f3285c`·`7531816ad` 등 선행 커밋에서도 동일 패턴(리뷰 라운드 전체 산출물을 fix 커밋에 동반 커밋)이 반복된다 — 이 프로젝트의 review→fix 워크플로 관례(CLAUDE.md `developer` 권한: `review/**/RESOLUTION.md` 명시)와 일치한다. `review/**/_prompts/` 만 `.gitignore` 로 제외되고 나머지는 SoT 로 커밋되는 것이 정책이므로 스코프 이탈 아님.
- **[INFO]** `CHANGELOG.md` 에 새 Unreleased 섹션 추가는 diff 3파일(코드+plan) 범위 밖이지만, `01_44_22/RESOLUTION.md` W3 에 "이 저장소는 조용히 죽어있던 경로를 고친 변경을 CHANGELOG 에 기록해 왔다(`CHANGELOG.md:485` 선례)"는 근거가 명시돼 있고, `git diff -- CHANGELOG.md` 로 확인한 결과 기존 항목은 건드리지 않고 상단에 새 섹션만 추가했다(포맷팅 혼입 없음). 정당화된 관례 준수이지 무관한 수정이 아니다.
- **[INFO]** `extractNodeErrorPayload` 시그니처를 `(rawError, rawOutput)` 2-인자에서 `(rawOutput)` 1-인자로 좁히고 `direct` 분기(객체 `error` 처리) 전체를 삭제한 것은 원 결함(2줄 배선 오류) 대비 넓은 변경처럼 보이지만, `01_26_11/RESOLUTION.md` W4 에 "리뷰어가 `direct=null` 뮤테이션으로 87/87 GREEN 을 실증(커버리지 0) + 그 분기가 버그를 낳은 계약을 그대로 인코딩"이라는 근거가 명시돼 있고 호출부 2곳도 동반 수정됐다 — 은닉된 확장이 아니라 리뷰 피드백에 대한 문서화된 대응.
- **[INFO]** `use-execution-events.test.ts` 에 신규 테스트 3건(`[캐너리]` 1건 + `[가드]` 2건) 추가는 원 배선 수정(2줄) 대비 넓지만, 전부 `01_44_22/RESOLUTION.md` W2·INFO#7 에 근거해 같은 라운드의 리뷰 WARNING(형제 가드 `!code || !message` 커버리지 0)에 대한 대응이다 — plan 체크리스트(`- [x] 캐너리…`, 라인 59~60)에도 명시돼 스코프 밖 확장이 아니다.
- **[INFO]** `asRecord`/`wrapNodeHandlerOutput` 두 헬퍼 신설은 기능 확장이 아니라 (a) 2단 언래핑 가독성, (b) fixture 5곳 복제 방지(같은 결함 재발 방지, `01_26_11` maintainability W3 근거) 목적의 최소 추출 — 새 동작을 만들지 않고 기존 인라인 로직을 대체한다.
- **[INFO]** 포맷팅-only 변경, 미사용 임포트, 설정 파일(`package.json`/`tsconfig`/CI 등) 변경 없음 — `git diff --stat` 전수 확인 결과 모든 hunk 가 의미 있는 코드/주석/문서 변경.

## 요약

`git diff origin/main...HEAD` 전체(26파일, +1616/−62)를 직접 확인한 결과, 실질 프로덕션 코드 변경은 `use-execution-events.ts` 한 파일의 `extractNodeErrorPayload` 언래핑 로직 정정과 두 호출부(`handleNodeFailed`/`handleNodeCompleted`)의 인자 배선 교정에 국한되며, 이는 `plan/in-progress/system-error-banner-live-ws.md` 체크리스트와 1:1 대응한다. 테스트 파일의 fixture 정정·신규 캐너리/가드 테스트·CHANGELOG 추가·`direct` 분기 제거는 모두 원 결함 대비 표면상 넓어 보이지만, 전부 이 PR 자체가 거친 2회의 `/ai-review` 라운드에서 나온 WARNING 에 대한 문서화된 대응이며 각 RESOLUTION.md 에 근거가 명시돼 있다 — 별건 리팩토링·무관한 파일 수정·요청하지 않은 기능 추가는 발견되지 않았다. 22개의 `review/code/**` 산출물 동반 커밋도 이 저장소의 review→fix 워크플로 관례(선례 존재)와 일치해 스코프 이탈이 아니다.

## 위험도

NONE
