# Code Review Resolution

## CRITICAL 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `resolveString()` 혼합 표현식 타입 미보장 | mixed 분기에서 `typeof result === 'string' ? result : String(result ?? '')` 강제 변환 추가. `evaluate()`가 이미 mixed template을 string으로 보간하지만, 방어적 타입 강제로 스펙 보장 |

## WARNING 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `$execution.mode` 하드코딩 | `buildExpressionContext()`에 `executionMeta` 옵셔널 파라미터 추가, `executeNode()`에서 `savedExecution` 메타 전달. 현재 Phase 1에서 triggerType 미구현이므로 fallback 'manual' 유지 |
| 2 | `$execution.startedAt` 해석 시점 사용 | `buildExpressionContext()`에 `executionMeta.startedAt` 전달, `savedExecution.startedAt` 실제 시작 시각 사용. `$now`/`$today`도 메서드 상단 `const now = new Date()` 한 번만 호출 |
| 3 | MAX_DEPTH 초과 시 미해석 데이터 노출 | `this.logger.warn()` 추가로 추적 가능하게 처리. 실제 config 구조가 10단계를 초과할 가능성 극히 낮으므로 에러 throw 대신 경고 로그 선택 |
| 4 | 에러 메시지에 config 원본값 노출 | `(template: "${value}")` 부분 제거 |
| 5 | multiline 하이라이트 비활성화 | `!multiline` 조건 제거, textarea에도 하이라이트 오버레이 적용 (py-2 스타일링 추가) |
| 6 | `validate()` 이중 래핑 | `EXPR_BLOCK_RE`를 캡처 그룹 없이 전체 `{{ }}` 블록을 매치하도록 변경, 캡처 후 재래핑 제거 |
| 7 | `selectedIndex` 리셋 안 됨 | `handleInput`에서 `setSelectedIndex(0)` 호출 추가 |
| 8 | `getExpressionToken()` 경계값 | `i > 0 &&` 가드 조건 추가로 `value[-1]` 접근 방지 |
| 9 | `--webpack` 빌드 플래그 | Turbopack이 symlinked 로컬 패키지를 해석 못하는 알려진 제한. `next.config.ts`에 사유 주석 추가 |

## INFO 이슈

| # | 이슈 | 조치 |
|---|------|------|
| 1 | Logger 미사용 | MAX_DEPTH 경고에서 logger 활용하도록 변경 |
| 3 | `$now`/`$today` 미세 시각 차이 | `const now = new Date()` 한 번만 호출 후 재사용 |
| 4 | `getAllFunctionNames()` 불필요 재계산 | 모듈 최상단 상수 `FUNCTION_NAMES`로 추출 |
| 9 | mixed-text 타입 assertion 테스트 누락 | `'coerces mixed text + expression to string'` 테스트 추가 |

나머지 INFO 이슈(테스트 보강, 성능 최적화, 문서 등)는 Phase 2 개선 사항으로 이관.
