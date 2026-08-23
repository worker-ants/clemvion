# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `TERMINAL_DURATION_MS_SQL` verbatim 결속 메모가 한쪽 문서에만 있다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W10 항목 blockquote("결속 메모" 단락, `TERMINAL_DURATION_MS_SQL` 을 정본 문자열 그대로 태운다는 서술)
  - 상세: 신규 e2e(`terminal-duration-sql.e2e-spec.ts`)가 `TERMINAL_DURATION_MS_SQL` 을 이름 있는 파라미터만 치환해 그대로 실행하므로, 이 SQL 의 형태가 바뀌면(예: 트래커 내 미해결 항목인 "`duration_ms` 필드 분리") 이 e2e 도 함께 갱신해야 한다는 결속을 W10 항목 자신은 잘 적어 뒀다. 다만 그 반대편 — 아직 미해결(`[ ]`)로 남아 있는 "순수 실행시간과 wall-clock 대기시간의 필드 분리" 항목(`## ⚠️ duration_ms 에 "대기 시간" 이 섞여 집계를 오염시킨다` 절) — 에는 이 e2e 로의 역참조가 없다. 같은 라운드의 `review/consistency/2026/08/23/10_48_33/SUMMARY.md` Plan Coherence INFO #7 이 이미 이 갭을 잡아 "권장 조치사항 4" 로 등재해 뒀으므로 이 PR 에서 별도 조치가 필수는 아니나, 필드 분리 작업 착수 시 두 문서를 동시에 열어야 결속이 실제로 지켜진다.
  - 제안: 필드 분리 plan 이 신설되거나 착수되는 시점에 그 문서(또는 트래커의 "필드 분리" 불릿)에 "`terminal-duration-sql.e2e-spec.ts` 가 SQL 문자열을 verbatim 고정하므로 형태 변경 시 함께 갱신" 한 줄을 추가할 것. 비차단.

## 요약

이번 변경은 코드(신규 e2e) 1개 + plan 트래커 갱신 2개 + 이전 `/consistency-check` 라운드의 산출물(review/consistency/**) 8개로 구성된다. 신규 e2e 파일(`terminal-duration-sql.e2e-spec.ts`)은 함수마다 "왜 이렇게 하는가"를 설명하는 JSDoc/블록 주석이 충실하고, 그 서술을 실제 소스(`terminal-duration.ts`, `execution.entity.ts`, 마이그레이션 SQL, `webchat-idle-reaper.e2e-spec.ts`, `test/helpers/db.ts`)와 직접 대조한 결과 전부 정확했다 — 테이블명이 `'executions'`가 아니라 `'execution'`이라는 지적, `webchat-idle-reaper` e2e 가 `duration_ms` 를 assert 하지 않는다는 지적, `duration_ms` 컬럼이 실제 `integer`라는 전제 모두 소스와 일치한다. e2e 총계 "276 → 282(신규 6건)" 수치도 저장소 전체 e2e 스펙의 `it(`/`test(` 정적 카운트(282)와 일치해 검증됐다. plan 트래커 갱신은 완료된 항목을 취소선+인용으로 처리하고 "원 항목의 주장이 한 칸 넓었다"는 자기수정(뮤테이션 실측으로 부호·클램프는 기존 단위 스펙이 이미 잡고 있었음을 확인)까지 투명하게 남겨 이 저장소의 관례(과장된 유예/완료 근거를 실측으로 되돌아보는 습관)를 잘 따른다. 새 동작·API·설정 변경이 없어 CHANGELOG·README·API 문서 갱신은 해당 사항이 없으며 실제로 누락되지 않았다. 유일한 관찰은 INFO 1건(듀레이션 필드 분리 plan과의 상호 참조가 편도로만 있음)이며 이미 동봉된 consistency 리포트가 같은 사항을 권장 조치로 잡아 두었으므로 이번 PR을 막을 사유가 아니다.

## 위험도

NONE
