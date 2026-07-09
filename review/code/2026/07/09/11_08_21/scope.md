# 변경 범위(Scope) 리뷰

대상 plan: `plan/in-progress/manual-trigger-default-param.md` — Manual Trigger 파라미터 default 미적용 3지점 방어 수정 ((a) 프론트 영속, (b) 조회 by type, (c) 엔진 재진입 input) + hardening(② 저장 검증, ③ 프론트 이름 검증) + 테스트/문서.

## 발견사항

- **[WARNING]** `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts` — 태스크와 무관한 순수 포맷팅 diff
  - 위치: 321행 부근, `resolveOptOutEmailChannels` assertion
  - 상세: 이 파일의 유일한 변경 hunk가 `expect(\n  notifications.resolveOptOutEmailChannels,\n).toHaveBeenCalledWith(...)` 형태를 `expect(notifications.resolveOptOutEmailChannels).toHaveBeenCalledWith(\n  ...,\n)` 형태로 재개행한 것뿐이다. 로직·기대값 변경 없음. `schedule-runner` 모듈은 이번 plan 의 수정 대상(execution-engine 재진입 input, trigger 조회 by type, 프론트 config 영속, 저장 시 검증)과 직접 관련이 없고, plan 문서의 "수정" 체크리스트에도 이 파일이 언급되지 않는다. 전형적인 "실질 변경과 섞인 포맷팅 변경" 패턴 — 아마 IDE/포매터가 열려 있던 파일에 자동 적용됐거나 별도 커밋에서 섞여 들어온 것으로 보인다.
  - 제안: 이 hunk 를 되돌리거나(관련 없는 diff 최소화), 정말 필요하다면 별도의 formatting-only 커밋으로 분리. 최소한 plan 문서에 "무관 포맷팅 1건 정리"로 명시.

- **[INFO]** `codebase/backend/src/modules/workflows/workflows.service.ts` — 무관한 타입 단언 제거
  - 위치: `saveCanvas` 내 `Workflow` 생성부, `settings: { ...dto.settings } as Record<string, unknown>,` → `settings: { ...dto.settings },`
  - 상세: 이번 변경의 핵심은 `validateManualTrigger`에 `INVALID_TRIGGER_PARAMETERS` 검증을 추가하는 것(plan 항목 ②)인데, 같은 파일 상단(288행 인근)의 `settings` 필드 타입 단언(`as Record<string, unknown>`) 제거는 트리거 파라미터 검증과 무관한 별도의 정리성 변경이다. 동작 차이는 없어 보이나(런타임 영향 없는 순수 타입 레벨 변경), 의도된 변경 범위를 벗어난 드라이브바이 클린업이다.
  - 제안: 별도 변경이 필요하다면 별도 커밋/PR로 분리. 지금 범위 안에 남긴다면 plan 문서에 명시하거나 되돌려 diff 를 최소화.

- **[INFO]** `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 주석 대폭 확장
  - 위치: 2067행 부근(1차 재진입 지점), 2414행·3196행(2·3차 재진입 지점)
  - 상세: 각 재진입 지점마다 근본 원인·수정 이유를 설명하는 장문 주석이 추가됐다. 코드 변경 자체(`input: {}` → `input: savedExecution.inputData ?? {}`)와 직결된 설명이라 "불필요한 주석"으로 보기는 어렵고, 오히려 durable 컬럼 재사용이라는 비직관적 수정의 근거를 남긴 것이라 scope 위반으로 판단하지 않음(참고용으로만 기재).

## 점검 관점별 요약

1. **의도 이상의 변경**: 대체로 plan 체크리스트(①~③, (a)(b)(c))와 1:1 대응. 위 두 건(schedule-runner 포맷팅, workflows.service.ts 타입단언 제거)만 plan 범위 밖.
2. **불필요한 리팩토링**: `trigger-configs.tsx` 의 `parameters.map` 블록이 화살표 함수 암묵 반환에서 `{ ... return (...) }` 블록 형태로 바뀐 것은 인라인 에러 표시(`nameErr`)를 넣기 위한 불가피한 구조 변경으로, 기능 추가에 종속적 — 별도 리팩토링으로 보지 않음.
3. **기능 확장**: 프론트 파라미터 이름 검증(빈 값/식별자 규칙/중복)은 plan 의 hardening ③ 항목에 정확히 대응하며 백엔드 `validateTriggerParameterSchema` 규칙의 미러링이라 over-engineering 아님.
4. **무관한 수정**: 위 WARNING/INFO 두 건 외에는 발견되지 않음. 나머지 파일(신규 e2e/unit 테스트, i18n 키 추가, plan 문서)은 모두 이번 수정과 직접 연결됨.
5. **포맷팅 변경**: `schedule-runner.service.spec.ts` 건이 유일하게 실질 변경 없이 순수 포맷팅만 존재.
6. **주석 변경**: execution-engine.service.ts 의 주석 확장은 코드 변경 근거 설명으로 적절, 위반 아님.
7. **임포트 변경**: `workflows.service.ts` 의 `validateTriggerParameterSchema`/`toTriggerParameterErrorDetails` 임포트, `trigger-configs.tsx` 의 `cn` 임포트 모두 실제 사용되며 hardening 로직에 직결. 불필요한 임포트 없음.
8. **설정 변경**: 설정 파일(tsconfig, package.json, eslint 등) 변경 없음.

## 요약

리뷰 대상 14개 파일 중 12개는 plan 문서에 기술된 3지점 방어 수정(엔진 재진입 input, 트리거 조회 by type, 프론트 config 즉시 커밋)과 hardening(저장 시 검증, 프론트 이름 검증) 및 그에 대응하는 테스트/i18n/plan 문서로 범위가 명확히 일치한다. 다만 `schedule-runner.service.spec.ts` 에 남은 순수 포맷팅 전용 diff 1건과 `workflows.service.ts` 의 무관한 타입 단언 제거 1건은 이번 작업 의도와 무관하며, 둘 다 기능적 위험은 없으나 diff noise 로 리뷰 부담을 늘리므로 정리를 권장한다.

## 위험도

LOW
