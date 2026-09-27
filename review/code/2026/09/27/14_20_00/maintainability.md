# 유지보수성(Maintainability) 리뷰 — patch-omit-undefined (2R)

## 검토 범위

`omitUndefined` 헬퍼(`codebase/backend/src/common/utils/omit-undefined.ts`)를
`workflows.service.ts` · `nodes.service.ts` · `auth-configs.service.ts` update() 세 곳에 배선한
변경, 노드 PATCH 응답에서 `workflow` 관계를 떼는 수정, 워크플로 `settings` 병합 가드를
`settings !== undefined` → `settings != null` 로 고친 1R Critical 후속 수정, 단위 테스트
다수·신규 e2e(`test/patch-partial-body.e2e-spec.ts`), 헬퍼 타입 제약(`NotArray<T>`), CHANGELOG·
plan 문서 갱신, 그리고 1R 리뷰 산출물(`review/code/…/13_50_41/**`, `review/consistency/…/13_11_33/**`)
자체가 이번 diff 에 커밋으로 포함된다. 후자는 산문 리포트/JSON 이라 유지보수성 관점(가독성·네이밍·
함수길이 등)의 코드 대상이 아니므로 별도로 채점하지 않았다.

뮤테이션 검증 없이 정적 리뷰만 수행했다 — 저장소 파일을 고치지 않았다(`git status --short` 로 이 세션이
만든 변경 없음 확인).

## 발견사항

- **[INFO]** `omitUndefined` 호출 부위 "왜" 주석이 3개 서비스 파일에 거의 동일한 문장 패턴으로 반복된다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:247-248`,
    `codebase/backend/src/modules/nodes/nodes.service.ts:76-77`,
    `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:245-246`
  - 상세: 세 곳 모두 "보내지 않은 필드는 뺀다(이유는 `omitUndefined` JSDoc). 빼지 않으면 응답에 `<필드들>`이
    null 로 실리고/빠졌다 — `test/patch-partial-body.e2e-spec.ts` 가 고정한다." 형태를 필드명만 바꿔 반복한다.
    `plan/in-progress/patch-omit-undefined.md` §가드가 "정규식/AST 가드 대신 이 주석 + e2e 값 단언" 트레이드오프를
    이미 명시적으로 검토·채택했고, 1R 리뷰(`review/code/2026/09/27/13_50_41/maintainability.md`)도 같은 항목을
    INFO·조치 불요로 남겼다. 2R 인 지금도 그 판단을 뒤집을 새 근거는 없다.
  - 제안: 지금 범위에서 조치 불요. 다섯째 호출부가 생기면 공용 JSDoc 참조 한 줄로 축약을 고려.

- **[INFO]** `NotArray<T>` 타입 트릭이 비직관적이고, 파일 맨 위(함수 JSDoc보다 먼저)에 배치돼 첫 진입 장벽이 된다
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:1-6`(타입 선언), `:21-23`(사용부 `obj: T & NotArray<T>`)
  - 상세: `T extends readonly unknown[] ? never : unknown` 을 `T` 와 교차시켜 배열이 아니면 `T & unknown = T`
    (무변화), 배열이면 `T & never = never`(호출 자체를 타입 에러로 만듦)로 만드는 구성이다. 동작은 정확하고
    파일 최상단 주석과 `omit-undefined.spec.ts:49-58` 의 `@ts-expect-error` 캐너리로 근거·회귀가 있지만,
    파일을 처음 여는 사람은 함수의 핵심 목적(undefined 키 제거)을 설명하는 본문 JSDoc(8-20행)보다 이 타입
    트릭(1-6행)을 먼저 마주친다 — 읽는 순서가 "왜 배열을 막는가" → "무엇을 하는 함수인가" 로 뒤바뀐다.
  - 제안: 현재 주석 수준으로 결함은 아니다. 다음에 이 파일을 만지는 김에 본문 JSDoc(함수 설명)을 먼저,
    `NotArray<T>` 타입 설명을 그 아래로 옮기면 읽는 순서가 자연스러워진다.

- **[INFO]** 신규 e2e 케이스 C 가 "일반 노드"와 "toolOwnerId 노드" 두 시나리오를 한 `it` 블록에 담아 77줄(137-213행)로
  다른 세 케이스(A/B/D, 각 20-35줄)보다 눈에 띄게 길다
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts:137-213`
  - 상세: 앞 리뷰 라운드(1R)의 INFO 4(`toolOwnerId` 가 늘 null 이라 회귀를 못 가른다)를 고치면서 별도 `it` 를
    새로 만들지 않고 기존 케이스 C 뒤에 두 번째 fixture(`tool` 노드) · 두 번째 PATCH · 두 번째 단언 묶음을
    이어 붙였다. 두 시나리오가 검증하는 필드 집합(`keys`)과 `readNode` 헬퍼를 공유해 재사용 이득은 있지만,
    실패 시 어느 시나리오가 깨졌는지는 스택 트레이스 줄 번호로만 구분해야 한다.
  - 제안: 결함은 아니다. 여유가 되면 두 번째 시나리오(196-212행)를 `it('C-2. 도구 노드 — …')` 로 분리하면
    실패 지점이 테스트 이름으로 바로 드러난다.

## 양호한 점 (참고)

- 1R Critical(`settings: null` 500 회귀)의 수정(`workflows.service.ts:257`, `settings != null`)이 코드베이스의
  기존 관용구(`!= null` 로 null·undefined 동시 배제, 예: `table.handler.ts:85`, `embedding.service.ts:231` 등)와
  일관되고, 인접 주석(253-256행)이 "왜 `!==` 대신 `!=` 인지"까지 근거를 남겨 다음 사람이 되돌릴 위험을 줄였다.
- `nodes.service.ts` `update()` 반환 타입을 `Promise<Node>` → `Promise<Omit<Node, 'workflow'>>` 로 좁힌 것은
  컴파일 타임에 유출을 막는 좋은 패턴.
- `_type`/`_id`/`_ws`/`_workflow` 언더스코어 프리픽스 구조분해 컨벤션이 세 서비스에서 일관되게 유지된다.
- 각 서비스 update() 는 20~40줄, 중첩 깊이 최대 2단(if/for) 수준으로 함수 길이·복잡도 문제 없음.
- 신규 단위 테스트(`omit-undefined.spec.ts`, 세 서비스 `*.service.spec.ts`)가 각각 한 가지 경계만 검증해 짧고
  읽기 쉽다. `settings: null` 캐너리·`omitUndefined([1, undefined])` 타입 캐너리 모두 이름이 검증 대상을 그대로 드러낸다.

## 요약

이번 2R 대상 diff 는 1R Critical(`settings: null` PATCH 500 회귀)을 코드베이스 관용구에 맞춰 국소적으로 고쳤고,
새로 추가된 코드는 함수 길이·중첩·매직 넘버·네이밍 모두 무리가 없다. 세 서비스 파일에 걸친 주석 반복과
`NotArray<T>` 타입 트릭의 비직관성은 1R 에서도 이미 관측·수용된 트레이드오프이고 이번 라운드에서 새로
악화되지 않았다. 새로 발견한 것은 e2e 케이스 C 가 두 시나리오를 한 `it` 에 합쳐 다소 길어졌다는 점뿐이며,
이 역시 결함이 아니라 개선 여지 수준이다. CRITICAL/WARNING 급 유지보수성 문제는 없다.

## 위험도

LOW
