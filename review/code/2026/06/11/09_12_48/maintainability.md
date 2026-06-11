# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`

- **[INFO]** 주석 품질 개선 — 배너 렌더 조건 근거 명시
  - 위치: 라인 616–618 (변경된 JSX 주석 블록)
  - 상세: 기존 단일 라인 주석을 멀티라인으로 확장해 배너(`kb.reembedStatus`)와 진행 박스(`embeddingStats.reembedStatus`)가 의도적으로 다른 출처를 바라본다는 사실을 명시했다. 이는 나중에 읽는 개발자가 "출처가 왜 두 곳인가?"라는 질문을 코드에서 바로 해소할 수 있게 한다.
  - 제안: 변경 자체는 양호하다. 추가로 해당 주석이 길어졌으므로, 향후 이 패턴이 더 많은 곳에서 쓰인다면 컴포넌트 JSDoc 으로 격상하는 것을 고려할 수 있다.

- **[WARNING]** 컴포넌트 함수 길이 — 단일 파일에 ~1050 라인, 함수 본체만 약 500 라인
  - 위치: `KnowledgeBaseDetailPage` 함수 전체 (라인 153–1048)
  - 상세: 이 변경과 직접 관련된 코드는 소규모이나, 컴포넌트 자체가 state 선언 18개, mutation 7개, 쿼리 5개, 폼 유효성 검사 로직, 드래그 핸들러, 대용량 JSX를 모두 담고 있다. 이는 SRP(단일 책임 원칙) 위반이며 테스트와 수정 범위 파악을 어렵게 한다. 이번 diff 가 직접 이 문제를 악화시킨 것은 아니지만, 배너 렌더 조건 설명이 길어진 것은 컴포넌트 내부 복잡도가 높기 때문에 주석으로 보완해야 했다는 방증이다.
  - 제안: `handleSaveSettings` 유효성 검사 로직, embedding/graph 진행 박스, documents 테이블 패널을 별도 훅/컴포넌트로 추출하는 단계적 리팩터링을 권장한다.

- **[INFO]** 중복 폴링 패턴 — `refetchInterval` 콜백의 구조 반복
  - 위치: 라인 200–210 (`docsData` 쿼리), 라인 244–252 (`graphStats` 쿼리), 라인 259–265 (`embeddingStats` 쿼리)
  - 상세: 세 쿼리 모두 `stillProcessing ? 짧은_간격 : 긴_간격` 패턴을 거의 동일하게 구현한다. 로직 자체는 단순하지만 각 변수·임계값이 조금씩 달라 변경 시 세 곳을 동시에 수정해야 한다.
  - 제안: `makePollingInterval(isStillProcessing: boolean, fast = 5_000, slow = 60_000)` 같은 유틸 헬퍼를 추출하면 중복 제거와 의도 명확화를 동시에 달성할 수 있다.

- **[INFO]** 매직 넘버 산재
  - 위치: 라인 149 (`1024`, `1024 * 1024`), 라인 209 (`10_000`, `120_000`), 라인 250 (`5_000`, `60_000`), 라인 264 (`5_000`, `60_000`), 라인 394 (`50`), 라인 427–439 (1, 2, 1, 50, 1, 100)
  - 상세: 파일 크기 변환 상수, 폴링 인터벌, 폼 필드 범위값 등이 리터럴로 흩어져 있다. 이번 diff 가 직접 추가한 것은 아니나 파일 전체 맥락 상 지속적으로 누적되고 있다.
  - 제안: 도메인 관련 상수(`CHUNK_SIZE_MIN`, `CHUNK_SIZE_MAX`, `POLLING_INTERVAL_FAST` 등)를 파일 상단 또는 전용 `constants.ts`로 추출한다.

- **[INFO]** IIFE로 감싼 탭 패널 분기
  - 위치: 라인 852–1045 (`{(() => { ... })()}`)
  - 상세: 탭 유무에 따라 `documentsPanel`을 조건부로 반환하기 위해 IIFE를 사용했다. 가독성이 약간 낮고 실수로 중첩이 깊어질 위험이 있다.
  - 제안: `<DocumentsOrTabsPanel>` 컴포넌트로 분리하거나, 간단하게는 `const panel = isGraphMode ? <Tabs>...</Tabs> : documentsPanel` 형태로 변수에 할당한다.

---

### 파일 2: `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`

- **[INFO]** `it.each` 활용으로 테스트 중복 제거
  - 위치: 라인 87–88 (diff), 라인 1186–1197 (전체 파일)
  - 상세: 기존에 `admin` 한 케이스만 단독 테스트하던 것을 `it.each(["admin", "owner"])` 로 확장하여 두 역할을 한 번에 검증한다. 테스트 코드 중복을 줄이고 새 역할이 추가될 때 배열만 확장하면 되도록 구성된 좋은 패턴이다.
  - 제안: 특별한 문제 없음.

- **[INFO]** `beforeEach` 내 `cleanup()` 명시 호출
  - 위치: 라인 114–118
  - 상세: Vitest + `@testing-library/react` 환경에서 `cleanup`은 보통 자동 실행되지만 명시적으로 호출하는 것은 무해하다. 일관성 측면에서 프로젝트 내 다른 테스트 파일과 패턴이 다를 경우 혼란을 줄 수 있다.
  - 제안: 프로젝트 전반의 테스트 `cleanup` 관례를 통일한다.

---

### 파일 3: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`

- **[INFO]** `STATE_CONFIG` 테이블 패턴 도입 — 산탄총 수술 방지
  - 위치: 라인 1261–1290 (diff), 라인 1381–1410 (전체 파일)
  - 상세: `inProgress` 불리언 분기가 JSX 곳곳에 흩어지던 구조를 `Record<ReembedStatus, ...>` 설정 테이블로 집중시켰다. 새 상태가 추가될 때 테이블 한 곳만 수정하면 되고, TypeScript `Record` 키 완전성 검사로 누락을 컴파일 타임에 잡을 수 있다. 좋은 패턴이다.
  - 제안: 특별한 문제 없음.

- **[INFO]** `ReembedStatus` 도메인 타입 파생
  - 위치: 라인 1244–1245 (diff), 라인 1365–1366 (전체 파일)
  - 상세: `KnowledgeBaseData["reembedStatus"]` 에서 타입을 파생시켜 API 타입 변경 시 컴포넌트가 자동으로 영향을 받도록 했다. 타입 동기화 부담을 줄이는 좋은 관례다.
  - 제안: 특별한 문제 없음.

- **[INFO]** `cfg` 변수명 약어
  - 위치: 라인 1307–1308 (diff), 라인 1428–1429 (전체 파일)
  - 상세: `cfg`는 `config`의 흔한 약어로 이 컨텍스트에서 충분히 명확하다. 파일 내에서 일관되게 사용되므로 문제없음.
  - 제안: 문제 없음. 굳이 `stateConfig`로 바꿀 필요는 없다.

- **[INFO]** 미사용 `Loader2` import
  - 위치: 라인 1235 (diff), 라인 1358 (전체 파일)
  - 상세: `STATE_CONFIG.in_progress.icon`은 `Loader2`를 모듈 참조로 저장하며 런타임에 `Icon = cfg.icon`으로 동적으로 사용된다. 또한 CTA 버튼 내부에서도 `<Loader2>` JSX로 직접 사용된다(라인 1456). 따라서 미사용이 아니다.
  - 제안: 해당 없음.

---

## 요약

이번 변경의 핵심인 `unsearchable-banner.tsx` 리팩터링은 유지보수성 관점에서 우수하다. `STATE_CONFIG` 테이블로 상태별 분기를 중앙화하고, 도메인 타입에서 직접 파생한 `ReembedStatus`로 타입 동기화 부담을 없앴으며, `cn()` 유틸로 클래스 조합을 정리했다. 테스트에서 `it.each`를 통한 역할 커버리지 확장도 적절하다. `page.tsx` 주석 개선은 의도를 명확히 전달하나, 파일 자체는 함수 길이·중복 폴링 패턴·매직 넘버 등 사전에 존재하던 유지보수성 부채를 여전히 가지고 있다. 이번 diff가 그 부채를 악화시키지는 않았다.

## 위험도

LOW
