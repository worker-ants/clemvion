# 요구사항(Requirement) 코드 리뷰

## 개요

이 diff 는 `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` (에러 코드 전용,
문맥-게이팅 3축, 허용목록 없음) 를 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`
(에러 코드 + 환경변수, 백틱 전수 축, 방어적 허용목록) 로 대체하고, `CHANGELOG.md`·`PROJECT.md`·
자매 파일(`guide-sanitized-message-parity.test.ts`) 의 상호참조, `plan/in-progress/*.md`, 그리고
7 라운드에 걸친 `/ai-review`·`/consistency-check` 산출물로 구성된다. 이미 7 라운드의 집중적인
리뷰(뮤테이션 테스트 포함, 가드 스위트 GREEN 34→39건, 최종 39건)를 거쳤으므로, 이번 라운드는
그 7라운드가 놓쳤을 만한 잔여 결함에 집중해 독립적으로 재검증했다.

## 검증한 것

- `guide-identifier-scan.ts`(361줄)·`guide-identifier-existence.test.ts`(509줄)·
  `guide-sanitized-message-parity.test.ts`(교차참조 2줄) 전문을 `Read` 로 직접 열어 확인.
- `pnpm exec vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts
  src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` 직접 실행 —
  **46/46 통과**(606ms).
- `spec/conventions/user-guide-evidence.md` §2(가드 인벤토리 표) 를 line-level 로 대조.
- scratch 디렉터리(`/private/tmp/.../scratchpad/check.mjs`)에서 `FIELD_TABLE_NAME` 정규식의
  중첩 객체 리터럴 케이스를 별도로 검증(저장소 트리는 건드리지 않음, `git status --short`
  확인 결과 세션 산출물 2개 외 변경 없음).
- `.env.example`(backend/frontend)·`docker-compose*.yml` 실재 확인 — vacuity floor 전제 성립.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/conventions/user-guide-evidence.md` §2 의 "Build-time 가드
  (3건)" 표가 이번 PR 이 신설·유지하는 가드 2건(`guide-identifier-existence.test.ts`,
  `guide-sanitized-message-parity.test.ts`)을 아직 반영하지 않는다.
  - 위치: `spec/conventions/user-guide-evidence.md:68`(표 제목 "3건"), `:72-76`(표 본문 —
    `impl-anchor-existence.test.ts`/`integrations-coverage.test.ts`/`triggers-coverage.test.ts`
    3건만 등재).
  - 상세: 코드베이스에는 이미 `impl-anchor-existence`(spec 등재됨) 외에
    `guide-identifier-existence`(구 `guide-error-code-existence`, `#1330`부터 존재)와
    `guide-sanitized-message-parity`가 build-time 가드로 동작 중인데 spec 표에는 없다. 이
    diff 는 그 사실을 새로 만든 게 아니라(선재 갭, `#1330`부터) 스코프를 넓혔을 뿐이지만,
    spec 본문(요구사항 ID·표 — Overview 아님)과 실제 가드 목록이 line-level 로 어긋나는
    상태가 이 PR 이후에도 그대로 남는다. `plan/in-progress/guide-identifier-existence.md`
    §D~G 가 이 항목을 **7라운드 연속(라운드 3·4·5·6·7 RESOLUTION 및 plan 본문 기준 통산
    10회) 독립 확인**했고, planner 등재(파일명·스코프·Rationale 초안 포함)까지 마쳤다고
    기록돼 있다 — 즉 이것은 코드 버그가 아니라 spec 갱신이 아직 반영되지 않은 SPEC-DRIFT다.
    developer 권한(`spec/**` 쓰기 불가)과 자기-반증형 소정정 예외(그 예외는 *developer 가
    직접 쓴 예고 문장*에만 열리며, 이 표는 그런 문장이 아니다) 양쪽에 비추어 이 PR 이 직접
    고칠 수 있는 항목이 아니다.
  - 제안: 코드 변경 불필요(유지). `project-planner` 턴에서 `user-guide-evidence.md` §2 표에
    `guide-identifier-existence.test.ts`(구 `guide-error-code-existence`)·
    `guide-sanitized-message-parity.test.ts` 두 행을 추가하고 "3건"을 "5건"(또는 해당
    시점의 실제 건수)으로 정정. 이미 등재된 plan 항목을 그대로 집행하면 됨 — 새 등재
    불필요.

- **[INFO]** `FIELD_TABLE_NAME` 축이 같은 줄 안에서 `name:` 앞에 **닫힌 중첩 객체**가 있으면
  조용히 놓친다(직접 재현: `{ meta: { type: "x" }, name: "CODE_ONE" }` → 매치 0건).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:152-155`
    (`FIELD_TABLE_NAME` 정의, `\{[^}]*?\bname:\s*"(${UPPER_SNAKE})"` — `[^}]` 이 중첩 `}` 를
    건너뛰지 못한다).
  - 상세: 이미 문서화된 두 한계("여러 줄로 쪼갠 행은 놓친다" 테스트 :387-391, "객체 경계를
    넘지 않는다" 설계 의도 :149-150·380-384)의 연장선에 있는 형태이지만, "같은 줄 안에
    **중첩된** `{...}` 가 `name:` 보다 앞에 오면 놓친다"는 형태는 별도로 대조군이 없다.
    다만 실측(`<FieldTable>` 정의 스캔) 결과 오늘 코퍼스의 `<FieldTable>` 행에는 이 형태가
    없다 — 라운드 5~7 이 이미 문서화한 "line-based, same-object-literal" 설계 제약과 같은
    클래스이고 corpus 의존적으로 조용하다는 성질도 동일하다.
  - 제안: 조치 불요(낮은 우선순위) — 다음에 이 축의 경계를 손볼 때 상단 한계 주석에 이
    형태도 추가해 두면 "왜 안 걸렸는지" 추적 비용을 줄인다. baseline-0 회귀 방식 상 이
    형태도 원리적으로 관측 불가하다는 점은 라운드 7 이 backtick 축에서 배운 교훈과
    동형이다.

- 그 외 CRITICAL 급 기능 결손은 발견하지 못했다. 기능 완전성(3축 모두 후보를 내는지),
  엣지 케이스(빈 허용목록·빈 env 파일·`.env.example` 부재), 에러 시나리오
  (`readIfPresent` 의 파일 부재 분기), 데이터 유효성(허용목록 4강제), 비즈니스 로직(기준집합
  = 소스 ∪ env 선언처, 허용목록은 기준집합에 있으면 안 됨), 반환값(세 export 함수 모두
  모든 경로에서 값 반환) 전부 코드·주석·테스트 삼중으로 뮤테이션 검증돼 있고, 직접 실행한
  46/46 vitest 결과도 일치한다.

## 요약

핵심 요구사항("가이드가 적은 식별자는 실재해야 한다", 에러 코드 + 환경변수 양 축)은
코드·테스트에 정확히 반영돼 있고 46/46 vitest 통과로 확인했다. 7라운드에 걸친 선행 리뷰가
경계 결함을 인스턴스 단위(라운드 2~4)에서 클래스 단위(라운드 5)로, 그리고 그 감사 자체의
사각지대(라운드 7, 백틱 축 미탐지 6종)까지 뮤테이션 테스트로 좁혀 왔기 때문에, 이번 독립
재검증에서는 새로운 CRITICAL/기능 결손을 찾지 못했다. 유일한 실질 발견은 이미 10회
독립 확인된 SPEC-DRIFT(`user-guide-evidence.md` §2 가드 인벤토리 표 미갱신)의 재확인이며,
developer 권한 밖이라 이번 PR 이 직접 고칠 수 없고 planner 등재가 이미 완료된 상태다. 부가로
발견한 `FIELD_TABLE_NAME` 의 중첩-객체 엣지 케이스는 오늘 코퍼스에 나타나지 않는 저위험
INFO다.

## 위험도

LOW
