# RESOLUTION — review/code/2026/07/23/14_19_49

대상: branch `claude/isconversationoutput-refactor-dc0472` (base `origin/main`).
리뷰 시점 마지막 코드 커밋 `c9a2a1dde`.

SUMMARY 판정: **RISK=LOW / CRITICAL=0 / WARNING=0 / INFO=7**. forced 7/7 전원 결과 확보.

> **디스크 기록 갭 확인**: workflow 반환이 `summary_written=false`(write_blocked) 였으므로
> main 이 `summary_markdown` 을 `SUMMARY.md` 로 직접 Write 했다. 또한 반환
> `reviewers[]`(7명) vs `ls *.md`(7개) 를 대조해 **누락 0** 을 확인했다 — 리뷰어 결과가
> 디스크에 없으면 summary 가 그 리뷰어를 카운트에서 빼 clean 오보고로 이어지는 알려진
> 하네스 갭(PR #901)이라 매 라운드 대조한다.

## 조치 항목

Critical·Warning 0 이라 차단 사유는 없었다. INFO 7건 중 **4건을 반영**했다 — 3건은 사실
오류이거나 이 PR 스스로 세운 원칙과 어긋나는 자기모순이고, 1건은 안전망의 실측된 구멍이다.

| SUMMARY # | 분류 | 내용 | 조치 |
|---|---|---|---|
| INFO 3 | testing | `output.endReason` fallback 단(`result?.endReason ?? output.endReason`)이 어떤 fixture 로도 고립되지 않음 — 통째로 지워도 전 테스트 green | **반영** — 주장을 먼저 실측 재현(삭제 시 tsc clean + 40/40 green, 즉 **머지 가능한 mutation 이 생존**). 고립 fixture 1건 추가(40 → 41) 후 재실측: H 제거 시 신규 테스트 1건만 red. 리뷰어는 "사전 존재 갭·비차단" 으로 분류했으나 본 작업의 목적이 이 게이트의 mutation 완전성이라 이월하지 않고 닫았다 |
| INFO 5 | requirement | plan 의 `api-convention.md` 링크가 `spec/conventions/` 를 가리키나 실제 경로는 `spec/5-system/2-api-convention.md` | **반영** — `find spec -name "*api-convention*"` 로 실제 경로 확인 후 두 링크로 분리 수정. 내가 넣은 사실 오류 |
| INFO 1 | maintainability/doc | 신규 테스트 주석이 소스 줄번호(`output-shape.ts:202`)를 하드코딩 — drift 감지 장치 없음 | **반영** — 줄번호를 제거하고 코드 앵커(`typeof endReason === "string"` conjunct·`ReadonlySet<string>`) 기준 서술로 전환 |
| INFO 2 | maintainability/testing | mutation 실측 서술이 테스트 주석과 plan 양쪽에 중복 — **이 PR 이 JSDoc 에 새로 명문화한 "근거는 한 곳에만" 원칙과 자기모순** | **반영** — 실측 표는 plan 단일 SoT 로 두고 테스트 주석은 결론 요약 + plan 포인터로 축약. 포인터는 폴더 경로가 아니라 파일명 기준으로 적어 `in-progress/` → `complete/` 이동에 견디게 했다 |
| INFO 4 | maintainability/doc | 파일 내 언어 혼재 잔존 — `isConversationOutput` JSDoc 만 한국어, 나머지 JSDoc 은 영어 | **미조치 (의도)** — plan 항목 3 이 스코프를 `isConversationOutput` JSDoc 으로 명시 한정했다. 무관한 함수 4개의 JSDoc 을 이 PR 에서 함께 고치면 scope 이탈이다. 리뷰어도 "의도된 결정, 조치 불요" 로 동의 |
| INFO 6 | scope | JSDoc 재작성이 헤딩·blockquote 를 새로 도입해 구조가 확장됨(+49/-33) | **미조치 (기록 목적)** — plan 항목 3 에 명시적으로 포함된 결정. 리뷰어 스스로 "스코프 이탈 아님" 판정 |
| INFO 7 | side_effect/doc | plan 체크리스트의 `/ai-review` 항목 미체크 | **반영** — 본 라운드 종료 시점에 체크 |

## 2차 라운드 (fresh review) 근거

INFO 3 반영으로 **테스트 파일에 실 fixture 가 1건 추가**됐다. 주석-only 가 아니므로
프로젝트 관례(fix 후 원 리뷰는 path-time stale → fresh `/ai-review` 1회)에 따라 재리뷰한다.
결과는 `review/code/2026/07/23/<hh_mm_ss>/` 에 기록하고, clean 이면 그 라운드는 RESOLUTION
불요로 수렴한다.

## 검증

- `output-shape.test.ts` → **41 passed** (39 → 40 → 41).
- run-results + conversation 스위트 → **348 passed / 19 files**.
- `eslint` clean, `tsc --noEmit` clean.
- mutation 전수 재실측 **11건**(R1·R2·R3·H·A~G): R3(타입 차단) 외 10건 전부 tsc clean
  = 실제 머지 가능한 변형이며, **각각 정확히 대응 테스트 1건만 red**. 원복 후 잔여 diff 0줄.
- 신규 fixture 는 tsconfig 가 테스트를 exclude 하므로(`src/**/*.test.ts` +
  `src/**/__tests__/**`) probe tsconfig 로 별도 타입체크했고, 고의 타입에러 주입으로
  probe 의 비-vacuity 를 먼저 실증한 뒤 제거했다.

테스트·주석·plan 만 변경했고 소스 실행 로직은 이 PR 전체에서 무변경(`output-shape.ts`
non-comment diff 0줄 실증)이라 e2e 재실행 불요.
