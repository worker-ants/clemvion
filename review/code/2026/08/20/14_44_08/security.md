# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard (14_44_08)

## 컨텍스트

이번 changeset 은 `Execution.inputData` 의 egress 마스킹 **카브아웃을 폐지**하는 정책 전환이다.
종전엔 이 컬럼만 "재제출 소비처가 마커를 못 알아본다"는 이유로 값-패턴 마스킹을 건너뛰었는데
(`MASKED_INPUT_DATA_REASON`), 이번 PR 은 재제출 소비처 3곳(폼 프리필·Re-run 모달·에디터
히스토리 로드) 전부에 마스킹-마커 감지 가드를 세워 그 예외 조건을 닫고, backend 세 표면
(`toResponseExecution`/`toExecutionDto`/`stop` 의 `...rest` 스프레드)에 `redactStoredDataForResponse`
를 걸었다. 직전 라운드(`14_08_45`)에서 CRITICAL 2건(object/array leaf 우회, stale JSDoc)이
지적됐고 `RESOLUTION.md` 로 조치됐다 — 본 리뷰는 그 조치가 실제로 반영됐는지와 신규 결함
유무를 재검증한다.

## 발견사항

- **[INFO]** 마스킹-마커 재제출 차단이 **클라이언트 단(프런트엔드)에서만** 강제된다 — 서버 측 재검증 없음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (`blockedByMaskedInput`, `handleSubmit`), `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (`jsonError`/`handleRunWithInput`)
  - 상세: `Submit`/`Run` 버튼은 `disabled={... || blockedByMaskedInput}` / `disabled={... || jsonError != null}` 로만 막힌다. UI 를 우회해 API 를 직접 호출(스크립트·저장된 폼 재생·확장 프로그램 등)하면 리터럴 `'***'` 를 `inputData` 로 그대로 제출할 수 있다 — backend 실행 엔드포인트가 이 값을 거부하지 않는다. 다만 이는 **기밀성 침해가 아니라 자기 자신의 데이터 오염**(원래 마스킹된 값을 자기가 다시 자기 실행에 흘려 넣는 것)이라 공격 표면으로서의 심각도는 낮다 — 애초에 그 값을 볼 수 있는 사람은 그 워크스페이스 멤버 본인이고, 마스킹된 값 자체는 이미 자격증명이 제거된 상태다. `RESOLUTION.md`(`review/code/2026/08/20/14_08_45/RESOLUTION.md` INFO-1)에서도 "서버측 재검증은 설계 결정상 별건"으로 명시적으로 defer 되어 있어, 이번 changeset 이 새로 만든 갭이 아니라 알려진 채로 유지되는 결정이다.
  - 제안: 현 설계를 유지한다면 문제 없음(기밀성 영향 없음). 다만 향후 "실행 재현성/무결성" 요구가 커지면 실행 엔진 진입점에서 `inputData` 값에 `MASKED_MARKERS` 리터럴이 포함된 요청을 거부하는 서버측 방어를 검토할 수 있다(별도 트래커 항목으로 이미 등재돼 있으므로 이번 PR 범위 밖).

- **[INFO]** 마커 판별 로직이 **정확 일치(exact match)** 만 잡는 의도적 경계 — 부분 치환(`scheme://***@host` 류)은 감지되지 않음
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts` (`isMaskedMarker`/`hasMaskedMarkerLeaf`)
  - 상세: JSDoc 이 이 경계를 명시적으로 설계 결정으로 문서화했고("오탐 비용이 미탐 비용보다 크다"), 미탐 쪽 값은 이미 자격증명이 제거된 상태이므로 기밀성 노출은 아니다(같은 "왕복 오염" 성질만 잔존). backend 의 부분-마스킹(`scheme://user:pass@host` → `scheme://***@host`)이 그대로 재제출되면 데이터 오염이 발생할 수 있으나, 이는 알려진 잔여 갭으로 문서화돼 있고 이번 리뷰의 새 결함이 아니다.
  - 제안: 조치 불요(의도된 트레이드오프, 테스트가 양방향 캐너리로 고정돼 있음).

- **[INFO]** 직전 라운드 CRITICAL 2건 재검증 — 둘 다 정상 반영 확인
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (`splitMaskedParameters` 가 `isMaskedMarker` 와 `hasMaskedMarkerLeaf` 를 모두 사용해 object/array 내부 leaf 도 차단), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (`ExecutionDto.inputData` JSDoc 이 "값-패턴 마스킹 대상이다"로 정정되어 더 이상 실제 동작과 모순되지 않음)
  - 상세: `git diff origin/main` 로 backend 세 표면(`toResponseExecution`/`toExecutionDto`/`stop`)과 frontend 세 소비처(폼 프리필/Re-run 모달/에디터 툴바) 전부를 직접 확인했다. `MASKED_INPUT_DATA_REASON` 앵커는 `codebase/` 전체에서 0건(grep 확인) — 삭제가 완결됐다. 신규 테스트(`executions.service.spec.ts` ①②⑧⑧-b, `rerun-modal.test.tsx`, `editor-toolbar-run-input.test.tsx`, `masked-markers.test.ts`)가 마스킹 방향 전환과 nested-leaf 차단을 양방향으로 고정한다.
  - 제안: 조치 불요(확인 목적의 기록).

인젝션·하드코딩 시크릿·인증/인가·암호화·에러 처리·의존성 관점에서는 해당 changeset 범위 내
새로운 결함을 발견하지 못했다. 변경된 코드는 정규식/동적 쿼리/커맨드 실행을 포함하지 않고,
`redactStoredDataForResponse`/`redactStoredErrorForResponse` 호출 경로가 이번 diff 로 인해
좁아지거나 우회되는 지점도 없다(오히려 마스킹 적용 범위가 넓어지는 방향).

## 요약

이번 changeset 은 `Execution.inputData` 의 egress 마스킹 예외를 닫아 자격증명 패턴이 재제출
경로로 되먹임되는 것을 막는 **데이터 무결성 강화** 작업이며, 기밀성 관점에서는 오히려 마스킹
적용 범위를 넓히는 방향(순수 강화)이다. 직전 리뷰 라운드가 잡은 CRITICAL 2건(object/array
내부 마커 우회, stale JSDoc 모순)은 `git diff` 로 직접 재검증한 결과 정상 반영됐고,
`MASKED_INPUT_DATA_REASON` 앵커 삭제도 코드베이스 전수에서 완결됐다. 유일하게 남는 것은
클라이언트 단 전용 가드라는 설계적 한계(INFO)인데, 이는 기밀성 침해가 아니라 사용자 자신의
데이터 오염 방지 목적이고 이미 별도 트래커 항목으로 defer 된 알려진 결정이라 이번 PR 의
결함으로 볼 수 없다. 인젝션·시크릿 하드코딩·인증/인가·암호화·에러 노출·의존성 축에서는
새로운 취약점을 찾지 못했다.

## 위험도

NONE
