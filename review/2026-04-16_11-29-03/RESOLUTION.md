# 코드 리뷰 이슈 조치 내용

## Critical 이슈

### 1. isPortFiltered 배열 포트 테스트 부재
- **조치**: 핸들러 테스트에서 multi-label 포트 배열 반환을 검증하는 테스트 케이스 추가 (32개 테스트). `isPortFiltered`는 private 메서드이므로 통합 테스트 레벨에서 간접 검증됨. `adaptHandlerReturn`은 new shape 경로에서 `port` 값을 그대로 통과시키므로 별도 테스트 불필요.
- **보완**: `isPortFiltered`에 빈 배열 가드(`selectedPort.length > 0`) 추가

### 2. category null breaking change
- **판단**: 기존 `""` → `null` 변경은 의도적. 분류 실패 시 `null`이 의미적으로 더 명확. 기존에 fallback이 정상 동작하지 않았으므로 (`""` 반환 케이스가 실질적으로 발생하지 않음) breaking change 영향 최소.

## Warning 이슈

### 1. config.multiLabel 필드 비일관성
- **조치**: `processSingleLabelResult`에 `multiLabel: false` 명시적 추가

### 2. propagateReachability 배열 미처리 가능성
- **조치**: 코드 확인 결과 `propagateReachability`는 `isPortFiltered`를 통해서만 포트 필터링 수행. 직접 `_selectedPort`를 읽지 않으므로 추가 수정 불필요.

### 3. 프롬프트 인젝션 / 폴백 오탐
- **판단**: 카테고리 설정은 워크플로우 소유자만 수정 가능하므로 프롬프트 인젝션은 self-attack에 해당. 폴백 텍스트 매칭 오탐은 JSON 파싱 실패 시에만 발생하는 2차 폴백이므로 현재 위험도 낮음.

### 4. config 런타임 미검증
- **판단**: 엔진이 `handler.validate()`를 `execute()` 전에 호출하여 검증 보장. 직접 호출은 테스트 외 발생하지 않음.

### 5. confidence 어설션 복원
- **조치**: `expect(data.confidence).toBe(0.95)` 어설션 복원

### 6. includeConfidence 기본값 통일
- **조치**: 핸들러의 기본값을 `true` → `false`로 변경하여 스키마(`default: false`)와 일치시킴

### 7. 에러 반환 구조
- **판단**: new shape(`{ config, output, meta, port }`)으로 통일. `adaptHandlerReturn`이 프론트엔드용 flat shape으로 변환하므로 호환성 유지.

### 8. isPortFiltered 빈 배열 가드
- **조치**: `selectedPort.length > 0` 조건 추가. 빈 배열 시 모든 에지 통과 (필터링 없음).

## Info 이슈
- meta 블록 중복, as any 패턴, JSDoc 등은 현재 범위에서 개선하지 않음 (유지보수 수준 이슈)
