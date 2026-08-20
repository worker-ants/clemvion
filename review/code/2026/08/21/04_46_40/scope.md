# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (최종 라운드, HEAD `e09e25ff1`)

## 검토 방법

`git log origin/main..HEAD` 로 브랜치의 전체 커밋 12개(`3e96f4b44`~`e09e25ff1`)를 확인하고,
`git diff origin/main...HEAD --stat -- codebase/` 로 실질 애플리케이션 코드 diff(15 files,
+1386/-12)를 별도 확정했다. 프롬프트가 diff 를 생략한 신규 파일(`reject-masked-resubmission.ts`,
`production-build-devdep-guard.ts` 등)은 `Read`로 직접 열어 대조했다. 나머지 164개 파일
(`review/code/**`·`review/consistency/**` 산출물, `spec/**`, `plan/**`, `CHANGELOG.md`)은
diff 를 대조해 실질 기능 확장이 섞여 있는지 확인했다.

## 발견사항

- **[WARNING]** `production-build-devdep-guard.ts` + `.spec.ts`(신규, 279줄)가 "마스킹 재제출
  거부"와 무관한 **저장소 전역 빌드-위생 불변식**(프로덕션 빌드 대상 어떤 파일도 devDependency
  를 런타임 참조하지 않는다)을 검증하는 범용 정적 분석 도구로 이번 PR에 포함됐다
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts`(전체,
    특히 `resolveBuildFileNames`/`collectRuntimeModuleSpecifiers`/`findDevDepLeaks`),
    `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts`(전체)
  - 상세: 이 파일은 `tsconfig.build.json` 이 실제로 컴파일할 파일 목록을 `ts.parseJsonConfigFileContent`
    로 정본 해석한 뒤, backend `src/` 전체(약 805개 파일)를 AST 로 순회해 `import`/`export
    ... from`/`require()`/동적 `import()` 네 자리 전부에서 참조하는 패키지가 `devDependencies`
    에만 있는지 검사한다. 대상 범위·목적 모두 "마스킹 마커 재제출 거부"라는 이번 작업 제목과
    직접 관련이 없다 — 이번 기능이 만든 특정 파일(`masked-reject-callers-guard.ts`)이
    devDependency `typescript` 를 import 해 `dist` 로 새는 것을 막으면 될 문제인데, 해결책은
    "미래에 어떤 파일이 어떤 devDependency 를 끌어와도" 잡는 저장소 전체 스캐너로 일반화됐다.
    `git log`로 도입 경위를 추적하면: 라운드8(`e9b942b08`)이 `masked-reject-callers-guard.ts`
    를 정규식→AST(`typescript` import)로 재작성 → `tsconfig.build.json` 에 `src/repo-guards/**`
    exclude 추가(devDependency 유출 방지) → 라운드9(`e09e25ff1`, 이번 diff 의 HEAD)가 "그
    exclude 의 보장 근거가 개발 중 클린 빌드 확인 1회뿐" 이라는 리뷰 WARNING에 대응해 이 범용
    가드를 새로 만들었다. 즉 **이 PR 이 스스로 선택한 구현 방식(AST 파서 도입)이 파생시킨
    문제를, 그 문제를 국소적으로 막는 대신 저장소 전역에 적용되는 새 CI 불변식으로 해결**한
    것이다. `CHANGELOG.md` 최상단 항목("마커 재제출을 서버가 거부한다")에는 이 가드가 전혀
    언급되지 않는다 — 문서화된 PR 범위와 실제로 들어간 코드 범위가 어긋난다.
  - 제안: 필수 조치는 아니다(코드 자체는 순수 읽기 전용이고 뮤테이션 테스트로 검증됐으며
    잘못된 것은 없다). 다만 이런 저장소 전역 불변식 가드는 성격상 별도 PR/커밋으로 분리해
    독립적인 리뷰·CHANGELOG 항목을 받는 편이 "이 PR = 마스킹 재제출 거부" 라는 스코프 선언과
    합치한다. 최소한 CHANGELOG 나 커밋 메시지에 "이번 기능의 부산물로 저장소 전역 devDependency
    누출 방지 가드를 신설했다"는 한 줄이 있었으면 스코프 확장이 의도적임이 리뷰 없이도
    드러났을 것이다.

- **[INFO]** 신규 repo-guard 인프라(가드 로직 + spec + tsconfig 조정) 총량이 핵심 기능 구현량과
  맞먹거나 넘는다
  - 위치: `masked-reject-callers-guard.ts`(153) + `masked-reject-callers.spec.ts`(169) +
    `production-build-devdep-guard.ts`(126) + `production-build-devdep.spec.ts`(153) +
    `tsconfig.build.json`(+12/-1) ≈ **613줄**, vs 핵심 기능
    `reject-masked-resubmission.ts`(145, 신규) + `.spec.ts`(317) + 타입/호출부 변경
    (`trigger-parameter.types.ts` +23, `executions.service.ts` +21/-일부,
    `workflows.controller.ts` +7, `sanitize-error-message.ts` +14/-일부) ≈ **785줄**(스펙 포함).
    가드 인프라 단독으로도 `codebase/` 전체 diff(15파일, +1386)의 약 44%를 차지한다.
  - 상세: 9라운드에 걸친 리뷰-수정 사이클의 상당수(라운드4·5·6·7·8·9, 총 6라운드)가 원 기능이
    아니라 **가드 자신의 결함**(정규식 우회 4형태, `Object.freeze(Set)` 플라시보, 탐지 능력
    무보증 등)을 고치는 데 쓰였다 — 이는 이미 각 RESOLUTION.md 가 스스로 인지·기록한 패턴이고
    ("가드를 넣어 결함을 막으려다 가드가 새 결함 표면이 됐다"), 매 라운드 최종 처분까지 근거를
    남겨 병합을 막을 사유는 아니다. 다만 scope 관점에서 보면, "재제출 거부"라는 원 요구사항
    대비 방어용 메타 인프라(정적 분석 가드)가 불균형하게 커졌다는 사실 자체는 기록해 둘
    가치가 있다.
  - 제안: 조치 불요(이미 수렴, 매 라운드 근거 명시). 참고 등재.

## 검증 완료 — 스코프 이탈 없음 확인 항목

- **핵심 기능 파일 8개** (`trigger-parameter.types.ts`, `reject-masked-resubmission.ts`(+spec),
  `executions.service.ts`(+spec), `workflows.controller.ts`(+spec), `sanitize-error-message.ts`
  (+spec))는 전부 "마스킹 마커 재제출을 서버가 거부한다"는 단일 의도에서 벗어나지 않는다.
  `sanitize-error-message.ts` 의 `isMaskedMarker`/`MASKED_MARKERS` export 승격은 로직 변경
  없이 기존 판정을 재사용하기 위한 것이고, `executions.service.ts` 의 `errors`→`details`
  교정은 이번 신규 코드가 배선을 거치지 않으면 무의미해지는 직접 결합된 선존 버그다.
  불필요한 리팩토링·무관한 import 정리·포맷팅 전용 변경은 발견되지 않았다.
- **spec 7곳**(`spec/1-data-model.md`, `3-workflow-editor/3-execution.md`,
  `4-nodes/7-trigger/1-manual-trigger.md`, `5-system/{3-error-handling,12-webhook,
  13-replay-rerun,14-external-interaction-api}.md`)은 전부 `masked_value_resubmitted`/§R17
  범위·검사 시점 서술에 국한되고, `Read`로 직접 대조한 결과 다른 무관 섹션을 함께 고친 흔적이
  없다.
- **`review/code/**`·`review/consistency/**` 141개 파일·`plan/**` 3개 파일**은 이 저장소의
  SDD+TDD 워크플로가 요구하는 라운드별 필수 산출물이며(`CLAUDE.md` 정보 저장 위치 표), 이미
  이 리뷰 체인 안에서 여러 차례(`01_15_47/scope.md` 등) 독립적으로 "표준 부산물, 스코프 이탈
  아님"으로 확인됐다 — 이번 라운드에서도 새로 발견된 이탈은 없다. `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md` 에서 W6(이번 작업)와 W5(무관 항목)가 같은 커밋
  으로 동반 종결된 것은 과거에도 정책적으로 허용돼 온 그루밍 관례이고 코드 변경이 없어 실질
  위험이 낮다(이전 라운드 INFO 로 이미 처분).
- **`tsconfig.build.json`**의 `src/repo-guards/**` exclude 자체는 이번 PR 이 만든 devDependency
  참조(`typescript`)를 프로덕션 빌드에서 제외하기 위한 직접 필요 조치로, 스코프 안이다(위
  WARNING은 그 exclude 자체가 아니라 그것을 검증하는 **범용화된 가드의 도입**을 지적한다).

## 요약

핵심 기능(마스킹 마커 재제출 서버측 거부, 8개 프로덕션 파일)은 "요청된 변경"에 정확히
부합하고 불필요한 리팩토링·포맷팅·주석·import 잡음이 없다. spec 7곳과 대량의 `review/**`·
`plan/**` 변경도 이 저장소의 표준 워크플로 부산물로 스코프 이탈이 아니다. 다만 이번 diff의
HEAD(`e09e25ff1`, 라운드9)에서 새로 추가된 `production-build-devdep-guard.ts`(+spec, 279줄)는
"마스킹 재제출 거부"라는 선언된 작업 범위를 넘어 저장소 전역 devDependency 누출을 감시하는
범용 CI 불변식 도구다 — 이 PR 이 스스로 선택한 구현 방식(AST 파서 도입)이 낳은 부작용을
국소적으로 막는 대신 일반화해서 해결한 결과이며, CHANGELOG 에는 언급되지 않는다. 코드 자체는
읽기 전용이고 잘 테스트됐지만, 스코프 선언과 실제 diff 범위 사이에 괴리가 있다는 점은 병합
전 인지해 둘 필요가 있다(별도 PR 분리 또는 CHANGELOG 한 줄 보강 권고).

## 위험도

MEDIUM
