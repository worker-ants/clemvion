# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 요구사항 불일치(pagination 기본값, 헤더 툴팁 누락)와 핵심 동작 테스트 공백이 복합적으로 존재하며, 내부 API 직접 의존 등 잠재적 런타임 위험도 포함됨

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성 / 아키텍처 | `useStore((s) => s.transform[2] >= 0.5)` — ReactFlow 비공개 내부 API 직접 접근. 버전 업그레이드 시 무음 버그 발생 가능 | `custom-node.tsx:35` | 공식 훅 `useViewport()`로 교체: `const { zoom } = useViewport(); const showSummary = zoom >= 0.5;` |
| 2 | 요구사항 | `tableSummary`에서 `pagination === false`만 체크하여 미설정(`undefined`) 상태도 "pagination" 텍스트 표시 → 실제 비활성 상태를 잘못 표현 가능 | `node-config-summary.ts` — `tableSummary()` | `if (!pagination)` 또는 `if (pagination !== true)`로 변경하거나, 스펙의 기본값이 활성화임을 명시 |
| 3 | 아키텍처 / 부작용 | `CustomNode`가 `TooltipProvider` 컨텍스트를 암묵적으로 요구 — `WorkflowCanvas` 외부 렌더링(프리뷰, Storybook 등) 시 Tooltip 무음 실패 | `custom-node.tsx` import / `workflow-canvas.tsx:368,544` | `CustomNode` 내부에 `TooltipProvider` 포함하거나, Props 타입 레벨에서 컨텍스트 요구사항 명시 |
| 4 | 요구사항 / UX | 컨테이너 노드 헤더 요약(`showHeaderSummary`)에 Tooltip 없음 — `maxWidth: 60px` 잘림 발생 시 전체 텍스트 확인 불가 | `custom-node.tsx:83-87` | 헤더 요약에도 `Tooltip` + `TooltipContent` 감싸기, 또는 `maxLen`을 단축하여 잘림 최소화 |
| 5 | 요구사항 | `carouselSummary` — dynamic 모드에서 `titleField` 미설정 시 WARNING 반환 없이 layout 텍스트만 반환 (필수 필드 미검증) | `node-config-summary.ts` — `carouselSummary()` | 스펙 확인 후 `titleField`가 필수라면 `if (!titleField) return null` 추가 |
| 6 | 성능 | `LANG_DISPLAY` 객체가 `codeSummary` 함수 내부에 선언되어 매 호출마다 힙 재할당 | `node-config-summary.ts` — `codeSummary()` | 모듈 최상단 상수로 이동 (다른 `OPERATOR_DISPLAY` 등과 동일 패턴 적용) |
| 7 | 테스트 | 컨테이너 노드 헤더/바디 렌더링 위치 검증 없음 — 텍스트 존재만 확인, DOM 실제 위치 미검증 | `custom-node.test.tsx` — "renders container node summary in header" | `container.querySelector`로 헤더/바디 요소에서 텍스트 존재 여부 각각 검증 |
| 8 | 테스트 | `isTruncated` 조건부 `TooltipContent` 렌더링 미검증 — Tooltip 전체 mock으로 조건 분기 테스트 불가 | `custom-node.test.tsx` — Tooltip mock / `custom-node.tsx:139` | 40자 초과/이하 텍스트 케이스로 `TooltipContent` 렌더링 여부 각각 검증 |
| 9 | 테스트 | `useExecutionStore`가 항상 `null` 반환 — `running`/`completed`/`failed`/`skipped` 상태 UI(ring, 아이콘) 전혀 미검증 | `custom-node.test.tsx` — `useExecutionStore` mock | selector를 존중하는 mock으로 교체 후 각 실행 상태별 렌더 테스트 추가 |
| 10 | 테스트 | `merge` 부분 설정 시나리오 미테스트 — `inputCount`만 또는 `strategy`만 있는 실제 부분 설정 → WARNING 반환 미검증 | `node-config-summary.test.ts` — merge describe 블록 | `inputCount`만 / `strategy`만 제공 시 NOT_CONFIGURED 반환 테스트 각각 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 중복 렌더링 | `<p>` 요소에 네이티브 `title` 속성과 Radix `TooltipContent` 동시 존재 → 브라우저 기본 툴팁과 커스텀 툴팁 이중 표시 | `custom-node.tsx:131` | `title` 속성 제거 (TooltipContent로 충분) |
| 2 | 코드 품질 | `codeSummary` `LANG_DISPLAY`에 `javascript`만 등록 — `typescript`, `python`, `sql` 등은 부자연스러운 폴백 표기(`Sql`, `Typescript`) | `node-config-summary.ts` — `codeSummary()` | 주요 언어 (`typescript: "TypeScript"`, `python: "Python"`, `sql: "SQL"`) 추가 등록 |
| 3 | 가독성 | `showHeaderSummary` / `showBodySummary` 조건식이 복잡하고 의도 파악이 어려움 | `custom-node.tsx:62-64` | `isWarning` 중간 변수 추출로 분기 의도 명확화 |
| 4 | 의존성 | `TooltipProvider` 중첩 가능성 — 상위 레이아웃에 이미 Provider가 있으면 `delayDuration` 등 설정 충돌 | `workflow-canvas.tsx:368,544` | 앱 루트 `layout.tsx`에 Provider 존재 여부 확인 후 중복 제거 |
| 5 | 의존성 | `@radix-ui/react-tooltip`이 `package.json`에 명시되었는지 확인 필요 | `tooltip.tsx` 전체 | `package.json` 확인 및 누락 시 추가 |
| 6 | 보안 | HTTP URL (`config.url`) 그대로 캔버스에 노출 — 쿼리스트링에 API 키 등 민감 정보 포함 가능 | `node-config-summary.ts` — `httpRequestSummary()` | `new URL(url).origin + pathname` 형태로 쿼리스트링 제거 후 표시 |
| 7 | 보안 | SQL 쿼리 첫 줄 캔버스 노출 — 테이블 구조 등 정보 유출 가능 | `node-config-summary.ts` — `databaseQuerySummary()` | 쿼리 타입과 줄 수만 표시(`SELECT · 4 lines`) |
| 8 | 보안 | 런타임 타입 검증 없는 `as` 캐스팅 광범위 사용 — 외부 파일 로드 시 예기치 않은 타입 주입 가능 | `node-config-summary.ts` — 전체 formatter | 배열 필드는 `Array.isArray()` 검사, 숫자 필드는 `typeof` 검사 추가 |
| 9 | 보안 | `FORMATTERS[nodeType]` 조회 시 `__proto__`, `constructor` 등 프로토타입 키 주입 가능성 | `node-config-summary.ts` — `getConfigSummary()` | `Object.hasOwn(FORMATTERS, nodeType)` 검사 추가 |
| 10 | 부작용 | `WARNING` 싱글톤 참조 반환 — 호출자가 반환값 직접 변경 시 이후 모든 호출 오염 | `node-config-summary.ts:27` | `return { ...WARNING }` 또는 `Object.freeze(WARNING)` 적용 |
| 11 | 문서화 | `getConfigSummary` / `truncateSummary` 공개 함수에 JSDoc 없음 — `null` vs `WARNING` 반환 의미 차이 불명확 | `node-config-summary.ts` | JSDoc으로 반환값 의미(`null`: 요약 없음, `WARNING`: 미설정 경고) 명시 |
| 12 | 문서화 | 줌 임계값 `0.5` 매직 넘버 및 `transform[2]` 의미 미문서화 | `custom-node.tsx:35` | 인라인 주석: `// transform[2] is the zoom scale; hide summary below 50% zoom` |
| 13 | 성능 | `summary?.text` 대신 `summary` 객체 참조를 두 번째 `useMemo` 의존성으로 사용 — 내용이 같아도 새 참조면 재실행 | `custom-node.tsx:38-43` | 의존성을 `[summary?.text]`로 변경 |
| 14 | 성능 | `split("\n")` 으로 배열 생성 후 `.length` / `[0]` 만 사용 — 불필요한 메모리 할당 | `node-config-summary.ts` — `codeSummary`, `templateSummary`, `databaseQuerySummary` | `(code.match(/\n/g)?.length ?? 0) + 1` / `query.slice(0, query.indexOf("\n"))` 패턴 사용 |
| 15 | 성능 | `statusStyles` IIFE가 매 렌더마다 실행, `useMemo` 미적용 | `custom-node.tsx:45-57` | `useMemo(() => { ... }, [nodeStatus])` 래핑 |
| 16 | 테스트 | `tableSummary` `pagination: undefined` 기본 동작 테스트 없음 | `node-config-summary.test.ts` | `pagination` 미설정 케이스 명시적 테스트 추가 |
| 17 | 테스트 | `carouselSummary` dynamic + `titleField` 없는 케이스 미테스트 | `node-config-summary.test.ts` | 해당 코드 경로 테스트 추가 |
| 18 | 테스트 | `codeSummary` 비JavaScript 언어 fallback 미테스트 | `node-config-summary.test.ts` | `python`, `typescript` 등 언어 케이스 테스트 추가 |
| 19 | 테스트 | `pdfSummary` 기본값(`A4`, `portrait`, `document.pdf`) 적용 로직 미검증 | `node-config-summary.test.ts` | 필드 미설정 시 기본값 출력 테스트 추가 |
| 20 | 테스트 | `isDisabled` / `selected` 노드 상태 렌더링(`opacity-50`, ring 클래스) 미테스트 | `custom-node.test.tsx` | 각 상태 조합 렌더 테스트 추가 |
| 21 | 테스트 | 모듈 스코프 `mockZoom` 뮤터블 변수 — concurrent 테스트 전환 시 상태 오염 가능 | `custom-node.test.tsx:5` | `vi.mocked` + `mockReturnValueOnce` 패턴으로 교체 권장 |
| 22 | 아키텍처 | 노드 설정 유효성 기준이 `node-definitions`와 `node-config-summary` 두 곳에 분산 — 동기화 drift 위험 | `node-config-summary.ts` 전체 formatter | 노드 정의에 `requiredFields` 또는 `validate(config)` 추가 후 `getConfigSummary`에서 참조 |
| 23 | 아키텍처 | `manual_trigger` 명시적 가드와 `!formatter` 가드 중복 | `node-config-summary.ts` — `getConfigSummary()` | `NO_SUMMARY_NODES = new Set(["manual_trigger"])` 분리 또는 레지스트리 가드로 통합 후 주석 명시 |
| 24 | 아키텍처 | 25개 formatter가 단일 파일에 선형 나열 — 노드 타입 증가 시 확장성 한계 | `node-config-summary.ts` 전체 | 도메인별(logic, integration, ui, ai) 파일 분리 후 레지스트리 조립만 현재 파일에 유지 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `tableSummary` pagination 기본값 오류, 헤더 요약 툴팁 누락, carousel 동적 모드 미검증 |
| testing | MEDIUM | 헤더/바디 위치 검증 미흡, Tooltip 조건부 렌더링 미검증, 실행 상태 테스트 전무 |
| dependency | LOW | `useStore` 내부 API 직접 접근, `@radix-ui/react-tooltip` package.json 확인 필요 |
| performance | LOW | `LANG_DISPLAY` 매 호출 재생성, `useMemo` 의존성 최적화 여지 |
| security | LOW | URL/SQL 내용 노출, `as` 캐스팅 타입 검증 부재, 프로토타입 주입 가능성 |
| architecture | LOW | `TooltipProvider` 암묵적 컨텍스트 계약, 노드 유효성 로직 이중 소스 |
| side_effect | LOW | `useStore` 컨텍스트 의존성, `tableSummary` pagination 모호성, `WARNING` 싱글톤 변경 가능성 |
| maintainability | LOW | `LANG_DISPLAY` 위치, 인라인 style 혼용, 조건식 가독성, `TooltipProvider` 들여쓰기 |
| concurrency | LOW | 테스트 `mockZoom` 뮤터블 변수 (현재 환경 무해, concurrent 전환 시 잠재적 위험) |
| documentation | LOW | 공개 함수 JSDoc 부재, 줌 임계값 매직 넘버, `LANG_DISPLAY` 설계 의도 미문서화 |
| scope | LOW | `title` + Tooltip 중복, `codeSummary` 언어 매핑 불완전 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| database | 변경사항 전체가 프론트엔드 UI 레이어로, 데이터베이스 관련 코드 없음 |
| api_contract | 순수 프론트엔드 UI 변경으로 HTTP API/서버 인터페이스 영향 없음 |

---

## 권장 조치사항

1. **`useViewport()` 교체** — `useStore((s) => s.transform[2])` 를 `@xyflow/react`의 공식 훅으로 교체하여 내부 API 의존 제거 (Breaking 가능성 방지)
2. **헤더 요약 Tooltip 추가** — 컨테이너 노드 헤더의 `showHeaderSummary` 렌더링 블록에 `Tooltip` + `TooltipContent` 적용
3. **`tableSummary` pagination 조건 수정** — `pagination === false` → `!pagination` 또는 스펙 기본값과 일치하도록 수정하고 테스트 추가
4. **핵심 테스트 공백 해소** — 헤더/바디 DOM 위치 검증, `isTruncated` Tooltip 조건부 렌더링, 실행 상태(`running`/`failed` 등) UI 테스트 작성
5. **`merge` 부분 설정 테스트 추가** — `inputCount`만 / `strategy`만 있는 케이스 WARNING 반환 검증
6. **`LANG_DISPLAY` 모듈 상수로 이동** — 함수 내부 → 모듈 최상단 이동 및 주요 언어 등록 (`TypeScript`, `Python`, `SQL`)
7. **`<p>` `title` 속성 제거** — Radix `TooltipContent`와 중복되는 브라우저 기본 툴팁 제거
8. **`WARNING` 싱글톤 보호** — `Object.freeze(WARNING)` 또는 `return { ...WARNING }` 적용
9. **URL/SQL 노출 범위 축소** — `httpRequestSummary`에서 쿼리스트링 제거, `databaseQuerySummary`에서 쿼리 타입+줄 수만 표시
10. **`TooltipProvider` 위치 정리** — 앱 루트 `layout.tsx` 중복 여부 확인 후 단일 위치에서만 선언