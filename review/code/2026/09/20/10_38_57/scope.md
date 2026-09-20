# 변경 범위(Scope) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기 (머지 후 최종 감사)

## 검증 방법

- `git diff --stat origin/main...HEAD` 로 실제 branch diff(44개 파일, `+2317/-26`)를 프롬프트에 실린 44개 파일과 1:1 대조 — 추가·누락 0건.
- `git show --stat 840e8e7f9`(원 구현 커밋)로 최초 구현 범위를 확인.
- 애플리케이션 코드 3곳(`database-query.handler.ts:262-343`, `http-request.handler.ts:355-390`, `http-connection-tester.ts:108-135`, `database-connection-tester.ts:140-155`)을 `Read`로 직접 열어 diff 게이트 줄 번호와 실제 소스가 일치함을 확인. 저장소에 쓰지 않았다(`git status --short` 결과 이 리뷰 세션 자신의 출력 디렉터리 `review/code/2026/09/20/10_38_57/` 외 변경 없음).

## 발견사항

- **[INFO]** import 나열 순서가 형제 파일 5곳과 다름 (1·2라운드 scope 리뷰에서 이미 지적·defer 됨 — 3회째 재확인, 여전히 미수정이나 실질 영향 없음)
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts:5-8`
  - 상세: 이 파일만 `assertSafeOutboundHostResolved, SsrfBlockedError` 순(알파벳 소문자 우선)이고, 같은 diff 로 함께 바뀐 `database-connection-tester.ts:5-8` · `http-connection-tester.spec.ts:1-6` · `http-redirect.ts:1-5` · `http-request.handler.ts:19-24` 는 전부 `SsrfBlockedError` 를 먼저 두는 순서다. 빌드·lint 는 통과했고(plan 체크리스트 기록), 두 차례 리뷰 라운드 모두 "조치 불요"로 명시적 defer 처분됨. 세 번째 라운드에서도 이 판단을 뒤집을 새 근거는 없다.
  - 제안: 조치 불요 — 이미 두 라운드에서 defer 확정. 다음에 이 파일을 만질 때 정렬만 맞추면 됨.

## 범위 밖 변경 없음 확인

- **애플리케이션 코드 10개 파일** (`database-connection-tester.{ts,spec.ts}` · `http-connection-tester.{ts,spec.ts}` · `database-query.handler.{ts,spec.ts}` · `http-redirect.{ts,spec.ts}`(신규) · `http-request.handler.{ts,spec.ts}`) — `git diff --stat` 상 branch 전체가 정확히 이 10개 파일만 건드리고, 다른 어떤 소스 파일(다른 노드 핸들러, 서비스, 마이그레이션, 프런트엔드)도 손대지 않았다. 각 diff 는 (1) `SsrfBlockedError` import 추가, (2) `instanceof` 판정/비판정 분기와 그 근거 주석, (3) 기존 판정 테스트의 `new Error(...)` → `new SsrfBlockedError(...)` 치환, (4) "판정 아닌 오류" 신규 테스트로만 구성된다. `plan/in-progress/ssrf-catch-instanceof.md` 가 사전에 선언한 4개 호출부 + 동반 1건(`http-connection-tester.ts` preflight 를 `try` 안으로) 과 정확히 일치한다.
- **`http-connection-tester.ts` 의 preflight 위치 이동**은 plan 문서 "동반 1건" 섹션에 사전 고지된 필연적 결과다 — `outboundBlockReason` 이 판정 아닌 오류를 던지게 되면서 이 함수가 원래 갖던 no-throw 계약을 유지하려면 그 호출을 `try` 안으로 옮겨야 했다. 별개의 drive-by 리팩토링이 아니라 주 변경(판정 분류)의 직접적 파생 효과다. `AbortSignal.timeout` 생성 순서 이동은 그 이동이 만든 자체 회귀(전송 예산 잠식, 1라운드 W2)를 같은 PR 안에서 고친 것으로, 새로운 스코프가 아니라 자기 결함의 정정이다.
- **트래커 갱신 `plan/in-progress/spec-draft-nullable-notation-followups.md`** — 실제 코드 변경 없이 텍스트만: (1) 이 작업이 해소한 항목 `[x]` 체크, (2) 이 PR 이 발견했지만 코드로 고치지 않은 무관한 e2e flake(`schedule-trigger` cron 1분 창 충돌)를 새 백로그 항목으로 등재, (3) 메시지 마스킹 비대칭(가드 «고장» 경로에 host/IP 패턴 마스킹 없음) 을 새 백로그 항목으로 등재, (4) spec `code:` frontmatter 누락을 planner 항목으로 등재. 넷 다 "미룬 항목은 그 턴에 plan 에 남긴다" 프로젝트 관례에 부합하는 관찰-only 기록이며, 코드를 건드려 스코프를 넓히지 않았다.
- **`plan/in-progress/ssrf-catch-instanceof.md` 신설** — 이 작업 자체의 plan 문서로, 정보 저장 위치 표(`CLAUDE.md`)가 요구하는 위치·형식과 일치한다.
- **리뷰·일관성 산출물 32건** (`review/code/2026/09/20/09_35_16/**`, `review/code/2026/09/20/10_09_56/**`, `review/consistency/2026/09/20/09_06_34/**`) — `--impl-prep`/`/ai-review` 게이트 실행 결과이며, `CLAUDE.md` "정보 저장 위치" 표가 요구하는 정규 프로세스 산출물이다. 무관한 파일 혼입이 아니다.
- 설정 파일(`package.json`, eslint/tsconfig 등) 변경, 사용하지 않는 import 추가/정리, 포맷팅-only 변경, 요청 밖 기능 확장(over-engineering)은 44개 파일 어디에도 없다. 추가된 주석/JSDoc 은 전부 이번 `instanceof` 분기의 근거(왜 판정과 고장을 가르는지, 각 호출부의 no-throw/no-leak 계약)를 설명하는 것으로 diff 와 직접 결부돼 있고, 무관한 주석 첨삭은 없다.

## 요약

`git diff --stat origin/main...HEAD` 대조 결과 44개 변경 파일 전량이 프롬프트에 실린 목록과 정확히 일치하며, 애플리케이션 코드는 plan(`ssrf-catch-instanceof.md`)이 선언한 4개 호출부 + 동반 1건(`http-connection-tester.ts` no-throw 계약 유지)으로 정확히 국한된다. 그 동반 변경과 후속 타임아웃-순서 수정 모두 주 변경의 직접적 파생이지 별개의 drive-by 리팩토링이 아니다. 트래커·plan 갱신은 해소 체크와 "발견했지만 이번엔 안 고친" 항목의 관찰-only 등재이고, 리뷰/일관성 산출물은 프로젝트가 요구하는 정규 절차 산출물이다. 유일한 잔여 발견은 1·2라운드에서 이미 defer 확정된, 실질 영향 없는 import 순서 불일치 하나뿐이며 이번 3라운드에서도 판단을 바꿀 근거가 없다.

## 위험도

NONE
