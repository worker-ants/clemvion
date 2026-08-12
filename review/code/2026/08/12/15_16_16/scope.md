# 변경 범위(Scope) 코드 리뷰

## 검증 방법

`git diff 5bced1f30 HEAD --stat` 로 base(main HEAD) 대비 전체 변경 파일 목록을 실측하고, 프로덕션
코드 두 파일(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`)과 `plan/` 파일은
`git diff`로 전문을 직접 대조했다. `grep -n`으로 `idempotency.interceptor.ts`의 `catchError`(107행)/
`switchMap`(113행) 실제 위치도 재확인했다.

## 발견사항

- **[INFO]** `bodyHashOf` 헬퍼를 describe 블록 로컬에서 모듈 최상단으로 이동 — 핵심 수정(`catchError`
  삽입) 자체와는 직접 관계없는 소규모 리팩토링
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:94`
    (신규 모듈 스코프 정의). 기존 `IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)` describe
    내부 로컬 정의는 삭제됨(구 파일 172행 부근, 삭제 줄이라 게이트 없음)
  - 상세: `grep -n bodyHashOf`로 확인한 결과 정의는 파일 전체에서 94행 한 곳뿐이고 나머지는 전부
    호출부 — 두 곳 복제가 한 곳으로 통합됐다. 이 이동은 이번 fix의 1차 의도("Redis `get()` 런타임
    reject를 fail-open으로 강등")를 살짝 넘지만, 근거가 문서로 명확히 남아 있다:
    `review/code/2026/08/12/14_27_02/RESOLUTION.md` WARNING #3(같은 세션 자동 코드 리뷰가 지적한
    중복)을 그 자리에서 조치한 결과이고, `CLAUDE.md`가 "구현 완료 후 `/ai-review` + critical/warning
    fix는 상시 승인된 강제 단계"라고 명시하므로 임의 확장이 아니라 규정된 review-fix 워크플로의
    정상 산출물이다. 순수 이동(로직 변경 없음), diff 규모도 작다.
  - 제안: 조치 불요. 사전 승인된 review-driven 리팩토링.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md`에 체크박스 완료 표시 외 신규
  백로그 항목("idempotency fail-open 구간의 관측·중복 억제")이 함께 추가됨
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:524`-`530`
  - 상세: 원 항목(`- [ ]` → `- [x]`)의 완료 처리에 더해 새 미해결 항목이 추가됐다. 이는
    `review/code/2026/08/12/14_27_02/RESOLUTION.md` WARNING #1(concurrency: fail-open 구간
    중복 실행 위험)을 "코드는 되돌리지 않고 문서화 + plan 백로그로 유예"한 결과이며, 이번 fix가
    만든 트레이드오프를 추적하는 정상적 부기다. 코드 fix와 무관한 신규 기능·범위 확장이 아니다.
  - 제안: 조치 불요.

- **[INFO]** diff에 직전 세 리뷰 라운드(`14_27_02`, `14_50_36`, `15_04_25`)의 산출물 36개 파일
  (`RESOLUTION.md`·`SUMMARY.md`·`meta.json`·`_retry_state.json`·개별 reviewer `.md` × 3라운드)이
  신규 파일로 함께 포함됨
  - 위치: `review/code/2026/08/12/14_27_02/*`, `review/code/2026/08/12/14_50_36/*`,
    `review/code/2026/08/12/15_04_25/*` (전부 신규 파일, `codebase/**` 대상 코드 변경 없음)
  - 상세: `CLAUDE.md` skill 권한표는 `developer`의 `review/` 쓰기 권한을 `review/**/RESOLUTION.md`
    로만 한정하고, 나머지(`SUMMARY.md`·개별 reviewer `.md`·`meta.json`·`_retry_state.json`)는
    `code-review-agents` skill이 자동 생성하는 산출물이다. `review/`는 이 프로젝트에서 gitignore
    대상이 아니라 커밋이 정상 관례("코드 리뷰 산출물" 저장 위치)다. 즉 developer가 스코프를 넘겨
    임의 파일을 건드린 것이 아니라, 프로젝트가 규정한 "구현 → 자동 리뷰(강제) → resolution"
    파이프라인의 산출물이 같은 브랜치 diff에 누적 반영된 것이다(`git log 5bced1f30..HEAD` 확인:
    4개 커밋 — `5d79dc123`(원 fix) → `f933f2cf6`(라운드1 resolution) → `1fb233eca`(라운드2
    resolution 정정) → `7072a1ac0`(라운드3 resolution)). 코드 정확성·기능에 영향 없음. 직전 세
    라운드의 scope 리뷰(`14_27_02/scope.md`, `14_50_36/scope.md`, `15_04_25/scope.md`) 모두
    이 항목을 동일하게 INFO/조치 불요로 판정했으며, 이번 라운드에서 독립적으로 실측(`git diff
    5bced1f30 HEAD --stat` = 40 files, 정확히 이 카테고리들만)해도 동일 결론이다.
  - 제안: 조치 불요. diff를 읽는 사람에게 노이즈가 될 수 있다는 점만 참고로 남긴다.

- **[INFO]** `catchError` 삽입 지점에 붙은 인라인 주석이 8줄로 다소 길다(설계 근거 + 위치 주의 +
  캐너리 안내를 한 블록에 담음)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:99`-`106`
    (`catchError` 직전 주석)
  - 상세: 로드베어링 위치 결정("왜 `switchMap` 앞이어야 하는가")을 코드 주석으로 고정하는 것은
    이 저장소 기존 컨벤션과 일치하고(클래스 docstring 등 동일 밀도의 주석이 이미 있음), 캐너리
    테스트(`idempotency.interceptor.spec.ts:405`-`421`)와 1:1로 대응하는 실질 내용이라 무관한
    주석 추가로 보기 어렵다. 스코프 위반이라기보다 스타일 판단 사항.
  - 제안: 별도 조치 불필요.

- **[없음 — 확인 결과 문제 없음]** 핵심 코드 변경의 정합성 재확인
  - 상세: `idempotency.interceptor.ts`를 `grep -n "catchError|switchMap"`으로 직접 확인 —
    `catchError`는 107행, `switchMap`은 113행으로 올바른 순서(과거 라운드 documentation 리뷰어의
    CRITICAL 오탐 — 공유 워크트리 뮤테이션 아티팩트 — 은 이번 조회 시점엔 재현되지 않는다).
    `import { catchError, switchMap, tap } from 'rxjs/operators'`(13행)는 신규 사용에 정확히
    대응하는 필요한 import 추가이며, 불필요하거나 사용하지 않는 import는 없다.
    `CHANGELOG.md`(1-19행)는 이 fix 전용 신규 섹션 하나만 추가하고 기존 섹션은 손대지 않았다.

## 요약

핵심 코드 변경(`idempotency.interceptor.ts`의 `catchError` 삽입 + import 1건 추가 + docstring
보강, `idempotency.interceptor.spec.ts`의 신규 fail-open 테스트 5건, `CHANGELOG.md` 신규 섹션)은
"Redis `get()` 런타임 reject가 요청을 500으로 fail-closed시키던 결함을 spec이 요구하는
fail-open으로 고친다"는 단일 의도에 4개 커밋(원 fix + 3회 review-fix) 내내 일관되게 수렴하며,
무관한 코드 정리·기능 확장·불필요한 import·설정 변경은 발견되지 않는다. `bodyHashOf` 모듈 최상단
이동과 plan 백로그 신규 항목 추가는 엄밀히는 원 fix 범위를 살짝 넘지만 둘 다 같은 세션의 사전
승인된 자동 review-fix 워크플로(CLAUDE.md 명시) 산출물로 근거가 명확하다. diff에 포함된 직전 세
리뷰 라운드의 산출물 36개 파일은 developer의 스코프 일탈이 아니라 프로젝트가 규정한 리뷰
프로세스의 정상 부산물이며, `git diff 5bced1f30 HEAD --stat`으로 base 대비 전체 40개 변경 파일을
실측 대조한 결과 이 카테고리(핵심 코드 2·CHANGELOG 1·plan 1·review 산출물 36)를 벗어나는 파일은
없다. 스코프 관점에서 CRITICAL/WARNING급 이탈은 없다.

## 위험도

NONE
