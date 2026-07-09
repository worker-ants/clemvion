# 변경 범위(Scope) Review

대상: `plan/in-progress/manual-trigger-default-param.md` — Manual Trigger `defaultValue` 무시 버그의 근본원인 3건(엔진 재진입 durable input 소실, 트리거 조회 category→type, 저장 시점 미검증) 수정 + hardening(저장 시점 스키마 검증, 프론트 인라인 이름 검증) + 테스트/문서. 리뷰 대상 diff 는 `origin/main...HEAD` 누적 38개 파일(구현 3라운드 + 그 사이 수행된 ai-review/consistency-check 산출물 포함)이다.

## 발견사항

- **[WARNING]** `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts` — 이번 작업과 무관한 모듈의 순수 포맷팅 diff
  - 위치: 321행 부근, `resolveOptOutEmailChannels` assertion 개행 스타일만 변경(로직·기대값 동일)
  - 상세: `schedule-runner` 모듈은 plan 문서·본 fix 어느 항목과도 직접 관련이 없다. 커밋 메시지(`06681073b`)와 RESOLUTION.md(W7)에 "사전 존재 prettier 에러가 이번 작업에서 처음 실행한 lint 로 표면화돼 통과에 필요했다"는 근거가 명시돼 있고, 이전 scope 리뷰 라운드(`review/code/2026/07/09/11_08_21/scope.md`)에서도 동일 항목을 WARNING 으로 이미 지적·기록했다. 즉 인지되고 문서화된 드라이브바이 변경이며 은폐되지 않았다. 다만 여전히 이번 작업의 파일/모듈 풋프린트 밖이라는 사실 자체는 변하지 않으므로, 엄밀한 diff 최소화 원칙에서는 별도 커밋으로 분리하는 편이 더 나았다.
  - 제안: 조치 불필요(이미 인지·문서화·수용됨). 향후 유사 상황에서는 "lint 통과에 필요한 무관 포맷 수정"을 별도 커밋으로 분리하는 편을 권장.

- **[INFO]** 프론트 즉시 store 커밋(`node-settings-panel.tsx` `handleConfigChange` → `updateNodeConfig`)이 1라운드 구현에 포함됐다가 spec(ED-SP-05·`0-canvas.md §8 R-3`) 위반으로 커밋 `0b185cc8c` 에서 되돌려졌고, 최종 누적 diff(`origin/main...HEAD`)에는 해당 파일도 `node-settings-panel-config-commit.test.tsx` 도 전혀 등장하지 않는다 — net diff 0으로 완전히 원복됨을 확인. 이는 "요청 이상의 변경"이 실제로 발생했다가 같은 PR 내에서 스스로 교정된 사례로, 최종 산출물 기준으로는 scope 위반이 남아있지 않다.
  - 제안: 조치 불필요(참고 기록).

- **[INFO]** 신규 plan 문서 `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` (project-planner 위임용 후속 작업)와 `review/code/2026/07/09/11_08_21/**`, `review/consistency/2026/07/09/11_39_56/**` 는 모두 CLAUDE.md 가 지정한 산출 위치(`plan/in-progress/`, `review/code/**`, `review/consistency/**`)에 정확히 위치하며, "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규약에 따른 필수 워크플로 부산물이다. 코드 기능과 무관해 보이지만 실제로는 이번 작업의 필수 절차이므로 scope 위반이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 3개 재진입 dispatch 지점 — 1라운드에서 각기 다른 언어/분량의 중복 주석으로 시작했으나, 2라운드 커밋(`7454a817c`)에서 `reentryWorkflowInput(savedExecution)` private 헬퍼로 통합되어 최종 diff 는 단일 JSDoc + 3곳의 짧은 참조 주석으로 정리됐다. 직전 라운드 ai-review(maintainability.md WARNING)가 지적한 "동일 로직 3중 반복·언어 불일치" 문제가 같은 PR 안에서 해소됨을 최종 diff 로 확인.
  - 제안: 조치 불필요(참고 기록).

- **[INFO]** import 변경 전수 확인 — `workflows.service.ts` 의 `validateTriggerParameterSchema`/`toTriggerParameterErrorDetails`(신규 저장 검증에 직접 사용), `trigger-configs.tsx` 의 `cn`(인라인 에러 스타일링에 직접 사용), `load-trigger-parameter-schema.ts` 의 `NODE_TYPES`(신규 조회 조건에 직접 사용, `NodeCategory` import 는 더 이상 안 쓰여 제거됨) 모두 실제 사용되며 불필요한 임포트 추가/정리는 없음.
  - 제안: 조치 불필요.

- **[INFO]** 설정 파일(tsconfig/package.json/eslint/CI 워크플로 등) 변경 없음. `CHANGELOG.md` Unreleased 항목 추가는 저장소 관례(severe 버그 수정 시 필수)에 부합하며 scope 위반 아님.

## 점검 관점별 요약

1. **의도 이상의 변경**: 최종 diff 기준으로는 plan 체크리스트(엔진 재진입·조회 방식·저장 검증·프론트 인라인 검증)와 1:1 대응. 유일하게 남은 무관 항목은 `schedule-runner.service.spec.ts` 포맷팅(이미 인지·수용).
2. **불필요한 리팩토링**: `trigger-configs.tsx` 의 map 블록을 암묵 반환→블록 반환으로 바꾼 것은 인라인 에러 렌더링을 위한 불가피한 구조 변경. `reentryWorkflowInput` 헬퍼 추출은 review 라운드의 유지보수성 WARNING 해소 목적으로, 범위 밖 리팩토링이 아니라 같은 PR 내 review-driven 개선.
3. **기능 확장**: 저장 시점 검증·프론트 이름 검증은 plan 의 명시적 hardening 항목(②③)에 정확히 대응하며 over-engineering 아님.
4. **무관한 수정**: `schedule-runner.service.spec.ts` 1건 외 발견되지 않음. 1라운드에 있었던 무관 타입 캐스트 제거(`workflows.service.ts` settings)는 3라운드 커밋에서 "stray eslint --fix" 로 식별돼 원복됨(최종 diff 에 없음).
5. **포맷팅 변경**: 위 1건 외에는 실질 변경과 섞인 포맷팅 노이즈 없음.
6. **주석 변경**: 신규/수정 주석 전부 비직관적 수정(durable input 재사용, type 기반 조회, restore 예외)의 근거를 설명하는 실질적 내용이며 장식성·불필요 주석 아님.
7. **임포트 변경**: 전수 확인 결과 모두 실사용, 불필요한 정리/추가 없음.
8. **설정 변경**: 없음.

## 요약

`origin/main...HEAD` 누적 38개 파일은 대부분 plan 문서가 기술하는 3건의 근본원인 수정과 hardening, 그에 대응하는 테스트·i18n·유저가이드·CHANGELOG, 그리고 CLAUDE.md 가 강제하는 review/consistency-check 산출물(별도 지정 경로)로 구성되어 범위가 명확히 일치한다. 1라운드에서 발생했던 실제 scope 이탈(spec 위반 프론트 즉시 커밋)은 같은 PR 안에서 CRITICAL 로 잡혀 완전히 원복됐고, 유지보수성 WARNING(3중 주석 반복)도 헬퍼 추출로 해소됐다 — 즉 반복 리뷰 사이클이 실제로 scope 를 좁히는 방향으로 작동했다. 유일하게 잔존하는 무관 항목은 `schedule-runner.service.spec.ts` 의 순수 포맷팅 diff 1건으로, 이미 이전 라운드에서 발견·문서화·수용된 저위험 사안이다.

## 위험도

LOW
