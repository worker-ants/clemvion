# RESOLUTION — 9차 리뷰 (`review/code/2026/08/01/19_10_47`)

누적 RESOLUTION 은 `review/code/2026/08/01/10_05_53/RESOLUTION.md`. 본 문서는 9차 세션분.

## 판정 요약

| 항목 | 값 |
|---|---|
| Critical | **0** |
| Warning | 5 — **전부 이번 diff 밖의 기 추적 항목** |
| 신규 코드 결함 | **0** |
| 관점별 | scope · side_effect · maintainability · testing = **NONE** / security · requirement = LOW |

9차 대상은 8차 조치 커밋(`8f4bcc378` + `b77c62bbd`)의 델타 5파일이다. `scope` 리뷰어가
"직전 리뷰 권고 3건과 1:1 일치, 범위 이탈 없음" 으로, `maintainability` 가 "직전 WARNING
해소 확인, 신규 결함 없음" 으로 각각 독립 확인했다.

## Warning 5건 — 처분

| # | 항목 | 처분 | 근거 |
|---|---|---|---|
| 1 | 트리거 시크릿/토큰 회전 3종 감사 미기록 | **planner 선행 후 developer** | 대응 audit action 이 spec 카탈로그에 없다(`spec/` 전체 `trigger.rotate*` 0건, 실측). `developer` 는 `spec/` read-only 라 단독 착수 불가. 리뷰어도 "이번 PR 스코프 밖, diff 가 만든 회귀 아님" 으로 동의. `plan/in-progress/spec-sync-auth-gaps.md` 등재 완료 |
| 2~5 | SPEC-DRIFT ×4 (`1-auth.md §4.1` · `data-flow/1-audit.md §1.1` · `conventions/audit-actions.md §3` · `2-navigation/2-trigger-list.md` L182/L252) | **planner 인계** | `developer` 권한 밖. 리뷰어 전원이 "코드 유지 + spec 갱신" 으로 판단 — 코드가 spec 의도대로 구현됐고 spec 의 **구현 상태 표만** 낡았다. 이미 plan · PR 본문에 인계 명시 |

**코드 변경 0건.** 리뷰어의 권장 조치사항 1번이 "해당 없음 — 이번 diff 자체에 즉시 코드
조치가 필요한 CRITICAL/WARNING 신규 결함 없음" 이다.

## 리포트 간 사실 충돌 1건 — 실측으로 판정

9차 `security` INFO #3 은 "`recordAudit` 를 try/catch 없이 await 하므로 `record` 실패 시
이미 커밋된 mutation 임에도 500 이 된다(fail-closed)" 로 서술한다. 8차 `side_effect` INFO #3
은 반대로 "`record()` 의 try/catch 로 완전 격리" 라고 했다.

**실측: 8차가 맞다.** `audit-logs.service.ts` 의 `record()` 는 본문 전체를 `try` 로 감싸고
`catch` 에서 `logger.warn` 만 남긴다 — 호출부로 예외가 전파되지 않는다. 따라서 9차 INFO #3 의
전제는 성립하지 않는다(fail-soft 이며, 감사 유실은 warn 으로만 드러난다).

어느 쪽이든 조치는 불필요하지만, **향후 라운드가 틀린 전제 위에서 "fail-closed 를 유지하라"
같은 결론을 내리지 않도록** 여기 못 박는다. 감사 유실을 조용히 넘기는 것이 문제라고 판단되면
그것은 `AuditLogsService.record()` 의 계약 변경이지 호출부 4곳의 문제가 아니다.

## 조치하지 않은 INFO — 근거

| 항목 | 근거 |
|---|---|
| `remove()` 4곳 · `update()` 2곳의 "저장 실패 시 감사 미기록" 대칭 테스트 부재 | 순수 순차 호출이라 트랜잭션 재배치 위험이 없다(분기 없음). 2라운드 전 "의도된 defer" 로 판정했고 이번 diff 가 해당 지점을 건드리지 않아 재상향 근거가 없다 — 리뷰어도 같은 판단 |
| `recordAudit` 헬퍼 5중복 | 6차·8차와 동일. `details` 계약이 helper 마다 달라 공통분모가 `resourceType` 바인딩뿐이다. 리뷰어도 "액션 강제 아님" |
| 어댑터 실패 메시지 1024자 truncate 후 노출 | **이번 diff 신규 아님**(`setupChatChannel` 기존 catch). 감사 로깅과 무관한 별개 표면이라 이 PR 에 섞지 않는다 |
| `saveCanvas`/`restoreVersion` 감사 미기록 | 카디널리티 논점으로 명시적 범위 밖. 리뷰어도 "근거 일관, 조치 불요" |

## 수렴 판정

**수렴 확정.** 라운드별 **신규 코드 결함** 추이:

| 라운드 | 4차 | 5차 | 6차 | 7차 | 8차 | **9차** |
|---|---|---|---|---|---|---|
| 신규 코드 결함 | 1 (CRITICAL) | 0 | 0 | 3 | 1 | **0** |

7차의 3건은 "더 좁힐 수 있다" 류 개선, 8차 1건은 그 개선이 남긴 실의 마감, 9차는 0이다.
동작 결함은 4차 이후 나오지 않았다. 남은 Warning 5건은 **모두 `developer` 권한 밖**이며
`plan/in-progress/spec-sync-auth-gaps.md` 와 PR 본문에 인계로 명시돼 있다.

## TEST 결과 (9차 시점)

- **lint** PASS 57s · **unit** PASS 86s · **build** PASS 157s · **e2e** PASS 287s
- backend: 413 suites / 8,403건 (8,402 pass · 1 skip), 실패 마커 0
- e2e: backend jest 260 + playwright 51 (로그 직접 확인 — wrapper 요약 숫자는 backend 분만 센다)
- `tsc --noEmit -p tsconfig.build.json` 0 오류
