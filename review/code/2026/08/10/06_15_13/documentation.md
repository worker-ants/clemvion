# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 보존된 주석에 특정 줄 번호(`workspace-context.util.ts:74`)가 하드코딩되어 있어 향후 드리프트 위험
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:55` (동일 문구가 `codebase/backend/src/common/utils/uuid.ts:31` 부근 SoT docstring 에도 없고, 이 spec 파일에만 남아 있음)
  - 상세: 이번 diff 로 대부분의 중복 산문은 `uuid.ts`(`isUuidShaped` docstring)를 SoT 로 삼아 포인터로 축약됐다. 다만 plan(`auth-guard-reflection-hardening.md`)이 명시적으로 밝히듯, "이 둘이 유일한 방어선" + "프로덕션 호출부는 `workspace-context.util.ts:74` 한 곳뿐" 이라는 사실은 SoT 쪽에 없어서 의도적으로 남겨 두었다(선별 삭제, 근거는 확인됨 — `uuid.ts` 를 직접 열어 대조함). 이 판단 자체는 타당하지만, 남겨진 문장이 파일 내 정확한 줄 번호(`:74`)를 인용하고 있어 `workspace-context.util.ts` 가 리팩터링되면 조용히 stale 해질 수 있다. 이 프로젝트가 이미 "같은 정정이 여러 곳에 복제돼 있다가 한 곳만 갱신된다" 는 결함 클래스(`#1112`, `#1113`)를 두 번 겪었다고 스스로 기록하고 있어, 줄 번호 인용도 같은 클래스의 잠재 씨앗이다.
  - 제안: 필수는 아니나, 다음에 이 주석을 만질 기회가 있으면 정확한 줄 번호 대신 "유일한 프로덕션 호출부"라는 사실 자체(줄 번호 없이)만 남기거나, 함수/파일 단위로만 지칭하는 편이 더 안전하다. 급하지 않음 — 이번 PR 의 스코프(문서 중복 제거)를 넘는 개선이라 지금 처리하지 않아도 무방하다.

- **[INFO]** `uuid.ts` 가 두 파일로부터 "SoT" 로 지목되지만, `uuid.ts` 자신의 docstring 에는 그 사실에 대한 역참조가 없음
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (파일 전체 — 이번 diff 대상 아님, `isUuidShaped` 함수 docstring)
  - 상세: `workspace-id-fixtures.ts:50`(게이트) 과 `uuid.spec.ts:51`(게이트) 양쪽이 "근거와 앵커 정정 이력은 `uuid.ts` 의 `isUuidShaped` docstring 이 SoT 다" 라고 명시적으로 의존을 선언한다. 실제로 `uuid.ts` 의 docstring 을 열어 대조한 결과 내용은 정확히 일치했다(근거·앵커 정정 이력 모두 포함, 단 "유일한 방어선" 사실은 의도적으로 미포함 — 위 항목 참고). 다만 `uuid.ts` 쪽에는 "이 문서가 다른 2곳의 SoT 로 참조된다" 는 역방향 안내가 없어, 나중에 이 docstring 을 수정하는 사람이 두 소비처가 있다는 사실을 모를 수 있다.
  - 제안: 선택 사항. `uuid.ts` docstring 끝에 "이 문단은 `workspace-id-fixtures.ts`/`uuid.spec.ts` 의 SoT 로 참조된다" 한 줄을 추가하면 향후 편집자가 파급을 인지하기 쉬워진다. 낮은 우선순위.

- **[INFO]** 새로 추가된 값 유일성 런타임 가드에 대한 문서화 자체는 우수하나, 발동 시점(모듈 로드)이 CI 게이트 문서에는 반영되지 않음
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:54-78` (`ALL_WS` JSDoc + `if` 블록)
  - 상세: JSDoc 이 "테스트가 아니라 로드 시점 런타임 검사" 라고 명확히 표시했고, `git log -S`/뮤테이션 근거까지 plan 에 적혀 있어 문서 품질 자체는 충분하다. 다만 이 가드가 throw 하면 그 모듈을 import 하는 모든 jest 스위트가 (개별 테스트 실패가 아니라) **suite 자체 로드 실패**로 나타난다는 성격은 파일 내부 어디에도 명시돼 있지 않다 — CI 로그를 처음 보는 사람이 "왜 3개 스위트가 동시에 깨졌지" 하고 헤맬 수 있다.
  - 제안: 사소한 개선 제안이라 blocking 아님. 필요하면 throw 메시지에 "3개 소비 스위트가 이 시점에 동시 실패한다" 한 문구를 덧붙이는 정도로 충분(이미 JSDoc 에는 있고 throw 메시지에만 없음).

## 요약

이번 diff 는 그 자체가 문서화 품질 개선 작업이다 — 이전 라운드에서 4곳(`uuid.ts` docstring · `uuid.spec.ts` 주석 · `workspace-id-fixtures.ts` · plan 문서)에 산문으로 복제돼 있던 nil-UUID 캐너리 근거/앵커 정정 이력을 `uuid.ts` 의 `isUuidShaped` docstring 한 곳으로 SoT 화하고 나머지는 1줄 포인터로 축약했다. 실제로 `uuid.ts` 를 열어 대조한 결과 포인터가 가리키는 내용이 정확히 존재했고, SoT 에 없는 사실(유일한 방어선·전역 라우트 예외)은 의도적으로 남겨 선별 삭제가 정확했음도 확인했다. `workspace-context.util.spec.ts` 등 plan 이 언급하지 않은 파일에는 애초에 중복 산문이 없어 컨소시데이션 범위 판단도 정확하다. 새로 추가된 `ALL_WS` 값 유일성 런타임 가드는 JSDoc·에러 메시지·plan 서술이 상호 일치하며 뮤테이션 근거까지 문서화돼 있다. CHANGELOG·README 업데이트는 이 변경이 순수 내부 테스트 인프라/주석 정리라 불필요하다는 판단이 타당하다. 남은 지적은 전부 INFO 수준(줄 번호 인용의 장기 드리프트 위험, SoT 역참조 부재)으로, 이번 PR 스코프를 넘는 선택적 개선이다.

## 위험도

NONE
