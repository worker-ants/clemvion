# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `findStaleSpecCasts` 가 필드 **이름만으로** 판정해 "다른 엔티티" 충돌을 그대로 갖고 있다 — 이 PR 이 같은 문서에서 명시적으로 반증한 바로 그 실패 모드다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:144-154`(`widenedEntityFields` — 엔티티별 귀속 없이 전역 `Set<string>` 반환), `:159-181`(특히 `:172-178` "## 왜 오탐이 없나" 절), `:183-197`(`findStaleSpecCasts` 본문 — `widened.has(field)` 만으로 판정, 어느 엔티티를 겨눈 캐스트인지 전혀 확인하지 않음)
  - 상세:
    `widenedEntityFields` 는 저장소 전체 엔티티에서 `| null` 로 넓혀진 필드 **이름**만 모아 하나의 `Set<string>` 으로 반환한다. `findStaleSpecCasts` 는 spec 의 `<field>: null as unknown as` 캐스트를 이 집합에 `has(field)` 로만 대조한다 — 그 캐스트가 **어느 엔티티**를 겨눈 것인지는 전혀 보지 않는다.

    그런데 바로 이 PR 이 함께 수정한 `plan/in-progress/entity-nullable-column-type-mismatch.md` (:198-200, :212-214) 는 **자매 축**("응답 DTO 가 엔티티 nullable 필드를 non-null 로 문서화")에서 똑같은 필드-이름 매칭 방식이 "48건" 이라는 거짓 신호를 냈고, 그중 44건이 **"모듈 간 동명 충돌"**(서로 다른 엔티티의 동명 필드가 섞인 것)이었음을 실측으로 확인했다. 그 결론으로 "이 축에는 가드를 만들지 않는다 — **원리적으로 만들 수 없다**(… 다른 엔티티 세 형태가 전부 오탐이 된다)" 라고 명시적으로 적었다.

    `findStaleSpecCasts` 의 docstring(`:172-178`)은 이 자매 축과 자신을 대조하며 "판정이 **기계적**이다 … 걸린 자리는 예외 없이 제거 가능하고, 실제로 제거하면 `tsc` 가 그대로 통과한다" 고 주장하지만, 이 주장은 **엔티티 귀속을 확인하지 않는 한 성립하지 않는다** — DTO 축을 죽인 것과 동일한 "다른 엔티티 동명 충돌" 이 이 함수에도 구조적으로 그대로 있다.

    **실측으로 반증**(저장소 라이브 엔티티 스캔, 뮤테이션 없이 읽기 전용 스크립트로 확인): 같은 필드 이름이 한 엔티티에서는 `nullable`(넓혀짐), 다른 엔티티에서는 `non-null` 인 충돌이 저장소에 **20개** 존재한다 — 예: `userId`(`LoginHistory` 는 nullable, `WorkspaceMember`/`Notification`/`AuditLog` 등 8개 엔티티는 non-null), `workflowId`, `expiresAt`, `createdBy`, `content`, `title`, `triggerId` 등.

    **실제 구현으로 재현**(scratch 디렉터리에서 `ts-node` 로 저장소의 `nullable-type-lie-cast-guard.ts` 를 직접 import, 저장소 파일은 일절 쓰지 않음): `LoginHistory.userId`(nullable) 와 `WorkspaceMember.userId`(non-null, 별개 엔티티)를 픽스처로 주고, `WorkspaceMember` 를 겨눈 정당한 `userId: null as unknown as string` 캐스트를 spec 에 넣었더니 —
    ```
    widened set: [ 'userId' ]
    offenders: [ { file: '.../b.spec.ts', field: 'userId' } ]
    ```
    즉 `WorkspaceMember` 는 `userId` 가 non-null 이라 캐스트가 여전히 필요한데도 가드는 이를 "낡은 캐스트" 로 지목한다. docstring 의 "제거하면 `tsc` 가 통과한다" 는 이 경우 **거짓**이다 — 실제로 제거하면 `WorkspaceMember` 쪽에서 타입 오류가 난다.

    이 가드는 `nullable-type-lie-cast.spec.ts` 의 "저장소 전수" `describe` 블록에서 `expect(offenders...).toEqual([])` 로 CI 에 상시 배선돼 있다(`nullable-type-lie-cast.spec.ts:325-333`). 오늘은 0건이라 통과하지만, 위 20개 충돌 필드 중 하나를 겨눈 **정당한** 캐스트가 다른(non-null) 엔티티의 spec fixture 에 앞으로 추가되면 이 가드가 즉시 RED 를 내고, 가드가 제시하는 "고치는 법"(캐스트 제거)은 **틀린 처방**이라 그대로 따르면 실제 타입 안전성 회귀를 만든다.

    이 자체는 오늘 관측 가능한 결함(잔존 0)이 아니라 **잠재된 설계 결함**이지만, "왜 오탐이 없나" 라는 문서화된 방어 주장이 뮤테이션(실제로는 실제 구현 재현)으로 반증됐고, 정확히 이 diff 가 자매 축에서 스스로 발견해 가드 신설을 포기한 바로 그 실패 모드라는 점에서 근거 없이 넘어갈 수 없다.
  - 제안: `widenedEntityFields` 가 필드명이 아니라 `(엔티티 클래스명 또는 파일, 필드명)` 쌍을 반환하도록 바꾸고, `findStaleSpecCasts` 도 spec 캐스트가 어느 엔티티를 겨눈 것인지(예: `Partial<X>`/`as X` 캐스트 대상 타입, 또는 파일명 컨벤션)를 함께 확인해 그 쌍이 일치할 때만 offender 로 잡도록 좁힌다. 좁히기 전까지는 최소한 docstring 의 "왜 오탐이 없나" 절에 이 알려진 충돌 20건과 그 위험을 명시해, `WIDENED_DECL` INFO#1 처럼 "잠재적 한계로 기록된 채 방치" 상태로라도 남긴다.

## 요약

`collectTsFiles` 로의 walker 5-사본 통합과 `stripLiterals`/`sort()` 관련 1R 리뷰의 Warning 4건(정렬 회귀 커버리지, `stripLiterals` 전용 테스트, `withFiles`/`withFixture` 중복, `countCalls` JSDoc orphan)은 소스를 직접 열어 전부 올바르게 조치됐음을 확인했다(회귀 없음). 다만 신설 가드 `findStaleSpecCasts` 는 이 PR 이 같은 plan 문서에서 스스로 입증한 "필드 이름만으로는 서로 다른 엔티티의 동명 충돌을 가른다" 는 교훈을 적용받지 못했다 — 저장소에 이미 20개의 충돌 필드가 있고, 실제 구현을 재현해 정당한 캐스트가 오탐으로 잡히는 것을 직접 확인했다. 나머지 기능 완전성·엣지 케이스·반환값·에러 시나리오는 문제없다(모든 경로가 값을 반환하고, 빈 배열·옵션 기본값·`.d.ts`/`node_modules`/`dist` 처리가 테스트로 고정돼 있다). 이 변경 영역(내부 test-utils/repo-guards)을 규정하는 `spec/` 문서는 없다 — spec fidelity 관점은 해당 없음(INFO 수준, 실제 결함 없음).

## 위험도

MEDIUM
