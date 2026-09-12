# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `uuid.ts` JSDoc 이 여러 라운드에 걸쳐 반복 확장된 결과, 함수 하나(`isUuidShaped`)의 문서화 블록이 매우 길다(22P02 마스킹 메커니즘·Rationale 인용·캐너리 집계 방법까지 포함).
  - 위치: `codebase/backend/src/common/utils/uuid.ts:16`~`58` (`isUuidShaped` JSDoc 전체)
  - 상세: 다만 이 확장은 임의 추가가 아니라 3라운드 연속 리뷰(`23_19_03`→`23_40_57`→`00_13_51`)가 지적한 "근거 주석 3중 복제" 문제를 SoT 로 집약하며 생긴 결과로, plan 체크리스트(`plan/in-progress/keyset-cursor-uuid-validation.md:205`)에 그 경위가 기록돼 있다. 스코프 이탈이 아니라 리뷰 피드백에 대한 정당한 응답이다.
  - 제안: 조치 불요. (참고용으로만 기재)

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 작업 도중 발견한 항목 6건(계약 비대칭·주석 복제·디코더 중복·spec 카탈로그 갭 3건)이 한 번에 추가되고, 기존 `GlobalExceptionFilter` 22P02 항목은 취소선 처리 후 won't-do 로 종결됐다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3168`~`3266`
  - 상세: 대상 tracker 파일 자체가 이번 작업의 직접 파생물(등재 조건이 실측에 반증되어 착수 시점에 처방을 재검토)이며, `developer` 의 `plan/**` 쓰기 권한 범위 안이고, 원문은 삭제가 아니라 취소선으로 보존했다(정정 컨벤션 준수). 스코프 이탈로 보지 않는다.
  - 제안: 조치 불요.

## 점검 결과 요약 (관점별)

1. **의도 이상의 변경** — 없음. 커밋 목적("keyset 커서 id 성분 미검증으로 인한 22P02→500 마스킹")과 diff 11개 파일이 전부 직접 대응한다: 술어 정의(`uuid.ts`)·두 소비처(`login-history.service.ts`, `background-runs.service.ts`)·각 unit/e2e 테스트·CHANGELOG·plan 문서.
2. **불필요한 리팩토링** — 없음. `login-history.service.spec.ts`(`:148`)의 기존 테스트 fixture `'cursor-id'` → UUID 치환은 신규 검증 로직이 도입되면서 기존 fixture 가 "결함을 정상으로 고정"하던 상태였기 때문에 불가피한 수정이며(주석에 근거 명시), 논리적 리팩토링이 아니다.
3. **기능 확장** — 없음. 오히려 plan 문서(`keyset-cursor-uuid-validation.md:97`~`108`)에 "가드는 만들지 않는다"는 의도적 범위 축소 근거까지 명시돼 있어 over-engineering 방향과 반대다. 두 디코더의 실패 계약(무시 vs 400)을 통일하지 않고 각자 유지한 것도 "관측 가능한 동작 변경은 별건"이라는 의도적 범위 억제다.
4. **무관한 수정** — 없음. 11개 파일 전부 keyset 커서 검증이라는 단일 축에 묶인다. `spec/` 디렉터리는 전혀 건드리지 않았고(`spec_impact: none`), 이는 developer 의 쓰기 권한 경계와 일치한다.
5. **포맷팅 변경** — 관찰되지 않음. diff 는 전부 의미 있는 라인 추가/치환이며 순수 공백·줄바꿈성 변경은 보이지 않는다.
6. **주석 변경** — `uuid.ts`/`uuid.spec.ts`/`login-history.service.ts`/`background-runs.service.ts` 전반에 주석 재배치가 있으나, 전부 리뷰 라운드가 지적한 "근거 주석 중복"·"캐너리 목록 stale" 문제에 대한 직접 응답이다(위 INFO 참조). 임의의 주석 정리가 아니다.
7. **임포트 변경** — `login-history.service.ts`·`background-runs.service.ts` 에 `isUuidShaped` import 각 1건 추가, 둘 다 실사용됨. 불필요한 임포트나 정리성 임포트 변경 없음.
8. **설정 변경** — 없음. 설정 파일(`.json`, `.env`, CI yaml 등) 변경 없음.

## 요약

변경 범위는 "keyset 커서의 id 성분이 검증 없이 uuid 컬럼에 바인딩되어 22P02 가 500 으로 마스킹된다"는 단일 결함 축에 밀착돼 있다. 술어 정의·두 소비처·대응 unit/e2e 테스트·CHANGELOG·plan 트래커까지 전부 그 축의 직접 파생물이며, 필터(`GlobalExceptionFilter`) 수정 제안은 검토 후 명시적으로 기각·근거 기록됐고 두 디코더의 계약 통일도 "별개 제품 결정"으로 의도적으로 배제해 오히려 스코프 팽창을 스스로 차단했다. 유일하게 눈에 띄는 것은 3라운드 리뷰를 거치며 두터워진 JSDoc/주석과 plan tracker 에 한 번에 등재된 6개 후속 항목인데, 둘 다 이번 세션의 실제 리뷰 이력에 대한 정당한 응답이라 스코프 이탈로 보지 않는다.

## 위험도

NONE
