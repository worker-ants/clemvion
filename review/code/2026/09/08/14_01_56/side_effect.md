# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[WARNING]** 이번 diff 가 `_cmd_typecheck_ratchets()` 를 `run-test.sh build` 안으로 들여왔는데, 그 대상 스크립트 자신의 docstring 은 정정되지 않아 이제 거짓 문장이 됐다
  - 위치: `.claude/test-stages.sh:80-85`(`_cmd_typecheck_ratchets` 신설), `:95`(`cmd_build()` 안 호출) — 이 diff 가 바꾼 자리. 영향받는(그러나 이 diff 가 건드리지 않은) 파일: `scripts/check-backend-typecheck-ratchet.py:35`, `scripts/check-frontend-typecheck-ratchet.py:38`
  - 상세: 두 스크립트의 "로컬에서 돌리는 법" 섹션은 여전히 `` `.claude/tools/run-test.sh` 의 4단계에는 **없다**(그 wrapper 는 lint/unit/build/e2e 고정). `` 라고 적고 있다. 이 diff 가 정확히 그 전제를 깬다 — `_cmd_typecheck_ratchets()` 가 `cmd_build()` 안에서 `&&` 로 호출되므로, 두 ratchet 은 이제 `run-test.sh build`(4단계 중 하나)의 **일부**이고 그 실패는 로컬 `build` 스테이지 전체를 실패시킨다. `PROJECT.md`(이번 diff 게이트 43-57행)는 이 사실을 정확히 반영해 갱신됐지만, 정작 스크립트 자신의 사용법 안내는 그대로 남아 "수동으로만 돌리면 된다"는 인상을 준다. 다음에 이 스크립트를 여는 사람이 실패 원인을 진단할 때 "4단계 밖의 선택적 검사"로 오인하면, `build` 실패의 원인 표면이 늘었다는 사실(직전 라운드 `review/code/2026/09/08/13_34_28/side_effect.md` 가 이미 지적한 축)과 충돌한다.
  - 제안: 두 스크립트의 해당 문장을 "2026-09-08 부터 `run-test.sh build` 안에서 자동 실행된다(`.claude/test-stages.sh` `_cmd_typecheck_ratchets`). 개별 실행이 필요하면 아래 명령을 직접 호출." 정도로 정정.

- **[INFO]** `GlobalExceptionFilter` 의 unique-violation 판정이 넓어져, `@Catch()` 전역 필터(모든 라우트, `APP_FILTER` 로 등록)에서 `instanceof Error` 조차 아닌 임의의 객체도 `.code === '23505'` 하나만으로 409 로 분류되게 됐다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70`(`} else if (isPostgresUniqueViolation(exception)) {`), 등록 지점 `codebase/backend/src/app.module.ts:201`(`{ provide: APP_FILTER, useClass: GlobalExceptionFilter }`, 이 diff 밖)
  - 상세: 제거된 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구했다. 신설 `isPostgresUniqueViolation`(`pg-error.ts`)은 `typeof err === 'object'` 와 `.code`/`.driverError.code` 형태만 보는 **덕타이핑**이라 `instanceof` 요구가 없다 — 그리고 이 분기는 `catch()` 안에서 `instanceof HttpException` 다음, `instanceof Error` **이전**에 평가된다. 즉 `Error` 인스턴스조차 아닌 plain 객체(`{ code: '23505' }`)를 던지는 코드가 이 앱 어디에 생기더라도 그 즉시 409 `RESOURCE_CONFLICT` 로 응답한다. 저장소 전체를 grep 한 결과(`grep -rn "'23505'"`) 현재 이 문자열을 쓰는 자리는 전부 실제 Postgres 에러 판정 목적이라 지금은 충돌하는 소비처가 없다. 이 자체는 CHANGELOG/plan(B-3)이 명시한 **의도된** 수정이고 회귀 테스트(`http-exception.filter.spec.ts` 게이트 127-159)로 양방향(23505→409, 23502→500)이 고정돼 있다 — 다만 "전역 `@Catch()` 필터의 판정 범위가 넓어진다"는 것은 이 리포지토리에서 예외 처리를 거치는 **모든** 엔드포인트에 적용되는 구조적 변경이므로, 향후 `.code` 필드를 다른 의미로 쓰는 에러 객체가 생기면 조용히 오분류될 수 있는 표면이 새로 열렸다는 점은 기록해 둔다.
  - 제안: 현재 조치로 충분(실측 blast radius 0, 양방향 테스트 존재). 향후 새 서비스가 `err.code` 를 Postgres 아닌 다른 의미로 쓰는 에러 객체를 던지는 패턴을 도입하면 이 분기와 충돌할 수 있음을 팀 컨벤션 문서에 한 줄 남겨 둘 가치는 있다.

- **[INFO]** `enclosingScopeName` 통합 시 fallback 우선순위 규칙이 미묘하게 바뀌었다 — 기존 `EXPECTED_USER_RELATION_LOADS` 베이스라인엔 영향 없음을 직접 확인
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:101-127`(`enclosingScopeName` 신설), 소비처 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:342`(`const method = enclosingScopeName(node, sf);`)
  - 상세: 제거된 `enclosingName`(과거 `user-entity-exposure-guard.ts` 로컬 함수)은 조상 노드를 순회하며 "메서드/함수 먼저, 없으면 **가장 가까운** 변수 하나"를 반환했다. 새 공용 `enclosingScopeName` 은 순회 중 만나는 첫 "함수 이니셜라이저 변수"(`functionVar`)와 첫 "일반 변수"(`plainVar`)를 **독립적으로** 기억해 뒀다가 `functionVar ?? plainVar` 순으로 반환한다 — 만약 조상 체인에서 일반 변수가 함수형 변수보다 노드에 더 가깝다면, 새 알고리즘은 더 먼 `functionVar` 를 우선한다(예전엔 더 가까운 일반 변수가 이겼을 자리). 저장소 전체에서 이 함수의 두 소비처(`user-entity-exposure-guard.ts`, `endpoint-path-conflict-wrap-guard.ts`)가 스캔하는 실제 대상을 확인한 결과, `EXPECTED_USER_RELATION_LOADS` 에 남은 두 항목(`auth.service.ts#logout`/`#refresh`)은 모두 메서드 스코프에서 즉시 매칭돼 변수 fallback 분기에 도달하지 않으므로 이번 통합으로 라벨이 바뀌지 않았다. 다만 이 우선순위 차이 자체는 "가장 가까운 스코프가 이긴다"는 직관과 다르므로, 다음에 이 공용 함수를 새 가드에 재사용할 때 유의할 사항으로 남긴다.
  - 제안: 조치 불요(현재 관측 가능한 회귀 없음). 함수 JSDoc 에 이미 순서 규칙이 설명돼 있어 문서화는 충분하다.

- **[INFO]** `tsconfig.build.json` 에 `**/__test-utils__/**` exclude 추가 — dist 산출물 파일 구성이 줄어드는 빌드타임 파일시스템 부작용, 프로덕션 참조 없음을 직접 확인
  - 위치: `codebase/backend/tsconfig.build.json:20-28`
  - 상세: `grep -rln "__test-utils__" codebase/backend/src --include="*.ts"` 로 전수 확인한 결과, `__test-utils__` 를 import 하는 자리는 전부 `src/repo-guards/__tests__/**` 또는 `src/shared/testing/**` 안에 있고 이 둘은 이미 위쪽 exclude 패턴으로 빌드 대상에서 빠져 있다. 즉 이번 exclude 추가로 dist 에서 사라지는 파일 중 어떤 것도 "빌드에 남아 있는 프로덕션 코드"가 참조하지 않으므로, 런타임에 `require()` 실패를 일으킬 자리는 없다.
  - 제안: 없음(검증 완료).

## 요약

이번 배치(B-1~B-8)의 부작용 표면은 대부분 테스트/빌드 파이프라인 내부에 갇혀 있거나, 실측으로 안전이 확인된 의도적 변경이다. 유일하게 새로 발견한 실질적 지적은 `run-test.sh build` 에 typecheck ratchet 두 개를 편입시키면서 그 스크립트들 자신의 "로컬 실행법" docstring(`scripts/check-{backend,frontend}-typecheck-ratchet.py`)을 정정하지 않아, `PROJECT.md`(정확히 갱신됨)와 스크립트 자체 설명이 서로 어긋나게 된 점이다(WARNING). `GlobalExceptionFilter` 의 unique-violation 판정이 `instanceof QueryFailedError` 요구 없이 덕타이핑으로 넓어진 것은 `@Catch()` 전역 등록이라 이론상 모든 라우트에 영향을 주는 구조적 확장이지만, 현재 저장소 안에 충돌하는 소비처가 없고 회귀 테스트로 양방향이 고정돼 있어 위험은 낮다. `enclosingScopeName` 공용화 시 fallback 우선순위가 미묘하게 바뀌었으나 기존 베이스라인에 대한 실제 영향은 없음을 직접 대조해 확인했다. `tsconfig.build.json` 의 `__test-utils__` exclude 는 grep 으로 프로덕션 참조 부재를 확인해 안전하다. 시그니처 변경(`WorkflowVersionDetail`→`WorkflowVersionDetailProjection`)은 저장소 안에 다른 참조가 없어 호출자 영향이 없고, `workspaces.service.ts` 의 `select` 투영 추가는 응답 wire 계약을 바꾸지 않는 단일 쿼리 범위 변경이다. 전역 변수 도입, 예상치 못한 파일 생성/삭제, 환경 변수 read/write, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다. 리뷰 수행 중 저장소에 어떤 파일도 뮤테이션하지 않았다(`git status --short` 로 확인 — read-only 조사만 수행).

## 위험도

LOW
