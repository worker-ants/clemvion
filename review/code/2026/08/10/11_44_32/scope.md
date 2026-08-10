# 변경 범위(Scope) Review

## 리뷰 대상

`claude/typescript-toolchain-followups` 브랜치 (origin/main 대비 6커밋, 18파일). 대상은 크게 두
그룹이다.

- **A. 실제 코드/plan 변경 (파일 1~7)**: `plan/in-progress/typescript-toolchain-followups.md`
  §1(공유 프리미티브 `_shared.ts` 분리)·§2(`validateWorkspacePatterns` fail-closed 분리)·§4(타입/JSDoc
  정리)의 구현 + 직전 리뷰 라운드(`11_22_14`)의 WARNING 1건·INFO 1건 fix.
- **B. 리뷰 산출물 커밋 (파일 8~18)**: `review/code/2026/08/10/11_22_14/` 디렉터리 11개 파일 전체
  (`RESOLUTION.md`/`SUMMARY.md`/7개 reviewer 리포트/`meta.json`/`_retry_state.json`) 신규 추가.

`git log --oneline origin/main..HEAD`(6커밋) 과 `git diff --stat origin/main...HEAD`(18파일)를
실측 대조한 결과 프롬프트의 "리뷰 대상 파일" 목록과 정확히 일치한다 — 명시되지 않은 무관한 파일은
없다.

## 발견사항

- **[INFO]** A그룹의 이번 라운드 유일한 코드 변경(커밋 `76f9aa0f2`)은 정확히 직전 WARNING 범위에
  한정된다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
    (전체 diff hunk, 3개 테스트 제거 + 이관 사유 주석) / `shared.test.ts:88-139`
    (`listAtPath` describe 블록 신설)
  - 상세: `git show 76f9aa0f2 --stat` 로 확인한 변경 파일은 정확히 3개(`internal-package-registration.test.ts`,
    `shared.test.ts`, plan 문서)뿐이고, `_shared.ts`·`internal-package-registration-guard.ts`·
    `typescript-toolchain-guard.ts` 등 소스 자체는 이 커밋에서 건드리지 않았다. 직전 라운드
    `maintainability` WARNING("`listAtPath`/`blockRange`/`findKeyLine` 은 소유 모듈에서 직접 방어되지
    않는다")이 요구한 것은 "`listAtPath` 최소 회귀 테스트를 `shared.test.ts` 로 옮기거나 추가"였고,
    실제 조치는 정확히 그 4건(중첩 경로·형제 키·null·인라인 주석)을 **이동**했다(총 82건 불변 —
    `RESOLUTION.md` 의 "복제가 아님" 주장을 `shared.test.ts` 신규분 52줄과 `internal-package-registration.test.ts`
    제거분 대조로 확인, 숫자 일치). `blockRange`/`findKeyLine` 은 WARNING 이 "필수"로 요구하지 않은
    확장(내부 헬퍼 직접 테스트)까지는 손대지 않고, 대신 헤더 주석에 "간접 검증이 판단임"을 명시하는
    선에서 멈췄다 — 요구 범위를 넘지 않았다.
  - 제안: 없음. scope 관점에서 이상적인 최소 대응.

- **[INFO]** 리뷰 산출물 디렉터리 전체(11파일)가 별도 커밋으로 이 브랜치에 포함됨 — 실제 plan
  작업(§1/§2/§4) 범위 밖의 프로세스 housekeeping이나, 근거가 커밋 메시지에 명시돼 있다
  - 위치: `review/code/2026/08/10/11_22_14/` 하위 11개 신규 파일 전체 (커밋 `3f8ffaf6b`)
  - 상세: `git show 3f8ffaf6b`의 커밋 메시지는 "리뷰 게이트의 freshness fold-in 이 완전 미추적
    디렉터리를 못 본다 — `git status --porcelain` 이 그런 디렉터리를 한 줄로 접어 `RESOLUTION.md`
    개별 경로가 dirty 집합에 안 잡힌다"는 구체적 결함을 근거로 든다. 이 근거는 오늘 아침 별도
    파일(`git_probe.py`, 이번 diff 밖)에서 같은 클래스로 `-uall` 수정이 있었다는 사용자 세션
    맥락과도 정합한다. `review/`는 CLAUDE.md 상 gitignore 대상이 아니라 지정된 저장 위치이므로,
    "리뷰 산출물을 커밋한다" 자체는 이 저장소의 정착된 워크플로다(발견 자체가 아니라 다른 성격의
    변경 — 기술 작업 vs 프로세스 housekeeping — 이 한 브랜치에 섞였다는 점만 기록).
  - 제안: 조치 불요. 다만 `meta.json`/`_retry_state.json`처럼 orchestrator 내부 상태 파일까지
    함께 커밋된 것은 "산출물"이 아니라 "디렉터리 전체를 추적 대상화"가 목적이라는 커밋 메시지의
    설명과 일치하므로 이 역시 의도된 범위다.

- **[INFO]** `repoRoot`/`discoverWorkspaceDirs`의 DI 파라미터 확장(plan §1 원문 "이관"보다 넓음)은
  이미 두 차례(R2/R3) 리뷰·수정 순환을 거쳐 이번 라운드에서 plan 제목 자체를 "분리 + DI 대칭화"로
  정정하는 것으로 수렴했다 — 재지적 대상 아님
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:40-43` (gate),
    `typescript-toolchain-guard.ts:141-145` (gate), `plan/in-progress/typescript-toolchain-followups.md:97-110` (gate)
  - 상세: 이 diff 안에 그 자체가 리뷰 대상으로 포함된 `review/code/2026/08/10/11_22_14/scope.md`
    (파일 15)가 동일 사안을 이미 INFO로 판정하며 "이관 표현이 실제 작업보다 좁게 적혔던 것"이라고
    결론냈고, 이번 라운드의 plan diff(파일 7, gate 97~110줄)가 그 결론을 제목·본문에 반영해 문서와
    코드의 괴리를 닫았다. 새로 재판정할 근거 변화가 없다.
  - 제안: 없음 — 이미 닫힌 항목의 재확인.

## 요약

이번 라운드(11_44_32)의 실질 코드 변경은 `76f9aa0f2` 커밋 하나로, 직전 라운드가 지정한 WARNING
1건(`listAtPath` 소유 모듈 테스트 부재)과 INFO 1건(plan §1 제목 협소)만 정확히 고쳤다 — 테스트
이동은 82건 총량 불변으로 복제가 아님을 자체 검증했고, 요구되지 않은 추가 리팩터(예:
`blockRange`/`findKeyLine` 직접 테스트 신설)로 번지지 않았다. 나머지 새 콘텐츠는 직전 리뷰
라운드(`11_22_14`)의 산출물 11개 파일을 별도 커밋으로 추가한 것인데, 커밋 메시지가 "미추적
디렉터리가 리뷰 게이트의 freshness 판정을 통과 못 한다"는 구체적 결함을 근거로 명시하고 있어
무단 확장이 아니라 이 저장소가 이미 채택한 "review/ 산출물은 커밋해 추적한다" 관행의 연장이다.
plan 작업(§1/§2/§4) 범위와 리뷰 프로세스 housekeeping이라는 성격이 다른 두 변경이 한 브랜치에
섞여 있다는 점은 사실이나, 후자가 바로 전자에 대한 리뷰 결과물이라는 점에서 분리 커밋보다 자연스러운
배치다. 무관한 파일·설정·포맷팅-only 변경, 미사용 임포트, 요청 밖 기능 확장은 발견되지 않았다.

## 위험도

LOW
