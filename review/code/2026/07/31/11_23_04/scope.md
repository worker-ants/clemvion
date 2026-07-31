# 변경 범위(Scope) 리뷰 — codebase/frontend/package.json

## 대상 커밋

`66e574209` "fix(deps): postcss 보안 bump 복원 — main 의 lockfile 드리프트로 깨진 빌드 수정"
diff: `codebase/frontend/package.json` 1줄 변경 (`postcss`: `^8.5.14` → `^8.5.18`).

## 발견사항

- **[WARNING]** 현재 워크트리(브랜치)의 선언된 작업 범위는 `plan/in-progress/workflow-duplicate-nodes-edges.md` — "워크플로우 복제가 빈 워크플로우를 만든다" 결함 수정이다. 이번 diff(`postcss` 버전 bump)는 그 기능 범위와 무관한 별개 관심사(프론트엔드 의존성/lockfile 정합성)다.
  - 위치: `codebase/frontend/package.json:52`
  - 상세: 커밋 메시지 자체가 이 사실을 명시적으로 인정한다 — "본 PR(워크플로우 복제 결함 수정)과 무관한 선재 결함이나, 이걸 고치지 않으면 본 PR 의 CI 도 같은 지점에서 실패한다. 사용자 확인 후 포함." 즉 스코프 이탈이 아니라 **의도적·고지된 예외**다. 다음 완화 요인을 실측 확인했다:
    1. **격리된 단일 커밋**: 기능 커밋과 섞이지 않고 별도 커밋(`66e574209`)으로 분리됨 — diff 도 `package.json` 1줄뿐(전체 파일 대조 결과 다른 라인 변경 없음).
    2. **필요성 검증**: `pnpm-lock.yaml` 의 `codebase/frontend` importer 블록(line 106 부근)에 이미 `postcss: specifier: ^8.5.18` 로 기록돼 있어, 이번 변경은 lockfile 과 package.json 간 **기존 드리프트를 해소**하는 것이지 새 드리프트를 만드는 게 아니다. 커밋 메시지의 "lockfile 은 이미 ^8.5.18 이라 무변경" 주장과 일치.
    3. **사용자 확인 기록**: 커밋 메시지에 "사용자 확인 후 포함" 명시.
    4. **회귀 계보 설명**: `5898ae13f`(보안 bump, CI success) → `395dedc8b`(그 이전 base 에서 만들어져 postcss 를 실수로 되돌림, lockfile 과 불일치 유발) → 본 커밋(복원)의 경위가 커밋 메시지에 상세히 서술되어 있어 추적 가능.
  - 제안: 코드 조치 불요. 다만 PR 본문/`plan/in-progress/workflow-duplicate-nodes-edges.md` 에 "이 브랜치는 main CI 차단 해소를 위해 postcss lockfile 드리프트 수정 1커밋을 포함한다"는 한 줄 각주를 남기면, 병합자·이후 리뷰어가 왜 무관한 의존성 커밋이 이 PR 에 들어왔는지 diff 만으로도 즉시 파악할 수 있다(현재는 plan 문서에 이 커밋에 대한 언급이 없음 — 커밋 메시지에만 근거가 있다).

- **[INFO]** 위 WARNING 과 같은 근거로, 이 diff 자체의 내부 스코프는 매우 깔끔하다: 포맷팅 변경·주석 변경·임포트 변경·불필요한 리팩토링·기능 확장 없음. `//pin` 주석(line 5, non-caret 핀 정책 문서화)도 `postcss` 는 caret(`^`) 유지 대상이라 수정 대상이 아니며 실제로 손대지 않았다 — 정책과 일치.
  - 위치: `codebase/frontend/package.json` (전체 파일)
  - 상세: 해당 없음(참고용).
  - 제안: 없음.

## 요약

이번 리뷰 대상은 `codebase/frontend/package.json` 의 `postcss` 버전 스펙 1줄(`^8.5.14` → `^8.5.18`) 뿐이다. 이 diff 는 현재 워크트리의 주 작업(워크플로우 복제 빈 워크플로우 결함 수정)과는 기능적으로 무관한 별개 관심사이지만, (1) 별도 커밋으로 격리, (2) 커밋 메시지에 스코프 이탈 사유·경위·필요성을 명시적으로 서술, (3) 사용자 확인 완료 기재, (4) `pnpm-lock.yaml` 대조로 실제 lockfile 드리프트 해소 목적임을 검증 — 네 조건을 모두 충족한 "고지된 예외"다. diff 내부에는 포맷팅·주석·임포트·리팩토링 등 부수적 잡음이 전혀 없다. 유일한 개선 여지는 이 사실을 plan 문서에도 한 줄 남겨 추적성을 높이는 것뿐이며, 이는 코드 변경이 아닌 문서 보완 제안이다.

## 위험도

LOW
