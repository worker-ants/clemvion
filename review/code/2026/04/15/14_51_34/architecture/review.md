### 발견사항

- **[INFO]** `toKeyValueRecord` / `toKeyValueEntries` / `stringifyScalar` 유틸 함수가 핸들러 파일 하단에 모듈-프라이빗으로 위치
  - 위치: `http-request.handler.ts:289-348`
  - 상세: 현재 동일한 `Array<{key,value}>` 직렬화 패턴이 향후 다른 핸들러(e-mail, DB 등)에도 필요해질 가능성이 높다. 지금은 하나의 파일에만 존재하므로 중복 구현이 생길 위험이 있음.
  - 제안: `handlers/utils/key-value.ts` 같은 공유 유틸리티 모듈로 분리 고려. 단, 현재 사용처가 하나뿐이므로 즉각적인 이동 필요성은 낮음 — 두 번째 사용처가 생길 때 이동.

- **[INFO]** 레거시 `Record<string,string>` 포맷 지원을 `toKeyValueEntries`가 조용히 수용
  - 위치: `http-request.handler.ts:315-320`
  - 상세: 구 포맷과 신 포맷을 런타임에 분기하는 방식은 스키마 마이그레이션 없이 하위 호환을 유지하기 위한 의도적 선택으로 보임. 그러나 이 분기 로직이 영구화되면 계약(contract) 불명확성이 누적됨.
  - 제안: 저장된 워크플로우 데이터의 마이그레이션 계획을 스펙/PRD에 기록하고, 레거시 경로를 deprecation 주석과 함께 명시. 일정 기간 후 제거.

- **[INFO]** `HttpRequestHandler`의 생성자 선택적 의존성 패턴
  - 위치: `http-request.handler.ts:18-20`
  - 상세: `integrationsService`가 `optional`이어서 동일 클래스가 "인증 없음" 모드와 "인테그레이션" 모드 양쪽을 커버함. 현재 규모에서는 수용 가능하나, 인증 방식이 늘어날수록 단일 책임 원칙 위반 압력이 커짐.
  - 제안: 단기적으로는 현 구조 유지. 인증 전략이 3종 이상으로 늘어나면 Strategy 패턴으로 `AuthStrategy` 인터페이스를 추출하여 핸들러의 책임 분리.

- **[INFO]** 프론트엔드 `integration` 선택 시 `integrationId` 미선택 상태로 저장 가능
  - 위치: `integration-configs.tsx:44-52`
  - 상세: `authentication`이 `"integration"`으로 변경되는 순간 `integrationId`는 `""`으로 초기화됨. 백엔드 `validate()`가 이를 걸러내지만, UI 레이어에서 저장 버튼 비활성화 등 조기 피드백이 없음. 아키텍처상 유효성 검사 책임이 백엔드에만 집중되어 있음.
  - 제안: 프론트엔드 설정 패널에서도 `integrationId`가 비어 있으면 경고 표시 또는 저장 불가 처리하여 레이어별 방어 심층화.

- **[INFO]** 테스트에서 `global.fetch` 직접 교체 방식
  - 위치: `http-request.handler.spec.ts` 전반
  - 상세: 기능적으로 올바르나, 테스트 간 격리를 `beforeEach`/`afterEach`로 수동 관리함. 현재 구조에서 `fetch`가 핸들러에 직접 하드코딩되어 있어 의존성 역전이 적용되지 않음.
  - 제안: 장기적으로 `fetch`를 생성자 주입(또는 `HttpClient` 추상화)으로 교체하면 테스트 안정성과 환경 독립성이 향상됨. 현재 규모에서는 낮은 우선순위.

---

### 요약

이번 변경은 `headers`/`queryParams`의 데이터 형식을 `Record<string,string>`에서 `Array<{key,value}>`로 전환하고, `form-data`·`x-www-form-urlencoded` 바디 타입과 인테그레이션 인증 UI를 추가한 기능 확장이다. 핵심 유틸 함수(`toKeyValueRecord`, `toKeyValueEntries`)는 단일 책임 범위 내에서 잘 캡슐화되어 있고, 레거시 포맷 하위 호환 처리도 명시적으로 분기되어 있어 당장의 아키텍처 위험은 낮다. 다만 ① 유틸 함수가 재사용 가능한 위치가 아닌 핸들러 내부에 위치하는 점, ② 레거시 포맷 지원의 제거 계획 부재, ③ 프론트엔드 유효성 검사 부재는 향후 코드베이스 성장 시 기술 부채로 전환될 수 있다. 전반적으로 구조적 개선 방향은 올바르며 즉각적인 리팩터링을 강제하는 심각한 결함은 없다.

### 위험도

**LOW**