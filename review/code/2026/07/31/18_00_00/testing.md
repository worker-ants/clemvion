# 테스트(Testing) 리뷰 — workflows duplicate() 리뷰 팔로우업 (INFO 10건 처분)

## 발견사항

- **[INFO]** `edge.condition` 삼항 연산자의 null 분기(false branch)가 mutation 으로 미검증
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:325` (`condition: edge.condition ? { ...edge.condition } : edge.condition,`) / 대응 테스트 `codebase/backend/src/modules/workflows/workflows.service.spec.ts:692`-701 (`엣지 condition 을 얕은 복사해 원본 JSONB 와 참조를 공유하지 않는다`)
  - 상세: 신규 테스트는 `condition` 값이 있는 엣지(e-2, ERROR, `{foo:1}`)에 대해서만 "값은 같되 참조는 다르다"를 확인한다. `condition` 이 `null` 인 엣지(e-1, DATA, `origEdges[0]`)에 대해 결과 row 의 `condition` 이 여전히 `null` 로 보존되는지는 어떤 테스트도 명시적으로 단언하지 않는다. 실제로 삼항의 false 분기를 `edge.condition`(원본 유지) 대신 `undefined` 로 바꿔 duplicate 스펙 21건을 재실행한 결과 전부 GREEN 이었다(mutation 생존, 직접 재현 확인). 플랜 문서(`plan/in-progress/review-info-followups.md`)가 "mutation 으로 non-vacuous 증명"을 표방한 두 케이스(condition 복사 제거·`edgeRows.length>0` 가드 제거)에는 이 분기가 포함되지 않았다.
  - 실무 영향은 낮다 — `condition` 컬럼은 `nullable: true`(명시적 `default` 없음)라 TypeORM 이 `undefined` 필드를 insert 컬럼 목록에서 생략해도 Postgres 는 동일하게 NULL 을 채운다. 즉 이 mutation 이 실제 결함으로 이어질 가능성은 낮지만, "테스트가 지키는 대상"과 "실제로 지켜지는 대상" 사이 갭이므로 기록해 둔다.
  - 제안: e-1(DATA, condition:null) 에 대해 `expect(edges.find(e => e.type === EdgeType.DATA)!.condition).toBeNull()` 한 줄만 추가하면 이 분기까지 mutation-closed 된다.

- **[INFO]** 플랜 문서의 mutation 실측표 한 행이 독립 재현 결과와 다르다
  - 위치: `plan/in-progress/review-info-followups.md:58` (`| \`edgeRows.length > 0\` 가드 제거 | **3 failed** / 18 passed |`)
  - 상세: 동일 mutation(`edgeRows.length > 0` 가드 제거, 무조건 `manager.insert(Edge, edgeRows)` 호출)을 독립적으로 재현했다. `duplicate` describe 만 스코프해도(21건 중 2 failed/19 passed), 스펙 파일 전체를 돌려도(80건 중 2 failed/78 passed) 실패 개수는 일관되게 2건이었고 3건이 아니었다. 같은 표의 다른 행("condition 얕은 복사 제거 → 1 failed/20 passed")은 그대로 재현되어 정확했다. 이 문서는 "왜 이 4건만 조치했는가"를 mutation 증거로 뒷받침하는 근거 문서이므로, 근거 숫자 자체의 부정확은 (경미하더라도) 문서 신뢰도를 낮춘다.
  - 제안: 실제 재현값인 "2 failed / 19 passed"로 정정하거나, 표에 정확한 mutation 절차(어떤 줄을 어떻게 바꿨는지)를 남겨 제3자가 재현 가능하게 한다.

- **[INFO]** `POST /:id/duplicate` 컨트롤러 라우팅 자체에 대한 단위 테스트 부재 (이번 diff 와 무관한 기존 갭)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` (파일 전체 — `duplicate` 관련 `describe`/`it` 없음), 대상은 `codebase/backend/src/modules/workflows/workflows.controller.ts` 의 `duplicate()` 메서드
  - 상세: 이번 diff 는 해당 엔드포인트의 Swagger `description` 을 배열+`join(' ')` 로 재포맷했을 뿐이며, 출력 문자열이 원본과 완전히 동일함을 직접 검증했다(동작 변경 없음 → 이번 diff 가 갭을 새로 만든 것은 아님). 다만 `execute`/`executeNode`/`saveCanvas`/`restoreVersion`/`findAll`/`graphWarnings` 등 다른 엔드포인트는 컨트롤러 레벨 wiring 테스트(파라미터 전달·404/503 위임 등)가 있는데 `duplicate` 만 빠져 있어 상대적으로 눈에 띈다.
  - 제안: 이번 PR 범위는 아니지만, 추후 컨트롤러 스펙을 다시 건드릴 일이 있으면 `duplicate` 도 최소 wiring 테스트(id/workspaceId/user.sub 가 서비스로 그대로 전달되는지)를 추가할 가치가 있다.

## 검증 방법 (참고)

- `workflows.service.spec.ts`(80건) · `workflows.controller.spec.ts`(19건) 전체 재실행 — 모두 GREEN, 회귀 없음.
- Swagger description 배열/`join(' ')` 결과가 원본 단일 문자열과 byte-identical 임을 Node 스크립트로 직접 검증(`===` true).
- `nodeEntities`/`edgeEntities` 잔존 참조를 `codebase/backend/src/` 전역에서 grep — 0건(리네이밍이 테스트를 포함해 어디에도 이름으로 결속되지 않음을 확인, 회귀 위험 없음).
- mutation 2종을 소스에 직접 적용 후 `git checkout --`으로 원복하며 재현:
  - `condition: edge.condition ? { ...edge.condition } : edge.condition` → `condition: edge.condition` (복사 제거): duplicate 21건 중 **1 failed**(신규 단언만 RED) — 플랜 문서 수치와 일치.
  - `edgeRows.length > 0` 가드 제거(무조건 insert 호출): duplicate 21건 중 **2 failed**(빈 캔버스 테스트 + 신규 "노드만 있고 엣지 0건" 테스트) — 플랜 문서는 "3 failed"로 기재, 위 INFO 항목 참조.
  - 삼항의 null 분기(`: edge.condition`)를 `: undefined` 로 변경: duplicate 21건 **전부 GREEN**(mutation 생존) — 위 INFO 항목 참조.
  - 매 mutation 후 `git checkout -- codebase/backend/src/modules/workflows/workflows.service.ts` 로 원복, `git status`/`git diff --stat` 로 클린 상태 확인.

## 요약

이번 변경은 이전 리뷰의 보류 INFO 10건 중 4건(동작성 결함 1건 + 커버리지 갭 1건 + 네이밍 정합 1건 + Swagger 포맷 1건)만 선별 조치한 팔로우업이다. 핵심 동작 변경인 `edge.condition` 얕은 복사 누락 수정은 참조 동일성(`.not.toBe`)까지 명시적으로 단언하는 전용 테스트로 뒷받침되고, 독립 재현한 두 mutation 중 하나(condition 복사 제거 → 1 failed)는 플랜 문서 수치와 정확히 일치해 새 테스트가 vacuous 하지 않음을 재확인했다. `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` 리네이밍은 공개 API 를 통해서만 검증되는 내부 식별자 변경이라 회귀 위험이 없고(잔존 참조 grep 0건), Swagger 설명 재포맷은 출력 문자열이 원본과 완전히 동일함을 프로그램적으로 확인했다. 신규 테스트 2건을 포함해 관련 스펙 전체가 GREEN(service 80/80, controller 19/19)이며 회귀는 없다. 다만 검증 과정에서 (1) 새 테스트가 `condition` 삼항의 null 분기까지는 mutation-closed 하지 못했고, (2) 플랜 문서 자체의 mutation 실측표 한 행이 독립 재현 결과(2 failed)와 다르게 적혀 있으며(3 failed로 기재), (3) `duplicate` 컨트롤러 라우팅에는 이번 diff 와 무관한 기존 wiring 테스트 부재가 있음을 확인했다 — 셋 다 실제 동작 리스크는 낮은 INFO 수준이다.

## 위험도

LOW
