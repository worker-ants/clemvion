# RESOLUTION — code-snapshot-perf-ff751c / 2026/06/12/11_10_51 (재리뷰)

> 직전 리뷰(`10_52_44`)의 ai-review fix(commit 8cfa397a)로 `code.handler.ts`/`code.handler.spec.ts`
> 가 변경돼, review-before-stop 가드가 fix 델타 재리뷰를 요구. 코드 2파일 스코프로 재실행.

## 종합 위험도
RISK=**LOW**, Critical **0**, Warning **1** (side_effect 재실행분). 나머지 30건은 전부 INFO.

## Warning 조치

| 발견 | 분류 | 상태 | 조치 |
|------|------|------|------|
| side_effect [WARNING] — 모듈 임포트 시점 `createSnapshot` 동기(blocking) 실행으로 cold-start 비용 예측 불가 | 코드 — Side Effect | FIXED (주석 + 실측) | 이 trade-off 는 본 최적화의 의도(1회 비용 감수로 per-exec dayjs 재컴파일 제거). lazy-init 은 결정적 startup 속성을 깨고 첫 exec 분기 복잡도를 더하므로 **비채택**. 대신 리뷰어 제안대로 **실측 비용을 주석에 명시** — `createSnapshot` 모듈 로드 1회 비용 **~4ms**(로컬 median 3.7ms, N=7)를 `DAYJS_SNAPSHOT` 블록 주석 `COST:` 항목으로 기록. steady-state 요청 레이턴시 무영향 명시. 리뷰어 자신도 "즉각 수정 불필요" 로 평가. |

## INFO — 처리 방침 (조치 없음, 근거)

전 INFO 30건은 비차단. 주요 분류:
- **이미 보류 추적 중**: `execute()` 172줄 다중책임 분리(#14) = 기존 plan **W4**; SPEC-DRIFT #7/#10/#11(meta.durationMs·base64.decode·$vars copy-out spec 명확화) = 직전 RESOLUTION 의 planner 위임 + 본 PR plan 의 §4/§7.1 후속과 동류 → **project-planner 후속**. 코드 변경 아님.
- **기존 설계 의도(변경 불요)**: sha1/md5 허용(#1)은 spec §2.2 가 명시 허용 + 비암호학 경고 이미 문서화; 스택 조건부 노출(#3)·코드 에코(#4)는 기존 핸들러 계약(본 PR 무관, 기존 코드); `syntaxIsolate` 단일스레드 전제(#5/#17)는 현 환경 안전.
- **테스트 nice-to-have**: error.details.legacyCode 어설션(#22)·rawConfig 분기(#23)·config.timeout(#24)·NODE_ENV=production 스택제거(#25)·해시 알고리즘 4종(#27) 등 — 기존 코드 경로 커버리지 보강 제안으로 본 PR(스냅샷 성능)의 회귀 위험과 무관. 별도 테스트 보강 PR 후보로 남김(본 PR 미포함).
- **maintainability nice-to-have**: HOST_TIMEOUT_GRACE_MS 상수화(#15)·buildConfigEcho 추출(#18)·BLOCKED_GLOBALS 상수화(#16) 등 — 본 변경이 도입한 코드 아님(기존 핸들러), W4 리팩터 시 일괄 고려.

## TEST 결과
- unit: 통과 (73 passed) — `code.handler.spec.ts` 전체 (주석-only 변경 후 재확인)
- build/e2e: 미실행 (code-only, 단위 테스트로 충분)

## 결론
Warning 1건 FIXED(실측 주석). Critical 0. 잔여 INFO 는 비차단·기존 추적 항목 또는 별도 PR 후보. ESCALATE=no.
