# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** abortSignal cascade 로직이 두 client 파일에 거의 동일하게 복제됨
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1218-1227`, `:1250-1256`, `:1261-1263` / `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:847-856`, `:875-881`, `:886-888`
  - 상세: upstream signal 리스너 설치(`if (upstream) { if (upstream.aborted) ... else { onUpstreamAbort = ...; addEventListener(...) } }`), catch 블록의 `AbortError` 재throw 분기, `finally` 의 `removeEventListener` 정리 — 이 세 블록이 두 client 에 라인 단위로 거의 동일하게 존재한다(에러 클래스명만 `Cafe24TransportFailedError`/`MakeshopTransportFailedError` 로 다름). 향후 이 cascade 에 결함이 생기면(예: 이번 라운드에서 실제로 발생했던 `finally` 위치 버그) 두 곳을 각각 고쳐야 하고 하나만 고치면 조용히 갈라진다.
  - 제안: 이미 해당 PR 의 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 와 `review/code/2026/07/25/21_02_33/RESOLUTION.md` (INFO1) 에 "공용 헬퍼로 추출, `http-request.handler.ts` 포함 3중 복제 해소" 로 추적되어 있고 이번 PR 범위 밖으로 명시적으로 defer 되어 있다. 새 이슈라기보다는 확인 차원의 재확인이며, 우선순위를 낮게 유지하는 것이 합리적이다. 후속 PR 에서 `wireAbortCascade(upstream, controller): () => void` 형태의 공용 함수 추출을 권장한다.

- **[INFO]** 신규 테스트 fixture 의 `path` 문자열이 파일 내부 컨벤션과 불일치 (`products` vs `product`)
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:188`, `:210`, `:234` (및 `:244`)
  - 상세: 같은 `describe('abortSignal cascade ...')` 블록 안에서 앞의 3개 테스트(`:117`, `:139`, `:165`)는 이 파일 전체가 일관되게 쓰는 복수형 `'products'` (예: 기존 코드의 `'products'`, `'products/1001'`, `'orders'`)를 따르는데, 뒤의 3개 테스트(`아borts the in-flight fetch...`, `does not abort...`, `aborts before issuing...`)는 makeshop 미러 파일(`makeshop-api.client.spec.ts`)에서 그대로 복사돼 단수형 `'product'` 를 쓴다. `client.call()` 이 메타데이터 조회를 거치지 않는 mock 경로라 기능적 영향은 없지만, 같은 블록 안에서 표기가 갈라져 있어 향후 이 블록을 템플릿으로 복사할 때 어느 쪽이 정본 컨벤션인지 혼동을 유발할 수 있다.
  - 제안: 파일 전체 컨벤션(복수형 `'products'`)에 맞춰 3곳을 통일.

## 요약

이번 변경은 두 커머스 client(Cafe24/MakeShop)에 `abortSignal` cascade 를 대칭적으로 배선한 작지만 잘 설계된 패치다. 가독성·네이밍·주석 밀도는 기존 코드베이스 스타일(스펙 섹션 인용, 단계별 한국어 주석)과 일관되고, 중첩 깊이·순환 복잡도도 낮게 유지된다. 유일하게 남는 유지보수성 리스크는 두 client 에 걸친 cascade 로직의 라인 단위 복제인데, 이는 이미 같은 PR 의 plan/RESOLUTION 문서에 공용 헬퍼 추출 후속 작업으로 명시적으로 추적·defer 되어 있어 신규 미해결 이슈로 보기 어렵다. 추가로 신규 테스트 안에서 사소한 fixture 문자열(`products`/`product`) 불일치가 발견되었으나 기능적 영향은 없다.

## 위험도

LOW
