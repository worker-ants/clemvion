# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 이미 200줄을 넘는 단일 hook 함수에 거의 동일한 구조의 5번째 prefix-분기 블록 추가
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts:1460-1479` (신규 `$params.` 블록), 함수 전체는 `:1345-1563`
  - 상세: 새로 추가된 `$params.` 분기는 바로 위 `$input.` 분기(`:1439-1451`)와 거의 동일한 형태(prefix 슬라이스 → sample/schema 추출 → `buildNestedSuggestions` 호출 → `{ suggestions, tokenStart: end - leafLength, tokenEnd: end }` 반환)를 반복한다. 이미 `$sourceItem.`/`$dataSource.` 쌍(`:1501-1527`)도 완전히 동일한 코드로 중복돼 있어, 이번 추가로 "prefix 매칭 → 동일 shape 반환" 패턴이 파일 내 5번째로 반복된다. `useExpressionSuggestions` 자체도 순차 `if`/정규식 매칭 체인 8개 이상을 가진 단일 함수로, 순환 복잡도가 이미 높은 상태에서 계속 커지고 있다.
  - 제안: 즉시 차단 사유는 아니며(기존 파일 컨벤션을 그대로 따름), prefix → `{getSample, getSchema}` 매핑 테이블 + 공통 dispatcher로 추출하면 함수 길이·중복을 동시에 줄일 수 있다. 같은 작업 계열의 `plan/in-progress/trigger-param-output-enricher.md`가 이미 유사 패턴(enricher DRY, "6번째 enricher 추가 시점 트리거")에 대한 리팩터 인식을 남겨두고 있으므로, 이 파일의 prefix-분기 중복도 동일한 임계치 정책으로 추적 백로그에 남길 것을 권장.

- **[INFO]** `slice(8)` 매직 넘버가 리터럴 문자열 길이에 암묵적으로 의존
  - 위치: `use-expression-suggestions.ts:1461` `const fieldPrefix = trimmedToken.slice(8);`
  - 상세: `"$params."`의 길이(8)를 하드코딩. 기존 코드도 동일한 관행(`slice(7)` for `"$input."`, `slice(5)` for `"$var."`, `slice(12)` for `"$sourceItem."`/`"$dataSource."`)을 따르므로 이번 PR이 새로 도입한 문제는 아니나, 리터럴이 바뀌면 조용히 깨지는 취약점을 한 곳 더 재생산한다.
  - 제안: `"$params.".length` 표현이나 공용 `stripPrefix(token, prefix)` 헬퍼로 대체하면 향후 리네이밍 시 더 안전하다. 파일 전체 컨벤션과 일치하므로 이번 PR 범위에서 강제할 사항은 아님.

- **[INFO]** 인라인 object-guard 반복 (프로젝트 전역에 이미 존재하는 기존 패턴, 신규 도입 아님)
  - 위치: `use-expression-suggestions.ts:1465` `rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)`
  - 상세: 동일한 `typeof x === "object" && !Array.isArray(x)` 가드가 이미 frontend 전역 8곳 이상(`variable-picker.tsx:107,112`, `resolve-nested-path.ts:101,112`, `use-expression-context.ts:332,335`, `use-execution-events.ts:71`, `executions.ts:108`)에 산재해 있다. 이번 추가는 기존 패턴을 그대로 답습한 것이라 새 부채는 아니지만, 공용 `isPlainRecord`/`asRecord` 유틸이 frontend에 없다는 기존 결핍을 한 곳 더 확대한다. 참고로 백엔드 `manual-trigger.handler.ts`는 이미 `isPlainRecord` 헬퍼를 사용 중이라 대칭이 맞지 않는다.
  - 제안: 이번 PR 범위 밖. 공용 utils에 `isPlainRecord` 헬퍼를 두면 백엔드와 대칭도 맞고 향후 반복을 줄일 수 있어 후속 백로그感.

- **[INFO]** `$params`가 `BUILT_IN_PICKER_VARIABLES` 제외 목록·주석과 맺는 관계가 문서화되지 않음
  - 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts:1132-1144`
  - 상세: 해당 배열의 주석은 "`$input`, `$node`, `$var`는 자신만의 picker section이 있어 제외한다"고 명시한다. `$params`는 설계상 `$input`을 그대로 미러링하는 shortcut(디자인 문서에도 "`$input`과 동일하게 전역 root var"로 명시)인데 이 제외 목록에는 포함되지 않았다. 기능적으로 의도된 선택일 수 있으나(별도의 전용 picker section이 필요 없다고 판단), 그 판단 근거가 코드나 주석에 남아있지 않아 향후 유지보수자가 "빠뜨린 것"인지 "의도한 것"인지 판단하기 어렵다.
  - 제안: 한 줄 주석("`$params`는 `$input`처럼 별도 section을 두지 않고 flat 항목으로 노출")을 추가하면 의도가 명확해진다. 리뷰 대상 diff에는 `variable-picker.tsx` 변경이 없어 기능 결함 여부는 별도 확인 필요(유지보수성 관점의 문서화 갭으로만 보고).

## 요약

핵심 변경은 `buildNestedSuggestions` 헬퍼를 새로 만들지 않고 그대로 재사용해 실제 필드-병합/타입-추론 로직의 중복은 잘 억제했고, 주석(리졸버 대응 관계, enricher와의 연결, 의도적 no-op 케이스 설명)이 상세해 의도 파악이 쉽다. 네이밍·테스트 스타일도 기존 `$input`/`$sourceItem` 패턴과 일관되게 맞춰져 있다. 다만 새로 추가된 `$params.` 분기는 `$input.` 분기와 구조적으로 거의 동일하며, 이미 중복 상태인 `$sourceItem.`/`$dataSource.` 쌍에 이어 같은 반환-shape 패턴이 파일 내 5번째로 반복돼, 이미 길고 분기가 많은 `useExpressionSuggestions` 단일 함수의 복잡도를 더 키운다. 매직 넘버(`slice(8)`)와 인라인 object-guard 중복은 파일/프로젝트 전역의 기존 관행을 그대로 따른 것이라 이번 PR이 새로 유발한 결함은 아니다. 전반적으로 병합을 막을 사유는 없으며, 지적 사항은 모두 기존 컨벤션 추종형 부채의 점진적 누적이므로 후속 리팩터 백로그로 추적하면 충분하다.

## 위험도

LOW
