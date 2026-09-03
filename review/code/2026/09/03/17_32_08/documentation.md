# 문서화(Documentation) 리뷰

## 검토 범위 확인

이번 diff 는 `entity-nullable-column-type-mismatch` 작업의 **배치 1+배치 2 전체 누적분**(origin/main
대비 14개 파일, 156+/57-)이다. 실질 변경은 9개 TypeORM 엔티티 파일의 필드 타입을
`nullable: true` DB 컬럼에 맞춰 `T | null` 로 넓히고 일부 `@Column` 에 `type:` 을 명시한 것,
그 여파로 시그니처를 넓힌 `shared/utils/redact-stored-error.ts`/`.spec.ts`, 그리고 작업 기록인
`plan/in-progress/entity-nullable-column-type-mismatch.md` 다. 이 작업은 이미 두 차례 리뷰
라운드(`16_45_35`, `17_09_06`)를 거쳤고 그 라운드에서 발견된 WARNING 은 모두 이후 커밋
(`a7b9667bc`, `431c62d15`)으로 조치됐다 — 아래는 그 조치가 **실제로 현재 코드/문서에 반영돼
있는지 재확인**한 결과와, 신규 발견사항이다.

### 이전 라운드 WARNING 재확인 (실측)

- `16_45_35` W1(`NodeExecution.inputData` 를 넓혔다고 오기) → 현재 plan `:215-221` 은
  `outputData`/`error` **두 컬럼**으로 정정돼 있고, `inputData` 는 대상이 아니었음을 명시.
  실제 엔티티(`node-execution.entity.ts:69-70`)도 `inputData: Record<string, unknown>`
  (non-null, `nullable: true` 없음) 그대로임을 직접 확인 — 정정이 사실과 일치.
- `16_45_35` W2(체크리스트 두 헤딩 분산) → 현재 plan `## 할 일` 헤딩 바로 아래(`:162-163`)에
  "배치별 완료 체크박스는 각 배치 절에 있다" 는 상호 참조 안내가 있음을 확인.
- `16_45_35` W3(`(d) Schedule.lastRunAt` 완료/미해결 이중 표기) → 현재 plan `:240` 의 후보
  목록 쪽이 `~~**(d)**~~` 취소선 처리돼 있고 "배치 2 에서 해소됨" 으로 가리킴을 확인.
- `17_09_06` W1(INFO#8 "빈 줄 삽입됐다" 는 주장이 실은 거짓이었던 것) → 현재 plan
  `:184`(직전 문단 끝)와 `:186`(`## 배치 2 — 비대칭 해소 (완료)`) 사이 `:185` 에 실제로
  빈 줄이 존재함을 확인 — 이번에는 주장과 실물이 일치.

세 라운드에 걸쳐 재발했던 "확인 없이 완료라고 썼다" 패턴은, 이번에는 plan 자체가 그 실패
이력을 표(`:107-119` "이 작업에서 세 번 반복된 실패")로 박제하고 재발 방지 규칙("완료·추적
주장은 쓰기 전에 검증 명령을 돌린다")까지 적어 뒀다 — 자기 반증 이력을 지우지 않고 남긴
점은 CLAUDE.md 의 자기-반증형 소정정 관례와 부합한다.

## 발견사항

- **[INFO]** `redactNodeExecutionRowForResponse` 제네릭 제약이 실제 엔티티 계약보다 넓다 —
  이미 알려져 유예된 항목, 재확인 목적으로만 기재
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` — `redactNodeExecutionRowForResponse`
    함수의 제네릭 제약 (`T extends { inputData: Record<string, unknown> | null; ... }`)
  - 상세: 이 제약은 `inputData`/`outputData`/`error` 세 컬럼 모두 `| null` 을 요구하지만,
    실제 `NodeExecution.inputData` 엔티티 필드(`node-execution.entity.ts:69-70`)는
    `@Column({ type: 'jsonb', default: {} })` 로 `nullable: true` 자체가 없는 **non-null**
    필드다. JSDoc(`redactNodeExecutionRowForResponse` 상단, `error` 컬럼만 본다는 설명)은
    이 불일치를 명시하지 않는다. 다만 이는 이번 diff 가 새로 만든 문제가 아니라 배치 2
    작업 자체가 만든 상태이고, `17_09_06` 리뷰 라운드에서 이미 INFO#2 로 발견되어
    "구조적 서브타이핑상 호출부는 안전하고, 배치 3 에서 `inputData` 가 대상이 되는지 먼저
    보고 정밀화한다" 고 판단·유예된 사항이다(`review/code/2026/09/03/17_09_06/RESOLUTION.md`
    참조). 이번 라운드에서 실측 재확인만 하고 새 조치를 요구하지 않는다.
  - 제안: 조치 불요(유예 유지). 배치 3 착수 시 `redactNodeExecutionRowForResponse` 의
    제네릭 제약을 `inputData: Record<string, unknown>`(non-null)으로 정밀화하거나, 정밀화하지
    않기로 확정하면 그 이유를 docstring 에 한 줄 남기는 것을 권장.

## 참고 (조치 불요, 확인 목적)

- 9개 엔티티 파일의 인라인 주석·JSDoc 을 전수 대조한 결과, 이번 diff 가 non-null → `| null`
  로 넓힌 필드 옆에 그 변경과 모순되는 오래된(stale) 주석은 발견되지 않았다
  (`notification.entity.ts` 의 `resourceType`/`resourceId`, `trigger.entity.ts` 의
  `endpointPath`/`lastTriggeredAt`, `user.entity.ts` 의 `avatarUrl`/`oauthProvider*` 등은
  애초에 별도 설명 주석이 없던 자리라 갱신할 것이 없었다).
- `redact-stored-error.ts`/`.spec.ts` 의 docstring·테스트 주석 자기정정은 원문을 취소선으로
  보존하고 반증 날짜·근거·정정 결론을 나란히 적은 모범 사례로 재확인된다
  (`redact-stored-error.ts:128-135`, `redact-stored-error.spec.ts:294-305`). 특히
  `.spec.ts` 쪽 "`row` 헬퍼 파라미터가 이미 `Record<string, unknown>` 이라 캐스트가
  애초에 불필요했다" 는 주장을 실제 `row` 헬퍼 정의(`redact-stored-error.spec.ts:245-250`)로
  직접 대조해 정확함을 확인했다.
- `spec/1-data-model.md:260` 의 `Schedule.next_run_at` nullable(`?`) 표기 누락은 이 diff 의
  회귀가 아니고(변경 범위 밖 필드), plan `:168-175` 에 "developer 권한 밖 · planner 턴 후속"
  으로 이미 정확히 등재돼 있다 — 별도 조치 불요.
- CHANGELOG.md 미기재는 동일 이니셔티브의 선행 배치 1 커밋(`255aa8597`)도 마찬가지였던
  전례와 일치한다 — 내부 타입 정합화이고 wire-level 응답 스키마·런타임 동작에 영향이 없어
  결함으로 보지 않는다. README·API 문서·환경변수 문서·예제 코드 항목은 신규 기능/설정/엔드포인트
  가 없어 해당 없음.

## 요약

이 diff 는 두 차례 리뷰 라운드를 거치며 지적된 plan 문서의 서술 오류(존재하지 않는 컬럼을
넓혔다는 주장)·구조 문제(체크리스트 분산, `(d)` 항목 이중 표기, 신규 헤딩 앞 빈 줄 누락)를
모두 실제로 조치했음을 이번 라운드에서 직접 실측(`git show`/`sed`/entity 파일 대조)으로
재확인했다 — 특히 지난 라운드에 "고쳤다" 고 적었으나 실제로는 안 고쳤던 자리(신규 헤딩 앞
빈 줄)가 이번에는 실물과 일치한다. 코드 측 JSDoc·인라인 주석은 변경된 nullable 상태와
모순되는 stale 서술 없이 깨끗하고, `redact-stored-error.ts` 의 자기-반증형 소정정은 원문
보존 + 실측 근거 병기라는 프로젝트 관례를 정확히 따른다. 유일한 잔여 사항은 이미 알려져
배치 3 로 유예된 `redactNodeExecutionRowForResponse` 제네릭 제약과 `NodeExecution.inputData`
실제 계약 간의 미세한 괴리로, 판단이 이미 내려져 있어 INFO 로만 재기재했다. README·API
문서·CHANGELOG·설정 문서·예제 코드는 이번 변경 범위(내부 타입 정합화, 동작 불변)와 무관해
해당 없음으로 판단했다.

## 위험도

NONE
