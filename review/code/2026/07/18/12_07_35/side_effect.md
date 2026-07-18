# 부작용(Side Effect) 리뷰 결과

## 대상 변경 요약

`git diff origin/main` 기준 실제 변경은 두 파일이다.

- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`: 파서 chokepoint(`parseGuardSource`/`scriptKindForFile`)와 그 self-test 를 신설/보강하는 **테스트 전용** 변경.
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`: JSDoc 주석 문구("grep 가드" → "AST 가드")만 수정. 실행 코드·export 심볼(`INTERACTION_TYPE_VALUES`, `CONVERSATION_SOURCE_VALUES`, `MULTI_TURN_INTERACTION_TYPES`)은 무변경.

프로덕션 코드 변경은 없고, 신설/수정된 함수(`scriptKindForFile`, `parseGuardSource`, `collectStringLiteralsFrom`, `treeContainsJsx`)는 모두 테스트 파일 내부 지역 함수로, 다른 소스에서 import 되지 않음을 `grep` 으로 확인했다.

## 발견사항

- **[INFO]** 파일시스템 읽기(`readRepoFile`)는 기존 동작 유지, 변경 없음
  - 위치: `interaction-type-exhaustiveness.test.ts:79-82` (`readRepoFile`, 이번 diff 밖 — 컨텍스트로만 포함됨)
  - 상세: 이 함수는 `node:fs.readFileSync` 로 리포 내 3개(REGISTRY_SITES) + 1개(SOURCE_REGISTRY_SITES) 소스 파일을 읽어 AST 로 파싱한다. 읽기 전용이며 쓰기는 없다. 이번 diff 는 이 함수 자체를 변경하지 않았고, 새로 추가된 `parseGuardSource`/`collectCodeStringLiterals` 도 순수 함수(입력 문자열 → `Set<string>`/`ts.SourceFile`, 부작용 없음)다.
  - 제안: 없음 — 기존 패턴 유지.

- **[INFO]** 신규/변경 함수는 모두 테스트 파일 지역 스코프, export 없음
  - 위치: `interaction-type-exhaustiveness.test.ts:93-190` (`scriptKindForFile`, `parseGuardSource`, `collectStringLiteralsFrom`, `treeContainsJsx`)
  - 상세: `export` 키워드 없이 파일 내부에서만 선언·사용된다. `grep -rn` 결과 이 함수들을 참조하는 다른 소스 파일은 없다(테스트 파일 자신 제외). 따라서 시그니처 변경/신설이 호출자에 미치는 영향은 원천적으로 없다(호출자가 이 파일 자신뿐).
  - 제안: 없음.

- **[INFO]** `collectCodeStringLiterals` 내부 구현이 `parseGuardSource` 위임으로 리팩터됐지만 시그니처(`(source, fileName) => Set<string>`)는 diff 전후 동일
  - 위치: `interaction-type-exhaustiveness.test.ts:163-165` (신규) vs 원본 인라인 구현
  - 상세: 기존 테스트 케이스("collects code literals and ignores mentions inside comments" 등)와 exhaustiveness 본 테스트(`REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 순회) 모두 동일 시그니처로 계속 호출되어 하위 호환. `ScriptKind` 결정 로직이 `ts.ScriptKind.TS` 하드코딩에서 `scriptKindForFile(fileName)` 파생으로 바뀐 것이 유일한 동작 변화이며, 이는 `.ts` 입력에 대해서는 이전과 동일 결과(`ts.ScriptKind.TS`)를 내므로 기존 3개 `REGISTRY_SITES`(모두 `.ts`)에 대한 회귀 위험은 없다.
  - 제안: 없음.

- **[INFO]** `interaction-type-registry.ts` 는 주석(JSDoc)만 변경, 실행 동작/공개 API 무변경
  - 위치: `interaction-type-registry.ts:14`, `:63-64`
  - 상세: "grep 가드" → "AST 가드" 문구 정정. `INTERACTION_TYPE_VALUES`, `CONVERSATION_SOURCE_VALUES`, `MULTI_TURN_INTERACTION_TYPES`, 컴파일타임 `Exclude` 단언 등 export 표면과 런타임 값은 diff 전후 바이트 단위로 동일. 이 모듈을 소비하는 다른 파일(`use-execution-events.ts` 등)에 영향 없음.
  - 제안: 없음.

- **[INFO]** 환경 변수·네트워크 호출·이벤트/콜백·전역 변수 관련 부작용 없음
  - 상세: 두 파일 모두 순수 문자열/AST 처리 로직과 vitest `describe/it/expect` 블록으로만 구성되어 있으며, `process.env` 접근, HTTP/네트워크 호출, DOM/전역 객체 mutation, custom event emit 이 전혀 없다.

## 요약

이번 diff 는 프로덕션 코드가 아닌 테스트 파일(`interaction-type-exhaustiveness.test.ts`) 내부에 self-test 강화용 헬퍼 함수(`scriptKindForFile`/`parseGuardSource`/`collectStringLiteralsFrom`/`treeContainsJsx`)를 신설하고 기존 `collectCodeStringLiterals` 가 그 chokepoint 를 경유하도록 리팩터한 것이며, `interaction-type-registry.ts` 는 주석 문구 정정뿐이다. 신설 함수는 모두 비-export 지역 함수로 이 테스트 파일 밖에서 참조되지 않고, 파일시스템 접근은 기존 `readRepoFile` 의 읽기 전용 패턴을 그대로 유지하며, 공개 API·전역 상태·환경 변수·네트워크·이벤트 어느 축에서도 부작용을 일으키지 않는다.

## 위험도

NONE
