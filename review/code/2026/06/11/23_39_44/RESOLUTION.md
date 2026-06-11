# RESOLUTION — 23_39_44 (최종 증분 리뷰: origin/main 머지 범위)

리뷰 세션 `review/code/2026/06/11/23_39_44/` (range `961f79a5..HEAD` — origin/main 머지(#546/#545/#547)
+ W-4 fix 포함). 위험도 **MEDIUM · Critical 0 · Warning 8**. 본 RESOLUTION 으로 종결.

> 본 리뷰는 origin/main 머지 후 Gate 1 재무장(머지가 codebase 파일을 23_14_40 리뷰 이후로 유입)을
> 해소하기 위한 최종 커버리지. router=`requirement/scope/side_effect/documentation` (머지 범위가
> 대부분 spec/docs). **scope=NONE** — 내 변경이 plan 명시 범위 내임을 확인. Critical 0.

## Warning 처분

| # | 처분 | 근거 |
| --- | --- | --- |
| W1 (`HTTP_BLOCKED` §3.2 누락) | **FIX (본 커밋)** | `3-error-handling.md §3.2` 대표 코드 표 HTTP 행에 `HTTP_BLOCKED` 추가 — §1.4 와 일치. |
| W2 (`HTTP_TIMEOUT` dead path) | **후속(선재)** | handler 가 fetch reject 를 `HTTP_TRANSPORT_FAILED` 로 통합 — `HTTP_TIMEOUT` 미발행은 **본 PR 이전부터** 존재. 카탈로그 정리는 별 작업. followups. |
| W3 (`output.response.error` deprecation 미선언) | **후속(선재)** | `1-http-request.md §5.3.2` legacy 필드 — node-output-redesign P3 추적 항목, 본 PR 무관. |
| W4/W5/W8 (llm-config 잔존·6-config frontmatter·1-auth 링크) | **범위 외(머지 코드)** | 모두 **#545(model mgmt)/#547(auth audit)** 머지가 가져온 파일의 선재 항목 — 내 C-3 변경 아님. 해당 PR 트랙. |
| W6 (`error-codes.md §3` legacyCode 미등재) | **후속(선재)** | `2-code.md` 의 `EXECUTION_TIMEOUT`/`CODE_RUNTIME_ERROR` legacyCode — **#546(C-2)** 영역. C-2 followup 과 동일. |
| W7 (`execution-failure-classifier.ts` CODE_MEMORY_LIMIT/HTTP_BLOCKED 미등재) | **후속** | CODE_MEMORY_LIMIT 는 #546 영역(C-2 followup), HTTP_BLOCKED 는 본 PR followup(`http-ssrf-all-auth-followups.md`). fallback 도 `executionFailedInternal` 반환이라 UX 정상 — warn 로그만. |

## INFO 처분
- I1 (SPEC-DRIFT, SSRF 전 인증 확장): **의도된 변경, spec 올바르게 갱신됨** — reviewer 확인. 조치 불요.
- I9 (`_retry_state.json` 초기상태 커밋): 리뷰 하네스 산출물 — 즉각 조치 불요.
- 나머지 INFO(머지 코드 검증·헤딩·분류 근거): 후속/범위 외.

## TEST 결과 (머지 후, 8f9af9e0 기준)
- lint ✅ · unit ✅ (backend 6610) · build ✅ · e2e ✅ (188 — alpine isolated-vm 재컴파일 포함).

## 머지 사유 (PR 본문 참조)
브랜치가 #546 머지 전 분기라 `--impl-done` 2-dot diff 가 2-code.md 를 "node:vm 되돌림" 으로 오판
(stale-base FP). origin/main 머지로 현행화해 해소. `--impl-done 23_30_30` 의 node-output 3.1
Critical 도 main-baseline FP (branch 는 SSRF 를 Runtime 포트로 이미 이동 — 429d32d5, 3-dot 입증).
