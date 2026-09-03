# 유지보수성(Maintainability) 리뷰

## 리뷰 대상 개요

9개 TypeORM 엔티티 파일(`execution` · `knowledge-base` · `node-execution` · `node` ·
`notification` · `schedule` · `trigger` · `user` · `workflow`)에서 `nullable: true` DB
컬럼과 짝을 이루는 TS 필드 타입을 `| null` 로 넓히고, `@Column` 에 명시 `type:` 이 없던
자리에 DB 실측 기반으로 `type:` 을 보강했다. 더불어 `redact-stored-error.ts` 의
`maskIfPresent` 시그니처/제네릭 제약을 같은 이유로 넓히고, 그 근거였던 docstring 의
전제("엔티티가 non-null 이라 정적으로 null 이 올 수 없다")를 취소선 보존 + 정정문으로
갱신했다. `plan/in-progress/entity-nullable-column-type-mismatch.md` 는 배치 2 완료
기록이다.

## 발견사항

- **[INFO]** 신규 섹션 헤딩 앞 빈 줄 누락 — 문서 자체의 기존 관례와 불일치
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:168` (`## 배치 2 — 비대칭 해소 (완료)`)
  - 상세: 직전 줄(`:167`, "…형제 가드 4개를 함께 건드려야 해 이 배치에 넣지 않는다.")과
    새 `##` 헤딩 사이에 빈 줄이 없어, 헤딩이 이전 체크리스트 항목의 연속처럼 보인다.
    같은 문서의 다른 헤딩(예: `:70`→`:71` `## 배치 1 — …`)은 모두 앞에 빈 줄을 두고
    있어 이 자리만 예외다.
  - 제안: `:167` 과 `:168` 사이에 빈 줄 하나를 추가해 문서 내 기존 헤딩 포맷팅과
    맞춘다. 기능에 영향 없는 순수 가독성 문제.

- **[INFO]** `redact-stored-error.ts` 의 JSDoc 이 갱신마다 계속 길어짐
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` — `maskIfPresent` 함수(취소선+정정 블록, 파일 내 라인 128~135 부근) 상단 docstring
  - 상세: 이번 변경으로 함수 본문(약 5줄) 대비 docstring 이 더 늘어(원문 취소선 보존 +
    정정 단락 9줄 추가) 코드:주석 비율이 한층 더 벌어졌다. 이 저장소는 근거 문서화를
    적극 권장하는 컨벤션을 갖고 있어 의도적 스타일로 보이며, 취소선 보존 방식도
    프로젝트의 "자기-반증형 소정정" 관례(원문 보존 + 정정 병기)와 부합한다 — 결함이
    아니라 향후 유사 정정이 누적되면 이 파일의 최상단 컨텍스트를 별도 문서(예:
    `spec/conventions/` 또는 모듈 레벨 README)로 옮기는 것을 고려할 만하다는 관찰이다.
  - 제안: 즉시 조치 불필요. 다음 정정이 하나 더 쌓이면 docstring 분리를 검토.

## 그 외 확인한 항목 (문제 없음)

- **일관성**: `@Column` 에 `type:` 을 신규로 추가한 자리(`durationMs`→`'int'`,
  `resourceType`/`endpointPath`/`avatarUrl`/`oauthProvider`/`oauthProviderId`→`'varchar'`)는
  모두 plan 문서가 명시한 두 단계 규칙("타입 넓히기 + 같은 `@Column` 에 `type:` 이
  없으면 DB 실측 기반으로 명시")을 정확히 따르고 있다. 반대로 `triggerId`/`executedBy`/
  `parentExecutionId`(`execution.entity.ts`)처럼 `type:` 이 없는 채 그대로 남은 필드는
  전부 같은 엔티티의 `@JoinColumn({ name: … })` 이 동일 컬럼명을 참조하는 FK 라 관계가
  타입을 공급하는 문서화된 예외에 해당한다 — 예외 적용이 기계적이고 일관적임을 9개
  파일 전수 대조로 확인했다.
- **함수 길이/중첩/복잡도**: `maskIfPresent`, `redactNodeExecutionRowForResponse` 등
  변경된 함수는 원래도 짧고 이번 변경은 시그니처 타입 확장뿐이라 복잡도 증가 없음.
- **매직 넘버/중복**: 엔티티 파일 간 `@Column({...})` 반복은 TypeORM 선언 관례상
  불가피한 보일러플레이트이며 이번 diff 가 새로 만든 중복이 아니다.
- **네이밍**: 변경 범위 내 신규 식별자 없음(기존 필드명 유지, 타입만 확장).
- **회귀 방지**: plan 문서에 따르면 이 변경 클래스(넓혔지만 `type:` 누락)를 잡는
  repo-guard(`findUntypedNullableColumns`)가 이미 배치 1에서 추가되어 향후 유사 누락을
  기계적으로 잡는다 — 유지보수성 측면에서 긍정적 장치.

## 요약

전체적으로 매우 규율 있고 기계적인 리팩터링이다. 9개 엔티티 파일에 동일한 두 단계
규칙(타입 확장 + 필요 시 `type:` 명시)을 예외 없이 일관 적용했고, FK/관계 컬럼에 대한
예외도 전 파일에서 정확히 지켜졌다. `redact-stored-error.ts` 의 docstring 정정은 원문을
취소선으로 보존하며 실제 반증(entity nullable 배치 2로 인한 전제 붕괴)을 명시해 다음
독자가 추적 가능하다. 실질적인 가독성·복잡도·중복·네이밍 결함은 발견되지 않았고,
plan 문서의 헤딩 앞 빈 줄 누락 및 docstring 길이 증가 추세는 각각 사소한 관찰(INFO)일
뿐 코드 유지보수성에 실질적 위험을 주지 않는다.

## 위험도

LOW
