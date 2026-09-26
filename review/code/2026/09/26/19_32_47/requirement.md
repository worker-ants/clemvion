# 요구사항(Requirement) 리뷰 — request-body-advertised 가드

## 검증 방법
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`, `request-body-advertised.spec.ts`, `swagger-probe.ts`, `validation.pipe.ts`, `forbidden-response-codes-guard.ts`(형제 가드, 타입 재사용 확인용), `spec/conventions/swagger.md` §5-4/Rationale 을 `Read` 로 전문 대조.
- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js repo-guards/__tests__/request-body-advertised.spec.ts` 를 저장소 안에서(뮤테이션 없이) 실행 — **6/6 PASS** 확인(plan 의 "TEST WORKFLOW PASS" 주장을 재실측으로 대조).
- 저장소 파일은 읽기만 했고 아무것도 고치지 않음. 종료 시 `git status --short` 결과: `?? review/code/2026/09/26/19_32_47/` 만 존재(이 리뷰 산출물 자신) — 뮤테이션 잔여물 없음.

## 발견사항

- **[INFO]** 키 지정 `@Body('a')`/`@Body('b')` 처럼 한 핸들러에 `@Body()` 자리가 여럿이면 `advertisesBody()` 가 핸들러 단위로만 `@ApiBody` 유무를 보므로, 자리 중 하나만 실제로 문서화돼도 나머지 키 자리까지 "광고됨"으로 처리된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` 함수 `advertisesBody` (약 59~64행) 및 `scanRequestBodyAdvertised` 의 `if (advertisesBody(route)) continue;` 분기(92행)
  - 상세: 가드 자신의 JSDoc(70행) 과 spec Rationale("못 보는 것 — `@ApiBody` 가 **맞는** DTO 를 가리키는지는 보지 않는다")이 이 한계를 이미 명시하고 있어 의도된 스코프 밖이다. 버그가 아니라 문서화된 커버리지 경계.
  - 제안: 조치 불필요. 실제 라우트에서 다중 키 `@Body()` 패턴이 생기면 라우트별 캐너리(`*-body.spec.ts`)가 정확한 매칭을 보완한다는 기존 설계 그대로.

- **[INFO]** `spec/conventions/swagger.md` §5-4 절 제목이 "새 엔드포인트 체크리스트"인데 이번 항목도 (형제 항목 §2-4, 403-설명과 마찬가지로) 기존 라우트까지 소급 적용된다 — 제목과 실제 적용 범위의 괴리가 이번으로 3번째 누적.
  - 위치: `spec/conventions/swagger.md` `### 5-4. 새 엔드포인트 체크리스트` 제목, 신규 불릿(§5-4 체크리스트 "요청 본문을 받는 라우트는...")
  - 상세: 이미 `review/consistency/2026/09/26/19_09_17/convention_compliance.md` INFO #4 로 식별·plan 에 "이번 PR 범위 밖"으로 명시 기록됨. 새로 발견한 결함이 아니라 기존에 추적 중인 항목의 재확인.
  - 제안: 신규 조치 불필요 — 이미 planner 인계 대상으로 트래킹됨(제목을 소급 포함 문구로 조정하는 후속 편집은 별도).

## 요구사항 충족 관점 평가

`request-body-advertised` 가드는 spec(`spec/conventions/swagger.md` §5-4 신규 체크리스트 불릿, Rationale "왜 클래스로 받게 강제하지 않고 왜 reflection 으로 세는가")과 구현이 line-level 로 정확히 일치한다 — 판정 축(`design:paramtypes` vs `UNVALIDATED_METATYPES`), 제외 조건(`@ApiExcludeEndpoint()`/`@ApiExcludeController()`), 스코프 한계("광고의 존재만 센다")가 spec 문구와 코드 JSDoc·구현에 동일하게 반영돼 있다. `UNVALIDATED_METATYPES` 를 `validation.pipe.ts` 에서 export 해 가드가 재사용하는 구조는 "파이프가 건너뛰는 타입 = 가드가 요구하는 타입"이라는 의도를 정확히 코드로 강제한다(뮤턴트 G7 로 실측 확인됨). 엣지 케이스(인라인 객체·인터페이스·`unknown`·키 지정 원시 타입·설계 타입 미emit·제외 라우트·본문 없는 라우트)가 전부 대조군으로 커버되고, 직접 재실행한 테스트 6/6 이 GREEN 이었다. TODO/FIXME 류 미완성 표식 없음. 반환값(`RequestBodyScan`)은 모든 코드 경로에서 채워진 객체를 반환한다. 사전 `--spec`/`--impl-prep` consistency-check 가 BLOCK:NO 로 통과했고 남은 INFO 는 모두 이번 PR 범위 밖으로 명시적으로 유보돼 plan 에 기록돼 있어, 이번 diff 자체에서 새로 제기할 CRITICAL/WARNING 은 없다. 발견한 두 건은 모두 이미 설계·문서로 인지된 경계(INFO)다.

## 위험도
NONE
