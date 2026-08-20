STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 폐지하고(재제출 소비처 3곳에
마커 가드 신설), 이미 5라운드의 code-review(`14_08_45`~`15_59_17`)와 4라운드의
consistency-review 를 거친 상태다. 본 라운드는 부작용 관점에서 (1) 시그니처/공개 인터페이스
변경의 호출자 영향, (2) 전역 상태·환경변수·네트워크·이벤트 콜백, (3) 신규 유틸
`masked-markers.ts` 승격이 남긴 breakage 를 실측 재검토했다.

## 발견사항

- **[WARNING]** `ExecutionDto.inputData` REST 응답의 **실제 반환 내용**이 원문 → 마스킹값으로
  바뀌는 공개 API 계약 변경이며, 저장소 밖 소비자 영향은 이번 PR 범위에서 확인되지 않은 채
  남아 있다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1010`
    (`toExecutionDto` — `inputData: redactStoredDataForResponse(execution.inputData)`,
    이전엔 `execution.inputData ?? null` 로 원문을 그대로 반환), 같은 파일 `:1075`
    (`toResponseExecution` — `...rest` 스프레드 뒤에 `inputData:
    redactStoredDataForResponse(rest.inputData)` 를 추가로 덮어씀, 이전엔 스프레드된 원문이
    그대로 나갔다). DTO 타입 쪽은 `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-60`.
  - 상세: OpenAPI 스키마(`@ApiProperty` 타입·nullable 여부)는 이번 diff 에서 변경되지 않아
    타입 계약은 그대로지만, 같은 필드가 반환하는 **값**이 이제 자격증명 패턴에 한해
    `'***'`/`[REDACTED]` 로 대체된다. 이는 프런트(Re-run 모달·에디터 히스토리 로드·폼 프리필)
    쪽은 이번 PR 이 마커 가드로 함께 대응했지만, **저장소 밖의 임의 API 클라이언트**(공개
    REST API 를 직접 호출해 `inputData` 원문을 자체 용도로 읽는 통합·자동화 스크립트 등)가
    있다면 이번 배포 시점부터 그 값이 조용히 마스킹된 문자열로 바뀐다 — 스키마 검증은
    통과하므로 컴파일/타입 오류로는 드러나지 않는 순수 콘텐츠 계약 변경이다.
    이 위험 자체는 이 PR 의 이전 라운드에서도 이미 인지됐다 — `review/code/2026/08/20/14_44_08/RESOLUTION.md`
    가 "트래커 등재 #5 — 응답 의미 반전의 외부 소비자 확인: 스키마로 드러나지 않는 콘텐츠
    계약 변경. 저장소 밖 소비자 존재 여부는 diff 범위 밖" 이라고 명시하며 **이번 PR 에서
    해소하지 않고 트래커로 이연**했다. 즉 새로 발견한 결함이 아니라, 최종 diff 시점에도 그
    이연 판단이 여전히 유효한 채로 남아 있음을 재확인한 것이다.
  - 제안: 코드 변경은 불요(이미 여러 라운드가 의도된 설계로 판정) — 다만 이 응답 계약 변경이
    실제 배포되는 시점에 API 변경 로그·버전 노트(REST 소비자 대상)에도 노출해 두면, 트래커
    항목 #5 가 "diff 범위 밖" 으로 남겨 둔 조사(저장소 밖 소비자 존재 여부)가 완료되기 전까지의
    공백을 줄일 수 있다.

## 확인했으나 재지적하지 않는 것 (부작용 없음 실측 확인)

- **시그니처 변경 없음**: `redactStoredDataForResponse`/`redactStoredErrorForResponse`
  (`codebase/backend/src/shared/utils/redact-stored-error.ts`)는 시그니처·null 처리 의미론이
  이번 diff 에서 바뀌지 않았고(입력 `null`/`undefined` → `null`, 그 외엔 값-불변 copy-on-change),
  새 호출부 2곳(`executions.service.ts:1010,1075`)이 추가됐을 뿐이다. 반환 null 여부는 기존
  `execution.inputData ?? null` 과 동일 케이스(원본이 `null`/`undefined`)에서만 `null` 을
  주므로 nullable 의미론 변화도 없다.
- **`ResponseExecution`/`ResponseNodeExecution` 타입 확장**: `Omit<... , 'inputData' | ...>` 로
  `inputData` 를 추가 편입했지만(`executions.service.ts:116-125`), 이 타입은 이 파일 내부
  private 헬퍼 반환형이라 외부 시그니처 파급은 없다. `nest build` 가 대입 불일치를 잡는
  방어도 그대로 유지된다.
- **공개 export 재배치가 깨끗하게 완료됨**: `dynamic-form-ui.tsx` 가 export 하던
  `MASKED_MARKERS`/`isMaskedMarker` 를 제거하고 `lib/utils/masked-markers.ts` 로 승격했다.
  `grep` 으로 frontend 전체를 재검색한 결과 `dynamic-form-ui` 로부터 이 두 심볼을 import 하는
  잔존 소비처는 없다(`result-detail.tsx`·`assistant-presentations-block.tsx` 는 컴포넌트
  `DynamicFormUI` 만 import). 신규 소비처(`editor-toolbar.tsx`, `rerun-modal.tsx`, 테스트
  파일들)는 전부 새 경로에서 import 하도록 갱신돼 있어 breaking import 는 없다.
- **전역 상태·환경변수 없음**: `rerun-modal.tsx` 의 신규 상태(`touchedMaskedKeys`)는 컴포넌트
  로컬 `useState` 이며, `setTouchedMaskedKeys` 갱신은 항상 `new Set(prev)` 로 복사 후
  `.add()` 해 이전 상태 객체를 변이하지 않는다(React 불변성 준수). 모듈 스코프 상수
  (`MASKED_MARKERS`)는 `ReadonlySet` 이고 mutate 되지 않는다.
- **네트워크·이벤트/콜백 변경 없음**: 이번 diff 는 기존 REST 응답 구성 로직에 마스킹 호출을
  끼워 넣거나 프런트 폼 상태를 확장했을 뿐, 신규 HTTP 호출·WS emit·이벤트 발행 지점은 없다.
  WS emit 경로(`execution.node.*`)는 이미 이전부터 마스킹 대상이었고 이번 diff 로 변경되지
  않는다.
- **테스트 파일 부작용 없음**: 변경된 `.spec.ts`/`.test.tsx` 어디에도 `process.env`/`global.*`
  변이나 `vi.mock`/`jest.mock` 모듈 목이 추가되지 않아, 다른 테스트로 전파되는 격리 위반은
  없다.
- **파일시스템 부작용**: 이번 diff 가 신규로 추가하는 파일들은 대부분
  `review/code/2026/08/20/**`·`review/consistency/2026/08/20/**` 하위의 이전 리뷰 라운드
  산출물(RESOLUTION.md/SUMMARY.md/meta.json 등)이며, 이는 프로젝트 컨벤션(`CLAUDE.md` "코드
  리뷰 산출물" 저장 위치)이 요구하는 정상적인 커밋 대상이다 — 예상치 못한 파일 생성이 아니다.

## 요약

핵심 프로덕션 코드 변경(backend 마스킹 관문 3곳, frontend 마커 가드 3소비처, 유틸 승격)은
시그니처·전역 상태·네트워크·이벤트 축에서 새로운 부작용을 만들지 않는다 — 타입 확장은
내부 private 헬퍼에 국한되고, export 재배치는 전수 grep 으로 breaking import 가 없음을
확인했으며, 신규 React 상태는 로컬이고 불변성을 지킨다. 유일하게 남는 부작용 성격의
발견은 `Execution.inputData` REST 응답의 **콘텐츠 계약**이 원문에서 마스킹값으로 바뀌는
것인데, 이는 스키마 변경이 아니라 값 변경이라 타입 체크로 드러나지 않고, 저장소 밖 API
소비자에 대한 영향은 이 PR 자신이 이미 트래커로 이연시킨 채 남아 있다 — 새 결함이라기보다
"의도된 설계, 미해소 잔여 위험"으로 재확인한 것이다.

## 위험도

MEDIUM
