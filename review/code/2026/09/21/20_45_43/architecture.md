# 아키텍처(Architecture) 리뷰

## 대상

`codebase/backend/test/helpers/concurrency.ts` 로 아홉 파일 11 블록의 동시성 e2e
"BEGIN → 락 → 발사 → 공허성 가드 → COMMIT/ROLLBACK" 보일러플레이트를 추출한 순수 리팩터 +
이전 라운드(`review/code/2026/09/21/20_26_50`)의 WARNING/INFO 를 반영한 후속 커밋
(`6b29435ac`, `PROJECT.md` 가이드 반영 + `VACUITY_GUARD_MS` 관계를 주석에서 런타임 assert 로 전환).
`plan/in-progress/e2e-race-helper.md`, `review/consistency/2026/09/21/19_59_55/**`,
`review/code/2026/09/21/20_26_50/**` 는 프로젝트 컨벤션상 정상 산출물이라 컨텍스트로만 참고했다.
프로덕션 코드(`codebase/backend/src/**`) 변경은 없다.

## 발견사항

- **[WARNING]** 도메인 무관 공용 헬퍼가 특정 도메인 모듈의 상수에 역방향으로 결합됨(경계 침범)
  - 위치: `codebase/backend/test/helpers/concurrency.ts:4`
    (`import { TRIGGER_DELETE_LOCK_TIMEOUT_MS } from '../../src/modules/triggers/trigger-config-lock';`)
  - 상세: `raceUnderHeldLock()` 은 9개 리소스(인증 설정·통합·멤버·모델 설정·스케줄·트리거·웹인증 자격증명·
    워크플로·워크스페이스)의 삭제 경합을 다루는 **범용** 오케스트레이션 헬퍼인데, 정작 자기 자신의
    안전 검사(`VACUITY_GUARD_MS` 상한 검증)를 위해 `triggers` 도메인의 `trigger-config-lock.ts` 를
    직접 import 한다. 이 헬퍼의 실제 호출부 9파일 중 트리거 도메인과 관련 있는 것은
    `trigger-`·`schedule-delete-concurrency.e2e-spec.ts` 뿐이고(그 둘은 이미 이 상수를 직접 참조하는
    맥락이 있었다), 나머지 7파일(`auth-config`·`integration`·`member-remove`·`model-config`·
    `webauthn-credential`·`workflow`·`workspace`)은 트리거와 무관한데도 이 import 를 통해 간접적으로
    트리거 모듈에 묶인다. 이는 SRP/DIP 관점에서 방향이 거꾸로다 — **낮은 수준의 범용 유틸리티가
    특정 상위 도메인 모듈을 알아야** 하는 구조가 됐다. `trigger-config-lock.ts` 가 리네임·이동되거나
    (`export const TRIGGER_DELETE_LOCK_TIMEOUT_MS` 가 사라지거나 값이 바뀌면) 이 헬퍼를 쓰는 9파일
    11블록 전부가 컴파일/런타임에서 동시에 영향을 받는다 — 리팩터로 실패 반경이 1파일→11콜사이트로
    넓어진 것과 같은 맥락의 결합이 여기서도 재현된다.
  - 제안: 이 상수를 헬퍼 밖으로 빼내 (예: `test/helpers/concurrency.ts` 가 아니라 e2e 진입점 레벨에서
    한 번 검증하거나) `guardMs` 를 헬퍼의 필수/옵션 파라미터로 받고, "이 값이 프로덕션의 가장 짧은
    잠금 상한보다 작은가"의 검증 책임은 호출부(트리거/스케줄 스펙)가 자신이 아는 상수로 지도록
    분리한다. 최소한 도메인 상수 import 를 헬퍼 함수 시그니처의 계약이 아니라 "현재 알려진 하나의
    참조점" 임을 JSDoc 에 명시해 결합의 이유를 남긴다.

- **[INFO]** 런타임 assert 의 실제 검증 범위가 JSDoc 이 주장하는 보장보다 좁음
  - 위치: `codebase/backend/test/helpers/concurrency.ts:9`(JSDoc: "프로덕션의 가장 짧은 잠금 대기
    상한보다 짧아야 한다")와 `:19-24`(실제 검사: `VACUITY_GUARD_MS >= TRIGGER_DELETE_LOCK_TIMEOUT_MS`)
  - 상세: JSDoc 문구는 "프로덕션의 **가장 짧은** 잠금 대기 상한"이라는 전역적 주장을 하지만, 실제
    코드가 비교하는 대상은 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 라는 **이름이 고정된 상수 하나** 뿐이다.
    현재는(실측: `grep -rn "LOCK_TIMEOUT_MS\s*="`) 백엔드 전체에서 명시적 `lock_timeout` 을 거는
    경로가 이 상수 하나뿐이라 우연히 참이지만, 이 관계는 "전역 최솟값"을 동적으로 계산해서 나온
    보장이 아니라 "현재 알려진 유일한 경쟁자와의 비교"일 뿐이다. 이 리팩터의 존재 이유가
    "손으로 지키는 불변식은 조용히 깨진다"(plan §A)인데, 그 이유로 새로 넣은 이 assert 자체가
    향후 다른 도메인(예: `model-config`·`webauthn` 삭제 경로)이 1.5초 미만의 자체 `SET LOCAL
    lock_timeout` 을 도입하면 그 사실을 감지하지 못한 채 조용히 통과한다 — 이번 PR 이 막으려던
    것과 같은 종류의 "문서된 보장 > 실제 구현 범위" 갭이다.
  - 제안: JSDoc 문구를 "현재 알려진 가장 짧은 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)보다 짧아야
    한다 — 새 도메인이 더 짧은 `lock_timeout` 을 도입하면 그 상수도 이 비교에 추가해야 한다"처럼
    범위를 좁혀 적거나, 여러 도메인 상수를 배열로 모아 `Math.min(...)` 과 비교하는 형태로 바꿔
    "전역 최솟값"이라는 주장과 구현을 일치시킨다.

## 긍정적 관찰

- **DRY + 단일 책임**: 아홉 파일 11 블록에 손으로 복제돼 있던 "BEGIN→락→발사→공허성 가드→COMMIT,
  finally ROLLBACK+pending 흡수" 프로토콜을 제네릭 `raceUnderHeldLock<T>()` 하나로 응집시켰다.
  락 SQL·발사 thunk·결과 정렬(도메인 지식)은 호출부에 남기고, 트랜잭션 생명주기·공허성 가드(반복되던
  정확한 실수 지점)만 헬퍼로 옮긴 경계 설정이 정확하다.
- **후속 커밋의 실질적 개선**: 이전 라운드 WARNING(`PROJECT.md` 가이드 미반영)과 INFO(공허성
  가드-프로덕션 상한 관계가 주석으로만 존재)를 각각 문서 추가·런타임 assert 전환으로 실제로 닫았다.
  주석을 검사로 바꾼 방향 자체는 옳다 — 문제는 그 검사가 커버하는 범위가 좁다는 것(위 INFO)이지,
  "주석 대신 코드" 라는 접근은 이 프로젝트의 원칙과 일치한다.
- **레이어 경계**: 신규 헬퍼는 `pg.Client`/`@jest/globals` 외 프로덕션 모듈 import 가 새 순환을
  만들지 않는다(`trigger-config-lock.ts` → `test/**` 역참조 없음, 확인함). 인터페이스 설계
  (`fires: Array<() => Promise<T>>`, 결과 미정렬 반환)도 호출부 지식이 헬퍼로 새지 않게 막았다.
- **의도적 배제**: `integration-rotate-concurrency` 를 "구조가 다르다"는 근거로 이 추출에서 제외한
  판단(plan §B)은 억지 일반화 안티패턴을 피한 좋은 판단이다.

## 요약

프로덕션 코드에 영향이 없는 순수 테스트 인프라 리팩터로, 11곳에 중복된 동시성 레이스 오케스트레이션과
그 안의 "공허성 가드"를 제네릭 헬퍼 함수 하나로 정확히 추출했고, 이전 리뷰 라운드의 지적(가이드 문서
누락, 상수 관계의 비강제성)도 실질적으로 반영했다. 다만 그 반영 과정에서 새로 생긴 구조적 특성이
있다 — 트리거 도메인 전용이던 상수를 헬퍼가 직접 import 하면서, 트리거와 무관한 7개 호출부가
간접적으로 트리거 모듈에 결합됐고(WARNING), 그 assert 가 주장하는 "프로덕션 전역 최소 상한"이라는
문구는 실제로는 "현재 알려진 상수 하나와의 비교"에 그친다(INFO). 두 사안 모두 테스트 전용 코드의
경계 문제라 사용자 대면 리스크는 없고 CRITICAL 급은 아니지만, 이 리팩터의 핵심 동기("손으로 지키는
불변식은 조용히 깨진다")를 다음 도메인이 이 헬퍼를 확장할 때도 지키려면 결합 방향과 검증 범위를
좁혀 문서와 일치시키는 것이 좋다.

## 위험도

LOW
