# 유지보수성(Maintainability) 리뷰

## 리뷰 대상 개요

실제 코드/문서 변경분(`origin/main...HEAD`)은 아래 14개 파일로 확정된다(`git diff --stat` 로 재확인):

- 엔티티 9개(`execution` · `knowledge-base` · `node-execution` · `node` · `notification` ·
  `schedule` · `trigger` · `user` · `workflow`) — `nullable: true` DB 컬럼/relation 필드
  타입을 `| null` 로 넓히고, 일부 `@Column` 에 `type:` 을 명시.
- `shared/utils/redact-stored-error.ts`/`.spec.ts` — 위 확장의 fallout(시그니처·제네릭
  제약 확장, docstring 취소선 정정, 불필요해진 이중 캐스트 제거).
- `hooks.service.spec.ts` · `schedule-runner.service.spec.ts` — `null as unknown as Date`
  이중 캐스트 제거(타입이 넓어져 불필요해짐).
- `plan/in-progress/entity-nullable-column-type-mismatch.md` — 배치 2 진행 기록(+ 이전
  두 리뷰 라운드의 WARNING 3건에 대한 fix 커밋 2개 포함).

나머지(`review/code/2026/09/03/16_45_35/**`, `17_09_06/**`, `review/consistency/**`)는
이전 리뷰 라운드 산출물이 diff 에 실려 있는 것으로, `origin/main...HEAD` 코드 diff 범위
밖(별도 review 산출 디렉터리)이라 이 리뷰의 유지보수성 평가 대상에서 제외했다 — 이미 그
라운드들 자체가 서로를 검토했고, 이 라운드의 관심사는 그 위에 새로 얹힌 fix 커밋
(`a7b9667bc`, `431c62d15`)이 만든 실제 코드/plan 변경이다.

이전 두 라운드(`16_45_35`, `17_09_06`)가 WARNING 7건(허위 완료 주장 2건, plan 체크리스트
구조 결함 2건, 낡은 캐스트/주석 3건)을 이미 찾아 전부 조치했다. 이번 라운드에서 그 fix 가
실제로 반영됐는지 원본 파일을 직접 열어 재확인했다.

## 재확인한 항목 (문제 없음)

- `plan/in-progress/entity-nullable-column-type-mismatch.md:184-186` — 이전 라운드 W1
  ("헤딩 앞 빈 줄 삽입"이 삽입 안 됐다고 지적됨)이 이번엔 실제로 삽입돼 있음을 확인.
- `plan/…mismatch.md:240` — `(d) Schedule.lastRunAt` 후보 목록 항목이 취소선(`~~`) 처리되고
  "배치 2 에서 해소됨" 참조가 붙어 있어, 완료/미해결 이중 표기 문제가 해소됨을 확인.
- `hooks.service.spec.ts:149`, `schedule-runner.service.spec.ts:83,211` — `null as unknown as
  Date` 캐스트가 전부 `null` 로 단순화됨. 가독성 개선이며 부작용 없음(엔티티 타입이 이미
  `| null` 이라 대입 타입체크가 그대로 통과).
- `redact-stored-error.ts:128-135` (`maskIfPresent` docstring), `redact-stored-error.spec.ts:
  294-305` — 반증된 전제를 원문 취소선 보존 + 정정문(날짜·근거) 병기 방식으로 갱신. 프로덕션
  JSDoc 과 spec 주석 양쪽이 이제 같은 결론을 서술해, 이전 라운드가 지적한 "정정이 형제 파일에
  미러링되지 않는" 문제가 더 이상 없다.

## 발견사항

- **[INFO]** 같은 diff 안에서 새로 포맷된 `@Column` 옵션의 키 순서가 자기 자신과도 불일치
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts` —
    `resourceType` 컬럼의 `@Column({...})` (해당 함수/블록: `resourceType` 필드 선언부,
    `name: 'resource_type'` 로 시작하는 블록)
  - 상세: 이번 배치가 멀티라인으로 재포맷한 4개 `@Column` 중 `endpointPath`
    (`trigger.entity.ts`) · `oauthProvider` · `oauthProviderId`(`user.entity.ts`) 세 곳은
    전부 `name → type → nullable → length` 순서를 쓴다. 이 순서는 이 diff 가 건드리지 않은
    기존 컬럼들(`user.entity.ts` 의 `passwordHash` · `twoFactorSecret` · `emailVerifyToken`
    등, 전부 `name → type → nullable → length`)과도 일치해 사실상 이 코드베이스의 확립된
    관례다. 그런데 `resourceType` 만 `name → type → length → nullable` 순서로 `length` 와
    `nullable` 이 뒤바뀌어 있다. 객체 리터럴 키 순서라 TypeORM 동작에는 영향이 없지만, 같은
    커밋에서 같은 이유로 같은 모양으로 재포맷된 4곳 중 1곳만 다른 순서를 쓴 것은 "기계적으로
    일관 적용했다"는 이 배치의 자체 원칙(plan 문서 §배치 규칙)에서 벗어난 소소한 흠이다.
  - 제안: `resourceType` 의 `@Column` 옵션 순서를 `name, type, nullable, length` 로 맞춘다
    (기능 영향 없는 cosmetic 변경이라 이번 diff 를 막을 사유는 아님).

## 그 외 확인한 항목 (문제 없음)

- **가독성/네이밍**: 필드명·타입명 변경 없음(타입 확장만). `redact-stored-error.ts` 의
  docstring 은 길지만 이 저장소가 반복적으로 채택해 온 "근거를 코드 옆에 남긴다" 스타일과
  일치하고, 취소선 보존 방식은 자기-반증형 소정정 컨벤션에 정확히 부합한다(이전 라운드에서도
  모범 사례로 확인됨, 이번에도 재확인).
- **함수 길이/중첩/복잡도**: 변경된 함수(`maskIfPresent`, `redactNodeExecutionRowForResponse`)
  모두 원래도 짧고 순환 복잡도 변화 없음. 신규 분기·중첩 없음.
- **매직 넘버**: `length: 50/255/500` 등은 DB 컬럼 실측치를 그대로 옮긴 것으로, plan 문서가
  `information_schema` 대조 근거를 명시하고 있어 매직 넘버가 아니라 스키마 계약의 반영이다.
- **중복 코드**: 엔티티 파일 간 `@Column({...})` 반복은 TypeORM 선언 관례상 불가피한
  보일러플레이트이며 이 diff 가 새로 만든 중복이 아니다.
- **일관성**: `type:` 부여/면제 규칙(관계가 타입을 공급하는 FK 컬럼은 면제)이 9개 파일 전체에
  기계적으로 일관 적용됐음을 직접 대조로 확인(예: `execution.entity.ts` 의 `triggerId`/
  `executedBy`/`parentExecutionId` 는 각각 `trigger`/`executor`/`parentExecution` 관계와
  `@JoinColumn` 컬럼명이 일치해 `type:` 면제 대상). 위 INFO 1건을 제외하면 이번 배치가
  스스로 세운 규칙을 어긴 자리는 없다.

## 요약

3라운드째 이어진 매우 규율 있는 기계적 리팩터링이다. 이전 두 리뷰 라운드가 찾은 WARNING
7건(허위 완료 주장·plan 체크리스트 구조 결함·낡은 캐스트/주석 불일치)은 이번 세션에 실제로
반영됐음을 원본 파일을 직접 열어 재확인했고, 새로 발견된 결함은 `notification.entity.ts`
의 `@Column` 키 순서가 같은 diff 안의 형제 3곳·기존 관례와 어긋나는 순수 cosmetic 불일치
1건(INFO)뿐이다. 함수 길이·중첩·매직 넘버·중복·네이밍 관점에서 실질적 문제는 없다.

## 위험도

NONE
