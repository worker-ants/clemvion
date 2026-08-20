STATUS=success side_effect review complete — 0 CRITICAL, 1 WARNING, 2 INFO

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 범위 요약

핵심 동작 변경은 두 갈래다.

1. **backend**: `Execution.inputData` 를 응답 직전에 마스킹하지 않던 카브아웃을 폐지하고, `outputData`/`error` 와 같은 `redactStoredDataForResponse` 관문을 통과시킴 (`codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`(1067행대), `toExecutionDto`(1005~1009행), 노드 레벨 `maskIfPresent` 호출부(689~698행), `ResponseExecution` 타입(115~124행)).
2. **frontend**: 그 마스킹된 값이 재제출(Re-run 프리필·에디터 히스토리 로드)에 왕복 오염되지 않도록 소비처 3곳(폼 프리필/`dynamic-form-ui.tsx`, Re-run 모달/`rerun-modal.tsx`, 에디터 툴바/`editor-toolbar.tsx`)에 마커 감지 가드를 걸고, 공용 판별기를 `codebase/frontend/src/lib/utils/masked-markers.ts` 로 승격.

나머지(CHANGELOG, docs mdx, i18n dict, plan/*, review/* 산출물)는 텍스트뿐이라 부작용 관점에서는 영향이 없다.

## 발견사항

- **[WARNING]** `Execution.inputData` 를 소비하는 REST 응답 표면 전체가 "원문 반환"에서 "마스킹 반환"으로 뒤집힘 — 이 저장소 안의 3개 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)는 이번 PR 에서 함께 가드됐지만, 이 필드를 읽는 **이 저장소 밖의 소비자**(공개 API 로 `GET /executions/:id`, `GET /executions`, `GET /executions/:id/chain`, `POST /executions/:id/stop` 을 직접 호출하는 외부 통합/자동화 스크립트)에는 해당하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`(문서화: 100~124행 `ResponseExecution` 타입 정의, 실제 마스킹 적용: `toResponseExecution` 본문 1074행 `inputData: redactStoredDataForResponse(rest.inputData)`), `toExecutionDto`(1009행 `inputData: redactStoredDataForResponse(execution.inputData)`)
  - 상세: 이 diff 이전에는 `Execution.inputData` 가 egress 마스킹 대상이 아니었고(`MASKED_INPUT_DATA_REASON` JSDoc 이 그 의도를 명시), 그 이유는 "재제출 소비처가 왕복 오염된다"였다. 이번 PR 은 이 저장소가 알고 있는 재제출 소비처(프런트 3곳)에 마커 가드를 걸어 그 위험을 닫았지만, 마스킹 자체는 **해당 REST 엔드포인트를 호출하는 모든 클라이언트**에 적용되는 응답 계약 변경이다. 이 리포에 없는 외부 통합(공개 API 사용자, 워크플로 자동화 스크립트 등)이 `inputData` 를 원문으로 기대하고 있었다면 그쪽은 이번 변경으로 조용히 마스킹된 값(`***`)을 받게 되며, 그 소비처들은 이번 PR 의 "마커 가드"라는 대응책을 갖고 있지 않다. spec(EIA §R17)·CHANGELOG·Swagger description(`execution-response.dto.ts`, `background-run-response.dto.ts`)이 이 변경을 명시적으로 문서화하고 있어 "몰래" 바뀐 것은 아니지만, 공개 API 응답 필드의 실제 데이터 형태가 바뀌는 것은 이 리뷰 관점(§5 인터페이스 변경)에서 반드시 짚어야 하는 항목이다.
  - 제안: 이 서비스의 API 소비자가 이 저장소 내 3곳으로 한정된다는 전제가 맞는지(즉, 공개 API 문서·외부 파트너 연동이 없는지) 확인하고, 있다면 릴리스 노트/API changelog 에 "breaking: `Execution.inputData` 이제 egress 마스킹됨" 을 별도로 공지할 것을 권장한다. 코드 변경 자체를 막을 사유는 아니다(의도된 보안 강화이며 대안이 없다).

- **[INFO]** `deepRedactSecrets` 의 모듈 전역 `WeakMap` 캐시가 이제 `Execution.inputData` 객체도 추가로 캐싱한다 (기존 인프라 확장, 새 위험 아님)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `DEEP_REDACT_CACHE`(181행), `deepRedactSecrets`(201~214행). 이 파일 자체는 이번 diff 대상이 아니고, `redactStoredDataForResponse`(`codebase/backend/src/shared/utils/redact-stored-error.ts:66~71`)를 거쳐 간접 호출됨
  - 상세: `Execution.inputData` 가 새로 이 관문을 타면서, 지금까지 `outputData`/`error` 객체만 채우던 이 모듈 전역 `WeakMap` 캐시에 `inputData` 객체도 키로 들어간다. `WeakMap` 이라 GC 가 따라가고 메모리 누수 위험은 없으며, 캐시 히트 시 **같은 참조**를 반환하는 copy-on-change 동작도 이미 `error`/`outputData` 에서 검증된 패턴이라 이번 PR 이 새로 만든 위험은 아니다. 다만 "값이 안 바뀌면 DB 엔티티의 `inputData` 필드와 응답 객체의 `inputData` 가 같은 참조를 공유"하는 케이스가 이제 `inputData` 에도 적용되므로, 향후 응답 객체를 받은 코드가 그 값을 in-place mutate 하면 엔티티(캐시된 TypeORM row)도 함께 바뀔 수 있다는 기존 캐비엇의 적용 범위가 넓어졌다는 점만 기록해 둔다.
  - 제안: 조치 불요(기존에 이미 감수한 트레이드오프의 확장). 향후 `toResponseExecution`/`toExecutionDto` 반환값을 호출부에서 mutate 하는 코드가 생기면 이 공유 참조 캐비엇을 상기할 것.

- **[INFO]** `ResponseExecution` 타입에 `inputData: Record<string, unknown> | null` 필드가 추가되며 `Omit<Execution, ...>` 목록도 `'inputData'` 를 포함하도록 넓어짐 — export 되는 타입의 형태 변경이지만 실측상 이 리포 내부 참조처만 있고 깨지는 자리는 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:115-124` (`ResponseExecution`)
  - 상세: `ResponseExecution` 은 export 된 타입이라 원칙적으로 "인터페이스 변경"에 해당하지만, 저장소 전수 검색(`grep -rn "ResponseExecution\b"`) 결과 실제 타입 참조는 정의부(`executions.service.ts`) 자체뿐이고, 다른 두 참조처(`execution-response.dto.ts`, `background-runs.service.ts`)는 JSDoc 주석 안에서 함수 이름을 텍스트로 인용할 뿐 타입을 import 하지 않는다. 필드가 늘어나는 방향(narrowing 아님)이라 기존 사용처를 깨뜨릴 가능성도 낮다.
  - 제안: 조치 불요. e2e/타입 테스트에서 이 타입을 직접 import 하는 자리가 생기면 그때 재확인.

## 요약

이번 변경의 핵심 부작용은 backend REST 응답에서 `Execution.inputData` 가 원문에서 마스킹 값으로 바뀌는 **의도된 API 계약 변경**이며, 이 리포가 인지하는 3개 재제출 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)는 마커 감지 가드로 왕복 오염을 정확히 막아 두었다(스칼라·중첩 object/array leaf 양쪽, 값-기반이 아닌 "사용자가 건드렸는가" 판정으로 타입 캐스팅 우회까지 차단 — `rerun-modal.tsx` 의 `touchedMaskedKeys`). export 되는 함수 시그니처·전역 변수·환경 변수·네트워크 호출·이벤트/콜백 발생 패턴에는 새로운 의도치 않은 부작용이 없었고, `dynamic-form-ui.tsx` 에서 `lib/utils/masked-markers.ts` 로의 유틸 이동도 옛 export(`MASKED_MARKERS`/`isMaskedMarker`)를 참조하던 자리를 전수 확인한 결과 깨지는 import 는 없다. 유일하게 짚을 점은 이 응답 필드를 읽는 소비자가 이 저장소 밖에도 있을 수 있다는 전제 확인(WARNING, 차단 사유 아님)이다.

## 위험도

LOW
