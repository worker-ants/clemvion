STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json`(`rows[]`, 21개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127~197행) 본문을 함께 Read 했다.

## 변경 파일 컨텍스트

prompt 헤더(`### 파일 N:`) 172개를 전수 추출했다. 실제 프로덕션 코드 변경은 다음 backend 파일뿐이다: `chat-channel/{dispatcher,types}.ts`, `execution-engine.service.ts`, `retry-turn.service.ts`, `dashboard.service.ts`, `statistics.service.ts`, 신규 `shared/utils/terminal-duration.ts`. 나머지는 `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` 산출물, `spec/**.md` 3건이다. `codebase/frontend/**`·`codebase/channel-web-chat/**` 파일은 이 changeset 에 **단 하나도 없다**(글로브 매칭 트리거 전부 미스매치는 선행 4개 라운드와 결론 동일).

## 선행 4개 라운드와 다른 결론 — `run-debug-flow-change` 재실측

같은 changeset 을 다룬 선행 라운드(`10_18_38`,`10_34_51`,`10_52_08`,`11_09_44`)의 `user_guide_sync.md` 4건 전부가 "`run-debug-flow-change`(→`05-run-and-debug/`)는 근접 후보이나, 에디터 UI 의 사용자 가시 동작·표시값이 **변경 전후 동일**하다"는 동일 근거로 배제하고 위험도 NONE 으로 수렴했다. **이 전제를 diff 로 직접 재검증한 결과 반증된다.**

`git diff origin/main -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 로 `cancelParkedExecution` 을 대조하면:

```
- .set({ status: ExecutionStatus.CANCELLED, finishedAt: new Date() })
+ .set({
+   status: ExecutionStatus.CANCELLED,
+   finishedAt: terminalFinishedAt,
+   durationMs: () => TERMINAL_DURATION_MS_SQL,   // 신규
+ })
+ .setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)
  ...
+ .returning(['id', 'duration_ms'])               // 신규
```

이전엔 `durationMs` 를 아예 SET 하지 않아 park 취소된 실행의 DB `duration_ms` 는 **NULL** 로 남았다. 동일 패턴이 `markWebChatIdleTimeout`·`markQueueWaitTimeout`·`finalizeStalledExhausted`·재개 실패 취소 등 5경로 전부에 적용됐다(CHANGELOG 도 "엔티티를 로드하지 않는 5경로... UPDATE 문 안에서 SQL 로 계산" 이라 명시). 이 PR 이후 그 5경로는 이제 **대기 경과 시간**(park 는 최대 ≈24.8일, `LEAST(2147483647,...)` int4 클램프)을 `duration_ms` 에 싣는다.

Frontend 는 이 컬럼을 **상태 필터 없이 그대로 렌더**한다 (grep 으로 확인, 이번 changeset 밖의 기존 코드):

- `codebase/backend/src/modules/executions/executions.service.ts:852` — `durationMs: execution.durationMs ?? null,` (무조건 pass-through)
- `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx:292` — `{formatDuration(execution.durationMs)}` (status 분기 없음, Cancelled 행 포함)
- `.../executions/[executionId]/page.tsx:379` — 실행 상세 페이지도 동일
- `.../dashboard/page.tsx:308` — Recent Executions 위젯도 동일
- `components/editor/run-results/execution-history-panel.tsx:158` — 에디터 인-패널 히스토리 모달도 동일

`formatDuration`(`lib/utils/execution-status.ts:57`)은 ms/초/분:초만 지원하고 **일 단위 포맷이 없다** — 수 시간~수일의 대기 시간이 들어오면 `minutes`/`seconds` 로만 환산돼(예: 3일 대기 → `4320:00`류) 사람이 읽기 어려운 값이 그대로 노출될 소지가 있다.

즉 사용자는 **이전엔 "—"(빈 값)로 보이던 park 취소·idle 타임아웃·큐 대기 타임아웃 실행에서, 이제 (실행 시간이 아닌) 대기 시간을** "소요 시간"/"Duration" 이라는 이름으로 보게 된다. 이는 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:132`(+`.en.mdx:122`, "각 항목에는 상태 아이콘, 트리거 출처, **소요 시간**, 노드 수, 경과 시간이 함께 표시돼요")와 "전용 실행 내역 페이지"(Cancelled 필터가 명시적으로 존재) 서술이 반영하지 못하는 새 행동이다.

**선행 라운드가 놓친 지점**: 같은 라운드(`10_34_51`)의 **다른** reviewer 산출물(`review/code/2026/08/15/10_34_51/RESOLUTION.md` W3)이 이미 정확히 반대 결론을 냈다 — "`frontend/.../executions/page.tsx:292` Duration 컬럼 | 대기 시간이 실행 시간으로 표시" 라고 명시하고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 트래커로 등재했다. 그런데 **같은 라운드의 `user_guide_sync.md` 는 이 산출물을 대조하지 않고** "표시값 불변"이라는 반대 결론을 유지했고, 이후 3개 라운드(`10_52_08`,`11_09_44`)가 "선행 라운드와 결론 일치"를 근거로 재검증 없이 답습했다.

## 발견사항

- **[WARNING]** `05-run-and-debug/run-results.mdx`(+`.en.mdx`) 미갱신 — 취소/타임아웃 실행의 "소요 시간" 표시 의미가 이 PR 로 바뀌었는데 문서에 반영 안 됨
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`cancelParkedExecution`/`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`finalizeStalledExhausted` 등 raw UPDATE 5경로), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
  - 매트릭스 항목: `run-debug-flow-change`(`.claude/config/doc-sync-matrix.json` id) — "실행·디버깅 흐름 변경" → targets: `codebase/frontend/src/content/docs/05-run-and-debug/` (PROJECT.md 151행 동일)
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` + `.en.mdx` ("인-에디터 히스토리 패널"/"전용 실행 내역 페이지" 절의 "소요 시간"/"Duration" 필드 설명)
  - 상세: 위 diff 대조로 실측 — park 취소 등 5경로는 이 PR 이전 `duration_ms` NULL, 이후 대기 경과 시간(최대 ≈24.8일)을 채운다. Frontend 4개 표면(실행 목록·실행 상세·대시보드·에디터 히스토리 패널)이 status 무관하게 이 값을 그대로 렌더하며, `formatDuration` 은 일 단위 포맷을 지원하지 않아 극단값이 사람이 읽기 어려운 형태로 노출될 수 있다. 문서는 이 caveat 없이 "소요 시간"을 일반적인 실행 시간처럼 서술한다
  - 이미 알려진 리스크: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "⚠️ `duration_ms` 에 '대기 시간' 이 섞여 집계를 오염시킨다"(`10_34_51` W3, 2026-08-15 등재) 가 `dashboard.service.ts`/`statistics.service.ts`/`executions/page.tsx` 세 소비처를 열거했다. 이번 diff 는 **dashboard·statistics 두 곳만** `AND e.status = :completedStatus` 필터로 수정했다(파일별 diff 로 확인) — **frontend `executions/page.tsx` 소비처(및 그 값을 공유하는 실행 상세·대시보드 위젯·에디터 히스토리 패널)는 여전히 미조치**이며, 트래커의 해당 체크박스도 unchecked 로 남아 "2/3 완료" 상태가 반영되지 않았다
  - 제안: (a) 근본 수정 — frontend 소비처에 status 기반 표시 분기(취소/타임아웃 실행은 "대기 시간" 별도 라벨 또는 "—")를 넣거나 백엔드가 순수 실행시간/대기시간을 별도 필드로 분리, 그 뒤 문서는 원래 서술 유지 가능. (b) 최소 조치 — 근본 수정 전까지 `run-results.mdx`+`.en.mdx` 의 "소요 시간" 필드 설명에 "취소/타임아웃으로 종료된 실행은 대기 시간을 포함할 수 있다" caveat 추가. (c) 트래커(`spec-sync-external-interaction-api-gaps.md`)의 W3 체크박스를 "dashboard/statistics 완료, frontend 잔여" 로 갱신해 부분완료를 반영

- **[INFO]** (선행 3개 라운드와 결론 동일, 재확인) EIA 종결 payload(`chat-channel/types.ts`/`dispatcher.ts`) 필드 확장이 `02-nodes/triggers.mdx`에 반영되지 않았으나, 이 문서는 애초에 종결 이벤트의 필드 단위 payload shape 를 문서화한 적이 없다(이벤트 **이름**만 나열). 자매 PR(`e3825cc2c`, `error` 필드 shape 변경)도 이 문서를 갱신하지 않은 선례가 있어 신규 결함이 아니다. payload shape 의 SoT 는 `spec/5-system/14-external-interaction-api.md` §6(이 changeset 안에서 갱신 확인). 조치 불요

## 요약

매트릭스 21개 행(glob 9 + semantic 12)을 전수 순회했고 frontend/channel-web-chat 코드 변경이 0건이라 glob 매칭 트리거는 전부 미스매치다. 유일한 semantic 매칭은 `run-debug-flow-change`(→`05-run-and-debug/`) 1건으로, 선행 4개 독립 라운드가 "UI 표시값 불변"이라 배제했던 것을 diff 실측(취소 경로 5곳의 `.set()` 절 이전/이후 대조 + frontend 4개 렌더 지점 무조건 pass-through 확인)으로 반증해 WARNING 1건으로 상향했다 — 취소/타임아웃 실행의 "소요 시간" 표시 의미가 이 PR 로 실제로 바뀌는데 `05-run-and-debug/` 문서가 이를 반영하지 못한다. 이 리스크 자체는 같은 changeset 내 다른 reviewer(`10_34_51` RESOLUTION W3)가 이미 포착해 트래커에 등재했으나 frontend 소비처(및 그 문서 반영)는 여전히 미조치다. `backend-api-change`→`triggers.mdx` 후보는 기존 관례상 INFO 로 유지. i18n dict·backend-labels·locale.ts 관련 trigger 는 매칭 파일 자체가 없다.

## 위험도

MEDIUM
