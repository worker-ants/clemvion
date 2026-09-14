# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- target scope `spec/conventions/` 의 `origin/main` 대비 델타: **0개 파일**. `plan/in-progress/trigger-canary-hardening.md` frontmatter `spec_impact: none` 과 일치하며, 이번 배치는 spec 이 아니라 기존 트래커(`spec-draft-nullable-notation-followups.md`) 항목을 닫는 **테스트/하드닝 전용** 작업이다. 따라서 spec 이 새로 부여하는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV/설정키·spec 파일 경로는 **없음** — 관점 1·3·4·5 는 대상 자체가 없다.
- 실제 코드 델타(`origin/main...HEAD -- codebase/`)는 6파일: 신규 2개(`codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`) + 기존 4개 파일의 주석/단언 추가. 신규 식별자는 이 두 신규 파일에서만 도입된다. 아래는 그 신규 식별자에 한정한 관점 2(엔티티/타입명)·6(파일 경로) 점검이다.

## 신규 식별자 전수 및 충돌 검사

신규 export: `CANONICAL_SOURCE`, `CANONICAL_CONST`, `MIRROR_SOURCES`, `MIRROR_CONST`, `readStringArrayConst`, `readAllTriggerSecretColumnLists` (모두 `trigger-secret-columns-guard.ts`).

```
grep -rn "CANONICAL_SOURCE|CANONICAL_CONST|MIRROR_SOURCES|MIRROR_CONST" codebase/backend/src
  → trigger-secret-columns-guard.ts 자기 자신 외 매치 없음
grep -rn "readStringArrayConst|readAllTriggerSecretColumnLists" codebase/backend/src
  → trigger-secret-columns-guard.ts / trigger-secret-columns.spec.ts 외 매치 없음
```

- 저장소 전체에서 위 6개 식별자를 재사용하는 다른 모듈이 없다 — export 명 충돌 없음. 이 디렉토리(`repo-guards/__tests__/`)의 자매 가드들(`redis-fail-open-catalog-guard.ts`, `masked-reject-callers-guard.ts`, `audit-action-binding-guard.ts`, `engine-error-code-anchor-guard.ts` 등)도 각자 모듈-스코프 상수명(`UNION_SOURCE`, `BASE_FN`, `MODULES_DIR` 등)을 쓰며, 파일이 서로 다른 모듈이라 export 명이 겹쳐도 런타임/컴파일 충돌은 발생하지 않는다. 참고로 신규 파일이 `CANONICAL_SOURCE`/`MIRROR_CONST` 처럼 일반적 이름을 골랐지만 이는 그 가드 파일에서만 쓰이는 지역 API 라 문제되는 명명이 아니다 (INFO 대상도 아님).
- 기존에 이미 존재하던 실제 상수 `TRIGGER_RESPONSE_STRIP_COLUMNS`(`modules/triggers/triggers.service.ts`, 정본) 와 `TRIGGER_SECRET_COLUMNS`(`shared/testing/schedule-trigger-ref.ts`, `shared/testing/trigger-workflow-ref.ts`, 사본 둘)는 target 이 새로 부여한 이름이 아니라 신규 가드가 **읽기만** 하는 대상이며, 신규 가드 자체는 이 이름들을 재정의하지 않는다(문자열 값 `CANONICAL_CONST = 'TRIGGER_RESPONSE_STRIP_COLUMNS'`로만 참조). 충돌 없음.

## 파일 경로 점검

- 신규 파일 `trigger-secret-columns-guard.ts` / `trigger-secret-columns.spec.ts` 는 같은 디렉토리의 기존 명명 컨벤션(`<주제>-guard.ts` + `<주제>.spec.ts` 쌍, 예: `redis-fail-open-catalog-{guard.ts,spec.ts}`, `masked-reject-callers-{guard.ts,spec.ts}`)을 그대로 따른다. 컨벤션 위반·기존 파일과의 경로 중복 없음.
- plan 파일 `plan/in-progress/trigger-canary-hardening.md` 는 기존 `plan/complete/trigger-workflow-ref-canary.md`, `plan/complete/spec-draft-trigger-canary-nav.md` 와 이름이 유사(`*trigger*canary*`)하지만 슬러그 자체는 겹치지 않고, 대상(완료된 과거 캐너리 도입 작업 vs 현재 하드닝 배치)도 시점상 분리돼 있어 혼동 소지가 낮다. 검토 대상 스코프(spec/conventions)에 속하지 않는 부수 관찰이라 별도 등급을 매기지 않는다.

## 발견사항

없음 — 위 점검 범위 내에서 CRITICAL/WARNING/INFO 등급 발견사항이 없다.

## 요약

target 문서(`spec/conventions/`)는 이번 브랜치에서 실제로 변경되지 않았으므로(델타 0, `spec_impact: none`) spec 차원의 신규 요구사항 ID·엔티티명·endpoint·이벤트명·ENV/설정키 충돌 대상이 존재하지 않는다. 실질 변경은 `codebase/backend/src/repo-guards/__tests__/` 에 신설된 트리거 비밀 컬럼 3중 사본 정합 가드(`trigger-secret-columns-guard.ts`/`trigger-secret-columns.spec.ts`)이며, 그 안에서 새로 export 되는 6개 식별자(`CANONICAL_SOURCE`, `CANONICAL_CONST`, `MIRROR_SOURCES`, `MIRROR_CONST`, `readStringArrayConst`, `readAllTriggerSecretColumnLists`)를 저장소 전체에서 grep 한 결과 기존 사용처와의 충돌이 없고, 파일 경로도 같은 디렉토리의 `-guard.ts`/`.spec.ts` 쌍 컨벤션을 그대로 따른다. 신규 식별자 충돌 관점에서 이 변경은 안전하다.

## 위험도
NONE
