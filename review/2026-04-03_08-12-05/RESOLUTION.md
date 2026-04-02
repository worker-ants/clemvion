# Code Review Resolution

## 조치 완료 (WARNING)

| # | 발견사항 | 조치 내용 |
|---|----------|-----------|
| W1 | `useStore` 내부 API 직접 접근 | `useViewport()`는 매 pan/zoom마다 리렌더를 발생시키므로 성능상 `useStore`를 유지. 대신 selector를 모듈 레벨 상수(`zoomSelector`)로 분리하고 동작 의도를 주석으로 명시 |
| W4 | 헤더 요약에 Tooltip 누락 | 컨테이너 노드 헤더 요약(`showHeaderSummary`)에도 `Tooltip` + `TooltipContent` 적용 |
| W5 | `carouselSummary` dynamic 모드 미검증 | 스펙 확인 결과 `titleField`는 dynamic 모드에서 선택적 필드. layout만 표시하는 것이 정상. 테스트 추가로 경로 검증 |
| W6 | `LANG_DISPLAY` 매 호출 힙 재할당 | 모듈 최상단 상수로 이동하고 `TypeScript`, `Python`, `SQL` 추가 등록 |
| W7 | 컨테이너 헤더/바디 DOM 위치 검증 없음 | `.rounded-t-lg` 선택자로 헤더 영역 내 텍스트 존재 여부 검증, `<p>` vs `<span>` 태그로 바디/헤더 구분 검증 추가 |
| W8 | `isTruncated` 조건부 `TooltipContent` 미검증 | 40자 초과(장문 URL) 케이스에서 `tooltip-content` testid 존재 확인, 단문에서는 미존재 확인하는 테스트 추가 |
| W9 | `useExecutionStore` 항상 null — 실행 상태 미검증 | `mockNodeStatus` 변수 도입하여 `running`/`completed`/`failed`/`skipped` 4개 상태별 UI 렌더링 테스트 추가 |
| W10 | `merge` 부분 설정 시나리오 미테스트 | `inputCount`만 / `strategy`만 제공 시 `NOT_CONFIGURED` 반환 테스트 추가 |

## 조치 완료 (INFO)

| # | 발견사항 | 조치 내용 |
|---|----------|-----------|
| I1 | `title` 속성과 TooltipContent 중복 | `<p>` 태그의 `title` 속성 제거 |
| I2 | `LANG_DISPLAY`에 JS만 등록 | `TypeScript`, `Python`, `SQL` 추가 + 테스트 케이스 추가 |
| I8 | `as` 캐스팅 타입 검증 부재 | 배열 필드에 `Array.isArray()` 검사 추가, 숫자 필드에 `typeof` 검사 추가 |
| I9 | `FORMATTERS` 프로토타입 키 주입 | `Object.hasOwn(FORMATTERS, nodeType)` 검사 추가 |
| I10 | `WARNING` 싱글톤 변경 가능성 | `Object.freeze(WARNING)` 적용 + `return { ...WARNING }` 으로 복사본 반환 |
| I13 | `useMemo` 의존성 최적화 | React Compiler 규칙과 호환되도록 `[summary]`로 설정 |
| I15 | `statusStyles` IIFE 매 렌더 실행 | `useMemo(() => { ... }, [nodeStatus])` 래핑 |
| I16 | `tableSummary` pagination 기본값 미테스트 | pagination undefined 케이스 테스트 추가 |
| I17 | `carouselSummary` dynamic+titleField 없음 미테스트 | 해당 코드 경로 테스트 추가 |
| I18 | `codeSummary` 비JS 언어 미테스트 | `typescript`, `python`, `ruby` 테스트 추가 |
| I19 | `pdfSummary` 기본값 적용 미검증 | 필드 미설정 시 기본값 출력 테스트 추가 |
| I20 | `isDisabled`/`selected` 상태 미테스트 | `opacity-50`, `ring` 클래스 검증 테스트 추가 |

## 미조치 (수용 가능한 위험)

| # | 발견사항 | 사유 |
|---|----------|------|
| W2 | `tableSummary` pagination 기본값 | 스펙의 기본값이 `true`이므로 `undefined`를 `true`로 취급하는 현재 동작이 정확함. 주석으로 명시 |
| W3 | `TooltipProvider` 암묵적 컨텍스트 | `CustomNode`는 `WorkflowCanvas` 내부에서만 사용됨. Storybook 등 독립 렌더링 시에는 해당 환경에서 Provider를 감싸면 됨 |
| I4 | `TooltipProvider` 중첩 가능성 | 앱 루트에 별도 Provider 없음 확인 |
| I6/I7 | URL/SQL 캔버스 노출 | 스펙에 명시된 요약 포맷이며, 에디터는 인증된 사용자만 접근 |
| I14 | `split("\n")` 성능 | 요약은 `useMemo`로 캐싱되어 호출 빈도가 낮음. 마이크로 최적화 불필요 |
| I21 | `mockZoom` 뮤터블 변수 | vitest는 파일 단위 격리 실행이며 concurrent 전환 시 리팩토링 가능 |
| I22 | 노드 유효성 로직 이중 소스 | 현재 23개 노드 규모에서는 관리 가능. 노드 수 증가 시 `NodeDefinition`에 통합 검토 |
| I23 | `manual_trigger` 명시적 가드 중복 | 가독성을 위해 의도적으로 분리 유지 |
| I24 | 25개 formatter 단일 파일 | 현재 규모에서는 파일 분리보다 단일 파일이 탐색 용이 |
