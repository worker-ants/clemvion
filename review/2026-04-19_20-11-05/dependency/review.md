## 의존성 리뷰

### 발견사항

**[INFO]** `migrate-node-output-refs.spec.ts` 는 상대 경로로 스크립트를 import
- 위치: `migrate-node-output-refs.spec.ts` line 8-13
- 상세: `'../../scripts/migrate-node-output-refs'` 경로 import. 스크립트가 `backend/scripts/` 에 위치하고 테스트가 `backend/src/scripts/` 에 위치한다면 경로가 `src/` 외부(`../../scripts/`)를 가리키게 됨. 실제 파일 위치를 확인해야 컴파일/번들 포함 여부가 결정됨.
- 제안: 테스트 파일을 `backend/scripts/` 인접 경로로 이동하거나, tsconfig의 `paths`/`rootDir` 설정이 scripts 디렉터리를 포함하는지 확인

**[INFO]** `error-codes.ts` 에 외부 의존성 없음
- 위치: `backend/src/nodes/core/error-codes.ts` 전체
- 상세: 순수 TypeScript `const enum` + 헬퍼 함수. 외부 패키지 import 없음. 내부 의존 관계도 없어 독립적으로 안전하게 사용 가능.
- 제안: 없음

**[INFO]** 스펙 문서 변경은 런타임 의존성에 영향 없음
- 위치: `spec/` 경로 3개 파일
- 상세: 순수 markdown 문서 변경으로 빌드 의존성에 영향 없음

### 요약

이번 변경 세트는 스펙 문서 정비, 신규 에러 코드 enum 파일, 마이그레이션 스크립트 테스트로 구성된다. 외부 패키지 추가는 전혀 없고, `error-codes.ts` 는 zero-dependency 유틸리티로 의존성 관점에서 매우 건전하다. 유일한 확인 사항은 테스트 파일의 import 경로(`../../scripts/`)가 프로젝트 tsconfig의 `rootDir`/`include` 설정과 충돌하지 않는지 여부이며, Jest 설정에서 `scripts/` 디렉터리가 transform 대상에 포함되어 있는지 검증이 권장된다.

### 위험도

**LOW**