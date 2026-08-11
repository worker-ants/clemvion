# 변경 범위(Scope) Review — `16_31_02`

대상 델타: 커밋 `9416da806`(fix: 테스트 주석 정정 + plan 회고 절) + `de9674b2f`(docs: 리뷰
산출물 커밋). 아래는 이 델타 자체와, 요청받은 대로 PR 전체(`origin/main..HEAD`) 규모도 함께
점검한 결과다.

## 검증 절차 (직접 실측)

- `git show 9416da806 --stat` / `git show 9416da806` — 전체 diff 확인.
- `git show de9674b2f --stat` — 리뷰 산출물 전용 커밋인지 확인.
- `git diff origin/main --stat` — PR 전체 85 files / 7082(+) / 73(-).
- `git diff origin/main --shortstat -- codebase/ spec/` → 262(+)/24(-), 5 files.
- `git diff origin/main --shortstat -- plan/` → 171(+)/49(-), 3 files.
- `git diff origin/main --shortstat -- review/` → 6649(+)/0(-), 77 files.
- `review/code/2026/08/11/16_19_38/SUMMARY.md`, `review/consistency/2026/08/11/16_21_15/SUMMARY.md`
  를 읽어 라운드 5 가 이 델타(9416da806)의 **직접 유발 원인**(처분 대상 INFO 2건)임을 확인.

## 1. `9416da806` — 범위 밖이 섞였는가

**아니다.** 변경 파일은 정확히 2개, 31줄(+29/-1 아님, 실측: `use-widget.test.ts` +2/-1,
`plan/complete/webchat-boot-apibase-scheme-validation.md` +29/-0):

- `codebase/channel-web-chat/src/widget/use-widget.test.ts` — 주석 1줄 정정
  (`direct-load 외부 입력 방어` → `direct-load 전용 방어가 아니다`). **실행 코드 변경 0줄.**
- `plan/complete/webchat-boot-apibase-scheme-validation.md` — "라운드 2~5" 회고 절 추가.

둘 다 직전 라운드(`16_19_38` 코드 리뷰 + `16_21_15` consistency)가 **명시적으로 남긴 INFO
2건**을 그대로 처분한 것이다 (SUMMARY 원문: "INFO 2건 — 둘 다 처분" 표에 정확히 이 두 항목이
매핑됨). 요청받지 않은 리팩토링·기능 추가·무관한 파일 수정 없음. import/포맷팅 변경 없음.

## 2. plan 회고 절 추가가 이 PR 범위인가

**범위 안이다.** `plan_coherence`(consistency `16_21_15`)가 "라운드 2~5 회고가 plan 본문에
없다 — `review/` 는 SoT 아니다" 를 INFO 로 명시 지적했고, 이 절은 그 지적에 대한 직접 응답이다
— 즉 **자체 발의한 확장이 아니라 리뷰 사이클이 요구한 항목**이다. 대상 파일도 이 PR 자신의
완료 plan(`plan/complete/webchat-boot-apibase-scheme-validation.md`)이라 "무관한 문서" 가
아니다. 같은 파일에 이미 동일 패턴의 회고 문단(`@@ -112,3 +112,32 @@` 앞의 "다음에 같은
상황이면…" 문단)이 선재해, 이번 추가가 이 파일의 기존 관례를 반복한 것일 뿐 새 관행을
들여온 것도 아니다.

## 3. PR 전체가 6라운드에 걸쳐 비대해졌는가 — `git diff origin/main --stat`

실측 분해(총 85 files, 7082(+)/73(-)):

| 영역 | 파일 수 | 변경량 |
|---|---|---|
| `codebase/` + `spec/` (실제 제품 코드) | 5 | 262(+) / 24(-) |
| `plan/` (완료 이관 + 회고 + 관련 plan 1건 backlog 등재) | 3 | 171(+) / 49(-) |
| `review/` (코드 리뷰 5라운드 + consistency 3라운드 산출물) | 77 | 6649(+) / 0(-) |

**제품 diff 자체(433줄)는 원래 plan("boot 경로 apiBase 스킴 검증") 범위에서 벗어나지
않는다.** `safeApiBaseFromQuery` → `safeApiBase(raw, source)` 개명·`mergeBootConfig` 신설은
"두 입력 경로 모두에 같은 검증을 건다" 는 요구를 실제로 구현하는 데 필요한 최소 변경이고,
장문 JSDoc·spec §R7 는 "기각한 대안"·"진단 위치" 를 기록하는 이 저장소의 Rationale 관례를
따른 것이지 별개 기능 추가가 아니다.

**diff 의 94%(6649/7082줄)는 `review/**` 산출물이다.** 이는 프로젝트가 상시 강제하는
"구현 완료 후 `/ai-review` + Critical/Warning fix" 워크플로가 코드 리뷰 5라운드
(`15_16_20`→`15_32_44`→`15_50_53`→`16_06_02`→`16_19_38`) + consistency 3라운드
(`15_32_46`→`15_50_56`→`16_21_15`)를 거치며 각 라운드 산출물(SUMMARY/RESOLUTION/`*.md`/
`meta.json`/`_retry_state.json`)을 매번 커밋한 결과다. `CLAUDE.md` 가 이 산출물의 저장 위치를
`review/code/**`·`review/consistency/**` 로 명시하고 있어 **이 자체는 스코프 위반이 아니라
그 관례가 요구하는 부수 산출물**이다.

라운드별 발견 성격의 변화도 확인했다 — 1라운드 CRITICAL(호출부 배선 누락, 실제 동작 결함) →
2라운드 CRITICAL/WARNING(문서 복제 불일치·convention 위반) → 3~5라운드는 재번호 참조
깨짐·spec 문구·주석 문구 정정으로 점차 좁아졌다(동작→구조→문서). 이는 이 저장소가 "수렴"의
기준으로 삼는 패턴(발견 개수가 아니라 발견의 성격 변화)과 일치하며, 같은 자리를 맴도는
stale loop 형태는 아니다.

**경미한 관찰(INFO, 조치 불요):** `plan/in-progress/webchat-auth-session-status-reconcile.md`
(+28)는 이 PR 의 주 plan 이 아닌 **다른 진행 중 작업의 plan** 이다. 다만 그 추가분은 이
PR 이 `applyConfig` 의 기존 침묵 분기(선재 갭)의 **도달 빈도를 넓혔다**는 사실을 등재하는
backlog 항목이고("이 축이 없으면 넓힌 쪽이 책임진다"는 이 저장소의 관례), 실제 수정 없이
**등재만** 했다 — "미룬 항목은 그 턴에 plan 에 적어라" 관례와 일치해 스코프 위반으로 보지
않는다.

## 4. 머지 가능한가, 수렴했는가

라운드 5(코드 `16_19_38` 7명 + consistency `16_21_15` 5명) 시점에 이미 **전원 NONE/BLOCK:NO,
CRITICAL 0 / WARNING 0** 이었고, 남은 INFO 2건도 `9416da806` 에서 처분됐다. 이번 델타
(`9416da806`+`de9674b2f`) 는 그 처분 자체이며 범위를 벗어난 추가 변경이 없다. Scope 관점에서
머지를 막을 사유 없음.

## 발견사항

- **[INFO]** `plan/in-progress/webchat-auth-session-status-reconcile.md` 는 이 PR 의 주 plan
  이 아닌 별도 진행 중 작업 문서다.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:325` (`## \`applyConfig\`
    의 조용한 early return` 신설 절 시작)
  - 상세: 실제 코드 수정은 없고 이 PR 이 넓힌 도달 빈도를 backlog 로 등재한 것뿐이라 스코프
    위반은 아니나, 리뷰어가 diff 목록에서 "왜 이 파일이?" 를 바로 알 수 있도록 커밋 메시지에
    한 줄 근거가 있으면 더 명확하다(이미 `9416da806` 본문엔 없고 이전 라운드 커밋에 있음).
  - 제안: 조치 불요 — 참고용 기록.

## 요약

`9416da806`/`de9674b2f` 델타는 직전 라운드가 명시적으로 남긴 INFO 2건(테스트 주석 3번째
복제본 정정, plan 회고 절 추가)만 처분했고 그 외 변경이 없다. PR 전체로 봐도 실제 제품
diff(코드+spec+plan, 433줄)는 원래 plan("boot 경로 apiBase 스킴 검증")의 범위에 머물러 있고,
`safeApiBase` 개명·`mergeBootConfig` 신설은 "두 경로 모두 검증" 요구의 필연적 귀결이다.
diff 의 94%를 차지하는 `review/**` 산출물은 이 저장소가 상시 강제하는 리뷰-수정 사이클의
부수 산출물이며, 라운드가 거듭될수록 발견 성격이 동작→구조→문서로 좁아져 정상 수렴 패턴과
일치한다. 별도 plan 파일(`webchat-auth-session-status-reconcile.md`) 등재는 근거가 있는
backlog 기록이라 스코프 위반으로 보지 않는다.

## 위험도

NONE

STATUS: OK
