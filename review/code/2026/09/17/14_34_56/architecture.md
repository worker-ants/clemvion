# 아키텍처(Architecture) 리뷰 — `trigger-save-partial-patch` (3라운드)

## 범위 요약

이 라운드(`origin/main..HEAD`, 46 files)에서 실제 애플리케이션 코드(`codebase/**`)·문서(`CHANGELOG.md`·
`plan/**`) 변경은 전 라운드(1·2라운드)와 동일하다 — `git diff --stat origin/main..HEAD -- CHANGELOG.md
codebase/ plan/` 로 확인한 실질 변경분은 7개 파일(핵심은 `triggers.service.ts` 의 `TriggersService.update()`
창 1: advisory lock 안 재읽은 엔티티 통째 `save` → 이 요청이 바꾸는 필드 + `config` 만 담은 부분 객체
`save`)이며, 나머지 39개 파일은 전부 `review/code/2026/09/17/{13_44_39,14_11_48}/**`·
`review/consistency/2026/09/17/13_04_39/**` — 1·2라운드 리뷰/일관성 검토 산출물이 이번에 커밋된 것으로
마크다운 기록물이지 코드가 아니다.

**2라운드 disposition 커밋(`d60cc65aa`)이 이번 라운드에서 새로 추가한 diff 는 `CHANGELOG.md` 4줄과
`trigger-transaction-mock.ts` 의 JSDoc 주석(뮤턴트 재측정 수치 서술 방식 변경)뿐이다** —
`git show --stat d60cc65aa` 로 직접 확인했다. `triggers.service.ts` 는 1라운드 disposition
커밋(`6d845d8a2`, `const patch` 단일화) 이후 이번 라운드까지 바이트 단위로 변경이 없다. 즉 아키텍처
관점의 실질 검토 대상은 **2라운드 아키텍처 리뷰(`review/code/2026/09/17/14_11_48/architecture.md`)가
이미 다룬 것과 동일한 코드**이며, 이번 라운드는 그 판단이 여전히 유효한지 재확인하는 것이 핵심이다.

## 검증한 것

- `grep -rn "m.save(Trigger" src/modules/triggers/` — 부분 객체 `save` 호출부는 여전히
  `triggers.service.ts:711` 단 한 곳뿐이다. 2라운드 아키텍처 리뷰가 지적한 "TypeORM 컬럼-diff 내부
  동작에 대한 서비스 계층 직접 의존"·"타입-런타임 불일치"가 두 번째 호출부로 확산되지 않았음을
  재확인했다.
- `git diff 6d845d8a2..d60cc65aa -- codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
  — 이번 라운드가 반영한 유일한 코드 파일 변경은 JSDoc 주석 내용(뮤턴트 재현 수치를 "60" 같은 특정
  값 대신 "형태에 따라 달라진다"는 규칙으로 바꿔 적음)뿐이고, `withTransactionMock` 의 실행 로직·타입·
  export 표면은 바이트 단위로 동일하다. 공유 테스트 더블을 한 곳에 두는 기존 구조(2라운드
  POSITIVE/INFO)에 대한 판단을 바꿀 변경이 아니다.
- `triggers.service.ts` 의 `update()` 전체(551~769행)를 다시 읽고, 2라운드 리뷰가 지적한 세 지점
  (SRP: 218줄 단일 메서드에 11개 관심사, DIP/레이어 경계: `EntityManager.save()` 컬럼-diff 내부 동작에
  대한 직접 의존, 추상화 충실도: `save<Entity>()` 타입 시그니처와 부분 객체 전달 시 실제 런타임 반환
  모양의 불일치)가 diff 상 그대로 남아 있고 새로 악화되지도 개선되지도 않았음을 대조했다.
- 신규로 커밋된 리뷰/일관성 산출물(`review/code/**/*.md`, `review/consistency/**/*.md`, `meta.json`,
  `_retry_state.json`)은 애플리케이션 코드가 아니므로 SOLID·결합도·레이어·순환의존·모듈 경계 어느
  관점으로도 검토 대상이 아니다 — 저장소 관례(`CLAUDE.md` "코드 리뷰 산출물"/"일관성 검토 산출물"
  저장 위치)가 리뷰 라운드마다 이전 라운드 산출물을 같은 브랜치에 커밋하도록 하므로, 이 파일들의 존재
  자체가 스코프 이탈이 아니다.

## 발견사항

새로 발견된 CRITICAL/WARNING 급 구조적 결함은 없다. 이전 라운드에서 이미 식별·기록된 INFO 세 건
(방금 재검증 완료, 재-flag 아님 — 참고용으로만 남긴다):

- **[INFO]** `TriggersService.update()` 는 여전히 11개 관심사가 뒤섞인 218줄 단일 메서드다(SRP).
  이번 라운드는 이 메서드의 코드를 전혀 건드리지 않았으므로 악화도 개선도 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TriggersService.update()`
  - 처분: 이전 두 라운드(`13_44_39`, `14_11_48`)가 이미 "이번 PR 스코프 밖 · 과거 분해 시도가
    깨졌던 이력 있음"으로 defer. 재차 동일하게 defer.

- **[INFO]** 서비스 계층이 TypeORM `EntityManager.save()` 의 컬럼-diff 내부 동작(문서화된 공식 계약이
  아닌 구현 세부사항)에 직접 의존하며, 그 지식이 30줄 넘는 인라인 주석으로 노출돼 있다(레이어 책임·DIP).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:680`~`711`
  - 처분: 2라운드가 이미 지적. 호출부가 여전히 1곳뿐이라 즉시 조치 불요, `TriggerRepository.savePartial()`
    류 헬퍼로 승격은 두 번째 호출부가 생길 때 재검토.

- **[INFO]** `save<Entity>(target, partial)` 타입이 항상 완전한 엔티티를 반환한다고 약속하지만, 부분
  객체를 넘기면 실제로는 넘기지 않은 nullable 컬럼이 `null` 로 채워진 객체가 온다 — 타입과 런타임
  모양의 불일치(추상화 충실도). 이 PR 자체가 이 간극으로 회귀를 냈다가 e2e 로 잡아 고쳤다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:711`, `713`~`716`
  - 처분: 현재 유일한 호출부이고 방어(`if (written.updatedAt)`)·회귀 테스트(`triggers.service.spec.ts`
    "save 반환값의 null 이 재읽은 값을 덮지 않는다")로 이미 검증됨. 조치 불요.

- **[INFO]** 신규 e2e(`trigger-update-save-window.e2e-spec.ts`)의 DB 접속 파라미터 하드코딩이
  `test/helpers/db.ts`의 `createDbClient()`와 별도로 중복 정의된 것(DRY, 테스트 스코프)도 변경 없이
  그대로다.
  - 처분: 2라운드가 이미 지적, 낮은 우선순위로 defer. 재-flag 아님.

## 검증하지 않은 것

- `mergeExternalConfig`/`stripInlineAuthKeys`/`mergeIntoFreshSubKey` 등 config 병합 로직 자체의
  아키텍처(순수성·책임 분리)는 이번에도 diff 의 직접 변경 대상이 아니라 상세 대조하지 않았다.
- 신규로 커밋된 39개 리뷰/일관성 산출물 markdown 파일의 내용 정확성(각 파일 자신의 실측 주장이
  맞는지)은 이 아키텍처 리뷰의 관점 밖이다 — 문서화·테스트 리뷰어의 영역이며, 실제로 documentation/
  testing 리뷰가 이미 이 산출물들의 자기모순(뮤턴트 재현 수치 등)을 다뤘다.
- 저장소 트리를 뮤테이션하는 검증(뮤턴트 적용 등)은 수행하지 않았다 — `git show`/`git diff`/`grep`/
  `Read` 만으로 이번 라운드의 실질 변경 범위(2개 파일, JSDoc·CHANGELOG 텍스트뿐)를 확정하기에
  충분했다. 저장소 상태를 변경하지 않았다(`git status --short` 확인 불필요 — 아무 파일도 건드리지
  않음).

## 요약

이번 3라운드에서 아키텍처 관점의 실질 코드 변경은 없다 — 핵심 수정(`TriggersService.update()` 창 1의
부분 객체 `save`)은 1라운드 disposition(`6d845d8a2`) 이후 바이트 단위로 동일하고, 2라운드
disposition(`d60cc65aa`)이 이번에 추가한 것은 `CHANGELOG.md` 서술과 테스트 더블의 JSDoc 주석뿐이라
런타임 동작·모듈 경계·의존 방향 어디에도 영향이 없다. 2라운드 아키텍처 리뷰가 식별한 세 INFO(대형
단일 메서드의 SRP 압박, 서비스 계층의 ORM 내부 동작 직접 의존, 타입-런타임 불일치)는 재검증 결과
그대로 유효하며 새로 악화되지 않았고, 전부 이전에 defer 처리된 항목의 재확인이다. 새 모듈·서비스
경계·순환 의존은 여전히 없고, 이번에 함께 커밋된 39개 리뷰/일관성 산출물은 저장소 관례에 따른 기록물로
아키텍처 검토 대상이 아니다. 이 PR 을 막을 구조적 사유는 없다.

## 위험도
LOW
