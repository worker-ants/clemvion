## 발견사항

### [INFO] 마이그레이션 스크립트의 backfill 전략이 shadow-workflow와 의도적으로 다름
- **위치**: `migrate-button-ids.ts` L100-180 vs `button-slug.util.ts`
- **상세**: 마이그레이션은 `btn_${i}` index fallback만 사용하고, shadow-workflow는 label-slug를 먼저 시도. 코멘트에 배경 설명이 있어 의도적 설계임은 명확하나, 두 경로가 서로 다른 id를 부여할 수 있다는 점은 검토 필요.
- **제안**: 현 설계 의도(기존 edge resolver-fallback 패턴 보존)가 맞다면 이슈 아님. 확인 완료.

### [INFO] 테스트 파일 위치 구조 불일치
- **위치**: `backend/src/scripts/migrate-button-ids.spec.ts`
- **상세**: 소스 파일은 `backend/scripts/`에 있으나 테스트 파일은 `backend/src/scripts/`에 위치. import 경로(`../../scripts/migrate-button-ids`)는 정확하게 해석되지만, Jest 설정에서 `src/` 하위 파일만 스캔하면 이 테스트가 의도대로 수집될 수 있다. 반면 소스 파일이 TypeScript 컴파일 대상이 아닌 `scripts/` 디렉터리에 있으므로 `ts-node` 직접 실행 외의 경로에서 빌드 오류 가능성 존재.
- **제안**: `backend/scripts/migrate-button-ids.spec.ts`로 이동해 소스와 테스트를 동일 위치에 두는 것이 더 일관적. 또는 Jest roots 설정에서 `scripts/` 를 포함하는지 확인 필요.

### [INFO] 환경변수 로딩에 bare block 사용
- **위치**: `migrate-button-ids.ts` L36-42
- **상세**: 모듈 최상위에 `{ const envPath = ...; }` 형태의 bare block 사용. 동작은 정상이나 TypeScript/JS 코드에서 드문 패턴으로 가독성상 IIFE 또는 함수로 대체 가능.
- **제안**: 기능상 문제 없음. 스타일 선호의 문제.

---

## 요약

변경사항 전체가 F-2 `buttons[*].id` 자동 부여 기능에 집중되어 있다. 신규 파일 5개(유틸리티, 테스트 2개, 마이그레이션 스크립트, 마이그레이션 테스트)와 기존 파일 2개(shadow-workflow.ts의 최소 수정, spec 문서 1줄 추가)로 구성되며, 요청 범위 외의 리팩토링·기능 추가·무관한 코드 변경은 발견되지 않는다. 테스트 파일의 디렉터리 위치가 관례와 다소 어긋나는 점과 마이그레이션-shadow 간 id 부여 전략 차이가 Info 수준으로 존재하나, 모두 의도된 설계 결정으로 판단된다.

## 위험도

**NONE**