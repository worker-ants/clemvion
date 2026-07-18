# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` — 이번 커밋(`a053b421b`)에서 self-test 스캐폴딩(`parseGuardSource`/`collectStringLiteralsFrom`/`treeContainsJsx` 3개 헬퍼)을 `collectCodeStringLiterals` 단일 엔트리포인트로 통합·인라인.
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` — 이번 브랜치(`cbb2a2fca..HEAD`)에서 doc-comment 텍스트("grep 가드" → "AST 가드") 2곳만 변경. 실행 코드 변경 없음.

## 발견사항

없음.

- **파일시스템**: `readRepoFile`(테스트 파일)은 `readFileSync` 로 리포지토리 소스를 **읽기만** 한다(`join(__dirname, "../../../../../", relPath)`). 이번 diff 에서 이 함수 자체는 변경되지 않았고, 새 파일 생성·수정·삭제 경로는 없다.
- **전역 상태·전역 변수**: 제거/통합된 헬퍼(`parseGuardSource`, `collectStringLiteralsFrom`, `treeContainsJsx`)와 잔존 함수(`collectCodeStringLiterals`, `scriptKindForFile`) 모두 테스트 파일 내부 module-private 함수이며 순수 함수(입력 `source`/`fileName` → `Set<string>`/`ts.SourceFile`, 캡처된 가변 상태 없음). `grep -rn` 으로 `codebase/` 전체를 확인한 결과 이 헬퍼들을 참조하는 다른 파일은 없어(export 되지 않음) 제거로 인한 외부 영향이 없다.
- **시그니처/인터페이스 변경**: `interaction-type-registry.ts` 는 실행 코드 변경 없이 주석만 수정되어 `INTERACTION_TYPE_VALUES`/`CONVERSATION_SOURCE_VALUES`/`MULTI_TURN_INTERACTION_TYPES`/`IS_MULTI_TURN_INTERACTION` export 표면이 그대로다. 테스트 파일의 헬퍼 정리는 비-export 심볼만 대상이라 공개 인터페이스 변화가 없다.
- **환경 변수·네트워크·이벤트/콜백**: 두 파일 모두 관련 코드 없음(변경 전/후 동일).
- 테스트 실행 확인: `vitest run src/lib/__tests__/interaction-type-exhaustiveness.test.ts` → 7 passed, 부작용성 회귀 없음.

## 요약

두 파일 모두 실질적인 부작용 표면이 없다. `interaction-type-registry.ts` 는 순수 doc-comment 정정이며 런타임/타입 동작 변화가 전혀 없다. 테스트 파일은 module-private(비-export) 헬퍼 3개를 단일 엔트리포인트로 인라인 통합한 리팩터로, 외부에서 참조되지 않고(grep 확인) 기존 `readFileSync` 읽기 전용 패턴도 그대로 유지되어 파일시스템·전역 상태·시그니처·인터페이스·환경 변수·네트워크·이벤트 어느 관점에서도 의도치 않은 영향이 없다.

## 위험도

NONE
