### 발견사항

- **[WARNING]** `tableSummary`에서 `pagination`이 `undefined`일 때 무조건 "pagination" 표시
  - 위치: `node-config-summary.ts` - `tableSummary` 함수
  - 상세: `if (pagination === false)` 조건으로 인해 `pagination`이 `undefined`(미설정)인 경우에도 "N columns · pagination"을 표시함. 실제로 페이지네이션이 비활성화된 상태일 수 있음에도 사용자에게 잘못된 설정 요약을 제공할 수 있음. 테스트도 `undefined` 케이스를 다루지 않음.
  - 제안: `if (!pagination)` 또는 `if (pagination !== true)`로 변경하거나, 기본값이 페이지네이션 활성화임을 스펙에서 명확히 한 후 그에 맞게 처리

- **[WARNING]** 컨테이너 노드 헤더 요약에 툴팁 없음
  - 위치: `custom-node.tsx:83-87` (showHeaderSummary 렌더링 블록)
  - 상세: 헤더의 요약 텍스트는 `maxWidth: "60px"` 제한으로 CSS 잘림(`truncate`)이 발생하지만 `Tooltip`이 없어 전체 텍스트를 볼 방법이 없음. 반면 바디 요약(`showBodySummary`)은 `isTruncated`일 때 `TooltipContent`를 제공함.
  - 제안: 헤더 요약에도 `Tooltip` + `TooltipContent`를 감싸거나, `truncateSummary`를 더 짧은 `maxLen`으로 별도 호출하여 헤더에 적합한 길이로 제한

- **[WARNING]** `carouselSummary` 동적 모드에서 `titleField` 미설정 시 경고 없음
  - 위치: `node-config-summary.ts` - `carouselSummary` 함수
  - 상세: `mode`가 `"dynamic"`이고 `titleField`가 없으면 `{ text: layout, isWarning: false }`를 반환. `titleField`가 동적 모드의 필수 설정이라면 `WARNING`을 반환해야 하며, 테스트도 이 케이스를 다루지 않음.
  - 제안: 스펙에 따라 동적 모드에서 `titleField`가 필수라면 `if (!titleField) return null` 추가

- **[INFO]** `codeSummary`의 `LANG_DISPLAY` 매핑 불완전
  - 위치: `node-config-summary.ts` - `codeSummary` 함수
  - 상세: `javascript` → `JavaScript`만 매핑됨. `python`, `typescript`, `sql`, `go` 등 다른 언어는 `language.charAt(0).toUpperCase() + language.slice(1)` 폴백 사용. 예: `sql` → `Sql`, `typescript` → `Typescript`로 표시되어 어색함.
  - 제안: 주요 언어 표기를 `LANG_DISPLAY`에 추가 (예: `typescript: "TypeScript"`, `python: "Python"`, `sql: "SQL"`)

- **[INFO]** ReactFlow 내부 API 직접 의존
  - 위치: `custom-node.tsx:35` - `useStore((s) => s.transform[2] >= 0.5)`
  - 상세: `s.transform[2]`는 ReactFlow의 문서화되지 않은 내부 상태 구조. 향후 ReactFlow 버전 업그레이드 시 `transform` 배열 형식이 변경되면 줌 감지 기능이 무음으로 깨질 수 있음.
  - 제안: ReactFlow가 공식 API를 제공한다면 그쪽을 사용. 그렇지 않다면 상수 주석으로 명시: `// transform: [panX, panY, zoom]`

- **[INFO]** `Tooltip`이 `TooltipContent` 없이 렌더링되는 경우 존재
  - 위치: `custom-node.tsx:125-151`
  - 상세: `isTruncated`가 `false`이면 `<Tooltip>` + `<TooltipTrigger>`만 렌더링되고 `<TooltipContent>`가 없음. Radix UI는 이를 에러 없이 처리하지만, 비표준 사용 패턴이며 미래 버전에서 경고가 발생할 수 있음.
  - 제안: `showBodySummary && isTruncated` 조건으로만 `Tooltip`을 감싸거나, 항상 `TooltipContent`를 포함시키되 `isTruncated`에 따라 내용 제어

- **[INFO]** 테스트 커버리지 누락
  - 위치: `node-config-summary.test.ts`
  - 상세: ① `tableSummary` - `pagination: undefined` 케이스 미검증 ② `carouselSummary` - 동적 모드 + `titleField` 없는 케이스 미검증 ③ `codeSummary` - `javascript` 외 언어 케이스 없음 ④ `custom-node.test.tsx` - 헤더 요약 툴팁 부재 검증 없음

---

### 요약

전반적으로 구현은 요구사항을 잘 반영하고 있으며, 25개 노드 타입에 대한 포매터 등록, 줌 기반 요약 표시/숨김, 컨테이너/일반 노드 구분 로직이 일관성 있게 구현되어 있다. 다만 `tableSummary`의 `pagination: undefined` 처리 오류가 사용자에게 잘못된 설정 상태를 표시할 수 있어 실사용에 영향을 줄 수 있고, 컨테이너 노드 헤더의 요약 텍스트가 잘렸을 때 전체 내용을 확인할 방법이 없다는 UX 문제가 존재한다. 나머지는 코드 품질 및 유지보수성 관점의 개선 사항 수준이다.

### 위험도

**MEDIUM**